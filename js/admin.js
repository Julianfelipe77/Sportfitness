// ===================================
// SPORT+FITNESS - Panel de administrador
// ===================================
// Todo se apoya en los datos guardados en localStorage por
// script.js (sf_productos, sf_ventas) y auth.js (sesión).
// No hay backend real: esto es una simulación funcional.
// ===================================

function formatoCOP(valor) {
    return "$" + Math.round(valor || 0).toLocaleString("es-CO");
}

// Escapa texto escrito por clientes (nombres, correos, direcciones...)
// antes de insertarlo con innerHTML, para que nadie pueda colar HTML o
// scripts en el panel del administrador.
function escaparHtml(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function formatoFecha(fechaIso) {
    return new Date(fechaIso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

document.addEventListener("DOMContentLoaded", () => {

    // ---------- Control de acceso ----------
    const sesion = sfObtenerSesion();
    if (!sesion || !sfEsAdmin(sesion)) {
        window.location.href = "login.html?redirect=admin.html";
        return;
    }

    document.getElementById("admin-nombre").textContent = sesion.nombre;
    document.getElementById("admin-correo").textContent = sesion.correo;

    document.getElementById("btn-cerrar-sesion-admin").addEventListener("click", sfCerrarSesion);
    document.getElementById("menu-cerrar-sesion").addEventListener("click", (e) => {
        e.preventDefault();
        sfCerrarSesion();
    });

    // Referencias a los gráficos para poder destruirlos al re-renderizar
    let chartVendidos = null;
    let chartVentasDia = null;
    let chartCategorias = null;

    // =====================================================
    // TARJETAS RESUMEN
    // =====================================================
    async function renderTarjetasResumen() {
        const productos = await sfObtenerProductos();
        const ventas = await sfObtenerVentas();

        const totalIngresos = ventas.reduce((t, v) => t + v.total, 0);
        const agotados = productos.filter((p) => p.stock === 0).length;
        const masVendido = calcularRanking(ventas)[0];

        const tarjetas = [
            { icono: "fa-solid fa-boxes-stacked", color: "#198754", titulo: "Productos en catálogo", valor: productos.length },
            { icono: "fa-solid fa-cart-shopping", color: "#0d6efd", titulo: "Ventas registradas", valor: ventas.length },
            { icono: "fa-solid fa-sack-dollar", color: "#20c997", titulo: "Ingresos totales", valor: formatoCOP(totalIngresos) },
            { icono: "fa-solid fa-triangle-exclamation", color: "#dc3545", titulo: "Productos agotados", valor: agotados },
            { icono: "fa-solid fa-crown", color: "#ffc107", titulo: "Producto más vendido", valor: masVendido ? masVendido.nombre : "Sin datos" }
        ];

        document.getElementById("tarjetas-resumen").innerHTML = tarjetas.map((t) => `
            <div class="col-md-4 col-lg">
                <div class="card admin-tarjeta p-3 d-flex flex-row align-items-center gap-3">
                    <div class="admin-icono" style="background-color:${t.color}"><i class="${t.icono}"></i></div>
                    <div>
                        <div class="text-muted small">${t.titulo}</div>
                        <div class="admin-valor">${t.valor}</div>
                    </div>
                </div>
            </div>
        `).join("");
    }

    // =====================================================
    // INVENTARIO
    // =====================================================
    async function renderInventario() {
        const productos = await sfObtenerProductos();
        const filtroTexto = document.getElementById("filtro-buscar").value.trim().toLowerCase();
        const filtroCategoria = document.getElementById("filtro-categoria").value;

        const filtrados = productos.filter((p) => {
            const coincideTexto = p.nombre.toLowerCase().includes(filtroTexto);
            const coincideCategoria = !filtroCategoria || p.categoria === filtroCategoria;
            return coincideTexto && coincideCategoria;
        });

        const tbody = document.getElementById("tabla-inventario");

        if (filtrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No se encontraron productos.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtrados.map((p) => {
            let clase = "";
            let estado = `<span class="badge bg-success">Disponible</span>`;
            if (p.stock === 0) {
                clase = "fila-agotado";
                estado = `<span class="badge bg-danger">Agotado</span>`;
            } else if (p.stock <= 5) {
                clase = "fila-stock-bajo";
                estado = `<span class="badge bg-warning text-dark">Stock bajo</span>`;
            }

            return `
                <tr class="${clase}">
                    <td>${p.nombre}</td>
                    <td>${p.categoria}</td>
                    <td>${formatoCOP(p.precio)}</td>
                    <td>
                        <input type="number" min="0" class="form-control form-control-sm input-stock-admin"
                            data-id="${p.id}" value="${p.stock}">
                    </td>
                    <td>${estado}</td>
                    <td class="no-imprimir">
                        <button class="btn btn-sm btn-outline-primary btn-editar-producto" data-id="${p.id}" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-eliminar-producto" data-id="${p.id}" title="Eliminar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    document.getElementById("filtro-buscar").addEventListener("input", renderInventario);
    document.getElementById("filtro-categoria").addEventListener("change", renderInventario);

    // Cambiar stock directamente desde la tabla
    document.getElementById("tabla-inventario").addEventListener("change", async (e) => {
        if (!e.target.classList.contains("input-stock-admin")) return;
        const nuevoStock = Math.max(0, parseInt(e.target.value, 10) || 0);
        await sfActualizarProducto(e.target.dataset.id, { stock: nuevoStock });
        renderTodo();
        if (nuevoStock === 0) sfToast("aviso", "Producto agotado", "El stock quedó en 0.");
        else sfToast("exito", "Stock actualizado", `Nuevo stock: <b>${nuevoStock}</b>`, { duracion: 2200 });
    });

    // Eliminar producto
    document.getElementById("tabla-inventario").addEventListener("click", async (e) => {
        const btnEliminar = e.target.closest(".btn-eliminar-producto");
        const btnEditar = e.target.closest(".btn-editar-producto");

        if (btnEliminar) {
            const filaProd = btnEliminar.closest("tr");
            const nombreProd = filaProd ? filaProd.children[0].textContent : "este producto";
            const si = await sfConfirmar({
                tipo: "peligro",
                titulo: "Eliminar producto",
                texto: `Vas a quitar <span class="sf-etiqueta">${escaparHtml(nombreProd)}</span> del catálogo.` +
                       `<div class="sf-nota sf-nota-roja">Dejará de mostrarse en la tienda.</div>`,
                confirmar: "Eliminar", cancelar: "Cancelar"
            });
            if (!si) return;
            await sfEliminarProductoCatalogo(btnEliminar.dataset.id);
            renderTodo();
            sfToast("exito", "Producto eliminado", escaparHtml(nombreProd));
        }

        if (btnEditar) {
            const productos = await sfObtenerProductos();
            const producto = productos.find((p) => p.id === btnEditar.dataset.id);
            if (!producto) return;

            document.getElementById("modal-producto-titulo").textContent = "Editar producto";
            document.getElementById("producto-id-original").value = producto.id;
            document.getElementById("producto-nombre").value = producto.nombre;
            document.getElementById("producto-categoria").value = producto.categoria;
            document.getElementById("producto-precio").value = producto.precio;
            document.getElementById("producto-stock").value = producto.stock;

            new bootstrap.Modal(document.getElementById("modal-producto")).show();
        }
    });

    // Botón "Añadir producto": limpiar formulario
    document.getElementById("btn-nuevo-producto").addEventListener("click", () => {
        document.getElementById("modal-producto-titulo").textContent = "Añadir producto";
        document.getElementById("form-producto").reset();
        document.getElementById("producto-id-original").value = "";
    });

    // Guardar (crear o editar) producto
    document.getElementById("form-producto").addEventListener("submit", async (e) => {
        e.preventDefault();

        const idOriginal = document.getElementById("producto-id-original").value;
        const nombre = document.getElementById("producto-nombre").value.trim();
        const categoria = document.getElementById("producto-categoria").value;
        const precio = parseFloat(document.getElementById("producto-precio").value);
        const stock = parseInt(document.getElementById("producto-stock").value, 10);
        const botonGuardar = document.getElementById("form-producto").querySelector('button[type="submit"]');

        if (!nombre || isNaN(precio) || isNaN(stock)) {
            sfToast("aviso", "Formulario incompleto", "Completa nombre, precio y stock correctamente.");
            return;
        }

        if (botonGuardar) botonGuardar.disabled = true;

        if (idOriginal) {
            await sfActualizarProducto(idOriginal, { nombre, categoria, precio, stock });
        } else {
            const imagenPorCategoria = {
                "Hombre": "img/gorra.webp",
                "Mujer": "img/mmm.webp",
                "Suplementos": "img/ChatGPT Image 27 jul 2026, 18_21_29.png"
            };
            await sfCrearProducto({ nombre, categoria, precio, stock, imagen: imagenPorCategoria[categoria] });
        }

        if (botonGuardar) botonGuardar.disabled = false;
        bootstrap.Modal.getInstance(document.getElementById("modal-producto")).hide();
        renderTodo();
        sfToast("exito", idOriginal ? "Producto actualizado" : "Producto creado", escaparHtml(nombre));
    });

    // =====================================================
    // PEDIDOS (dirección, teléfono y método de pago)
    // =====================================================
    async function renderPedidos() {
        const ventas = await sfObtenerVentas();
        const filtro = (document.getElementById("filtro-pedidos").value || "").trim().toLowerCase();
        const tbody = document.getElementById("tabla-pedidos");

        const ordenadas = [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const filtradas = ordenadas.filter((v) => v.cliente.nombre.toLowerCase().includes(filtro));

        if (filtradas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No hay pedidos para mostrar.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtradas.map((v) => {
            const numero = v.id.replace("venta-", "#");
            const entrega = v.direccion ? escaparHtml(`${v.direccion}, ${v.ciudad || ""}`) : "<span class='text-muted'>Sin datos (compra anterior)</span>";
            const contacto = escaparHtml(v.telefono || v.cliente.correo);

            return `
                <tr>
                    <td>${numero}</td>
                    <td>${formatoFecha(v.fecha)}</td>
                    <td>${escaparHtml(v.cliente.nombre)}</td>
                    <td>${contacto}</td>
                    <td>${entrega}</td>
                    <td>${escaparHtml(v.metodoPago || "-")}</td>
                    <td class="fw-bold">${formatoCOP(v.total)}</td>
                    <td class="no-imprimir">
                        ${v.telefono ? `
                        <a class="btn btn-sm btn-success" target="_blank" rel="noopener"
                           href="https://wa.me/${SF_WHATSAPP_NUMERO}?text=${encodeURIComponent('Hola ' + v.cliente.nombre + ', te escribimos de Sport+Fitness sobre tu pedido ' + numero + '.')}">
                            <i class="fa-brands fa-whatsapp"></i>
                        </a>` : ""}
                    </td>
                </tr>
            `;
        }).join("");
    }

    document.getElementById("filtro-pedidos").addEventListener("input", renderPedidos);

    // =====================================================
    // RANKING DE MÁS VENDIDOS (compartido por varias secciones)
    // =====================================================
    function calcularRanking(ventas) {
        const mapa = {};

        ventas.forEach((venta) => {
            venta.items.forEach((item) => {
                if (!mapa[item.id]) {
                    mapa[item.id] = { id: item.id, nombre: item.nombre, unidades: 0, ingresos: 0 };
                }
                mapa[item.id].unidades += item.cantidad;
                mapa[item.id].ingresos += item.cantidad * item.precio;
            });
        });

        return Object.values(mapa).sort((a, b) => b.unidades - a.unidades);
    }

    // =====================================================
    // MÁS VENDIDOS
    // =====================================================
    async function renderMasVendidos() {
        const ventas = await sfObtenerVentas();
        const ranking = calcularRanking(ventas).slice(0, 10);

        document.getElementById("tabla-vendidos").innerHTML = ranking.length
            ? ranking.map((r, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${r.nombre}</td>
                    <td>${r.unidades}</td>
                    <td>${formatoCOP(r.ingresos)}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="4" class="text-center text-muted py-4">Aún no hay ventas registradas.</td></tr>`;

        const top5 = ranking.slice(0, 5);
        const ctx = document.getElementById("grafico-vendidos");

        if (chartVendidos) chartVendidos.destroy();
        if (typeof Chart !== "undefined" && ctx) {
            chartVendidos = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: top5.map((r) => r.nombre),
                    datasets: [{
                        label: "Unidades vendidas",
                        data: top5.map((r) => r.unidades),
                        backgroundColor: "#198754"
                    }]
                },
                options: {
                    indexAxis: "y",
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
                }
            });
        }
    }

    // =====================================================
    // ESTADÍSTICAS DE VENTAS
    // =====================================================
    async function renderEstadisticas() {
        const ventas = await sfObtenerVentas();
        const hoy = new Date();

        // Ventas por día (últimos 30 días)
        const dias = [];
        const totalesPorDia = [];
        for (let i = 29; i >= 0; i--) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() - i);
            const claveDia = fecha.toISOString().slice(0, 10);
            dias.push(fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }));

            const totalDia = ventas
                .filter((v) => v.fecha.slice(0, 10) === claveDia)
                .reduce((t, v) => t + v.total, 0);
            totalesPorDia.push(totalDia);
        }

        const ctxDia = document.getElementById("grafico-ventas-dia");
        if (chartVentasDia) chartVentasDia.destroy();
        if (typeof Chart !== "undefined" && ctxDia) {
            chartVentasDia = new Chart(ctxDia, {
                type: "line",
                data: {
                    labels: dias,
                    datasets: [{
                        label: "Ventas (COP)",
                        data: totalesPorDia,
                        borderColor: "#198754",
                        backgroundColor: "rgba(25,135,84,0.15)",
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: { plugins: { legend: { display: false } } }
            });
        }

        // Estadísticas del mes en curso
        const mesActual = hoy.getMonth();
        const anioActual = hoy.getFullYear();
        const ventasMes = ventas.filter((v) => {
            const f = new Date(v.fecha);
            return f.getMonth() === mesActual && f.getFullYear() === anioActual;
        });
        const ingresosMes = ventasMes.reduce((t, v) => t + v.total, 0);
        const ticketPromedio = ventas.length ? ventas.reduce((t, v) => t + v.total, 0) / ventas.length : 0;

        document.getElementById("stat-ticket-promedio").textContent = formatoCOP(ticketPromedio);
        document.getElementById("stat-ventas-mes").textContent = ventasMes.length;
        document.getElementById("stat-ingresos-mes").textContent = formatoCOP(ingresosMes);

        // Ventas por categoría
        const productos = await sfObtenerProductos();
        const ingresosPorCategoria = { Hombre: 0, Mujer: 0, Suplementos: 0 };

        ventas.forEach((venta) => {
            venta.items.forEach((item) => {
                const producto = productos.find((p) => p.id === item.id);
                const categoria = producto ? producto.categoria : null;
                if (categoria && ingresosPorCategoria[categoria] !== undefined) {
                    ingresosPorCategoria[categoria] += item.cantidad * item.precio;
                }
            });
        });

        const ctxCat = document.getElementById("grafico-categorias");
        if (chartCategorias) chartCategorias.destroy();
        if (typeof Chart !== "undefined" && ctxCat) {
            chartCategorias = new Chart(ctxCat, {
                type: "doughnut",
                data: {
                    labels: Object.keys(ingresosPorCategoria),
                    datasets: [{
                        data: Object.values(ingresosPorCategoria),
                        backgroundColor: ["#198754", "#dc3545", "#0d6efd"]
                    }]
                }
            });
        }
    }

    // =====================================================
    // PRODUCTOS AGOTADOS
    // =====================================================
    async function renderAgotados() {
        const productos = (await sfObtenerProductos()).filter((p) => p.stock === 0);
        const tbody = document.getElementById("tabla-agotados");
        const avisoVacio = document.getElementById("sin-agotados");

        if (productos.length === 0) {
            tbody.innerHTML = "";
            avisoVacio.classList.remove("d-none");
            return;
        }

        avisoVacio.classList.add("d-none");
        tbody.innerHTML = productos.map((p) => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.categoria}</td>
                <td>${formatoCOP(p.precio)}</td>
                <td class="no-imprimir">
                    <button class="btn btn-sm btn-success btn-reponer" data-id="${p.id}">
                        <i class="fa-solid fa-rotate me-1"></i> Reponer 10 uds.
                    </button>
                </td>
            </tr>
        `).join("");
    }

    document.getElementById("tabla-agotados").addEventListener("click", async (e) => {
        const boton = e.target.closest(".btn-reponer");
        if (!boton) return;
        const productos = await sfObtenerProductos();
        const producto = productos.find((p) => p.id === boton.dataset.id);
        if (producto) {
            await sfActualizarProducto(producto.id, { stock: producto.stock + 10 });
            renderTodo();
        }
    });

    // =====================================================
    // INFORME QUINCENAL
    // =====================================================
    async function renderInformeQuincenal() {
        const hoy = new Date();
        const hace15 = new Date(hoy);
        hace15.setDate(hoy.getDate() - 15);

        const ventas = (await sfObtenerVentas()).filter((v) => new Date(v.fecha) >= hace15);
        const productos = await sfObtenerProductos();
        const ranking = calcularRanking(ventas);
        const agotados = productos.filter((p) => p.stock === 0);
        const stockBajo = productos.filter((p) => p.stock > 0 && p.stock <= 5);

        const totalIngresos = ventas.reduce((t, v) => t + v.total, 0);
        const ticketPromedio = ventas.length ? totalIngresos / ventas.length : 0;

        const filasTop = ranking.slice(0, 5).map((r, i) => `
            <tr><td>${i + 1}</td><td>${r.nombre}</td><td>${r.unidades}</td><td>${formatoCOP(r.ingresos)}</td></tr>
        `).join("") || `<tr><td colspan="4" class="text-muted">Sin ventas en el período.</td></tr>`;

        const filasAgotados = agotados.map((p) => `<li>${p.nombre} (${p.categoria})</li>`).join("") || "<li>Ninguno</li>";
        const filasStockBajo = stockBajo.map((p) => `<li>${p.nombre} — quedan ${p.stock} uds.</li>`).join("") || "<li>Ninguno</li>";

        document.getElementById("contenido-informe").innerHTML = `
            <h3 class="fw-bold">Informe quincenal de Sport+Fitness</h3>
            <p class="text-muted">Período: ${formatoFecha(hace15)} — ${formatoFecha(hoy)}</p>
            <hr>

            <h5 class="fw-bold mt-3">Resumen de ventas</h5>
            <ul>
                <li>Ventas registradas: <strong>${ventas.length}</strong></li>
                <li>Ingresos totales del período: <strong>${formatoCOP(totalIngresos)}</strong></li>
                <li>Ticket promedio: <strong>${formatoCOP(ticketPromedio)}</strong></li>
            </ul>

            <h5 class="fw-bold mt-4">Top 5 productos más vendidos</h5>
            <table class="table table-sm table-bordered">
                <thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Ingresos</th></tr></thead>
                <tbody>${filasTop}</tbody>
            </table>

            <h5 class="fw-bold mt-4">Inventario</h5>
            <ul>
                <li>Total de productos en catálogo: <strong>${productos.length}</strong></li>
                <li>Productos agotados: <strong>${agotados.length}</strong></li>
                <li>Productos con stock bajo (≤5 uds.): <strong>${stockBajo.length}</strong></li>
            </ul>

            <div class="row">
                <div class="col-md-6">
                    <h6 class="fw-bold">Productos agotados</h6>
                    <ul>${filasAgotados}</ul>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold">Productos con stock bajo</h6>
                    <ul>${filasStockBajo}</ul>
                </div>
            </div>

            <p class="text-muted mt-4 mb-0"><small>Informe generado automáticamente el ${formatoFecha(hoy.toISOString())}.</small></p>
        `;
    }

    document.getElementById("btn-imprimir-informe").addEventListener("click", () => window.print());

    document.getElementById("btn-descargar-informe").addEventListener("click", () => {
        const texto = document.getElementById("contenido-informe").innerText;
        const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
        const enlace = document.createElement("a");
        enlace.href = URL.createObjectURL(blob);
        enlace.download = "informe-quincenal-sportfitness.txt";
        enlace.click();
        URL.revokeObjectURL(enlace.href);
    });

    // =====================================================
    // CLIENTES (CRUD: datos, pedidos, última compra, deshabilitar)
    // =====================================================
    // Esta sección vive en el servidor (api/clientes.php): necesita la
    // base de datos y una sesión de administrador abierta en el servidor.

    let clientesCache = [];
    let clientesCargados = false;

    const avisoClientes = document.getElementById("clientes-aviso");

    function mostrarAvisoClientes(tipo, html) {
        avisoClientes.className = `alert alert-${tipo}`;
        avisoClientes.innerHTML = html;
    }

    function ocultarAvisoClientes() {
        avisoClientes.className = "alert d-none";
    }

    function umbralClientes() {
        return parseInt(document.getElementById("clientes-umbral").value, 10) || 90;
    }

    // "hace 3 meses", "ayer", "hoy"...
    function textoHace(dias) {
        if (dias <= 0) return "hoy";
        if (dias === 1) return "ayer";
        if (dias < 30) return `hace ${dias} días`;
        if (dias < 365) {
            const meses = Math.floor(dias / 30);
            return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
        }
        const anios = Math.floor(dias / 365);
        const mesesRest = Math.floor((dias % 365) / 30);
        return `hace ${anios} ${anios === 1 ? "año" : "años"}` +
            (mesesRest ? ` y ${mesesRest} ${mesesRest === 1 ? "mes" : "meses"}` : "");
    }

    function estadoCliente(c) {
        if (!c.activo) return "deshabilitado";
        return c.dias_sin_comprar >= umbralClientes() ? "riesgo" : "activo";
    }

    // Llama a la API y traduce los fallos más comunes a un aviso claro.
    // Devuelve la respuesta si salió bien, o null (ya mostró el aviso).
    async function llamarClientes(promesa) {
        const r = await promesa;

        if (!r) {
            mostrarAvisoClientes("warning",
                '<i class="fa-solid fa-plug-circle-xmark me-1"></i> La gestión de clientes necesita conexión con el servidor y la base de datos. ' +
                'Enciende Apache y MySQL y abre el sitio desde <code>http://localhost/...</code> (no con doble clic).');
            return null;
        }

        if (r.ok === false && r.no_autorizado) {
            mostrarAvisoClientes("warning",
                '<i class="fa-solid fa-lock me-1"></i> Tu sesión de administrador del servidor no está activa. ' +
                '<a href="#" class="alert-link" id="clientes-relogin">Cierra sesión y vuelve a entrar</a> como administrador para gestionar clientes.');
            const enlace = document.getElementById("clientes-relogin");
            if (enlace) enlace.addEventListener("click", (e) => { e.preventDefault(); sfCerrarSesion(); });
            return null;
        }

        if (r.ok === false) {
            return r; // el que llama decide cómo mostrar el mensaje
        }

        ocultarAvisoClientes();
        return r;
    }

    async function cargarClientes() {
        const r = await llamarClientes(sfApiGet("clientes.php"));

        if (!r || r.ok === false) {
            if (r && r.ok === false) mostrarAvisoClientes("danger", escaparHtml(r.mensaje || "No se pudieron cargar los clientes."));
            clientesCache = [];
            document.getElementById("tabla-clientes").innerHTML =
                `<tr><td colspan="8" class="text-center text-muted py-4">No se pudieron cargar los clientes.</td></tr>`;
            document.getElementById("clientes-resumen").innerHTML = "";
            return;
        }

        clientesCache = r.clientes || [];
        clientesCargados = true;
        renderClientes();
    }

    function renderClientes() {
        const umbral = umbralClientes();
        const texto = document.getElementById("clientes-buscar").value.trim().toLowerCase();
        const filtroEstado = document.getElementById("clientes-filtro-estado").value;

        // ----- Tarjetas resumen -----
        const total = clientesCache.length;
        const deshabilitados = clientesCache.filter((c) => !c.activo).length;
        const enRiesgo = clientesCache.filter((c) => estadoCliente(c) === "riesgo").length;
        const activos = total - deshabilitados - enRiesgo;

        const tarjetas = [
            { icono: "fa-solid fa-users", color: "#0d6efd", titulo: "Clientes registrados", valor: total },
            { icono: "fa-solid fa-user-check", color: "#198754", titulo: "Activos", valor: activos },
            { icono: "fa-solid fa-user-clock", color: "#ffc107", titulo: `Inactivos (+${umbral} días)`, valor: enRiesgo },
            { icono: "fa-solid fa-user-slash", color: "#6c757d", titulo: "Deshabilitados", valor: deshabilitados }
        ];

        document.getElementById("clientes-resumen").innerHTML = tarjetas.map((t) => `
            <div class="col-6 col-lg-3">
                <div class="card admin-tarjeta p-3 d-flex flex-row align-items-center gap-3">
                    <div class="admin-icono" style="background-color:${t.color}"><i class="${t.icono}"></i></div>
                    <div>
                        <div class="text-muted small">${t.titulo}</div>
                        <div class="admin-valor">${t.valor}</div>
                    </div>
                </div>
            </div>
        `).join("");

        // ----- Tabla -----
        const filtrados = clientesCache.filter((c) => {
            const coincideTexto = !texto ||
                c.nombre.toLowerCase().includes(texto) ||
                c.correo.toLowerCase().includes(texto) ||
                (c.telefono || "").includes(texto);
            const coincideEstado = !filtroEstado || estadoCliente(c) === filtroEstado;
            return coincideTexto && coincideEstado;
        });

        const tbody = document.getElementById("tabla-clientes");

        if (filtrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No se encontraron clientes.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtrados.map((c) => {
            const estado = estadoCliente(c);
            let claseFila = "";
            let badge = `<span class="badge bg-success">Activo</span>`;

            if (estado === "deshabilitado") {
                claseFila = "fila-cliente-deshabilitado";
                badge = `<span class="badge bg-secondary">Deshabilitado</span>` +
                    (c.motivo_desactivacion ? `<div class="small text-muted mt-1">${escaparHtml(c.motivo_desactivacion)}</div>` : "");
            } else if (estado === "riesgo") {
                claseFila = "fila-cliente-riesgo";
                badge = `<span class="badge bg-warning text-dark">Inactivo</span>`;
            }

            const ultimaCompra = c.nunca_compro
                ? `<span class="text-muted">Nunca ha comprado</span><div class="small text-muted">se registró ${textoHace(c.dias_sin_comprar)}</div>`
                : `${formatoFecha(c.ultimo_pedido)}<div class="small ${estado === "riesgo" ? "text-danger fw-semibold" : "text-muted"}">${textoHace(c.dias_sin_comprar)}</div>`;

            const botonEstado = c.activo
                ? `<button class="btn btn-sm btn-outline-warning btn-cliente-deshabilitar" data-id="${c.id}" title="Deshabilitar cuenta"><i class="fa-solid fa-user-slash"></i></button>`
                : `<button class="btn btn-sm btn-outline-success btn-cliente-habilitar" data-id="${c.id}" title="Habilitar cuenta"><i class="fa-solid fa-user-check"></i></button>`;

            return `
                <tr class="${claseFila}">
                    <td>
                        <div class="fw-semibold">${escaparHtml(c.nombre)}</div>
                        <div class="small text-muted">${escaparHtml(c.correo)}</div>
                    </td>
                    <td>${escaparHtml(c.telefono || "-")}</td>
                    <td>${formatoFecha(c.fecha_registro)}</td>
                    <td class="text-center">${c.total_pedidos}</td>
                    <td>${formatoCOP(c.total_gastado)}</td>
                    <td>${ultimaCompra}</td>
                    <td>${badge}</td>
                    <td class="no-imprimir text-nowrap">
                        <button class="btn btn-sm btn-outline-secondary btn-cliente-ver" data-id="${c.id}" title="Ver datos y pedidos"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn btn-sm btn-outline-primary btn-cliente-editar" data-id="${c.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        ${botonEstado}
                        <button class="btn btn-sm btn-outline-danger btn-cliente-eliminar" data-id="${c.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    document.getElementById("clientes-buscar").addEventListener("input", renderClientes);
    document.getElementById("clientes-filtro-estado").addEventListener("change", renderClientes);
    document.getElementById("clientes-umbral").addEventListener("change", renderClientes);

    // Carga perezosa: solo se consulta al abrir la pestaña
    document.querySelector('[data-bs-target="#tab-clientes"]').addEventListener("shown.bs.tab", cargarClientes);

    // ---------- Acciones de la tabla ----------
    document.getElementById("tabla-clientes").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-id]");
        if (!btn) return;

        const id = parseInt(btn.dataset.id, 10);
        const cliente = clientesCache.find((c) => c.id === id);
        if (!cliente) return;

        if (btn.classList.contains("btn-cliente-ver")) {
            abrirDetalleCliente(cliente);

        } else if (btn.classList.contains("btn-cliente-editar")) {
            abrirFormularioCliente(cliente);

        } else if (btn.classList.contains("btn-cliente-deshabilitar")) {
            const inactivo = estadoCliente(cliente) === "riesgo";
            const motivo = inactivo
                ? `Inactividad: ${cliente.dias_sin_comprar} días sin comprar`
                : "Deshabilitada por el administrador";

            const si = await sfConfirmar({
                tipo: "aviso", icono: "fa-user-slash",
                titulo: "Deshabilitar cuenta",
                texto: `La cuenta de <span class="sf-etiqueta">${escaparHtml(cliente.nombre)}</span> no podrá iniciar sesión ni hacer pedidos.` +
                       `<div class="sf-nota">Sus datos y su historial de pedidos se conservan. Puedes volver a habilitarla cuando quieras.</div>`,
                confirmar: "Deshabilitar", cancelar: "Cancelar"
            });
            if (!si) return;

            const r = await llamarClientes(sfApiPost("clientes.php", { accion: "cambiar_estado", id, activo: false, motivo }));
            if (r && r.ok === false) sfAlerta("error", "No se pudo deshabilitar", escaparHtml(r.mensaje || ""));
            else if (r) sfToast("aviso", "Cuenta deshabilitada", escaparHtml(cliente.nombre), { icono: "fa-user-slash" });
            if (r) cargarClientes();

        } else if (btn.classList.contains("btn-cliente-habilitar")) {
            const si = await sfConfirmar({
                tipo: "pregunta", icono: "fa-user-check",
                titulo: "Habilitar cuenta",
                texto: `<span class="sf-etiqueta">${escaparHtml(cliente.nombre)}</span> podrá volver a iniciar sesión y hacer pedidos.`,
                confirmar: "Habilitar", cancelar: "Cancelar"
            });
            if (!si) return;

            const r = await llamarClientes(sfApiPost("clientes.php", { accion: "cambiar_estado", id, activo: true }));
            if (r && r.ok === false) sfAlerta("error", "No se pudo habilitar", escaparHtml(r.mensaje || ""));
            else if (r) sfToast("exito", "Cuenta habilitada", escaparHtml(cliente.nombre), { icono: "fa-user-check" });
            if (r) cargarClientes();

        } else if (btn.classList.contains("btn-cliente-eliminar")) {
            const si = await sfConfirmar({
                tipo: "peligro", icono: "fa-user-minus",
                titulo: "Eliminar cliente",
                texto: `Vas a eliminar definitivamente a <span class="sf-etiqueta">${escaparHtml(cliente.nombre)}</span>.` +
                       `<div class="sf-nota sf-nota-roja"><b>Esta acción no se puede deshacer.</b> Si solo quieres bloquear su acceso, usa «Deshabilitar».</div>`,
                confirmar: "Eliminar definitivamente", cancelar: "Cancelar"
            });
            if (!si) return;

            const r = await llamarClientes(sfApiDelete(`clientes.php?id=${id}`));
            if (r && r.ok === false) sfAlerta("error", "No se pudo eliminar", escaparHtml(r.mensaje || ""));
            else if (r) sfToast("exito", "Cliente eliminado", escaparHtml(cliente.nombre), { icono: "fa-user-minus" });
            if (r) cargarClientes();
        }
    });

    // ---------- Crear / editar ----------
    const modalClienteEl = document.getElementById("modal-cliente");

    function abrirFormularioCliente(cliente) {
        const editando = !!cliente;

        document.getElementById("form-cliente").reset();
        document.getElementById("modal-cliente-titulo").textContent = editando ? "Editar cliente" : "Nuevo cliente";
        document.getElementById("cliente-id").value = editando ? cliente.id : "";
        document.getElementById("cliente-nombre").value = editando ? cliente.nombre : "";
        document.getElementById("cliente-correo").value = editando ? cliente.correo : "";
        document.getElementById("cliente-telefono").value = editando ? (cliente.telefono || "") : "";

        const passInput = document.getElementById("cliente-password");
        passInput.required = !editando;
        document.getElementById("cliente-password-label").textContent = editando ? "Nueva contraseña (opcional)" : "Contraseña";
        document.getElementById("cliente-password-ayuda").textContent = editando
            ? "Déjala vacía para conservar la contraseña actual."
            : "Mínimo 6 caracteres. Compártela con el cliente para que pueda entrar.";

        bootstrap.Modal.getOrCreateInstance(modalClienteEl).show();
    }

    document.getElementById("btn-nuevo-cliente").addEventListener("click", () => abrirFormularioCliente(null));

    document.getElementById("form-cliente").addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = document.getElementById("cliente-id").value;
        const datos = {
            nombre: document.getElementById("cliente-nombre").value.trim(),
            correo: document.getElementById("cliente-correo").value.trim().toLowerCase(),
            telefono: document.getElementById("cliente-telefono").value.trim(),
            password: document.getElementById("cliente-password").value
        };
        const boton = e.target.querySelector('button[type="submit"]');

        boton.disabled = true;

        const r = id
            ? await llamarClientes(sfApiPut("clientes.php", { id: parseInt(id, 10), ...datos }))
            : await llamarClientes(sfApiPost("clientes.php", { accion: "crear", ...datos }));

        boton.disabled = false;

        if (!r) {
            bootstrap.Modal.getInstance(modalClienteEl).hide();
            return;
        }

        if (r.ok === false) {
            sfAlerta("error", "No se pudo guardar el cliente", escaparHtml(r.mensaje || "Revisa los datos e inténtalo de nuevo."));
            return;
        }

        bootstrap.Modal.getInstance(modalClienteEl).hide();
        sfToast("exito", id ? "Cliente actualizado" : "Cliente creado", escaparHtml(datos.nombre || ""));
        cargarClientes();
    });

    // ---------- Detalle: datos + pedidos ----------
    async function abrirDetalleCliente(cliente) {
        const contenido = document.getElementById("detalle-contenido");
        document.getElementById("detalle-titulo").textContent = cliente.nombre;
        contenido.innerHTML = `<div class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Cargando...</div>`;
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modal-cliente-detalle")).show();

        const r = await llamarClientes(sfApiGet(`clientes.php?id=${cliente.id}`));

        if (!r || r.ok === false) {
            contenido.innerHTML = `<div class="alert alert-danger mb-0">${escaparHtml((r && r.mensaje) || "No se pudo cargar el detalle del cliente.")}</div>`;
            return;
        }

        const c = r.cliente;
        const estado = estadoCliente(c);
        const etiquetaEstado = estado === "deshabilitado"
            ? `<span class="badge bg-secondary">Deshabilitado</span>`
            : estado === "riesgo"
                ? `<span class="badge bg-warning text-dark">Inactivo</span>`
                : `<span class="badge bg-success">Activo</span>`;

        const colorEstadoPedido = { pagado: "success", pendiente: "warning text-dark", enviado: "primary", cancelado: "danger" };

        const filasPedidos = r.pedidos.map((p) => `
            <tr>
                <td class="fw-semibold">#${p.id}</td>
                <td>${formatoFecha(p.fecha)}</td>
                <td><span class="badge bg-${colorEstadoPedido[p.estado] || "secondary"}">${escaparHtml(p.estado)}</span></td>
                <td>
                    <ul class="list-unstyled mb-0 small">
                        ${p.items.map((it) => `<li>${it.cantidad} × ${escaparHtml(it.nombre)} <span class="text-muted">(${formatoCOP(it.precio)} c/u)</span></li>`).join("")}
                    </ul>
                </td>
                <td class="small">${p.direccion ? escaparHtml(`${p.direccion}, ${p.ciudad || ""}`) : "-"}</td>
                <td>${escaparHtml(p.metodoPago || "-")}</td>
                <td class="fw-bold">${formatoCOP(p.total)}</td>
            </tr>
        `).join("");

        contenido.innerHTML = `
            <div class="row g-3 mb-4">
                <div class="col-md-6">
                    <h6 class="fw-bold text-uppercase text-muted small">Datos del cliente</h6>
                    <ul class="list-unstyled mb-0">
                        <li><i class="fa-solid fa-user me-2 text-success"></i>${escaparHtml(c.nombre)}</li>
                        <li><i class="fa-solid fa-envelope me-2 text-success"></i>${escaparHtml(c.correo)}</li>
                        <li><i class="fa-solid fa-phone me-2 text-success"></i>${escaparHtml(c.telefono || "Sin teléfono")}</li>
                        <li><i class="fa-solid fa-calendar me-2 text-success"></i>Registrado el ${formatoFecha(c.fecha_registro)}</li>
                        <li class="mt-1">${etiquetaEstado}
                            ${c.motivo_desactivacion ? `<span class="small text-muted ms-1">${escaparHtml(c.motivo_desactivacion)}${c.fecha_desactivacion ? " (" + formatoFecha(c.fecha_desactivacion) + ")" : ""}</span>` : ""}
                        </li>
                    </ul>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold text-uppercase text-muted small">Resumen de compras</h6>
                    <ul class="list-unstyled mb-0">
                        <li>Pedidos realizados: <strong>${c.total_pedidos}</strong></li>
                        <li>Total comprado: <strong>${formatoCOP(c.total_gastado)}</strong></li>
                        <li>Última compra: <strong>${c.nunca_compro ? "Nunca ha comprado" : `${formatoFecha(c.ultimo_pedido)} (${textoHace(c.dias_sin_comprar)})`}</strong></li>
                    </ul>
                </div>
            </div>

            <h6 class="fw-bold text-uppercase text-muted small">Pedidos</h6>
            ${r.pedidos.length ? `
            <div class="table-responsive">
                <table class="table table-sm table-hover align-middle">
                    <thead class="table-light">
                        <tr><th>N°</th><th>Fecha</th><th>Estado</th><th>Productos</th><th>Entrega</th><th>Pago</th><th>Total</th></tr>
                    </thead>
                    <tbody>${filasPedidos}</tbody>
                </table>
            </div>` : `<p class="text-muted">Este cliente aún no ha realizado pedidos.</p>`}
        `;
    }

    // ---------- Deshabilitar inactivos (masivo) ----------
    const modalInactivosEl = document.getElementById("modal-inactivos");

    function candidatosInactivos() {
        const dias = parseInt(document.getElementById("inactivos-dias").value, 10);
        return clientesCache.filter((c) => c.activo && c.dias_sin_comprar >= dias);
    }

    function renderCandidatosInactivos() {
        const lista = candidatosInactivos();
        const tbody = document.getElementById("inactivos-lista");
        const botonConfirmar = document.getElementById("btn-confirmar-inactivos");

        document.getElementById("inactivos-todos").checked = true;

        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">No hay clientes activos que cumplan ese tiempo sin comprar.</td></tr>`;
            botonConfirmar.disabled = true;
            return;
        }

        botonConfirmar.disabled = false;
        tbody.innerHTML = lista.map((c) => `
            <tr>
                <td><input type="checkbox" class="form-check-input check-inactivo" value="${c.id}" checked></td>
                <td>
                    <div class="fw-semibold">${escaparHtml(c.nombre)}</div>
                    <div class="small text-muted">${escaparHtml(c.correo)}</div>
                </td>
                <td>${c.nunca_compro
                    ? `Nunca compró <span class="small text-muted">(registrado ${textoHace(c.dias_sin_comprar)})</span>`
                    : `${formatoFecha(c.ultimo_pedido)} <span class="small text-muted">(${textoHace(c.dias_sin_comprar)})</span>`}</td>
            </tr>
        `).join("");
    }

    document.getElementById("btn-desactivar-inactivos").addEventListener("click", async () => {
        if (!clientesCargados) await cargarClientes();
        if (!clientesCargados) return; // hubo un aviso de conexión/sesión

        // Usa el mismo umbral que la tabla
        document.getElementById("inactivos-dias").value = String(umbralClientes());
        renderCandidatosInactivos();
        bootstrap.Modal.getOrCreateInstance(modalInactivosEl).show();
    });

    document.getElementById("inactivos-dias").addEventListener("change", renderCandidatosInactivos);

    document.getElementById("inactivos-todos").addEventListener("change", (e) => {
        document.querySelectorAll(".check-inactivo").forEach((chk) => { chk.checked = e.target.checked; });
    });

    document.getElementById("btn-confirmar-inactivos").addEventListener("click", async () => {
        const ids = [...document.querySelectorAll(".check-inactivo:checked")].map((chk) => parseInt(chk.value, 10));
        const dias = parseInt(document.getElementById("inactivos-dias").value, 10);

        if (ids.length === 0) {
            sfToast("aviso", "Selecciona al menos un cliente");
            return;
        }

        const si = await sfConfirmar({
            tipo: "aviso", icono: "fa-users-slash",
            titulo: "Deshabilitar cuentas inactivas",
            texto: `Se deshabilitarán <span class="sf-etiqueta">${ids.length}</span> cuenta(s) con más de ${dias} días sin comprar.` +
                   `<div class="sf-nota">Podrás volver a habilitarlas cuando quieras.</div>`,
            confirmar: "Deshabilitar", cancelar: "Cancelar"
        });
        if (!si) return;

        const boton = document.getElementById("btn-confirmar-inactivos");
        boton.disabled = true;

        const r = await llamarClientes(sfApiPost("clientes.php", { accion: "desactivar_inactivos", dias, ids }));

        boton.disabled = false;

        if (!r) {
            bootstrap.Modal.getInstance(modalInactivosEl).hide();
            return;
        }

        if (r.ok === false) {
            sfAlerta("error", "No se pudo completar la acción", escaparHtml(r.mensaje || ""));
            return;
        }

        bootstrap.Modal.getInstance(modalInactivosEl).hide();
        sfToast("exito", "Cuentas deshabilitadas", escaparHtml(r.mensaje || ""), { icono: "fa-users-slash" });
        await cargarClientesSinBorrarAviso();
    });

    // Recarga la lista conservando el aviso de éxito que se acaba de mostrar
    async function cargarClientesSinBorrarAviso() {
        const r = await sfApiGet("clientes.php");
        if (r && r.ok) {
            clientesCache = r.clientes || [];
            renderClientes();
        }
    }

    // =====================================================
    // RENDER GENERAL
    // =====================================================
    async function renderTodo() {
        await renderTarjetasResumen();
        await renderInventario();
        await renderPedidos();
        await renderMasVendidos();
        await renderEstadisticas();
        await renderAgotados();
        await renderInformeQuincenal();
    }

    renderTodo();
});
