// monitor/js/config.js
// ==============================
// Producción: tu instancia pública en AWS.
export const API_BASE = "http://54.205.178.208:5500";   // Flask REST (EC2)
export const WS_URL   = "ws://54.205.178.208:5501/ws";  // WebSocket PUSH

// Intervalo de auto-refresco (ms)
export const AUTO_REFRESH_MS = 5000;

// Dispositivo por defecto si no hay uno guardado
export const DEFAULT_DEVICE_ID = 1;

// ====== Formato de fecha/hora para UI (Pachuca, MX en español) ======
export const DATE_LOCALE = "es-MX";
export const DATE_TZ = "America/Mexico_City";
export const DATE_FORMAT_OPTIONS = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: DATE_TZ
};

// ---------- Alternativas locales (comentado) ----------
// export const API_BASE = "http://127.0.0.1:5500";
// export const WS_URL   = "ws://127.0.0.1:5501/ws";
