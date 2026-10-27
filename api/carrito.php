<?php
/**
 * SPORT+FITNESS - API del carrito de compras (por cuenta)
 * GET  api/carrito.php?correo=...        -> carrito guardado de esa cuenta
 * POST api/carrito.php { correo, items } -> guarda/reemplaza el carrito de esa cuenta
 *
 * El carrito de un visitante SIN sesión sigue viviendo solo en su
 * navegador (localStorage), como siempre. Este endpoint solo entra en
 * juego cuando hay una cuenta real de por medio, para que el carrito
 * quede asociado a esa cuenta y aparezca igual sin importar desde qué
 * dispositivo o navegador se inicie sesión.
 */

require_once __DIR__ . '/config.php';

$pdo = sf_conectar();
$metodo = $_SERVER['REQUEST_METHOD'];

function sf_carrito_usuario_id($pdo, $correo) {
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email = :email');
    $stmt->execute(['email' => $correo]);
    $id = $stmt->fetchColumn();
    return $id ? (int) $id : null;
}

if ($metodo === 'GET') {

    $correo = strtolower(trim($_GET['correo'] ?? ''));

    if ($correo === '') {
        sf_responder(false, [], 'Falta el correo de la cuenta.', 422);
    }

    $usuarioId = sf_carrito_usuario_id($pdo, $correo);

    if (!$usuarioId) {
        // Cuenta que no existe en esta base de datos (por ejemplo, el
        // administrador fijo, o una cuenta creada offline que aún no
        // se sincronizó): no hay carrito guardado en el servidor.
        sf_responder(true, ['carrito' => []]);
    }

    $stmt = $pdo->prepare('SELECT producto_id AS id, nombre_producto AS nombre, precio_unitario AS precio,
                                   imagen, cantidad
                            FROM carritos WHERE usuario_id = :usuario_id ORDER BY id ASC');
    $stmt->execute(['usuario_id' => $usuarioId]);
    $carrito = $stmt->fetchAll();

    foreach ($carrito as &$item) {
        $item['precio'] = (float) $item['precio'];
        $item['cantidad'] = (int) $item['cantidad'];
    }

    sf_responder(true, ['carrito' => $carrito]);

} elseif ($metodo === 'POST') {

    $datos = sf_leer_body();
    $correo = strtolower(trim($datos['correo'] ?? ''));
    $items = $datos['items'] ?? [];

    if ($correo === '') {
        sf_responder(false, [], 'Falta el correo de la cuenta.', 422);
    }

    if (!is_array($items)) {
        sf_responder(false, [], 'El carrito debe ser una lista de productos.', 422);
    }

    $usuarioId = sf_carrito_usuario_id($pdo, $correo);

    if (!$usuarioId) {
        // No existe la cuenta en esta base de datos todavía: no hay
        // dónde guardar el carrito en el servidor. El front-end sigue
        // funcionando igual con su copia local (ver js/script.js).
        sf_responder(false, [], 'La cuenta no está registrada en el servidor.', 404);
    }

    try {
        $pdo->beginTransaction();

        // Se reemplaza el carrito completo: es más simple y evita
        // desajustes entre lo que hay en el navegador y en la base de
        // datos (el mismo enfoque que ya usa el resto de la app para
        // sincronizar listas completas).
        $stmtBorrar = $pdo->prepare('DELETE FROM carritos WHERE usuario_id = :usuario_id');
        $stmtBorrar->execute(['usuario_id' => $usuarioId]);

        if (!empty($items)) {
            $stmtInsertar = $pdo->prepare('INSERT INTO carritos (usuario_id, producto_id, nombre_producto, precio_unitario, imagen, cantidad)
                                            VALUES (:usuario_id, :producto_id, :nombre, :precio, :imagen, :cantidad)');

            foreach ($items as $item) {
                $productoId = trim($item['id'] ?? '');
                if ($productoId === '') continue;

                $stmtInsertar->execute([
                    'usuario_id' => $usuarioId,
                    'producto_id' => $productoId,
                    'nombre' => $item['nombre'] ?? '',
                    'precio' => (float) ($item['precio'] ?? 0),
                    'imagen' => $item['imagen'] ?? null,
                    'cantidad' => max(1, (int) ($item['cantidad'] ?? 1)),
                ]);
            }
        }

        $pdo->commit();
        sf_responder(true, [], 'Carrito guardado.');

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sf_responder(false, [], 'No se pudo guardar el carrito.', 500);
    }

} else {
    sf_responder(false, [], 'Método no permitido.', 405);
}
