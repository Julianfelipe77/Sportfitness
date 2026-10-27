// ===================================
// SPORT+FITNESS
// Script Principal
// ===================================

// Menú lateral (off-canvas)
const menuBtn = document.getElementById("menu-btn");
const menu = document.querySelector(".menu-lateral");
const menuOverlay = document.getElementById("menu-overlay");

function abrirMenu() {
    menu.classList.add("mostrar-menu");
    if (menuOverlay) menuOverlay.classList.add("mostrar-menu");
}

function cerrarMenu() {
    menu.classList.remove("mostrar-menu");
    if (menuOverlay) menuOverlay.classList.remove("mostrar-menu");
}

if (menuBtn && menu) {
    menuBtn.addEventListener("click", () => {
        menu.classList.contains("mostrar-menu") ? cerrarMenu() : abrirMenu();
    });

    if (menuOverlay) {
        menuOverlay.addEventListener("click", cerrarMenu);
    }

    menu.querySelectorAll("a").forEach((enlace) => {
        enlace.addEventListener("click", cerrarMenu);
    });
}

// Carrusel automático
const carousel = document.querySelector('#banner');

if (carousel) {
    new bootstrap.Carousel(carousel, {
        interval: 3000,
        ride: 'carousel',
        pause: false
    });
}

// ======================================================
// CARRITO DE COMPRAS (persistente con localStorage)
// ======================================================
// El carrito ahora se guarda en localStorage para que:
//  - se pueda agregar más de un producto
//  - los productos persistan al cambiar de página
//  - se pueda eliminar y cambiar cantidades desde carrito.html
// ======================================================

// Número de WhatsApp de la tienda (con indicativo de país, sin "+" ni espacios).
// Todos los pedidos y mensajes de contacto se envían aquí.
const SF_WHATSAPP_NUMERO = "573205991285";

// ======================================================
// REDES SOCIALES OFICIALES
// ======================================================
// Un solo lugar para las URLs de las redes de la tienda: todos los
// íconos del sitio (menú, pie de página) tienen data-red="..." y
// aquí se les asigna el enlace real. Para cambiarlas, edita solo
// estas 4 líneas.
// ======================================================
const SF_REDES_SOCIALES = {
    facebook: "https://www.facebook.com/PON_AQUI_TU_PAGINA_OFICIAL",
    instagram: "https://www.instagram.com/PON_AQUI_TU_CUENTA_OFICIAL",
    twitter: "https://twitter.com/PON_AQUI_TU_CUENTA_OFICIAL",
    whatsapp: "https://wa.me/573205991285"
};

function sfAplicarRedesSociales() {
    document.querySelectorAll("[data-red]").forEach((enlace) => {
        const url = SF_REDES_SOCIALES[enlace.dataset.red];
        if (url) enlace.href = url;
    });
}

// ------------------------------------------------------------------
// El carrito ya NO se guarda en una sola llave compartida: cada
// visitante sin sesión tiene su propio carrito "de invitado", y cada
// cuenta tiene el suyo propio. Así, si agregas productos sin haber
// iniciado sesión y luego inicias sesión (o creas una cuenta), ves
// los productos guardados de ESA cuenta, no los que agregaste estando
// afuera. El carrito de una cuenta además se sincroniza con el
// servidor (tabla `carritos`) para que aparezca igual sin importar
// desde qué navegador o dispositivo se inicie sesión.
// ------------------------------------------------------------------

const SF_CARRITO_INVITADO_KEY = "sf_carrito_invitado";

function sfClaveCarritoCuenta(correo) {
    return "sf_carrito_cuenta_" + encodeURIComponent(String(correo || "").toLowerCase());
}

function sfClaveCarritoActual() {
    const sesion = sfObtenerSesion();
    return sesion && sesion.correo ? sfClaveCarritoCuenta(sesion.correo) : SF_CARRITO_INVITADO_KEY;
}

function sfObtenerCarrito() {
    try {
        return JSON.parse(localStorage.getItem(sfClaveCarritoActual())) || [];
    } catch (e) {
        return [];
    }
}

function sfGuardarCarrito(carrito) {
    localStorage.setItem(sfClaveCarritoActual(), JSON.stringify(carrito));
    sfActualizarBadge();
    sfSincronizarCarritoConServidor(carrito);
}

// Guarda en segundo plano el carrito de la cuenta con sesión iniciada
// en el servidor (tabla `carritos`). Es "best effort": si no hay
// servidor o falla, no pasa nada — la copia en localStorage sigue
// siendo la fuente de verdad para esta sesión de navegador.
function sfSincronizarCarritoConServidor(carrito) {
    const sesion = sfObtenerSesion();
    if (!sesion || !sesion.correo) return; // el carrito de invitado no se guarda en el servidor

    sfApiPost("carrito.php", {
        correo: sesion.correo,
        items: carrito.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            precio: p.precio,
            imagen: p.imagen,
            cantidad: p.cantidad
        }))
    });
}

// Si una cuenta cambia de correo (ver js/perfil.js), el carrito
// guardado localmente para ese correo se traslada a la nueva llave,
// para no perderlo de vista en lo que resta de esta sesión de
// navegador (el servidor ya lo asocia por el id de usuario, no por
// el correo, así que ahí no hay nada que migrar).
function sfMigrarClaveCarrito(correoAnterior, correoNuevo) {
    if (!correoAnterior || !correoNuevo || correoAnterior === correoNuevo) return;
    const claveAnterior = sfClaveCarritoCuenta(correoAnterior);
    const datos = localStorage.getItem(claveAnterior);
    if (datos !== null) {
        localStorage.setItem(sfClaveCarritoCuenta(correoNuevo), datos);
        localStorage.removeItem(claveAnterior);
    }
}

// Se llama justo después de iniciar sesión o de registrarse (ver
// js/auth.js): descarta el carrito de invitado, que ya no aplica, y
// trae el carrito guardado de la cuenta desde el servidor. Si no hay
// servidor disponible, se conserva lo que ya hubiera localmente
// guardado para esa cuenta de una sesión anterior en este navegador
// (o un carrito vacío, si es la primera vez).
async function sfCargarCarritoDeCuenta(correo) {
    localStorage.removeItem(SF_CARRITO_INVITADO_KEY);
    if (!correo) return;

    const respuesta = await sfApiGet("carrito.php?correo=" + encodeURIComponent(correo));
    if (respuesta && respuesta.ok) {
        localStorage.setItem(sfClaveCarritoCuenta(correo), JSON.stringify(respuesta.carrito || []));
    }

    sfActualizarBadge();
}

function sfAgregarProducto(producto) {
    const carrito = sfObtenerCarrito();
    const existente = carrito.find((p) => p.id === producto.id);

    if (existente) {
        existente.cantidad += 1;
    } else {
        carrito.push({ ...producto, cantidad: 1 });
    }

    sfGuardarCarrito(carrito);
}

function sfEliminarProducto(id) {
    let carrito = sfObtenerCarrito();
    carrito = carrito.filter((p) => p.id !== id);
    sfGuardarCarrito(carrito);
}

function sfCambiarCantidad(id, cantidad) {
    const carrito = sfObtenerCarrito();
    const producto = carrito.find((p) => p.id === id);
    if (producto) {
        producto.cantidad = Math.max(1, parseInt(cantidad, 10) || 1);
        sfGuardarCarrito(carrito);
    }
}

function sfVaciarCarrito() {
    sfGuardarCarrito([]);
}

function sfTotalItems(carrito) {
    return carrito.reduce((total, p) => total + p.cantidad, 0);
}

function sfActualizarBadge() {
    const carrito = sfObtenerCarrito();
    const total = sfTotalItems(carrito);
    document.querySelectorAll(".badge-carrito").forEach((badge) => {
        badge.textContent = total;
    });
}

// Delegación de eventos: funciona con cualquier botón "Agregar al carrito"
// presente en la página (incluyendo los productos nuevos).
document.addEventListener("click", (e) => {
    const boton = e.target.closest(".btn-agregar");
    if (!boton) return;

    const producto = {
        id: boton.dataset.id,
        nombre: boton.dataset.nombre,
        precio: parseFloat(boton.dataset.precio),
        imagen: boton.dataset.imagen
    };

    if (!producto.id) return;

    sfAgregarProducto(producto);

    // Confirmación: aviso corto con el nombre del producto
    if (typeof sfToast === "function") {
        sfToast("exito", "Agregado al carrito", sfEsc(producto.nombre || ""), { icono: "fa-cart-plus", duracion: 2200 });
    }

    // Confirmación visual en el propio botón (sin bloquear con alert)
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-check"></i> Agregado';
    setTimeout(() => {
        boton.innerHTML = textoOriginal;
        boton.disabled = false;
    }, 900);
});

// ======================================================
// SESIÓN DE USUARIO (inicio de sesión / registro)
// ======================================================
// Simulación de autenticación 100% en el navegador (localStorage).
// No hay servidor detrás, así que no reemplaza un sistema de login real,
// pero permite registrar cuentas, iniciar sesión y exigir sesión para
// finalizar la compra.
// ======================================================

const SF_USUARIOS_KEY = "sf_usuarios";
const SF_SESION_KEY = "sf_usuario_actual";

function sfObtenerUsuarios() {
    try {
        return JSON.parse(localStorage.getItem(SF_USUARIOS_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function sfGuardarUsuarios(usuarios) {
    localStorage.setItem(SF_USUARIOS_KEY, JSON.stringify(usuarios));
}

function sfObtenerSesion() {
    try {
        return JSON.parse(localStorage.getItem(SF_SESION_KEY));
    } catch (e) {
        return null;
    }
}

function sfIniciarSesion(usuario) {
    localStorage.setItem(SF_SESION_KEY, JSON.stringify(usuario));
}

function sfCerrarSesion() {
    localStorage.removeItem(SF_SESION_KEY);

    // Cierra también la sesión de administrador del servidor (si había una).
    try {
        if (typeof SF_API_BASE !== "undefined" && navigator.sendBeacon) {
            navigator.sendBeacon(
                SF_API_BASE + "auth.php",
                new Blob([JSON.stringify({ accion: "logout" })], { type: "application/json" })
            );
        }
    } catch (e) { /* no pasa nada si falla */ }

    window.location.href = "index.html";
}

function sfActualizarNavbarUsuario() {
    const usuario = sfObtenerSesion();

    document.querySelectorAll(".nav-usuario").forEach((el) => {
        if (usuario) {
            const enlaceAdmin = sfEsAdmin(usuario)
                ? `<li><a class="dropdown-item" href="admin.html"><i class="fa-solid fa-gauge me-2 text-success"></i>Panel de administrador</a></li>
                   <li><hr class="dropdown-divider"></li>`
                : "";

            el.innerHTML = `
                <a href="#" class="text-white dropdown-toggle" data-bs-toggle="dropdown" title="Mi cuenta">
                    <i class="fa-solid fa-circle-user fa-2x"></i>
                </a>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><span class="dropdown-item-text">Hola, ${usuario.nombre}</span></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="perfil.html"><i class="fa-solid fa-user-pen me-2 text-muted"></i>Mi perfil</a></li>
                    ${enlaceAdmin}
                    <li><a class="dropdown-item" href="#" id="btn-cerrar-sesion">Cerrar sesión</a></li>
                </ul>
            `;
            const btnSalir = el.querySelector("#btn-cerrar-sesion");
            if (btnSalir) {
                btnSalir.addEventListener("click", (e) => {
                    e.preventDefault();
                    sfCerrarSesion();
                });
            }
        } else {
            el.innerHTML = `
                <a href="login.html" class="text-white" title="Iniciar sesión">
                    <i class="fa-solid fa-circle-user fa-2x"></i>
                </a>
            `;
        }
    });

    sfActualizarMenuLateralCuenta(usuario);
}

// El menú lateral (off-canvas) tiene un hueco <div id="menu-lateral-cuenta">
// en vez de un enlace fijo de "Iniciar sesión", para poder mostrar aquí
// mismo "Mi perfil" / "Cerrar sesión" cuando ya hay sesión iniciada.
function sfActualizarMenuLateralCuenta(usuario) {
    const contenedor = document.getElementById("menu-lateral-cuenta");
    if (!contenedor) return;

    usuario = usuario || sfObtenerSesion();

    if (usuario) {
        const enlaceAdmin = sfEsAdmin(usuario)
            ? `<a href="admin.html"><i class="fa-solid fa-gauge text-success"></i>Panel de administrador</a>`
            : "";

        contenedor.innerHTML = `
            <a href="perfil.html"><i class="fa-solid fa-user-pen text-secondary"></i>Mi perfil</a>
            ${enlaceAdmin}
            <a href="#" id="menu-lateral-cerrar-sesion"><i class="fa-solid fa-right-from-bracket text-danger"></i>Cerrar sesión</a>
        `;
        const btnSalir = document.getElementById("menu-lateral-cerrar-sesion");
        if (btnSalir) {
            btnSalir.addEventListener("click", (e) => {
                e.preventDefault();
                sfCerrarSesion();
            });
        }
    } else {
        contenedor.innerHTML = `
            <a href="login.html"><i class="fa-solid fa-circle-user text-secondary"></i>Iniciar sesión / Registrarme</a>
        `;
    }
}

// ======================
// Animación al hacer scroll
// ======================

const elementos = document.querySelectorAll(".producto, .categoria");

function revelarElementos() {

    elementos.forEach((elemento) => {

        let posicion = elemento.getBoundingClientRect().top;

        let pantalla = window.innerHeight;

        if (posicion < pantalla - 100) {

            elemento.style.opacity = "1";
            elemento.style.transform = "translateY(0)";

        }

    });

}

window.addEventListener("scroll", revelarElementos);
window.addEventListener("load", revelarElementos);

// ======================================================
// PANEL DE ADMINISTRADOR
// ======================================================
// Credenciales fijas del administrador. El correo se compara
// siempre en minúsculas (igual que en el login normal).
// ======================================================

const SF_ADMIN_CORREO = "admin@gmail.com";
const SF_ADMIN_PASSWORD = "admin272";

const SF_PRODUCTOS_KEY = "sf_productos";
const SF_VENTAS_KEY = "sf_ventas";
const SF_SEMILLA_KEY = "sf_semilla_v1";

function sfEsAdmin(usuario) {
    return !!usuario && (usuario.rol === "admin" || usuario.correo === SF_ADMIN_CORREO);
}

// ---------- Catálogo de productos ----------
// Estas funciones intentan primero hablar con la API en PHP
// (carpeta /api). Si no hay conexión, el servidor no responde,
// o la página se abre directo desde el disco (file://), se usa
// automáticamente el respaldo en localStorage: la app sigue
// funcionando igual que antes, sin backend.

function sfProductosLocal() {
    try {
        return JSON.parse(localStorage.getItem(SF_PRODUCTOS_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function sfGuardarProductos(productos) {
    localStorage.setItem(SF_PRODUCTOS_KEY, JSON.stringify(productos));
}

async function sfObtenerProductos() {
    const respuesta = await sfApiGet("productos.php");

    if (respuesta && respuesta.ok) {
        sfGuardarProductos(respuesta.productos);
        return respuesta.productos;
    }

    // Modo sin conexión / sin servidor PHP: se usa la copia local.
    sfSembrarDatosAdmin();
    return sfProductosLocal();
}

// Crea un producto nuevo (panel de administrador).
async function sfCrearProducto(producto) {
    const respuesta = await sfApiPost("productos.php", producto);

    if (respuesta && respuesta.ok) {
        return respuesta.producto;
    }

    // Sin conexión: se guarda localmente con un id generado igual
    // que antes, para no perder el cambio mientras se recupera el servidor.
    const productos = sfProductosLocal();
    const prefijo = producto.categoria.toLowerCase().slice(0, 3);
    const nuevoProducto = { ...producto, id: prefijo + "-" + Date.now() };
    productos.push(nuevoProducto);
    sfGuardarProductos(productos);
    return nuevoProducto;
}

// Actualiza (nombre/categoría/precio/stock) un producto existente.
async function sfActualizarProducto(id, cambios) {
    const respuesta = await sfApiPut("productos.php", { id, ...cambios });

    if (!respuesta || !respuesta.ok) {
        const productos = sfProductosLocal();
        const producto = productos.find((p) => p.id === id);
        if (producto) {
            Object.assign(producto, cambios);
            sfGuardarProductos(productos);
        }
    }
}

// Elimina un producto del catálogo.
async function sfEliminarProductoCatalogo(id) {
    const respuesta = await sfApiDelete("productos.php?id=" + encodeURIComponent(id));

    if (!respuesta || !respuesta.ok) {
        let productos = sfProductosLocal();
        productos = productos.filter((p) => p.id !== id);
        sfGuardarProductos(productos);
    }
}

// ---------- Ventas ----------

function sfVentasLocal() {
    try {
        return JSON.parse(localStorage.getItem(SF_VENTAS_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function sfGuardarVentas(ventas) {
    localStorage.setItem(SF_VENTAS_KEY, JSON.stringify(ventas));
}

async function sfObtenerVentas() {
    const respuesta = await sfApiGet("ventas.php");

    if (respuesta && respuesta.ok) {
        sfGuardarVentas(respuesta.ventas);
        return respuesta.ventas;
    }

    sfSembrarDatosAdmin();
    return sfVentasLocal();
}

// Registra una venta nueva (desde el carrito). Intenta guardarla en el
// servidor (que además descuenta el stock de forma segura); si no hay
// conexión, hace exactamente lo mismo que la versión 100% local: guarda
// la venta y descuenta el stock en localStorage.
async function sfRegistrarVenta(venta) {
    const respuesta = await sfApiPost("ventas.php", venta);

    if (respuesta && respuesta.ok) {
        return { ok: true, venta: respuesta.venta };
    }

    if (respuesta && respuesta.cuenta_deshabilitada) {
        // El administrador deshabilitó esta cuenta: no se guarda nada local.
        return { ok: false, cuentaDeshabilitada: true, mensaje: respuesta.mensaje };
    }

    if (respuesta && respuesta.mensaje && respuesta.faltantes) {
        // El servidor respondió pero no había stock suficiente.
        return { ok: false, faltantes: respuesta.faltantes };
    }

    // Sin conexión: mismo comportamiento que la versión original.
    const ventas = sfVentasLocal();
    ventas.push(venta);
    sfGuardarVentas(ventas);

    const productos = sfProductosLocal();
    venta.items.forEach((item) => {
        const prod = productos.find((p) => p.id === item.id);
        if (prod) {
            prod.stock = Math.max(0, prod.stock - item.cantidad);
        }
    });
    sfGuardarProductos(productos);

    return { ok: true, venta };
}

// Revisa si hay stock suficiente para cada línea del carrito.
// Devuelve un arreglo con los nombres de los productos sin stock suficiente.
async function sfVerificarStockCarrito(carrito) {
    const productos = await sfObtenerProductos();
    const faltantes = [];

    carrito.forEach((item) => {
        const prod = productos.find((p) => p.id === item.id);
        if (!prod) {
            faltantes.push(`${item.nombre} (ya no está disponible)`);
        } else if (prod.stock < item.cantidad) {
            faltantes.push(`${item.nombre} (disponibles: ${prod.stock})`);
        }
    });

    return faltantes;
}

// ---------- Semilla de datos de demostración ----------
// La tienda no tiene backend, así que la primera vez que se
// carga el sitio se crea un catálogo inicial (a partir de los
// productos ya existentes en hombre.html / mujer.html /
// suplementos.html) y un historial de ventas simulado de los
// últimos 45 días, para que el panel de administrador tenga
// datos reales que mostrar desde el primer momento.

function sfCatalogoInicial() {
    const hombre = [
        ["hombre-1", "Camiseta Nike Pro", 129900, 24],
        ["hombre-2", "Pantalón Deportivo", 149900, 15],
        ["hombre-3", "Tenis Running", 289900, 0],
        ["hombre-4", "Gorra Deportiva", 59900, 40],
        ["hombre-5", "Chaqueta Cortavientos", 179900, 8],
        ["hombre-6", "Short Deportivo", 79900, 30],
        ["hombre-7", "Medias Deportivas x3", 39900, 50],
        ["hombre-8", "Sudadera con Capota", 159900, 0],
        ["hombre-9", "Guantes de Entrenamiento", 39900, 18],
        ["hombre-10", "Camiseta de Compresión", 99900, 22],
        ["hombre-11", "Chaqueta Impermeable", 199900, 5],
        ["hombre-12", "Cinturón de Levantamiento", 119900, 12],
    ].map((p) => ({ id: p[0], nombre: p[1], categoria: "Hombre", precio: p[2], stock: p[3], imagen: "img/gorra.webp" }));

    const mujer = [
        ["mujer-1", "Top Deportivo", 89900, 28],
        ["mujer-2", "Licra Fitness", 119900, 20],
        ["mujer-3", "Tenis Running", 269900, 6],
        ["mujer-4", "Buso Deportivo", 139900, 0],
        ["mujer-5", "Chaqueta Deportiva", 169900, 10],
        ["mujer-6", "Short Fitness", 89900, 25],
        ["mujer-7", "Diadema para Cabello", 19900, 45],
        ["mujer-8", "Chaleco Deportivo", 129900, 14],
        ["mujer-9", "Guantes de Entrenamiento", 39900, 16],
        ["mujer-10", "Camiseta Deportiva", 79900, 19],
        ["mujer-11", "Chaqueta Impermeable", 189900, 0],
        ["mujer-12", "Banda de Resistencia x3", 49900, 60],
    ].map((p) => ({ id: p[0], nombre: p[1], categoria: "Mujer", precio: p[2], stock: p[3], imagen: "img/mmm.webp" }));

    const suplementos = [
        ["sup-1", "Proteína Whey Gold", 239900, 20],
        ["sup-2", "Creatina Monohidratada", 109900, 35],
        ["sup-3", "Pre Entreno", 149900, 0],
        ["sup-4", "Vitaminas Deportivas", 79900, 25],
        ["sup-5", "BCAA en Polvo", 99900, 18],
        ["sup-6", "Barras de Proteína x12", 89900, 0],
        ["sup-7", "Omega 3", 69900, 22],
        ["sup-8", "Shaker Sport+Fitness", 29900, 50],
        ["sup-9", "Multivitamínico", 69900, 30],
        ["sup-10", "Glutamina", 89900, 12],
        ["sup-11", "Quemador de Grasa", 129900, 8],
        ["sup-12", "Colágeno Hidrolizado", 99900, 16],
    ].map((p) => ({ id: p[0], nombre: p[1], categoria: "Suplementos", precio: p[2], stock: p[3], imagen: "img/ChatGPT Image 27 jul 2026, 18_21_29.png" }));

    return [...hombre, ...mujer, ...suplementos];
}

function sfGenerarVentasDemo(productos) {
    // Productos con más peso para que existan "más vendidos" claros
    const populares = ["sup-1", "hombre-1", "mujer-2", "sup-2", "mujer-3", "hombre-6", "sup-8"];
    const bolsa = [...productos.map((p) => p.id), ...populares, ...populares];

    const nombres = ["Camila Torres", "Andrés Gómez", "Laura Ramírez", "Juan Pérez", "María Rojas", "Carlos Díaz", "Valentina Ruiz"];
    const ventas = [];
    const hoy = new Date();

    for (let diasAtras = 44; diasAtras >= 0; diasAtras--) {
        const fechaBase = new Date(hoy);
        fechaBase.setDate(hoy.getDate() - diasAtras);

        const numVentasDelDia = Math.floor(Math.random() * 4); // 0 a 3 ventas por día

        for (let v = 0; v < numVentasDelDia; v++) {
            const numItems = 1 + Math.floor(Math.random() * 2);
            const items = [];
            let total = 0;

            for (let i = 0; i < numItems; i++) {
                const id = bolsa[Math.floor(Math.random() * bolsa.length)];
                const prod = productos.find((p) => p.id === id);
                if (!prod) continue;

                const cantidad = 1 + Math.floor(Math.random() * 2);
                items.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad });
                total += prod.precio * cantidad;
            }

            if (items.length === 0) continue;

            const fecha = new Date(fechaBase);
            fecha.setHours(9 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60));

            ventas.push({
                id: "venta-" + fecha.getTime() + "-" + v,
                fecha: fecha.toISOString(),
                cliente: { nombre: nombres[Math.floor(Math.random() * nombres.length)], correo: "cliente@demo.com" },
                items,
                total
            });
        }
    }

    return ventas;
}

function sfSembrarDatosAdmin() {
    if (localStorage.getItem(SF_SEMILLA_KEY)) return;

    if (!localStorage.getItem(SF_PRODUCTOS_KEY)) {
        sfGuardarProductos(sfCatalogoInicial());
    }

    if (!localStorage.getItem(SF_VENTAS_KEY)) {
        sfGuardarVentas(sfGenerarVentasDemo(sfProductosLocal()));
    }

    localStorage.setItem(SF_SEMILLA_KEY, "1");
}

// ======================================================
// SINCRONIZACIÓN DE CATÁLOGO EN LAS PÁGINAS DE PRODUCTOS
// ======================================================
// Las páginas hombre.html / mujer.html / suplementos.html / index.html
// muestran los productos "a mano" en el HTML, pero el precio y el
// stock reales viven en la base de datos (o en localStorage sin
// servidor). Esta función revisa cada botón "Agregar al carrito" de
// la página, lo compara contra el catálogo real y:
//   - actualiza el precio mostrado si el administrador lo cambió
//   - deshabilita el botón y marca "Agotado" si no queda stock
//   - avisa "¡Últimas unidades!" si queda poco stock
// Así, todo lo que el administrador cambia desde el panel (panel
// admin -> BD) se refleja solo, sin tener que editar el HTML.
function sfSincronizarCatalogoEnPagina() {
    document.addEventListener("DOMContentLoaded", async () => {
        const botones = document.querySelectorAll(".btn-agregar[data-id]");
        if (botones.length === 0) return;

        const productos = await sfObtenerProductos();

        botones.forEach((boton) => {
            const producto = productos.find((p) => p.id === boton.dataset.id);
            if (!producto) return; // producto "especial" (ej. destacados manuales) sin match: se deja igual

            const tarjeta = boton.closest(".card") || boton.closest(".producto");
            const elPrecio = tarjeta ? tarjeta.querySelector(".text-success.fs-4, h4.text-success") : null;

            // Sincroniza el precio mostrado con el precio real del catálogo
            boton.dataset.precio = producto.precio;
            if (elPrecio) {
                elPrecio.textContent = formatoCOPGlobal(producto.precio);
            }

            // Quita avisos de stock previos (si se vuelve a sincronizar)
            const avisoPrevio = tarjeta ? tarjeta.querySelector(".sf-aviso-stock") : null;
            if (avisoPrevio) avisoPrevio.remove();

            if (producto.stock <= 0) {
                boton.disabled = true;
                boton.classList.remove("btn-success");
                boton.classList.add("btn-secondary");
                boton.innerHTML = '<i class="fa-solid fa-ban"></i> Agotado';
            } else if (producto.stock <= 5 && tarjeta) {
                const aviso = document.createElement("p");
                aviso.className = "sf-aviso-stock text-danger small fw-bold mb-2";
                aviso.textContent = `¡Últimas ${producto.stock} unidades!`;
                boton.insertAdjacentElement("beforebegin", aviso);
            }
        });
    });
}

function formatoCOPGlobal(valor) {
    return "$" + Math.round(valor).toLocaleString("es-CO");
}

sfSincronizarCatalogoEnPagina();

// ======================
// Inicialización común a todas las páginas
// ======================
document.addEventListener("DOMContentLoaded", () => {
    sfActualizarBadge();
    sfActualizarNavbarUsuario();
    sfAplicarRedesSociales();
});
