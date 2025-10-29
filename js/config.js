// js/config.js
// ==============================
// Producción: apunta a tu instancia pública en AWS.
export const API_BASE = "http://54.205.178.208:5500";   // Flask REST (EC2)
export const WS_URL   = "ws://54.205.178.208:5501/ws";  // WebSocket PUSH (opcional)

// Si en algún momento quieres volver a probar en local, deja abajo tus valores locales:
// export const API_BASE = "http://127.0.0.1:5500";
// export const WS_URL   = "ws://127.0.0.1:5501/ws";

// Dispositivo por defecto si no hay uno guardado:
export const DEFAULT_DEVICE_ID = 1;
