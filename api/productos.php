<?php
/**
 * SPORT+FITNESS - API de productos
 * GET    api/productos.php              -> lista todo el catálogo
 * GET    api/productos.php?categoria=X   -> filtra por categoría
 * POST   api/productos.php               -> crea un producto (admin)
 * PUT    api/productos.php               -> actualiza un producto (admin)
 * DELETE api/productos.php?id=X          -> elimina un producto (admin)
 */

require_once __DIR__ . '/config.php';

$pdo = sf_conectar();
$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {

    case 'GET':
        $sql = 'SELECT p.id, p.nombre, c.nombre AS categoria, p.precio, p.stock, p.imagen
                FROM productos p
                JOIN categorias c ON c.id = p.categoria_id';
        $params = [];

        if (!empty($_GET['categoria'])) {
            $sql .= ' WHERE c.nombre = :categoria';
            $params['categoria'] = $_GET['categoria'];
        }

        $sql .= ' ORDER BY p.nombre';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $productos = $stmt->fetchAll();

        // precio/stock como número, no como string
        foreach ($productos as &$p) {
            $p['precio'] = (float) $p['precio'];
            $p['stock'] = (int) $p['stock'];
        }

        sf_responder(true, ['productos' => $productos]);
        break;

    case 'POST':
        $datos = sf_leer_body();
        $nombre = trim($datos['nombre'] ?? '');
        $categoria = trim($datos['categoria'] ?? '');
        $precio = isset($datos['precio']) ? (float) $datos['precio'] : null;
        $stock = isset($datos['stock']) ? (int) $datos['stock'] : 0;
        $imagen = trim($datos['imagen'] ?? 'img/default.jpg');

        if ($nombre === '' || $categoria === '' || $precio === null) {
            sf_responder(false, [], 'Faltan datos del producto.', 422);
        }

        $stmtCat = $pdo->prepare('SELECT id FROM categorias WHERE nombre = :nombre');
        $stmtCat->execute(['nombre' => $categoria]);
        $categoriaId = $stmtCat->fetchColumn();

        if (!$categoriaId) {
            sf_responder(false, [], 'La categoría no existe.', 422);
        }

        // ID legible, igual al que ya generaba el front-end en localStorage
        $prefijo = strtolower(substr($categoria, 0, 3));
        $id = $prefijo . '-' . time() . '-' . random_int(100, 999);

        $stmt = $pdo->prepare('INSERT INTO productos (id, categoria_id, nombre, precio, stock, imagen)
                                VALUES (:id, :categoria_id, :nombre, :precio, :stock, :imagen)');
        $stmt->execute([
            'id' => $id,
            'categoria_id' => $categoriaId,
            'nombre' => $nombre,
            'precio' => $precio,
            'stock' => $stock,
            'imagen' => $imagen,
        ]);

        sf_responder(true, ['producto' => [
            'id' => $id, 'nombre' => $nombre, 'categoria' => $categoria,
            'precio' => $precio, 'stock' => $stock, 'imagen' => $imagen,
        ]], 'Producto creado.');
        break;

    case 'PUT':
        $datos = sf_leer_body();
        $id = $datos['id'] ?? '';

        if ($id === '') {
            sf_responder(false, [], 'Falta el id del producto.', 422);
        }

        $campos = [];
        $params = ['id' => $id];

        if (isset($datos['nombre'])) {
            $campos[] = 'nombre = :nombre';
            $params['nombre'] = trim($datos['nombre']);
        }
        if (isset($datos['precio'])) {
            $campos[] = 'precio = :precio';
            $params['precio'] = (float) $datos['precio'];
        }
        if (isset($datos['stock'])) {
            $campos[] = 'stock = :stock';
            $params['stock'] = max(0, (int) $datos['stock']);
        }
        if (isset($datos['categoria'])) {
            $stmtCat = $pdo->prepare('SELECT id FROM categorias WHERE nombre = :nombre');
            $stmtCat->execute(['nombre' => $datos['categoria']]);
            $categoriaId = $stmtCat->fetchColumn();
            if ($categoriaId) {
                $campos[] = 'categoria_id = :categoria_id';
                $params['categoria_id'] = $categoriaId;
            }
        }

        if (empty($campos)) {
            sf_responder(false, [], 'Nada que actualizar.', 422);
        }

        $sql = 'UPDATE productos SET ' . implode(', ', $campos) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        sf_responder(true, [], 'Producto actualizado.');
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? '';

        if ($id === '') {
            sf_responder(false, [], 'Falta el id del producto.', 422);
        }

        $stmt = $pdo->prepare('DELETE FROM productos WHERE id = :id');
        $stmt->execute(['id' => $id]);

        sf_responder(true, [], 'Producto eliminado.');
        break;

    default:
        sf_responder(false, [], 'Método no permitido.', 405);
}
