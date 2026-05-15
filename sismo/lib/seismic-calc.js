// ============================================================
// SISMOPANAMA - Cálculos sísmicos según REP-21 + ASCE 7-05
// © LMM Ingeniería 2026
// ============================================================

// Tabla 11.4-1 ASCE 7-05: Factor de Sitio Fa (período corto)
// Filas: Clase de Sitio. Columnas: Ss
const FA_TABLE = {
  // Clase: [Ss<=0.25, Ss=0.50, Ss=0.75, Ss=1.00, Ss>=1.25]
  'A': [0.8, 0.8, 0.8, 0.8, 0.8],
  'B': [1.0, 1.0, 1.0, 1.0, 1.0],
  'C': [1.2, 1.2, 1.1, 1.0, 1.0],
  'D': [1.6, 1.4, 1.2, 1.1, 1.0],
  'E': [2.5, 1.7, 1.2, 0.9, 0.9],
  'F': null // Requiere estudio específico de sitio
};
const FA_SS_POINTS = [0.25, 0.50, 0.75, 1.00, 1.25];

// Tabla 11.4-2 ASCE 7-05: Factor de Sitio Fv (período largo)
const FV_TABLE = {
  'A': [0.8, 0.8, 0.8, 0.8, 0.8],
  'B': [1.0, 1.0, 1.0, 1.0, 1.0],
  'C': [1.7, 1.6, 1.5, 1.4, 1.3],
  'D': [2.4, 2.0, 1.8, 1.6, 1.5],
  'E': [3.5, 3.2, 2.8, 2.4, 2.4],
  'F': null
};
const FV_S1_POINTS = [0.10, 0.20, 0.30, 0.40, 0.50];

// Interpolación lineal para factores de sitio
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

// Tabla 11.5-1 ASCE 7-05: Factor de Importancia Ie
const IE_TABLE = {
  'I':   { Ie: 1.00, descripcion: 'Estructuras de bajo riesgo' },
  'II':  { Ie: 1.00, descripcion: 'Estructuras ordinarias' },
  'III': { Ie: 1.25, descripcion: 'Estructuras importantes' },
  'IV':  { Ie: 1.50, descripcion: 'Estructuras esenciales' }
};

// Tabla 12.2-1 ASCE 7-05 (subset 20 sistemas más usados en Panamá)
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
      'mamp-confinada': { nombre: 'Mampostería confinada (vivienda unifamiliar REP-21)', R: 1.5, omega: 2.5, Cd: 1.25 },
    }
  },
  'otros': {
    label: 'Otros',
    sistemas: {
      'cant-columns':  { nombre: 'Sistema de columnas en voladizo',                 R: 2.5, omega: 2.0, Cd: 2.5 },
      'light-frame':   { nombre: 'Sistema de muros livianos enmarcados',            R: 6.5, omega: 3.0, Cd: 4.0 },
    }
  }
};

// Categorías de Diseño Sísmico - Tablas 11.6-1 y 11.6-2 ASCE 7-05
// Por SDS (Tabla 11.6-1)
function cdsBySDS(sds, riesgo) {
  const isHigh = (riesgo === 'IV');
  if (sds < 0.167) return 'A';
  if (sds < 0.33)  return 'B';
  if (sds < 0.50)  return isHigh ? 'D' : 'C';
  return 'D';
}
// Por SD1 (Tabla 11.6-2)
function cdsBySD1(sd1, riesgo) {
  const isHigh = (riesgo === 'IV');
  if (sd1 < 0.067) return 'A';
  if (sd1 < 0.133) return 'B';
  if (sd1 < 0.20)  return isHigh ? 'D' : 'C';
  return 'D';
}
function categoriaDisenoSismico(sds, sd1, s1, riesgo) {
  // Si S1 >= 0.75g, CDS = E (categorías II y III) o F (categoría IV)
  if (s1 >= 0.75) {
    return (riesgo === 'IV') ? 'F' : 'E';
  }
  const cds1 = cdsBySDS(sds, riesgo);
  const cds2 = cdsBySD1(sd1, riesgo);
  // Categoría más severa de las dos
  const orden = ['A', 'B', 'C', 'D', 'E', 'F'];
  return orden[Math.max(orden.indexOf(cds1), orden.indexOf(cds2))];
}

// Período aproximado fundamental Ta (ASCE 7-05 Eq. 12.8-7)
// Ct y x dependen del sistema estructural
function periodoAproximado(sistemaKey, hn_m) {
  // hn_m: altura en metros (convertir desde pies si fuese necesario)
  const hn_ft = hn_m * 3.28084;
  let Ct, x;
  if (sistemaKey.startsWith('acero-smf') || sistemaKey === 'acero-imf' || sistemaKey === 'acero-omf') {
    Ct = 0.028; x = 0.8;
  } else if (sistemaKey === 'concreto-smrf' || sistemaKey === 'concreto-imrf' || sistemaKey === 'concreto-omrf') {
    Ct = 0.016; x = 0.9;
  } else if (sistemaKey === 'acero-ebf') {
    Ct = 0.030; x = 0.75;
  } else {
    // Default: muros, sistemas duales, mampostería
    Ct = 0.020; x = 0.75;
  }
  return Ct * Math.pow(hn_ft, x);
}

// Función principal de cálculo del espectro de diseño REP-21
// Inputs: { ss, s1, pga, claseSitio, riesgo, sistemaKey, periodo, tipoEstructura }
// Returns: objeto completo con todos los parámetros sísmicos
function calcularSismico(input) {
  const result = {
    input: { ...input },
    valido: true,
    advertencias: [],
    errores: []
  };

  // Factor 2/3 para Grupo 2 (infraestructura, 1000 años aprox) según REP-21
  // Grupo 1 normal: usa los valores tal cual (los mapas ya son 2500 años, ASCE incluye 2/3)
  let ss_eff = input.ss;
  let s1_eff = input.s1;
  let pga_eff = input.pga;

  if (input.tipoEstructura === 'geotecnica') {
    ss_eff = input.ss * 2/3;
    s1_eff = input.s1 * 2/3;
    pga_eff = input.pga * 2/3;
    result.advertencias.push('Estructura geotécnica: valores multiplicados por 2/3 (REP-21 Cap. 6).');
  }

  result.ss_efectivo = ss_eff;
  result.s1_efectivo = s1_eff;
  result.pga_efectivo = pga_eff;

  // Validar clase F
  if (input.claseSitio === 'F') {
    result.errores.push('Clase de Sitio F requiere estudio específico de sitio (REP-21 sec. 5.10).');
    result.valido = false;
    return result;
  }

  // Calcular Fa y Fv
  result.Fa = interpolateFactor(FA_TABLE, FA_SS_POINTS, input.claseSitio, ss_eff);
  result.Fv = interpolateFactor(FV_TABLE, FV_S1_POINTS, input.claseSitio, s1_eff);

  // Aceleraciones máximas consideradas ajustadas por sitio (MCE_R)
  result.SMS = result.Fa * ss_eff;
  result.SM1 = result.Fv * s1_eff;

  // Aceleraciones de diseño (2/3 del MCE)
  result.SDS = (2/3) * result.SMS;
  result.SD1 = (2/3) * result.SM1;

  // Factor de importancia
  result.Ie = IE_TABLE[input.riesgo].Ie;

  // Categoría de Diseño Sísmico
  result.CDS = categoriaDisenoSismico(result.SDS, result.SD1, s1_eff, input.riesgo);

  // Sistema estructural - buscar en todas las categorías
  let sistemaInfo = null;
  for (const cat of Object.values(SISTEMAS_ESTRUCTURALES)) {
    if (cat.sistemas[input.sistemaKey]) {
      sistemaInfo = cat.sistemas[input.sistemaKey];
      break;
    }
  }
  if (!sistemaInfo) {
    result.errores.push('Sistema estructural no encontrado. Consulte Tabla 12.2-1 de ASCE 7-05.');
    result.valido = false;
    return result;
  }
  result.sistema = sistemaInfo;
  result.R = sistemaInfo.R;
  result.omega = sistemaInfo.omega;
  result.Cd = sistemaInfo.Cd;

  // Período de transición
  result.T0 = 0.2 * result.SD1 / result.SDS;
  result.Ts = result.SD1 / result.SDS;
  result.TL = 10.0; // REP-21: TL = 10 segundos para Panamá

  // Coeficiente sísmico Cs (ASCE 7-05 Eq. 12.8-2)
  // Cs = SDS / (R/Ie)
  const T = input.periodo;
  let Cs_basico = result.SDS / (result.R / result.Ie);

  // Límite máximo Cs (Eq. 12.8-3 y 12.8-4)
  let Cs_max;
  if (T <= result.TL) {
    Cs_max = result.SD1 / (T * (result.R / result.Ie));
  } else {
    Cs_max = result.SD1 * result.TL / (T * T * (result.R / result.Ie));
  }

  // Cs final como mínimo entre Cs_básico y Cs_max
  let Cs_calculado = Math.min(Cs_basico, Cs_max);

  // Cs mínimo según REP-21 sec. 5.2.1 (modificación a ASCE 7-05)
  // Cs >= 0.044 * SDS * Ie >= 0.01
  const Cs_min_REP21 = Math.max(0.044 * result.SDS * result.Ie, 0.01);

  // Si S1 >= 0.6g (zonas alta sismicidad), mínimo adicional (Eq. 12.8-6)
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

  // Vivienda unifamiliar - verificación adicional
  if (input.tipoEstructura === 'vivienda') {
    if (pga_eff <= 0.25) {
      result.viviendaDensidadMin = 2.0;
    } else if (pga_eff <= 0.40) {
      result.viviendaDensidadMin = 3.5;
    } else {
      result.viviendaDensidadMin = 5.0;
    }
    if (pga_eff >= 0.40) {
      result.advertencias.push('PGA ≥ 0.40g: vivienda requiere diseño completo, no aplicable construcción típica (REP-21 sec. 7.4).');
    }
  }

  return result;
}

// Generar espectro de respuesta de diseño (puntos T vs Sa)
function generarEspectro(SDS, SD1, T0, Ts, TL, Tmax) {
  Tmax = Tmax || 4.0;
  const puntos = [];
  for (let T = 0; T <= Tmax; T += 0.02) {
    let Sa;
    if (T < T0) {
      Sa = SDS * (0.4 + 0.6 * T / T0);
    } else if (T <= Ts) {
      Sa = SDS;
    } else if (T <= TL) {
      Sa = SD1 / T;
    } else {
      Sa = SD1 * TL / (T * T);
    }
    puntos.push({ T: parseFloat(T.toFixed(2)), Sa: Sa });
  }
  return puntos;
}

// Export
window.SismicCalc = {
  calcularSismico,
  generarEspectro,
  periodoAproximado,
  SISTEMAS_ESTRUCTURALES,
  IE_TABLE,
  FA_TABLE,
  FV_TABLE,
  FA_SS_POINTS,
  FV_S1_POINTS
};
