// monitor/js/main.js
import {
  API_BASE, WS_URL, DEFAULT_DEVICE_ID, AUTO_REFRESH_MS,
  DATE_LOCALE, DATE_FORMAT_OPTIONS
} from "./config.js";

/* =======================
   Estado + referencias DOM
   ======================= */
let dispositivoId = Number(localStorage.getItem("device_id") || DEFAULT_DEVICE_ID);
let autoTimer = null;

const estadoEl    = document.getElementById("estado");
const lastUpdate  = document.getElementById("lastUpdate");
const wsStatus    = document.getElementById("wsStatus");
const tblMovs     = document.getElementById("tblMovs");
const tblObs      = document.getElementById("tblObs");
const tblRutas    = document.getElementById("tblRutas");
const deviceInput = document.getElementById("deviceIdInput");
const btnSetDev   = document.getElementById("btnSetDevice");
const btnRefresh  = document.getElementById("btnRefresh");
const autoToggle  = document.getElementById("autoToggle");

/* =======================
   Utilidades
   ======================= */
function setEstado(txt, color = "#555") {
  if (!estadoEl) return;
  estadoEl.textContent = (txt || "").toUpperCase();
  estadoEl.style.color = color;
}
function setUpdated() {
  if (!lastUpdate) return;
  const now = new Date();
  lastUpdate.textContent = `Última actualización: ${now.toLocaleString(DATE_LOCALE, DATE_FORMAT_OPTIONS)}`;
}
function setRows(tbody, rows) {
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows?.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-muted">Sin datos…</td></tr>`;
    return;
  }
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = r.__html;
    tbody.appendChild(tr);
  });
}
async function getJSON(url) {
  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
  return data;
}

/* ======== Conversión/orden de fechas ======== */
/** Convierte un valor de BD "YYYY-MM-DD HH:mm:ss" (o ISO)
 *  a Date asumiéndolo en UTC y lo podremos formatear a MX. */
function parseDbToDate(value) {
  if (value === null || value === undefined) return null;
  let s = String(value).trim();
  if (!s) return null;
  // Soportar "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DDTHH:mm:ssZ"
  if (s.length === 19 && s.indexOf(" ") === 10) {
    s = s.replace(" ", "T") + "Z";
  }
  // Si viene con milisegundos sin zona, agrégale 'Z'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s += "Z";
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function fmtLocal(value) {
  const d = parseDbToDate(value);
  if (!d) return "";
  return d.toLocaleString(DATE_LOCALE, DATE_FORMAT_OPTIONS);
}
function sortDescByField(arr, field) {
  return [...(arr || [])].sort((a, b) => {
    const da = parseDbToDate(a?.[field])?.getTime() ?? 0;
    const db = parseDbToDate(b?.[field])?.getTime() ?? 0;
    return db - da; // más nuevo arriba
  });
}

/* =======================
   Cargas de datos
   ======================= */
async function loadMovs() {
  try {
    const data = await getJSON(`${API_BASE}/api/movimientos/ultimos?dispositivo_id=${dispositivoId}`);
    const items = sortDescByField(data.data, "fecha_hora");
    const rows = items.map((row, idx) => ({
      __html: `
        <td>${idx + 1}</td>
        <td>${row?.status_texto ?? "-"}</td>
        <td>${fmtLocal(row?.fecha_hora)}</td>
      `
    }));
    setRows(tblMovs, rows);
  } catch (e) {
    console.error("[loadMovs] ", e);
    setEstado(`ERROR MOVS: ${e.message}`, "#b91c1c");
    setRows(tblMovs, []);
  }
}

async function loadObs() {
  try {
    const data = await getJSON(`${API_BASE}/api/obstaculos/ultimos?dispositivo_id=${dispositivoId}`);
    const items = sortDescByField(data.data, "fecha_hora");
    const rows = items.map((row, idx) => ({
      __html: `
        <td>${idx + 1}</td>
        <td>${row?.status_texto ?? "-"}</td>
        <td>${fmtLocal(row?.fecha_hora)}</td>
      `
    }));
    setRows(tblObs, rows);
  } catch (e) {
    console.error("[loadObs] ", e);
    setEstado(`ERROR OBS: ${e.message}`, "#b91c1c");
    setRows(tblObs, []);
  }
}

async function loadRutas() {
  try {
    const data = await getJSON(`${API_BASE}/api/rutas/ultimas?dispositivo_id=${dispositivoId}`);
    const items = sortDescByField(data.data, "fecha_creacion");
    const rows = items.map((row) => ({
      __html: `
        <td>${row?.secuencia_id ?? "-"}</td>
        <td>${row?.nombre_secuencia || "-"}</td>
        <td>${fmtLocal(row?.fecha_creacion)}</td>
      `
    }));
    setRows(tblRutas, rows);
  } catch (e) {
    console.error("[loadRutas] ", e);
    setEstado(`ERROR RUTAS: ${e.message}`, "#b91c1c");
    setRows(tblRutas, []);
  }
}

async function refreshAll() {
  await Promise.all([loadMovs(), loadObs(), loadRutas()]);
  setUpdated();
  setEstado(`Mostrando dispositivo ${dispositivoId}`, "#0d9488");
}

/* =======================
   Selector de dispositivo
   ======================= */
(function initDeviceSelector() {
  if (deviceInput) deviceInput.value = String(dispositivoId || "");
  btnSetDev?.addEventListener("click", async () => {
    const v = Number(deviceInput?.value || 0);
    if (!v || v < 1) { setEstado("ID INVÁLIDO", "#b91c1c"); return; }
    dispositivoId = v;
    localStorage.setItem("device_id", String(dispositivoId));
    setEstado(`Mostrando dispositivo ${dispositivoId}`, "#0d9488");
    await refreshAll();
  });
})();

/* =======================
   Refresco manual / auto
   ======================= */
btnRefresh?.addEventListener("click", refreshAll);
autoToggle?.addEventListener("change", () => {
  if (autoToggle.checked) startAuto(); else stopAuto();
});
function startAuto() { stopAuto(); autoTimer = setInterval(refreshAll, AUTO_REFRESH_MS); }
function stopAuto()  { if (autoTimer) clearInterval(autoTimer); autoTimer = null; }

/* =======================
   WebSocket (PUSH)
   ======================= */
(function connectWS() {
  if (!WS_URL) { wsStatus && (wsStatus.textContent = "desactivado"); return; }
  try {
    const ws = new WebSocket(WS_URL);
    ws.onopen    = () => { wsStatus && (wsStatus.textContent = "conectado"); ws.send(JSON.stringify({ type: "ping" })); };
    ws.onclose   = () => { wsStatus && (wsStatus.textContent = "cerrado"); };
    ws.onerror   = () => { wsStatus && (wsStatus.textContent = "error");  };
    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (["movimiento.insertado","obstaculo.detectado","ruta.paso_ejecutado","evasion.ejecutada"].includes(msg?.type)) {
          await refreshAll();
        }
      } catch (err) {
        console.warn("WS message parse error:", err);
      }
    };
  } catch {
    wsStatus && (wsStatus.textContent = "no disponible");
  }
})();

/* =======================
   Inicial
   ======================= */
refreshAll();
startAuto();
