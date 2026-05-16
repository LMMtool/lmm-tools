# SismoPanamá — Visor REP-21 + Calculadora

Herramienta web gratuita basada en el Reglamento Estructural Panameño REP-2021.

**URL:** [lmmtool.github.io/sismo](https://lmmtool.github.io/sismo)
**Generada por:** LMM Ingeniería

## Funcionalidades v1.0.2

### Visor
- Consulta de PGA, Ss, S₁ por coordenada (clic en mapa o input manual).
- Inputs duales: Latitud/Longitud ↔ UTM 17N.
- **Curvas isosísmicas tipo topográfico** con spline (esquinas redondas) cada 0.04 g.
- **Etiquetas embebidas sobre la línea** al hacer zoom (≥ zoom 9).
- Escala de color por intensidad (azul claro a rojo).

### Tres metodologías diferenciadas

**1. Edificios e Infraestructura Grupo 2** (ASCE 7-05 + REP-21)
- Inputs: Clase Sitio, Categoría Riesgo, Sistema Estructural, Período T.
- Calcula: Fa, Fv, SMS, SM1, SDS, SD1, Cs, CDS, espectro de diseño.
- 20 sistemas estructurales + opción personalizada (R/Ω₀/Cd manual).

**2. Vivienda Unifamiliar** (REP-21 Capítulo 7 - simplificado)
- Inputs reducidos: Solo Clase de Sitio + checkboxes de condiciones.
- Calcula: PGA, densidad mínima de paredes, clasificación construcción típica.
- No usa ASCE completo (no aplica a este caso normativo).

**3. Estructura Geotécnica** (REP-21 Capítulo 6 - pseudoestático)
- Inputs reducidos: Subtipo geotécnico, Clase Sitio, kv.
- Calcula: PGA×2/3, kh, kv, ángulo ψ Mononobe-Okabe.
- 8 subtipos: muros, gaviones, geocelda, tablestaca, talud, pilote, etc.

### Reporte PDF
- Memoria técnica completa por tipo de estructura.
- Formato Carta 8.5 × 11".
- Footer permanente "Aplicación desarrollada por LMM Ingeniería".
- Hash único de trazabilidad.

## Estructura

```
sismo/
├── index.html
├── style.css
├── app.js
├── data/
│   ├── manifest.json
│   └── v1.0/
│       ├── pga.json, ss.json, s1.json
│       └── contours.json
├── lib/
│   ├── raster.js
│   ├── seismic-calc.js
│   └── pdf-gen.js
└── README.md
```

## Aviso legal

Esta herramienta es de **referencia**. El uso técnico es **responsabilidad exclusiva del ingeniero usuario**. La responsabilidad del diseño sísmico recae enteramente sobre el profesional firmante.

## Licencia

MIT. © 2026 LMM Ingeniería.
