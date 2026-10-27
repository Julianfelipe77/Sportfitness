// ===================================
// SPORT+FITNESS - Alertas bonitas (SweetAlert2)
// ===================================
// Un único lugar para todas las alertas del sitio. Usa la librería
// SweetAlert2 (se carga por CDN en cada página, antes de este archivo)
// y expone cuatro funciones sencillas:
//
//   sfToast(tipo, titulo, texto?)        -> aviso corto que se va solo
//   sfAlerta(tipo, titulo, texto?, op?)  -> ventana de mensaje (Promise)
//   sfConfirmar({ ... })                 -> pregunta Sí/No (Promise<boolean>)
//   sfCargando(titulo?) / sfCerrarAlerta()
//
// Dos estilos según quién las ve:
//   · CLIENTE (tienda)  -> cálido, redondeado, verde de la marca.
//   · ADMIN (panel)     -> sobrio, oscuro y compacto, con colores que
//                          indican la gravedad de la acción
//                          (verde = ok, ámbar = cuidado, rojo = destructivo).
//
// Si la librería no pudiera cargarse (sin internet, bloqueador, etc.)
// todo cae a alert()/confirm() nativos para que NADA se rompa.
//
// Tipos: exito | error | aviso | info | pregunta | peligro
// ===================================

const SF_ES_ADMIN = !!document.getElementById("panel-admin");

// Icono de Font Awesome + color por tipo
const SF_TIPOS_ALERTA = {
    exito:    { icono: "fa-circle-check",         color: "#198754", swal: "success"  },
    error:    { icono: "fa-circle-xmark",         color: "#dc3545", swal: "error"    },
    aviso:    { icono: "fa-triangle-exclamation", color: "#f59f00", swal: "warning"  },
    info:     { icono: "fa-circle-info",          color: "#0d6efd", swal: "info"     },
    pregunta: { icono: "fa-circle-question",      color: "#198754", swal: "question" },
    peligro:  { icono: "fa-trash-can",            color: "#dc3545", swal: "warning"  }
};

function sfLibreriaLista() {
    return typeof Swal !== "undefined";
}

// Quita etiquetas para el modo de respaldo (alert/confirm nativos)
function sfTextoPlano(html) {
    const div = document.createElement("div");
    div.innerHTML = String(html || "").replace(/<br\s*\/?>/gi, "\n");
    return div.textContent || "";
}

function sfTema() {
    return SF_ES_ADMIN ? "sf-admin" : "sf-cliente";
}

function sfIconoHtml(tipo, iconoPersonalizado) {
    const t = SF_TIPOS_ALERTA[tipo] || SF_TIPOS_ALERTA.info;
    const icono = iconoPersonalizado || t.icono;
    // Los iconos de marca (p. ej. WhatsApp) ya traen su propia familia
    const familia = /fa-(brands|regular|solid)/.test(icono) ? "" : "fa-solid ";
    return `<i class="${familia}${icono}"></i>`;
}

// Opciones base compartidas por todas las alertas
function sfBase(tipo, iconoPersonalizado) {
    const t = SF_TIPOS_ALERTA[tipo] || SF_TIPOS_ALERTA.info;
    return {
        iconHtml: sfIconoHtml(tipo, iconoPersonalizado),
        iconColor: t.color,
        buttonsStyling: false,
        showClass: { popup: "sf-entra" },
        hideClass: { popup: "sf-sale" },
        customClass: {
            container: sfTema(),
            popup: `sf-popup sf-tipo-${tipo}`,
            icon: `sf-icono sf-icono-${tipo}`,
            title: "sf-titulo",
            htmlContainer: "sf-texto",
            actions: "sf-acciones",
            confirmButton: `sf-btn sf-btn-confirmar sf-btn-${tipo}`,
            cancelButton: "sf-btn sf-btn-cancelar",
            denyButton: "sf-btn sf-btn-extra",
            timerProgressBar: "sf-progreso"
        }
    };
}

// ---------- Toast: aviso corto, no bloquea ----------
function sfToast(tipo, titulo, texto, opciones = {}) {
    if (!sfLibreriaLista()) {
        console.log(`[${tipo}] ${titulo}${texto ? " - " + sfTextoPlano(texto) : ""}`);
        return Promise.resolve();
    }

    const base = sfBase(tipo, opciones.icono);

    return Swal.fire({
        ...base,
        toast: true,
        position: SF_ES_ADMIN ? "top-end" : "top",
        title: titulo,
        html: texto || undefined,
        showConfirmButton: false,
        showCloseButton: true,
        timer: opciones.duracion || (tipo === "error" ? 6000 : 3500),
        timerProgressBar: true,
        didOpen: (el) => {
            el.addEventListener("mouseenter", Swal.stopTimer);
            el.addEventListener("mouseleave", Swal.resumeTimer);
        },
        customClass: { ...base.customClass, popup: `sf-toast sf-tipo-${tipo}` }
    });
}

// ---------- Alerta: ventana de mensaje ----------
// opciones: { boton, icono, html, timer, extra: { texto, href } }
function sfAlerta(tipo, titulo, texto, opciones = {}) {
    if (!sfLibreriaLista()) {
        alert(titulo + (texto ? "\n\n" + sfTextoPlano(texto) : ""));
        return Promise.resolve({ isConfirmed: true });
    }

    const base = sfBase(tipo, opciones.icono);
    const config = {
        ...base,
        title: titulo,
        html: texto || undefined,
        confirmButtonText: opciones.boton || "Entendido",
        allowOutsideClick: opciones.cerrarFuera !== false,
        focusConfirm: true
    };

    if (opciones.timer) {
        config.timer = opciones.timer;
        config.timerProgressBar = true;
        config.showConfirmButton = opciones.mostrarBoton !== false;
    }

    if (opciones.extra) {
        config.showDenyButton = true;
        config.denyButtonText = opciones.extra.texto;
        config.preDeny = () => {
            if (opciones.extra.href) window.location.href = opciones.extra.href;
            return false;
        };
    }

    return Swal.fire(config);
}

// ---------- Confirmar: pregunta Sí/No ----------
// { titulo, texto, tipo, icono, confirmar, cancelar }
// Devuelve una Promise<boolean>.
function sfConfirmar(o) {
    const tipo = o.tipo || "pregunta";

    if (!sfLibreriaLista()) {
        return Promise.resolve(confirm(o.titulo + (o.texto ? "\n\n" + sfTextoPlano(o.texto) : "")));
    }

    const base = sfBase(tipo, o.icono);

    return Swal.fire({
        ...base,
        title: o.titulo,
        html: o.texto || undefined,
        showCancelButton: true,
        confirmButtonText: o.confirmar || "Sí, continuar",
        cancelButtonText: o.cancelar || "Cancelar",
        reverseButtons: true,
        focusCancel: tipo === "peligro",
        allowOutsideClick: false
    }).then((r) => r.isConfirmed);
}

// ---------- Cargando ----------
function sfCargando(titulo = "Procesando...") {
    if (!sfLibreriaLista()) return;
    Swal.fire({
        ...sfBase("info"),
        title: titulo,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        iconHtml: '<span class="sf-spinner"></span>'
    });
}

function sfCerrarAlerta() {
    if (sfLibreriaLista()) Swal.close();
}

// Escapa texto de usuario antes de ponerlo dentro del HTML de una alerta
function sfEsc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}
