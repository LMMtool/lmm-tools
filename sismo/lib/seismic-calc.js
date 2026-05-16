// ============================================================
// SISMOPANAMA v1.0.2 - Cálculos sísmicos REP-21
// © LMM Ingeniería 2026
// ============================================================

// Tablas Fa y Fv (ASCE 7-05)
const FA_TABLE = {
  'A': [0.8, 0.8, 0.8, 0.8, 0.8],
  'B': [1.0, 1.0, 1.0, 1.0, 1.0],
  'C': [1.2, 1.2, 1.1, 1.0, 1.0],
  'D': [1.6, 1.4, 1.2, 1.1, 1.0],
  'E': [2.5, 1.7, 1.2, 0.9, 0.9],
  'F': null
};
const FA_SS_POINTS = [0.25, 0.50, 0.75, 1.00, 1.25];
const FV_TABLE = {
  'A': [0.8, 0.8, 0.8, 0.8, 0.8],
  'B': [1.0, 1.0, 1.0, 1.0, 1.0],
  'C': [1.7, 1.6, 1.5, 1.4, 1.3],
  'D': [2.4, 2.0, 1.8, 1.6, 1.5],
  'E': [3.5, 3.2, 2.8, 2.4, 2.4],
  'F': null
};
const FV_S1_POINTS = [0.10, 0.20, 0.30, 0.40, 0.50];

function interpolateFactor(table, points, classType, value) {
  if (classType === 'F') return null;
  const row = table[classType];
  if (!row) return null;
  if (value <= points[0]) return row[0];
  if (value >= points[points.length - 1]) return row[row.length - 1];
  for (let i = 0; i < points.length - 1; i++) {
    if (value >= points[i] && value <= points[i + 1]) {
      const t = (value - points[i]) / (points[i + 1] - points[i]);
      return row[i] + t * (row[i + 1] - row[i]);
    }
  }
  return row[row.length - 1];
}

const IE_TABLE = {
  'I':   { Ie: 1.00, descripcion: 'Estructuras de bajo riesgo' },
  'II':  { Ie: 1.00, descripcion: 'Estructuras ordinarias' },
  'III': { Ie: 1.25, descripcion: 'Estructuras importantes' },
  'IV':  { Ie: 1.50, descripcion: 'Estructuras esenciales' }
};

const SISTEMAS_ESTRUCTURALES = {
  'concreto': {
    label: 'Concreto Reforzado',
    sistemas: {
      'concreto-smrf':  { nombre: 'Pórticos especiales resistentes a momento (SMRF)',     R: 8.0, omega: 3.0, Cd: 5.5 },
      'concreto-imrf':  { nombre: 'Pórticos intermedios resistentes a momento (IMRF)',    R: 5.0, omega: 3.0, Cd: 4.5 },
      'concreto-omrf':  { nombre: 'Pórticos ordinarios resistentes a momento (OMRF)',     R: 3.0, omega: 3.0, Cd: 2.5 },
      'concreto-msw':   { nombre: 'Muros estructurales especiales (Shear Wall)',          R: 5.0, omega: 2.5, Cd: 5.0 },
      'concreto-mow':   { nombre: 'Muros estructurales ordinarios',                       R: 4.0, omega: 2.5, Cd: 4.0 },
      'concreto-dual-s':{ nombre: 'Dual: SMRF + muros especiales',                        R: 7.0, omega: 2.5, Cd: 5.5 },
      'concreto-dual-i':{ nombre: 'Dual: IMRF + muros ordinarios',                        R: 5.5, omega: 2.5, Cd: 4.5 },
      'concreto-prefab':{ nombre: 'Muros de concreto prefabricado intermedios',           R: 4.0, omega: 2.5, Cd: 4.0 },
    }
  },
  'acero': {
    label: 'Acero',
    sistemas: {
      'acero-smf':  { nombre: 'Pórticos especiales resistentes a momento (SMF)',          R: 8.0,  omega: 3.0, Cd: 5.5 },
      'acero-imf':  { nombre: 'Pórticos intermedios resistentes a momento (IMF)',         R: 4.5,  omega: 3.0, Cd: 4.0 },
      'acero-omf':  { nombre: 'Pórticos ordinarios resistentes a momento (OMF)',          R: 3.5,  omega: 3.0, Cd: 3.0 },
      'acero-scbf': { nombre: 'Pórticos arriostrados concéntricamente especiales (SCBF)', R: 6.0,  omega: 2.0, Cd: 5.0 },
      'acero-ocbf': { nombre: 'Pórticos arriostrados concéntricamente ordinarios (OCBF)', R: 3.25, omega: 2.0, Cd: 3.25 },
      'acero-ebf':  { nombre: 'Pórticos arriostrados excéntricamente (EBF)',              R: 8.0,  omega: 2.0, Cd: 4.0 },
    }
  },
  'mamposteria': {
    label: 'Mampostería',
    sistemas: {
      'mamp-especial':  { nombre: 'Muros de mampostería reforzada especiales',     R: 5.0, omega: 2.5, Cd: 3.5 },
      'mamp-intermedio':{ nombre: 'Muros de mampostería reforzada intermedios',    R: 3.5, omega: 2.5, Cd: 2.25 },
      'mamp-ordinario': { nombre: 'Muros de mampostería reforzada ordinarios',     R: 2.0, omega: 2.5, Cd: 1.75 },
    }
  },
  'otros': {
    label: 'Otros',
    sistemas: {
      'cant-columns':  { nombre: 'Sistema de columnas en voladizo',                 R: 2.5, omega: 2.0, Cd: 2.5 },
      'light-frame':   { nombre: 'Sistema de muros livianos enmarcados',            R: 6.5, omega: 3.0, Cd: 4.0 },
      'custom':        { nombre: 'Otro / Personalizado (ingresar R, Ω₀, Cd)',       R: null, omega: null, Cd: null, isCustom: true },
    }
  }
};

const TIPOS_GEOTECNICA = {
  'muro-retencion':   'Muro de retención (gravedad / cantilever)',
  'muro-gaviones':    'Muro de gaviones',
  'geocelda':         'Sistema de geocelda',
  'tablestaca':       'Pantalla anclada / Tablestaca',
  'talud':            'Talud / Corte / Terraplén',
  'pilote':           'Cimiento profundo (pilote)',
  'cimiento-super':   'Cimiento superficial sometido a sismo',
  'otro-geotecnico':  'Otra estructura geotécnica'
};

function cdsBySDS(sds, riesgo) {
  const isHigh = (riesgo === 'IV');
  if (sds < 0.167) return 'A';
  if (sds < 0.33)  return 'B';
  if (sds < 0.50)  return isHigh ? 'D' : 'C';
  return 'D';
}
function cdsBySD1(sd1, riesgo) {
  const isHigh = (riesgo === 'IV');
  if (sd1 < 0.067) return 'A';
  if (sd1 < 0.133) return 'B';
  if (sd1 < 0.20)  return isHigh ? 'D' : 'C';
  return 'D';
}
function categoriaDisenoSismico(sds, sd1, s1, riesgo) {
  if (s1 >= 0.75) {
    return (riesgo === 'IV') ? 'F' : 'E';
  }
  const cds1 = cdsBySDS(sds, riesgo);
  const cds2 = cdsBySD1(sd1, riesgo);
  const orden = ['A', 'B', 'C', 'D', 'E', 'F'];
  return orden[Math.max(orden.indexOf(cds1), orden.indexOf(cds2))];
}

// ============================================================
// MÉTODO 1: EDIFICIO / INFRAESTRUCTURA (ASCE 7-05 + REP-21)
// ============================================================
function calcularEdificio(input) {
  const result = {
    metodo: 'ASCE 7-05 + REP-21',
    input: { ...input },
    valido: true,
    advertencias: [],
    errores: []
  };

  let ss_eff = input.ss;
  let s1_eff = input.s1;
  let pga_eff = input.pga;

  result.ss_efectivo = ss_eff;
  result.s1_efectivo = s1_eff;
  result.pga_efectivo = pga_eff;

  if (input.claseSitio === 'F') {
    result.errores.push('CLASE DE SITIO F. Requiere estudio específico de sitio (REP-21 sec. 5.11 y ASCE 7-05 sec. 21). Esta herramienta no calcula para Clase F. Debe realizarse análisis dinámico de respuesta de sitio.');
    result.valido = false;
    return result;
  }

  result.Fa = interpolateFactor(FA_TABLE, FA_SS_POINTS, input.claseSitio, ss_eff);
  result.Fv = interpolateFactor(FV_TABLE, FV_S1_POINTS, input.claseSitio, s1_eff);

  result.SMS = result.Fa * ss_eff;
  result.SM1 = result.Fv * s1_eff;
  result.SDS = (2/3) * result.SMS;
  result.SD1 = (2/3) * result.SM1;

  result.Ie = IE_TABLE[input.riesgo].Ie;
  result.CDS = categoriaDisenoSismico(result.SDS, result.SD1, s1_eff, input.riesgo);

  // Sistema estructural
  let sistemaInfo = null;
  if (input.sistemaKey === 'custom') {
    if (!input.customR || !input.customOmega || !input.customCd) {
      result.errores.push('Para sistema personalizado debe ingresar R, Ω₀ y Cd.');
      result.valido = false;
      return result;
    }
    sistemaInfo = {
      nombre: 'Sistema personalizado (valores manuales)',
      R: parseFloat(input.customR),
      omega: parseFloat(input.customOmega),
      Cd: parseFloat(input.customCd),
      isCustom: true
    };
    result.advertencias.push('Sistema personalizado: valores R, Ω₀, Cd ingresados manualmente. Verificar contra Tabla 12.2-1 ASCE 7-05.');
  } else {
    for (const cat of Object.values(SISTEMAS_ESTRUCTURALES)) {
      if (cat.sistemas[input.sistemaKey]) {
        sistemaInfo = cat.sistemas[input.sistemaKey];
        break;
      }
    }
  }
  if (!sistemaInfo) {
    result.errores.push('Sistema estructural no encontrado.');
    result.valido = false;
    return result;
  }
  result.sistema = sistemaInfo;
  result.R = sistemaInfo.R;
  result.omega = sistemaInfo.omega;
  result.Cd = sistemaInfo.Cd;

  result.T0 = 0.2 * result.SD1 / result.SDS;
  result.Ts = result.SD1 / result.SDS;
  result.TL = 10.0;

  const T = input.periodo;
  let Cs_basico = result.SDS / (result.R / result.Ie);
  let Cs_max;
  if (T <= result.TL) {
    Cs_max = result.SD1 / (T * (result.R / result.Ie));
  } else {
    Cs_max = result.SD1 * result.TL / (T * T * (result.R / result.Ie));
  }
  let Cs_calculado = Math.min(Cs_basico, Cs_max);
  const Cs_min_REP21 = Math.max(0.044 * result.SDS * result.Ie, 0.01);
  let Cs_min_S1 = 0;
  if (s1_eff >= 0.6) {
    Cs_min_S1 = 0.5 * s1_eff / (result.R / result.Ie);
  }
  const Cs_minimo_aplicable = Math.max(Cs_min_REP21, Cs_min_S1);

  result.Cs_basico = Cs_basico;
  result.Cs_max = Cs_max;
  result.Cs_min = Cs_minimo_aplicable;
  result.Cs = Math.max(Cs_calculado, Cs_minimo_aplicable);
  result.Cs_gobierna = (result.Cs === Cs_minimo_aplicable && Cs_minimo_aplicable > Cs_calculado)
    ? 'mínimo' : (Cs_basico < Cs_max ? 'básico' : 'máximo');

  return result;
}

// ============================================================
// MÉTODO 2: VIVIENDA UNIFAMILIAR (REP-21 Cap. 7)
// Metodología simplificada - NO usa ASCE completo
// ============================================================
function calcularVivienda(input) {
  const result = {
    metodo: 'REP-21 Capítulo 7 (Vivienda Unifamiliar)',
    input: { ...input },
    valido: true,
    advertencias: [],
    errores: []
  };

  if (input.claseSitio === 'F') {
    result.errores.push('CLASE DE SITIO F. Para vivienda en suelos F, REP-21 sec. 7.4 indica que NO califica como construcción típica. Requiere diseño completo por ingeniero estructural.');
    result.valido = false;
    return result;
  }

  // Suelos E/F: vivienda no califica como típica
  if (input.claseSitio === 'E') {
    result.advertencias.push('Suelo Clase E: REP-21 sec. 7.4 indica que la vivienda NO califica para construcción típica. Requiere diseño completo según otros capítulos.');
  }

  // PGA: el mapa REP-21 está en Clase B, no se ajusta para vivienda (no aplica espectro)
  // El PGA se usa tal cual del mapa para decidir densidad de paredes
  result.PGA = input.pga;

  // Tabla densidad mínima de paredes (REP-21 Cap. 7.4)
  if (result.PGA <= 0.25) {
    result.densidadMinima = 2.0;
    result.zonaPGA = 'PGA ≤ 0.25 g (baja sismicidad)';
  } else if (result.PGA <= 0.40) {
    result.densidadMinima = 3.5;
    result.zonaPGA = '0.25 < PGA ≤ 0.40 g (sismicidad moderada)';
  } else {
    result.densidadMinima = 5.0;
    result.zonaPGA = 'PGA > 0.40 g (alta sismicidad)';
  }

  // Triggers que invalidan construcción típica (REP-21 sec. 7.4)
  result.triggersNoTipica = [];
  if (result.PGA >= 0.40) {
    result.triggersNoTipica.push('PGA ≥ 0.40 g — zona de alta sismicidad');
  }
  if (input.claseSitio === 'E' || input.claseSitio === 'F') {
    result.triggersNoTipica.push(`Suelo Clase ${input.claseSitio}`);
  }
  if (input.suelosProblema) {
    result.triggersNoTipica.push('Arcillas expansivas o suelos susceptibles a licuación (declarado por usuario)');
  }
  if (input.irregularidad) {
    result.triggersNoTipica.push('Irregularidad horizontal (Tabla 12.3-1 ASCE 7-05)');
  }

  result.calificaTipica = result.triggersNoTipica.length === 0;

  if (!result.calificaTipica) {
    result.advertencias.push('Esta vivienda NO califica como "construcción típica" según REP-21 sec. 7.4. Debe diseñarse como estructura completa de mampostería usando los capítulos correspondientes (R=1.5, Ω₀=2.5, Cd=1.25).');
  }

  // Parámetros sísmicos de mampostería confinada (REP-21 sec. 7.4.2.3)
  result.R = 1.5;
  result.omega = 2.5;
  result.Cd = 1.25;

  return result;
}

// ============================================================
// MÉTODO 3: ESTRUCTURAS GEOTÉCNICAS (REP-21 Cap. 6)
// Pseudoestático - NO usa ASCE completo
// ============================================================
function calcularGeotecnia(input) {
  const result = {
    metodo: 'REP-21 Capítulo 6 (Análisis Pseudoestático)',
    input: { ...input },
    valido: true,
    advertencias: [],
    errores: []
  };

  if (input.claseSitio === 'F') {
    result.errores.push('CLASE DE SITIO F. Requiere análisis dinámico específico de sitio. Esta herramienta no calcula para Clase F en estructuras geotécnicas.');
    result.valido = false;
    return result;
  }

  // PGA del mapa (clase B)
  result.PGA_mapa = input.pga;

  // Aceleración de diseño geotécnico (REP-21 Cap. 6 factor 2/3)
  result.PGA_diseno = input.pga * (2/3);

  // Coeficiente sísmico horizontal (kh)
  // Para análisis pseudoestático Mononobe-Okabe / equivalente
  // kh = PGA_diseño / g  (PGA ya está en g)
  result.kh = result.PGA_diseno;

  // Coeficiente sísmico vertical (kv)
  // Opciones según REP-21 / práctica geotécnica: 0, kh/2 (positivo), -kh/2 (negativo)
  const kvOption = input.kvOption || '0';
  if (kvOption === '0') {
    result.kv = 0;
    result.kvDescripcion = 'kv = 0 (componente vertical no considerada)';
  } else if (kvOption === 'pos') {
    result.kv = result.kh / 2;
    result.kvDescripcion = 'kv = +kh/2 (componente vertical hacia abajo, caso desfavorable)';
  } else if (kvOption === 'neg') {
    result.kv = -result.kh / 2;
    result.kvDescripcion = 'kv = -kh/2 (componente vertical hacia arriba)';
  }

  // Ángulo de inercia sísmico (psi) para Mononobe-Okabe
  // tan(psi) = kh / (1 - kv)  → ángulo equivalente que se suma al peso del suelo
  const denom = 1 - result.kv;
  const tanPsi = result.kh / denom;
  result.psi_rad = Math.atan(tanPsi);
  result.psi_deg = result.psi_rad * 180 / Math.PI;

  // Aceleración pico ajustada al sitio (informativo - aplica factor de sitio si quiere)
  result.Fa = interpolateFactor(FA_TABLE, FA_SS_POINTS, input.claseSitio, input.ss);
  result.PGA_sitio = result.PGA_mapa * result.Fa;
  result.PGA_diseno_sitio = result.PGA_sitio * (2/3);

  result.tipoGeotecnico = TIPOS_GEOTECNICA[input.tipoGeotecnia] || 'Estructura geotécnica';

  result.advertencias.push('Estructura geotécnica: análisis pseudoestático según REP-21 Cap. 6. Factor 2/3 aplicado al PGA.');
  
  if (input.tipoGeotecnia === 'muro-retencion' || input.tipoGeotecnia === 'muro-gaviones' || input.tipoGeotecnia === 'tablestaca') {
    result.advertencias.push('Para análisis de empuje sísmico aplicar Mononobe-Okabe con los coeficientes kh y kv calculados.');
  } else if (input.tipoGeotecnia === 'talud') {
    result.advertencias.push('Para análisis de estabilidad de talud usar el coeficiente kh en métodos de equilibrio límite (Bishop, Spencer, Janbu, etc.).');
  } else if (input.tipoGeotecnia === 'pilote') {
    result.advertencias.push('Para pilotes considerar interacción cinemática suelo-pilote (REP-21 sec. 5.9). Análisis dinámico recomendado.');
  }

  return result;
}

// ============================================================
// DISPATCHER PRINCIPAL
// ============================================================
function calcularSismico(input) {
  if (input.tipoEstructura === 'vivienda') {
    return calcularVivienda(input);
  } else if (input.tipoEstructura === 'geotecnica') {
    return calcularGeotecnia(input);
  } else {
    return calcularEdificio(input);
  }
}

function generarEspectro(SDS, SD1, T0, Ts, TL, Tmax) {
  Tmax = Tmax || 4.0;
  const puntos = [];
  for (let T = 0; T <= Tmax; T += 0.02) {
    let Sa;
    if (T < T0) Sa = SDS * (0.4 + 0.6 * T / T0);
    else if (T <= Ts) Sa = SDS;
    else if (T <= TL) Sa = SD1 / T;
    else Sa = SD1 * TL / (T * T);
    puntos.push({ T: parseFloat(T.toFixed(2)), Sa: Sa });
  }
  return puntos;
}

window.SismicCalc = {
  calcularSismico,
  calcularEdificio,
  calcularVivienda,
  calcularGeotecnia,
  generarEspectro,
  SISTEMAS_ESTRUCTURALES,
  TIPOS_GEOTECNICA,
  IE_TABLE,
  FA_TABLE,
  FV_TABLE
};
