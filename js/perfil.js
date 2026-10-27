// ===================================
// SPORT+FITNESS - Editar mi perfil
// ===================================
// Permite a un usuario con sesión iniciada actualizar su nombre,
// correo, teléfono y contraseña. Sigue el mismo patrón que
// auth.js: primero intenta guardar contra el servidor PHP y, si no
// hay conexión, actualiza la copia local en localStorage.
// ===================================

document.addEventListener("DOMContentLoaded", () => {

    const sesion = sfObtenerSesion();
    const params = new URLSearchParams(window.location.search);

    // Sin sesión iniciada: no hay nada que editar, se envía a login
    // y se recuerda volver aquí después de iniciar sesión.
    if (!sesion) {
        window.location.href = "login.html?redirect=perfil.html";
        return;
    }

    const form = document.getElementById("form-perfil");
    const avisoAdminFijo = document.getElementById("aviso-admin-fijo");

    const campoNombre = document.getElementById("perfil-nombre");
    const campoCorreo = document.getElementById("perfil-correo");
    const campoTelefono = document.getElementById("perfil-telefono");

    // Rellena el formulario con los datos actuales de la sesión.
    campoNombre.value = sesion.nombre || "";
    campoCorreo.value = sesion.correo || "";
    campoTelefono.value = sesion.telefono || "";

    // La cuenta fija de administrador (definida en el propio código,
    // ver SF_ADMIN_CORREO en js/script.js) no vive en la base de
    // datos, así que no se puede editar desde aquí.
    if (sesion.correo === SF_ADMIN_CORREO) {
        form.classList.add("d-none");
        avisoAdminFijo.classList.remove("d-none");
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = campoNombre.value.trim();
        const correo = campoCorreo.value.trim().toLowerCase();
        const telefono = campoTelefono.value.trim();
        const passwordActual = document.getElementById("perfil-password-actual").value;
        const passwordNueva = document.getElementById("perfil-password-nueva").value;
        const passwordNueva2 = document.getElementById("perfil-password-nueva2").value;
        const botonEl = form.querySelector('button[type="submit"]');

        function mostrarError(mensaje) {
            sfToast("aviso", mensaje, "", { duracion: 4500 });
        }

        function mostrarExito() {
            sfAlerta("exito", "¡Perfil actualizado!", "Tus datos se guardaron correctamente.",
                { icono: "fa-user-check", timer: 2200, mostrarBoton: false });
        }

        if (nombre.length < 2) {
            mostrarError("Escribe tu nombre completo.");
            return;
        }

        if (!/^[0-9]{7,15}$/.test(telefono)) {
            mostrarError("Escribe un teléfono válido (solo números, 7 a 15 dígitos).");
            return;
        }

        if (!passwordActual) {
            mostrarError("Escribe tu contraseña actual para confirmar los cambios.");
            return;
        }

        if (passwordNueva && passwordNueva.length < 6) {
            mostrarError("La nueva contraseña debe tener al menos 6 caracteres.");
            return;
        }

        if (passwordNueva !== passwordNueva2) {
            mostrarError("Las contraseñas nuevas no coinciden.");
            return;
        }

        if (botonEl) botonEl.disabled = true;

        // 1) Se intenta guardar contra el servidor PHP.
        const respuesta = await sfApiPost("auth.php", {
            accion: "actualizar",
            correo_actual: sesion.correo,
            password_actual: passwordActual,
            nombre,
            correo,
            telefono,
            password_nueva: passwordNueva
        });

        if (botonEl) botonEl.disabled = false;

        if (respuesta && respuesta.ok) {
            sfMigrarClaveCarrito(sesion.correo, respuesta.usuario.correo);
            sfIniciarSesion(respuesta.usuario);
            sfSincronizarUsuarioLocal(sesion.correo, respuesta.usuario, passwordNueva);
            sfActualizarNavbarUsuario();
            document.getElementById("perfil-password-actual").value = "";
            document.getElementById("perfil-password-nueva").value = "";
            document.getElementById("perfil-password-nueva2").value = "";
            mostrarExito();
            return;
        }

        if (respuesta && respuesta.ok === false) {
            sfAlerta("error", "No se pudieron guardar los cambios", sfEsc(respuesta.mensaje || "Inténtalo de nuevo."));
            return;
        }

        // 2) Sin conexión al servidor: se actualiza la copia local,
        // igual que hace auth.js al registrar/iniciar sesión sin
        // servidor disponible.
        const usuarios = sfObtenerUsuarios();
        const indice = usuarios.findIndex((u) => u.correo === sesion.correo);

        // La cuenta vive solo en el servidor y no hay conexión para
        // verificar la contraseña actual: no se puede confirmar el cambio.
        if (indice === -1) {
            sfAlerta("error", "Sin conexión con el servidor", "No pudimos guardar los cambios. Intenta de nuevo más tarde.", { icono: "fa-plug-circle-xmark" });
            return;
        }

        if (usuarios[indice].password !== passwordActual) {
            sfAlerta("error", "Contraseña incorrecta", "La contraseña actual no coincide.", { icono: "fa-lock" });
            return;
        }

        if (usuarios.some((u, i) => i !== indice && u.correo === correo)) {
            mostrarError("Ya existe otra cuenta registrada con ese correo.");
            return;
        }

        usuarios[indice] = {
            ...usuarios[indice],
            nombre,
            correo,
            telefono,
            password: passwordNueva || usuarios[indice].password
        };
        sfGuardarUsuarios(usuarios);

        sfMigrarClaveCarrito(sesion.correo, correo);
        sfIniciarSesion({ nombre, correo, telefono, rol: sesion.rol || "cliente" });
        sfActualizarNavbarUsuario();
        document.getElementById("perfil-password-actual").value = "";
        document.getElementById("perfil-password-nueva").value = "";
        document.getElementById("perfil-password-nueva2").value = "";
        mostrarExito();
    });
});

// Mantiene la copia local (sf_usuarios) al día cuando el guardado
// se hizo contra el servidor, para que el modo sin conexión siga
// funcionando después con los datos más recientes.
function sfSincronizarUsuarioLocal(correoAnterior, usuarioNuevo, passwordNueva) {
    const usuarios = sfObtenerUsuarios();
    const indice = usuarios.findIndex((u) => u.correo === correoAnterior);

    if (indice === -1) return;

    usuarios[indice] = {
        ...usuarios[indice],
        nombre: usuarioNuevo.nombre,
        correo: usuarioNuevo.correo,
        telefono: usuarioNuevo.telefono,
        password: passwordNueva || usuarios[indice].password
    };
    sfGuardarUsuarios(usuarios);
}
