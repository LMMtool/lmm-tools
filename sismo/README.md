# SismoPanamá v2.0

Visor del REP-2021 + calculadora sísmica para Panamá.

**Generada por:** LMM Ingeniería
**Marco legal:** Gaceta Oficial Digital N° 29594-A (5 ago 2022). Resolución JTIA-020-2022.

---

## Novedades v2.0

### Sprint 1 — Seguridad estructural
✅ Validación completa de Tabla 12.2-1 ASCE 7-05 (sistemas prohibidos por CDS + límites de altura por sistema).
✅ Envolvente kv obligatorio de 3 escenarios (Manual Geotecnia §5.4 Cuadro 14 Nota 1).
✅ Advertencias automáticas de análisis específico de sitio cuando Fa/Fv requieren extrapolación.
✅ Detección de sistema NP (No Permitido) con referencia exacta + recomendación.

### Sprint 2 — Coherencia normativa
✅ 6 métodos para kh del Cuadro 14 del Manual (A-F): default REP, SDS/2.5, función de Apga, fracción Apga, Apga pleno, AASHTO.
✅ Cálculo automático Ta = Ct·hn^x (Ec. 12.8-7 ASCE 7-05).
✅ Coeficiente Cu automático según SD1 (Tabla 12.8-1).
✅ Override de Ss/S1/PGA para estudios específicos de sitio.
✅ 3 modos de período T: auto (Cu·Ta), manual (análisis modal, limitado por §12.8.2), Ta puro.

### Sprint 3 — Trazabilidad / UX
✅ Memoria de cálculo paso a paso con cada ecuación citada.
✅ Glosario embebido con 30 entradas y referencias normativas.
✅ Tooltips ⓘ clickeables en cada parámetro técnico.
✅ CDS auditable con criterio explícito (por SDS, por SD1, gobernante).
✅ Advertencias agrupadas por severidad (crítica, media, metodología, sugerencia).
✅ Sistema custom expandido (nombre + referencia + R/Ω₀/Cd).

---

## Tres metodologías

1. **Edificios e Infraestructura** (ASCE 7-05 + REP-21): Cs, espectro, CDS, validación Tabla 12.2-1, Ta automático.
2. **Vivienda** (REP-21 Cap. 7): densidad mínima de paredes, triggers no-típica con referencia.
3. **Geotecnia** (REP-21 Cap. 6 + Manual): kh con 6 métodos, envolvente kv automático, ψ Mononobe-Okabe del caso gobernante.

---

## Estructura

```
sismopanama-v2/
├── index.html              UI v2.0 con modo dual espectro + glosario
├── style.css               Estilos + memoria de cálculo + envolvente kv
├── app.js                  Lógica frontend + render con referencias
├── data/
│   ├── manifest.json       app_version=v2.0
│   └── v1.0/               Rasters sin cambios (Mapas REP-21)
├── lib/
│   ├── raster.js           Sin cambios
│   ├── seismic-calc.js     Motor v2.0 — 830 líneas, todas las tablas normativas
│   └── pdf-gen.js          Compatible v2 (memoria + envolvente kv)
├── REPORTE_CAMBIOS_v2.md   Documentación detallada de cambios
└── README.md
```

---

## Fuentes de datos

- **Mapas oficiales** (zona Panamá-Colón): ArcGIS oficial del REP — JTIA, ACP, Esri Panamá, Colegio de Ingenieros Civiles.
- **Raster nacional**: GeoTIFFs oficiales del REP-2021 Anexo 3.

---

## Cumplimiento normativo

### REP-2021
§3.2, §5.2.1, §5.9, §5.11, §5.12.1-4, §6.5, §6.6, §7.3-7.4, §7.4.2.3

### ASCE 7-05
Tablas 1.5-1, 1.5-2, 11.4-1, 11.4-2, 11.6-1, 11.6-2, 12.2-1, 12.3-1, 12.8-1, 12.8-2, 20.3-1.
Ecuaciones 11.4-1/2/3/4, 12.8-1/2/3/4/5/6/7.
§11.6, §12.2.5.6, §12.8.1, §12.8.2.
Capítulos 20 y 21.

### Manual de Geotecnia REP-21
§3, §5.3.1.1, §5.3.1.2, §5.3.2, §5.4 (Cuadro 14 + Nota 1), §6.6.

---

## Aviso legal

Herramienta de referencia. El uso técnico es responsabilidad exclusiva del ingeniero usuario. La responsabilidad del diseño sísmico recae enteramente sobre el profesional firmante.

## Licencia

MIT. © 2026 LMM Ingeniería.
