// js/main.js (ESM)
// Control + Secuencias + Selector de dispositivo + Simulación de obstáculo/evasión
import { API_BASE, WS_URL, DEFAULT_DEVICE_ID } from "./config.js";

// =================== Estado global ===================
let DISPOSITIVO_ID = Number(localStorage.getItem("device_id") || DEFAULT_DEVICE_ID);

// Catálogo local (para textos bonitos)
const operaciones = {
  1: "Adelante", 2: "Atrás", 3: "Detener",
  4: "Vuelta adelante derecha", 5: "Vuelta adelante izquierda",
  6: "Vuelta atrás derecha", 7: "Vuelta atrás izquierda",
  8: "Giro 90° derecha", 9: "Giro 90° izquierda",
  10: "Giro 360° derecha", 11: "Giro 360° izquierda"
};

// =================== Utilidades ===================
const estadoEl = document.getElementById("estado");
function setEstado(texto, color = "#555") {
  if (!estadoEl) return;
  estadoEl.textContent = (texto || "").toUpperCase();
  estadoEl.style.color = color;
}

async function postJSON(url, body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${resp.status}`);
  }
  return data;
}

// =================== Selector de dispositivo ===================
const deviceIdInput = document.getElementById("deviceIdInput");
const deviceIpInput = document.getElementById("deviceIpInput");
const btnSetDevice  = document.getElementById("btnSetDevice");

function pintarDeviceActual() {
  if (deviceIdInput) deviceIdInput.value = String(DISPOSITIVO_ID || "");
}
pintarDeviceActual();

btnSetDevice?.addEventListener("click", async () => {
  const id = Number(deviceIdInput?.value || 0);
  if (!id || id < 1) {
    setEstado("ID DE DISPOSITIVO INVÁLIDO", "#b91c1c");
    return;
  }
  DISPOSITIVO_ID = id;
  localStorage.setItem("device_id", String(DISPOSITIVO_ID));
  setEstado(`USANDO DISPOSITIVO ${DISPOSITIVO_ID}`, "#0d9488");
  await cargarSecuencias(); // refresca listas ligadas a dispositivo
});

// =================== Control manual ===================
async function enviarManual(status_clave) {
  const texto = operaciones[status_clave] || `Op ${status_clave}`;
  
  // === INICIO MODIFICACIÓN: Leer velocidad ===
  // (Esto también soluciona tu error 'VELOCIDADNIVEL IS NOT DEFINED')
  let velocidadNivel = 180; // Default por si acaso
  const velChecked = document.querySelector('input[name="velocidadNivel"]:checked');
  if (velChecked) {
    velocidadNivel = Number(velChecked.value);
  }
  // === FIN MODIFICACIÓN ===

  try {
    setEstado(texto, "#6b63ff");
    
    // === INICIO MODIFICACIÓN: Enviar velocidad a la API ===
    await postJSON(`${API_BASE}/api/movimientos`, {
      dispositivo_id: DISPOSITIVO_ID,
      status_clave: Number(status_clave),
      velocidad_pwm: velocidadNivel // Enviamos el nuevo dato
    });
    // === FIN MODIFICACIÓN ===
    
    // Mostramos la velocidad en el feedback
    setEstado(`${texto} ✓ (Vel: ${velocidadNivel})`, "#2e7d32");
    
  } catch (e) {
    console.error(e);
    setEstado(`ERROR: ${e.message}`, "#b91c1c");
  }
}

document.querySelectorAll(".btn-circle, .btn-square").forEach((btn) => {
  btn.addEventListener("click", () => {
    const clave = Number(btn.getAttribute("data-status"));
    if (!clave) return;
    btn.classList.add("active");
    setTimeout(() => btn.classList.remove("active"), 150);

    enviarManual(clave);
    if (grabando) pushPaso(clave);
  });
});

// =================== Obstáculo / Evasión ===================
const obstacleType = document.getElementById("obstacleType");
const btnObstacle  = document.getElementById("btnObstacle");
const obsMsg       = document.getElementById("obsMsg");

btnObstacle?.addEventListener("click", async () => {
  if (!obsMsg) return;
  obsMsg.textContent = ""; obsMsg.className = "msg";

  const obstaculo_clave = Number(obstacleType?.value || 1);
  try {
    // 1) Registrar evento de obstáculo
    await postJSON(`${API_BASE}/api/obstaculos`, {
      dispositivo_id: DISPOSITIVO_ID,
      status_clave: obstaculo_clave
    });
    obsMsg.textContent = `Obstáculo ${obstaculo_clave} registrado… planeando evasión`;
    obsMsg.classList.add("ok");
    setEstado("OBSTÁCULO DETECTADO", "#b45309");

    // 2) Ejecutar maniobra de evasión (debe existir configurada en BD)
    await postJSON(`${API_BASE}/api/evasion/ejecutar`, {
      dispositivo_id: DISPOSITIVO_ID,
      obstaculo_clave
    });
    setEstado("EVASIÓN EJECUTADA ✓", "#2e7d32");
    obsMsg.textContent = `Evasión ejecutada para obstáculo ${obstaculo_clave}`;
  } catch (e) {
    console.error(e);
    setEstado(`ERROR EVASIÓN: ${e.message}`, "#b91c1c");
    obsMsg.textContent = `Error: ${e.message}`;
    obsMsg.classList.add("err");
  }
});

// =================== Secuencias (grabar/guardar/listar/ejecutar) ===================
let grabando = false;
let bufferPasos = []; // [{status:<int>}]

const btnStartRec = document.getElementById("btnStartRec");
const btnStopRec  = document.getElementById("btnStopRec");
const badgeRec    = document.getElementById("recBadge");
const seqForm     = document.getElementById("seqForm");
const seqName     = document.getElementById("seqName");
const seqDesc     = document.getElementById("seqDesc");
const btnSaveSeq  = document.getElementById("btnSaveSeq");
const seqSaveMsg  = document.getElementById("seqSaveMsg");
const seqPreview  = document.getElementById("seqPreview");

btnStartRec?.addEventListener("click", () => {
  grabando = true;
  bufferPasos = [];
  badgeRec?.classList.remove("hidden");
  if (badgeRec) badgeRec.textContent = "Grabando… 0 pasos";
  btnStartRec.disabled = true;
  btnStopRec.disabled = false;
  seqForm?.classList.add("hidden");
  if (seqPreview) seqPreview.innerHTML = "";
});

btnStopRec?.addEventListener("click", () => {
  grabando = false;
  btnStartRec.disabled = false;
  btnStopRec.disabled = true;
  seqForm?.classList.remove("hidden");
});

function pushPaso(status) {
  bufferPasos.push({ status: Number(status) });
  if (badgeRec) badgeRec.textContent = `Grabando… ${bufferPasos.length} paso(s)`;
  if (seqPreview) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = operaciones[status] || status;
    seqPreview.appendChild(pill);
  }
}

btnSaveSeq?.addEventListener("click", async () => {
  if (!seqSaveMsg) return;
  seqSaveMsg.textContent = ""; seqSaveMsg.className = "msg";
  const nombre = (seqName?.value || "").trim();
  const descripcion = (seqDesc?.value || "").trim(); // solo UI
  if (!nombre) { seqSaveMsg.textContent = "Falta nombre"; seqSaveMsg.classList.add("err"); return; }
  if (!bufferPasos.length) { seqSaveMsg.textContent = "No hay pasos grabados"; seqSaveMsg.classList.add("err"); return; }

  try {
    for (let i = 0; i < bufferPasos.length; i++) {
      const paso = bufferPasos[i];
      await postJSON(`${API_BASE}/api/rutas/paso`, {
        dispositivo_id: DISPOSITIVO_ID,
        nombre_secuencia: nombre,
        status_clave: paso.status,
        orden: i + 1
      });
    }
    seqSaveMsg.textContent = `Secuencia "${nombre}" guardada (${bufferPasos.length} pasos)`;
    seqSaveMsg.classList.add("ok");
    if (seqName) seqName.value = "";
    if (seqDesc) seqDesc.value = "";
    bufferPasos = [];
    badgeRec?.classList.add("hidden");
    await cargarSecuencias();
  } catch (e) {
    console.error(e);
    seqSaveMsg.textContent = `Error: ${e.message}`;
    seqSaveMsg.classList.add("err");
  }
});

// ===== Listado y ejecución =====
const btnReloadSeq = document.getElementById("btnReloadSeq");
const btnRunSeq    = document.getElementById("btnRunSeq");
const btnStopAuto  = document.getElementById("btnStopAuto");
const seqSelect    = document.getElementById("seqSelect");
const seqRunMsg    = document.getElementById("seqRunMsg");

btnReloadSeq?.addEventListener("click", cargarSecuencias);

async function cargarSecuencias() {
  if (!seqSelect) return;
  seqSelect.innerHTML = "";
  try {
    const resp = await fetch(`${API_BASE}/api/rutas/ultimas?dispositivo_id=${DISPOSITIVO_ID}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || resp.status);
    (data.data || []).forEach(row => {
      const opt = document.createElement("option");
      opt.value = row.secuencia_id;
      const nombre = row.nombre_secuencia || row.nombre || `Sec ${row.secuencia_id}`;
      opt.textContent = `${row.secuencia_id} – ${nombre}`;
      seqSelect.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
}
cargarSecuencias();

// Ejecutar secuencia con /api/rutas/repetir en loop
let autoTimer = null;
btnRunSeq?.addEventListener("click", async () => {
  if (!seqRunMsg || !seqSelect) return;
  seqRunMsg.textContent = ""; seqRunMsg.className = "msg";
  const secuencia_id = Number(seqSelect.value);
  if (!secuencia_id) { seqRunMsg.textContent = "Selecciona una secuencia"; seqRunMsg.classList.add("err"); return; }

  let orden_actual = 0;
  seqRunMsg.textContent = "Ejecutando…"; seqRunMsg.classList.add("ok");

  if (autoTimer) clearTimeout(autoTimer);

  const loop = async () => {
    try {
      const r = await postJSON(`${API_BASE}/api/rutas/repetir`, {
        dispositivo_id: DISPOSITIVO_ID, secuencia_id, orden_actual
      });
      const arr = r?.data || r;
      const paso = Array.isArray(arr) && arr.length ? arr[0] : null;
      if (!paso) throw new Error("Fin de la secuencia");
      orden_actual = Number(paso.orden_ejecutado ?? (orden_actual + 1));
      setEstado(paso.descripcion || operaciones[paso.status_clave] || "Paso", "#6b63ff");
      autoTimer = setTimeout(loop, 800);
    } catch (e) {
      seqRunMsg.textContent = "Secuencia finalizada ✓";
      seqRunMsg.classList.add("ok");
    }
  };
  loop();
});

btnStopAuto?.addEventListener("click", () => {
  if (autoTimer) clearTimeout(autoTimer);
  setEstado("DETENER", "#374151");
  if (seqRunMsg) { seqRunMsg.textContent = "Automático detenido"; seqRunMsg.classList.add("ok"); }
});

// =================== WebSocket (opcional) ===================
(function connectWS() {
  if (!WS_URL) return;
  try {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => ws.send(JSON.stringify({ type: "ping" }));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg?.type === "movimiento.insertado") {
          const c = msg.payload?.status_clave;
          // Mostramos la velocidad recibida por WS si existe
          const v = msg.payload?.velocidad_pwm;
          const vTxt = v ? ` (Vel: ${v})` : "";
          setEstado((operaciones[c] || "MOV") + vTxt, "#0d9488");
        } else if (msg?.type === "ruta.paso_ejecutado") {
          setEstado("PASO EJECUTADO", "#0d9488");
        } else if (msg?.type === "obstaculo.detectado") {
          setEstado("OBSTÁCULO", "#b45309");
        } else if (msg?.type === "evasion.ejecutada") {
          setEstado("EVASIÓN COMPLETADA", "#059669");
        }
      } catch {}
    };
    ws.onerror = () => {};
  } catch {}
})();