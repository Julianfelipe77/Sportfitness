<?php
/**
 * SPORT+FITNESS - Prueba de conexión
 * Abre esto en el navegador para confirmar que el enlace con la
 * base de datos quedó bien hecho:
 *   http://localhost/sportfitness/api/estado.php
 */

require_once __DIR__ . '/config.php';

$pdo = sf_conectar(); // si falla, config.php ya responde ok:false y termina aquí

try {
    $productos = (int) $pdo->query('SELECT COUNT(*) FROM productos')->fetchColumn();
    $usuarios = (int) $pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn();
    $ventas = (int) $pdo->query('SELECT COUNT(*) FROM pedidos')->fetchColumn();

    sf_responder(true, [
        'conexion' => 'correcta',
        'base_de_datos' => SF_DB_NAME,
        'productos_en_catalogo' => $productos,
        'usuarios_registrados' => $usuarios,
        'ventas_registradas' => $ventas,
    ], 'La app está enlazada correctamente a la base de datos.');

} catch (PDOException $e) {
    // La conexión abrió pero faltan tablas: seguramente no se importó el .sql
    sf_responder(false, [], 'Conectado al servidor MySQL, pero faltan tablas. ¿Importaste BD/spotfitness_db.sql?', 500);
}
