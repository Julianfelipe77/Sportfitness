<?php
/**
 * SPORT+FITNESS - Conexión a la base de datos
 * ============================================
 * Ajusta estos 4 datos según tu servidor (XAMPP/WAMP/Laragon
 * usan por defecto host=localhost, usuario=root, password="").
 */

define('SF_DB_HOST', 'localhost');
define('SF_DB_NAME', 'sportfitness_db');
define('SF_DB_USER', 'root');
define('SF_DB_PASS', '');

/**
 * Envío de correo (recuperación de contraseña) por Gmail SMTP.
 * ------------------------------------------------------------
 * 1) Usa una cuenta de Gmail (puede ser una nueva, "no-reply").
 * 2) Activa la verificación en 2 pasos en esa cuenta:
 *    https://myaccount.google.com/security
 * 3) Genera una "contraseña de aplicación" (16 caracteres):
 *    https://myaccount.google.com/apppasswords
 *    (NO uses la contraseña normal de Gmail, no funciona con SMTP).
 * 4) Pega ese correo y esa contraseña de aplicación aquí abajo.
 */
define('SF_SMTP_HOST', 'smtp.gmail.com');
define('SF_SMTP_PORT', 587);
define('SF_SMTP_USUARIO', 'tu-correo@gmail.com');       // <-- cambia esto
define('SF_SMTP_CLAVE', 'xxxx xxxx xxxx xxxx');          // <-- contraseña de aplicación (16 caracteres)
define('SF_SMTP_DESDE_NOMBRE', 'Sport+Fitness');

// Ponlo en true temporalmente si un correo no llega y quieres ver
// la conversación completa con el servidor SMTP en api/logs/correo.log.
// Vuelve a ponerlo en false cuando termines de probar.
define('SF_SMTP_DEBUG', false);

// URL base pública del sitio, para armar el enlace del correo.
// Ajusta si tu carpeta o dominio es distinto (sin barra final).
define('SF_URL_BASE', 'http://localhost/sportfitness');

// Cuánto tiempo (en minutos) es válido el enlace de recuperación.
define('SF_TOKEN_MINUTOS_VALIDEZ', 60);

// Debe coincidir con SF_ADMIN_CORREO en js/script.js.
define('SF_ADMIN_CORREO_FIJO', 'admin@gmail.com');

// Contraseña del administrador fijo. Debe coincidir con SF_ADMIN_PASSWORD
// en js/script.js. El servidor la necesita para abrir la sesión de
// administrador que protege api/clientes.php (datos de clientes).
define('SF_ADMIN_PASSWORD_FIJA', 'admin272');

// Cabeceras comunes para todas las respuestas de la API.
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * Devuelve una respuesta JSON estándar y termina la ejecución.
 * El front-end (js/api.js) siempre espera un campo "ok".
 */
function sf_responder($ok, $datos = [], $mensaje = '', $codigoHttp = 200) {
    http_response_code($codigoHttp);
    echo json_encode(array_merge(
        ['ok' => $ok, 'mensaje' => $mensaje],
        $datos
    ), JSON_UNESCAPED_UNICODE);
    exit;
}

/** Lee y decodifica el body JSON de la petición. */
function sf_leer_body() {
    $body = file_get_contents('php://input');
    $datos = json_decode($body, true);
    return is_array($datos) ? $datos : [];
}

/**
 * Envía un correo usando PHPMailer + Gmail SMTP.
 * Devuelve true si se envió, false si algo falló (sin cortar la
 * ejecución: quien llama decide qué responder al front-end).
 *
 * Requiere PHPMailer instalado. La forma más simple:
 *   1) Instala Composer: https://getcomposer.org/download/
 *   2) Desde la carpeta sportfitness/, ejecuta:
 *        composer require phpmailer/phpmailer
 *   Eso crea la carpeta vendor/ con todo lo necesario.
 *
 * Para depurar: revisa api/logs/correo.log después de intentar
 * "Olvidé mi contraseña". Ahí queda registrado, en español y sin
 * tener que buscar en los logs de Apache/PHP, si el correo se
 * envió o por qué falló (credenciales, PHPMailer no instalado,
 * bloqueo del servidor SMTP, etc). Pon SF_SMTP_DEBUG en true (más
 * abajo en este archivo) para que además quede la conversación
 * completa con el servidor SMTP.
 */
function sf_registrar_correo($linea) {
    $carpeta = __DIR__ . '/logs';
    if (!is_dir($carpeta)) {
        @mkdir($carpeta, 0777, true);
    }
    $archivo = $carpeta . '/correo.log';
    $marca = date('Y-m-d H:i:s');
    @file_put_contents($archivo, "[$marca] $linea\n", FILE_APPEND);
}

function sf_enviar_correo($destinoCorreo, $destinoNombre, $asunto, $htmlCuerpo) {
    $autoload = __DIR__ . '/../vendor/autoload.php';

    if (!file_exists($autoload)) {
        $msg = 'Falta vendor/autoload.php. Ejecuta "composer require phpmailer/phpmailer" en la carpeta del proyecto (sportfitness/).';
        error_log('SPORT+FITNESS: ' . $msg);
        sf_registrar_correo('ERROR: ' . $msg);
        return false;
    }

    require_once $autoload;

    if (!class_exists('PHPMailer\\PHPMailer\\PHPMailer')) {
        $msg = 'PHPMailer no está instalado (composer require phpmailer/phpmailer).';
        error_log('SPORT+FITNESS: ' . $msg);
        sf_registrar_correo('ERROR: ' . $msg);
        return false;
    }

    if (SF_SMTP_USUARIO === 'tu-correo@gmail.com' || SF_SMTP_CLAVE === 'xxxx xxxx xxxx xxxx') {
        $msg = 'Todavía tienes los datos de ejemplo en api/config.php (SF_SMTP_USUARIO / SF_SMTP_CLAVE). Pon tu correo real y tu contraseña de aplicación de Gmail.';
        error_log('SPORT+FITNESS: ' . $msg);
        sf_registrar_correo('ERROR: ' . $msg);
        return false;
    }

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $debug = '';

    try {
        $mail->isSMTP();
        $mail->Host = SF_SMTP_HOST;
        $mail->SMTPAuth = true;
        $mail->Username = SF_SMTP_USUARIO;
        $mail->Password = SF_SMTP_CLAVE;
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = SF_SMTP_PORT;
        $mail->CharSet = 'UTF-8';

        if (defined('SF_SMTP_DEBUG') && SF_SMTP_DEBUG) {
            $mail->SMTPDebug = 2; // conversación completa con el servidor SMTP
            $mail->Debugoutput = function ($str) use (&$debug) {
                $debug .= $str . "\n";
            };
        }

        $mail->setFrom(SF_SMTP_USUARIO, SF_SMTP_DESDE_NOMBRE);
        $mail->addAddress($destinoCorreo, $destinoNombre);

        $mail->isHTML(true);
        $mail->Subject = $asunto;
        $mail->Body = $htmlCuerpo;
        $mail->AltBody = strip_tags($htmlCuerpo);

        $mail->send();
        sf_registrar_correo("OK: correo enviado a $destinoCorreo" . ($debug ? "\n--- Detalle SMTP ---\n$debug" : ''));
        return true;
    } catch (Exception $e) {
        error_log('SPORT+FITNESS: error enviando correo - ' . $mail->ErrorInfo);
        sf_registrar_correo("ERROR enviando a $destinoCorreo: " . $mail->ErrorInfo . ($debug ? "\n--- Detalle SMTP ---\n$debug" : ''));
        return false;
    }
}

/**
 * Sesión de administrador (del lado del servidor)
 * ------------------------------------------------
 * El panel admin decide en el navegador quién es administrador, pero
 * eso NO protege la API: cualquiera podría llamar a api/clientes.php
 * directamente. Por eso los endpoints que exponen o modifican datos de
 * clientes exigen esta sesión PHP, que solo se abre con las credenciales
 * del administrador (auth.php, acciones "admin_login" o "login" de un
 * usuario con rol Admin).
 */
function sf_sesion_php() {
    if (session_status() === PHP_SESSION_NONE) {
        session_name('SFSESSID');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function sf_marcar_admin($correo) {
    sf_sesion_php();
    session_regenerate_id(true);
    $_SESSION['sf_admin'] = true;
    $_SESSION['sf_admin_correo'] = $correo;
    session_write_close();
}

function sf_cerrar_sesion_php() {
    sf_sesion_php();
    $_SESSION = [];
    session_destroy();
}

/** Corta con 401 si no hay una sesión de administrador válida. */
function sf_requerir_admin() {
    sf_sesion_php();
    $esAdmin = !empty($_SESSION['sf_admin']);
    session_write_close();

    if (!$esAdmin) {
        sf_responder(false, ['no_autorizado' => true],
            'Sesión de administrador no válida. Cierra sesión y vuelve a entrar como administrador.', 401);
    }

    // Defensa extra contra peticiones de otros sitios (CSRF): las
    // operaciones que modifican datos deben venir como JSON.
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        $tipo = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($tipo, 'application/json') === false) {
            sf_responder(false, [], 'Tipo de contenido no permitido.', 422);
        }
    }
}

/**
 * Conexión PDO reutilizable. Si la base de datos no está disponible
 * (servidor apagado, credenciales erróneas, etc.) respondemos con
 * ok:false en vez de un error fatal de PHP: así el front-end sabe
 * que debe pasar a modo offline con localStorage, igual que si no
 * hubiera conexión a internet.
 */
function sf_conectar() {
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    try {
        $pdo = new PDO(
            'mysql:host=' . SF_DB_HOST . ';dbname=' . SF_DB_NAME . ';charset=utf8mb4',
            SF_DB_USER,
            SF_DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
        return $pdo;
    } catch (PDOException $e) {
        sf_responder(false, [], 'No se pudo conectar a la base de datos.', 503);
    }
}
