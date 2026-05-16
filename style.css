// ============================================================
// SISMOPANAMA v1.0.2 - © LMM Ingeniería 2026
// ============================================================

proj4.defs("EPSG:32617", "+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs");

const latLngToUTM = (lat, lng) => {
  const [e, n] = proj4("EPSG:4326", "EPSG:32617", [lng, lat]);
  return { e: Math.round(e), n: Math.round(n) };
};
const utmToLatLng = (e, n) => {
  const [lng, lat] = proj4("EPSG:32617", "EPSG:4326", [e, n]);
  return { lat, lng };
};

let manager = null;
let manifest = null;
let map = null;
let marker = null;
let contourLayer = null;
let labelLayer = null;
let currentLayer = 'ss';
let coordMode = 'geo';
let lastResult = null;
let lastCoord = null;
let spectrumChart = null;

// Escala de color por valor de aceleración - paleta corporativa
function colorForContour(layer, value) {
  const ranges = {
    'ss':  { min: 0.6, max: 2.0 },
    's1':  { min: 0.24, max: 0.76 },
    'pga': { min: 0.24, max: 0.88 }
  };
  const r = ranges[layer];
  const norm = Math.max(0, Math.min(1, (value - r.min) / (r.max - r.min)));
  // Azul claro -> medio -> oscuro -> naranja -> rojo
  if (norm < 0.20) return '#4A90C4';
  if (norm < 0.40) return '#2D6A9F';
  if (norm < 0.60) return '#1E3A5F';
  if (norm < 0.80) return '#D97706';
  return '#DC2626';
}

function isMajorContour(value, layer) {
  // Curvas mayores cada 0.10 g (Ss) o 0.04 g x 2 = 0.08 (S1/PGA) - usar 0.10
  if (layer === 'ss') return Math.abs(value % 0.20) < 0.005;
  return Math.abs(value % 0.10) < 0.005;
}

function widthForContour(value, layer) {
  return isMajorContour(value, layer) ? 2.2 : 1.0;
}

async function init() {
  try {
    manifest = await fetch('data/manifest.json').then(r => r.json());
    document.getElementById('version-badge').textContent = manifest.active_version;
    document.getElementById('acerca-version').textContent = manifest.active_version;
    document.getElementById('acerca-fecha').textContent = manifest.last_updated;
    renderChangelog();
  } catch (err) {
    console.error('Error cargando manifest:', err);
  }

  initMap();

  try {
    manager = await new RasterManager().loadAll(manifest.active_version);
    document.getElementById('results-pane').innerHTML =
      '<div class="empty-state">Hacé clic en el mapa o ingresá una coordenada.</div>';
    renderContours();
    queryCoord();
  } catch (err) {
    document.getElementById('results-pane').innerHTML =
      '<div class="error-box">Error cargando datos: ' + err.message + '</div>';
  }

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Poblar selector geotecnia
  const geoSelect = document.getElementById('tipo-geotecnia');
  Object.entries(SismicCalc.TIPOS_GEOTECNICA).forEach(([key, label]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    geoSelect.appendChild(opt);
  });

  updateSistemas();

  document.getElementById('version-badge').addEventListener('click', () =>
    showModal('modal-changelog')
  );
}

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

  cartoLayer.addTo(map);
  L.control.layers({
    'CartoDB Voyager': cartoLayer,
    'OpenStreetMap': osmLayer,
    'Satélite': satLayer
  }, null, { position: 'topright', collapsed: true }).addTo(map);

  contourLayer = L.layerGroup().addTo(map);
  labelLayer = L.layerGroup().addTo(map);

  map.on('click', e => {
    setLatLngInputs(e.latlng.lat, e.latlng.lng);
    queryCoord();
  });

  map.on('zoomend moveend', updateLabels);
}

function renderContours() {
  if (!manager || !manager.loaded) return;
  contourLayer.clearLayers();
  labelLayer.clearLayers();

  const contours = manager.getContours(currentLayer);
  if (!contours) return;

  contours.forEach(level => {
    const color = colorForContour(currentLayer, level.value);
    const width = widthForContour(level.value, currentLayer);
    
    level.paths.forEach(path => {
      const latlngs = path.map(p => [p[1], p[0]]);
      L.polyline(latlngs, {
        color: color,
        weight: width,
        opacity: 0.9,
        smoothFactor: 1.5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(contourLayer);
    });
  });

  updateLegend();
  updateLabels();
}

// Etiquetas embebidas SOBRE la línea (estilo topográfico) — solo cuando zoom es alto
function updateLabels() {
  if (!manager || !manager.loaded) return;
  labelLayer.clearLayers();
  
  const zoom = map.getZoom();
  // No mostrar etiquetas hasta zoom 9
  if (zoom < 9) return;
  
  const contours = manager.getContours(currentLayer);
  if (!contours) return;

  const bounds = map.getBounds();
  
  contours.forEach(level => {
    // Decidir si etiquetar este nivel según zoom
    let etiquetar;
    if (zoom >= 11) {
      // Zoom alto: todas las curvas
      etiquetar = true;
    } else if (zoom >= 10) {
      // Solo mayores y medias
      etiquetar = isMajorContour(level.value, currentLayer) || 
                  (currentLayer === 'ss' ? Math.abs(level.value % 0.08) < 0.005 : Math.abs(level.value % 0.08) < 0.005);
    } else {
      // Solo curvas mayores
      etiquetar = isMajorContour(level.value, currentLayer);
    }
    if (!etiquetar) return;

    level.paths.forEach(path => {
      if (path.length < 6) return;
      
      // Calcular puntos donde colocar etiquetas a lo largo de la línea
      // Posición: ~mitad del path, y opcionalmente más etiquetas en paths largos
      const numLabels = Math.min(Math.floor(path.length / 40) + 1, 3);
      
      for (let labelIdx = 0; labelIdx < numLabels; labelIdx++) {
        // Posición uniforme a lo largo del path
        const idx = Math.floor(path.length * (labelIdx + 1) / (numLabels + 1));
        const p1 = path[idx];
        const p2 = path[Math.min(idx + 2, path.length - 1)];
        if (!p1 || !p2) continue;
        
        // Solo etiquetar si está dentro del viewport
        if (!bounds.contains([p1[1], p1[0]])) continue;
        
        // Calcular ángulo del segmento para rotar la etiqueta
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
        // Mantener legible: nunca de cabeza
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        
        const labelText = level.value.toFixed(2);
        const labelIcon = L.divIcon({
          className: 'contour-label-wrapper',
          html: `<div class="contour-label-inline" style="transform: rotate(${angle}deg);">${labelText}</div>`,
          iconSize: [30, 14],
          iconAnchor: [15, 7]
        });
        L.marker([p1[1], p1[0]], { 
          icon: labelIcon,
          interactive: false,
          keyboard: false,
          zIndexOffset: 200
        }).addTo(labelLayer);
      }
    });
  });
}

function updateLegend() {
  const labels = {
    'ss':  { name: 'Ss (0.2 s)',  levels: [0.7, 1.0, 1.3, 1.6, 1.9] },
    's1':  { name: 'S₁ (1.0 s)',  levels: [0.28, 0.40, 0.52, 0.64, 0.75] },
    'pga': { name: 'PGA (0 s)',   levels: [0.28, 0.40, 0.52, 0.68, 0.84] }
  };
  document.getElementById('legend-period').textContent = labels[currentLayer].name;
  
  const scale = document.getElementById('legend-scale');
  scale.innerHTML = '';
  labels[currentLayer].levels.forEach(v => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-line" style="background:${colorForContour(currentLayer, v)}"></div>
      <span>${v.toFixed(2)} g</span>
    `;
    scale.appendChild(item);
  });
}

function setLayer(layer, event) {
  currentLayer = layer;
  document.querySelectorAll('.layer-toggle button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderContours();
}

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

  if (marker) map.removeLayer(marker);
  marker = L.circleMarker([coord.lat, coord.lng], {
    radius: 8,
    color: '#1E3A5F',
    weight: 3,
    fillColor: '#4A90C4',
    fillOpacity: 0.8
  }).addTo(map);
  marker.bindPopup(
    `<strong>PGA</strong> ${vals.pga.toFixed(3)} g<br>` +
    `<strong>Ss</strong> ${vals.ss.toFixed(3)} g<br>` +
    `<strong>S₁</strong> ${vals.s1.toFixed(3)} g`
  ).openPopup();
  map.setView([coord.lat, coord.lng], Math.max(map.getZoom(), 9));

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

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

function onTipoEstructuraChange() {
  const tipo = document.getElementById('tipo-estructura').value;
  document.getElementById('campos-edificio').style.display = 
    (tipo === 'edificio' || tipo === 'infra') ? 'block' : 'none';
  document.getElementById('campos-vivienda').style.display = 
    (tipo === 'vivienda') ? 'block' : 'none';
  document.getElementById('campos-geotecnia').style.display = 
    (tipo === 'geotecnica') ? 'block' : 'none';
  
  // Ocultar resultados anteriores al cambiar
  document.getElementById('calc-results').style.display = 'none';
  document.getElementById('spectrum-section').style.display = 'none';
  document.getElementById('btn-pdf').style.display = 'none';
}

function updateSistemas() {
  const cat = document.getElementById('categoria-sistema').value;
  const sistemaSelect = document.getElementById('sistema');
  sistemaSelect.innerHTML = '';
  const sistemas = SismicCalc.SISTEMAS_ESTRUCTURALES[cat].sistemas;
  Object.entries(sistemas).forEach(([key, info]) => {
    const opt = document.createElement('option');
    opt.value = key;
    if (info.isCustom) {
      opt.textContent = info.nombre;
    } else {
      opt.textContent = `${info.nombre} [R=${info.R}]`;
    }
    sistemaSelect.appendChild(opt);
  });
  onSistemaChange();
}

function onSistemaChange() {
  const sistemaKey = document.getElementById('sistema').value;
  const panel = document.getElementById('custom-system-panel');
  panel.style.display = (sistemaKey === 'custom') ? 'block' : 'none';
}

function calcular() {
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

  let input = {
    ss: vals.ss, s1: vals.s1, pga: vals.pga,
    tipoEstructura
  };

  if (tipoEstructura === 'edificio' || tipoEstructura === 'infra') {
    input.claseSitio = document.getElementById('clase-sitio').value;
    input.riesgo = document.getElementById('riesgo').value;
    input.sistemaKey = document.getElementById('sistema').value;
    input.periodo = parseFloat(document.getElementById('periodo').value);
    
    if (isNaN(input.periodo) || input.periodo <= 0) {
      alert('Período debe ser un número positivo.');
      return;
    }
    
    if (input.sistemaKey === 'custom') {
      input.customR = parseFloat(document.getElementById('custom-R').value);
      input.customOmega = parseFloat(document.getElementById('custom-omega').value);
      input.customCd = parseFloat(document.getElementById('custom-Cd').value);
      if (isNaN(input.customR) || isNaN(input.customOmega) || isNaN(input.customCd)) {
        alert('Ingresá valores válidos para R, Ω₀ y Cd.');
        return;
      }
    }
  } else if (tipoEstructura === 'vivienda') {
    input.claseSitio = document.getElementById('clase-sitio-viv').value;
    input.suelosProblema = document.getElementById('suelos-problema').checked;
    input.irregularidad = document.getElementById('irregularidad').checked;
  } else if (tipoEstructura === 'geotecnica') {
    input.claseSitio = document.getElementById('clase-sitio-geo').value;
    input.tipoGeotecnia = document.getElementById('tipo-geotecnia').value;
    input.kvOption = document.getElementById('kv-option').value;
  }

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
    container.innerHTML = result.errores.map(e => `<div class="error-box">${e}</div>`).join('');
    document.getElementById('btn-pdf').style.display = 'none';
    document.getElementById('spectrum-section').style.display = 'none';
    return;
  }

  let html = '';
  
  if (result.input.tipoEstructura === 'edificio' || result.input.tipoEstructura === 'infra') {
    html = renderResultadosEdificio(result);
    renderSpectrum(result);
    document.getElementById('spectrum-section').style.display = 'block';
  } else if (result.input.tipoEstructura === 'vivienda') {
    html = renderResultadosVivienda(result);
    document.getElementById('spectrum-section').style.display = 'none';
  } else if (result.input.tipoEstructura === 'geotecnica') {
    html = renderResultadosGeotecnia(result);
    document.getElementById('spectrum-section').style.display = 'none';
  }

  if (result.advertencias && result.advertencias.length > 0) {
    html += result.advertencias.map(a => `<div class="warning-box">${a}</div>`).join('');
  }

  container.innerHTML = html;
  document.getElementById('btn-pdf').style.display = 'block';
}

function renderResultadosEdificio(r) {
  return `
    <div class="cs-result-card">
      <div class="label">COEFICIENTE SÍSMICO Cs</div>
      <div class="value">${r.Cs.toFixed(4)}</div>
      <div class="sub">Gobierna: límite ${r.Cs_gobierna}</div>
    </div>
    <div class="info-row"><span class="k">CATEGORÍA DISEÑO SÍSMICO</span><span class="v"><span class="cds-badge">${r.CDS}</span></span></div>
    <div class="info-row"><span class="k">Fa</span><span class="v">${r.Fa.toFixed(3)}</span></div>
    <div class="info-row"><span class="k">Fv</span><span class="v">${r.Fv.toFixed(3)}</span></div>
    <div class="info-row"><span class="k">SMS</span><span class="v">${r.SMS.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">SM₁</span><span class="v">${r.SM1.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">SDS</span><span class="v">${r.SDS.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">SD₁</span><span class="v">${r.SD1.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">R</span><span class="v">${r.R.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">Ω₀</span><span class="v">${r.omega.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">Cd</span><span class="v">${r.Cd.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">Ie</span><span class="v">${r.Ie.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">T₀</span><span class="v">${r.T0.toFixed(3)} s</span></div>
    <div class="info-row"><span class="k">Ts</span><span class="v">${r.Ts.toFixed(3)} s</span></div>
    <div class="info-row"><span class="k">TL</span><span class="v">${r.TL.toFixed(1)} s</span></div>
  `;
}

function renderResultadosVivienda(r) {
  const calificaHtml = r.calificaTipica
    ? `<div style="background: rgba(16,185,129,0.1); border-left: 3px solid #10B981; padding: 10px; margin: 10px 0; border-radius: 4px; color: #065F46; font-size: 12px;">
         <strong>✓ CALIFICA COMO CONSTRUCCIÓN TÍPICA</strong><br>
         REP-21 sec. 7.3-7.4
       </div>`
    : `<div class="warning-box">
         <strong>NO CALIFICA COMO CONSTRUCCIÓN TÍPICA</strong><br>
         Triggers detectados:<br>
         ${r.triggersNoTipica.map(t => '• ' + t).join('<br>')}
       </div>`;

  return `
    <div class="cs-result-card">
      <div class="label">DENSIDAD MÍNIMA DE PAREDES</div>
      <div class="value">${r.densidadMinima.toFixed(1)} %</div>
      <div class="sub">${r.zonaPGA}</div>
    </div>
    <div class="info-row"><span class="k">PGA del sitio</span><span class="v">${r.PGA.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">Clase de sitio</span><span class="v">${r.input.claseSitio}</span></div>
    ${calificaHtml}
    <div style="margin-top: 12px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--text-dim); letter-spacing: 0.5px;">PARÁMETROS DE MAMPOSTERÍA CONFINADA (REF.)</div>
    <div class="info-row"><span class="k">R</span><span class="v">${r.R.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">Ω₀</span><span class="v">${r.omega.toFixed(2)}</span></div>
    <div class="info-row"><span class="k">Cd</span><span class="v">${r.Cd.toFixed(2)}</span></div>
  `;
}

function renderResultadosGeotecnia(r) {
  return `
    <div class="cs-result-card">
      <div class="label">COEFICIENTES PSEUDOESTÁTICOS</div>
      <div class="value">kh = ${r.kh.toFixed(4)}</div>
      <div class="sub">kv = ${r.kv.toFixed(4)}</div>
    </div>
    <div class="info-row"><span class="k">Subtipo</span><span class="v" style="font-size: 10px;">${r.tipoGeotecnico}</span></div>
    <div class="info-row"><span class="k">Clase de sitio</span><span class="v">${r.input.claseSitio}</span></div>
    <div class="info-row"><span class="k">Fa</span><span class="v">${r.Fa.toFixed(3)}</span></div>
    <div style="margin-top: 12px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--text-dim); letter-spacing: 0.5px;">ACELERACIONES</div>
    <div class="info-row"><span class="k">PGA del mapa</span><span class="v">${r.PGA_mapa.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">PGA ajustado sitio</span><span class="v">${r.PGA_sitio.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">PGA diseño (×2/3)</span><span class="v">${r.PGA_diseno.toFixed(3)} g</span></div>
    <div class="info-row"><span class="k">PGA diseño + sitio</span><span class="v">${r.PGA_diseno_sitio.toFixed(3)} g</span></div>
    <div style="margin-top: 12px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--text-dim); letter-spacing: 0.5px;">ÁNGULO DE INERCIA SÍSMICO (MONONOBE-OKABE)</div>
    <div class="info-row"><span class="k">ψ (rad)</span><span class="v">${r.psi_rad.toFixed(4)}</span></div>
    <div class="info-row"><span class="k">ψ (grados)</span><span class="v">${r.psi_deg.toFixed(2)}°</span></div>
  `;
}

function renderSpectrum(result) {
  // Fix bug Chart.js distorsión PC: forzar resize antes
  const canvas = document.getElementById('spectrum-chart');
  const wrap = canvas.parentElement;
  canvas.style.width = '100%';
  canvas.style.height = '200px';
  
  const puntos = SismicCalc.generarEspectro(
    result.SDS, result.SD1, result.T0, result.Ts, result.TL, 4.0
  );
  const labels = puntos.map(p => p.T.toFixed(2));
  const data = puntos.map(p => p.Sa);

  if (spectrumChart) spectrumChart.destroy();
  const ctx = canvas.getContext('2d');
  spectrumChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sa (g)',
        data: data,
        borderColor: '#1E3A5F',
        backgroundColor: 'rgba(45,106,159,0.15)',
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 100,
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E3A5F',
          titleColor: '#4A90C4',
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
          title: { display: true, text: 'Período T (s)', color: '#6B7280', font: { family: 'IBM Plex Mono', size: 10 } },
          ticks: { color: '#6B7280', font: { family: 'IBM Plex Mono', size: 9 }, maxTicksLimit: 9 },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        y: {
          title: { display: true, text: 'Sa (g)', color: '#6B7280', font: { family: 'IBM Plex Mono', size: 10 } },
          ticks: { color: '#6B7280', font: { family: 'IBM Plex Mono', size: 9 } },
          grid: { color: 'rgba(0,0,0,0.05)' },
          beginAtZero: true
        }
      }
    }
  });
}

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
    const filename = `SismoPanama_LMM_${lastCoord.lat.toFixed(4)}_${lastCoord.lng.toFixed(4)}_${Date.now()}.pdf`;
    doc.save(filename);
  } catch (err) {
    alert('Error generando PDF: ' + err.message);
    console.error(err);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function showModal(id) { document.getElementById(id).classList.add('active'); }
function hideModal(id) { document.getElementById(id).classList.remove('active'); }

function renderChangelog() {
  if (!manifest || !manifest.changelog) return;
  const html = manifest.changelog.map(entry => `
    <div style="margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
      <h3 style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--accent); margin-bottom: 4px;">
        ${entry.version} — ${entry.date}
      </h3>
      <p style="font-size: 12px; color: var(--text);">${entry.notes}</p>
    </div>
  `).join('');
  document.getElementById('changelog-content').innerHTML = html;
}

document.addEventListener('DOMContentLoaded', init);

// Exports
window.setCoordMode = setCoordMode;
window.setLayer = setLayer;
window.queryCoord = queryCoord;
window.updateSistemas = updateSistemas;
window.calcular = calcular;
window.descargarPDF = descargarPDF;
window.showModal = showModal;
window.hideModal = hideModal;
window.onTipoEstructuraChange = onTipoEstructuraChange;
window.onSistemaChange = onSistemaChange;
