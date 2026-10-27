<?php
/**
 * SPORT+FITNESS - API de clientes (solo administrador)
 *
 * GET    api/clientes.php            -> lista de clientes con sus datos, nº de pedidos,
 *                                       total gastado, última compra y días sin comprar
 * GET    api/clientes.php?id=X       -> detalle de un cliente + todos sus pedidos
 * POST   api/clientes.php            -> crea un cliente        { nombre, correo, telefono, password }
 * POST   api/clientes.php { accion: "cambiar_estado", id, activo, motivo }
 *                                     -> habilita / deshabilita una cuenta
 * POST   api/clientes.php { accion: "desactivar_inactivos", dias, ids, simular }
 *                                     -> deshabilita las cuentas sin comprar en N días
 * PUT    api/clientes.php            -> edita un cliente       { id, nombre, correo, telefono, password? }
 * DELETE api/clientes.php?id=X       -> elimina un cliente (solo si no tiene pedidos)
 *
 * "Días sin comprar" = días desde el último pedido no cancelado; si el
 * cliente nunca ha comprado, desde su fecha de registro.
 *
 * Todo requiere sesión de administrador (ver sf_requerir_admin en config.php).
 */

require_once __DIR__ . '/config.php';

sf_requerir_admin();

$pdo = sf_conectar();
$metodo = $_SERVER['REQUEST_METHOD'];

// ---------- Verifica que la migración de "activo" ya se ejecutó ----------
$columna = $pdo->query("SHOW COLUMNS FROM usuarios LIKE 'activo'")->fetch();
if (!$columna) {
    sf_responder(false, [], 'Falta preparar la base de datos: ejecuta BD/migracion_clientes_admin.sql (o vuelve a importar BD/127_0_0_1.sql si es una instalación nueva) y vuelve a intentar.', 422);
}

// ---------- Helpers ----------

/** SELECT base: un cliente con sus métricas de compra. */
function sf_clientes_sql_base() {
    return "SELECT u.id, u.nombre, u.email, u.telefono, u.fecha_registro, u.activo,
                   u.fecha_desactivacion, u.motivo_desactivacion,
                   COUNT(p.id) AS total_pedidos,
                   COALESCE(SUM(p.total), 0) AS total_gastado,
                   MAX(p.fecha_pedido) AS ultimo_pedido,
                   TIMESTAMPDIFF(DAY, COALESCE(MAX(p.fecha_pedido), u.fecha_registro), NOW()) AS dias_sin_comprar
            FROM usuarios u
            LEFT JOIN pedidos p ON p.usuario_id = u.id AND p.estado <> 'cancelado'
            WHERE u.rol = 'Cliente'";
}

/** Convierte una fila de la BD al formato que usa el front-end. */
function sf_cliente_formatear($f) {
    return [
        'id' => (int) $f['id'],
        'nombre' => $f['nombre'],
        'correo' => $f['email'],
        'telefono' => $f['telefono'],
        'fecha_registro' => $f['fecha_registro'] ? str_replace(' ', 'T', $f['fecha_registro']) : null,
        'activo' => (int) $f['activo'] === 1,
        'fecha_desactivacion' => $f['fecha_desactivacion'] ? str_replace(' ', 'T', $f['fecha_desactivacion']) : null,
        'motivo_desactivacion' => $f['motivo_desactivacion'],
        'total_pedidos' => (int) $f['total_pedidos'],
        'total_gastado' => (float) $f['total_gastado'],
        'ultimo_pedido' => $f['ultimo_pedido'] ? str_replace(' ', 'T', $f['ultimo_pedido']) : null,
        'nunca_compro' => (int) $f['total_pedidos'] === 0,
        'dias_sin_comprar' => max(0, (int) $f['dias_sin_comprar']),
    ];
}

/** Trae un cliente (rol Cliente) con métricas, o null si no existe. */
function sf_cliente_obtener($pdo, $id) {
    $stmt = $pdo->prepare(sf_clientes_sql_base() . ' AND u.id = :id GROUP BY u.id');
    $stmt->execute(['id' => $id]);
    $fila = $stmt->fetch();
    // Con COUNT/GROUP BY, una fila sin coincidencia no existe: se valida el id.
    return ($fila && $fila['id'] !== null) ? sf_cliente_formatear($fila) : null;
}

function sf_validar_datos_cliente($nombre, $correo, $telefono) {
    if (mb_strlen($nombre) < 2) {
        sf_responder(false, [], 'Escribe el nombre del cliente.', 422);
    }
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        sf_responder(false, [], 'Escribe un correo válido.', 422);
    }
    if ($correo === SF_ADMIN_CORREO_FIJO) {
        sf_responder(false, [], 'Ese correo está reservado para el administrador.', 422);
    }
    if (!preg_match('/^[0-9]{7,15}$/', $telefono)) {
        sf_responder(false, [], 'El teléfono debe tener entre 7 y 15 dígitos numéricos.', 422);
    }
}

function sf_correo_en_uso($pdo, $correo, $excluirId = 0) {
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email = :email AND id <> :id');
    $stmt->execute(['email' => $correo, 'id' => $excluirId]);
    return (bool) $stmt->fetch();
}

// ---------- Rutas ----------

switch ($metodo) {

    // =========================================================
    // LISTAR / DETALLE
    // =========================================================
    case 'GET':

        if (isset($_GET['id'])) {

            $cliente = sf_cliente_obtener($pdo, (int) $_GET['id']);
            if (!$cliente) {
                sf_responder(false, [], 'El cliente no existe.', 422);
            }

            $stmt = $pdo->prepare('SELECT id, total, estado, fecha_pedido, direccion_envio, ciudad, telefono_contacto, metodo_pago, notas
                                   FROM pedidos WHERE usuario_id = :id ORDER BY fecha_pedido DESC');
            $stmt->execute(['id' => $cliente['id']]);
            $pedidos = $stmt->fetchAll();

            $stmtItems = $pdo->prepare('SELECT nombre_producto AS nombre, cantidad, precio_unitario AS precio
                                        FROM detalle_pedidos WHERE pedido_id = :id');

            $salida = [];
            foreach ($pedidos as $p) {
                $stmtItems->execute(['id' => $p['id']]);
                $items = $stmtItems->fetchAll();
                foreach ($items as &$it) {
                    $it['cantidad'] = (int) $it['cantidad'];
                    $it['precio'] = (float) $it['precio'];
                }
                unset($it);

                $salida[] = [
                    'id' => (int) $p['id'],
                    'fecha' => str_replace(' ', 'T', $p['fecha_pedido']),
                    'total' => (float) $p['total'],
                    'estado' => $p['estado'],
                    'direccion' => $p['direccion_envio'],
                    'ciudad' => $p['ciudad'],
                    'telefono' => $p['telefono_contacto'],
                    'metodoPago' => $p['metodo_pago'],
                    'notas' => $p['notas'],
                    'items' => $items,
                ];
            }

            sf_responder(true, ['cliente' => $cliente, 'pedidos' => $salida]);
        }

        $stmt = $pdo->query(sf_clientes_sql_base() . ' GROUP BY u.id ORDER BY u.nombre');
        $clientes = array_map('sf_cliente_formatear', $stmt->fetchAll());

        sf_responder(true, ['clientes' => $clientes]);
        break;

    // =========================================================
    // CREAR + ACCIONES (cambiar estado, desactivar inactivos)
    // =========================================================
    case 'POST':
        $datos = sf_leer_body();
        $accion = $datos['accion'] ?? 'crear';

        if ($accion === 'crear') {

            $nombre = trim($datos['nombre'] ?? '');
            $correo = strtolower(trim($datos['correo'] ?? ''));
            $telefono = trim($datos['telefono'] ?? '');
            $password = (string) ($datos['password'] ?? '');

            sf_validar_datos_cliente($nombre, $correo, $telefono);

            if (strlen($password) < 6) {
                sf_responder(false, [], 'La contraseña debe tener al menos 6 caracteres.', 422);
            }
            if (sf_correo_en_uso($pdo, $correo)) {
                sf_responder(false, [], 'Ya existe una cuenta registrada con ese correo.', 409);
            }

            $stmt = $pdo->prepare('INSERT INTO usuarios (rol, nombre, email, password, telefono)
                                   VALUES ("Cliente", :nombre, :email, :password, :telefono)');
            $stmt->execute([
                'nombre' => $nombre,
                'email' => $correo,
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'telefono' => $telefono,
            ]);

            sf_responder(true, ['cliente' => sf_cliente_obtener($pdo, (int) $pdo->lastInsertId())], 'Cliente creado.');

        } elseif ($accion === 'cambiar_estado') {

            $id = (int) ($datos['id'] ?? 0);
            $activar = !empty($datos['activo']);
            $motivo = mb_substr(trim($datos['motivo'] ?? ''), 0, 255);

            if (!sf_cliente_obtener($pdo, $id)) {
                sf_responder(false, [], 'El cliente no existe.', 422);
            }

            if ($activar) {
                $stmt = $pdo->prepare('UPDATE usuarios SET activo = 1, fecha_desactivacion = NULL, motivo_desactivacion = NULL WHERE id = :id');
                $stmt->execute(['id' => $id]);
            } else {
                $stmt = $pdo->prepare('UPDATE usuarios SET activo = 0, fecha_desactivacion = NOW(), motivo_desactivacion = :motivo WHERE id = :id');
                $stmt->execute(['id' => $id, 'motivo' => $motivo !== '' ? $motivo : 'Deshabilitada por el administrador']);
            }

            sf_responder(true, ['cliente' => sf_cliente_obtener($pdo, $id)],
                $activar ? 'Cuenta habilitada.' : 'Cuenta deshabilitada.');

        } elseif ($accion === 'desactivar_inactivos') {

            // Deshabilita a los clientes activos que llevan al menos N días
            // sin comprar. Con "simular": true solo devuelve a quiénes
            // afectaría. Con "ids" limita la acción a esa selección, pero
            // cada cliente se vuelve a validar aquí contra el umbral.
            $dias = (int) ($datos['dias'] ?? 0);
            if ($dias < 1 || $dias > 3650) {
                sf_responder(false, [], 'Indica un número de días válido (entre 1 y 3650).', 422);
            }

            $stmt = $pdo->query(sf_clientes_sql_base() . ' AND u.activo = 1 GROUP BY u.id');
            $candidatos = array_filter(
                array_map('sf_cliente_formatear', $stmt->fetchAll()),
                function ($c) use ($dias) { return $c['dias_sin_comprar'] >= $dias; }
            );

            if (isset($datos['ids']) && is_array($datos['ids'])) {
                $permitidos = array_map('intval', $datos['ids']);
                $candidatos = array_filter($candidatos, function ($c) use ($permitidos) {
                    return in_array($c['id'], $permitidos, true);
                });
            }
            $candidatos = array_values($candidatos);

            if (!empty($datos['simular'])) {
                sf_responder(true, ['candidatos' => $candidatos]);
            }

            $stmtUpd = $pdo->prepare('UPDATE usuarios SET activo = 0, fecha_desactivacion = NOW(), motivo_desactivacion = :motivo
                                      WHERE id = :id AND activo = 1');
            $pdo->beginTransaction();
            foreach ($candidatos as $c) {
                $stmtUpd->execute([
                    'id' => $c['id'],
                    'motivo' => 'Inactividad: ' . $c['dias_sin_comprar'] . ' días sin comprar',
                ]);
            }
            $pdo->commit();

            sf_responder(true, ['desactivados' => count($candidatos)],
                count($candidatos) . ' cuenta(s) deshabilitada(s) por inactividad.');

        } else {
            sf_responder(false, [], 'Acción no reconocida.', 422);
        }
        break;

    // =========================================================
    // EDITAR
    // =========================================================
    case 'PUT':
        $datos = sf_leer_body();
        $id = (int) ($datos['id'] ?? 0);
        $nombre = trim($datos['nombre'] ?? '');
        $correo = strtolower(trim($datos['correo'] ?? ''));
        $telefono = trim($datos['telefono'] ?? '');
        $password = (string) ($datos['password'] ?? '');

        if (!sf_cliente_obtener($pdo, $id)) {
            sf_responder(false, [], 'El cliente no existe.', 422);
        }

        sf_validar_datos_cliente($nombre, $correo, $telefono);

        if ($password !== '' && strlen($password) < 6) {
            sf_responder(false, [], 'La nueva contraseña debe tener al menos 6 caracteres.', 422);
        }
        if (sf_correo_en_uso($pdo, $correo, $id)) {
            sf_responder(false, [], 'Ya existe otra cuenta registrada con ese correo.', 409);
        }

        if ($password !== '') {
            $stmt = $pdo->prepare('UPDATE usuarios SET nombre = :nombre, email = :email, telefono = :telefono, password = :password WHERE id = :id');
            $stmt->execute(['nombre' => $nombre, 'email' => $correo, 'telefono' => $telefono,
                            'password' => password_hash($password, PASSWORD_DEFAULT), 'id' => $id]);
        } else {
            $stmt = $pdo->prepare('UPDATE usuarios SET nombre = :nombre, email = :email, telefono = :telefono WHERE id = :id');
            $stmt->execute(['nombre' => $nombre, 'email' => $correo, 'telefono' => $telefono, 'id' => $id]);
        }

        sf_responder(true, ['cliente' => sf_cliente_obtener($pdo, $id)], 'Cliente actualizado.');
        break;

    // =========================================================
    // ELIMINAR
    // =========================================================
    case 'DELETE':
        $id = (int) ($_GET['id'] ?? 0);
        $cliente = sf_cliente_obtener($pdo, $id);

        if (!$cliente) {
            sf_responder(false, [], 'El cliente no existe.', 422);
        }

        // Los pedidos son historial de ventas: si el cliente tiene alguno
        // (de cualquier estado) no se borra, para no perder esa información.
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM pedidos WHERE usuario_id = :id');
        $stmt->execute(['id' => $id]);
        if ((int) $stmt->fetchColumn() > 0) {
            sf_responder(false, [], 'Este cliente tiene pedidos registrados y no se puede eliminar para conservar el historial de ventas. Deshabilita la cuenta en su lugar.', 409);
        }

        $stmt = $pdo->prepare('DELETE FROM usuarios WHERE id = :id AND rol = "Cliente"');
        $stmt->execute(['id' => $id]);

        sf_responder(true, [], 'Cliente eliminado.');
        break;

    default:
        sf_responder(false, [], 'Método no permitido.', 405);
}
