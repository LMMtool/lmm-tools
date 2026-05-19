# SismoPanamá v2.0 — Reporte de Cambios

**Fecha:** 2026-05-19
**Versión anterior:** v1.0.3
**Versión nueva:** v2.0
**Tipo:** Revisión normativa mayor

---

## 1. Resumen ejecutivo

v2.0 corrige 3 brechas normativas críticas del v1.0.3 detectadas en revisión contra REP-2021 + ASCE 7-05 + Manual de Geotecnia REP-21:

1. **Seguridad estructural**: no se validaba Tabla 12.2-1 (sistemas prohibidos por CDS + límites de altura). Permitía Cs válido para combinaciones imposibles (ej. OMF acero en CDS D).
2. **kv geotécnico**: solo permitía 3 opciones manuales sin obligar la envolvente. Manual §5.4 Cuadro 14 Nota 1 exige correr 3 escenarios y usar gobernante.
3. **Período T**: se ingresaba a ciegas. No calculaba Ta·Cu (Ec. 12.8-7 + Tabla 12.8-1) ni validaba contra §12.8.2.

Adicionalmente: trazabilidad pobre (sin memoria de cálculo, sin glosario, sin referencias en pantalla).

---

## 2. Cambios por archivo

### `lib/seismic-calc.js` — Motor de cálculo

| Cambio | Descripción | Referencia normativa |
|---|---|---|
| ➕ Tabla 12.2-1 completa | Cada sistema ahora tiene `limites: {A,B,C,D,E,F}` con valores reales (null=sin límite, 'NP'=no permitido, número=metros). Incluye `refTabla` y `excepcion`. | Tabla 12.2-1 ASCE 7-05 |
| ➕ `validarSistemaContraCDS()` | Función nueva que valida combinación sistema+CDS+altura. Retorna error con referencia, recomendación y excepción si aplica. | Tabla 12.2-1 |
| ➕ Cálculo automático Ta | `calcularPeriodo()` calcula Ta = Ct·hn^x con coeficientes de Tabla 12.8-2 según sistema. | Ec. 12.8-7 + Tabla 12.8-2 |
| ➕ Cálculo automático Cu | `obtenerCu(SD1)` retorna 1.4–1.7 según SD1. | Tabla 12.8-1 |
| ➕ 3 modos de período T | auto (Cu·Ta), manual (T análisis modal, limitado a Cu·Ta), ta (sin amplificar). Aplica §12.8.2 automáticamente. | §12.8.2 |
| ➕ Override Ss/S1/PGA | `ssOverride`, `s1Override`, `pgaOverride` permiten ingresar valores manuales (estudio específico de sitio). | REP-21 §3.2, §5.11 |
| ➕ Override Custom nombre/ref | Sistema custom ahora acepta `customNombre` y `customRef` (campos texto) para trazabilidad. | — |
| ➕ Advertencias Fa/Fv extrapolados | Si Clase E con Ss>1.25 o S1>0.5 → crítica con texto exigiendo análisis específico de sitio. Clase D → media. | Tabla 11.4-1/-2 notas, REP-21 §5.11 |
| ➕ CDS auditable | `CDS_info` retorna `cdsPorSDS`, `cdsPorSD1`, `criterio` (texto explícito) y `ref`. | Tablas 11.6-1, 11.6-2 |
| ➕ Cs desglose completo | Devuelve `Cs_basico`, `Cs_max`, `Cs_min_REP21`, `Cs_min_S1`, `Cs_min`, `Cs_gobierna` con texto explícito. | Ec. 12.8-2/3/4/5/6 |
| ➕ 6 métodos para kh | `calcularKh(metodo, pga, sds)` implementa A–F del Cuadro 14 Manual + REP §6.5. Cada uno con `formula`, `detalle`, `ref`, `aplica`. | Manual §5.4 Cuadro 14, REP §6.5 |
| ➕ Envolvente kv obligatorio | `calcularKvEnvolvente(kh, tipoMuro, ratioKv)` corre 3 escenarios (kv=0, +kv, −kv), identifica gobernante por mayor ψ, advierte si kh ≤ umbral (rígido 0.10, flexible 0.05). | Manual §5.4 Cuadro 14 Nota 1 |
| ➕ Tipos geotecnia ampliados | Cada tipo tiene `categoria` (rigido/flexible) y `khRecomendado`. Agregado `muro-rigido` como tipo separado. | Manual §5.3.1, §5.3.2 |
| ➕ Advertencias metodológicas geotécnicas | Cada tipo recibe recomendación específica (Mononobe-Okabe, equilibrio límite Bishop/Spencer, interacción cinemática pilotes, etc.). | Manual §5.3, §6.6, REP §5.9 |
| ➕ GLOSARIO embebido | 30 entradas (Ss, S1, PGA, Fa, Fv, SMS, SM1, SDS, SD1, T0, Ts, TL, R, Ω₀, Cd, Ie, Riesgo, CDS, Cs, Ta, Ct, x, Cu, hn, T, ClaseSitio, kh, kv, Apga, tipoMuro). Cada una con `titulo`, `desc`, `ref`. | Diversas |
| ➕ Errores y advertencias estructurados | Antes: strings. Ahora: objetos `{tipo, msg, ref, requerimiento?, excepcion?, recomendacion?}`. | — |

### `index.html` — UI

| Cambio | Descripción |
|---|---|
| ➕ Sección espectro modo dual | Toggle AUTO (mapa) / MANUAL (estudio específico). Inputs Ss/S1/PGA con prellenado automático desde mapa. |
| ➕ Input altura hn | Campo nuevo para edificios. Default 9.0 m. |
| ➕ Selector modo período T | auto / manual / ta puro. Banner explicativo en cada modo. |
| ➕ Sistema custom expandido | Inputs `customNombre` y `customRef` además de R/Ω₀/Cd. Hint explica responsabilidad usuario. |
| ➕ Info-box dinámico por sistema | Al elegir sistema, muestra refTabla + R/Ω₀/Cd + límites de altura por CDS + excepción si aplica. |
| ➕ Selector método kh | 6 opciones (A-F) del Cuadro 14 con fórmula visible y banner explicativo. |
| ➕ Selector ratio kv | 0.50, 0.67, 1.00 (fracción de kh). Banner explica que correrá envolvente. |
| ➕ Subtipo geotécnico ampliado | Agregado "Muro rígido restringido" como tipo separado. Banner dinámico muestra categoría (rígido/flexible) y método kh recomendado. |
| ➕ Iconos ⓘ tooltips | 30+ iconos sobre cada parámetro técnico. Click abre modal con definición + referencia. |
| ➕ Modal Glosario | Lista completa de 30 parámetros con búsqueda visual. Accesible desde header. |
| ➕ Modal detalle parámetro | Se abre al click en ⓘ con título + descripción + referencia normativa. |
| ➖ Selector kv-option simple | Reemplazado por método kh + ratio kv + envolvente automático. |
| ➖ Input período simple | Reemplazado por selector modo + (si manual) input. |

### `app.js` — Lógica frontend

| Cambio | Descripción |
|---|---|
| ➕ `setEspectroMode()` | Toggle auto/manual, prellena inputs del mapa. |
| ➕ `onModoPeriodoChange()` | Muestra/oculta input manual + banner contextual. |
| ➕ `onTipoGeoChange()` | Muestra categoría y método kh recomendado, auto-selecciona. |
| ➕ `onMetodoKhChange()` | Muestra fórmula, ref, aplicación. Advierte si requiere SDS. |
| ➕ `renderGlosario()` | Genera modal glosario desde GLOSARIO. |
| ➕ `setupTooltips()` | Delegación global de clicks en `.info-icon`. |
| ➕ `renderAdvertencias()` | Agrupa advertencias por severidad (crítica, media, metodología, sugerencia, info) con iconos y referencias. |
| 🔄 `renderResultadosEdificio()` | Reescrito: ahora muestra memoria de cálculo paso a paso con 5 pasos (espectro, CDS, sistema, período, Cs), cada uno con fórmula y referencia. Resumen grid 2 columnas con tooltips. |
| 🔄 `renderResultadosGeotecnia()` | Reescrito: tabla envolvente kv (3 filas con gobernante resaltado), memoria método kh con detalle y referencia. |
| 🔄 `renderResultadosVivienda()` | Triggers con referencia inline. |
| 🔄 `calcular()` | Lee inputs nuevos (hn, modoPeriodo, periodoManual, metodoKh, ratioKv, espectroOverrides, customNombre, customRef). |
| 🔄 `renderCalcResults()` | Maneja errores estructurados (objetos con ref/excepción/recomendación) en lugar de strings. |
| 🔄 Badge versión | Lee `app_version` si existe, fallback a `active_version`. |

### `lib/pdf-gen.js` — Generador PDF

| Cambio | Descripción |
|---|---|
| 🔄 Tabla parámetros entrada | Incluye hn, Ta, Cu, T usado. |
| 🔄 Reporte geotecnia | Sección "Método kh" con fórmula/ref. Sección "Envolvente kv" con 3 escenarios y gobernante. Sección "Ángulo ψ caso gobernante". |
| 🔄 Compatibilidad v2 | Lee nuevos campos (`tipoGeotecnicoInfo`, `tipoMuro`, `khInfo`, `kvInfo`, `kv_gobernante`). |

### `style.css` — Estilos

| Cambio | Descripción |
|---|---|
| ➕ `.info-icon` | Ícono ⓘ circular 14px con hover. |
| ➕ `.info-banner` | Banner contextual con borde izquierdo accent. |
| ➕ `.grid-2`, `.grid-3` | Layouts inputs múltiples. |
| ➕ `.cds-badge.cds-A` a `.cds-F` | Colores semáforo: A/B verde, C amarillo, D naranja, E rojo, F violeta. |
| ➕ `.resumen-grid` | Grid 2 columnas para info-rows. |
| ➕ `.memoria-section`, `.memoria-paso`, `.memoria-formula`, `.memoria-ref`, `.memoria-nota` | Estilo memoria de cálculo. |
| ➕ `.adv-section`, `.adv-item`, `.warn-critica/media/meto/info` | Advertencias agrupadas por color. |
| ➕ `.kv-table`, `.kv-gobierna` | Tabla envolvente kv con gobernante resaltado. |
| ➕ `.glosario-item` | Estilo glosario. |
| ➕ `.ok-box` | Caja verde para "califica" en vivienda. |
| ➕ `.checkbox-row` | Layout checkbox + texto. |

### `data/manifest.json`

| Cambio | Descripción |
|---|---|
| ➕ `app_version: "v2.0"` | Campo nuevo separado de `active_version` (que sigue siendo v1.0 para los rasters). |
| ➕ Entrada changelog v2.0 | Nota completa con los 3 sprints. |

---

## 3. Tabla antes/después de casos clave

### Caso 1: Gimnasio Paraíso (validación contra Excel del usuario)

| Aspecto | v1.0.3 | v2.0 | Verificación |
|---|---|---|---|
| Ss, S1, PGA | 1.8, 0.62, 0.5 | 1.8, 0.62, 0.5 | Coincide con Excel |
| Fa, Fv | 0.9, 2.4 | 0.9, 2.4 | Coincide con Excel |
| SDS, SD1 | 1.080, 0.992 | 1.080, 0.992 | Coincide con Excel |
| **CDS** | **D** (correcto) | **D** (correcto) | **Excel decía E (error de Excel)** |
| **Ta auto** | **No calculaba** | **0.404 s** | Coincide con Excel |
| **Cu auto** | **No aplicaba** | **1.4** | Coincide con Excel |
| **T usado** | T=0.5 (input manual) | 0.565 s (Cu·Ta) | Coincide con Excel |
| Cs | 0.4357 (con T=0.5) | 0.3857 (con T=0.565) | Coincide con Excel |
| **Validación OMF en CDS D** | **No validaba (permitía)** | **ERROR: OMF NP en CDS D** | Tabla 12.2-1 |
| **Advertencia Clase E + Ss>1.25** | **No advertía** | **CRÍTICA: requiere análisis específico** | Tabla 11.4-1 nota |

### Caso 2: Geotecnia muro de retención (PGA=0.45g, Clase D)

| Aspecto | v1.0.3 | v2.0 |
|---|---|---|
| kh | 0.30 (fijo: 2/3·PGA) | 6 métodos a elegir; default 0.30 |
| kv | un valor elegido a mano (0, +kh/2, -kh/2) | envolvente 3 escenarios automática |
| Caso gobernante | usuario decide | identificado automáticamente (kv=+0.15 → ψ=19.44°) |
| Umbral kv=0 | no se validaba | flexible: kh ≤ 0.05, rígido: kh ≤ 0.10 (advierte si aplica) |
| Referencia | sin ref | "Manual Geotecnia §5.4 Cuadro 14 Nota 1" |

### Caso 3: Período T para SMF acero hn=20m, SD1=0.5

| Aspecto | v1.0.3 | v2.0 |
|---|---|---|
| Ta | usuario ingresa | Ct=0.0724, x=0.8 → Ta = 0.794 s (auto) |
| Cu | no se aplicaba | 1.4 (SD1≥0.4) |
| T por defecto | usuario ingresa cualquiera | Cu·Ta = 1.111 s |
| Validación §12.8.2 | no validaba | si usuario ingresa T>Cu·Ta, limita y advierte |

---

## 4. Referencias normativas usadas

### REP-2021
- §3.2 — Mapas oficiales (Ss, S1, PGA)
- §5.2.1 — Cortante mínimo (Cs ≥ 0.044·SDS·Ie ≥ 0.01)
- §5.9 — Cimientos profundos
- §5.11 — Estudio específico de sitio
- §5.12.1 / §5.12.2 / §5.12.4 — Definición Ss, S1, PGA
- §5.12.3 — TL = 10 s para Panamá
- §6.5 — Factor 2/3 para diseño geotécnico
- §6.6 — Estabilidad de taludes
- §7.3 / §7.4 — Vivienda unifamiliar típica
- §7.4.2.3 — Parámetros mampostería confinada

### ASCE 7-05
- Tabla 1.5-1 — Categoría de Riesgo I–IV
- Tabla 1.5-2 — Factor de importancia Ie
- §11.4 + Ecs 11.4-1/2/3/4 — SMS, SM1, SDS, SD1
- §11.4.5 — T0, Ts
- §11.6 — CDS especial cuando S1 ≥ 0.75
- Tabla 11.4-1 / 11.4-2 (+ notas) — Fa, Fv y análisis específico
- Tablas 11.6-1 / 11.6-2 — CDS por SDS y SD1
- §12.2.5.6 — Excepción OMF en CDS D/E
- Tabla 12.2-1 — Sistemas estructurales + límites altura
- Tabla 12.3-1 — Irregularidad horizontal
- §12.8.1 + Ec 12.8-1 — V = Cs·W
- §12.8.1.1 + Ecs 12.8-2/3/4/5/6 — Cs y sus límites
- §12.8.2 + Ec 12.8-7 — Período aproximado Ta y T ≤ Cu·Ta
- Tablas 12.8-1 / 12.8-2 — Cu, Ct, x
- Capítulo 20 — Clase de Sitio
- Capítulo 21 — Análisis específico de sitio

### Manual de Geotecnia REP-21
- §3 + Figura 3.1 — Capacidad portante sísmica
- §5.3.1.1 + Figura 5.3 — Mononobe-Okabe
- §5.3.1.2 + Figura 5.5a — Desplazamientos permisibles
- §5.3.2 — Muros rígidos restringidos
- §5.4 + Cuadro 14 (referencias 8, 25, 35) — Métodos kh
- §5.4 Cuadro 14 Nota 1 — Envolvente kv obligatorio
- §6.6 — Bishop, Spencer, Janbu

---

## 5. Casos de prueba pasados

✅ Caso gimnasio Paraíso: CDS=D correcto, detecta OMF prohibido, Ta=0.404, T=0.565, Cs=0.3857
✅ Caso gimnasio con SMF: válido, Cs=0.1688, advierte Fa/Fv extrapolados
✅ Geotecnia muro flexible: envolvente kv con 3 escenarios y gobernante identificado
✅ Geotecnia talud método D: kh=0.18, advertencia metodológica Bishop/Spencer
✅ Vivienda Clase E: detecta triggers no-típica (PGA y Clase E)
✅ Método kh B: requiere SDS, lo calcula desde Ss/S1 override
✅ Período manual > Cu·Ta: limita y advierte §12.8.2

---

## 6. Notas de migración

- Backward compatible con `data/v1.0/` (rasters de mapas sin cambios).
- Inputs nuevos del DOM no requieren cambios al raster.js ni al backend.
- Resultados v2 mantienen `kh`, `kv`, `psi_rad`, `psi_deg`, `R`, `omega`, `Cd`, `Cs` legacy para no romper PDF antiguo.

---

**LMM Ingeniería — 2026-05-19**
