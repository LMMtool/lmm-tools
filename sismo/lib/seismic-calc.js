// ============================================================
// SISMOPANAMA v2.0 - Cálculos sísmicos REP-21
// © LMM Ingeniería 2026
// 
// Coherencia normativa: REP-2021 + ASCE 7-05 + Manual Geotecnia
// ============================================================

// ============================================================
// TABLAS NORMATIVAS (con referencias)
// ============================================================

// Tabla 11.4-1 ASCE 7-05 - Factor de sitio Fa
const FA_TABLE = {
  'A': [0.8, 0.8, 0.8, 0.8, 0.8],
  'B': [1.0, 1.0, 1.0, 1.0, 1.0],
  'C': [1.2, 1.2, 1.1, 1.0, 1.0],
  'D': [1.6, 1.4, 1.2, 1.1, 1.0],
  'E': [2.5, 1.7, 1.2, 0.9, 0.9],
  'F': null
};
const FA_SS_POINTS = [0.25, 0.50, 0.75, 1.00, 1.25];

// Tabla 11.4-2 ASCE 7-05 - Factor de sitio Fv
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
  if (value <= points[0]) return { val: row[0], clipped: 'low' };
  if (value >= points[points.length - 1]) {
    return { val: row[row.length - 1], clipped: value > points[points.length - 1] ? 'high' : null };
  }
  for (let i = 0; i < points.length - 1; i++) {
    if (value >= points[i] && value <= points[i + 1]) {
      const t = (value - points[i]) / (points[i + 1] - points[i]);
      return { val: row[i] + t * (row[i + 1] - row[i]), clipped: null };
    }
  }
  return { val: row[row.length - 1], clipped: null };
}

// Tabla 1.5-2 ASCE 7-05 - Factor de importancia Ie
const IE_TABLE = {
  'I':   { Ie: 1.00, descripcion: 'Estructuras de bajo riesgo (depósitos agrícolas, temporales)' },
  'II':  { Ie: 1.00, descripcion: 'Estructuras ordinarias (residencial, oficinas)' },
  'III': { Ie: 1.25, descripcion: 'Estructuras importantes (escuelas, hospitales pequeños, gimnasios públicos)' },
  'IV':  { Ie: 1.50, descripcion: 'Estructuras esenciales (hospitales, bomberos, comunicaciones)' }
};

// Tabla 12.8-2 ASCE 7-05 - Coeficientes Ct, x para Ta
const CT_X_TABLE = {
  'smf-acero':    { Ct: 0.0724, x: 0.8,  desc: 'Marcos de momento de acero' },
  'smf-concreto': { Ct: 0.0466, x: 0.9,  desc: 'Marcos de momento de concreto reforzado' },
  'ebf':          { Ct: 0.0731, x: 0.75, desc: 'Marcos con riostras excéntricas (EBF)' },
  'brbf':         { Ct: 0.0731, x: 0.75, desc: 'Marcos con riostras restringidas a pandeo (BRBF)' },
  'otros':        { Ct: 0.0488, x: 0.75, desc: 'Todos los demás sistemas estructurales' }
};

function categoriaCtX(sistemaKey) {
  if (sistemaKey === 'acero-smf' || sistemaKey === 'acero-imf' || sistemaKey === 'acero-omf') return 'smf-acero';
  if (sistemaKey === 'concreto-smrf' || sistemaKey === 'concreto-imrf' || sistemaKey === 'concreto-omrf') return 'smf-concreto';
  if (sistemaKey === 'acero-ebf') return 'ebf';
  return 'otros';
}

// Tabla 12.8-1 ASCE 7-05 - Coeficiente Cu
function obtenerCu(SD1) {
  if (SD1 >= 0.40) return 1.4;
  if (SD1 >= 0.30) return 1.4;
  if (SD1 >= 0.20) return 1.5;
  if (SD1 >= 0.15) return 1.6;
  return 1.7;
}

// ============================================================
// SISTEMAS ESTRUCTURALES con LÍMITES DE ALTURA por CDS
// Tabla 12.2-1 ASCE 7-05 (null=sin límite; 'NP'=No Permitido; número=metros)
// ============================================================
const SISTEMAS_ESTRUCTURALES = {
  'concreto': {
    label: 'Concreto Reforzado',
    sistemas: {
      'concreto-smrf': {
        nombre: 'Pórticos especiales resistentes a momento (SMRF)',
        R: 8.0, omega: 3.0, Cd: 5.5,
        limites: { A: null, B: null, C: null, D: null, E: null, F: null },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila C5'
      },
      'concreto-imrf': {
        nombre: 'Pórticos intermedios resistentes a momento (IMRF)',
        R: 5.0, omega: 3.0, Cd: 4.5,
        limites: { A: null, B: null, C: null, D: 'NP', E: 'NP', F: 'NP' },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila C6'
      },
      'concreto-omrf': {
        nombre: 'Pórticos ordinarios resistentes a momento (OMRF)',
        R: 3.0, omega: 3.0, Cd: 2.5,
        limites: { A: null, B: null, C: 'NP', D: 'NP', E: 'NP', F: 'NP' },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila C7'
      },
      'concreto-msw': {
        nombre: 'Muros estructurales especiales (Shear Wall)',
        R: 5.0, omega: 2.5, Cd: 5.0,
        limites: { A: null, B: null, C: null, D: 48, E: 48, F: 30 },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila A7'
      },
      'concreto-mow': {
        nombre: 'Muros estructurales ordinarios',
        R: 4.0, omega: 2.5, Cd: 4.0,
        limites: { A: null, B: null, C: null, D: 'NP', E: 'NP', F: 'NP' },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila A8'
      },
      'concreto-dual-s': {
        nombre: 'Dual: SMRF + muros especiales',
        R: 7.0, omega: 2.5, Cd: 5.5,
        limites: { A: null, B: null, C: null, D: null, E: null, F: null },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila D5'
      },
      'concreto-dual-i': {
        nombre: 'Dual: IMRF + muros ordinarios',
        R: 5.5, omega: 2.5, Cd: 4.5,
        limites: { A: null, B: null, C: null, D: 48, E: 48, F: 30 },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila D7'
      },
      'concreto-prefab': {
        nombre: 'Muros de concreto prefabricado intermedios',
        R: 4.0, omega: 2.5, Cd: 4.0,
        limites: { A: null, B: null, C: 12, D: 12, E: 12, F: 'NP' },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila A9'
      }
    }
  },
  'acero': {
    label: 'Acero',
    sistemas: {
      'acero-smf': {
        nombre: 'Pórticos especiales resistentes a momento (SMF)',
        R: 8.0, omega: 3.0, Cd: 5.5,
        limites: { A: null, B: null, C: null, D: null, E: null, F: null },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila C1'
      },
      'acero-imf': {
        nombre: 'Pórticos intermedios resistentes a momento (IMF)',
        R: 4.5, omega: 3.0, Cd: 4.0,
        limites: { A: null, B: null, C: null, D: 10, E: 10, F: 'NP' },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila C2'
      },
      'acero-omf': {
        nombre: 'Pórticos ordinarios resistentes a momento (OMF)',
        R: 3.5, omega: 3.0, Cd: 3.0,
        limites: { A: null, B: null, C: null, D: 'NP', E: 'NP', F: 'NP' },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila C3',
        excepcion: '§12.2.5.6 permite OMF en CDS D, E con limitaciones: h ≤ 10 m, peso pisos/techo ≤ 1.34 kN/m²'
      },
      'acero-scbf': {
        nombre: 'Pórticos arriostrados concéntricamente especiales (SCBF)',
        R: 6.0, omega: 2.0, Cd: 5.0,
        limites: { A: null, B: null, C: null, D: 48, E: 48, F: 30 },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila B1'
      },
      'acero-ocbf': {
        nombre: 'Pórticos arriostrados concéntricamente ordinarios (OCBF)',
        R: 3.25, omega: 2.0, Cd: 3.25,
        limites: { A: null, B: null, C: null, D: 11, E: 11, F: 'NP' },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila B2'
      },
      'acero-ebf': {
        nombre: 'Pórticos arriostrados excéntricamente (EBF)',
        R: 8.0, omega: 2.0, Cd: 4.0,
        limites: { A: null, B: null, C: null, D: 48, E: 48, F: 30 },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila B3'
      }
    }
  },
  'mamposteria': {
    label: 'Mampostería',
    sistemas: {
      'mamp-especial': {
        nombre: 'Muros de mampostería reforzada especiales',
        R: 5.0, omega: 2.5, Cd: 3.5,
        limites: { A: null, B: null, C: null, D: 48, E: 48, F: 30 },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila A14'
      },
      'mamp-intermedio': {
        nombre: 'Muros de mampostería reforzada intermedios',
        R: 3.5, omega: 2.5, Cd: 2.25,
        limites: { A: null, B: null, C: null, D: 'NP', E: 'NP', F: 'NP' },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila A15'
      },
      'mamp-ordinario': {
        nombre: 'Muros de mampostería reforzada ordinarios',
        R: 2.0, omega: 2.5, Cd: 1.75,
        limites: { A: null, B: null, C: 'NP', D: 'NP', E: 'NP', F: 'NP' },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila A16'
      }
    }
  },
  'otros': {
    label: 'Otros',
    sistemas: {
      'cant-columns': {
        nombre: 'Sistema de columnas en voladizo',
        R: 2.5, omega: 2.0, Cd: 2.5,
        limites: { A: 10, B: 10, C: 10, D: 10, E: 10, F: 10 },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila G1'
      },
      'light-frame': {
        nombre: 'Sistema de muros livianos enmarcados',
        R: 6.5, omega: 3.0, Cd: 4.0,
        limites: { A: null, B: null, C: null, D: 20, E: 20, F: 20 },
        refTabla: 'Tabla 12.2-1 ASCE 7-05, fila A13'
      },
      'custom': {
        nombre: 'Otro / Personalizado (ingresar R, Ω₀, Cd manualmente)',
        R: null, omega: null, Cd: null, isCustom: true,
        limites: null,
        refTabla: 'Usuario debe verificar en Tabla 12.2-1 ASCE 7-05'
      }
    }
  }
};

// ============================================================
// TIPOS DE ESTRUCTURA GEOTÉCNICA
// ============================================================
const TIPOS_GEOTECNICA = {
  'muro-retencion':   { nombre: 'Muro de retención flexible (gravedad / cantilever)',  categoria: 'flexible', khRecomendado: 'A' },
  'muro-gaviones':    { nombre: 'Muro de gaviones',                                     categoria: 'flexible', khRecomendado: 'C' },
  'muro-rigido':      { nombre: 'Muro rígido restringido (sótano, estribo arriostrado)', categoria: 'rigido', khRecomendado: 'E' },
  'tablestaca':       { nombre: 'Pantalla anclada / Tablestaca',                        categoria: 'flexible', khRecomendado: 'A' },
  'talud':            { nombre: 'Talud / Corte / Terraplén',                            categoria: 'flexible', khRecomendado: 'D' },
  'pilote':           { nombre: 'Cimiento profundo (pilote)',                           categoria: 'flexible', khRecomendado: 'A' },
  'cimiento-super':   { nombre: 'Cimiento superficial con cargas sísmicas',             categoria: 'flexible', khRecomendado: 'A' },
  'otro-geotecnico':  { nombre: 'Otra estructura geotécnica',                           categoria: 'flexible', khRecomendado: 'A' }
};

// ============================================================
// MÉTODOS PARA KH (Cuadro 14 Manual Geotecnia + REP §6.5)
// ============================================================
const METODOS_KH = {
  'A': {
    nombre: 'Default REP (conservador)',
    formula: 'kh = (2/3)·PGA/g',
    ref: 'REP-21 §6.5 (factor 2/3 para diseño geotécnico)',
    aplica: 'Caso general, default conservador'
  },
  'B': {
    nombre: 'Cuadro 14 ref. 35 (SDS/2.5)',
    formula: 'kh = SDS/2.5',
    ref: 'Manual Geotecnia §5.4 Cuadro 14, ref. 35',
    aplica: 'Consistencia con espectro edificio',
    requiereSDS: true
  },
  'C': {
    nombre: 'Cuadro 14 ref. 8 (función de Apga)',
    formula: 'kh = Apga/g si Apga ≤ 0.2g; kh = 0.33·(Apga/g)^0.3 si Apga > 0.2g',
    ref: 'Manual Geotecnia §5.4 Cuadro 14, ref. 8',
    aplica: 'Muros flexibles, no lineal con Apga'
  },
  'D': {
    nombre: 'Cuadro 14 ref. 25 (fracción Apga)',
    formula: 'kh = 0.40·Apga/g (rango 0.33–0.50)',
    ref: 'Manual Geotecnia §5.4 Cuadro 14, ref. 25',
    aplica: 'Análisis preliminar de talud o muro flexible'
  },
  'E': {
    nombre: 'Muro rígido restringido (Apga pleno)',
    formula: 'kh = Apga/g',
    ref: 'Manual Geotecnia §5.3.2',
    aplica: 'Sótanos, estribos arriostrados (no flexibles)'
  },
  'F': {
    nombre: 'AASHTO preliminar (1.5·Apga)',
    formula: 'kh = 1.5·Apga/g',
    ref: 'Manual Geotecnia §5.3.2 (AASHTO)',
    aplica: 'Diseño preliminar de muros rígidos por AASHTO'
  }
};

// ============================================================
// CDS — Tablas 11.6-1 / 11.6-2 ASCE 7-05
// ============================================================
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
    return {
      CDS: (riesgo === 'IV') ? 'F' : 'E',
      cdsPorSDS: null, cdsPorSD1: null,
      criterio: `S1 = ${s1.toFixed(3)} ≥ 0.75 → CDS ${(riesgo === 'IV') ? 'F' : 'E'} (ASCE §11.6)`,
      ref: 'ASCE 7-05 §11.6'
    };
  }
  const cds1 = cdsBySDS(sds, riesgo);
  const cds2 = cdsBySD1(sd1, riesgo);
  const orden = ['A', 'B', 'C', 'D', 'E', 'F'];
  const final = orden[Math.max(orden.indexOf(cds1), orden.indexOf(cds2))];
  return {
    CDS: final,
    cdsPorSDS: cds1,
    cdsPorSD1: cds2,
    criterio: `Por SDS=${sds.toFixed(3)} → ${cds1} (Tabla 11.6-1); Por SD1=${sd1.toFixed(3)} → ${cds2} (Tabla 11.6-2); Gobierna: ${final}`,
    ref: 'Tablas 11.6-1 y 11.6-2 ASCE 7-05'
  };
}

// ============================================================
// VALIDACIÓN SISTEMA vs CDS + ALTURA (Tabla 12.2-1)
// ============================================================
function validarSistemaContraCDS(sistemaInfo, CDS, hn) {
  if (sistemaInfo.isCustom) {
    return {
      valido: true,
      advertencia: 'Sistema personalizado: usuario responsable de verificar permisibilidad y límites de altura contra Tabla 12.2-1 ASCE 7-05 para CDS ' + CDS + '.'
    };
  }
  if (!sistemaInfo.limites) return { valido: true };
  
  const limite = sistemaInfo.limites[CDS];
  
  if (limite === 'NP') {
    return {
      valido: false,
      error: `Sistema "${sistemaInfo.nombre}" NO PERMITIDO en CDS ${CDS}`,
      ref: sistemaInfo.refTabla,
      excepcion: sistemaInfo.excepcion || null,
      recomendacion: 'Cambie a un sistema con mayor ductilidad (ej. IMF→SMF, OCBF→SCBF, IMRF→SMRF).'
    };
  }
  
  if (limite !== null && hn != null && hn > limite) {
    return {
      valido: false,
      error: `Sistema "${sistemaInfo.nombre}" limitado a ${limite} m en CDS ${CDS}. Altura proyectada: ${hn} m`,
      ref: sistemaInfo.refTabla,
      recomendacion: `Reduzca altura a ≤ ${limite} m o cambie a sistema sin límite de altura.`
    };
  }
  
  if (limite !== null && hn != null) {
    return {
      valido: true,
      advertencia: `Sistema permitido con límite de altura ${limite} m en CDS ${CDS}. Altura proyectada ${hn} m ≤ ${limite} m. ✓`
    };
  }
  
  return { valido: true };
}

// ============================================================
// PERÍODO T (auto / manual / Ta puro)
// ASCE 7-05 §12.8.2, Ec. 12.8-7
// ============================================================
function calcularPeriodo(modoPeriodo, sistemaKey, hn, SD1, periodoManual) {
  const cat = categoriaCtX(sistemaKey);
  const ctx = CT_X_TABLE[cat];
  
  if (!hn || hn <= 0) {
    return { error: 'Altura hn debe ser positiva para calcular Ta.' };
  }
  
  const Ta = ctx.Ct * Math.pow(hn, ctx.x);
  const Cu = obtenerCu(SD1);
  const T_max = Cu * Ta;
  
  const resultado = {
    modo: modoPeriodo,
    Ct: ctx.Ct, x: ctx.x,
    categoriaCtX: cat,
    descCtX: ctx.desc,
    hn: hn, Ta: Ta, Cu: Cu, T_max: T_max,
    refTa: 'Ec. 12.8-7 ASCE 7-05 + Tabla 12.8-2',
    refCu: 'Tabla 12.8-1 ASCE 7-05'
  };
  
  if (modoPeriodo === 'auto') {
    resultado.T = T_max;
    resultado.fuente = `T = Cu · Ta = ${Cu} × ${Ta.toFixed(3)} = ${T_max.toFixed(3)} s`;
  } else if (modoPeriodo === 'ta') {
    resultado.T = Ta;
    resultado.fuente = `T = Ta = ${Ta.toFixed(3)} s (conservador, sin amplificar)`;
  } else if (modoPeriodo === 'manual') {
    if (!periodoManual || periodoManual <= 0) {
      return { error: 'Período manual debe ser positivo.' };
    }
    if (periodoManual > T_max) {
      resultado.T = T_max;
      resultado.advertenciaManual = `T ingresado (${periodoManual.toFixed(3)} s) > Cu·Ta (${T_max.toFixed(3)} s). §12.8.2 limita T a Cu·Ta. Se usa T = ${T_max.toFixed(3)} s.`;
      resultado.T_ingresado = periodoManual;
      resultado.fuente = `T limitado por §12.8.2: T = Cu·Ta = ${T_max.toFixed(3)} s`;
    } else {
      resultado.T = periodoManual;
      resultado.T_ingresado = periodoManual;
      resultado.fuente = `T del análisis modal = ${periodoManual.toFixed(3)} s (válido: ≤ Cu·Ta)`;
    }
  }
  
  return resultado;
}

// ============================================================
// MÉTODO 1: EDIFICIO / INFRAESTRUCTURA
// ============================================================
function calcularEdificio(input) {
  const result = {
    metodo: 'ASCE 7-05 + REP-21',
    input: { ...input },
    valido: true,
    advertencias: [],
    errores: [],
  };
  
  let ss_eff = input.ssOverride != null ? input.ssOverride : input.ss;
  let s1_eff = input.s1Override != null ? input.s1Override : input.s1;
  let pga_eff = input.pgaOverride != null ? input.pgaOverride : input.pga;
  
  result.ss_efectivo = ss_eff;
  result.s1_efectivo = s1_eff;
  result.pga_efectivo = pga_eff;
  result.ss_mapa = input.ss;
  result.s1_mapa = input.s1;
  result.pga_mapa = input.pga;
  result.usaOverrideEspectro = (input.ssOverride != null || input.s1Override != null);
  
  if (result.usaOverrideEspectro) {
    result.advertencias.push({
      tipo: 'info',
      msg: 'Se usaron valores Ss/S1/PGA ingresados manualmente. Verificar trazabilidad del estudio.',
      ref: 'REP-21 §3.2 y §5.11'
    });
  }
  
  if (input.claseSitio === 'F') {
    result.errores.push({
      msg: 'CLASE DE SITIO F. Requiere estudio específico de sitio y análisis dinámico de respuesta de sitio.',
      ref: 'REP-21 §5.11 + ASCE 7-05 Capítulo 21'
    });
    result.valido = false;
    return result;
  }
  
  const fa = interpolateFactor(FA_TABLE, FA_SS_POINTS, input.claseSitio, ss_eff);
  const fv = interpolateFactor(FV_TABLE, FV_S1_POINTS, input.claseSitio, s1_eff);
  result.Fa = fa.val;
  result.Fv = fv.val;
  
  // Advertencias análisis específico de sitio
  if (input.claseSitio === 'E' && ss_eff > 1.25) {
    result.advertencias.push({
      tipo: 'critica',
      msg: `Clase E con Ss = ${ss_eff.toFixed(2)} g excede rango tabulado (Ss ≤ 1.25). Fa = ${fa.val.toFixed(2)} usado por extrapolación.`,
      requerimiento: 'Tabla 11.4-1 nota: requiere investigación geotécnica específica de sitio y análisis dinámico.',
      ref: 'ASCE 7-05 Tabla 11.4-1 (nota) + REP-21 §5.11'
    });
  }
  if (input.claseSitio === 'E' && s1_eff > 0.50) {
    result.advertencias.push({
      tipo: 'critica',
      msg: `Clase E con S1 = ${s1_eff.toFixed(2)} g excede rango tabulado (S1 ≤ 0.5). Fv = ${fv.val.toFixed(2)} usado por extrapolación.`,
      requerimiento: 'Tabla 11.4-2 nota: requiere investigación geotécnica específica de sitio y análisis dinámico.',
      ref: 'ASCE 7-05 Tabla 11.4-2 (nota) + REP-21 §5.11'
    });
  }
  if (input.claseSitio === 'D' && ss_eff > 1.25) {
    result.advertencias.push({
      tipo: 'media',
      msg: `Clase D con Ss = ${ss_eff.toFixed(2)} g excede tabla. Verificar con análisis específico.`,
      ref: 'ASCE 7-05 Tabla 11.4-1 (nota)'
    });
  }
  if (input.claseSitio === 'D' && s1_eff > 0.50) {
    result.advertencias.push({
      tipo: 'media',
      msg: `Clase D con S1 = ${s1_eff.toFixed(2)} g excede tabla. Verificar con análisis específico.`,
      ref: 'ASCE 7-05 Tabla 11.4-2 (nota)'
    });
  }
  
  result.SMS = result.Fa * ss_eff;
  result.SM1 = result.Fv * s1_eff;
  result.SDS = (2/3) * result.SMS;
  result.SD1 = (2/3) * result.SM1;
  
  result.Ie = IE_TABLE[input.riesgo].Ie;
  result.descRiesgo = IE_TABLE[input.riesgo].descripcion;
  
  const cdsInfo = categoriaDisenoSismico(result.SDS, result.SD1, s1_eff, input.riesgo);
  result.CDS = cdsInfo.CDS;
  result.CDS_info = cdsInfo;
  
  // Sistema estructural
  let sistemaInfo = null;
  if (input.sistemaKey === 'custom') {
    if (!input.customR || !input.customOmega || !input.customCd) {
      result.errores.push({
        msg: 'Para sistema personalizado debe ingresar R, Ω₀ y Cd.',
        ref: 'Tabla 12.2-1 ASCE 7-05'
      });
      result.valido = false;
      return result;
    }
    sistemaInfo = {
      nombre: input.customNombre || 'Sistema personalizado',
      R: parseFloat(input.customR),
      omega: parseFloat(input.customOmega),
      Cd: parseFloat(input.customCd),
      isCustom: true,
      refTabla: input.customRef || 'Usuario debe verificar en Tabla 12.2-1 ASCE 7-05'
    };
  } else {
    for (const cat of Object.values(SISTEMAS_ESTRUCTURALES)) {
      if (cat.sistemas[input.sistemaKey]) {
        sistemaInfo = cat.sistemas[input.sistemaKey];
        break;
      }
    }
  }
  if (!sistemaInfo) {
    result.errores.push({ msg: 'Sistema estructural no encontrado.', ref: '' });
    result.valido = false;
    return result;
  }
  result.sistema = sistemaInfo;
  result.R = sistemaInfo.R;
  result.omega = sistemaInfo.omega;
  result.Cd = sistemaInfo.Cd;
  
  // Validar Tabla 12.2-1
  const validacion = validarSistemaContraCDS(sistemaInfo, result.CDS, input.hn);
  result.validacionSistema = validacion;
  if (!validacion.valido) {
    result.errores.push({
      msg: validacion.error,
      ref: validacion.ref,
      excepcion: validacion.excepcion,
      recomendacion: validacion.recomendacion
    });
    result.valido = false;
  } else if (validacion.advertencia) {
    result.advertencias.push({
      tipo: 'info',
      msg: validacion.advertencia,
      ref: sistemaInfo.refTabla
    });
  }
  
  // Período T
  const modoPeriodo = input.modoPeriodo || 'auto';
  const periodoInfo = calcularPeriodo(modoPeriodo, input.sistemaKey, input.hn, result.SD1, input.periodo);
  if (periodoInfo.error) {
    result.errores.push({ msg: periodoInfo.error, ref: 'ASCE 7-05 §12.8.2' });
    result.valido = false;
    return result;
  }
  result.periodoInfo = periodoInfo;
  result.T = periodoInfo.T;
  if (periodoInfo.advertenciaManual) {
    result.advertencias.push({
      tipo: 'media',
      msg: periodoInfo.advertenciaManual,
      ref: 'ASCE 7-05 §12.8.2'
    });
  }
  
  // Cs
  result.T0 = 0.2 * result.SD1 / result.SDS;
  result.Ts = result.SD1 / result.SDS;
  result.TL = 10.0;
  result.refTL = 'REP-21 §5.12.3 (TL = 10 s para Panamá)';
  
  const T = result.T;
  const Cs_basico = result.SDS / (result.R / result.Ie);
  let Cs_max;
  if (T <= result.TL) {
    Cs_max = result.SD1 / (T * (result.R / result.Ie));
  } else {
    Cs_max = result.SD1 * result.TL / (T * T * (result.R / result.Ie));
  }
  const Cs_calculado = Math.min(Cs_basico, Cs_max);
  const Cs_min_REP21 = Math.max(0.044 * result.SDS * result.Ie, 0.01);
  let Cs_min_S1 = 0;
  if (s1_eff >= 0.6) {
    Cs_min_S1 = 0.5 * s1_eff / (result.R / result.Ie);
  }
  const Cs_minimo_aplicable = Math.max(Cs_min_REP21, Cs_min_S1);
  
  result.Cs_basico = Cs_basico;
  result.Cs_max = Cs_max;
  result.Cs_min_REP21 = Cs_min_REP21;
  result.Cs_min_S1 = Cs_min_S1;
  result.Cs_min = Cs_minimo_aplicable;
  result.Cs = Math.max(Cs_calculado, Cs_minimo_aplicable);
  
  let gobiernaTexto;
  if (Cs_minimo_aplicable >= Cs_calculado) {
    gobiernaTexto = (Cs_min_S1 > Cs_min_REP21) ? 'mínimo por S1≥0.6g' : 'mínimo REP-21';
  } else if (Cs_basico <= Cs_max) {
    gobiernaTexto = 'básico (zona plana, T ≤ Ts)';
  } else {
    gobiernaTexto = 'máximo (zona descendente, T > Ts)';
  }
  result.Cs_gobierna = gobiernaTexto;
  
  return result;
}

// ============================================================
// MÉTODO 2: VIVIENDA UNIFAMILIAR (REP-21 Cap. 7)
// ============================================================
function calcularVivienda(input) {
  const result = {
    metodo: 'REP-21 Capítulo 7 (Vivienda Unifamiliar)',
    input: { ...input },
    valido: true,
    advertencias: [],
    errores: []
  };
  
  result.PGA_mapa = input.pga;
  result.PGA = input.pgaOverride != null ? input.pgaOverride : input.pga;
  if (input.pgaOverride != null) {
    result.advertencias.push({
      tipo: 'info',
      msg: 'Se usó PGA ingresado manualmente.',
      ref: 'REP-21 §5.12.4'
    });
  }
  
  if (input.claseSitio === 'F') {
    result.errores.push({
      msg: 'CLASE DE SITIO F. Vivienda NO califica como construcción típica.',
      ref: 'REP-21 §7.4'
    });
    result.valido = false;
    return result;
  }
  
  if (input.claseSitio === 'E') {
    result.advertencias.push({
      tipo: 'critica',
      msg: 'Suelo Clase E: vivienda NO califica como construcción típica.',
      ref: 'REP-21 §7.4'
    });
  }
  
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
  
  result.triggersNoTipica = [];
  if (result.PGA >= 0.40) {
    result.triggersNoTipica.push({ msg: 'PGA ≥ 0.40 g — alta sismicidad', ref: 'REP-21 §7.4' });
  }
  if (input.claseSitio === 'E' || input.claseSitio === 'F') {
    result.triggersNoTipica.push({ msg: `Suelo Clase ${input.claseSitio}`, ref: 'REP-21 §7.4' });
  }
  if (input.suelosProblema) {
    result.triggersNoTipica.push({ msg: 'Arcillas expansivas o suelos susceptibles a licuación', ref: 'REP-21 §7.4' });
  }
  if (input.irregularidad) {
    result.triggersNoTipica.push({ msg: 'Irregularidad horizontal', ref: 'ASCE 7-05 Tabla 12.3-1' });
  }
  
  result.calificaTipica = result.triggersNoTipica.length === 0;
  
  if (!result.calificaTipica) {
    result.advertencias.push({
      tipo: 'critica',
      msg: 'Vivienda NO califica como construcción típica. Debe diseñarse como mampostería confinada completa (R=1.5, Ω₀=2.5, Cd=1.25).',
      ref: 'REP-21 §7.4'
    });
  }
  
  result.R = 1.5;
  result.omega = 2.5;
  result.Cd = 1.25;
  result.refMamposteria = 'REP-21 §7.4.2.3';
  
  return result;
}

// ============================================================
// CÁLCULO DE KH SEGÚN MÉTODO (Cuadro 14)
// ============================================================
function calcularKh(metodo, pga, sds) {
  const m = METODOS_KH[metodo];
  if (!m) return { error: 'Método kh inválido.' };
  
  let kh;
  let detalle;
  
  switch (metodo) {
    case 'A':
      kh = pga * (2/3);
      detalle = `kh = (2/3) × ${pga.toFixed(3)} = ${kh.toFixed(4)}`;
      break;
    case 'B':
      if (sds == null) return { error: 'Método B requiere SDS. Ingrese Ss y S1 manualmente o use otro método.' };
      kh = sds / 2.5;
      detalle = `kh = SDS/2.5 = ${sds.toFixed(3)}/2.5 = ${kh.toFixed(4)}`;
      break;
    case 'C':
      if (pga <= 0.2) {
        kh = pga;
        detalle = `Apga ≤ 0.2g → kh = Apga/g = ${kh.toFixed(4)}`;
      } else {
        kh = 0.33 * Math.pow(pga, 0.3);
        detalle = `Apga > 0.2g → kh = 0.33·(${pga.toFixed(3)})^0.3 = ${kh.toFixed(4)}`;
      }
      break;
    case 'D':
      kh = 0.40 * pga;
      detalle = `kh = 0.40·Apga/g = ${kh.toFixed(4)} (rango 0.33–0.50·Apga)`;
      break;
    case 'E':
      kh = pga;
      detalle = `kh = Apga/g = ${kh.toFixed(4)} (sin factor 2/3, muro rígido)`;
      break;
    case 'F':
      kh = 1.5 * pga;
      detalle = `kh = 1.5·Apga/g = 1.5 × ${pga.toFixed(3)} = ${kh.toFixed(4)}`;
      break;
    default:
      return { error: 'Método no implementado.' };
  }
  
  return {
    kh: kh, metodo: metodo,
    nombreMetodo: m.nombre, formula: m.formula,
    detalle: detalle, ref: m.ref, aplica: m.aplica
  };
}

// ============================================================
// KV - ENVOLVENTE DE 3 ESCENARIOS (Cuadro 14 Nota 1)
// ============================================================
function calcularKvEnvolvente(kh, tipoMuro, ratioKv) {
  const ratio = ratioKv != null ? ratioKv : 0.5;
  const kvMagnitud = ratio * kh;
  const umbralKvCero = (tipoMuro === 'rigido') ? 0.10 : 0.05;
  const puedeAsumirseCero = (kh <= umbralKvCero);
  
  const escenarios = [
    { id: 'a', nombre: 'kv hacia arriba', simbolo: '↑', kv: -kvMagnitud, descripcion: 'Reduce peso aparente del suelo' },
    { id: 'b', nombre: 'kv hacia abajo',  simbolo: '↓', kv: +kvMagnitud, descripcion: 'Aumenta peso aparente (caso desfavorable típico para empuje activo)' },
    { id: 'c', nombre: 'kv = 0',          simbolo: '—', kv: 0,           descripcion: 'Sin componente vertical' }
  ];
  
  escenarios.forEach(esc => {
    esc.tanPsi = kh / (1 - esc.kv);
    esc.psi_rad = Math.atan(esc.tanPsi);
    esc.psi_deg = esc.psi_rad * 180 / Math.PI;
  });
  
  const gobernante = escenarios.reduce((max, e) => e.psi_deg > max.psi_deg ? e : max);
  escenarios.forEach(e => e.gobierna = (e.id === gobernante.id));
  
  return {
    ratio: ratio,
    kvMagnitud: kvMagnitud,
    tipoMuro: tipoMuro,
    umbralKvCero: umbralKvCero,
    puedeAsumirseCero: puedeAsumirseCero,
    escenarios: escenarios,
    gobernante: gobernante,
    refNota1: 'Manual Geotecnia §5.4 Cuadro 14 Nota 1',
    advertencia: puedeAsumirseCero 
      ? `kh = ${kh.toFixed(3)} ≤ ${umbralKvCero} (umbral muro ${tipoMuro}) → kv puede asumirse 0.`
      : `kh = ${kh.toFixed(3)} > ${umbralKvCero} (umbral muro ${tipoMuro}) → debe correrse envolvente y usar mayor presión.`
  };
}

// ============================================================
// MÉTODO 3: GEOTECNIA (REP-21 Cap. 6 + Manual)
// ============================================================
function calcularGeotecnia(input) {
  const result = {
    metodo: 'REP-21 Capítulo 6 + Manual Geotecnia (Análisis Pseudoestático)',
    input: { ...input },
    valido: true,
    advertencias: [],
    errores: []
  };
  
  if (input.claseSitio === 'F') {
    result.errores.push({
      msg: 'CLASE DE SITIO F. Requiere análisis dinámico específico de sitio.',
      ref: 'REP-21 §5.11 + ASCE 7-05 Cap. 21'
    });
    result.valido = false;
    return result;
  }
  
  result.PGA_mapa = input.pga;
  const pgaUsado = input.pgaOverride != null ? input.pgaOverride : input.pga;
  result.PGA_usado = pgaUsado;
  
  if (input.pgaOverride != null) {
    result.advertencias.push({
      tipo: 'info',
      msg: 'Se usó PGA ingresado manualmente.',
      ref: 'REP-21 §5.12.4'
    });
  }
  
  const fa = interpolateFactor(FA_TABLE, FA_SS_POINTS, input.claseSitio, pgaUsado);
  result.Fa = fa ? fa.val : 1.0;
  result.PGA_sitio = pgaUsado * result.Fa;
  
  // Calcular SDS si usuario dio Ss/S1
  let sds = null;
  if (input.ssOverride != null && input.s1Override != null) {
    const faSs = interpolateFactor(FA_TABLE, FA_SS_POINTS, input.claseSitio, input.ssOverride);
    if (faSs) {
      const SMS = faSs.val * input.ssOverride;
      sds = (2/3) * SMS;
      result.SDS_calculado = sds;
      result.refSDS = 'Calculado de Ss/S1 ingresados manualmente';
    }
  }
  
  const tipoGeoInfo = TIPOS_GEOTECNICA[input.tipoGeotecnia];
  result.tipoGeotecnicoInfo = tipoGeoInfo || { nombre: 'Estructura geotécnica', categoria: 'flexible' };
  result.tipoMuro = result.tipoGeotecnicoInfo.categoria || 'flexible';
  result.metodoKhRecomendado = result.tipoGeotecnicoInfo.khRecomendado || 'A';
  
  const metodoKh = input.metodoKh || result.metodoKhRecomendado;
  const khInfo = calcularKh(metodoKh, pgaUsado, sds);
  
  if (khInfo.error) {
    result.errores.push({ msg: khInfo.error, ref: 'Manual Geotecnia §5.4 Cuadro 14' });
    result.valido = false;
    return result;
  }
  
  result.kh = khInfo.kh;
  result.khInfo = khInfo;
  
  const ratioKv = input.ratioKv != null ? input.ratioKv : 0.5;
  const kvInfo = calcularKvEnvolvente(result.kh, result.tipoMuro, ratioKv);
  result.kvInfo = kvInfo;
  result.kv_gobernante = kvInfo.gobernante.kv;
  result.psi_rad = kvInfo.gobernante.psi_rad;
  result.psi_deg = kvInfo.gobernante.psi_deg;
  result.PGA_diseno = pgaUsado * (2/3);
  result.PGA_diseno_sitio = result.PGA_sitio * (2/3);
  result.kv = kvInfo.gobernante.kv;  // legacy
  
  if (input.tipoGeotecnia === 'muro-retencion' || input.tipoGeotecnia === 'muro-gaviones' || input.tipoGeotecnia === 'tablestaca') {
    result.advertencias.push({
      tipo: 'metodologia',
      msg: 'Para análisis de empuje sísmico aplicar Mononobe-Okabe con los kh y kv calculados.',
      ref: 'Manual Geotecnia §5.3.1.1 + Figura 5.3'
    });
  } else if (input.tipoGeotecnia === 'muro-rigido') {
    result.advertencias.push({
      tipo: 'metodologia',
      msg: 'Muro rígido restringido: usar kh = Apga/g (sin 2/3) o solución elástica-analítica.',
      ref: 'Manual Geotecnia §5.3.2'
    });
  } else if (input.tipoGeotecnia === 'talud') {
    result.advertencias.push({
      tipo: 'metodologia',
      msg: 'Para estabilidad de talud usar kh en métodos de equilibrio límite (Bishop, Spencer, Janbu).',
      ref: 'Manual Geotecnia §6.6 + REP-21 §6.6'
    });
  } else if (input.tipoGeotecnia === 'pilote') {
    result.advertencias.push({
      tipo: 'metodologia',
      msg: 'Para pilotes considerar interacción cinemática suelo-pilote. Análisis dinámico recomendado.',
      ref: 'REP-21 §5.9'
    });
  } else if (input.tipoGeotecnia === 'cimiento-super') {
    result.advertencias.push({
      tipo: 'metodologia',
      msg: 'Capacidad portante sísmica: aplicar factores Nc, Nq, Nγ ajustados por sismicidad.',
      ref: 'Manual Geotecnia §3 + Figura 3.1'
    });
  }
  
  if (result.kh > 0.2) {
    result.advertencias.push({
      tipo: 'sugerencia',
      msg: `kh = ${result.kh.toFixed(3)} > 0.2. Considerar método basado en desplazamientos permisibles.`,
      ref: 'Manual Geotecnia §5.3.1.2 (Figura 5.5a)'
    });
  }
  
  return result;
}

// ============================================================
// DISPATCHER
// ============================================================
function calcularSismico(input) {
  if (input.tipoEstructura === 'vivienda') return calcularVivienda(input);
  if (input.tipoEstructura === 'geotecnica') return calcularGeotecnia(input);
  return calcularEdificio(input);
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

// ============================================================
// GLOSARIO PARA TOOLTIPS
// ============================================================
const GLOSARIO = {
  'Ss':  { titulo: 'Ss — Aceleración espectral T=0.2s', desc: 'Aceleración espectral de respuesta para períodos cortos (T=0.2 s), en Clase Sitio B (roca), para sismo máximo considerado (MCE, 2% en 50 años, ~2500 años).', ref: 'REP-21 §5.12.1' },
  'S1':  { titulo: 'S1 — Aceleración espectral T=1s', desc: 'Aceleración espectral para T=1s, Clase B, MCE.', ref: 'REP-21 §5.12.2' },
  'PGA': { titulo: 'PGA — Aceleración pico del terreno', desc: 'Peak Ground Acceleration. Aceleración pico (no espectral), Clase B, período de retorno 2500 años.', ref: 'REP-21 §5.12.4' },
  'Fa':  { titulo: 'Fa — Factor de sitio (cortos)', desc: 'Factor de amplificación de sitio para T=0.2s. Modifica Ss según tipo de suelo.', ref: 'Tabla 11.4-1 ASCE 7-05' },
  'Fv':  { titulo: 'Fv — Factor de sitio (T=1s)', desc: 'Factor de amplificación de sitio para T=1s. Modifica S1 según tipo de suelo.', ref: 'Tabla 11.4-2 ASCE 7-05' },
  'SMS': { titulo: 'SMS — Aceleración MCE ajustada (cortos)', desc: 'SMS = Fa · Ss', ref: 'ASCE 7-05 Ec. 11.4-1' },
  'SM1': { titulo: 'SM1 — Aceleración MCE ajustada (T=1s)', desc: 'SM1 = Fv · S1', ref: 'ASCE 7-05 Ec. 11.4-2' },
  'SDS': { titulo: 'SDS — Aceleración de diseño (cortos)', desc: 'SDS = (2/3)·SMS. Factor 2/3 reduce de MCE a sismo de diseño.', ref: 'ASCE 7-05 Ec. 11.4-3' },
  'SD1': { titulo: 'SD1 — Aceleración de diseño (T=1s)', desc: 'SD1 = (2/3)·SM1', ref: 'ASCE 7-05 Ec. 11.4-4' },
  'T0':  { titulo: 'T0 — Inicio zona plana', desc: 'T0 = 0.2·SD1/SDS', ref: 'ASCE 7-05 §11.4.5' },
  'Ts':  { titulo: 'Ts — Fin zona plana', desc: 'Ts = SD1/SDS', ref: 'ASCE 7-05 §11.4.5' },
  'TL':  { titulo: 'TL — Transición período largo', desc: 'TL = 10 s para Panamá. A partir de TL el espectro decae con 1/T².', ref: 'REP-21 §5.12.3' },
  'R':   { titulo: 'R — Factor de modificación de respuesta', desc: 'Reduce fuerzas elásticas considerando ductilidad. Mayor R = menor fuerza de diseño.', ref: 'Tabla 12.2-1 ASCE 7-05' },
  'Omega': { titulo: 'Ω₀ — Factor de sobre-resistencia', desc: 'Amplifica fuerzas para diseñar elementos críticos (columnas, conexiones).', ref: 'Tabla 12.2-1 ASCE 7-05' },
  'Cd':  { titulo: 'Cd — Factor amplificación de deflexiones', desc: 'Convierte derivas elásticas en derivas inelásticas reales. δ_real = Cd·δ_e/Ie.', ref: 'Tabla 12.2-1 ASCE 7-05' },
  'Ie':  { titulo: 'Ie — Factor de importancia', desc: 'Ie = 1.00 (I, II), 1.25 (III), 1.50 (IV). Aumenta fuerzas según consecuencia de falla.', ref: 'Tabla 1.5-2 ASCE 7-05' },
  'Riesgo': { titulo: 'Categoría de Riesgo (I–IV)', desc: 'I = bajo riesgo. II = ordinaria. III = importante (escuelas, gimnasios). IV = esencial (hospitales).', ref: 'Tabla 1.5-1 ASCE 7-05' },
  'CDS': { titulo: 'CDS — Categoría de Diseño Sísmico', desc: 'A–F. Determina nivel de detallado, sistemas permitidos y análisis exigidos. Función de SDS, SD1, S1, Categoría Riesgo.', ref: 'Tablas 11.6-1 y 11.6-2 ASCE 7-05' },
  'Cs':  { titulo: 'Cs — Coeficiente sísmico', desc: 'V = Cs·W (cortante basal sísmico). Adimensional.', ref: 'ASCE 7-05 Ec. 12.8-1' },
  'Ta':  { titulo: 'Ta — Período fundamental aproximado', desc: 'Ta = Ct · hn^x. Fórmula empírica sin análisis modal.', ref: 'ASCE 7-05 Ec. 12.8-7' },
  'Ct':  { titulo: 'Ct — Coeficiente para Ta', desc: 'Coeficiente empírico según sistema. SMF acero=0.0724, SMF concreto=0.0466, EBF/BRBF=0.0731, otros=0.0488.', ref: 'Tabla 12.8-2 ASCE 7-05' },
  'x':   { titulo: 'x — Exponente para Ta', desc: 'Exponente empírico según sistema. SMF acero=0.8, SMF concreto=0.9, otros=0.75.', ref: 'Tabla 12.8-2 ASCE 7-05' },
  'Cu':  { titulo: 'Cu — Límite superior para T', desc: 'T_usado ≤ Cu·Ta. Función de SD1: 1.4 (SD1≥0.4), 1.5 (0.2), 1.6 (0.15), 1.7 (≤0.1).', ref: 'Tabla 12.8-1 ASCE 7-05' },
  'hn':  { titulo: 'hn — Altura del edificio', desc: 'Altura desde base hasta nivel superior estructural (azotea). No incluye penthouse pequeño (<25% área).', ref: 'ASCE 7-05 §11.2' },
  'T':   { titulo: 'T — Período de diseño', desc: 'Período usado en Cs. Modos: auto (Cu·Ta), manual (de análisis modal, limitado por Cu·Ta), Ta puro (conservador).', ref: 'ASCE 7-05 §12.8.2' },
  'ClaseSitio': { titulo: 'Clase de Sitio (A–F)', desc: 'A=roca dura, B=roca, C=suelo denso/roca blanda, D=suelo rígido, E=suelo blando, F=requiere análisis específico.', ref: 'Tabla 20.3-1 ASCE 7-05' },
  'kh':  { titulo: 'kh — Coeficiente sísmico horizontal', desc: 'Fracción de g aplicada como fuerza inercial horizontal en análisis pseudoestático.', ref: 'REP-21 §6.5 + Manual §5.4 Cuadro 14' },
  'kv':  { titulo: 'kv — Coeficiente sísmico vertical', desc: 'Fracción de g aplicada como fuerza inercial vertical. Modifica peso aparente: W_ef = W·(1∓kv). Envolvente obligatorio: kv=0, +kv, -kv.', ref: 'Manual §5.4 Cuadro 14 Nota 1' },
  'Apga': { titulo: 'Apga — Aceleración pico en sitio', desc: 'Aceleración pico del terreno en el sitio. En esta app: PGA del mapa Clase B (puede ajustarse por Fa).', ref: 'Manual Geotecnia §5.4' },
  'tipoMuro': { titulo: 'Tipo de muro (rígido / flexible)', desc: 'Rígido = restringido (sótano, estribo arriostrado). Flexible = puede desplazarse. Umbral para asumir kv=0: rígido ≤ 0.10, flexible ≤ 0.05.', ref: 'Manual §5.3.1, §5.3.2 + Cuadro 14 Nota 1' }
};

window.SismicCalc = {
  calcularSismico, calcularEdificio, calcularVivienda, calcularGeotecnia,
  calcularPeriodo, calcularKh, calcularKvEnvolvente,
  validarSistemaContraCDS, generarEspectro, categoriaDisenoSismico,
  obtenerCu, categoriaCtX,
  SISTEMAS_ESTRUCTURALES, TIPOS_GEOTECNICA, METODOS_KH,
  CT_X_TABLE, IE_TABLE, FA_TABLE, FV_TABLE, GLOSARIO
};
