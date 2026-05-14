import { useState, useMemo, useRef, useCallback } from "react";

const TIRANTE = 0.81;
const DIAMETERS = [18, 20, 24, 30, 36];
const MATERIALS = { PVC: 0.009, Concreto: 0.013 };
const COLORS = ["#8b3a3a","#b87333","#2e6b4f","#2c5f8a","#5b4a8a"];
const FILLS_A = ["rgba(139,58,58,0.12)","rgba(184,115,51,0.12)","rgba(46,107,79,0.12)","rgba(44,95,138,0.12)","rgba(91,74,138,0.12)"];
const BRAND = "#1a3c5e";
const GOLD = "#c8963e";
const MID = "#4a4a4a";
const LIGHT = "#7a7a7a";
const BG = "#fefcf9";
const GRID_C = "#d0ccc4";

const VEL_LINES = [0.6, 1.0, 2.0, 3.0, 4.0, 5.0];
const VEL_LABELS = ["0.6 (min)","1.0","2.0","3.0 (max rec.)","4.0","5.0 (limite)"];
const VEL_COLORS = ["#8b6914","#8b6914","#6b6b6b","#8b3a3a","#8b3a3a","#5a1a1a"];
const VEL_DASH = ["8,5","5,4","5,4","10,4,3,4","5,4","3,3"];
const VEL_W = [1.3, 0.8, 0.8, 1.6, 0.8, 1.8];

function mp(dIn, sPct, n) {
  const dM = dIn * 0.0254;
  const s = sPct / 100;
  const th = 2 * Math.acos(1 - 2 * TIRANTE);
  const A = (dM * dM / 8) * (th - Math.sin(th));
  const P = dM * th / 2;
  const Rh = A / P;
  const v = (1 / n) * Math.pow(Rh, 2/3) * Math.pow(s, 0.5);
  return { q: v * A, v };
}

function slopeForV(dIn, vT, n) {
  const dM = dIn * 0.0254;
  const th = 2 * Math.acos(1 - 2 * TIRANTE);
  const P = dM * th / 2;
  const A = (dM * dM / 8) * (th - Math.sin(th));
  const Rh = A / P;
  return Math.pow(vT * n / Math.pow(Rh, 2/3), 2) * 100;
}

function vStat(v) {
  if (v < 0.6) return { t: "Baja", c: "#8b6914" };
  if (v <= 3.0) return { t: "OK", c: "#2e6b4f" };
  if (v <= 5.0) return { t: "Alta", c: "#8b3a3a" };
  return { t: "Excesiva", c: "#5a1a1a" };
}

function fq(q) {
  if (q >= 1) return q.toFixed(2);
  if (q >= 0.1) return q.toFixed(3);
  return q.toFixed(4);
}

const CW = 900, CH = 560;
const PT = 50, PR = 70, PB = 55, PL = 70;
const CPW = CW - PL - PR;
const CPH = CH - PT - PB;

export default function NomogramaInteractivo() {
  const [material, setMaterial] = useState("PVC");
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const n = MATERIALS[material];

  const maxSlope = useMemo(() => {
    let ms = Math.min(slopeForV(DIAMETERS[0], 5.0, n) * 1.05, 5.9);
    ms = Math.ceil(ms * 2) / 2;
    return ms > 5.5 ? 5.5 : ms;
  }, [n]);

  const xMin = 0.05;

  const yRange = useMemo(() => {
    const qs = DIAMETERS.flatMap(d => [mp(d, xMin, n).q, mp(d, maxSlope, n).q]);
    return { min: Math.min(...qs) * 0.55, max: Math.max(...qs) * 1.5 };
  }, [n, maxSlope]);

  const sx = useCallback(v => PL + ((v - xMin) / (maxSlope - xMin)) * CPW, [maxSlope]);
  const sy = useCallback(v => {
    const a = Math.log(yRange.min);
    const b = Math.log(yRange.max);
    return PT + CPH - ((Math.log(v) - a) / (b - a)) * CPH;
  }, [yRange]);
  const invX = useCallback(px => xMin + ((px - PL) / CPW) * (maxSlope - xMin), [maxSlope]);
  const invY = useCallback(py => {
    const a = Math.log(yRange.min);
    const b = Math.log(yRange.max);
    return Math.exp(a + ((PT + CPH - py) / CPH) * (b - a));
  }, [yRange]);

  const STEPS = 200;
  const slopes = useMemo(() =>
    Array.from({ length: STEPS }, (_, i) => xMin + (i / (STEPS - 1)) * (maxSlope - xMin)), [maxSlope]);

  const curves = useMemo(() =>
    DIAMETERS.map(d => ({
      d,
      pts: slopes.map(s => { const r = mp(d, s, n); return { s, q: r.q, x: sx(s), y: sy(r.q) }; })
    })), [slopes, n, sx, sy]);

  const fillPaths = useMemo(() => {
    const arr = [];
    for (let i = 0; i < curves.length - 1; i++) {
      const lo = curves[i].pts;
      const hi = curves[i + 1].pts;
      let p = lo.map((pt, j) => (j === 0 ? "M" : "L") + pt.x.toFixed(1) + "," + pt.y.toFixed(1)).join(" ");
      const rev = [...hi].reverse();
      p += " " + rev.map((pt) => "L" + pt.x.toFixed(1) + "," + pt.y.toFixed(1)).join(" ") + "Z";
      arr.push({ path: p, fill: FILLS_A[i + 1] });
    }
    return arr;
  }, [curves]);

  const thC = 2 * Math.acos(1 - 2 * TIRANTE);
  const rhF = (thC - Math.sin(thC)) / (4 * thC);
  const aF = (thC - Math.sin(thC)) / 8;
  const dMinM = DIAMETERS[0] * 0.0254;
  const dMaxM = DIAMETERS[DIAMETERS.length - 1] * 0.0254;

  const velCurves = useMemo(() =>
    VEL_LINES.map((vT, vi) => {
      const pts = [];
      for (const s of slopes) {
        const sDec = s / 100;
        if (sDec <= 0) continue;
        const Dn = Math.pow(vT * n / (Math.pow(rhF, 2/3) * Math.pow(sDec, 0.5)), 1.5);
        if (Dn >= dMinM * 0.8 && Dn <= dMaxM * 1.2) {
          const q = vT * Dn * Dn * aF;
          if (q >= yRange.min && q <= yRange.max) pts.push({ x: sx(s), y: sy(q) });
        }
      }
      return { pts, color: VEL_COLORS[vi], dash: VEL_DASH[vi], label: VEL_LABELS[vi], lw: VEL_W[vi] };
    }), [slopes, n, sx, sy, yRange]);

  const step = maxSlope <= 4 ? 0.5 : 1.0;
  const xTicks = useMemo(() => {
    const t = [];
    for (let v = step; v <= maxSlope; v += step) t.push(Math.round(v * 10) / 10);
    return t;
  }, [maxSlope, step]);

  const yTicks = useMemo(() =>
    [0.05,0.08,0.10,0.15,0.20,0.30,0.50,0.70,1.0,1.5,2.0,3.0,5.0].filter(v => v >= yRange.min && v <= yRange.max),
    [yRange]);

  const onMove = useCallback(e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CW / rect.width);
    const my = (e.clientY - rect.top) * (CH / rect.height);
    if (mx < PL || mx > CW - PR || my < PT || my > CH - PB) { setHover(null); return; }
    const sVal = invX(mx);
    const qC = invY(my);
    let best = null, bd = Infinity;
    for (const d of DIAMETERS) {
      const r = mp(d, sVal, n);
      const dist = Math.abs(Math.log(r.q) - Math.log(qC));
      if (dist < bd) { bd = dist; best = { d, s: sVal, q: r.q, v: r.v, px: mx, py: my }; }
    }
    setHover(best);
  }, [invX, invY, n]);

  const li = Math.floor(STEPS * 0.72);

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: "16px 12px", fontFamily: "'Libre Baskerville','Georgia','Times New Roman',serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 400, color: BRAND, margin: 0, letterSpacing: 5, textTransform: "uppercase", textAlign: "center" }}>
        Nomograma de Tuber{"\u00ed"}as
      </h1>
      <div style={{ width: 180, height: 2, background: GOLD, margin: "6px auto", opacity: 0.5 }} />
      <p style={{ textAlign: "center", fontSize: 11, color: LIGHT, margin: "0 0 12px", letterSpacing: 1 }}>
        {"Manning \u2022 Tirante d/D = " + TIRANTE + " \u2022 \u00d818\u2033\u201336\u2033"}
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
        {Object.entries(MATERIALS).map(([m, nv]) => (
          <button key={m} onClick={() => setMaterial(m)} style={{
            padding: "7px 22px", border: "1.5px solid " + (material === m ? GOLD : GRID_C),
            borderRadius: 4, background: material === m ? BRAND : "white",
            color: material === m ? "#fff" : MID, fontSize: 13, cursor: "pointer",
            fontFamily: "inherit", fontWeight: material === m ? 600 : 400, transition: "all 0.2s",
          }}>
            {m + " (n=" + nv + ")"}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", position: "relative" }}>
        <svg ref={svgRef} viewBox={"0 0 " + CW + " " + CH}
          style={{ width: "100%", background: BG, borderRadius: 6, border: "1px solid " + GRID_C, cursor: "crosshair", display: "block" }}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.08)" /></filter>
          </defs>

          {yTicks.map(v => <g key={"y" + v}>
            <line x1={PL} x2={CW - PR} y1={sy(v)} y2={sy(v)} stroke={GRID_C} strokeWidth={0.5} />
            <text x={PL - 6} y={sy(v)} textAnchor="end" dominantBaseline="middle" fill={MID} fontSize={10}>{fq(v)}</text>
            <text x={CW - PR + 6} y={sy(v)} textAnchor="start" dominantBaseline="middle" fill={LIGHT} fontSize={10}>{Math.round(v * 1000)}</text>
          </g>)}

          {xTicks.map(v => <g key={"x" + v}>
            <line x1={sx(v)} x2={sx(v)} y1={PT} y2={CH - PB} stroke={GRID_C} strokeWidth={0.5} />
            <text x={sx(v)} y={CH - PB + 16} textAnchor="middle" fill={MID} fontSize={10}>{v + "%"}</text>
          </g>)}

          <text x={CW / 2} y={CH - 4} textAnchor="middle" fill={BRAND} fontSize={12}>Pendiente (%) = (cm/m)</text>
          <text x={14} y={CH / 2} textAnchor="middle" fill={BRAND} fontSize={11}
            transform={"rotate(-90,14," + CH / 2 + ")"}>{"Caudal a tirante 81% (m\u00b3/s)"}</text>
          <text x={CW - 8} y={CH / 2} textAnchor="middle" fill={LIGHT} fontSize={10}
            transform={"rotate(90," + (CW - 8) + "," + CH / 2 + ")"}>Caudal (L/s)</text>

          {fillPaths.map((f, i) => <path key={"f" + i} d={f.path} fill={f.fill} />)}

          {velCurves.map((vc, i) => vc.pts.length > 1 ? <g key={"v" + i}>
            <path d={vc.pts.map((p, j) => (j === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ")}
              fill="none" stroke={vc.color} strokeWidth={vc.lw} strokeDasharray={vc.dash} opacity={0.5} />
            <text x={vc.pts[vc.pts.length - 1].x + 3} y={vc.pts[vc.pts.length - 1].y - 3}
              fill={vc.color} fontSize={7} opacity={0.7}>{"V=" + vc.label}</text>
          </g> : null)}

          {curves.map((c, ci) => {
            const lp = c.pts[li];
            return <g key={"c" + ci}>
              <path d={c.pts.map((p, j) => (j === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ")}
                fill="none" stroke={COLORS[ci]} strokeWidth={2.5} strokeLinecap="round" />
              <rect x={lp.x - 40} y={lp.y - 10} width={80} height={20} rx={4} fill={COLORS[ci]} opacity={0.9} />
              <text x={lp.x} y={lp.y + 4} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">
                {c.d + '" (' + Math.round(c.d * 25.4) + " mm)"}
              </text>
            </g>;
          })}

          {hover && (() => {
            const snapY = sy(hover.q);
            const snapX = sx(hover.s);
            const vs = vStat(hover.v);
            const ttx = hover.px > CW / 2 ? hover.px - 185 : hover.px + 16;
            const tty = Math.max(PT + 5, Math.min(snapY - 50, CH - PB - 95));
            return <g>
              <line x1={hover.px} x2={hover.px} y1={PT} y2={CH - PB} stroke={BRAND} strokeWidth={0.7} strokeDasharray="4,3" opacity={0.35} />
              <line x1={PL} x2={CW - PR} y1={snapY} y2={snapY} stroke={BRAND} strokeWidth={0.7} strokeDasharray="4,3" opacity={0.35} />
              <circle cx={snapX} cy={snapY} r={6} fill={GOLD} stroke={BRAND} strokeWidth={1.5} />
              <rect x={ttx} y={tty} width={172} height={88} rx={5} fill={BG} stroke={GOLD} strokeWidth={1.2} filter="url(#sh)" />
              <text x={ttx + 12} y={tty + 17} fill={BRAND} fontSize={11} fontWeight="bold">
                {"\u00d8" + hover.d + '" (' + Math.round(hover.d * 25.4) + " mm)"}
              </text>
              <text x={ttx + 12} y={tty + 33} fill={MID} fontSize={10}>{"Pendiente: " + hover.s.toFixed(2) + "%"}</text>
              <text x={ttx + 12} y={tty + 49} fill={MID} fontSize={10}>{"Q = " + fq(hover.q) + " m\u00b3/s (" + Math.round(hover.q * 1000) + " L/s)"}</text>
              <text x={ttx + 12} y={tty + 65} fill={MID} fontSize={10}>{"V = " + hover.v.toFixed(2) + " m/s"}</text>
              <text x={ttx + 12} y={tty + 80} fill={vs.c} fontSize={10} fontWeight="bold">{"Estado: " + vs.t}</text>
            </g>;
          })()}

          <rect x={PL} y={PT} width={CPW} height={CPH} fill="none" stroke={GRID_C} strokeWidth={0.8} />

          {!hover && <g>
            <rect x={PL + 8} y={PT + 8} width={195} height={36} rx={4} fill={BG} stroke={GRID_C} strokeWidth={0.5} opacity={0.9} />
            <text x={PL + 16} y={PT + 24} fill={LIGHT} fontSize={9}>Pasa el cursor sobre la grafica</text>
            <text x={PL + 16} y={PT + 38} fill={LIGHT} fontSize={9}>para ver datos en tiempo real</text>
          </g>}
        </svg>
      </div>

      <div style={{ maxWidth: 960, margin: "10px auto 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid " + GRID_C, paddingTop: 6 }}>
        <div style={{ fontSize: 9, color: LIGHT }}>
          {"Manning (d/D=" + TIRANTE + ") \u2022 V=(1/n)\u00b7Rh\u00b2\u02bc\u00b3\u00b7S\u00b9\u02bc\u00b2 \u2022 Q=V\u00b7A"}
        </div>
        <div style={{ fontSize: 10, color: BRAND, opacity: 0.6, whiteSpace: "nowrap" }}>
          {"Ing. Luis M\u00e1rquez | LMM Ingenier\u00eda"}
        </div>
      </div>
    </div>
  );
}
