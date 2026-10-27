// ===================================
// SPORT+FITNESS - Puente con la API PHP
// ===================================
// Este archivo es la ÚNICA parte que sabe hablar con el backend
// PHP (carpeta /api). El resto de scripts (script.js, auth.js,
// carrito.js, admin.js) llaman a sfApiFetch() y, si la respuesta
// es null, simplemente siguen funcionando con localStorage como
// ya hacían antes — por eso la app nunca se rompe sin conexión
// ni sin servidor PHP.
// ===================================

const SF_API_BASE = "api/";
const SF_API_TIMEOUT_MS = 4000;

// Se actualiza en cada intento de red y se puede leer desde
// cualquier página para, por ejemplo, mostrar un aviso de "modo sin
// conexión" si se quiere en el futuro.
let SF_MODO_OFFLINE = false;

/**
 * Hace una petición a la API con tiempo máximo de espera.
 * Devuelve el JSON de la respuesta si todo salió bien y
 * ok === true, o null en cualquier otro caso (sin internet,
 * servidor apagado, error 4xx/5xx, JSON inválido, CORS, etc).
 * Nunca lanza una excepción hacia quien la llama.
 */
async function sfApiFetch(recurso, opciones = {}) {
    if (typeof fetch !== "function") {
        SF_MODO_OFFLINE = true;
        return null;
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), SF_API_TIMEOUT_MS);

    try {
        const respuesta = await fetch(SF_API_BASE + recurso, {
            ...opciones,
            signal: controlador.signal,
            headers: { "Content-Type": "application/json", ...(opciones.headers || {}) }
        });

        clearTimeout(temporizador);

        if (!respuesta.ok && respuesta.status !== 409 && respuesta.status !== 401 && respuesta.status !== 422) {
            SF_MODO_OFFLINE = true;
            return null;
        }

        const datos = await respuesta.json();
        SF_MODO_OFFLINE = false;
        return datos;
    } catch (error) {
        // Sin conexión a internet, servidor PHP no disponible,
        // dominio no accesible con file://, tiempo agotado, etc.
        clearTimeout(temporizador);
        SF_MODO_OFFLINE = true;
        return null;
    }
}

function sfApiGet(recurso) {
    return sfApiFetch(recurso, { method: "GET" });
}

function sfApiPost(recurso, body) {
    return sfApiFetch(recurso, { method: "POST", body: JSON.stringify(body) });
}

function sfApiPut(recurso, body) {
    return sfApiFetch(recurso, { method: "PUT", body: JSON.stringify(body) });
}

function sfApiDelete(recurso) {
    return sfApiFetch(recurso, { method: "DELETE" });
}
