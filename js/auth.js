// ===================================
// SPORT+FITNESS - Login y Registro
// ===================================
// Autenticación simulada en el navegador con localStorage.
// No sustituye un backend real, pero permite crear cuentas,
// iniciar sesión y mantener la sesión activa entre páginas.
// ===================================

// Muestra el mensaje de error de login con un enlace directo a
// "recuperar.html" resaltado, para que sea obvio qué hacer si el
// usuario puso mal la contraseña o no la recuerda.
function sfMostrarErrorLogin() {
    sfAlerta("error", "Correo o contraseña incorrectos",
        "Revisa tus datos e inténtalo de nuevo. Si no recuerdas tu contraseña, puedes recuperarla.",
        { icono: "fa-lock", boton: "Reintentar", extra: { texto: "¿Olvidaste tu contraseña?", href: "recuperar.html" } });
}

// Bienvenida breve antes de redirigir (se cierra sola)
function sfBienvenida(titulo, texto, destino) {
    return sfAlerta("exito", titulo, texto, { timer: 1700, mostrarBoton: false, icono: "fa-hands-clapping", cerrarFuera: false })
        .then(() => { window.location.href = destino; });
}

// Validaciones de formulario: aviso corto, no bloquea
function sfErrorForm(mensaje) {
    sfToast("aviso", mensaje);
}

function sfSinServidor(texto) {
    sfAlerta("error", "No pudimos conectar con el servidor", texto, { icono: "fa-plug-circle-xmark" });
}

document.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || "index.html";

    // Si ya hay sesión iniciada, no tiene sentido mostrar el formulario
    const sesionActual = sfObtenerSesion();
    const avisoSesion = document.getElementById("aviso-sesion-activa");
    if (sesionActual && avisoSesion) {
        avisoSesion.classList.remove("d-none");
        avisoSesion.querySelector(".nombre-usuario").textContent = sesionActual.nombre;
    }

    // ---------- LOGIN ----------
    const formLogin = document.getElementById("form-login");

    if (formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();

            const correo = document.getElementById("login-correo").value.trim().toLowerCase();
            const password = document.getElementById("login-password").value;
            const botonEl = formLogin.querySelector('button[type="submit"]');

            // Acceso del administrador: entra directo al panel, sin
            // necesidad de estar en la lista de usuarios registrados,
            // e incluso sin conexión al servidor.
            if (correo === SF_ADMIN_CORREO && password === SF_ADMIN_PASSWORD) {
                sfIniciarSesion({ nombre: "Administrador", correo: SF_ADMIN_CORREO, rol: "admin" });
                // Abre además la sesión de servidor que protege la gestión de
                // clientes (api/clientes.php). Si no hay servidor, se ignora.
                await sfApiPost("auth.php", { accion: "admin_login", correo, password });
                await sfCargarCarritoDeCuenta(SF_ADMIN_CORREO);
                await sfBienvenida("Panel de administración", "Sesión iniciada como administrador.", "admin.html");
                return;
            }
            if (botonEl) botonEl.disabled = true;

            // 1) Se intenta iniciar sesión contra el servidor PHP.
            const respuesta = await sfApiPost("auth.php", { accion: "login", correo, password });

            if (botonEl) botonEl.disabled = false;

            if (respuesta && respuesta.ok) {
                sfIniciarSesion(respuesta.usuario);
                await sfCargarCarritoDeCuenta(respuesta.usuario.correo);
                await sfBienvenida(`¡Hola de nuevo, ${sfEsc(respuesta.usuario.nombre)}!`, "Ya puedes seguir comprando.", redirect);
                return;
            }

            if (respuesta && respuesta.ok === false && respuesta.cuenta_deshabilitada) {
                sfAlerta("aviso", "Cuenta deshabilitada",
                    sfEsc(respuesta.mensaje || "Tu cuenta está deshabilitada.") + "<br>Si crees que es un error, escríbenos desde Contacto.",
                    { icono: "fa-user-lock", extra: { texto: "Ir a Contacto", href: "contacto.html" } });
                return;
            }

            if (respuesta && respuesta.ok === false) {
                // El servidor respondió, pero el correo/contraseña no son válidos.
                sfMostrarErrorLogin();
                return;
            }

            // 2) Sin conexión al servidor: se revisa la copia local de
            // usuarios (cuentas creadas mientras no había servidor).
            const usuarios = sfObtenerUsuarios();
            const usuario = usuarios.find((u) => u.correo === correo && u.password === password);

            if (!usuario) {
                sfMostrarErrorLogin();
                return;
            }

            sfIniciarSesion({ nombre: usuario.nombre, correo: usuario.correo, telefono: usuario.telefono, rol: "cliente" });
            await sfCargarCarritoDeCuenta(usuario.correo);
            await sfBienvenida(`¡Hola de nuevo, ${sfEsc(usuario.nombre)}!`, "Ya puedes seguir comprando.", redirect);
        });
    }

    // ---------- REGISTRO ----------
    const formRegistro = document.getElementById("form-registro");

    if (formRegistro) {
        formRegistro.addEventListener("submit", async (e) => {
            e.preventDefault();

            const nombre = document.getElementById("registro-nombre").value.trim();
            const correo = document.getElementById("registro-correo").value.trim().toLowerCase();
            const telefono = document.getElementById("registro-telefono").value.trim();
            const password = document.getElementById("registro-password").value;
            const password2 = document.getElementById("registro-password2").value;
            const botonEl = formRegistro.querySelector('button[type="submit"]');

            if (nombre.length < 2) {
                sfErrorForm("Escribe tu nombre completo.");
                return;
            }

            if (!/^[0-9]{7,15}$/.test(telefono)) {
                sfErrorForm("Escribe un teléfono válido (solo números, 7 a 15 dígitos).");
                return;
            }

            if (password !== password2) {
                sfErrorForm("Las contraseñas no coinciden.");
                return;
            }

            if (password.length < 6) {
                sfErrorForm("La contraseña debe tener al menos 6 caracteres.");
                return;
            }

            if (correo === SF_ADMIN_CORREO) {
                sfErrorForm("Este correo está reservado para el administrador. Inicia sesión con tus credenciales de administrador.");
                return;
            }

            if (botonEl) botonEl.disabled = true;

            // 1) Se intenta crear la cuenta en el servidor PHP.
            const respuesta = await sfApiPost("auth.php", { accion: "registro", nombre, correo, telefono, password });

            if (botonEl) botonEl.disabled = false;

            if (respuesta && respuesta.ok) {
                sfIniciarSesion(respuesta.usuario);
                await sfCargarCarritoDeCuenta(respuesta.usuario.correo);
                await sfBienvenida(`¡Bienvenido, ${sfEsc(respuesta.usuario.nombre)}!`, "Tu cuenta fue creada con éxito.", redirect);
                return;
            }

            if (respuesta && respuesta.ok === false) {
                // El servidor respondió: probablemente el correo ya existe.
                sfAlerta("error", "No se pudo crear la cuenta", sfEsc(respuesta.mensaje || "Inténtalo de nuevo."), { icono: "fa-user-xmark" });
                return;
            }

            // 2) Sin conexión al servidor: se guarda localmente, igual
            // que en la versión sin backend, y se sigue funcionando.
            const usuarios = sfObtenerUsuarios();

            if (usuarios.some((u) => u.correo === correo)) {
                sfAlerta("error", "Ese correo ya está registrado", "Inicia sesión o usa otro correo.", { icono: "fa-user-xmark", extra: { texto: "Iniciar sesión", href: "login.html" } });
                return;
            }

            usuarios.push({ nombre, correo, telefono, password });
            sfGuardarUsuarios(usuarios);
            sfIniciarSesion({ nombre, correo, telefono, rol: "cliente" });
            await sfCargarCarritoDeCuenta(correo);
            await sfBienvenida(`¡Bienvenido, ${sfEsc(nombre)}!`, "Tu cuenta fue creada con éxito.", redirect);
        });
    }

    // ---------- RECUPERAR CONTRASEÑA (paso 1: pedir el enlace) ----------
    const formRecuperar = document.getElementById("form-recuperar");

    if (formRecuperar) {
        formRecuperar.addEventListener("submit", async (e) => {
            e.preventDefault();

            const correo = document.getElementById("recuperar-correo").value.trim().toLowerCase();
            const botonEl = formRecuperar.querySelector('button[type="submit"]');

            if (botonEl) botonEl.disabled = true;

            const respuesta = await sfApiPost("auth.php", { accion: "recuperar_solicitar", correo });

            if (botonEl) botonEl.disabled = false;

            if (respuesta && respuesta.ok) {
                formRecuperar.reset();
                sfAlerta("exito", "Revisa tu correo", sfEsc(respuesta.mensaje || "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña."),
                    { icono: "fa-envelope-circle-check", boton: "Listo" });
                return;
            }

            if (respuesta && respuesta.ok === false) {
                sfAlerta("error", "No se pudo procesar la solicitud", sfEsc(respuesta.mensaje || "Inténtalo de nuevo."));
                return;
            }

            // Sin conexión al servidor: no se puede enviar correo real.
            sfSinServidor("No fue posible conectar con el servidor. Verifica que la tienda esté corriendo con Apache/MySQL (no abierta con doble clic) e inténtalo de nuevo.");
        });
    }

    // ---------- RECUPERAR CONTRASEÑA (paso 2: guardar la nueva) ----------
    const formRestablecer = document.getElementById("form-restablecer");

    if (formRestablecer) {
        const token = params.get("token") || "";

        if (!token) {
            formRestablecer.classList.add("d-none");
            sfAlerta("aviso", "Enlace no válido", "Solicita uno nuevo desde \"¿Olvidaste tu contraseña?\".",
                { icono: "fa-link-slash", boton: "Pedir uno nuevo", cerrarFuera: false })
                .then(() => { window.location.href = "recuperar.html"; });
        }

        formRestablecer.addEventListener("submit", async (e) => {
            e.preventDefault();

            const password = document.getElementById("restablecer-password").value;
            const password2 = document.getElementById("restablecer-password2").value;
            const botonEl = formRestablecer.querySelector('button[type="submit"]');

            if (password.length < 6) {
                sfErrorForm("La contraseña debe tener al menos 6 caracteres.");
                return;
            }

            if (password !== password2) {
                sfErrorForm("Las contraseñas no coinciden.");
                return;
            }

            if (botonEl) botonEl.disabled = true;

            const respuesta = await sfApiPost("auth.php", { accion: "recuperar_confirmar", token, password });

            if (botonEl) botonEl.disabled = false;

            if (respuesta && respuesta.ok) {
                formRestablecer.reset();
                formRestablecer.classList.add("d-none");
                sfAlerta("exito", "¡Contraseña actualizada!", sfEsc(respuesta.mensaje || "Ya puedes iniciar sesión con tu nueva contraseña."),
                    { icono: "fa-key", boton: "Iniciar sesión", cerrarFuera: false })
                    .then(() => { window.location.href = "login.html"; });
                return;
            }

            if (respuesta && respuesta.ok === false) {
                sfAlerta("error", "Enlace no válido", sfEsc(respuesta.mensaje || "El enlace no es válido o ya venció."),
                    { icono: "fa-link-slash", boton: "Pedir uno nuevo", cerrarFuera: false })
                    .then(() => { window.location.href = "recuperar.html"; });
                return;
            }

            sfSinServidor("No fue posible conectar con el servidor. Verifica que la tienda esté corriendo con Apache/MySQL e inténtalo de nuevo.");
        });
    }
});
