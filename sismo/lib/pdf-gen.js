// ============================================================
// SISMOPANAMA v1.0.2 - Generador PDF
// © LMM Ingeniería 2026
// ============================================================

async function generarReportePDF(resultado, coord, espectroChart) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const PAGE_W = 215.9;
  const PAGE_H = 279.4;
  const MARGIN = 15;
  const CONTENT_W = PAGE_W - 2 * MARGIN;
  let y = MARGIN;

  const PRIMARY = [30, 58, 95];
  const ACCENT = [45, 106, 159];
  const HIGHLIGHT = [74, 144, 196];
  const TEXT = [26, 26, 46];
  const GRAY = [107, 114, 128];
  const SOFT = [245, 247, 250];

  // HEADER
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, PAGE_W, 24, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, 24, PAGE_W, 1.5, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('SISMO·PANAMA', MARGIN, 13);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...HIGHLIGHT);
  doc.text('REPORTE DE DISEÑO SÍSMICO — REP-21', MARGIN, 19);
  
  const fecha = new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(fecha, PAGE_W - MARGIN, 13, { align: 'right' });
  
  const hash = generarHash(coord, resultado);
  doc.setFontSize(7);
  doc.setTextColor(...HIGHLIGHT);
  doc.text(`ID: ${hash}`, PAGE_W - MARGIN, 19, { align: 'right' });
  
  y = 34;

  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Parámetros Sísmicos de Diseño', MARGIN, y);
  y += 8;

  // 1. UBICACIÓN
  y = seccionTitulo(doc, '1. Ubicación del Proyecto', y, MARGIN, ACCENT);
  y = renderTabla(doc, [
    ['Latitud',  `${coord.lat.toFixed(4)}° N`],
    ['Longitud', `${coord.lng.toFixed(4)}° W`],
    ['UTM 17N (Este)',  `${coord.utm.e.toLocaleString('es-PA')} m`],
    ['UTM 17N (Norte)', `${coord.utm.n.toLocaleString('es-PA')} m`],
  ], y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);

  // 2. MAPA
  y = seccionTitulo(doc, '2. Aceleraciones del Mapa REP-21', y, MARGIN, ACCENT);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Clase Sitio B, periodo retorno 2500 años, 5% amortiguamiento.', MARGIN, y);
  y += 5;
  y = renderTabla(doc, [
    ['PGA (T = 0 s)',  `${resultado.input.pga.toFixed(3)} g`],
    ['Ss (T = 0.2 s)', `${resultado.input.ss.toFixed(3)} g`],
    ['S₁ (T = 1.0 s)', `${resultado.input.s1.toFixed(3)} g`],
  ], y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);

  // 3. METODOLOGÍA
  y = seccionTitulo(doc, '3. Metodología', y, MARGIN, ACCENT);
  y = renderTabla(doc, [['Norma aplicada', resultado.metodo]], y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);

  // ROUTING SEGÚN TIPO
  if (resultado.input.tipoEstructura === 'vivienda') {
    y = reporteVivienda(doc, resultado, y, MARGIN, CONTENT_W, PAGE_H, ACCENT, PRIMARY, HIGHLIGHT, SOFT, TEXT, GRAY);
  } else if (resultado.input.tipoEstructura === 'geotecnica') {
    y = reporteGeotecnia(doc, resultado, y, MARGIN, CONTENT_W, PAGE_H, ACCENT, PRIMARY, HIGHLIGHT, SOFT, TEXT, GRAY);
  } else {
    y = await reporteEdificio(doc, resultado, espectroChart, y, MARGIN, CONTENT_W, PAGE_H, ACCENT, PRIMARY, HIGHLIGHT, SOFT, TEXT, GRAY);
  }

  // ADVERTENCIAS
  if (resultado.advertencias && resultado.advertencias.length > 0) {
    y = checkPageBreak(doc, y, PAGE_H, 30 + 6 * resultado.advertencias.length, MARGIN);
    y += 3;
    const altura = 6 + 5 * resultado.advertencias.length + 3;
    doc.setFillColor(255, 251, 235);
    doc.rect(MARGIN, y, CONTENT_W, altura, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('AVISOS:', MARGIN + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let yAdv = y + 10;
    resultado.advertencias.forEach(adv => {
      const lines = doc.splitTextToSize('• ' + adv, CONTENT_W - 6);
      doc.text(lines, MARGIN + 3, yAdv);
      yAdv += 5 * lines.length;
    });
    y = yAdv + 3;
  }

  // REFERENCIAS
  y = checkPageBreak(doc, y, PAGE_H, 50, MARGIN);
  y = seccionTitulo(doc, 'Referencias Normativas', y, MARGIN, ACCENT);
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const refs = [
    '• REP-2021 — Reglamento para el Diseño Estructural Panameño.',
    '  Resolución JTIA-020-2022, Gaceta Oficial Digital N° 29594-A (05/08/2022).',
    '• ASCE/SEI 7-05 — Minimum Design Loads for Buildings and Other Structures.',
    '• Mapas de aceleración: REP-21 Anexo 3.',
  ];
  refs.forEach(ref => {
    const lines = doc.splitTextToSize(ref, CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += 4 * lines.length;
  });

  // DISCLAIMER
  y += 4;
  y = checkPageBreak(doc, y, PAGE_H, 35, MARGIN);
  doc.setFillColor(254, 226, 226);
  doc.rect(MARGIN, y, CONTENT_W, 28, 'F');
  doc.setTextColor(127, 29, 29);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('AVISO DE RESPONSABILIDAD', MARGIN + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const disclaimer = 'Esta es una herramienta generada por LMM Ingeniería para uso de referencia. Los valores se derivan de los mapas oficiales del REP-2021. El usuario es responsable de verificar los resultados contra el reglamento oficial. Esta herramienta no sustituye el juicio profesional de un ingeniero estructural idóneo. La responsabilidad del diseño sísmico recae enteramente sobre el profesional firmante.';
  const dlines = doc.splitTextToSize(disclaimer, CONTENT_W - 6);
  doc.text(dlines, MARGIN + 3, y + 10);

  // FOOTER en todas las páginas
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Aplicación desarrollada por LMM Ingeniería', MARGIN, PAGE_H - 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Página ${p} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
    doc.setFontSize(6);
    doc.text('sismopanama · lmmtool.github.io/sismo', PAGE_W / 2, PAGE_H - 8, { align: 'center' });
  }

  doc.setProperties({
    title: `Reporte Sísmico REP-21 - ${hash}`,
    subject: 'Parámetros Sísmicos de Diseño según REP-21',
    author: 'LMM Ingeniería',
    keywords: 'REP-21, sísmico, Panamá',
    creator: 'SismoPanamá - LMM Ingeniería'
  });

  return doc;
}

// ============================================================
// REPORTE EDIFICIO
// ============================================================
async function reporteEdificio(doc, r, chart, y, MARGIN, CW, PH, ACCENT, PRIMARY, HIGHLIGHT, SOFT, TEXT, GRAY) {
  y = seccionTitulo(doc, '4. Parámetros de Entrada', y, MARGIN, ACCENT);
  const tipoLabel = r.input.tipoEstructura === 'infra' 
    ? 'Infraestructura Grupo 2 (1000 años)' : 'Edificio (Grupo 1, 2500 años)';
  y = renderTabla(doc, [
    ['Tipo', tipoLabel],
    ['Clase de sitio', r.input.claseSitio],
    ['Categoría de riesgo', `${r.input.riesgo} (Ie = ${r.Ie})`],
    ['Sistema estructural', r.sistema.nombre],
    ['Período T', `${r.input.periodo.toFixed(3)} s`],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);

  y = seccionTitulo(doc, '5. Factores de Sitio (ASCE 7-05)', y, MARGIN, ACCENT);
  y = renderTabla(doc, [
    ['Fa', r.Fa.toFixed(3)],
    ['Fv', r.Fv.toFixed(3)],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);

  y = seccionTitulo(doc, '6. Aceleraciones Ajustadas', y, MARGIN, ACCENT);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text('SMS = Fa·Ss   SM1 = Fv·S₁   SDS = (2/3)·SMS   SD1 = (2/3)·SM1', MARGIN, y);
  y += 5;
  y = renderTabla(doc, [
    ['SMS', `${r.SMS.toFixed(3)} g`],
    ['SM1', `${r.SM1.toFixed(3)} g`],
    ['SDS', `${r.SDS.toFixed(3)} g`],
    ['SD1', `${r.SD1.toFixed(3)} g`],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);

  y = checkPageBreak(doc, y, PH, 50, MARGIN);
  y = seccionTitulo(doc, '7. Categoría de Diseño Sísmico', y, MARGIN, ACCENT);
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN, y, CW, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(`CDS = ${r.CDS}`, MARGIN + 5, y + 8);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Tablas 11.6-1, 11.6-2 ASCE 7-05', PAGE_W_LETTER - MARGIN - 5, y + 8, { align: 'right' });
  y += 16;

  y = seccionTitulo(doc, '8. Sistema Estructural', y, MARGIN, ACCENT);
  y = renderTabla(doc, [
    ['R', r.R.toFixed(2)],
    ['Ω₀', r.omega.toFixed(2)],
    ['Cd', r.Cd.toFixed(2)],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);

  if (r.sistema.isCustom) {
    doc.setFillColor(255, 251, 235);
    doc.rect(MARGIN, y, CW, 12, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('ADVERTENCIA:', MARGIN + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text('R, Ω₀, Cd ingresados manualmente. Verificar contra Tabla 12.2-1 ASCE 7-05.', MARGIN + 3, y + 9);
    y += 16;
  }

  y = checkPageBreak(doc, y, PH, 50, MARGIN);
  y = seccionTitulo(doc, '9. Coeficiente Sísmico Cs', y, MARGIN, ACCENT);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text('Cs = SDS/(R/Ie)   Mínimo REP-21 sec. 5.2.1: Cs ≥ 0.044·SDS·Ie ≥ 0.01', MARGIN, y);
  y += 5;
  y = renderTabla(doc, [
    ['Cs básico', r.Cs_basico.toFixed(4)],
    ['Cs máximo', r.Cs_max.toFixed(4)],
    ['Cs mínimo', r.Cs_min.toFixed(4)],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);
  
  doc.setFillColor(...PRIMARY);
  doc.rect(MARGIN, y, CW, 16, 'F');
  doc.setTextColor(...HIGHLIGHT);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('COEFICIENTE SÍSMICO DE DISEÑO', MARGIN + 5, y + 7);
  doc.setFontSize(20); doc.setTextColor(255, 255, 255);
  doc.text(`Cs = ${r.Cs.toFixed(4)}`, PAGE_W_LETTER - MARGIN - 5, y + 10, { align: 'right' });
  y += 20;

  if (chart) {
    y = checkPageBreak(doc, y, PH, 100, MARGIN);
    y = seccionTitulo(doc, '10. Espectro de Diseño', y, MARGIN, ACCENT);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text(`T₀ = ${r.T0.toFixed(3)} s   Ts = ${r.Ts.toFixed(3)} s   TL = ${r.TL.toFixed(1)} s`, MARGIN, y);
    y += 5;
    const chartImg = chart.toBase64Image();
    doc.addImage(chartImg, 'PNG', MARGIN, y, CW, 80);
    y += 84;
  }
  return y;
}

// ============================================================
// REPORTE VIVIENDA
// ============================================================
function reporteVivienda(doc, r, y, MARGIN, CW, PH, ACCENT, PRIMARY, HIGHLIGHT, SOFT, TEXT, GRAY) {
  y = seccionTitulo(doc, '4. Parámetros del Sitio', y, MARGIN, ACCENT);
  y = renderTabla(doc, [
    ['Clase de sitio', r.input.claseSitio],
    ['PGA del sitio', `${r.PGA.toFixed(3)} g`],
    ['Zona de sismicidad', r.zonaPGA],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);

  y = seccionTitulo(doc, '5. Densidad Mínima de Paredes (d)', y, MARGIN, ACCENT);
  
  doc.setFillColor(...PRIMARY);
  doc.rect(MARGIN, y, CW, 16, 'F');
  doc.setTextColor(...HIGHLIGHT);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('DENSIDAD MÍNIMA REQUERIDA', MARGIN + 5, y + 7);
  doc.setFontSize(20); doc.setTextColor(255, 255, 255);
  doc.text(`d = ${r.densidadMinima.toFixed(1)} %`, PAGE_W_LETTER - MARGIN - 5, y + 10, { align: 'right' });
  y += 20;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text('REP-21 Cap. 7.4 - Tabla densidad mínima de paredes según PGA del sitio.', MARGIN, y);
  y += 8;

  y = seccionTitulo(doc, '6. Clasificación de la Construcción', y, MARGIN, ACCENT);
  if (r.calificaTipica) {
    doc.setFillColor(220, 252, 231);
    doc.rect(MARGIN, y, CW, 14, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('CALIFICA COMO CONSTRUCCIÓN TÍPICA', MARGIN + 5, y + 8);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('REP-21 sec. 7.3-7.4', PAGE_W_LETTER - MARGIN - 5, y + 8, { align: 'right' });
    y += 18;
  } else {
    const altura = 18 + 5 * r.triggersNoTipica.length;
    doc.setFillColor(255, 251, 235);
    doc.rect(MARGIN, y, CW, altura, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('NO CALIFICA COMO CONSTRUCCIÓN TÍPICA', MARGIN + 5, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('Triggers detectados:', MARGIN + 5, y + 13);
    doc.setFont('helvetica', 'normal');
    let yT = y + 18;
    r.triggersNoTipica.forEach(t => {
      doc.text(`• ${t}`, MARGIN + 8, yT);
      yT += 5;
    });
    y = yT + 4;
  }

  y = seccionTitulo(doc, '7. Parámetros de Mampostería Confinada', y, MARGIN, ACCENT);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text('REP-21 sec. 7.4.2.3 (para diseño completo si no califica como típica)', MARGIN, y);
  y += 5;
  y = renderTabla(doc, [
    ['R', r.R.toFixed(2)],
    ['Ω₀', r.omega.toFixed(2)],
    ['Cd', r.Cd.toFixed(2)],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);

  return y;
}

// ============================================================
// REPORTE GEOTECNIA
// ============================================================
function reporteGeotecnia(doc, r, y, MARGIN, CW, PH, ACCENT, PRIMARY, HIGHLIGHT, SOFT, TEXT, GRAY) {
  y = seccionTitulo(doc, '4. Parámetros Geotécnicos', y, MARGIN, ACCENT);
  y = renderTabla(doc, [
    ['Subtipo geotécnico', r.tipoGeotecnico],
    ['Clase de sitio', r.input.claseSitio],
    ['Fa (factor de sitio)', r.Fa.toFixed(3)],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);

  y = seccionTitulo(doc, '5. Aceleraciones de Diseño', y, MARGIN, ACCENT);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text('REP-21 Cap. 6: factor 2/3 aplicado al PGA.', MARGIN, y);
  y += 5;
  y = renderTabla(doc, [
    ['PGA del mapa (Clase B)', `${r.PGA_mapa.toFixed(3)} g`],
    ['PGA ajustado al sitio (× Fa)', `${r.PGA_sitio.toFixed(3)} g`],
    ['PGA de diseño (× 2/3)', `${r.PGA_diseno.toFixed(3)} g`],
    ['PGA de diseño ajustado al sitio', `${r.PGA_diseno_sitio.toFixed(3)} g`],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);

  y = checkPageBreak(doc, y, PH, 50, MARGIN);
  y = seccionTitulo(doc, '6. Coeficientes Sísmicos Pseudoestáticos', y, MARGIN, ACCENT);
  
  doc.setFillColor(...PRIMARY);
  doc.rect(MARGIN, y, CW, 20, 'F');
  doc.setTextColor(...HIGHLIGHT);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('COEFICIENTE HORIZONTAL', MARGIN + 5, y + 6);
  doc.text('COEFICIENTE VERTICAL', PAGE_W_LETTER / 2 + 5, y + 6);
  doc.setFontSize(16); doc.setTextColor(255, 255, 255);
  doc.text(`kh = ${r.kh.toFixed(4)}`, MARGIN + 5, y + 15);
  doc.text(`kv = ${r.kv.toFixed(4)}`, PAGE_W_LETTER / 2 + 5, y + 15);
  y += 24;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text(r.kvDescripcion, MARGIN, y);
  y += 8;

  y = seccionTitulo(doc, '7. Ángulo de Inercia Sísmico (ψ)', y, MARGIN, ACCENT);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text('Para análisis Mononobe-Okabe: tan(ψ) = kh / (1 - kv)', MARGIN, y);
  y += 5;
  y = renderTabla(doc, [
    ['ψ (radianes)', r.psi_rad.toFixed(4)],
    ['ψ (grados)', `${r.psi_deg.toFixed(2)}°`],
  ], y, MARGIN, CW, SOFT, TEXT, GRAY);

  return y;
}

// Helpers
const PAGE_W_LETTER = 215.9;

function checkPageBreak(doc, y, PH, needed, MARGIN) {
  if (y + needed > PH - 20) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function seccionTitulo(doc, texto, y, x, color) {
  doc.setFillColor(...color);
  doc.rect(x, y, 3, 6, 'F');
  doc.setTextColor(30, 58, 95);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(texto, x + 5, y + 4.5);
  return y + 9;
}

function renderTabla(doc, rows, y, x, width, softColor, textColor, grayColor) {
  const rowH = 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rows.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...softColor);
      doc.rect(x, y, width, rowH, 'F');
    }
    doc.setTextColor(...grayColor);
    doc.text(row[0], x + 2, y + 4);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text(row[1], x + width - 2, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += rowH;
  });
  return y + 3;
}

function generarHash(coord, resultado) {
  const cs_val = resultado.Cs || resultado.kh || resultado.densidadMinima || 0;
  const str = `${coord.lat.toFixed(4)}${coord.lng.toFixed(4)}${cs_val.toFixed(4)}${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').substring(0, 6);
  const dateCode = new Date().toISOString().substring(0, 10).replace(/-/g, '');
  return `SP-${dateCode}-${hexHash}`;
}

window.PDFGen = { generarReportePDF };
