// ============================================================
// SISMOPANAMA v2.0 - © LMM Ingeniería 2026
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
let espectroMode = 'auto';  // 'auto' | 'manual'

// Bounding box del área oficial (datos vectoriales del REP)
const OFFICIAL_BBOX = { west: -80.91, east: -78.04, south: 8.27, north: 9.59 };

// Color único corporativo - sin saturación multicolor
function colorForContour(layer, value, isMajor) {
  // Un solo tono según importancia
  // Curvas mayores (cada 0.10g) - azul oscuro
  // Curvas menores - azul medio
  if (isMajor) return '#1E3A5F'; // primario
  return '#4A90C4'; // highlight
}

function isMajorContour(value, layer) {
  // Cada 0.10 g es mayor (etiquetada y gruesa)
  return Math.abs((value * 100) % 10) < 0.5 || Math.abs((value * 100) % 10) > 9.5;
}

function widthForContour(value, isOficial, isMajor) {
  if (isOficial) {
    return isMajor ? 1.8 : 0.9;
  } else {
    return isMajor ? 2.0 : 1.1;
  }
}

async function init() {
  try {
    manifest = await fetch('data/manifest.json').then(r => r.json());
    const versionDisplay = manifest.app_version || manifest.active_version;
    document.getElementById('version-badge').textContent = versionDisplay;
    document.getElementById('acerca-version').textContent = versionDisplay;
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

  // Poblar selector geotecnia (estructura con objetos)
  const geoSelect = document.getElementById('tipo-geotecnia');
  Object.entries(SismicCalc.TIPOS_GEOTECNICA).forEach(([key, info]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = info.nombre;
    geoSelect.appendChild(opt);
  });
  onTipoGeoChange();
  onMetodoKhChange();

  updateSistemas();

  // Renderizar glosario y tooltips
  renderGlosario();
  setupTooltips();

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

  const data = manager.getContours(currentLayer);
  if (!data) return;

  // Renderizar curvas NACIONALES primero (debajo)
  if (data.nacional) {
    data.nacional.forEach(level => {
      const major = isMajorContour(level.value, currentLayer);
      const color = colorForContour(currentLayer, level.value, major);
      const width = widthForContour(level.value, false, major);
      
      level.paths.forEach(path => {
        const latlngs = path.map(p => [p[1], p[0]]);
        L.polyline(latlngs, {
          color: color,
          weight: width,
          opacity: 0.7,
          smoothFactor: 1.0,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(contourLayer);
      });
    });
  }

  // Renderizar curvas OFICIALES (encima, más detalladas)
  if (data.oficial) {
    data.oficial.forEach(level => {
      const major = isMajorContour(level.value, currentLayer);
      const color = colorForContour(currentLayer, level.value, major);
      const width = widthForContour(level.value, true, major);
      
      level.paths.forEach(path => {
        const latlngs = path.map(p => [p[1], p[0]]);
        L.polyline(latlngs, {
          color: color,
          weight: width,
          opacity: 0.9,
          smoothFactor: 1.0,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(contourLayer);
      });
    });
  }

  updateLegend();
  updateLabels();
}

function updateLabels() {
  if (!manager || !manager.loaded) return;
  labelLayer.clearLayers();
  
  const zoom = map.getZoom();
  if (zoom < 9) return;
  
  const data = manager.getContours(currentLayer);
  if (!data) return;

  const bounds = map.getBounds();
  
  function addLabelsFor(contours, isOficial) {
    contours.forEach(level => {
      const major = isMajorContour(level.value, currentLayer);
      
      // Decidir cuándo etiquetar
      let etiquetar;
      if (zoom >= 12) {
        etiquetar = true; // Todas en zoom muy cercano
      } else if (zoom >= 10) {
        etiquetar = major || (isOficial && level.value % 0.04 < 0.01);
      } else {
        etiquetar = major;
      }
      if (!etiquetar) return;

      level.paths.forEach(path => {
        if (path.length < 4) return;
        
        // Una etiqueta cada N puntos
        const numLabels = Math.min(Math.max(1, Math.floor(path.length / 60)), 2);
        
        for (let li = 0; li < numLabels; li++) {
          const idx = Math.floor(path.length * (li + 1) / (numLabels + 1));
          const p1 = path[idx];
          const p2 = path[Math.min(idx + 2, path.length - 1)];
          if (!p1 || !p2) continue;
          
          if (!bounds.contains([p1[1], p1[0]])) continue;
          
          // Calcular ángulo para rotar
          const dx = p2[0] - p1[0];
          const dy = p2[1] - p1[1];
          let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
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

  if (data.oficial) addLabelsFor(data.oficial, true);
  if (data.nacional) addLabelsFor(data.nacional, false);
}

function updateLegend() {
  const labels = {
    'ss':  'Ss (T=0.2 s)',
    's1':  'S₁ (T=1.0 s)',
    'pga': 'PGA (T=0)'
  };
  document.getElementById('legend-period').textContent = labels[currentLayer];
  
  const scale = document.getElementById('legend-scale');
  scale.innerHTML = `
    <div class="legend-item">
      <div class="legend-line" style="background:#1E3A5F; height: 2px;"></div>
      <span>Curva mayor (cada 0.10 g)</span>
    </div>
    <div class="legend-item">
      <div class="legend-line" style="background:#4A90C4; height: 1.2px;"></div>
      <span>Curva menor (cada 0.02 g)</span>
    </div>
    <div class="legend-item" style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #E5E7EB;">
      <span style="font-size: 9px; color: #6B7280;">Datos oficiales en zona Panamá-Colón</span>
    </div>
  `;
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
  
  // Detectar si está en zona oficial
  const enZonaOficial = (coord.lng >= OFFICIAL_BBOX.west && coord.lng <= OFFICIAL_BBOX.east &&
                        coord.lat >= OFFICIAL_BBOX.south && coord.lat <= OFFICIAL_BBOX.north);

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

  const zonaInfo = enZonaOficial 
    ? '<span style="color: #1E3A5F; font-weight: 700;">Zona Panamá-Colón (datos detallados)</span>'
    : '<span>Zona nacional</span>';

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
    <div class="info-row"><span class="k">UBICACIÓN</span><span class="v">${zonaInfo}</span></div>
    <div class="info-row"><span class="k">PERÍODO RETORNO</span><span class="v">2500 años</span></div>
    <div class="info-row"><span class="k">CLASE SITIO</span><span class="v">B (referencia)</span></div>
    <div class="info-row"><span class="k">AMORTIGUAMIENTO</span><span class="v">5 %</span></div>
  `;
  
  // Prellenar inputs manuales del espectro si están vacíos
  const ssM = document.getElementById('ss-manual');
  if (ssM && !ssM.value) {
    ssM.value = vals.ss.toFixed(3);
    document.getElementById('s1-manual').value = vals.s1.toFixed(3);
    document.getElementById('pga-manual').value = vals.pga.toFixed(3);
  }
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
  
  const infoBox = document.getElementById('sistema-info-box');
  if (!infoBox) return;
  if (sistemaKey === 'custom') {
    infoBox.style.display = 'none';
    return;
  }
  
  let info = null;
  for (const cat of Object.values(SismicCalc.SISTEMAS_ESTRUCTURALES)) {
    if (cat.sistemas[sistemaKey]) { info = cat.sistemas[sistemaKey]; break; }
  }
  if (!info || !info.limites) {
    infoBox.style.display = 'none';
    return;
  }
  
  const formatLim = (l) => l === null ? 'sin límite' : (l === 'NP' ? '<strong style="color:#dc2626;">NP</strong>' : `${l} m`);
  const lim = info.limites;
  infoBox.style.display = 'block';
  infoBox.innerHTML = `
    <strong>${info.refTabla}</strong><br>
    R=${info.R} · Ω₀=${info.omega} · Cd=${info.Cd}<br>
    <span style="font-size:10px;">Límite altura: A=${formatLim(lim.A)} · B=${formatLim(lim.B)} · C=${formatLim(lim.C)} · D=${formatLim(lim.D)} · E=${formatLim(lim.E)} · F=${formatLim(lim.F)}</span>
    ${info.excepcion ? `<div style="margin-top:4px; font-size:10px; color:#92400e;"><strong>Excepción:</strong> ${info.excepcion}</div>` : ''}
  `;
}

// ============================================================
// ESPECTRO: modo auto / manual
// ============================================================
function setEspectroMode(modo, event) {
  espectroMode = modo;
  document.getElementById('btn-espectro-auto').classList.toggle('active', modo === 'auto');
  document.getElementById('btn-espectro-manual').classList.toggle('active', modo === 'manual');
  document.getElementById('espectro-auto-info').style.display = (modo === 'auto') ? 'block' : 'none';
  document.getElementById('espectro-manual-inputs').style.display = (modo === 'manual') ? 'block' : 'none';
  
  if (modo === 'manual') {
    const coord = getCurrentLatLng();
    if (coord && manager && manager.loaded) {
      const vals = manager.queryAll(coord.lat, coord.lng);
      if (vals && vals.ss !== null) {
        const ssM = document.getElementById('ss-manual');
        if (!ssM.value) {
          ssM.value = vals.ss.toFixed(3);
          document.getElementById('s1-manual').value = vals.s1.toFixed(3);
          document.getElementById('pga-manual').value = vals.pga.toFixed(3);
        }
      }
    }
  }
}

// ============================================================
// PERÍODO: cambio de modo
// ============================================================
function onModoPeriodoChange() {
  const modo = document.getElementById('modo-periodo').value;
  document.getElementById('periodo-auto-info').style.display = (modo !== 'manual') ? 'block' : 'none';
  document.getElementById('periodo-manual-input').style.display = (modo === 'manual') ? 'block' : 'none';
  
  const info = document.getElementById('periodo-auto-info');
  if (modo === 'auto') {
    info.textContent = 'T se calculará automáticamente con Ta = Ct·hn^x (Ec. 12.8-7) y Cu de Tabla 12.8-1.';
  } else if (modo === 'ta') {
    info.textContent = 'T = Ta sin amplificar por Cu. Conservador. Solo si se busca mayor fuerza sísmica.';
  }
}

// ============================================================
// GEOTECNIA: tipo de muro y método kh
// ============================================================
function onTipoGeoChange() {
  const tipo = document.getElementById('tipo-geotecnia').value;
  const info = SismicCalc.TIPOS_GEOTECNICA[tipo];
  const box = document.getElementById('tipo-geo-info');
  if (!box) return;
  if (!info) { box.style.display = 'none'; return; }
  
  box.style.display = 'block';
  const catLabel = info.categoria === 'rigido' 
    ? '<strong style="color:#7c2d12;">Muro rígido</strong> (umbral kv=0: kh ≤ 0.10)'
    : '<strong style="color:#1e3a5f;">Muro flexible</strong> (umbral kv=0: kh ≤ 0.05)';
  const metodoInfo = SismicCalc.METODOS_KH[info.khRecomendado];
  box.innerHTML = `
    ${catLabel}<br>
    <span style="font-size:10px;">Método kh recomendado: <strong>${info.khRecomendado}</strong> — ${metodoInfo ? metodoInfo.nombre : ''}</span>
  `;
  
  const selKh = document.getElementById('metodo-kh');
  if (selKh && info.khRecomendado) {
    selKh.value = info.khRecomendado;
    onMetodoKhChange();
  }
}

function onMetodoKhChange() {
  const sel = document.getElementById('metodo-kh');
  if (!sel) return;
  const m = sel.value;
  const info = SismicCalc.METODOS_KH[m];
  const box = document.getElementById('metodo-kh-info');
  if (!box) return;
  if (!info) { box.style.display = 'none'; return; }
  
  box.style.display = 'block';
  box.innerHTML = `
    <strong>${info.nombre}</strong><br>
    <span style="font-family: 'IBM Plex Mono', monospace; font-size:10px;">${info.formula}</span><br>
    <span style="font-size:10px;">${info.aplica}</span><br>
    <span style="font-size:10px; color:#666;">${info.ref}</span>
    ${info.requiereSDS ? `<div style="margin-top:4px; padding:4px 6px; background:#fef3c7; font-size:10px; color:#92400e; border-radius:3px;"><strong>⚠ Requiere SDS:</strong> active modo MANUAL del espectro e ingrese Ss y S1.</div>` : ''}
  `;
}

// ============================================================
// GLOSARIO Y TOOLTIPS
// ============================================================
function renderGlosario() {
  const content = document.getElementById('glosario-content');
  if (!content || !SismicCalc.GLOSARIO) return;
  const glos = SismicCalc.GLOSARIO;
  let html = '';
  Object.entries(glos).forEach(([key, info]) => {
    html += `
      <div class="glosario-item">
        <div class="glosario-titulo">${info.titulo}</div>
        <div class="glosario-desc">${info.desc}</div>
        <div class="glosario-ref">📖 ${info.ref}</div>
      </div>
    `;
  });
  content.innerHTML = html;
}

function setupTooltips() {
  document.body.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('info-icon')) {
      const key = e.target.dataset.glos;
      if (!key) return;
      const info = SismicCalc.GLOSARIO[key];
      if (!info) return;
      const det = document.getElementById('detalle-content');
      det.innerHTML = `
        <h3 style="margin-bottom: 10px;">${info.titulo}</h3>
        <p style="font-size: 13px; line-height: 1.5;">${info.desc}</p>
        <div style="margin-top: 12px; padding: 8px; background: #f3f4f6; border-radius: 4px; font-size: 11px; color: #4b5563;">
          📖 <strong>Referencia:</strong> ${info.ref}
        </div>
      `;
      showModal('modal-detalle');
      e.stopPropagation();
    }
  });
}

function calcular() {
  if (!manager || !manager.loaded) {
    alert('Los datos aún no han cargado.');
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
  
  // Override de espectro si modo manual
  if (espectroMode === 'manual') {
    const ssM = parseFloat(document.getElementById('ss-manual').value);
    const s1M = parseFloat(document.getElementById('s1-manual').value);
    const pgaM = parseFloat(document.getElementById('pga-manual').value);
    if (!isNaN(ssM) && ssM > 0) input.ssOverride = ssM;
    if (!isNaN(s1M) && s1M > 0) input.s1Override = s1M;
    if (!isNaN(pgaM) && pgaM > 0) input.pgaOverride = pgaM;
  }

  if (tipoEstructura === 'edificio' || tipoEstructura === 'infra') {
    input.claseSitio = document.getElementById('clase-sitio').value;
    input.riesgo = document.getElementById('riesgo').value;
    input.sistemaKey = document.getElementById('sistema').value;
    
    const hnVal = parseFloat(document.getElementById('hn-edif').value);
    if (isNaN(hnVal) || hnVal <= 0) {
      alert('Altura hn debe ser positiva.');
      return;
    }
    input.hn = hnVal;
    input.modoPeriodo = document.getElementById('modo-periodo').value;
    
    if (input.modoPeriodo === 'manual') {
      input.periodo = parseFloat(document.getElementById('periodo-manual-val').value);
      if (isNaN(input.periodo) || input.periodo <= 0) {
        alert('Período manual debe ser positivo.');
        return;
      }
    }
    
    if (input.sistemaKey === 'custom') {
      input.customR = parseFloat(document.getElementById('custom-R').value);
      input.customOmega = parseFloat(document.getElementById('custom-omega').value);
      input.customCd = parseFloat(document.getElementById('custom-Cd').value);
      input.customNombre = document.getElementById('custom-nombre').value || null;
      input.customRef = document.getElementById('custom-ref').value || null;
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
    input.metodoKh = document.getElementById('metodo-kh').value;
    input.ratioKv = parseFloat(document.getElementById('ratio-kv').value);
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

  let html = '';
  
  // Errores críticos primero
  if (result.errores && result.errores.length > 0) {
    html += result.errores.map(e => {
      const msg = typeof e === 'string' ? e : e.msg;
      const ref = (typeof e === 'object' && e.ref) ? `<div style="font-size:10px; margin-top:4px; opacity:0.85;">📖 ${e.ref}</div>` : '';
      const exc = (typeof e === 'object' && e.excepcion) ? `<div style="font-size:10px; margin-top:4px; opacity:0.85;"><strong>Excepción:</strong> ${e.excepcion}</div>` : '';
      const rec = (typeof e === 'object' && e.recomendacion) ? `<div style="font-size:11px; margin-top:6px; font-weight:600;">↳ ${e.recomendacion}</div>` : '';
      return `<div class="error-box"><strong>⚠ ERROR:</strong> ${msg}${ref}${exc}${rec}</div>`;
    }).join('');
  }

  if (!result.valido) {
    container.innerHTML = html;
    document.getElementById('btn-pdf').style.display = 'none';
    document.getElementById('spectrum-section').style.display = 'none';
    return;
  }
  
  if (result.input.tipoEstructura === 'edificio' || result.input.tipoEstructura === 'infra') {
    html += renderResultadosEdificio(result);
    renderSpectrum(result);
    document.getElementById('spectrum-section').style.display = 'block';
  } else if (result.input.tipoEstructura === 'vivienda') {
    html += renderResultadosVivienda(result);
    document.getElementById('spectrum-section').style.display = 'none';
  } else if (result.input.tipoEstructura === 'geotecnica') {
    html += renderResultadosGeotecnia(result);
    document.getElementById('spectrum-section').style.display = 'none';
  }

  if (result.advertencias && result.advertencias.length > 0) {
    html += renderAdvertencias(result.advertencias);
  }

  container.innerHTML = html;
  document.getElementById('btn-pdf').style.display = 'block';
}

function renderAdvertencias(advertencias) {
  const grupos = {
    'critica':     { clase: 'warn-critica', icon: '⛔' },
    'media':       { clase: 'warn-media', icon: '⚠' },
    'metodologia': { clase: 'warn-meto', icon: '📐' },
    'sugerencia':  { clase: 'warn-info', icon: '💡' },
    'info':        { clase: 'warn-info', icon: 'ℹ' }
  };
  
  let html = '<div class="adv-section"><div class="adv-titulo">Validaciones y advertencias normativas</div>';
  ['critica', 'media', 'metodologia', 'sugerencia', 'info'].forEach(tipo => {
    const meta = grupos[tipo];
    const items = advertencias.filter(a => (typeof a === 'object' && a.tipo === tipo));
    if (items.length === 0) return;
    items.forEach(a => {
      const msg = a.msg;
      const ref = a.ref ? `<div class="adv-ref">📖 ${a.ref}</div>` : '';
      const req = a.requerimiento ? `<div class="adv-req"><strong>Acción requerida:</strong> ${a.requerimiento}</div>` : '';
      html += `<div class="adv-item ${meta.clase}"><span class="adv-icon">${meta.icon}</span><div class="adv-body"><div class="adv-msg">${msg}</div>${req}${ref}</div></div>`;
    });
  });
  // Strings legacy (no tipados)
  advertencias.filter(a => typeof a === 'string').forEach(a => {
    html += `<div class="adv-item warn-info"><span class="adv-icon">ℹ</span><div class="adv-body"><div class="adv-msg">${a}</div></div></div>`;
  });
  html += '</div>';
  return html;
}

function renderResultadosEdificio(r) {
  const p = r.periodoInfo;
  const cdsi = r.CDS_info;
  
  let memoria = `
    <div class="memoria-section">
      <div class="memoria-titulo">Memoria de cálculo</div>
      <div class="memoria-paso">
        <div class="memoria-paso-label">1. Espectro MCE (sitio)</div>
        ${r.usaOverrideEspectro ? '<div class="memoria-nota">⚠ Usando valores Ss/S1 ingresados manualmente (override del mapa)</div>' : ''}
        <div class="memoria-formula">Ss = ${r.ss_efectivo.toFixed(3)} g · S₁ = ${r.s1_efectivo.toFixed(3)} g · PGA = ${r.pga_efectivo.toFixed(3)} g</div>
        <div class="memoria-formula">Fa = ${r.Fa.toFixed(3)} (Tabla 11.4-1 ASCE 7-05, clase ${r.input.claseSitio})</div>
        <div class="memoria-formula">Fv = ${r.Fv.toFixed(3)} (Tabla 11.4-2 ASCE 7-05, clase ${r.input.claseSitio})</div>
        <div class="memoria-formula">SMS = Fa·Ss = ${r.SMS.toFixed(3)} g · SM₁ = Fv·S₁ = ${r.SM1.toFixed(3)} g</div>
        <div class="memoria-formula">SDS = (2/3)·SMS = ${r.SDS.toFixed(3)} g · SD₁ = (2/3)·SM₁ = ${r.SD1.toFixed(3)} g</div>
      </div>
      <div class="memoria-paso">
        <div class="memoria-paso-label">2. Categoría de Diseño Sísmico</div>
        <div class="memoria-formula">${cdsi.criterio}</div>
        <div class="memoria-ref">${cdsi.ref}</div>
      </div>
      <div class="memoria-paso">
        <div class="memoria-paso-label">3. Sistema estructural</div>
        <div class="memoria-formula">${r.sistema.nombre}</div>
        <div class="memoria-formula">R = ${r.R} · Ω₀ = ${r.omega} · Cd = ${r.Cd} · Ie = ${r.Ie}</div>
        <div class="memoria-ref">${r.sistema.refTabla || ''}</div>
      </div>
      <div class="memoria-paso">
        <div class="memoria-paso-label">4. Período fundamental T</div>
        <div class="memoria-formula">Ta = Ct·hn^x = ${p.Ct} × (${p.hn})^${p.x} = ${p.Ta.toFixed(3)} s</div>
        <div class="memoria-formula">Cu = ${p.Cu} (SD₁ = ${r.SD1.toFixed(3)}, Tabla 12.8-1)</div>
        <div class="memoria-formula">${p.fuente}</div>
        ${p.T_ingresado != null && p.T_ingresado !== p.T ? `<div class="memoria-nota">⚠ T ingresado (${p.T_ingresado}) limitado a Cu·Ta = ${p.T_max.toFixed(3)} s</div>` : ''}
      </div>
      <div class="memoria-paso">
        <div class="memoria-paso-label">5. Coeficiente sísmico Cs</div>
        <div class="memoria-formula">Cs básico = SDS/(R/Ie) = ${r.SDS.toFixed(3)}/(${r.R}/${r.Ie}) = <strong>${r.Cs_basico.toFixed(4)}</strong> (Ec. 12.8-2)</div>
        <div class="memoria-formula">Cs máx ${r.T <= r.TL ? '= SD₁/(T·R/Ie)' : '= SD₁·TL/(T²·R/Ie)'} = <strong>${r.Cs_max.toFixed(4)}</strong> (Ec. 12.8-${r.T <= r.TL ? '3' : '4'})</div>
        <div class="memoria-formula">Cs mín REP = max(0.044·SDS·Ie, 0.01) = <strong>${r.Cs_min_REP21.toFixed(4)}</strong> (Ec. 12.8-5)</div>
        ${r.Cs_min_S1 > 0 ? `<div class="memoria-formula">Cs mín S₁ = 0.5·S₁/(R/Ie) = <strong>${r.Cs_min_S1.toFixed(4)}</strong> (Ec. 12.8-6, S₁ ≥ 0.6)</div>` : ''}
        <div class="memoria-formula" style="color: var(--primary); font-weight: 700;">→ Cs gobernante = ${r.Cs.toFixed(4)} (${r.Cs_gobierna})</div>
      </div>
    </div>
  `;
  
  return `
    <div class="cs-result-card">
      <div class="label">COEFICIENTE SÍSMICO Cs</div>
      <div class="value">${r.Cs.toFixed(4)}</div>
      <div class="sub">V = Cs·W · Gobierna: ${r.Cs_gobierna}</div>
    </div>
    
    <div class="resumen-grid">
      <div class="info-row"><span class="k">CDS <span class="info-icon" data-glos="CDS">ⓘ</span></span><span class="v"><span class="cds-badge cds-${r.CDS}">${r.CDS}</span></span></div>
      <div class="info-row"><span class="k">T usado <span class="info-icon" data-glos="T">ⓘ</span></span><span class="v">${r.T.toFixed(3)} s</span></div>
      <div class="info-row"><span class="k">Fa <span class="info-icon" data-glos="Fa">ⓘ</span></span><span class="v">${r.Fa.toFixed(3)}</span></div>
      <div class="info-row"><span class="k">Fv <span class="info-icon" data-glos="Fv">ⓘ</span></span><span class="v">${r.Fv.toFixed(3)}</span></div>
      <div class="info-row"><span class="k">SDS <span class="info-icon" data-glos="SDS">ⓘ</span></span><span class="v">${r.SDS.toFixed(3)} g</span></div>
      <div class="info-row"><span class="k">SD₁ <span class="info-icon" data-glos="SD1">ⓘ</span></span><span class="v">${r.SD1.toFixed(3)} g</span></div>
      <div class="info-row"><span class="k">R <span class="info-icon" data-glos="R">ⓘ</span></span><span class="v">${r.R.toFixed(2)}</span></div>
      <div class="info-row"><span class="k">Ω₀ <span class="info-icon" data-glos="Omega">ⓘ</span></span><span class="v">${r.omega.toFixed(2)}</span></div>
      <div class="info-row"><span class="k">Cd <span class="info-icon" data-glos="Cd">ⓘ</span></span><span class="v">${r.Cd.toFixed(2)}</span></div>
      <div class="info-row"><span class="k">Ie <span class="info-icon" data-glos="Ie">ⓘ</span></span><span class="v">${r.Ie.toFixed(2)}</span></div>
      <div class="info-row"><span class="k">T₀ <span class="info-icon" data-glos="T0">ⓘ</span></span><span class="v">${r.T0.toFixed(3)} s</span></div>
      <div class="info-row"><span class="k">Ts <span class="info-icon" data-glos="Ts">ⓘ</span></span><span class="v">${r.Ts.toFixed(3)} s</span></div>
      <div class="info-row"><span class="k">TL <span class="info-icon" data-glos="TL">ⓘ</span></span><span class="v">${r.TL.toFixed(1)} s</span></div>
      <div class="info-row"><span class="k">Ta <span class="info-icon" data-glos="Ta">ⓘ</span></span><span class="v">${p.Ta.toFixed(3)} s</span></div>
      <div class="info-row"><span class="k">Cu·Ta</span><span class="v">${p.T_max.toFixed(3)} s</span></div>
    </div>
    
    ${memoria}
  `;
}

function renderResultadosVivienda(r) {
  const triggersHtml = r.triggersNoTipica && r.triggersNoTipica.length > 0
    ? r.triggersNoTipica.map(t => {
        const msg = typeof t === 'string' ? t : t.msg;
        const ref = (typeof t === 'object' && t.ref) ? ` <span style="font-size:10px; opacity:0.7;">(${t.ref})</span>` : '';
        return `<li>${msg}${ref}</li>`;
      }).join('')
    : '';
  
  const calificaHtml = r.calificaTipica
    ? `<div class="ok-box">
         <strong>✓ CALIFICA COMO CONSTRUCCIÓN TÍPICA</strong><br>
         <span style="font-size: 10px;">REP-21 §7.3-7.4</span>
       </div>`
    : `<div class="warning-box">
         <strong>NO CALIFICA COMO CONSTRUCCIÓN TÍPICA</strong>
         <ul style="margin: 6px 0 0 18px; font-size: 11px;">${triggersHtml}</ul>
       </div>`;

  return `
    <div class="cs-result-card">
      <div class="label">DENSIDAD MÍNIMA DE PAREDES</div>
      <div class="value">${r.densidadMinima.toFixed(1)} %</div>
      <div class="sub">${r.zonaPGA}</div>
    </div>
    <div class="resumen-grid">
      <div class="info-row"><span class="k">PGA del sitio</span><span class="v">${r.PGA.toFixed(3)} g</span></div>
      <div class="info-row"><span class="k">Clase de sitio</span><span class="v">${r.input.claseSitio}</span></div>
    </div>
    ${calificaHtml}
    <div class="memoria-section">
      <div class="memoria-paso">
        <div class="memoria-paso-label">Parámetros de mampostería confinada (referencia)</div>
        <div class="memoria-formula">R = ${r.R} · Ω₀ = ${r.omega} · Cd = ${r.Cd}</div>
        <div class="memoria-ref">${r.refMamposteria}</div>
      </div>
    </div>
  `;
}

function renderResultadosGeotecnia(r) {
  const kvI = r.kvInfo;
  const khI = r.khInfo;
  
  const escenariosHtml = kvI.escenarios.map(e => `
    <tr class="${e.gobierna ? 'kv-gobierna' : ''}">
      <td>${e.id})</td>
      <td>${e.nombre} ${e.simbolo}</td>
      <td>${e.kv.toFixed(4)}</td>
      <td>${e.psi_deg.toFixed(2)}°</td>
      <td>${e.gobierna ? '<strong>GOBIERNA</strong>' : ''}</td>
    </tr>
  `).join('');
  
  return `
    <div class="cs-result-card">
      <div class="label">COEFICIENTES PSEUDOESTÁTICOS</div>
      <div class="value">kh = ${r.kh.toFixed(4)}</div>
      <div class="sub">kv gobernante = ${r.kv_gobernante.toFixed(4)} (ψ = ${r.psi_deg.toFixed(2)}°)</div>
    </div>
    
    <div class="resumen-grid">
      <div class="info-row"><span class="k">Tipo estructura</span><span class="v" style="font-size: 10px;">${r.tipoGeotecnicoInfo.nombre}</span></div>
      <div class="info-row"><span class="k">Categoría</span><span class="v"><strong>${r.tipoMuro === 'rigido' ? 'Rígido' : 'Flexible'}</strong></span></div>
      <div class="info-row"><span class="k">Clase de sitio</span><span class="v">${r.input.claseSitio}</span></div>
      <div class="info-row"><span class="k">PGA del mapa</span><span class="v">${r.PGA_mapa.toFixed(3)} g</span></div>
      <div class="info-row"><span class="k">PGA usado</span><span class="v">${r.PGA_usado.toFixed(3)} g</span></div>
      <div class="info-row"><span class="k">Fa</span><span class="v">${r.Fa.toFixed(3)}</span></div>
      <div class="info-row"><span class="k">PGA ajustado sitio</span><span class="v">${r.PGA_sitio.toFixed(3)} g</span></div>
    </div>
    
    <div class="memoria-section">
      <div class="memoria-titulo">Memoria de cálculo</div>
      <div class="memoria-paso">
        <div class="memoria-paso-label">1. Coeficiente kh (Método ${khI.metodo})</div>
        <div class="memoria-formula"><strong>${khI.nombreMetodo}</strong></div>
        <div class="memoria-formula">Fórmula: ${khI.formula}</div>
        <div class="memoria-formula">${khI.detalle}</div>
        <div class="memoria-ref">${khI.ref}</div>
      </div>
      <div class="memoria-paso">
        <div class="memoria-paso-label">2. Coeficiente kv — envolvente de 3 escenarios <span class="info-icon" data-glos="kv">ⓘ</span></div>
        <div class="memoria-formula">Magnitud: kv = ±${kvI.ratio}·kh = ±${kvI.kvMagnitud.toFixed(4)}</div>
        <table class="kv-table">
          <thead>
            <tr><th>Caso</th><th>Escenario</th><th>kv</th><th>ψ</th><th>Estado</th></tr>
          </thead>
          <tbody>${escenariosHtml}</tbody>
        </table>
        <div class="memoria-nota" style="margin-top:6px;">${kvI.advertencia}</div>
        <div class="memoria-ref">${kvI.refNota1}</div>
      </div>
    </div>
  `;
}

function renderSpectrum(result) {
  const canvas = document.getElementById('spectrum-chart');
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
window.setEspectroMode = setEspectroMode;
window.onModoPeriodoChange = onModoPeriodoChange;
window.onTipoGeoChange = onTipoGeoChange;
window.onMetodoKhChange = onMetodoKhChange;
