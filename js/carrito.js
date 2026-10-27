// ===================================
// SPORT+FITNESS - Página del carrito
// ===================================

document.addEventListener("DOMContentLoaded", () => {

    const tbody = document.getElementById("tabla-carrito");
    const contenido = document.getElementById("carrito-contenido");
    const vacio = document.getElementById("carrito-vacio");
    const elSubtotal = document.getElementById("resumen-subtotal");
    const elTotal = document.getElementById("resumen-total");
    const btnFinalizar = document.getElementById("btn-finalizar-compra");
    const btnVaciar = document.getElementById("btn-vaciar-carrito");

    function formatoCOP(valor) {
        return "$" + Math.round(valor).toLocaleString("es-CO");
    }

    // Caché del catálogo (con stock real) para no repetir la consulta
    // en cada cambio de cantidad. Se refresca cada vez que se renderiza.
    let productosCache = [];

    function stockDe(id) {
        const prod = productosCache.find((p) => p.id === id);
        return prod ? prod.stock : null;
    }

    async function renderizar() {
        const carrito = sfObtenerCarrito();
        tbody.innerHTML = "";

        if (carrito.length === 0) {
            contenido.classList.add("d-none");
            vacio.classList.remove("d-none");
            return;
        }

        contenido.classList.remove("d-none");
        vacio.classList.add("d-none");

        productosCache = await sfObtenerProductos();

        // Si el stock real bajó de lo que ya había en el carrito
        // (p. ej. porque otro cliente compró mientras tanto), se ajusta
        // la cantidad automáticamente antes de pintar la tabla.
        let ajustado = false;
        carrito.forEach((producto) => {
            const stock = stockDe(producto.id);
            if (stock !== null && producto.cantidad > stock) {
                producto.cantidad = Math.max(1, stock);
                ajustado = true;
            }
        });
        if (ajustado) sfGuardarCarrito(carrito);

        let subtotal = 0;

        carrito.forEach((producto) => {
            const sub = producto.precio * producto.cantidad;
            subtotal += sub;
            const stock = stockDe(producto.id);
            const atributoMax = stock !== null ? `max="${stock}"` : "";

            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td><img src="${producto.imagen}" width="80" alt="${producto.nombre}"></td>
                <td>${producto.nombre}</td>
                <td>${formatoCOP(producto.precio)}</td>
                <td>
                    <input type="number" class="form-control input-cantidad"
                        data-id="${producto.id}" value="${producto.cantidad}" min="1" ${atributoMax} style="width:90px">
                    ${stock !== null ? `<small class="text-muted d-block">Disponibles: ${stock}</small>` : ""}
                </td>
                <td class="fw-bold">${formatoCOP(sub)}</td>
                <td>
                    <button class="btn btn-danger btn-eliminar" data-id="${producto.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(fila);
        });

        elSubtotal.textContent = formatoCOP(subtotal);
        elTotal.textContent = formatoCOP(subtotal);
    }

    // Eliminar producto
    tbody.addEventListener("click", (e) => {
        const boton = e.target.closest(".btn-eliminar");
        if (!boton) return;
        const fila = boton.closest("tr");
        const nombre = fila ? fila.children[1].textContent : "Producto";
        sfEliminarProducto(boton.dataset.id);
        renderizar();
        sfToast("info", "Producto eliminado", sfEsc(nombre) + " salió de tu carrito.", { icono: "fa-trash-can" });
    });

    // Cambiar cantidad (se limita en vivo contra el stock real vía el
    // atributo max del input, además de la validación que ya existía
    // al confirmar el pedido)
    tbody.addEventListener("change", (e) => {
        if (!e.target.classList.contains("input-cantidad")) return;
        const id = e.target.dataset.id;
        const stock = stockDe(id);
        let valor = parseInt(e.target.value, 10) || 1;
        if (stock !== null && valor > stock) valor = stock;
        if (stock !== null && parseInt(e.target.value, 10) > stock) {
            sfToast("aviso", "Stock limitado", `Solo hay ${stock} unidad(es) disponibles.`);
        }
        sfCambiarCantidad(id, valor);
        renderizar();
    });

    // Vaciar carrito
    if (btnVaciar) {
        btnVaciar.addEventListener("click", async () => {
            if (sfObtenerCarrito().length === 0) return;
            const si = await sfConfirmar({
                tipo: "peligro", icono: "fa-cart-shopping",
                titulo: "¿Vaciar el carrito?",
                texto: "Se quitarán todos los productos que agregaste.",
                confirmar: "Sí, vaciar", cancelar: "Mejor no"
            });
            if (si) {
                sfVaciarCarrito();
                await renderizar();
                sfToast("exito", "Carrito vacío", "Cuando quieras, vuelve a llenarlo.", { icono: "fa-cart-shopping" });
            }
        });
    }

    // Finalizar compra: abre el modal de datos de entrega
    const modalCheckoutEl = document.getElementById("modal-checkout");
    const modalCheckout = modalCheckoutEl ? new bootstrap.Modal(modalCheckoutEl) : null;
    const formCheckout = document.getElementById("form-checkout");
    const btnConfirmarPedido = document.getElementById("btn-confirmar-pedido");

    if (btnFinalizar) {
        btnFinalizar.addEventListener("click", async () => {
            const carrito = sfObtenerCarrito();

            if (carrito.length === 0) {
                sfAlerta("aviso", "Tu carrito está vacío", "Agrega productos antes de finalizar la compra.",
                    { icono: "fa-cart-shopping", boton: "Ver productos" })
                    .then((r) => { if (r.isConfirmed) window.location.href = "index.html"; });
                return;
            }

            const sesion = sfObtenerSesion();

            if (!sesion) {
                const ir = await sfConfirmar({
                    tipo: "pregunta", icono: "fa-user-lock",
                    titulo: "Inicia sesión para comprar",
                    texto: "Necesitamos saber quién eres para registrar tu pedido. Tu carrito se conserva.",
                    confirmar: "Iniciar sesión", cancelar: "Ahora no"
                });
                if (ir) window.location.href = "login.html?redirect=carrito.html";
                return;
            }

            btnFinalizar.disabled = true;
            const faltantes = await sfVerificarStockCarrito(carrito);
            btnFinalizar.disabled = false;

            if (faltantes.length > 0) {
                sfAlerta("aviso", "Stock insuficiente",
                    "Ajusta la cantidad de estos productos:" +
                    `<ul class="sf-lista">${faltantes.map((f) => `<li>${sfEsc(f)}</li>`).join("")}</ul>`,
                    { icono: "fa-boxes-stacked", boton: "Revisar carrito" });
                return;
            }

            // Precarga el teléfono si el usuario ya lo tiene guardado
            const inputTelefono = document.getElementById("checkout-telefono");
            if (inputTelefono && sesion.telefono) inputTelefono.value = sesion.telefono;

            if (modalCheckout) modalCheckout.show();
        });
    }

    // Confirmar pedido: registra la venta y la envía por WhatsApp
    if (formCheckout) {
        formCheckout.addEventListener("submit", async (e) => {
            e.preventDefault();

            const direccion = document.getElementById("checkout-direccion").value.trim();
            const ciudad = document.getElementById("checkout-ciudad").value.trim();
            const telefono = document.getElementById("checkout-telefono").value.trim();
            const metodoPago = document.getElementById("checkout-pago").value;
            const notas = document.getElementById("checkout-notas").value.trim();

            if (!/^[0-9]{7,15}$/.test(telefono)) {
                sfToast("aviso", "Revisa tu teléfono", "Solo números, de 7 a 15 dígitos.", { icono: "fa-phone" });
                return;
            }

            const carrito = sfObtenerCarrito();
            const sesion = sfObtenerSesion();

            // Se revisa el stock una última vez por si cambió mientras se
            // llenaba el formulario.
            const faltantes = await sfVerificarStockCarrito(carrito);
            if (faltantes.length > 0) {
                sfAlerta("aviso", "Stock insuficiente",
                    `<ul class="sf-lista">${faltantes.map((f) => `<li>${sfEsc(f)}</li>`).join("")}</ul>`,
                    { icono: "fa-boxes-stacked" });
                return;
            }

            const total = carrito.reduce((t, p) => t + p.precio * p.cantidad, 0);

            btnConfirmarPedido.disabled = true;
            btnConfirmarPedido.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';

            const resultado = await sfRegistrarVenta({
                id: "venta-" + Date.now(),
                fecha: new Date().toISOString(),
                cliente: { nombre: sesion.nombre, correo: sesion.correo },
                items: carrito.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, cantidad: p.cantidad })),
                total,
                direccion,
                ciudad,
                telefono,
                metodoPago,
                notas
            });

            btnConfirmarPedido.disabled = false;
            btnConfirmarPedido.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar pedido';

            if (!resultado.ok && resultado.cuentaDeshabilitada) {
                sfAlerta("error", "Cuenta deshabilitada", sfEsc(resultado.mensaje || "Tu cuenta está deshabilitada y no puede realizar pedidos."),
                    { icono: "fa-user-lock" });
                return;
            }

            if (!resultado.ok) {
                sfAlerta("aviso", "Stock insuficiente",
                    `<ul class="sf-lista">${(resultado.faltantes || []).map((f) => `<li>${sfEsc(f)}</li>`).join("")}</ul>`,
                    { icono: "fa-boxes-stacked" });
                return;
            }

            const numeroPedido = (resultado.venta.id || "").replace("venta-", "#");

            // Arma el mensaje de WhatsApp con el detalle del pedido y lo
            // abre en una pestaña nueva: así el pedido "llega" de verdad
            // al número de ventas de la tienda, sin necesidad de un
            // servidor de correo.
            const lineasProductos = carrito
                .map((p) => `- ${p.cantidad} x ${p.nombre} (${formatoCOP(p.precio)} c/u) = ${formatoCOP(p.precio * p.cantidad)}`)
                .join("\n");

            const mensaje =
                `🛒 *Nuevo pedido Sport+Fitness ${numeroPedido}*\n\n` +
                `*Cliente:* ${sesion.nombre}\n` +
                `*Correo:* ${sesion.correo}\n` +
                `*Teléfono:* ${telefono}\n` +
                `*Dirección:* ${direccion}, ${ciudad}\n` +
                `*Método de pago:* ${metodoPago}\n` +
                (notas ? `*Notas:* ${notas}\n` : "") +
                `\n*Productos:*\n${lineasProductos}\n\n` +
                `*Total: ${formatoCOP(total)}*`;

            const urlWhatsApp = `https://wa.me/${SF_WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
            window.open(urlWhatsApp, "_blank");

            if (modalCheckout) modalCheckout.hide();

            sfVaciarCarrito();

            await sfAlerta("exito", `¡Gracias por tu compra, ${sfEsc(sesion.nombre)}!`,
                `Tu pedido quedó registrado.` +
                `<div class="sf-resumen">` +
                `<div><span>Pedido</span><strong>${sfEsc(numeroPedido)}</strong></div>` +
                `<div><span>Productos</span><strong>${carrito.reduce((n, p) => n + p.cantidad, 0)}</strong></div>` +
                `<div class="sf-total"><span>Total</span><span>${formatoCOP(total)}</span></div>` +
                `</div>` +
                `<p class="mt-3 mb-0">Se abrió WhatsApp para enviar tu pedido a la tienda y coordinar la entrega.</p>`,
                { icono: "fa-bag-shopping", boton: "Volver a la tienda", cerrarFuera: false });

            window.location.href = "index.html";
        });
    }

    renderizar();
});
