# Sport+Fitness — versión con backend PHP

## Qué cambió

La tienda seguía funcionando 100% en el navegador (todo en `localStorage`).
Ahora hay un backend real en PHP + MySQL para:

- **Productos**: catálogo, stock, alta/edición/baja desde el panel admin.
- **Usuarios**: registro e inicio de sesión (contraseñas con `password_hash`).
- **Ventas**: se registran en la base de datos y descuentan stock de forma
  segura (transacción con bloqueo de fila, evita vender sin stock).

El carrito de compras de un **visitante sin sesión** se mantiene en
`localStorage` (es normal: es del navegador de cada visitante, no
necesita servidor). Pero el carrito de una **cuenta** ya no se mezcla
con eso: cada cuenta tiene su propio carrito, guardado en la tabla
`carritos`, y se recupera igual sin importar desde qué navegador o
dispositivo se inicie sesión. Ver la sección "Carrito por cuenta" más
abajo.

## La app NO se rompe sin conexión

Se agregó `js/api.js`, una capa intermedia que:

1. Intenta hablar con `/api/*.php`.
2. Si hay respuesta correcta del servidor → usa esos datos y los deja en
   caché en `localStorage`.
3. Si **no hay internet, el servidor PHP está apagado, la base de datos no
   responde, o simplemente abriste el sitio con doble clic (`file://`)** →
   automáticamente usa `localStorage`, exactamente como funcionaba la
   versión original. No hay pantallas de error ni la app se congela.

Esto aplica a: ver el catálogo en el panel admin, iniciar sesión,
registrarse, finalizar una compra y administrar productos/stock.

La única excepción es el administrador fijo (`admin@gmail.com`), que
siempre puede entrar aunque no haya servidor, igual que antes.

## Carrito por cuenta

Antes, el carrito era una sola llave de `localStorage` compartida por
todo el navegador: si agregabas productos sin haber iniciado sesión y
luego entrabas a una cuenta, seguías viendo esos mismos productos, sin
importar si esa cuenta ya tenía guardados otros.

Ahora:

- El carrito de un visitante **sin sesión** vive en su propia llave
  (`sf_carrito_invitado`) y nunca se guarda en el servidor.
- Al iniciar sesión o registrarte, ese carrito de invitado se
  descarta y se carga el carrito guardado **de esa cuenta**
  (`api/carrito.php`, tabla `carritos`). Si es la primera vez que esa
  cuenta inicia sesión, el carrito llega vacío.
- Cada cambio en el carrito (agregar, quitar, cambiar cantidad,
  vaciar) de una cuenta con sesión iniciada se guarda también en el
  servidor en segundo plano, así que el mismo carrito aparece en
  cualquier otro navegador o dispositivo donde se inicie sesión con
  esa cuenta.
- Sin servidor disponible, el carrito de la cuenta sigue funcionando
  con la copia guardada localmente en ese navegador (modo offline),
  igual que el resto de la app.

Si ya tenías la base de datos importada de antes, ejecuta el bloque de
migración que agrega la tabla `carritos` (`BD/spotfitness_db.sql`,
al final del archivo) para tener esta función sin perder tus datos.

## Recuperar contraseña por correo electrónico

Desde `login.html` hay un enlace "¿Olvidaste tu contraseña?" (siempre
visible debajo del formulario, y también se resalta dentro del mensaje
de error cuando el correo/contraseña son incorrectos).

Flujo:

1. `recuperar.html` — el usuario escribe su correo. Se llama a
   `api/auth.php` con `accion: "recuperar_solicitar"`, que consulta
   la tabla `usuarios`. Si el correo existe, genera un token único,
   lo guarda hasheado (`token_recuperacion`, `token_expira`, vence en
   60 minutos) y envía un correo con el enlace de restablecimiento.
   Por seguridad, el mensaje que ve el usuario es el mismo exista o
   no la cuenta (no revela qué correos están registrados).
2. `restablecer.html?token=...` — el usuario llega desde el correo,
   escribe su nueva contraseña y se llama a `accion:
   "recuperar_confirmar"`, que valida el token (y que no haya vencido)
   y actualiza el `password` con `password_hash`.

### Configurar el envío de correo (Gmail SMTP)

El envío usa **PHPMailer** por SMTP (el `mail()` nativo de PHP casi
nunca funciona en XAMPP/WAMP/Laragon sin configurar un servidor de
correo aparte).

1. Instala [Composer](https://getcomposer.org/download/) si no lo
   tienes.
2. Desde la carpeta `sportfitness/`, ejecuta:
   ```
   composer require phpmailer/phpmailer
   ```
   Esto crea la carpeta `vendor/` con la librería.
3. Consigue una cuenta de Gmail para enviar los correos (puede ser una
   nueva, tipo "no-reply"):
   - Activa la verificación en 2 pasos:
     https://myaccount.google.com/security
   - Genera una **contraseña de aplicación** (16 caracteres):
     https://myaccount.google.com/apppasswords
     (no uses tu contraseña normal de Gmail, con SMTP no funciona).
4. Abre `api/config.php` y completa:
   ```php
   define('SF_SMTP_USUARIO', 'tu-correo@gmail.com');
   define('SF_SMTP_CLAVE', 'xxxx xxxx xxxx xxxx'); // la contraseña de aplicación
   ```
5. Revisa `SF_URL_BASE` en el mismo archivo: debe ser la URL pública
   donde sirves el sitio (ej. `http://localhost/sportfitness`), sin
   barra final, para que el enlace del correo apunte bien a
   `restablecer.html`.

Si `vendor/` no está instalado o las credenciales SMTP están mal, la
API no truena: `sf_enviar_correo()` registra el error en el log de PHP
y la solicitud sigue respondiendo con el mensaje genérico de éxito
(por seguridad), pero el correo simplemente no llegará.

### Si el correo "supuestamente se envía" pero nunca llega

Como el mensaje de éxito es siempre el mismo (por seguridad, para no
revelar qué correos existen), si algo falla no te enteras desde el
navegador. Para saber qué pasó realmente:

1. Abre **`api/logs/correo.log`** (se crea solo la primera vez que se
   intenta enviar un correo). Ahí queda anotado, en español, si se
   envió o exactamente por qué falló: PHPMailer no instalado,
   credenciales todavía de ejemplo, error de autenticación SMTP, etc.
2. Causas más comunes:
   - No corriste `composer require phpmailer/phpmailer` (no existe la
     carpeta `vendor/`).
   - Dejaste `SF_SMTP_USUARIO` / `SF_SMTP_CLAVE` con los valores de
     ejemplo en `api/config.php`.
   - Usaste tu contraseña normal de Gmail en vez de una **contraseña
     de aplicación** (con la verificación en 2 pasos activada). Gmail
     rechaza el login normal por SMTP.
   - El correo llegó pero cayó en **Spam/Correo no deseado**: revisa
     esa carpeta la primera vez.
   - El antivirus/firewall de Windows o el ISP bloquean el puerto 587
     saliente.
3. Si el log no aclara el problema, pon `SF_SMTP_DEBUG` en `true` en
   `api/config.php`, vuelve a intentar "Olvidé mi contraseña", y en
   `api/logs/correo.log` quedará la conversación completa con el
   servidor SMTP de Gmail (muestra el motivo exacto del rechazo).
   Vuelve a ponerlo en `false` cuando termines de revisar.

### Migración de base de datos

Si ya tenías la base de datos importada de antes, ejecuta
`BD/migracion_recuperacion_password.sql` para agregar las columnas
`token_recuperacion` y `token_expira` a la tabla `usuarios` sin perder
tus datos. Si es una instalación nueva, ya están incluidas en
`BD/spotfitness_db.sql`.

## Pedidos por WhatsApp

Todos los pedidos (desde el carrito) y los mensajes del formulario de
`contacto.html` se arman automáticamente y se abren en WhatsApp Web /
la app de WhatsApp hacia el número de ventas de la tienda:

**3205991285**

Ese número está centralizado en una sola constante, `SF_WHATSAPP_NUMERO`
(al inicio de `js/script.js`), y desde ahí lo usan `js/carrito.js` y
`js/contacto.js`. Si el número de la tienda cambia, solo hay que
editar esa constante una vez.

El pedido igual queda guardado en la base de datos (tabla `pedidos`,
con dirección, ciudad, teléfono y método de pago) para que el panel
de administrador lleve el control real de ventas e inventario; el
mensaje de WhatsApp es solo el "aviso" para coordinar la entrega.

## Instalación (XAMPP / WAMP / Laragon)

1. Copia toda la carpeta `sportfitness/` dentro de `htdocs` (XAMPP) o
   `www` (WAMP/Laragon).
2. Crea la base de datos importando `BD/spotfitness_db.sql` desde
   phpMyAdmin (o `mysql -u root -p < BD/spotfitness_db.sql`).
   **Si ya tenías la base de datos importada de antes**, no vuelvas a
   importar el archivo completo: solo ejecuta
   `BD/migracion_pedidos_2026-08.sql` para agregar las columnas nuevas
   (`telefono_contacto`, `metodo_pago`, `notas`) a la tabla `pedidos`
   sin perder tus datos actuales.
3. Abre `api/config.php` y ajusta host/usuario/contraseña si tu MySQL no
   usa los valores por defecto (`localhost`, `root`, sin contraseña).
4. Entra a `http://localhost/sportfitness/index.html` (o la ruta donde
   la hayas copiado) con Apache y MySQL corriendo.
5. **Comprueba el enlace**: abre
   `http://localhost/sportfitness/api/estado.php` en el navegador.
   Si ves `"ok":true` y los conteos de productos/usuarios/ventas, la
   base de datos quedó enlazada correctamente.

Si abres los archivos `.html` directamente con doble clic (sin Apache),
la tienda funciona igual gracias al modo offline, solo que no habrá
sincronización con la base de datos hasta que la sirvas por un servidor
PHP.

## Estructura de la API

```
api/config.php     -> conexión PDO + helpers de respuesta JSON
api/productos.php  -> GET / POST / PUT / DELETE
api/auth.php       -> POST { accion: "login" | "registro" | "actualizar" | "recuperar_solicitar" | "recuperar_confirmar" }
api/ventas.php     -> GET (historial) / POST (checkout)
```

## Cuentas de prueba (ya en el .sql)

- Admin fijo (siempre funciona, con o sin servidor):
  `admin@gmail.com` / `admin272`
- Admin en base de datos: `admin@sportfitness.com`
- Cliente demo: `juan.perez@email.com`

(Las contraseñas de los usuarios sembrados en el `.sql` están hasheadas;
para probar el login contra la base de datos, regístrate normalmente
desde `registro.html` y usa esa cuenta nueva.)

## Pendientes

- **Límite de cantidad en el carrito**: resuelto. El input de
  `carrito.html` ahora trae `max="..."` según el stock real del
  producto (consultado a `productos.php`), muestra "Disponibles: N"
  debajo del campo, y si el stock bajó mientras el producto estaba en
  el carrito, la cantidad se ajusta sola al recargar la página. La
  validación al confirmar el pedido se mantiene igual (doble chequeo).
- **Subir foto propia por producto (panel admin)**: sigue pendiente a
  propósito. Hoy la imagen se asigna sola según la categoría. Hacerlo
  bien implica un input de archivo, un endpoint PHP nuevo que reciba y
  guarde el archivo en el servidor, y validar tipo/tamaño — es
  escritura de archivos en el servidor (permisos, seguridad), así que
  no se tocó hasta confirmar que se quiere.
- **Prueba de punta a punta en servidor real**: no se puede levantar
  Apache+MySQL en este entorno. Se verificó sintaxis de todos los
  `.php` (`php -l`) y `.js` (`node --check`) sin errores, pero la
  prueba real del flujo completo (login, checkout, WhatsApp, panel
  admin) en XAMPP/Laragon queda pendiente de tu lado.
- **Pasada de estilo/diseño**: no se tocó (colores, tipografía, textos
  de marketing) — solo funcionalidad. Pendiente si se quiere.

## Gestión de clientes (panel de administrador)

Nueva pestaña **Clientes** en `admin.html` (CRUD completo, en el servidor):

- Lista de clientes con sus datos, nº de pedidos, total comprado, **fecha
  de la última compra y hace cuánto fue**, y su estado: *Activo*,
  *Inactivo* (sin comprar hace X días) o *Deshabilitado*.
- El umbral de inactividad se elige en la propia pestaña (30, 60, 90 días,
  6 meses, 1 año). Si un cliente nunca ha comprado, los días se cuentan
  desde que se registró.
- Ver detalle: datos del cliente y todos sus pedidos con los productos.
- Crear, editar (incluye restablecer contraseña) y eliminar clientes.
  Un cliente **con pedidos no se puede eliminar** (se conserva el
  historial de ventas): se deshabilita.
- **Deshabilitar / habilitar** una cuenta (botón por cliente) y
  **"Deshabilitar inactivos"**: muestra quiénes llevan N días sin comprar,
  puedes desmarcar a quien quieras conservar y confirmar.
- Una cuenta deshabilitada no puede iniciar sesión ni hacer pedidos
  (`auth.php` y `ventas.php` lo validan en el servidor) y no recibe
  correos de recuperación de contraseña. Sus datos y pedidos no se borran.

Archivos: `api/clientes.php` (nuevo), `BD/migracion_clientes_admin.sql`
(nuevo), y cambios en `api/auth.php`, `api/ventas.php`, `api/config.php`,
`admin.html`, `js/admin.js`, `js/auth.js`, `js/script.js`, `js/carrito.js`.

### Para activarlo

1. Si ya tenías la base de datos importada: ejecuta
   `BD/migracion_clientes_admin.sql` (agrega `activo`,
   `fecha_desactivacion` y `motivo_desactivacion` a `usuarios`). En una
   instalación nueva ya viene en `BD/127_0_0_1.sql`.
2. **Cierra sesión y vuelve a entrar como administrador** una vez: al
   iniciar sesión se abre una sesión de servidor que `api/clientes.php`
   exige (sin ella responde 401, para que nadie pueda leer o modificar
   datos de clientes llamando a la API directamente).
3. Esta pestaña necesita servidor + base de datos; no funciona en modo
   offline (`localStorage`).

### Seguridad: pendiente

`api/productos.php` y `api/ventas.php` (GET) siguen sin exigir sesión de
administrador: cualquiera que conozca la URL puede modificar el catálogo o
leer el historial de ventas con nombres, correos y direcciones. Se puede
proteger con el mismo `sf_requerir_admin()`, pero hay que tener en cuenta
que `ventas.php` (POST) y `productos.php` (GET) los usa la tienda pública.
La contraseña del administrador fijo (`admin272`) está en `js/script.js` y
ahora también en `api/config.php`; conviene cambiarla en ambos sitios.
