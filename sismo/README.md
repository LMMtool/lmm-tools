# SismoPanamá — Visor REP-21 + Calculadora Cs

Herramienta web gratuita para consulta de aceleraciones espectrales del Reglamento Estructural Panameño (REP-2021) y cálculo del coeficiente sísmico de diseño Cs.

**URL del visor:** [lmmtool.github.io/sismo](https://lmmtool.github.io/sismo)

**Desarrollado por:** LMM Ingeniería

---

## Funcionalidades

### Visor del mapa
- Consulta interactiva de PGA, Ss y S₁ por coordenada (clic en mapa o ingreso manual).
- Inputs duales: Latitud/Longitud ↔ UTM Zona 17N (mismo CRS oficial del REP-21).
- Heatmap visual de aceleraciones con escala de colores.
- Tres basemaps disponibles: OpenStreetMap, CartoDB Voyager, Satélite (Esri).

### Calculadora de coeficiente sísmico Cs
- Inputs: tipo de estructura, clase de sitio (A–F), categoría de riesgo (I–IV), sistema estructural, período T.
- Cálculo automático: Fa, Fv, SMS, SM1, SDS, SD1, Cs, Categoría de Diseño Sísmico.
- Espectro de respuesta de diseño graficado dinámicamente.
- Módulo especial para vivienda unifamiliar (densidad de paredes según PGA).
- Aplicación correcta del factor 2/3 para estructuras geotécnicas.

### Reporte técnico PDF
- Descarga de memoria técnica completa con todos los valores, ecuaciones y referencias normativas.
- Formato carta (8.5 × 11 pulgadas) optimizado para impresión.
- Hash único por reporte para trazabilidad.
- Footer: "Aplicación desarrollada por LMM Ingeniería".

---

## Marco normativo

Esta herramienta implementa:

- **REP-2021** — Reglamento para el Diseño Estructural Panameño.  
  Resolución JTIA-020-2022, Gaceta Oficial Digital N° 29594-A (5 agosto 2022).
- **ASCE/SEI 7-05** — Minimum Design Loads for Buildings and Other Structures.  
  Capítulos 11 (Diseño Sísmico) y 12 (Estructuras de Edificios).

### Modificaciones específicas del REP-21 implementadas:
- Cortante basal mínimo: `Cs ≥ 0.044·SDS·Ie ≥ 0.01` (sección 5.2.1).
- Período de transición de período largo: `TL = 10 s` (sección 5.13).
- Mapas oficiales de aceleración (Anexo 3): PGA, Ss, S₁ para Clase de Sitio B, 2500 años, 5% amortiguamiento.
- Factor 2/3 para estructuras geotécnicas (Capítulo 6).
- Densidad mínima de paredes en vivienda unifamiliar según PGA (Capítulo 7).

---

## Estructura del repositorio

```
sismo/
├── index.html              ← Visor y calculadora
├── style.css
├── app.js                  ← Lógica principal
├── data/
│   ├── manifest.json       ← Versión activa, metadatos
│   └── v1.0/
│       ├── pga.json        ← Mapa PGA comprimido (zlib + base64)
│       ├── ss.json         ← Mapa Ss
│       └── s1.json         ← Mapa S₁
├── lib/
│   ├── raster.js           ← Carga y consulta de rásters
│   ├── seismic-calc.js     ← Cálculos sísmicos ASCE 7-05 + REP-21
│   └── pdf-gen.js          ← Generación del reporte PDF
└── README.md
```

---

## Dependencias (todas vía CDN, sin instalación)

- [Leaflet 1.9.4](https://leafletjs.com/) — Mapa interactivo
- [proj4js 2.11](http://proj4js.org/) — Reproyección de coordenadas
- [Chart.js 4.4](https://www.chartjs.org/) — Gráfico del espectro
- [pako 2.1](https://github.com/nodeca/pako) — Descompresión zlib
- [jsPDF 2.5](https://github.com/parallax/jsPDF) — Generación del PDF

---

## Versionado y actualizaciones

El sistema usa carpetas versionadas (`data/v1.0/`, `data/v1.1/`, etc.) y un `manifest.json` que apunta a la versión activa. Cuando salgan correcciones o un nuevo REP, se agrega una carpeta nueva y se actualiza el manifest. Las versiones anteriores quedan accesibles para verificación de diseños históricos.

Ver [CHANGELOG](data/manifest.json) en el manifest.

---

## Aviso legal

Esta herramienta es de **referencia**. Los valores se derivan de los mapas oficiales del REP-2021 publicados en Gaceta Oficial. Sin embargo:

- El uso técnico es **responsabilidad exclusiva del ingeniero usuario**.
- Para diseño formal, siempre verificar contra el reglamento oficial.
- SismoPanamá y LMM Ingeniería no se hacen responsables de errores de diseño derivados del uso de esta herramienta.
- La responsabilidad del diseño sísmico recae enteramente sobre el profesional firmante.

---

## Licencia

MIT License. Ver archivo `LICENSE` en la raíz del repositorio principal.

---

## Contacto

**LMM Ingeniería**  
GitHub: [@LMMtool](https://github.com/LMMtool)  
Web: [lmmtool.github.io](https://lmmtool.github.io)
