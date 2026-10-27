<?php
/**
 * SPORT+FITNESS - API de autenticación
 * POST api/auth.php  { accion: "login",    correo, password }
 * POST api/auth.php  { accion: "registro", nombre, correo, password }
 * POST api/auth.php  { accion: "admin_login", correo, password }  -> sesión de servidor del admin
 * POST api/auth.php  { accion: "logout" }
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sf_responder(false, [], 'Método no permitido.', 405);
}

$pdo = sf_conectar();
$datos = sf_leer_body();
$accion = $datos['accion'] ?? '';

if ($accion === 'login') {

    $correo = strtolower(trim($datos['correo'] ?? ''));
    $password = $datos['password'] ?? '';

    // SELECT * para no fallar si aún no se corrió la migración de "activo".
    $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE email = :email');
    $stmt->execute(['email' => $correo]);
    $usuario = $stmt->fetch();

    if (!$usuario || !password_verify($password, $usuario['password'])) {
        sf_responder(false, [], 'Correo o contraseña incorrectos.', 401);
    }

    // Cuenta deshabilitada por el administrador (se avisa solo si la
    // contraseña era correcta, para no revelar qué cuentas existen).
    if (isset($usuario['activo']) && (int) $usuario['activo'] === 0) {
        sf_responder(false, ['cuenta_deshabilitada' => true],
            'Tu cuenta está deshabilitada. Escríbenos por WhatsApp o desde Contacto para reactivarla.', 401);
    }

    if ($usuario['rol'] === 'Admin') {
        sf_marcar_admin($usuario['email']);
    }

    sf_responder(true, ['usuario' => [
        'nombre' => $usuario['nombre'],
        'correo' => $usuario['email'],
        'telefono' => $usuario['telefono'],
        'rol' => $usuario['rol'] === 'Admin' ? 'admin' : 'cliente',
    ]]);

} elseif ($accion === 'admin_login') {

    // Abre la sesión de servidor del administrador (necesaria para
    // api/clientes.php). El front la llama justo después del login del
    // administrador fijo, que se valida en el navegador.
    $correo = strtolower(trim($datos['correo'] ?? ''));
    $password = (string) ($datos['password'] ?? '');

    if ($correo === SF_ADMIN_CORREO_FIJO && hash_equals(SF_ADMIN_PASSWORD_FIJA, $password)) {
        sf_marcar_admin($correo);
        sf_responder(true, [], 'Sesión de administrador iniciada.');
    }

    $stmt = $pdo->prepare('SELECT email, password FROM usuarios WHERE email = :email AND rol = "Admin"');
    $stmt->execute(['email' => $correo]);
    $admin = $stmt->fetch();

    if ($admin && password_verify($password, $admin['password'])) {
        sf_marcar_admin($admin['email']);
        sf_responder(true, [], 'Sesión de administrador iniciada.');
    }

    usleep(500000); // frena intentos repetidos
    sf_responder(false, [], 'Credenciales de administrador incorrectas.', 401);

} elseif ($accion === 'logout') {

    sf_cerrar_sesion_php();
    sf_responder(true, [], 'Sesión cerrada.');

} elseif ($accion === 'registro') {

    $nombre = trim($datos['nombre'] ?? '');
    $correo = strtolower(trim($datos['correo'] ?? ''));
    $telefono = trim($datos['telefono'] ?? '');
    $password = $datos['password'] ?? '';

    if (strlen($nombre) < 2 || strlen($password) < 6 || $correo === '') {
        sf_responder(false, [], 'Datos de registro inválidos.', 422);
    }

    if (!preg_match('/^[0-9]{7,15}$/', $telefono)) {
        sf_responder(false, [], 'El teléfono debe tener entre 7 y 15 dígitos numéricos.', 422);
    }

    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email = :email');
    $stmt->execute(['email' => $correo]);
    if ($stmt->fetch()) {
        sf_responder(false, [], 'Ya existe una cuenta registrada con ese correo.', 409);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO usuarios (rol, nombre, email, password, telefono) VALUES ("Cliente", :nombre, :email, :password, :telefono)');
    $stmt->execute(['nombre' => $nombre, 'email' => $correo, 'password' => $hash, 'telefono' => $telefono]);

    sf_responder(true, ['usuario' => [
        'nombre' => $nombre,
        'correo' => $correo,
        'telefono' => $telefono,
        'rol' => 'cliente',
    ]], 'Cuenta creada.');

} elseif ($accion === 'actualizar') {

    // Actualiza nombre, correo, teléfono y (opcionalmente) contraseña
    // de una cuenta ya existente. Por seguridad, siempre exige la
    // contraseña actual para confirmar que quien edita es el dueño
    // de la cuenta.

    $correoActual = strtolower(trim($datos['correo_actual'] ?? ''));
    $passwordActual = $datos['password_actual'] ?? '';
    $nombre = trim($datos['nombre'] ?? '');
    $correoNuevo = strtolower(trim($datos['correo'] ?? ''));
    $telefono = trim($datos['telefono'] ?? '');
    $passwordNueva = $datos['password_nueva'] ?? '';

    if (strlen($nombre) < 2 || $correoNuevo === '') {
        sf_responder(false, [], 'Escribe un nombre y un correo válidos.', 422);
    }

    if (!preg_match('/^[0-9]{7,15}$/', $telefono)) {
        sf_responder(false, [], 'El teléfono debe tener entre 7 y 15 dígitos numéricos.', 422);
    }

    if ($passwordNueva !== '' && strlen($passwordNueva) < 6) {
        sf_responder(false, [], 'La nueva contraseña debe tener al menos 6 caracteres.', 422);
    }

    $stmt = $pdo->prepare('SELECT id, rol, password FROM usuarios WHERE email = :email');
    $stmt->execute(['email' => $correoActual]);
    $usuario = $stmt->fetch();

    if (!$usuario || !password_verify($passwordActual, $usuario['password'])) {
        sf_responder(false, [], 'La contraseña actual no es correcta.', 401);
    }

    if ($correoNuevo !== $correoActual) {
        $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email = :email AND id != :id');
        $stmt->execute(['email' => $correoNuevo, 'id' => $usuario['id']]);
        if ($stmt->fetch()) {
            sf_responder(false, [], 'Ya existe otra cuenta registrada con ese correo.', 409);
        }
    }

    if ($passwordNueva !== '') {
        $hash = password_hash($passwordNueva, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('UPDATE usuarios SET nombre = :nombre, email = :email, telefono = :telefono, password = :password WHERE id = :id');
        $stmt->execute(['nombre' => $nombre, 'email' => $correoNuevo, 'telefono' => $telefono, 'password' => $hash, 'id' => $usuario['id']]);
    } else {
        $stmt = $pdo->prepare('UPDATE usuarios SET nombre = :nombre, email = :email, telefono = :telefono WHERE id = :id');
        $stmt->execute(['nombre' => $nombre, 'email' => $correoNuevo, 'telefono' => $telefono, 'id' => $usuario['id']]);
    }

    sf_responder(true, ['usuario' => [
        'nombre' => $nombre,
        'correo' => $correoNuevo,
        'telefono' => $telefono,
        'rol' => $usuario['rol'] === 'Admin' ? 'admin' : 'cliente',
    ]], 'Datos actualizados correctamente.');

} elseif ($accion === 'recuperar_solicitar') {

    // Paso 1 de "Olvidé mi contraseña": el usuario escribe su correo.
    // Se consulta en la BD y, si existe, se genera un enlace único
    // (token) con vencimiento y se envía por correo electrónico.
    //
    // Por seguridad, la respuesta es la misma exista o no la cuenta
    // (así nadie puede usar este formulario para adivinar qué
    // correos están registrados).

    $correo = strtolower(trim($datos['correo'] ?? ''));
    $mensajeGenerico = 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.';

    if ($correo === '') {
        sf_responder(false, [], 'Escribe tu correo electrónico.', 422);
    }

    if ($correo === SF_ADMIN_CORREO_FIJO) {
        // El admin fijo no tiene fila en la BD ni contraseña recuperable por correo.
        sf_responder(true, [], $mensajeGenerico);
    }

    $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE email = :email');
    $stmt->execute(['email' => $correo]);
    $usuario = $stmt->fetch();

    // A una cuenta deshabilitada no se le envía enlace (la respuesta
    // sigue siendo la misma de siempre).
    if ($usuario && (int) ($usuario['activo'] ?? 1) === 1) {
        $tokenPlano = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $tokenPlano);
        $expira = date('Y-m-d H:i:s', time() + SF_TOKEN_MINUTOS_VALIDEZ * 60);

        try {
            $stmt = $pdo->prepare('UPDATE usuarios SET token_recuperacion = :token, token_expira = :expira WHERE id = :id');
            $stmt->execute(['token' => $tokenHash, 'expira' => $expira, 'id' => $usuario['id']]);
        } catch (PDOException $e) {
            // Causa más común: falta correr la migración que agrega
            // las columnas token_recuperacion / token_expira.
            if (stripos($e->getMessage(), 'token_recuperacion') !== false || stripos($e->getMessage(), 'Unknown column') !== false) {
                sf_responder(false, [], 'Falta preparar la base de datos: ejecuta BD/migracion_recuperacion_password.sql (o vuelve a importar BD/spotfitness_db.sql si es una instalación nueva) y vuelve a intentar.', 422);
            }
            sf_responder(false, [], 'No se pudo generar el enlace de recuperación. Inténtalo de nuevo.', 422);
        }

        $enlace = SF_URL_BASE . '/restablecer.html?token=' . $tokenPlano;

        $html = '<p>Hola ' . htmlspecialchars($usuario['nombre']) . ',</p>'
              . '<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Sport+Fitness</strong>.</p>'
              . '<p><a href="' . $enlace . '" style="background:#198754;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Restablecer contraseña</a></p>'
              . '<p>O copia y pega este enlace en tu navegador:<br>' . $enlace . '</p>'
              . '<p>Este enlace vence en ' . SF_TOKEN_MINUTOS_VALIDEZ . ' minutos. Si tú no pediste esto, ignora el correo.</p>';

        sf_enviar_correo($usuario['email'], $usuario['nombre'], 'Restablece tu contraseña - Sport+Fitness', $html);
    }

    // Se responde igual haya existido o no la cuenta.
    sf_responder(true, [], $mensajeGenerico);

} elseif ($accion === 'recuperar_confirmar') {

    // Paso 2: el usuario llega desde el enlace del correo con un
    // token en la URL y escribe su nueva contraseña.

    $tokenPlano = trim($datos['token'] ?? '');
    $passwordNueva = $datos['password'] ?? '';

    if ($tokenPlano === '') {
        sf_responder(false, [], 'Enlace inválido.', 422);
    }

    if (strlen($passwordNueva) < 6) {
        sf_responder(false, [], 'La nueva contraseña debe tener al menos 6 caracteres.', 422);
    }

    $tokenHash = hash('sha256', $tokenPlano);

    try {
        $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE token_recuperacion = :token AND token_expira >= NOW()');
        $stmt->execute(['token' => $tokenHash]);
        $usuario = $stmt->fetch();
    } catch (PDOException $e) {
        if (stripos($e->getMessage(), 'token_recuperacion') !== false || stripos($e->getMessage(), 'Unknown column') !== false) {
            sf_responder(false, [], 'Falta preparar la base de datos: ejecuta BD/migracion_recuperacion_password.sql (o vuelve a importar BD/spotfitness_db.sql si es una instalación nueva) y vuelve a intentar.', 422);
        }
        sf_responder(false, [], 'No se pudo validar el enlace. Inténtalo de nuevo.', 422);
    }

    if (!$usuario) {
        sf_responder(false, [], 'El enlace no es válido o ya venció. Solicita uno nuevo.', 401);
    }

    $hash = password_hash($passwordNueva, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE usuarios SET password = :password, token_recuperacion = NULL, token_expira = NULL WHERE id = :id');
    $stmt->execute(['password' => $hash, 'id' => $usuario['id']]);

    sf_responder(true, [], 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.');

} else {
    sf_responder(false, [], 'Acción no reconocida.', 422);
}
