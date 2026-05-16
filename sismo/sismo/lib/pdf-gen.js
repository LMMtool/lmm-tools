// ============================================================
// SISMOPANAMA - Generador de reporte PDF técnico
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

  // Paleta corporativa
  const PRIMARY = [30, 58, 95];     // #1E3A5F
  const ACCENT = [45, 106, 159];    // #2D6A9F
  const HIGHLIGHT = [74, 144, 196]; // #4A90C4
  const TEXT = [26, 26, 46];        // #1A1A2E
  const GRAY = [107, 114, 128];     // #6B7280
  const SOFT = [245, 247, 250];     // #F5F7FA

  // --- HEADER ---
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
  
  const fecha = new Date().toLocaleDateString('es-PA', { 
    year: 'numeric', month: 'long', day: 'numeric'
  });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(fecha, PAGE_W - MARGIN, 13, { align: 'right' });
  
  const hash = generarHash(coord, resultado);
  doc.setFontSize(7);
  doc.setTextColor(...HIGHLIGHT);
  doc.text(`ID: ${hash}`, PAGE_W - MARGIN, 19, { align: 'right' });
  
  y = 34;

  // --- TÍTULO ---
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Parámetros Sísmicos de Diseño', MARGIN, y);
  y += 8;

  // SECCIÓN 1: UBICACIÓN
  y = seccionTitulo(doc, '1. Ubicación del Proyecto', y, MARGIN, ACCENT);
  
  const tabla1 = [
    ['Latitud',  `${coord.lat.toFixed(4)}° N`],
    ['Longitud', `${coord.lng.toFixed(4)}° W`],
    ['UTM 17N (Este)',  `${coord.utm.e.toLocaleString('es-PA')} m`],
    ['UTM 17N (Norte)', `${coord.utm.n.toLocaleString('es-PA')} m`],
  ];
  y = renderTabla(doc, tabla1, y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);

  // SECCIÓN 2: PARÁMETROS DEL MAPA
  y = seccionTitulo(doc, '2. Aceleraciones Espectrales (Mapas REP-21)', y, MARGIN, ACCENT);
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Clase de Sitio B, período de retorno 2500 años, 5% amortiguamiento crítico.', MARGIN, y);
  y += 5;
  
  const tabla2 = [
    ['PGA (T = 0 s)',           `${resultado.input.pga.toFixed(3)} g`],
    ['Ss (T = 0.2 s)',          `${resultado.input.ss.toFixed(3)} g`],
    ['S₁ (T = 1.0 s)',          `${resultado.input.s1.toFixed(3)} g`],
  ];
  if (resultado.input.tipoEstructura === 'geotecnica') {
    tabla2.push(['Factor 2/3 aplicado (REP-21 Cap. 6)', 'Sí']);
    tabla2.push(['PGA efectivo',  `${resultado.pga_efectivo.toFixed(3)} g`]);
    tabla2.push(['Ss efectivo',   `${resultado.ss_efectivo.toFixed(3)} g`]);
    tabla2.push(['S₁ efectivo',   `${resultado.s1_efectivo.toFixed(3)} g`]);
  }
  y = renderTabla(doc, tabla2, y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);

  // SECCIÓN 3: INPUTS
  y = seccionTitulo(doc, '3. Parámetros de Entrada del Usuario', y, MARGIN, ACCENT);
  
  const tipoEstrLabel = {
    'edificio': 'Edificio (Grupo 1, 2500 años)',
    'infra': 'Infraestructura Grupo 2 (1000 años)',
    'vivienda': 'Vivienda Unifamiliar',
    'geotecnica': 'Estructura Geotécnica'
  };
  
  const tabla3 = [
    ['Tipo de estructura',  tipoEstrLabel[resultado.input.tipoEstructura] || resultado.input.tipoEstructura],
  ];
  if (resultado.input.tipoEstructura === 'geotecnica' && resultado.input.tipoGeotecnia) {
    tabla3.push(['Subtipo geotécnico', SismicCalc.TIPOS_GEOTECNICA[resultado.input.tipoGeotecnia] || resultado.input.tipoGeotecnia]);
  }
  tabla3.push(['Clase de sitio',      resultado.input.claseSitio]);
  tabla3.push(['Categoría de riesgo', `${resultado.input.riesgo} (Ie = ${resultado.Ie})`]);
  tabla3.push(['Sistema estructural', resultado.sistema.nombre]);
  tabla3.push(['Período T',           `${resultado.input.periodo.toFixed(3)} s`]);
  
  y = renderTabla(doc, tabla3, y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);

  // SECCIÓN 4: FACTORES DE SITIO
  y = seccionTitulo(doc, '4. Factores de Sitio (Tablas 11.4-1 y 11.4-2 ASCE 7-05)', y, MARGIN, ACCENT);
  
  const tabla4 = [
    ['Fa (factor sitio, período corto)', resultado.Fa.toFixed(3)],
    ['Fv (factor sitio, período largo)', resultado.Fv.toFixed(3)],
  ];
  y = renderTabla(doc, tabla4, y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);

  // SECCIÓN 5: ACELERACIONES AJUSTADAS
  y = seccionTitulo(doc, '5. Aceleraciones Espectrales Ajustadas', y, MARGIN, ACCENT);
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('SMS = Fa·Ss   SM1 = Fv·S₁   SDS = (2/3)·SMS   SD1 = (2/3)·SM1', MARGIN, y);
  y += 5;
  
  const tabla5 = [
    ['SMS (MCE_R período corto)', `${resultado.SMS.toFixed(3)} g`],
    ['SM₁ (MCE_R período largo)', `${resultado.SM1.toFixed(3)} g`],
    ['SDS (Diseño período corto)', `${resultado.SDS.toFixed(3)} g`],
    ['SD₁ (Diseño período largo)', `${resultado.SD1.toFixed(3)} g`],
  ];
  y = renderTabla(doc, tabla5, y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);

  // SECCIÓN 6: CDS
  y = seccionTitulo(doc, '6. Categoría de Diseño Sísmico (CDS)', y, MARGIN, ACCENT);
  
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN, y, CONTENT_W, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`CDS = ${resultado.CDS}`, MARGIN + 5, y + 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Tablas 11.6-1 y 11.6-2 ASCE 7-05', PAGE_W - MARGIN - 5, y + 8, { align: 'right' });
  y += 16;

  if (y > PAGE_H - 80) {
    doc.addPage();
    y = MARGIN;
  }

  // SECCIÓN 7: SISTEMA ESTRUCTURAL
  y = seccionTitulo(doc, '7. Parámetros del Sistema Estructural', y, MARGIN, ACCENT);
  
  const tabla7 = [
    ['R (factor modificación respuesta)', resultado.R.toFixed(2)],
    ['Ω₀ (factor sobre-resistencia)',     resultado.omega.toFixed(2)],
    ['Cd (factor amplificación deflexión)', resultado.Cd.toFixed(2)],
  ];
  y = renderTabla(doc, tabla7, y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);
  
  if (resultado.sistema.isCustom) {
    doc.setFillColor(255, 251, 235);
    doc.rect(MARGIN, y, CONTENT_W, 12, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ADVERTENCIA:', MARGIN + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text('Valores R, Ω₀, Cd ingresados manualmente. Verificar contra Tabla 12.2-1 ASCE 7-05.', MARGIN + 3, y + 9);
    y += 16;
  }

  // SECCIÓN 8: Cs
  y = seccionTitulo(doc, '8. Coeficiente Sísmico Cs', y, MARGIN, ACCENT);
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Cs = SDS / (R/Ie)     Mínimo REP-21 sec. 5.2.1: Cs ≥ 0.044·SDS·Ie ≥ 0.01', MARGIN, y);
  y += 5;
  
  const tabla8 = [
    ['Cs básico (Eq. 12.8-2)',  `${resultado.Cs_basico.toFixed(4)}`],
    ['Cs máximo (Eq. 12.8-3/4)', `${resultado.Cs_max.toFixed(4)}`],
    ['Cs mínimo (REP-21 5.2.1)', `${resultado.Cs_min.toFixed(4)}`],
  ];
  y = renderTabla(doc, tabla8, y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);
  
  // Cs final destacado
  doc.setFillColor(...PRIMARY);
  doc.rect(MARGIN, y, CONTENT_W, 16, 'F');
  doc.setTextColor(...HIGHLIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('COEFICIENTE SÍSMICO DE DISEÑO', MARGIN + 5, y + 7);
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(`Cs = ${resultado.Cs.toFixed(4)}`, PAGE_W - MARGIN - 5, y + 10, { align: 'right' });
  y += 20;

  // SECCIÓN 9: ESPECTRO
  y = seccionTitulo(doc, '9. Espectro de Respuesta de Diseño', y, MARGIN, ACCENT);
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`T₀ = ${resultado.T0.toFixed(3)} s     Ts = ${resultado.Ts.toFixed(3)} s     TL = ${resultado.TL.toFixed(1)} s (Panamá)`, MARGIN, y);
  y += 5;
  
  if (espectroChart) {
    const chartImg = espectroChart.toBase64Image();
    doc.addImage(chartImg, 'PNG', MARGIN, y, CONTENT_W, 80);
    y += 84;
  }

  if (y > PAGE_H - 80) {
    doc.addPage();
    y = MARGIN;
  }

  // SECCIÓN 10: VIVIENDA UNIFAMILIAR
  if (resultado.input.tipoEstructura === 'vivienda' && resultado.viviendaDensidadMin) {
    y = seccionTitulo(doc, '10. Verificación Vivienda Unifamiliar (REP-21 Cap. 7)', y, MARGIN, ACCENT);
    
    const tabla10 = [
      ['PGA del sitio', `${resultado.pga_efectivo.toFixed(3)} g`],
      ['Densidad mínima de paredes (d)', `${resultado.viviendaDensidadMin.toFixed(1)} %`],
    ];
    y = renderTabla(doc, tabla10, y, MARGIN, CONTENT_W, SOFT, TEXT, GRAY);
  }

  // ADVERTENCIAS
  if (resultado.advertencias.length > 0) {
    y += 3;
    const altura = 6 + 5 * resultado.advertencias.length;
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

  // REFERENCIAS NORMATIVAS
  if (y > PAGE_H - 65) {
    doc.addPage();
    y = MARGIN;
  }
  y = seccionTitulo(doc, 'Referencias Normativas', y, MARGIN, ACCENT);
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const refs = [
    '• REP-2021 — Reglamento para el Diseño Estructural Panameño.',
    '  Resolución JTIA-020-2022, Gaceta Oficial Digital N° 29594-A (05/08/2022).',
    '• ASCE/SEI 7-05 — Minimum Design Loads for Buildings and Other Structures.',
    '  Capítulos 11 (Diseño Sísmico), 12 (Estructuras de Edificios), 20 (Clasificación de Sitio).',
    '• Mapas de aceleración: REP-21 Anexo 3 (5% amortiguamiento, 2500 años, Clase Sitio B).',
  ];
  refs.forEach(ref => {
    const lines = doc.splitTextToSize(ref, CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += 4 * lines.length;
  });

  // DISCLAIMER
  y += 4;
  doc.setFillColor(254, 226, 226);
  doc.rect(MARGIN, y, CONTENT_W, 26, 'F');
  doc.setTextColor(127, 29, 29);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('AVISO DE RESPONSABILIDAD', MARGIN + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const disclaimer = 'Esta es una herramienta generada por LMM Ingeniería para uso de referencia. Los valores se derivan ' +
    'de los mapas oficiales del REP-2021. El usuario es responsable de verificar los resultados contra el reglamento ' +
    'oficial y aplicar criterio ingenieril. Esta herramienta no sustituye el juicio profesional de un ingeniero ' +
    'estructural idóneo. La responsabilidad del diseño sísmico recae enteramente sobre el profesional firmante.';
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
    keywords: 'REP-21, sísmico, Panamá, ASCE 7-05, Cs',
    creator: 'SismoPanamá - LMM Ingeniería'
  });

  return doc;
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
  const str = `${coord.lat.toFixed(4)}${coord.lng.toFixed(4)}${resultado.Cs.toFixed(4)}${Date.now()}`;
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
