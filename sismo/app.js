// ============================================================
// SISMOPANAMA - Aplicación principal
// © LMM Ingeniería 2026
// ============================================================

// Definición de proyección UTM 17N (WGS84) - mismo CRS del REP-21
proj4.defs("EPSG:32617", "+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs");

const latLngToUTM = (lat, lng) => {
  const [e, n] = proj4("EPSG:4326", "EPSG:32617", [lng, lat]);
  return { e: Math.round(e), n: Math.round(n) };
};
const utmToLatLng = (e, n) => {
  const [lng, lat] = proj4("EPSG:32617", "EPSG:4326", [e, n]);
  return { lat, lng };
};

// ============================================================
// Estado global
// ============================================================
let manager = null;     // RasterManager
let manifest = null;    // Datos de versión
let map = null;         // Leaflet map
let marker = null;      // Marcador del punto consultado
let layerGroup = null;  // Capa de heatmap
let currentLayer = 'ss';
let coordMode = 'geo';
let lastResult = null;  // Último resultado de cálculo (para PDF)
let lastCoord = null;
let spectrumChart = null;

// ============================================================
// INICIALIZACIÓN
// ============================================================
async function init() {
  // Cargar manifest
  try {
    manifest = await fetch('data/manifest.json').then(r => r.json());
    document.getElementById('version-badge').textContent = manifest.active_version;
    document.getElementById('acerca-version').textContent = manifest.active_version;
    document.getElementById('acerca-fecha').textContent = manifest.last_updated;
    renderChangelog();
  } catch (err) {
    console.error('Error cargando manifest:', err);
  }

  // Inicializar mapa
  initMap();

  // Cargar rásters
  try {
    manager = await new RasterManager().loadAll(manifest.active_version);
    document.getElementById('results-pane').innerHTML =
      '<div class="empty-state">Hacé clic en el mapa o ingresá una coordenada.</div>';
    renderHeatmap();
    // Consulta inicial automática
    queryCoord();
  } catch (err) {
    document.getElementById('results-pane').innerHTML =
      '<div class="error-box">Error cargando datos: ' + err.message + '</div>';
  }

  // Setup tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Setup sistemas estructurales
  updateSistemas();

  // Setup version badge
  document.getElementById('version-badge').addEventListener('click', () =>
    showModal('modal-changelog')
  );
}

// ============================================================
// MAPA
// ============================================================
function initMap() {
  map = L.map('map', {
    center: [8.7, -80.5],
    zoom: 7,
    zoomControl: true
  });

  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  });
  const cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19,
    attribution: '© CartoDB'
  });
  const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Esri'
  });

  osmLayer.addTo(map);
  L.control.layers({
    'OpenStreetMap': osmLayer,
    'CartoDB Voyager': cartoLayer,
    'Satélite': satLayer
  }, null, { position: 'topright', collapsed: true }).addTo(map);

  layerGroup = L.layerGroup().addTo(map);

  map.on('click', e => {
    setLatLngInputs(e.latlng.lat, e.latlng.lng);
    queryCoord();
  });
}

// Heatmap con los valores del raster activo
function renderHeatmap() {
  if (!manager || !manager.loaded) return;
  layerGroup.clearLayers();
  const raster = manager.rasters[currentLayer];
  const step = raster.meta.res * 2; // submuestreado para performance
  const { origin_lat, origin_lng, width, height, res } = raster.meta;
  
  // Define escalas de color según el raster activo
  const colorScale = colorScaleFor(currentLayer);
  
  // Renderizar cada 2 píxeles
  for (let row = 0; row < height; row += 2) {
    for (let col = 0; col < width; col += 2) {
      const idx = row * width + col;
      const rawVal = raster.data[idx];
      if (rawVal === 0) continue;
      const sa = rawVal / raster.meta.scale_factor;
      const lat = origin_lat - row * res;
      const lng = origin_lng + col * res;
      L.rectangle(
        [[lat - step/2, lng], [lat + step/2, lng + step]],
        {
          color: colorScale(sa),
          weight: 0,
          fillOpacity: 0.4,
          interactive: false
        }
      ).addTo(layerGroup);
    }
  }
  updateLegend();
}

function colorScaleFor(layer) {
  let max;
  if (layer === 'ss') max = 2.0;
  else if (layer === 's1') max = 0.8;
  else max = 0.9; // pga
  return function(val) {
    const norm = val / max;
    if (norm < 0.25) return '#fef3c7';
    if (norm < 0.50) return '#fbbf24';
    if (norm < 0.75) return '#f97316';
    if (norm < 1.00) return '#dc2626';
    return '#7f1d1d';
  };
}

function updateLegend() {
  const labels = {
    'ss':  { name: 'Ss (0.2 s)',  vals: ['0.5','1.0','1.5','2.0'] },
    's1':  { name: 'S₁ (1.0 s)',  vals: ['0.2','0.4','0.6','0.8'] },
    'pga': { name: 'PGA (0 s)',   vals: ['0.2','0.4','0.6','0.8'] }
  };
  document.getElementById('legend-period').textContent = labels[currentLayer].name;
  const labelEls = document.querySelectorAll('.legend-labels span');
  labels[currentLayer].vals.forEach((v, i) => labelEls[i].textContent = v);
}

function setLayer(layer, event) {
  currentLayer = layer;
  document.querySelectorAll('.layer-toggle button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderHeatmap();
}

// ============================================================
// COORDENADAS
// ============================================================
function setCoordMode(mode, event) {
  coordMode = mode;
  document.querySelectorAll('.mode-toggle button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('geo-inputs').style.display = mode === 'geo' ? 'grid' : 'none';
  document.getElementById('utm-inputs').style.display = mode === 'utm' ? 'grid' : 'none';
  syncCoords(mode);
}

function syncCoords(mode) {
  if (mode === 'utm') {
    const lat = parseFloat(document.getElementById('lat-input').value);
    const lng = parseFloat(document.getElementById('lng-input').value);
    if (!isNaN(lat) && !isNaN(lng)) {
      const u = latLngToUTM(lat, lng);
      document.getElementById('utm-e-input').value = u.e;
      document.getElementById('utm-n-input').value = u.n;
    }
  } else {
    const e = parseFloat(document.getElementById('utm-e-input').value);
    const n = parseFloat(document.getElementById('utm-n-input').value);
    if (!isNaN(e) && !isNaN(n)) {
      const g = utmToLatLng(e, n);
      document.getElementById('lat-input').value = g.lat.toFixed(4);
      document.getElementById('lng-input').value = g.lng.toFixed(4);
    }
  }
}

function setLatLngInputs(lat, lng) {
  document.getElementById('lat-input').value = lat.toFixed(4);
  document.getElementById('lng-input').value = lng.toFixed(4);
  const u = latLngToUTM(lat, lng);
  document.getElementById('utm-e-input').value = u.e;
  document.getElementById('utm-n-input').value = u.n;
}

function getCurrentLatLng() {
  let lat, lng;
  if (coordMode === 'geo') {
    lat = parseFloat(document.getElementById('lat-input').value);
    lng = parseFloat(document.getElementById('lng-input').value);
    if (isNaN(lat) || isNaN(lng)) return null;
  } else {
    const e = parseFloat(document.getElementById('utm-e-input').value);
    const n = parseFloat(document.getElementById('utm-n-input').value);
    if (isNaN(e) || isNaN(n)) return null;
    const g = utmToLatLng(e, n);
    lat = g.lat; lng = g.lng;
  }
  setLatLngInputs(lat, lng);
  return { lat, lng };
}

// ============================================================
// CONSULTA
// ============================================================
function queryCoord() {
  if (!manager || !manager.loaded) return;
  const coord = getCurrentLatLng();
  if (!coord) return;

  const vals = manager.queryAll(coord.lat, coord.lng);

  if (vals.ss === null) {
    document.getElementById('results-pane').innerHTML =
      '<div class="warning-box">El punto está fuera del territorio de Panamá continental cubierto por los mapas REP-21.</div>';
    return;
  }

  const utm = latLngToUTM(coord.lat, coord.lng);

  // Marcador en mapa
  if (marker) map.removeLayer(marker);
  marker = L.circleMarker([coord.lat, coord.lng], {
    radius: 8,
    color: '#d97706',
    weight: 2,
    fillColor: '#d97706',
    fillOpacity: 0.5
  }).addTo(map);
  marker.bindPopup(
    `<strong>PGA</strong> ${vals.pga.toFixed(3)} g<br>` +
    `<strong>Ss</strong> ${vals.ss.toFixed(3)} g<br>` +
    `<strong>S₁</strong> ${vals.s1.toFixed(3)} g`
  ).openPopup();
  map.setView([coord.lat, coord.lng], Math.max(map.getZoom(), 9));

  // Renderizar resultados
  document.getElementById('results-pane').innerHTML = `
    <div class="result-grid">
      <div class="result-card">
        <div class="label">PGA (T=0)</div>
        <div class="value">${vals.pga.toFixed(3)}<span class="unit">g</span></div>
      </div>
      <div class="result-card">
        <div class="label">Ss (T=0.2)</div>
        <div class="value">${vals.ss.toFixed(3)}<span class="unit">g</span></div>
      </div>
      <div class="result-card">
        <div class="label">S₁ (T=1.0)</div>
        <div class="value">${vals.s1.toFixed(3)}<span class="unit">g</span></div>
      </div>
    </div>
    <div class="info-row"><span class="k">LAT / LONG</span><span class="v">${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}</span></div>
    <div class="info-row"><span class="k">UTM 17N</span><span class="v">${utm.e.toLocaleString('es-PA')}, ${utm.n.toLocaleString('es-PA')}</span></div>
    <div class="info-row"><span class="k">PERÍODO RETORNO</span><span class="v">2500 años</span></div>
    <div class="info-row"><span class="k">CLASE SITIO</span><span class="v">B (referencia)</span></div>
    <div class="info-row"><span class="k">AMORTIGUAMIENTO</span><span class="v">5 %</span></div>
  `;
}

// ============================================================
// TABS
// ============================================================
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

// ============================================================
// SISTEMAS ESTRUCTURALES
// ============================================================
function updateSistemas() {
  const cat = document.getElementById('categoria-sistema').value;
  const sistemaSelect = document.getElementById('sistema');
  sistemaSelect.innerHTML = '';
  const sistemas = SismicCalc.SISTEMAS_ESTRUCTURALES[cat].sistemas;
  Object.entries(sistemas).forEach(([key, info]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${info.nombre} [R=${info.R}]`;
    sistemaSelect.appendChild(opt);
  });
}

// ============================================================
// CÁLCULO Cs
// ============================================================
function calcularCs() {
  if (!manager || !manager.loaded) {
    alert('Los datos aún no han cargado. Esperá un momento.');
    return;
  }
  const coord = getCurrentLatLng();
  if (!coord) {
    alert('Coordenada inválida.');
    return;
  }
  const vals = manager.queryAll(coord.lat, coord.lng);
  if (vals.ss === null) {
    alert('Coordenada fuera del territorio cubierto.');
    return;
  }

  const tipoEstructura = document.getElementById('tipo-estructura').value;
  const claseSitio = document.getElementById('clase-sitio').value;
  const riesgo = document.getElementById('riesgo').value;
  const sistemaKey = document.getElementById('sistema').value;
  const periodo = parseFloat(document.getElementById('periodo').value);

  if (isNaN(periodo) || periodo <= 0) {
    alert('Período debe ser un número positivo.');
    return;
  }

  const input = {
    ss: vals.ss, s1: vals.s1, pga: vals.pga,
    claseSitio, riesgo, sistemaKey, periodo, tipoEstructura
  };

  const result = SismicCalc.calcularSismico(input);

  lastResult = result;
  lastCoord = { ...coord, utm: latLngToUTM(coord.lat, coord.lng) };

  renderCalcResults(result);
}

function renderCalcResults(result) {
  const container = document.getElementById('calc-results-content');
  const section = document.getElementById('calc-results');
  section.style.display = 'block';

  if (!result.valido) {
    container.innerHTML = result.errores.map(e => 
      `<div class="error-box">${e}</div>`).join('');
    document.getElementById('btn-pdf').style.display = 'none';
    document.getElementById('spectrum-section').style.display = 'none';
    return;
  }

  let html = '';
  
  // Cs destacado
  html += `
    <div class="cs-result-card">
      <div class="label">COEFICIENTE SÍSMICO Cs</div>
      <div class="value">${result.Cs.toFixed(4)}</div>
      <div class="sub">Gobierna: límite ${result.Cs_gobierna}</div>
    </div>
  `;

  // Categoría de Diseño Sísmico
  html += `
    <div class="info-row">
      <span class="k">CATEGORÍA DISEÑO SÍSMICO</span>
      <span class="v"><span class="cds-badge">${result.CDS}</span></span>
    </div>
  `;

  // Parámetros calculados
  html += `
    <div class="info-row"><span class="k">Fa</span><span class="v">${result.Fa.toFixed(3)}</span></div>
    <div class="info-row"><span class="k">Fv</span><span class="v">${result.Fv.toFixed(3)}</span></div>
    <div class="info-row"><span class="k">SMS</span><span class="v">${result.SMS.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">SM₁</span><span class="v">${result.SM1.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">SDS</span><span class="v">${result.SDS.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">SD₁</span><span class="v">${result.SD1.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">R</span><span class="v">${result.R.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">Ω₀</span><span class="v">${result.omega.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">Cd</span><span class="v">${result.Cd.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">Ie</span><span class="v">${result.Ie.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">T₀</span><span class="v">${result.T0.toFixed(3)} s</span></div>
    <div class="info-row"><span class="k">Ts</span><span class="v">${result.Ts.toFixed(3)} s</span></div>
    <div class="info-row"><span class="k">TL</span><span class="v">${result.TL.toFixed(1)} s</span></div>
  `;

  // Vivienda - tabla densidad
  if (result.viviendaDensidadMin) {
    html += `
      <div class="warning-box" style="color: var(--accent-soft);">
        <strong>VIVIENDA UNIFAMILIAR:</strong> Densidad mínima de paredes = ${result.viviendaDensidadMin.toFixed(1)}% (REP-21 Cap. 7).
      </div>
    `;
  }

  // Advertencias
  if (result.advertencias.length > 0) {
    html += result.advertencias.map(a =>
      `<div class="warning-box">${a}</div>`).join('');
  }

  container.innerHTML = html;

  // Renderizar espectro
  renderSpectrum(result);
  document.getElementById('spectrum-section').style.display = 'block';
  document.getElementById('btn-pdf').style.display = 'block';
}

function renderSpectrum(result) {
  const puntos = SismicCalc.generarEspectro(
    result.SDS, result.SD1, result.T0, result.Ts, result.TL, 4.0
  );
  const labels = puntos.map(p => p.T.toFixed(2));
  const data = puntos.map(p => p.Sa);

  if (spectrumChart) spectrumChart.destroy();
  const ctx = document.getElementById('spectrum-chart').getContext('2d');
  spectrumChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sa (g)',
        data: data,
        borderColor: '#d97706',
        backgroundColor: 'rgba(217,119,6,0.15)',
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1f26',
          titleColor: '#d97706',
          titleFont: { family: 'IBM Plex Mono', size: 10 },
          bodyFont: { family: 'IBM Plex Mono', size: 11 },
          callbacks: {
            title: c => `T = ${c[0].label} s`,
            label: c => `Sa = ${c.parsed.y.toFixed(3)} g`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Período T (s)', color: '#8b95a3', font: { family: 'IBM Plex Mono', size: 10 } },
          ticks: { color: '#8b95a3', font: { family: 'IBM Plex Mono', size: 9 }, maxTicksLimit: 9 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          title: { display: true, text: 'Sa (g)', color: '#8b95a3', font: { family: 'IBM Plex Mono', size: 10 } },
          ticks: { color: '#8b95a3', font: { family: 'IBM Plex Mono', size: 9 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: true
        }
      }
    }
  });
}

// ============================================================
// PDF
// ============================================================
async function descargarPDF() {
  if (!lastResult || !lastCoord) {
    alert('Primero ejecutá un cálculo.');
    return;
  }
  const btn = document.getElementById('btn-pdf');
  const originalText = btn.textContent;
  btn.textContent = 'GENERANDO PDF...';
  btn.disabled = true;
  try {
    const doc = await PDFGen.generarReportePDF(lastResult, lastCoord, spectrumChart);
    const filename = `SismoPanama_${lastCoord.lat.toFixed(4)}_${lastCoord.lng.toFixed(4)}_${Date.now()}.pdf`;
    doc.save(filename);
  } catch (err) {
    alert('Error generando PDF: ' + err.message);
    console.error(err);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// ============================================================
// MODALES
// ============================================================
function showModal(id) {
  document.getElementById(id).classList.add('active');
}
function hideModal(id) {
  document.getElementById(id).classList.remove('active');
}

function renderChangelog() {
  if (!manifest || !manifest.changelog) return;
  const html = manifest.changelog.map(entry => `
    <div style="margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
      <h3 style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--accent); margin-bottom: 4px;">
        ${entry.version} — ${entry.date}
      </h3>
      <p style="font-size: 12px; color: var(--text);">${entry.notes}</p>
    </div>
  `).join('');
  document.getElementById('changelog-content').innerHTML = html;
}

// ============================================================
// ARRANQUE
// ============================================================
document.addEventListener('DOMContentLoaded', init);

// Exponer funciones globales para onclick="" handlers en HTML
window.setCoordMode = setCoordMode;
window.setLayer = setLayer;
window.queryCoord = queryCoord;
window.updateSistemas = updateSistemas;
window.calcularCs = calcularCs;
window.descargarPDF = descargarPDF;
window.showModal = showModal;
window.hideModal = hideModal;
