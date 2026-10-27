// ===================================
// SPORT+FITNESS - Formulario de contacto
// ===================================
// El sitio no tiene servidor de correo, así que el formulario de
// contacto arma el mensaje y lo abre directo en WhatsApp, al mismo
// número de ventas de la tienda (SF_WHATSAPP_NUMERO, definido en
// script.js).

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-contacto");
    if (!form) return;


    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const nombre = document.getElementById("contacto-nombre").value.trim();
        const correo = document.getElementById("contacto-correo").value.trim();
        const asunto = document.getElementById("contacto-asunto").value.trim();
        const mensajeTexto = document.getElementById("contacto-mensaje").value.trim();

        if (!nombre || !correo || !mensajeTexto) {
            sfToast("aviso", "Faltan datos", "Completa tu nombre, correo y mensaje.");
            return;
        }

        const mensaje =
            `📩 *Mensaje de contacto - Sport+Fitness*\n\n` +
            `*Nombre:* ${nombre}\n` +
            `*Correo:* ${correo}\n` +
            (asunto ? `*Asunto:* ${asunto}\n` : "") +
            `\n${mensajeTexto}`;

        const urlWhatsApp = `https://wa.me/${SF_WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
        window.open(urlWhatsApp, "_blank");

        form.reset();
        sfAlerta("exito", "¡Mensaje listo para enviar!",
            "Abrimos WhatsApp con tu mensaje. Solo falta que presiones enviar y te respondemos pronto.",
            { icono: "fa-brands fa-whatsapp", boton: "Perfecto" });
    });
});
