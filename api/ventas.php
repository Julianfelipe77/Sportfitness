<?php
/**
 * SPORT+FITNESS - API de ventas
 * GET  api/ventas.php   -> historial de ventas (panel de administrador)
 * POST api/ventas.php   -> registra una venta desde el carrito (checkout)
 */

require_once __DIR__ . '/config.php';

$pdo = sf_conectar();
$metodo = $_SERVER['REQUEST_METHOD'];

if ($metodo === 'GET') {

    $stmt = $pdo->query('SELECT p.id, p.total, p.fecha_pedido, p.direccion_envio, p.ciudad, p.telefono_contacto, p.metodo_pago, p.notas,
                                 u.nombre AS cliente_nombre, u.email AS cliente_correo
                          FROM pedidos p
                          JOIN usuarios u ON u.id = p.usuario_id
                          ORDER BY p.fecha_pedido DESC');
    $pedidos = $stmt->fetchAll();

    $stmtItems = $pdo->prepare('SELECT producto_id AS id, nombre_producto AS nombre, cantidad, precio_unitario AS precio
                                 FROM detalle_pedidos WHERE pedido_id = :id');

    $ventas = [];
    foreach ($pedidos as $p) {
        $stmtItems->execute(['id' => $p['id']]);
        $items = $stmtItems->fetchAll();
        foreach ($items as &$it) {
            $it['precio'] = (float) $it['precio'];
            $it['cantidad'] = (int) $it['cantidad'];
        }

        $ventas[] = [
            'id' => 'venta-' . $p['id'],
            'fecha' => str_replace(' ', 'T', $p['fecha_pedido']),
            'cliente' => ['nombre' => $p['cliente_nombre'], 'correo' => $p['cliente_correo']],
            'items' => $items,
            'total' => (float) $p['total'],
            'direccion' => $p['direccion_envio'],
            'ciudad' => $p['ciudad'],
            'telefono' => $p['telefono_contacto'],
            'metodoPago' => $p['metodo_pago'],
            'notas' => $p['notas'],
        ];
    }

    sf_responder(true, ['ventas' => $ventas]);

} elseif ($metodo === 'POST') {

    $datos = sf_leer_body();
    $cliente = $datos['cliente'] ?? [];
    $items = $datos['items'] ?? [];
    $correo = strtolower(trim($cliente['correo'] ?? ''));
    $direccion = trim($datos['direccion'] ?? '');
    $ciudad = trim($datos['ciudad'] ?? '');
    $telefonoContacto = trim($datos['telefono'] ?? '');
    $metodoPago = trim($datos['metodoPago'] ?? '');
    $notas = trim($datos['notas'] ?? '');

    if ($correo === '' || empty($items)) {
        sf_responder(false, [], 'Faltan datos de la venta.', 422);
    }

    // El administrador (admin@gmail.com) no existe como fila de usuario
    // normal; si compra alguna vez, se asocia al usuario cliente demo.
    $stmtUsuario = $pdo->prepare('SELECT * FROM usuarios WHERE email = :email');
    $stmtUsuario->execute(['email' => $correo]);
    $filaUsuario = $stmtUsuario->fetch();
    $usuarioId = $filaUsuario ? $filaUsuario['id'] : false;

    // Una cuenta deshabilitada por el administrador no puede comprar.
    if ($filaUsuario && isset($filaUsuario['activo']) && (int) $filaUsuario['activo'] === 0) {
        sf_responder(false, ['cuenta_deshabilitada' => true],
            'Tu cuenta está deshabilitada y no puede realizar pedidos. Contáctanos para reactivarla.', 401);
    }

    if (!$usuarioId) {
        // Cliente que compró habiendo iniciado sesión, pero cuya cuenta
        // no está en esta base de datos (por ejemplo, se registró offline
        // y aún no se sincronizó). Se crea una cuenta mínima para poder
        // registrar el pedido sin perder la venta.
        $stmt = $pdo->prepare('INSERT INTO usuarios (rol, nombre, email, password) VALUES ("Cliente", :nombre, :email, :password)');
        $stmt->execute([
            'nombre' => $cliente['nombre'] ?? 'Cliente',
            'email' => $correo,
            'password' => password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT),
        ]);
        $usuarioId = $pdo->lastInsertId();
    }

    try {
        $pdo->beginTransaction();

        // Verificar stock de cada línea antes de descontar nada
        $stmtStock = $pdo->prepare('SELECT stock, nombre FROM productos WHERE id = :id FOR UPDATE');
        $faltantes = [];
        foreach ($items as $item) {
            $stmtStock->execute(['id' => $item['id']]);
            $prod = $stmtStock->fetch();
            if (!$prod || $prod['stock'] < (int) $item['cantidad']) {
                $faltantes[] = ($prod['nombre'] ?? $item['nombre']) . ' (disponibles: ' . ($prod['stock'] ?? 0) . ')';
            }
        }

        if (!empty($faltantes)) {
            $pdo->rollBack();
            sf_responder(false, ['faltantes' => $faltantes], 'No hay stock suficiente.', 409);
        }

        $total = 0;
        foreach ($items as $item) {
            $total += (float) $item['precio'] * (int) $item['cantidad'];
        }

        $stmtPedido = $pdo->prepare('INSERT INTO pedidos (usuario_id, total, estado, direccion_envio, ciudad, telefono_contacto, metodo_pago, notas)
                                      VALUES (:usuario_id, :total, "pagado", :direccion, :ciudad, :telefono, :metodo_pago, :notas)');
        $stmtPedido->execute([
            'usuario_id' => $usuarioId,
            'total' => $total,
            'direccion' => $direccion,
            'ciudad' => $ciudad,
            'telefono' => $telefonoContacto,
            'metodo_pago' => $metodoPago,
            'notas' => $notas,
        ]);
        $pedidoId = $pdo->lastInsertId();

        $stmtDetalle = $pdo->prepare('INSERT INTO detalle_pedidos (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario)
                                       VALUES (:pedido_id, :producto_id, :nombre, :cantidad, :precio)');
        $stmtDescontar = $pdo->prepare('UPDATE productos SET stock = stock - :cantidad WHERE id = :id');

        foreach ($items as $item) {
            $stmtDetalle->execute([
                'pedido_id' => $pedidoId,
                'producto_id' => $item['id'],
                'nombre' => $item['nombre'],
                'cantidad' => (int) $item['cantidad'],
                'precio' => (float) $item['precio'],
            ]);
            $stmtDescontar->execute(['cantidad' => (int) $item['cantidad'], 'id' => $item['id']]);
        }

        $pdo->commit();

        sf_responder(true, ['venta' => [
            'id' => 'venta-' . $pedidoId,
            'fecha' => date('c'),
            'cliente' => $cliente,
            'items' => $items,
            'total' => $total,
            'direccion' => $direccion,
            'ciudad' => $ciudad,
            'telefono' => $telefonoContacto,
            'metodoPago' => $metodoPago,
            'notas' => $notas,
        ]], 'Venta registrada.');

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sf_responder(false, [], 'No se pudo registrar la venta.', 500);
    }

} else {
    sf_responder(false, [], 'Método no permitido.', 405);
}
