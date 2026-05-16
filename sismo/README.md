# SismoPanamá — Visor REP-21 + Calculadora Cs

Herramienta web gratuita para consulta de aceleraciones espectrales del Reglamento Estructural Panameño (REP-2021) y cálculo del coeficiente sísmico de diseño Cs.

**URL del visor:** [lmmtool.github.io/sismo](https://lmmtool.github.io/sismo)

**Herramienta generada por:** LMM Ingeniería

---

## Funcionalidades

### Visor del mapa
- Consulta interactiva de PGA, Ss y S₁ por coordenada (clic en mapa o ingreso manual).
- Inputs duales: Latitud/Longitud ↔ UTM Zona 17N (mismo CRS oficial del REP-21).
- **Curvas isosísmicas topográficas** con escala de color por intensidad y etiquetas de valor.
- Tres basemaps: CartoDB Voyager, OpenStreetMap, Satélite (Esri).

### Calculadora de coeficiente sísmico Cs
- **Tipo de estructura**: edificio, infraestructura Grupo 2, vivienda unifamiliar, geotécnica.
- **Submenú geotécnico**: muro de retención, gaviones, geocelda, tablestaca, talud, pilote, etc.
- **Clase de sitio** A-F (Clase F bloqueada por requerir estudio específico).
- **Categoría de riesgo** I-IV con factor de importancia Ie.
- **20 sistemas estructurales** organizados por material + opción personalizada (R/Ω₀/Cd manual).
- Cálculo automático: Fa, Fv, SMS, SM1, SDS, SD1, Cs, Categoría de Diseño Sísmico.
- Espectro de respuesta de diseño graficado dinámicamente.

### Reporte técnico PDF
- Memoria técnica completa con todos los valores, ecuaciones y referencias normativas.
- Formato carta (8.5 × 11 pulgadas).
- Hash único por reporte para trazabilidad.
- Footer: "Aplicación desarrollada por LMM Ingeniería".

---

## Marco normativo

- **REP-2021** — Resolución JTIA-020-2022, Gaceta Oficial Digital N° 29594-A (5 agosto 2022).
- **ASCE/SEI 7-05** — Capítulos 11, 12 y 20.

### Modificaciones REP-21 implementadas:
- Cortante basal mínimo: `Cs ≥ 0.044·SDS·Ie ≥ 0.01` (sección 5.2.1).
- Período de transición de período largo: `TL = 10 s` (sección 5.13).
- Factor 2/3 para estructuras geotécnicas (Capítulo 6).
- Densidad mínima de paredes en vivienda unifamiliar según PGA (Capítulo 7).

---

## Estructura del repositorio

```
sismo/
├── index.html
├── style.css
├── app.js
├── data/
│   ├── manifest.json
│   └── v1.0/
│       ├── pga.json
│       ├── ss.json
│       ├── s1.json
│       └── contours.json
├── lib/
│   ├── raster.js
│   ├── seismic-calc.js
│   └── pdf-gen.js
└── README.md
```

---

## Aviso legal

Esta herramienta es de **referencia**. El uso técnico es **responsabilidad exclusiva del ingeniero usuario**. SismoPanamá y LMM Ingeniería no se hacen responsables de errores de diseño derivados del uso de esta herramienta. La responsabilidad del diseño sísmico recae enteramente sobre el profesional firmante.

---

## Licencia

MIT License.

## Contacto

**LMM Ingeniería**  
GitHub: [@LMMtool](https://github.com/LMMtool)
