# SismoPanamá v1.0.3

Visor del REP-2021 + calculadora sísmica para Panamá.

**URL:** [lmmtool.github.io/sismo](https://lmmtool.github.io/sismo)
**Generada por:** LMM Ingeniería

## Novedades v1.0.3

✅ **Curvas vectoriales oficiales del REP** integradas desde el ArcGIS oficial (JTIA + ACP + Esri Panamá + Colegio de Ingenieros Civiles).
✅ Zona Panamá-Colón muestra los datos oficiales cada **0.02 g**.
✅ Resto del país usa curvas suavizadas del raster nacional.
✅ Sin saturación multicolor — color único corporativo con jerarquía visual (curvas mayores cada 0.10 g + menores cada 0.02 g).

## Funcionalidades

### Visor
- Consulta PGA, Ss, S₁ por coordenada.
- Latitud/Longitud ↔ UTM 17N.
- Curvas isosísmicas profesionales (datos oficiales + nacional).
- Etiquetas embebidas sobre la línea al hacer zoom.

### Tres metodologías
1. **Edificios** (ASCE 7-05 + REP-21): Cs, espectro, CDS.
2. **Vivienda** (REP-21 Cap. 7): densidad mínima de paredes.
3. **Geotecnia** (REP-21 Cap. 6): kh, kv, ψ Mononobe-Okabe.

### Reporte PDF
- Carta 8.5×11".
- Memoria técnica completa por metodología.
- Footer "Aplicación desarrollada por LMM Ingeniería".

## Estructura

```
sismo/
├── index.html
├── style.css
├── app.js
├── data/
│   ├── manifest.json
│   └── v1.0/
│       ├── pga.json, ss.json, s1.json  (rasters)
│       └── contours.json                (oficial + nacional)
├── lib/
│   ├── raster.js
│   ├── seismic-calc.js
│   └── pdf-gen.js
└── README.md
```

## Fuentes de datos

- **Mapas oficiales (zona Panamá-Colón):** ArcGIS oficial del REP — Junta Técnica de Ingenieros y Arquitectos, Autoridad del Canal de Panamá, Esri Panamá, Colegio de Ingenieros Civiles. Item ID: `d0329ac9f4b3467a8657429501e43b46`.
- **Raster nacional:** GeoTIFFs oficiales del REP-2021 Anexo 3.

## Aviso legal

Herramienta de referencia. El uso técnico es responsabilidad exclusiva del ingeniero usuario. La responsabilidad del diseño sísmico recae enteramente sobre el profesional firmante.

## Licencia

MIT. © 2026 LMM Ingeniería.
