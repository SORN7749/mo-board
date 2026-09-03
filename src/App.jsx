import React, { useEffect, useState, useRef } from "react";
import boardImg from "./assets/maneuvering-board.jpg";

/* ============================================================
   CONSTANTS & MATH — calibrated to the real board photo
   ============================================================ */
const VB_W = 1650;
const VB_H = 1275;
const CENTER = { x: 850.9, y: 550.7 };
const MAX_R_PX = 478;
const RING_COUNT = 10;
const PX_PER_RING = MAX_R_PX / RING_COUNT;
const YARDS_PER_NM = 2025.3718;

const PAPER = "#07111B";
const INK = "#72DDE8";
const INK_SOFT = "#7695A2";
const CRIMSON = "#FF5C6C";
const CRIMSON_DEEP = "#5C1F28";
const ER_BLUE = "#155EEF";
const ER_BLUE_DEEP = "#0B3FAF";
const RM_BLUE = ER_BLUE;
const EM_RED = "#C61F3D";
const PERP_BLUE = "#164E7A";
const AMBER_DEEP = "#1B6E7D";
const AMBER = "#4FD8E8";
const BG = "#020A13";
const PANEL = "rgba(7,18,29,0.92)";
const PANEL_LINE = "rgba(111,176,193,0.30)";
const PANEL_LINE_BRIGHT = "rgba(79,216,232,0.72)";
const TEXT_MUTE = "#76939F";
const TEXT_LIGHT = "#E7F6FA";
const TEXT_LIGHT_MUTE = "#84A6B2";
const CARD = "#FCFBF6";

const FONT_HEAD = "'Chakra Petch', 'IBM Plex Sans Thai', sans-serif";
const FONT_BODY = "'IBM Plex Sans Thai', sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'IBM Plex Sans Thai', monospace";

// signature: chamfered (angle-cut) corners for interactive controls —
// distinguishes actionable elements from soft-cornered content cards
const CHAMFER = "none";
const CHAMFER_SM = "none";

function useSessionState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.sessionStorage.getItem(`mo-board:${key}`);
      return saved === null ? initialValue : JSON.parse(saved);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(`mo-board:${key}`, JSON.stringify(value));
    } catch {
      // The calculator remains fully usable when private browsing blocks storage.
    }
  }, [key, value]);

  return [value, setValue];
}

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const mod360 = (d) => ((d % 360) + 360) % 360;
const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const fmtBrg = (n) => (Number.isFinite(n) ? String(Math.round(mod360(n))).padStart(3, "0") + "°" : "—°");
function minutesToHHMM(totalMin) {
  if (!Number.isFinite(totalMin)) return "—";
  const m = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  return String(h).padStart(2, "0") + String(mm).padStart(2, "0");
}
function hhmmToMinutes(hhmm) {
  const raw = String(hhmm).trim();
  if (!/^\d{3,4}$/.test(raw)) return NaN;
  const s = raw.padStart(4, "0");
  const h = parseInt(s.slice(0, 2), 10);
  const m = parseInt(s.slice(2, 4), 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return NaN;
  return h * 60 + m;
}
function valueToPx(realValue, scale) { return (realValue / scale) * PX_PER_RING; }
function polarValueToScreen(bearingDeg, realValue, scale) {
  const radiusPx = valueToPx(realValue, scale);
  const rad = toRad(bearingDeg);
  return { sx: CENTER.x + radiusPx * Math.sin(rad), sy: CENTER.y - radiusPx * Math.cos(rad) };
}
const polarToXY = (brg, v) => ({ x: v * Math.sin(toRad(brg)), y: v * Math.cos(toRad(brg)) });
const xyToPolar = (x, y) => ({ bearing: mod360(toDeg(Math.atan2(x, y))), range: Math.hypot(x, y) });
function xyToScreenSpeedScaled(x, y, scale) {
  const { bearing, range } = xyToPolar(x, y);
  return polarValueToScreen(bearing, range, scale);
}
function xyToScreenDistanceScaled(xNm, yNm, scale) {
  const { bearing, range: rangeNm } = xyToPolar(xNm, yNm);
  const rangeThousandYd = (rangeNm * YARDS_PER_NM) / 1000;
  return polarValueToScreen(bearing, rangeThousandYd, scale);
}
function idealScaleForRangeYards(maxYards, minScale = 1) {
  const thousandYd = maxYards / 1000;
  for (const s of [1, 2, 3, 4, 5]) if (s >= minScale && thousandYd / s <= RING_COUNT) return s;
  return 5;
}
function idealScaleForSpeed(maxKt, minScale = 1) {
  for (const s of [1, 2, 3, 4, 5]) if (s >= minScale && maxKt / s <= RING_COUNT) return s;
  return 5;
}
const exceedsBoard = (maxValue, scale) => maxValue > RING_COUNT * scale + 1e-9;
const rangeToYards = (value, unit) => Number(value) * (unit === "nm" ? YARDS_PER_NM : 1);
const yardsToRange = (yards, unit) => unit === "nm" ? +(yards / YARDS_PER_NM).toFixed(2) : Math.round(yards);
function vAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function vSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function vLen(a) { return Math.hypot(a.x, a.y); }
function vBrg(a) { return mod360(toDeg(Math.atan2(a.x, a.y))); }
function relativeFromBearing(side, angle) {
  const a = Math.min(180, Math.max(0, Number(angle)));
  return side === "port" ? mod360(360 - a) : a;
}
function bearingToRelativeSide(bearing) {
  const b = mod360(bearing);
  return b > 180 ? { side: "port", angle: 360 - b } : { side: "starboard", angle: b };
}
function fmtRelative(side, angle) {
  const sideText = side === "port" ? "กราบซ้าย" : "กราบขวา";
  return `${String(Math.round(angle)).padStart(3, "0")}° จากหัวเรือ${sideText}`;
}

const IMG_DATA = boardImg;

/* ============================================================
   BOARD — real photo background, vectors overlaid & calibrated
   ============================================================ */
function BoardChrome({ children }) {
  // A little more of the original sheet stays visible so the full
  // MANEUVERING BOARD heading and the outer plotting border are retained.
  const boardViewSize = (MAX_R_PX + 60) * 2;
  const boardViewX = CENTER.x - boardViewSize / 2;
  const boardViewY = CENTER.y - boardViewSize / 2;
  return (
    <svg viewBox={`${boardViewX} ${boardViewY} ${boardViewSize} ${boardViewSize}`} className="w-full select-none" style={{ display: "block", aspectRatio: "1 / 1", background: "#020A13" }}>
      <defs>
        <clipPath id="boardClip"><circle cx={CENTER.x} cy={CENTER.y} r={MAX_R_PX} /></clipPath>
        <filter id="boardNightFilter" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="-0.03 -0.08 -0.01 0 0.12
                    -0.17 -0.56 -0.06 0 0.79
                    -0.19 -0.63 -0.06 0 0.88
                     0     0     0    1 0"
          />
        </filter>
        <marker id="arrowAmber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={AMBER_DEEP} /></marker>
        <marker id="arrowCrimson" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={CRIMSON} /></marker>
        <marker id="arrowInk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={INK} /></marker>
        <marker id="arrowEr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={ER_BLUE} /></marker>
        <marker id="arrowRm" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={RM_BLUE} /></marker>
        <marker id="arrowEm" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={EM_RED} /></marker>
      </defs>
      <rect x={boardViewX} y={boardViewY} width={boardViewSize} height={boardViewSize} fill="#01070D" />
      <image href={IMG_DATA} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" filter="url(#boardNightFilter)" opacity="0.92" />
      <circle cx={CENTER.x} cy={CENTER.y} r={MAX_R_PX} fill="none" stroke={AMBER} strokeWidth="1.2" opacity="0.8" />
      <g clipPath="url(#boardClip)">{children}</g>
    </svg>
  );
}

/* ============================================================
   Shared: zoom/pinch modal hook + component
   ============================================================ */
function useZoomPan() {
  const [zoomed, setZoomed] = useState(false);
  const [zScale, setZScale] = useState(1);
  const [zX, setZX] = useState(0);
  const [zY, setZY] = useState(0);
  const pinch = useRef({ dist: 0, startScale: 1 });
  const pan = useRef({ x: 0, y: 0, active: false });

  function dist(touches) {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function onTouchStart(e) {
    if (e.touches.length === 2) pinch.current = { dist: dist(e.touches), startScale: zScale };
    else if (e.touches.length === 1) pan.current = { x: e.touches[0].clientX - zX, y: e.touches[0].clientY - zY, active: true };
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const newDist = dist(e.touches);
      setZScale(Math.min(Math.max((pinch.current.startScale * newDist) / pinch.current.dist, 1), 6));
    } else if (e.touches.length === 1 && pan.current.active) {
      setZX(e.touches[0].clientX - pan.current.x);
      setZY(e.touches[0].clientY - pan.current.y);
    }
  }
  function onTouchEnd(e) { if (e.touches.length === 0) pan.current.active = false; }
  function onWheel(e) { e.preventDefault(); setZScale((s) => Math.min(Math.max(s - e.deltaY * 0.0015, 1), 6)); }
  function open() { setZScale(1); setZX(0); setZY(0); setZoomed(true); }
  function close() { setZoomed(false); }

  return { zoomed, zScale, zX, zY, open, close, onTouchStart, onTouchMove, onTouchEnd, onWheel };
}
function ZoomModal({ z, children, stepControls }) {
  if (!z.zoomed) return null;
  return (
    <div style={{ background: "#000" }} className="fixed inset-0 z-50 flex flex-col">
      <div className="flex items-center px-4 py-3 pr-16" style={{ background: BG, borderBottom: `1px solid ${PANEL_LINE}` }}>
        <span style={{ color: AMBER, fontFamily: FONT_MONO, textShadow: `0 0 8px rgba(79,216,232,0.5)` }} className="text-[10px] uppercase tracking-wide">⇕ Pinch / drag to pan &amp; zoom</span>
        <button onClick={z.close}
          aria-label="ปิดการซูม"
          style={{ position: "fixed", top: "max(12px, env(safe-area-inset-top))", right: "max(12px, env(safe-area-inset-right))", background: BG, color: CRIMSON, border: `1px solid ${CRIMSON}`, clipPath: CHAMFER_SM, fontFamily: FONT_MONO, boxShadow: `0 0 10px -2px rgba(255,92,108,0.6)`, zIndex: 70 }}
          className="w-10 h-10 font-bold flex items-center justify-center">✕</button>
      </div>
      <div className="flex-1 overflow-hidden touch-none" onTouchStart={z.onTouchStart} onTouchMove={z.onTouchMove} onTouchEnd={z.onTouchEnd} onWheel={z.onWheel} style={{ background: "#000" }}>
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "94%", transform: `translate(${z.zX}px, ${z.zY}px) scale(${z.zScale})`, transformOrigin: "center center" }}>
            {children}
          </div>
        </div>
      </div>
      {stepControls && <div style={{ position: "fixed", left: "50%", bottom: "max(16px, env(safe-area-inset-bottom))", transform: "translateX(-50%)", zIndex: 70 }}>{stepControls}</div>}
    </div>
  );
}

/* ============================================================
   TAB 1: Target Course / Speed + CPA / TCPA
   ============================================================ */
function TargetSpeedTab() {
  const [scale, setScale] = useSessionState("tma.scale", 2);
  const [rangeUnit, setRangeUnit] = useSessionState("tma.rangeUnit", "yd");
  const [m1, setM1] = useSessionState("tma.m1", { time: "", bearing: "", range: "" });
  const [m2, setM2] = useSessionState("tma.m2", { time: "", bearing: "", range: "" });
  const [own, setOwn] = useSessionState("tma.own", { course: "", speed: "" });
  const [result, setResult] = useSessionState("tma.result", null);
  const [error, setError] = useState("");
  const z = useZoomPan();

  const updatePoint = (setter) => (field) => (e) => setter((p) => ({ ...p, [field]: e.target.value }));
  const updateOwn = (field) => (e) => setOwn((p) => ({ ...p, [field]: e.target.value }));

  function solve() {
    setError("");
    const t1 = hhmmToMinutes(m1.time), t2 = hhmmToMinutes(m2.time);
    const b1 = parseFloat(m1.bearing), r1yd = rangeToYards(m1.range, rangeUnit);
    const b2 = parseFloat(m2.bearing), r2yd = rangeToYards(m2.range, rangeUnit);
    const Co = parseFloat(own.course), So = parseFloat(own.speed);
    if ([t1, t2, b1, r1yd, b2, r2yd, Co, So].some((v) => Number.isNaN(v))) { setError("กรอกข้อมูลให้ครบทุกช่อง (ตรวจรูปแบบเวลา HHMM ด้วย)"); setResult(null); return; }
    const dt = t2 - t1;
    if (dt <= 0) { setError("เวลา M2 ต้องอยู่หลัง M1"); setResult(null); return; }

    const P1 = polarToXY(b1, r1yd / YARDS_PER_NM);
    const P2 = polarToXY(b2, r2yd / YARDS_PER_NM);
    const Vrel = { x: ((P2.x - P1.x) / dt) * 60, y: ((P2.y - P1.y) / dt) * 60 };
    const DRM = vBrg(Vrel), SRM = vLen(Vrel);
    const denom = Vrel.x * Vrel.x + Vrel.y * Vrel.y;
    const tCpaHours = denom > 0 ? -(P2.x * Vrel.x + P2.y * Vrel.y) / denom : NaN;
    const cpaPoint = { x: P2.x + Vrel.x * tCpaHours, y: P2.y + Vrel.y * tCpaHours };
    const cpaRange = vLen(cpaPoint), cpaBearing = vBrg(cpaPoint);
    const tcpaDeltaMin = tCpaHours * 60; // นาทีนับจาก M2 ไปถึงจุด CPA (M3)
    const tcpaClockMin = t2 + tcpaDeltaMin; // เวลานาฬิกา (นาทีนับเที่ยงคืน) ที่จุด CPA
    const er = polarToXY(Co, So);
    const em = vAdd(er, Vrel);
    const maxPlot = Math.max(r1yd / 1000, r2yd / 1000, So, SRM, vLen(em));
    if (exceedsBoard(maxPlot, scale)) { setError(`ข้อมูลเกินขอบกระดานที่สเกล ${scale}:1 กรุณาเลือกสเกลที่สูงขึ้น`); setResult(null); return; }
    setResult({ P1, P2, er, em, DRM, SRM, cpaPoint, cpaRange, cpaBearing, tcpaDeltaMin, tcpaClockMin, targetCourse: vBrg(em), targetSpeed: vLen(em) });
  }
  function generateProblem() {
    const rc = () => Math.round(Math.random() * 359), rs = (a, b) => +(a + Math.random() * (b - a)).toFixed(1);
    let ownCourse, ownSpeed, tgtCourse, tgtSpeed, t1min, dt, t2min, b1, r1nm, P1, P2, b2, r2nm;
    do {
      ownCourse = rc(); ownSpeed = rs(10, 20); tgtCourse = rc(); tgtSpeed = rs(8, 22);
      t1min = 600 + Math.floor(Math.random() * 300); dt = 5 + Math.floor(Math.random() * 10); t2min = t1min + dt;
      b1 = rc(); r1nm = rs(1, 9.5); P1 = polarToXY(b1, r1nm);
      const VrelSim = vSub(polarToXY(tgtCourse, tgtSpeed), polarToXY(ownCourse, ownSpeed));
      P2 = { x: P1.x + (VrelSim.x * dt) / 60, y: P1.y + (VrelSim.y * dt) / 60 };
      b2 = vBrg(P2); r2nm = vLen(P2);
    } while (Math.max(r1nm, r2nm) * YARDS_PER_NM > 20000);
    const toHHMM = (min) => String(Math.floor(min / 60) % 24).padStart(2, "0") + String(min % 60).padStart(2, "0");
    const maxRangeYd = Math.max(r1nm, r2nm) * YARDS_PER_NM;
    const nextUnit = maxRangeYd > 2 * YARDS_PER_NM ? "nm" : "yd";
    setRangeUnit(nextUnit);
    setM1({ time: toHHMM(t1min), bearing: String(Math.round(b1)).padStart(3, "0"), range: String(yardsToRange(r1nm * YARDS_PER_NM, nextUnit)) });
    setM2({ time: toHHMM(t2min), bearing: String(Math.round(b2)).padStart(3, "0"), range: String(yardsToRange(r2nm * YARDS_PER_NM, nextUnit)) });
    setOwn({ course: String(ownCourse).padStart(3, "0"), speed: String(ownSpeed) });
    setScale(idealScaleForRangeYards(maxRangeYd, 1));
    setResult(null); setError("");
  }
  function clearAll() {
    setM1({ time: "", bearing: "", range: "" }); setM2({ time: "", bearing: "", range: "" });
    setOwn({ course: "", speed: "" }); setResult(null); setError("");
  }
  function changeRangeUnit(nextUnit) {
    if (nextUnit === rangeUnit) return;
    const convert = (point) => ({ ...point, range: point.range === "" ? "" : String(yardsToRange(rangeToYards(point.range, rangeUnit), nextUnit)) });
    setM1(convert); setM2(convert); setRangeUnit(nextUnit);
  }

  const rmlSeg = result ? (() => {
    const dir = vSub(result.P2, result.P1);
    const len = vLen(dir) || 1;
    const u = { x: dir.x / len, y: dir.y / len };
    const far = 500;
    return { a: { x: result.P2.x - u.x * far, y: result.P2.y - u.y * far }, b: { x: result.P2.x + u.x * far, y: result.P2.y + u.y * far } };
  })() : null;
  const sc = (xy) => xyToScreenSpeedScaled(xy.x, xy.y, scale);
  const scD = (xy) => xyToScreenDistanceScaled(xy.x, xy.y, scale);

  const boardVectors = result && (
    <g>
      {rmlSeg && (() => { const a = scD(rmlSeg.a), b = scD(rmlSeg.b); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={CRIMSON} strokeWidth="1.2" strokeDasharray="7 6" opacity="0.75" />; })()}
      {(() => { const cp = scD(result.cpaPoint); return <line x1={CENTER.x} y1={CENTER.y} x2={cp.sx} y2={cp.sy} stroke={PERP_BLUE} strokeWidth="2.2" strokeDasharray="5 4" opacity="1" />; })()}
      {(() => { const cp = scD(result.cpaPoint); return <circle cx={cp.sx} cy={cp.sy} r="6" fill={CRIMSON} stroke={PAPER} strokeWidth="1.5" />; })()}
      {(() => { const cp = scD(result.cpaPoint); return <text x={cp.sx} y={cp.sy - 14} fontSize="18" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M3</text>; })()}
      {(() => { const p = scD(result.P1); return <circle cx={p.sx} cy={p.sy} r="7" fill={CRIMSON} stroke={PAPER} strokeWidth="1.5" />; })()}
      {(() => { const p = scD(result.P1); return <text x={p.sx} y={p.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M1</text>; })()}
      {(() => { const p = scD(result.P2); return <circle cx={p.sx} cy={p.sy} r="7" fill={CRIMSON} stroke={PAPER} strokeWidth="1.5" />; })()}
      {(() => { const p = scD(result.P2); return <text x={p.sx} y={p.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M2</text>; })()}
      {(() => { const a = sc(result.er), b = sc(result.em); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={RM_BLUE} strokeWidth="1.4" strokeDasharray="7 6" opacity="0.95" markerEnd="url(#arrowRm)" />; })()}
      {(() => { const a = sc(result.er); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={ER_BLUE} strokeWidth="2" markerEnd="url(#arrowEr)" />; })()}
      {(() => { const a = sc(result.er); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={ER_BLUE_DEEP} textAnchor="middle" fontWeight="700">er</text>; })()}
      {(() => { const a = sc(result.em); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={EM_RED} strokeWidth="2" markerEnd="url(#arrowEm)" />; })()}
      {(() => { const a = sc(result.em); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={EM_RED} textAnchor="middle" fontWeight="700">em</text>; })()}
    </g>
  );

  return (
    <TabShell>
      <BoardCard zOpen={z.open}><BoardChrome>{boardVectors}</BoardChrome></BoardCard>
      <ScaleRow scale={scale} setScale={setScale} scales={[1, 2, 3, 4, 5]} extra={`ระยะสูงสุด ${(RING_COUNT * scale * 1000).toLocaleString()} yds · ความเร็วสูงสุด ${RING_COUNT * scale} kt`} note="การสุ่มโจทย์จะเลือกสเกลเริ่มต้นที่เหมาะสมให้" showDistanceRemark />
      <ResultCard>
        {result ? (
          <>
            <BigAnswer>เรือเป้าถือเข็ม <Accent>{fmtBrg(result.targetCourse)}</Accent> ความเร็ว <Accent>{fmt(result.targetSpeed)} นอต</Accent></BigAnswer>
            <ResultGrid>
              <ResultItem label="DRM" value={fmtBrg(result.DRM)} />
              <ResultItem label="SRM" value={`${fmt(result.SRM)} kt`} />
              <ResultItem label="CPA Range" value={`${fmt(result.cpaRange)} nm`} accent />
              <ResultItem label="CPA Bearing" value={fmtBrg(result.cpaBearing)} accent />
              <ResultItem label="TCPA (เวลา)" value={`${minutesToHHMM(result.tcpaClockMin)} (+${fmt(result.tcpaDeltaMin, 0)} นาทีจาก M2)`} accent wide />
            </ResultGrid>
          </>
        ) : <EmptyNote />}
      </ResultCard>
      <InputCard>
        <SectionLabel>Target Observations</SectionLabel>
        <ModeRow options={[["yd", "ระยะเป็นหลา"], ["nm", "ระยะเป็น NM"]]} value={rangeUnit} onChange={changeRangeUnit} />
        <div style={rowGrid4} className="mb-1.5"><div /><MiniLabel>เวลาพบเป้า</MiniLabel><MiniLabel>แบริ่ง</MiniLabel><MiniLabel>ระยะ</MiniLabel></div>
        <PointRow label="M1" v1={m1.time} v2={m1.bearing} v3={m1.range} onC1={updatePoint(setM1)("time")} onC2={updatePoint(setM1)("bearing")} onC3={updatePoint(setM1)("range")} p1="HHMM" p2="°T" p3={rangeUnit === "nm" ? "NM" : "yds"} />
        <PointRow label="M2" v1={m2.time} v2={m2.bearing} v3={m2.range} onC1={updatePoint(setM2)("time")} onC2={updatePoint(setM2)("bearing")} onC3={updatePoint(setM2)("range")} p1="HHMM" p2="°T" p3={rangeUnit === "nm" ? "NM" : "yds"} />
        <SubDivider />
        <SectionLabel>Own Ship</SectionLabel>
        <div style={rowGrid3} className="mb-1.5"><div /><MiniLabel>เข็ม</MiniLabel><MiniLabel>ความเร็ว</MiniLabel></div>
        <div style={rowGrid3} className="items-center"><PointName>R</PointName><Field value={own.course} onChange={updateOwn("course")} placeholder="°T" /><Field value={own.speed} onChange={updateOwn("speed")} placeholder="kt" /></div>
        <ButtonRow onClear={clearAll} onRandom={generateProblem} onSolve={solve} />
        {error && <ErrorText>{error}</ErrorText>}
      </InputCard>
      <ZoomModal z={z}><BoardChrome>{boardVectors}</BoardChrome></ZoomModal>
    </TabShell>
  );
}

/* ============================================================
   TAB 2: Wind Problems (True Wind / Desired Relative Wind)
   ============================================================ */
function WindTab() {
  const [mode, setMode] = useSessionState("wind.mode", "true"); // 'true' | 'desired'
  const [plotMethod, setPlotMethod] = useSessionState("wind.plotMethod", "flexible");
  const [plotStep, setPlotStep] = useSessionState("wind.plotStep", "5");
  const [scale, setScale] = useSessionState("wind.scale", 3);
  const [own, setOwn] = useSessionState("wind.own", { course: "", speed: "" });
  const [rw, setRw] = useSessionState("wind.relative", { side: "starboard", angle: "", speed: "" }); // wind from, measured from bow on selected side
  const [tw, setTw] = useSessionState("wind.true", { from: "", speed: "" }); // true wind (known, for 'desired' mode)
  const [desired, setDesired] = useSessionState("wind.desired", { side: "starboard", angle: "", speed: "" });
  const [result, setResult] = useSessionState("wind.result", null);
  const [error, setError] = useState("");
  const z = useZoomPan();

  function solveTrueWind() {
    setError("");
    const Co = parseFloat(own.course), So = parseFloat(own.speed);
    const rwAngle = parseFloat(rw.angle), rwSpeed = parseFloat(rw.speed);
    if ([Co, So, rwAngle, rwSpeed].some((v) => Number.isNaN(v))) { setError("กรอกข้อมูลให้ครบทุกช่อง"); setResult(null); return; }
    if (rwAngle < 0 || rwAngle > 180 || rwSpeed <= 0 || So < 0) { setError("มุมลมสัมพันธ์ต้องอยู่ระหว่าง 000-180° และความเร็วต้องมากกว่า 0"); setResult(null); return; }
    const rwFrom = relativeFromBearing(rw.side, rwAngle);
    const er = polarToXY(Co, So);
    const awFromTrue = mod360(Co + rwFrom);
    const awTowardTrue = mod360(awFromTrue + 180);
    const awVec = polarToXY(awTowardTrue, rwSpeed);
    const ew = vAdd(er, awVec);
    const twFrom = mod360(vBrg(ew) + 180);
    const twSpeed = vLen(ew);
    if (exceedsBoard(Math.max(So, rwSpeed, twSpeed), scale)) { setError(`เวกเตอร์เกินขอบกระดานที่สเกล ${scale}:1 กรุณาเลือกสเกลที่สูงขึ้น`); setResult(null); return; }
    setResult({ mode: "true", er, ew, awTip: ew, twFrom, twSpeed });
  }

  function solveDesired() {
    setError("");
    const twFrom = parseFloat(tw.from), twSpeed = parseFloat(tw.speed);
    const dAngle = parseFloat(desired.angle), dSpeed = parseFloat(desired.speed);
    if ([twFrom, twSpeed, dAngle, dSpeed].some((v) => Number.isNaN(v))) { setError("กรอกข้อมูลให้ครบทุกช่อง"); setResult(null); return; }
    if (dAngle < 0 || dAngle > 180 || dSpeed <= 0 || twSpeed < 0) { setError("มุมลมสัมพันธ์ต้องอยู่ระหว่าง 000-180° และความเร็วต้องถูกต้อง"); setResult(null); return; }
    const signed = desired.side === "starboard" ? dAngle : -dAngle;
    const delta = mod360(180 + signed); // apparent-wind (toward) relative to ship's head
    const rad = toRad(delta);
    const cosD = Math.cos(rad), sinD = Math.sin(rad);
    const disc = twSpeed * twSpeed - dSpeed * dSpeed * sinD * sinD;
    if (disc < -1e-9) { setError("ไม่มีคำตอบ — ทิศและความเร็วลมสัมพันธ์ที่กำหนดไม่สามารถเกิดขึ้นกับลมจริงนี้ได้"); setResult(null); return; }
    const sq = Math.sqrt(Math.max(0, disc));
    const wDirToward = mod360(twFrom + 180);
    const speeds = [...new Set([-dSpeed * cosD + sq, -dSpeed * cosD - sq].map((s) => +s.toFixed(10)))]
      .filter((s) => s > 0.05)
      .sort((a, b) => b - a);
    if (speeds.length === 0) { setError("ไม่มีคำตอบที่เป็นไปได้ (ความเร็วเรือติดลบ)"); setResult(null); return; }
    const solutions = speeds.map((So, index) => {
      const phi = toDeg(Math.atan2(dSpeed * sinD, So + dSpeed * cosD));
      const Co = mod360(wDirToward - phi);
      const er = polarToXY(Co, So);
      const awVec = polarToXY(mod360(Co + delta), dSpeed);
      const ew = vAdd(er, awVec);
      const checkAwToward = vSub(ew, er);
      const checkAwFromTrue = mod360(vBrg(checkAwToward) + 180);
      const checkRel = bearingToRelativeSide(mod360(checkAwFromTrue - Co));
      return { id: index === 0 ? "r1" : "r2", Co, So, er, ew, awTip: ew, checkRel, checkRelSpeed: vLen(checkAwToward), label: index === 0 ? "เข็มตามลม (ความเร็วสูง)" : "เข็มทวนลม (ความเร็วต่ำ)" };
    });
    const primary = solutions[0];
    if (exceedsBoard(Math.max(twSpeed, dSpeed, ...solutions.map((s) => s.So)), scale)) { setError(`เวกเตอร์เกินขอบกระดานที่สเกล ${scale}:1 กรุณาเลือกสเกลที่สูงขึ้น`); setResult(null); return; }
    setPlotStep("5");
    setResult({ mode: "desired", solutions, ...primary, twFrom: mod360(twFrom), twSpeed, dAngle, dSpeed, signed, wDirToward });
  }

  function generateProblem() {
    const rc = () => Math.floor(Math.random() * 360);
    const rs = (a, b) => +(a + Math.random() * (b - a)).toFixed(1);
    const side = Math.random() < 0.5 ? "port" : "starboard";
    if (mode === "true") {
      setOwn({ course: String(rc()).padStart(3, "0"), speed: String(rs(10, 24)) });
      setRw({ side, angle: String(Math.floor(Math.random() * 121)), speed: String(rs(12, 35)) });
    } else {
      const twSpeed = rs(7, 14);
      const desiredSpeed = rs(twSpeed * 1.15, twSpeed * 1.8);
      setTw({ from: String(rc()).padStart(3, "0"), speed: String(twSpeed) });
      setDesired({ side, angle: "30", speed: String(desiredSpeed) });
      setScale(idealScaleForSpeed(twSpeed + desiredSpeed));
    }
    setResult(null); setError("");
  }

  function clearAll() {
    setOwn({ course: "", speed: "" }); setRw({ side: "starboard", angle: "", speed: "" });
    setTw({ from: "", speed: "" }); setDesired({ side: "starboard", angle: "", speed: "" });
    setResult(null); setError("");
  }

  const sc = (xy) => xyToScreenSpeedScaled(xy.x, xy.y, scale);
  const step = Number(plotStep);
  const pointMark = (xy, label, color, key) => { const p = sc(xy); return <g key={key}><circle cx={p.sx} cy={p.sy} r="6" fill={color} stroke={PAPER} strokeWidth="1.5"/><text x={p.sx + 9} y={p.sy - 9} fontSize="18" fontFamily={FONT_MONO} fill={color} fontWeight="700">{label}</text></g>; };
  const desiredPlot = result?.mode === "desired" && (() => {
    const e = { x: 0, y: 0 }, w = result.ew;
    if (plotMethod === "flexible") {
      const t = { x: w.x / 2, y: w.y / 2 };
      const sideTurn = result.signed > 0 ? 90 : -90;
      const h = result.twSpeed / (2 * Math.tan(toRad(result.dAngle)));
      const o = vAdd(t, polarToXY(mod360(result.wDirToward + sideTurn), h));
      const locusR = Math.abs(result.twSpeed / (2 * Math.sin(toRad(result.dAngle))));
      const n = polarToXY(mod360(result.wDirToward + sideTurn), result.twSpeed * 2);
      const na = sc(vSub(t, n)), nb = sc(vAdd(t, n)), op = sc(o), wp = sc(w);
      return <g>
        {step >= 1 && <line x1={CENTER.x} y1={CENTER.y} x2={wp.sx} y2={wp.sy} stroke={AMBER} strokeWidth="2" markerEnd="url(#arrowAmber)"/>}
        {step >= 1 && pointMark(w, "w", AMBER, "w")}{step >= 1 && pointMark(e, "e", AMBER, "e")}
        {step >= 2 && <line x1={na.sx} y1={na.sy} x2={nb.sx} y2={nb.sy} stroke={INK_SOFT} strokeWidth="1.2" strokeDasharray="6 6"/>}{step >= 2 && pointMark(t, "t", INK, "t")}
        {step >= 3 && <circle cx={op.sx} cy={op.sy} r={valueToPx(locusR, scale)} fill="none" stroke="#A879E8" strokeWidth="1.2" strokeDasharray="7 5"/>}{step >= 3 && pointMark(o, "o", "#A879E8", "o")}
        {step >= 4 && <circle cx={wp.sx} cy={wp.sy} r={valueToPx(result.dSpeed, scale)} fill="none" stroke="#A879E8" strokeWidth="1.2" strokeDasharray="7 5"/>}
        {step >= 4 && result.solutions.map(s => pointMark(s.er, s.id, s.id === "r1" ? ER_BLUE : CRIMSON, s.id))}
        {step >= 5 && result.solutions.map(s => { const p=sc(s.er); return <g key={`v-${s.id}`}><line x1={CENTER.x} y1={CENTER.y} x2={p.sx} y2={p.sy} stroke={ER_BLUE} strokeWidth="2" markerEnd="url(#arrowEr)"/><line x1={p.sx} y1={p.sy} x2={wp.sx} y2={wp.sy} stroke={CRIMSON} strokeWidth="1.4" strokeDasharray="7 5" markerEnd="url(#arrowCrimson)"/></g>; })}
      </g>;
    }
    const o = polarToXY(mod360(result.wDirToward - result.signed), result.dSpeed);
    const op = sc(o), guide = sc(polarToXY(result.wDirToward, scale * RING_COUNT));
    return <g>
      {step >= 1 && <line x1={CENTER.x} y1={CENTER.y} x2={guide.sx} y2={guide.sy} stroke={AMBER} strokeWidth="2" markerEnd="url(#arrowAmber)"/>}
      {step >= 1 && pointMark(result.ew, "w", AMBER, "w")}{step >= 1 && pointMark(e, "e", AMBER, "e")}
      {step >= 3 && <line x1={CENTER.x} y1={CENTER.y} x2={op.sx} y2={op.sy} stroke={CRIMSON} strokeWidth="1.4" strokeDasharray="7 5" markerEnd="url(#arrowCrimson)"/>}{step >= 3 && pointMark(o, "o", "#A879E8", "o")}
      {step >= 4 && <circle cx={op.sx} cy={op.sy} r={valueToPx(result.twSpeed, scale)} fill="none" stroke="#A879E8" strokeWidth="1.2" strokeDasharray="7 5"/>}
      {step >= 4 && result.solutions.map(s => pointMark(polarToXY(result.wDirToward, s.So), s.id, s.id === "r1" ? ER_BLUE : CRIMSON, s.id))}
      {step >= 5 && result.solutions.map(s => { const p=sc(polarToXY(result.wDirToward,s.So)); return <line key={`or-${s.id}`} x1={op.sx} y1={op.sy} x2={p.sx} y2={p.sy} stroke={ER_BLUE} strokeWidth="2" markerEnd="url(#arrowEr)"/>; })}
    </g>;
  })();
  const boardVectors = result && (
    <g>
      {result.mode === "true" && (() => { const a = sc(result.er), b = sc(result.awTip); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={INK} strokeWidth="1.4" strokeDasharray="3 5" opacity="0.9" markerEnd="url(#arrowInk)" />; })()}
      {result.mode === "true" && (() => { const a = sc(result.er); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={ER_BLUE} strokeWidth="2" markerEnd="url(#arrowEr)" />; })()}
      {result.mode === "true" && (() => { const a = sc(result.ew); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={CRIMSON} strokeWidth="2" markerEnd="url(#arrowCrimson)" />; })()}
      {desiredPlot}
    </g>
  );

  return (
    <TabShell>
      <ModeRow options={[["true", "หา True Wind"], ["desired", "เข็มรับ ฮ."]]} value={mode} onChange={(v) => { setMode(v); setResult(null); setError(""); }} />
      {mode === "desired" && <ModeRow options={[["flexible", "แบบอ่อนตัว"], ["rigid", "แบบแข็งตัว"]]} value={plotMethod} onChange={(v) => { setPlotMethod(v); setPlotStep("1"); }} />}
      <BoardCard zOpen={z.open}><BoardChrome>{boardVectors}</BoardChrome></BoardCard>
      {result?.mode === "desired" && <SolutionSteps method={plotMethod} step={step} setStep={(n) => setPlotStep(String(n))} result={result} scale={scale} />}
      <ScaleRow scale={scale} setScale={setScale} extra={`ความเร็วสูงสุด ${RING_COUNT * scale} kt`} note='ระบบเลือกสเกลให้อัตโนมัติหลังคำนวณ' />

      <ResultCard>
        {result && result.mode === "true" && (
          <BigAnswer>ลมจริงมาจาก <Accent>{fmtBrg(result.twFrom)}</Accent> ความเร็ว <Accent>{fmt(result.twSpeed)} นอต</Accent></BigAnswer>
        )}
        {result && result.mode === "desired" && (
          <>
            <div style={{ color: AMBER, fontFamily: FONT_HEAD, letterSpacing: "0.12em" }} className="text-[12px] text-center mb-2">◆ คำตอบเข็มรับ ฮ.</div>
            {result.solutions.map((solution, index) => (
              <div key={`${solution.Co}-${solution.So}`} style={{ borderTop: index ? `1px dashed ${PANEL_LINE_BRIGHT}` : "none", paddingTop: index ? "10px" : 0, marginTop: index ? "10px" : 0 }}>
                <div style={{ color: index ? CRIMSON : AMBER, fontFamily: FONT_BODY }} className="text-[13px] text-center">{solution.label}</div>
                <BigAnswer>เดินเข็ม <Accent>{fmtBrg(solution.Co)}</Accent> ความเร็ว <Accent>{fmt(solution.So)} นอต</Accent></BigAnswer>
                <div style={{ color: TEXT_LIGHT_MUTE, fontFamily: FONT_BODY }} className="text-[12px] text-center mt-1 leading-relaxed">
                  ตรวจคำตอบ: ลมสัมพันธ์ {fmtRelative(solution.checkRel.side, solution.checkRel.angle)} · {fmt(solution.checkRelSpeed)} kt
                </div>
              </div>
            ))}
          </>
        )}
        {!result && <EmptyNote />}
      </ResultCard>

      <InputCard>
        {mode === "true" ? (
          <>
            <SectionLabel>Own Ship</SectionLabel>
            <TwoField l1="เข็ม °T" l2="ความเร็ว kt" v1={own.course} v2={own.speed} onC1={(e) => setOwn((p) => ({ ...p, course: e.target.value }))} onC2={(e) => setOwn((p) => ({ ...p, speed: e.target.value }))} p1="°T" p2="kt" />
            <SubDivider />
            <SectionLabel>ลมที่วัดได้บนดาดฟ้า (ลมสัมพันธ์)</SectionLabel>
            <RelativeWindField value={rw} onChange={setRw} />
            <div style={{ color: TEXT_LIGHT_MUTE, fontFamily: FONT_BODY }} className="text-[12px] mt-1 leading-relaxed">นับจากหัวเรือไปทางท้ายเรือ: 000° = ตรงหัวเรือ · 090° = ข้างเรือ · 180° = ท้ายเรือ</div>
            <ButtonRow onClear={clearAll} onRandom={generateProblem} onSolve={solveTrueWind} solveLabel="หา True Wind" />
          </>
        ) : (
          <>
            <SectionLabel>ลมจริง (True Wind) ที่ทราบอยู่แล้ว</SectionLabel>
            <TwoField l1="ทิศลมพัดมาจาก (จริง)" l2="ความเร็ว" v1={tw.from} v2={tw.speed} onC1={(e) => setTw((p) => ({ ...p, from: e.target.value }))} onC2={(e) => setTw((p) => ({ ...p, speed: e.target.value }))} p1="°T" p2="kt" />
            <SubDivider />
            <SectionLabel>ทิศของลมที่ต้องการ</SectionLabel>
            <RelativeWindField value={desired} onChange={setDesired} speedLabel="ความเร็วที่ต้องการ" />
            <div style={{ color: TEXT_LIGHT_MUTE, fontFamily: FONT_BODY }} className="text-[12px] mt-1 leading-relaxed">เลือกกราบซ้ายหรือขวา แล้วกรอกมุม 000-180° ที่นับจากหัวเรือไปทางท้ายเรือ</div>
            <ButtonRow onClear={clearAll} onRandom={generateProblem} onSolve={solveDesired} solveLabel="หาเข็ม/ความเร็ว" />
          </>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </InputCard>
      <ZoomModal z={z} stepControls={result?.mode === "desired" ? <StepArrows step={step} setStep={(n) => setPlotStep(String(n))} /> : null}><BoardChrome>{boardVectors}</BoardChrome></ZoomModal>
    </TabShell>
  );
}

/* ============================================================
   TAB 3: Station Keeping (Changing Station)
   ============================================================ */
function StationTab() {
  const [mode, setMode] = useSessionState("station.mode", "byTime"); // 'byTime' | 'byCourse' | 'bySpeed' | 'minSpeed'
  const [centerMode, setCenterMode] = useSessionState("station.centerMode", "ownship"); // 'ownship' | 'guide'
  const [scale, setScale] = useSessionState("station.scale", 2);
  const [rangeUnit, setRangeUnit] = useSessionState("station.rangeUnit", "yd");
  const [guide, setGuide] = useSessionState("station.guide", { course: "", speed: "" });
  const [m1, setM1] = useSessionState("station.m1", { bearing: "", range: "" });
  const [m2, setM2] = useSessionState("station.m2", { bearing: "", range: "" });
  const [timeMinInput, setTimeMinInput] = useSessionState("station.time", "");
  const [courseInput, setCourseInput] = useSessionState("station.course", "");
  const [speedInput, setSpeedInput] = useSessionState("station.speed", "");
  const [result, setResult] = useSessionState("station.result", null);
  const [error, setError] = useState("");
  const z = useZoomPan();

  function baseParse() {
    const Cg = parseFloat(guide.course), Sg = parseFloat(guide.speed);
    const b1 = parseFloat(m1.bearing), r1yd = rangeToYards(m1.range, rangeUnit);
    const b2 = parseFloat(m2.bearing), r2yd = rangeToYards(m2.range, rangeUnit);
    return { Cg, Sg, b1, r1yd, b2, r2yd };
  }

  function solve() {
    setError("");
    const { Cg, Sg, b1, r1yd, b2, r2yd } = baseParse();
    if ([Cg, Sg, b1, r1yd, b2, r2yd].some((v) => Number.isNaN(v))) { setError("กรอกข้อมูลกระบวนเรือและตำแหน่งให้ครบ"); setResult(null); return; }
    const P1 = polarToXY(b1, r1yd / YARDS_PER_NM);
    const P2 = polarToXY(b2, r2yd / YARDS_PER_NM);
    const delta = vSub(P2, P1);
    const distNm = vLen(delta);
    const dir = vBrg(delta);
    const em = polarToXY(Cg, Sg);
    const u = polarToXY(dir, 1);
    // sign: 'ownship' at center -> er = em - rm  |  'guide' at center -> er = em + rm
    const sign = centerMode === "ownship" ? -1 : 1;
    let Co, So, timeMin, altNote = null;

    if (mode === "byTime") {
      const T = parseFloat(timeMinInput);
      if (Number.isNaN(T) || T <= 0) { setError("กรอกเวลาที่ต้องการใช้ (นาที) ให้ถูกต้อง"); setResult(null); return; }
      const SRM = distNm / (T / 60);
      const rm = polarToXY(dir, SRM);
      const er = sign < 0 ? vSub(em, rm) : vAdd(em, rm);
      Co = vBrg(er); So = vLen(er); timeMin = T;
    } else if (mode === "byCourse") {
      const Cfix = parseFloat(courseInput);
      if (Number.isNaN(Cfix)) { setError("กรอกเข็มที่จะใช้ให้ถูกต้อง"); setResult(null); return; }
      const uCo = polarToXY(Cfix, 1);
      const a11 = uCo.x, a12 = -sign * u.x, a21 = uCo.y, a22 = -sign * u.y;
      const det = a11 * a22 - a12 * a21;
      if (Math.abs(det) < 1e-6) { setError("เข็มนี้ขนานกับแนวที่ต้องเคลื่อนที่ — หาคำตอบไม่ได้ ลองเข็มอื่น"); setResult(null); return; }
      const Sval = (em.x * a22 - a12 * em.y) / det;
      const SRM = (a11 * em.y - em.x * a21) / det;
      if (Sval <= 0 || SRM <= 0) { setError("เข็มนี้ไม่สามารถพาไปสถานีใหม่ได้ (ความเร็วที่คำนวณได้ติดลบ) ลองเข็มอื่น"); setResult(null); return; }
      Co = mod360(Cfix); So = Sval; timeMin = (distNm / SRM) * 60;
    } else if (mode === "bySpeed") {
      const SoFixed = parseFloat(speedInput);
      if (Number.isNaN(SoFixed) || SoFixed <= 0) { setError("กรอกความเร็วที่จะใช้ให้ถูกต้อง"); setResult(null); return; }
      const dot = em.x * u.x + em.y * u.y;
      const emLen2 = em.x * em.x + em.y * em.y;
      const b = 2 * dot, c = emLen2 - SoFixed * SoFixed;
      const disc = b * b - 4 * c;
      if (disc < 0) { setError("ความเร็วนี้ต่ำเกินไป ไม่สามารถพาไปสถานีใหม่ได้ ลองเพิ่มความเร็ว"); setResult(null); return; }
      const sq = Math.sqrt(disc);
      const cands = [(-b + sq) / 2, (-b - sq) / 2]
        .map((rmSigned) => ({ rmSigned, SRM: sign * rmSigned }))
        .filter((o) => o.SRM > 0.01)
        .sort((a, b2) => a.SRM - b2.SRM);
      if (!cands.length) { setError("ไม่มีคำตอบที่เป็นไปได้ที่ความเร็วนี้"); setResult(null); return; }
      const { rmSigned, SRM } = cands[0];
      const er = vAdd(em, polarToXY(dir, rmSigned));
      Co = vBrg(er); So = SoFixed; timeMin = (distNm / SRM) * 60;
      if (cands.length > 1) altNote = `หมายเหตุ: มีอีกคำตอบหนึ่งที่เข็มอื่น (ใช้เวลา ${fmt((distNm / cands[1].SRM) * 60, 0)} นาที) — ระบบเลือกคำตอบที่ถึงเร็วกว่าให้`;
    } else {
      const dot = em.x * u.x + em.y * u.y;
      const rmSigned = -dot;
      const er = vAdd(em, polarToXY(dir, rmSigned));
      const SRM = sign * rmSigned;
      Co = vBrg(er); So = vLen(er);
      timeMin = SRM !== 0 ? (distNm / Math.abs(SRM)) * 60 : NaN;
      if (SRM <= 0) altNote = "หมายเหตุ: คำตอบนี้เป็นเวกเตอร์สั้นที่สุดทางคณิตศาสตร์ แต่ทิศ SRM ที่ได้ย้อนแนว M1→M2 — ตรวจสอบสถานการณ์จริงอีกครั้ง";
    }

    const er = polarToXY(Co, So);
    const maxPlot = Math.max(r1yd / 1000, r2yd / 1000, So, Sg, vLen(em));
    if (exceedsBoard(maxPlot, scale)) { setError(`ข้อมูลเกินขอบกระดานที่สเกล ${scale}:1 กรุณาเลือกสเกลที่สูงขึ้น`); setResult(null); return; }
    setResult({ P1, P2, em, er, Co, So, timeMin, altNote });
  }

  function clearAll() {
    setGuide({ course: "", speed: "" }); setM1({ bearing: "", range: "" }); setM2({ bearing: "", range: "" });
    setTimeMinInput(""); setCourseInput(""); setSpeedInput(""); setResult(null); setError("");
  }
  function changeRangeUnit(nextUnit) {
    if (nextUnit === rangeUnit) return;
    const convert = (point) => ({ ...point, range: point.range === "" ? "" : String(yardsToRange(rangeToYards(point.range, rangeUnit), nextUnit)) });
    setM1(convert); setM2(convert); setRangeUnit(nextUnit);
  }

  function generateProblem() {
    const rc = () => Math.floor(Math.random() * 360);
    const rs = (a, b) => +(a + Math.random() * (b - a)).toFixed(1);
    let Cg, Sg, Co, So, em, er, rm, SRM, dir, T, P1, P2;
    const sign = centerMode === "ownship" ? -1 : 1;
    do {
      Cg = rc(); Sg = rs(8, 16); Co = rc(); So = rs(10, 18);
      em = polarToXY(Cg, Sg); er = polarToXY(Co, So);
      rm = { x: (er.x - em.x) / sign, y: (er.y - em.y) / sign };
      SRM = Math.max(vLen(rm), 0.1); dir = vBrg(rm);
      T = Math.floor(rs(5, 10)); P1 = polarToXY(rc(), rs(1, 3));
      P2 = vAdd(P1, polarToXY(dir, SRM * T / 60));
    } while (Math.max(vLen(P1), vLen(P2)) * YARDS_PER_NM > 20000);
    const maxRangeYd = Math.max(vLen(P1), vLen(P2)) * YARDS_PER_NM;
    const nextUnit = maxRangeYd > 2 * YARDS_PER_NM ? "nm" : "yd";
    setRangeUnit(nextUnit);
    setGuide({ course: String(Cg).padStart(3, "0"), speed: String(Sg) });
    setM1({ bearing: String(Math.round(vBrg(P1))).padStart(3, "0"), range: String(yardsToRange(vLen(P1) * YARDS_PER_NM, nextUnit)) });
    setM2({ bearing: String(Math.round(vBrg(P2))).padStart(3, "0"), range: String(yardsToRange(vLen(P2) * YARDS_PER_NM, nextUnit)) });
    setTimeMinInput(String(T));
    setCourseInput(String(Co).padStart(3, "0"));
    setSpeedInput(String(So));
    setScale(Math.max(idealScaleForRangeYards(Math.max(vLen(P1), vLen(P2)) * YARDS_PER_NM), idealScaleForSpeed(Math.max(So, Sg))));
    setResult(null); setError("");
  }

  const sc = (xy) => xyToScreenSpeedScaled(xy.x, xy.y, scale);
  const scD = (xy) => xyToScreenDistanceScaled(xy.x, xy.y, scale);
  const centerLabel = centerMode === "ownship" ? "เรือเรา" : "GUIDE";
  const boardVectors = result && (
    <g>
      {(() => { const a = scD(result.P1), b = scD(result.P2); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={CRIMSON} strokeWidth="1.2" strokeDasharray="7 6" opacity="0.75" />; })()}
      {(() => { const p = scD(result.P1); return <circle cx={p.sx} cy={p.sy} r="7" fill={CRIMSON} stroke={PAPER} strokeWidth="1.5" />; })()}
      {(() => { const p = scD(result.P1); return <text x={p.sx} y={p.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M1</text>; })()}
      {(() => { const p = scD(result.P2); return <circle cx={p.sx} cy={p.sy} r="7" fill={CRIMSON} stroke={PAPER} strokeWidth="1.5" />; })()}
      {(() => { const p = scD(result.P2); return <text x={p.sx} y={p.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M2</text>; })()}
      {(() => { const a = sc(result.er), b = sc(result.em); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={RM_BLUE} strokeWidth="1.4" strokeDasharray="7 6" opacity="0.95" markerEnd="url(#arrowRm)" />; })()}
      {(() => { const a = sc(result.er); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={ER_BLUE} strokeWidth="2" markerEnd="url(#arrowEr)" />; })()}
      {(() => { const a = sc(result.er); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={ER_BLUE_DEEP} textAnchor="middle" fontWeight="700">er</text>; })()}
      {(() => { const a = sc(result.em); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={EM_RED} strokeWidth="2" markerEnd="url(#arrowEm)" />; })()}
      {(() => { const a = sc(result.em); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={EM_RED} textAnchor="middle" fontWeight="700">em</text>; })()}
      <text x={CENTER.x} y={CENTER.y + 26} fontSize="13" fontFamily={FONT_MONO} fill={INK} textAnchor="middle" fontWeight="700">{centerLabel}</text>
    </g>
  );

  return (
    <TabShell>
      <ModeRow options={[["ownship", "เรือเราอยู่ศูนย์กลาง"], ["guide", "Guide อยู่ศูนย์กลาง"]]} value={centerMode} onChange={(v) => { setCenterMode(v); setResult(null); setError(""); }} />
      <ModeRow options={[["byTime", "ด้วยเวลา"], ["byCourse", "ด้วยเข็ม"], ["bySpeed", "ด้วยความเร็ว"], ["minSpeed", "ความเร็วต่ำสุด"]]} value={mode} onChange={(v) => { setMode(v); setResult(null); setError(""); }} />
      <BoardCard zOpen={z.open}><BoardChrome>{boardVectors}</BoardChrome></BoardCard>
      <ScaleRow scale={scale} setScale={setScale} extra={`ระยะสูงสุด ${(RING_COUNT * scale * 1000).toLocaleString()} yds`} note="การสุ่มโจทย์จะเลือกสเกลเริ่มต้นที่เหมาะสมให้" showDistanceRemark />

      <ResultCard>
        {result ? (
          <>
            <BigAnswer>เดินเข็ม <Accent>{fmtBrg(result.Co)}</Accent> ความเร็ว <Accent>{fmt(result.So)} นอต</Accent></BigAnswer>
            <ResultGrid>
              <ResultItem label="เวลาที่ใช้" value={`${fmt(result.timeMin, 0)} นาที`} accent />
            </ResultGrid>
            {result.altNote && <div style={{ color: CRIMSON }} className="text-[11px] mt-2 text-center">{result.altNote}</div>}
          </>
        ) : <EmptyNote />}
      </ResultCard>

      <InputCard>
        <SectionLabel>Guide (เรือนำกระบวน)</SectionLabel>
        <TwoField l1="เข็ม °T" l2="ความเร็ว kt" v1={guide.course} v2={guide.speed} onC1={(e) => setGuide((p) => ({ ...p, course: e.target.value }))} onC2={(e) => setGuide((p) => ({ ...p, speed: e.target.value }))} p1="°T" p2="kt" />
        <SubDivider />
        <SectionLabel>{centerMode === "ownship" ? "ตำแหน่ง Guide เทียบเรา" : "ตำแหน่งเราเทียบ Guide"} — ปัจจุบัน (M1) / สถานีใหม่ (M2)</SectionLabel>
        <ModeRow options={[["yd", "ระยะเป็นหลา"], ["nm", "ระยะเป็น NM"]]} value={rangeUnit} onChange={changeRangeUnit} />
        <div style={rowGrid3} className="mb-1.5"><div /><MiniLabel>แบริ่ง</MiniLabel><MiniLabel>ระยะ</MiniLabel></div>
        <div style={rowGrid3} className="items-center mb-1.5"><PointName>M1</PointName><Field value={m1.bearing} onChange={(e) => setM1((p) => ({ ...p, bearing: e.target.value }))} placeholder="°T" /><Field value={m1.range} onChange={(e) => setM1((p) => ({ ...p, range: e.target.value }))} placeholder={rangeUnit === "nm" ? "NM" : "yds"} /></div>
        <div style={rowGrid3} className="items-center"><PointName>M2</PointName><Field value={m2.bearing} onChange={(e) => setM2((p) => ({ ...p, bearing: e.target.value }))} placeholder="°T" /><Field value={m2.range} onChange={(e) => setM2((p) => ({ ...p, range: e.target.value }))} placeholder={rangeUnit === "nm" ? "NM" : "yds"} /></div>
        <SubDivider />
        {mode === "byTime" && (
          <>
            <SectionLabel>เวลาที่ต้องการใช้ให้ถึงสถานีใหม่</SectionLabel>
            <Field value={timeMinInput} onChange={(e) => setTimeMinInput(e.target.value)} placeholder="นาที" />
          </>
        )}
        {mode === "byCourse" && (
          <>
            <SectionLabel>เข็มที่จะใช้เข้าสถานี</SectionLabel>
            <Field value={courseInput} onChange={(e) => setCourseInput(e.target.value)} placeholder="°T" />
          </>
        )}
        {mode === "bySpeed" && (
          <>
            <SectionLabel>ความเร็วที่จะใช้เข้าสถานี</SectionLabel>
            <Field value={speedInput} onChange={(e) => setSpeedInput(e.target.value)} placeholder="kt" />
          </>
        )}
        {mode === "minSpeed" && <div style={{ color: INK_SOFT }} className="text-xs">ระบบจะหาเข็ม+ความเร็วต่ำสุดที่พาไปสถานีใหม่ได้ให้เอง</div>}
        <ButtonRow onClear={clearAll} onRandom={generateProblem} onSolve={solve} solveLabel="คำนวณ" />
        {error && <ErrorText>{error}</ErrorText>}
      </InputCard>
      <ZoomModal z={z}><BoardChrome>{boardVectors}</BoardChrome></ZoomModal>
    </TabShell>
  );
}

/* ============================================================
   APP — tab switcher
   ============================================================ */
/* ============================================================
   TAB 4: Time–Speed–Distance nomogram (60 D = S T)
   ============================================================ */
const YD_PER_UNIT = { yd: 1, nm: YARDS_PER_NM, mi: 1760 };
const UNIT_LABEL = { yd: "หลา", nm: "ไมล์ทะเล", mi: "ไมล์บก" };
const YD_PER_KT_MIN = YARDS_PER_NM / 60; // 1 นอต * 1 นาที = ระยะเป็นหลา

/* ---- log-nomogram alignment math (verified: 60D(nm)=S*T, D stored in yards) ----
   Three parallel scales — Time (top), Distance (middle), Speed (bottom).
   Distance sits exactly halfway between Time and Speed, so with
   m_time = m_speed = 2 * m_dist, a straight line between the Time and
   Speed points always crosses the Distance line at the true answer. */
const NOMO_M3 = 130, NOMO_M1 = 260, NOMO_M2 = 260;
const NOMO_ANCHOR_X = 400;
const NOMO_C1 = NOMO_ANCHOR_X - NOMO_M1 * Math.log10(10);
const NOMO_C2 = NOMO_ANCHOR_X - NOMO_M2 * Math.log10(10);
const NOMO_C3 = 0.5 * (NOMO_C1 + NOMO_C2) + NOMO_M3 * Math.log10(60) - NOMO_M3 * Math.log10(YARDS_PER_NM);
const nomoXT = (T) => NOMO_M1 * Math.log10(T) + NOMO_C1;
const nomoXS = (S) => NOMO_M2 * Math.log10(S) + NOMO_C2;
const nomoXD = (Dyd) => NOMO_M3 * Math.log10(Dyd) + NOMO_C3;
const nomoTAtX = (x) => Math.pow(10, (x - NOMO_C1) / NOMO_M1);
const nomoSAtX = (x) => Math.pow(10, (x - NOMO_C2) / NOMO_M2);
const nomoDAtX = (x) => Math.pow(10, (x - NOMO_C3) / NOMO_M3);

function niceTicks(vMin, vMax) {
  const ticks = [];
  const kMin = Math.floor(Math.log10(vMin));
  const kMax = Math.ceil(Math.log10(vMax));
  for (let k = kMin; k <= kMax; k++) {
    for (let d = 1; d <= 9; d++) {
      const v = d * Math.pow(10, k);
      if (v >= vMin * 0.97 && v <= vMax * 1.03) ticks.push({ value: v, major: d === 1 || d === 2 || d === 5 });
    }
  }
  return ticks;
}
function fmtTick(v) {
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "k";
  if (v >= 10) return String(Math.round(v));
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

const NOMO_SCREEN_L = 46, NOMO_SCREEN_R = 690, NOMO_VB_W = 736, NOMO_VB_H = 210;
function NomogramGraphic({ T, S, Dyd }) {
  const haveLine = Number.isFinite(T) && Number.isFinite(S) && Number.isFinite(Dyd) && T > 0 && S > 0 && Dyd > 0;
  const xT = haveLine ? nomoXT(T) : NOMO_ANCHOR_X;
  const xS = haveLine ? nomoXS(S) : NOMO_ANCHOR_X;
  const xD = haveLine ? nomoXD(Dyd) : nomoXD(nomoDAtX(NOMO_ANCHOR_X));
  const half = Math.max(Math.abs(xT - xD), Math.abs(xS - xD), 80) * 1.4;
  const wMin = xD - half, wMax = xD + half;
  const screenX = (x) => NOMO_SCREEN_L + ((x - wMin) / (wMax - wMin)) * (NOMO_SCREEN_R - NOMO_SCREEN_L);

  const rows = [
    { y: 34, label: "TIME (min)", tMin: nomoTAtX(wMin), tMax: nomoTAtX(wMax), toX: (v) => screenX(nomoXT(v)), mark: haveLine ? T : null, unit: "min" },
    { y: 106, label: "DISTANCE (yd)", tMin: nomoDAtX(wMin), tMax: nomoDAtX(wMax), toX: (v) => screenX(nomoXD(v)), mark: haveLine ? Dyd : null, unit: "yd" },
    { y: 178, label: "SPEED (kt)", tMin: nomoSAtX(wMin), tMax: nomoSAtX(wMax), toX: (v) => screenX(nomoXS(v)), mark: haveLine ? S : null, unit: "kt" },
  ];

  return (
    <svg viewBox={`0 0 ${NOMO_VB_W} ${NOMO_VB_H}`} className="w-full h-auto">
      {rows.map((row, i) => {
        const ticks = niceTicks(Math.max(row.tMin, 0.01), row.tMax);
        return (
          <g key={i}>
            <text x={NOMO_SCREEN_L} y={row.y - 14} fontSize="9" fontFamily={FONT_MONO} fill={TEXT_MUTE} letterSpacing="0.08em">{row.label}</text>
            <line x1={NOMO_SCREEN_L} y1={row.y} x2={NOMO_SCREEN_R} y2={row.y} stroke={PANEL_LINE_BRIGHT} strokeWidth="1" />
            {ticks.map((t, j) => {
              const x = row.toX(t.value);
              if (x < NOMO_SCREEN_L - 2 || x > NOMO_SCREEN_R + 2) return null;
              return (
                <g key={j}>
                  <line x1={x} y1={row.y - (t.major ? 7 : 4)} x2={x} y2={row.y + (t.major ? 7 : 4)} stroke={t.major ? AMBER : PANEL_LINE_BRIGHT} strokeWidth={t.major ? 1.1 : 0.7} />
                  {t.major && <text x={x} y={row.y + 19} fontSize="8.5" fontFamily={FONT_MONO} fill={TEXT_MUTE} textAnchor="middle">{fmtTick(t.value)}</text>}
                </g>
              );
            })}
            {row.mark !== null && (() => {
              const x = row.toX(row.mark);
              return (
                <g>
                  <circle cx={x} cy={row.y} r="4" fill={CRIMSON} stroke="#fff" strokeWidth="1" />
                  <text x={x} y={row.y - 12} fontSize="9.5" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">{fmtTick(row.mark)}</text>
                </g>
              );
            })()}
          </g>
        );
      })}
      {haveLine && (
        <line x1={screenX(xT)} y1={rows[0].y} x2={screenX(xS)} y2={rows[2].y} stroke={CRIMSON} strokeWidth="1.6" strokeDasharray="1 0" opacity="0.85" />
      )}
    </svg>
  );
}

function TSDTab() {
  const [mode, setMode] = useSessionState("tsd.mode", "speed"); // 'speed' | 'time' | 'distance'
  const [timeInput, setTimeInput] = useSessionState("tsd.time", "");
  const [speedInput, setSpeedInput] = useSessionState("tsd.speed", "");
  const [distInput, setDistInput] = useSessionState("tsd.distance", "");
  const [distUnit, setDistUnit] = useSessionState("tsd.unit", "yd");
  const [result, setResult] = useSessionState("tsd.result", null);
  const [error, setError] = useState("");

  function solve() {
    setError("");
    const T = parseFloat(timeInput);
    const S = parseFloat(speedInput);
    const Dval = parseFloat(distInput);
    const Dyd = Dval * YD_PER_UNIT[distUnit];

    if (mode === "speed") {
      if (Number.isNaN(T) || T <= 0 || Number.isNaN(Dval) || Dval <= 0) { setError("กรอกเวลาและระยะให้ครบและถูกต้อง"); setResult(null); return; }
      const speedKt = Dyd / (T * YD_PER_KT_MIN);
      setResult({ mode, speedKt, T, S: speedKt, Dyd });
    } else if (mode === "time") {
      if (Number.isNaN(S) || S <= 0 || Number.isNaN(Dval) || Dval <= 0) { setError("กรอกความเร็วและระยะให้ครบและถูกต้อง"); setResult(null); return; }
      const timeMin = Dyd / (S * YD_PER_KT_MIN);
      setResult({ mode, timeMin, S, T: timeMin, Dyd });
    } else {
      if (Number.isNaN(S) || S <= 0 || Number.isNaN(T) || T <= 0) { setError("กรอกความเร็วและเวลาให้ครบและถูกต้อง"); setResult(null); return; }
      const distYd = S * T * YD_PER_KT_MIN;
      setResult({ mode, distYd, S, T, Dyd: distYd });
    }
  }
  function clearAll() {
    setTimeInput(""); setSpeedInput(""); setDistInput(""); setResult(null); setError("");
  }
  function generateProblem() {
    const speed = +(6 + Math.random() * 24).toFixed(1);
    const time = Math.floor(4 + Math.random() * 57);
    const distYd = speed * time * YD_PER_KT_MIN;
    const units = ["yd", "nm", "mi"];
    const unit = units[Math.floor(Math.random() * units.length)];
    setDistUnit(unit);
    setTimeInput(String(time));
    setSpeedInput(String(speed));
    setDistInput((distYd / YD_PER_UNIT[unit]).toFixed(unit === "yd" ? 0 : 2));
    setResult(null); setError("");
  }

  return (
    <TabShell>
      <ModeRow options={[["speed", "หาความเร็ว"], ["time", "หาเวลา"], ["distance", "หาระยะ"]]} value={mode} onChange={(v) => { setMode(v); setResult(null); setError(""); }} />

      <ResultCard>
        {result ? (
          <>
            {result.mode === "speed" && <BigAnswer>ความเร็ว <Accent>{fmt(result.speedKt)} นอต</Accent></BigAnswer>}
            {result.mode === "time" && <BigAnswer>ใช้เวลา <Accent>{fmt(result.timeMin)} นาที</Accent></BigAnswer>}
            {result.mode === "distance" && (
              <BigAnswer>ระยะ <Accent>{fmt(result.distYd, 0)} หลา</Accent></BigAnswer>
            )}
            {result.mode === "distance" && (
              <ResultGrid>
                <ResultItem label="ไมล์ทะเล (nm)" value={fmt(result.distYd / YARDS_PER_NM, 2)} />
                <ResultItem label="ไมล์บก (mi)" value={fmt(result.distYd / 1760, 2)} />
              </ResultGrid>
            )}
          </>
        ) : <EmptyNote />}
      </ResultCard>

      <GlassPanel>
        <SectionLabel>เส้นมาร์คบนสเกล (เหมือนขีดด้วยดินสอ)</SectionLabel>
        <NomogramGraphic T={result ? result.T : NaN} S={result ? result.S : NaN} Dyd={result ? result.Dyd : NaN} />
        {!result && <div style={{ color: TEXT_MUTE, fontFamily: FONT_BODY }} className="text-[12px] text-center mt-1">คำนวณก่อนเพื่อดูเส้นมาร์ค</div>}
      </GlassPanel>

      <InputCard>
        <SectionLabel>สูตร: 60 × ระยะ(nm) = ความเร็ว(kt) × เวลา(min)</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", rowGap: "10px" }}>
          {mode !== "time" && (
            <div>
              <MiniLabel>เวลา (นาที)</MiniLabel>
              <Field value={timeInput} onChange={(e) => setTimeInput(e.target.value)} placeholder="min" />
            </div>
          )}
          {mode !== "speed" && (
            <div>
              <MiniLabel>ความเร็ว (นอต)</MiniLabel>
              <Field value={speedInput} onChange={(e) => setSpeedInput(e.target.value)} placeholder="kt" />
            </div>
          )}
          {mode !== "distance" && (
            <div>
              <MiniLabel>ระยะทาง</MiniLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: "8px" }}>
                <Field value={distInput} onChange={(e) => setDistInput(e.target.value)} placeholder="ระยะ" />
                <div className="flex gap-1">
                  {["yd", "nm", "mi"].map((u) => (
                    <button key={u} onClick={() => setDistUnit(u)}
                      style={{
                        background: distUnit === u ? "rgba(79,216,232,0.18)" : "rgba(2,7,13,0.96)",
                        color: distUnit === u ? AMBER : TEXT_MUTE,
                        border: `1px solid ${distUnit === u ? AMBER : PANEL_LINE}`,
                        clipPath: CHAMFER_SM, fontFamily: FONT_MONO,
                      }}
                      className="px-2.5 text-[12px] font-medium uppercase">{u}</button>
                  ))}
                </div>
              </div>
              <div style={{ color: TEXT_MUTE, fontFamily: FONT_BODY }} className="text-[12px] mt-1">{UNIT_LABEL[distUnit]}</div>
            </div>
          )}
        </div>
        <ButtonRow onClear={clearAll} onRandom={generateProblem} onSolve={solve} solveLabel="คำนวณ" />
        {error && <ErrorText>{error}</ErrorText>}
      </InputCard>
    </TabShell>
  );
}

function TabIcon({ id, active }) {
  const color = active ? AMBER : TEXT_MUTE;
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "target") return (
    <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.3" fill={color} stroke="none" /><line x1="12" y1="1" x2="12" y2="4.5" /><line x1="12" y1="19.5" x2="12" y2="23" /><line x1="1" y1="12" x2="4.5" y2="12" /><line x1="19.5" y1="12" x2="23" y2="12" /></svg>
  );
  if (id === "wind") return (
    <svg {...common}><path d="M2 8h13a3 3 0 1 0-3-3" /><path d="M2 16h17a3 3 0 1 1-3 3" /><path d="M2 12h9" /></svg>
  );
  if (id === "tsd") return (
    <svg {...common}><rect x="2" y="6" width="20" height="12" rx="1.5" /><line x1="6" y1="6" x2="6" y2="10" /><line x1="10" y1="6" x2="10" y2="9" /><line x1="14" y1="6" x2="14" y2="10" /><line x1="18" y1="6" x2="18" y2="9" /></svg>
  );
  return (
    <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 10 10l-1.5 5.5L14 14l1.5-5.5z" fill={color} stroke="none" /></svg>
  );
}
export default function App() {
  const [tab, setTab] = useState("target");
  const tabs = [
    ["target", "TMA"],
    ["wind", "ปัญหาลม"],
    ["station", "เข้าสถานี"],
    ["tsd", "T-S-D"],
  ];
  return (
    <div style={{ background: `radial-gradient(circle at 50% -10%, rgba(18,62,82,0.24), transparent 32%), ${BG}`, fontFamily: FONT_BODY, minHeight: "100dvh" }} className="w-full flex flex-col items-center">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Thai:wght@300;400;500&display=swap');
        ::placeholder { color: #B7BEC3; opacity: 1; }
        body { font-weight: 400; line-height: 1.55; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
        button { cursor: pointer; border-radius: 8px; transition: filter 0.15s ease, transform 0.1s ease, background 0.15s ease, box-shadow 0.15s ease; }
        button:not(:disabled):hover { filter: brightness(1.18); }
        button:active { transform: scale(0.96); filter: brightness(1.3); }
        button:focus-visible { outline: 2px solid ${AMBER}; outline-offset: 3px; }
        input:focus-visible { outline: none; border-color: ${AMBER} !important; box-shadow: inset 0 1px 8px rgba(0,0,0,0.9), 0 0 0 1px ${AMBER}, 0 0 13px rgba(79,216,232,0.38) !important; }
        button:disabled { cursor: not-allowed; opacity: 0.5; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; scroll-behavior: auto !important; } }
        input { font-size: 16px !important; }
      `}</style>

      <div className="w-full max-w-md flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: AMBER, border: `1px solid ${AMBER}`, boxShadow: "0 0 12px rgba(79,216,232,0.18)" }} className="w-9 h-9 rounded-full inline-flex items-center justify-center text-lg">⚓</span>
          <div className="flex flex-col leading-none">
            <span style={{ fontFamily: FONT_HEAD, letterSpacing: "0.025em", color: TEXT_LIGHT, fontWeight: 400 }} className="text-[17px]">กระดานหนพื้นฐาน</span>
            <span style={{ color: "rgba(132,166,178,0.48)", fontFamily: FONT_MONO, letterSpacing: "0.06em" }} className="text-[9px] mt-1.5">v1.0 · อัปเดต 3 ก.ย. 2026</span>
          </div>
        </div>
        <span style={{ color: "rgba(132,166,178,0.48)", border: `1px solid rgba(111,176,193,0.16)`, borderRadius: "7px", fontFamily: FONT_MONO }} className="text-[10px] uppercase tracking-wider px-2 py-1.5">SORN7749</span>
      </div>

      <div className="w-full max-w-md grid grid-cols-4 gap-1 px-4">
        {tabs.map(([id, label]) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} aria-pressed={active} aria-label={`เปิดเครื่องมือ ${label}`}
              style={{
                background: active ? "rgba(79,216,232,0.12)" : "rgba(5,16,27,0.94)",
                color: active ? TEXT_LIGHT : TEXT_MUTE,
                border: `1px solid ${active ? AMBER : "rgba(79,216,232,0.32)"}`,
                boxShadow: active ? `inset 0 0 12px rgba(79,216,232,0.10), 0 0 10px rgba(79,216,232,0.24)` : "inset 0 1px 0 rgba(255,255,255,0.025)",
              }}
              className="flex flex-col items-center gap-1 text-[12px] px-1 pt-3 pb-2.5 rounded-md font-normal tracking-wide">
              <TabIcon id={id} active={active} />
              {label}
            </button>
          );
        })}
      </div>
      <div style={{ borderTop: `1px solid rgba(79,216,232,0.12)`, background: "transparent" }} className="w-full">
        {tab === "target" && <TargetSpeedTab />}
        {tab === "wind" && <WindTab />}
        {tab === "station" && <StationTab />}
        {tab === "tsd" && <TSDTab />}
      </div>
    </div>
  );
}

/* ============================================================
   Shared layout pieces
   ============================================================ */
function TabShell({ children }) {
  return <div className="w-full flex flex-col items-center p-4 gap-3.5">{children}</div>;
}
function GlassPanel({ children, accentLeft, style }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(7,20,32,0.94), rgba(3,12,21,0.97))",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${PANEL_LINE}`,
        borderTop: accentLeft ? `1px solid rgba(79,216,232,0.58)` : `1px solid ${PANEL_LINE}`,
        boxShadow: accentLeft ? `0 0 18px -10px rgba(79,216,232,0.55), 0 10px 26px -18px rgba(0,0,0,0.9)` : "0 10px 26px -18px rgba(0,0,0,0.9)",
        ...style,
      }}
      className="w-full max-w-md rounded-xl p-4 relative overflow-hidden"
    >
      {children}
    </div>
  );
}
function BoardCard({ children, zOpen }) {
  return (
    <div className="w-full max-w-md relative">
      <div style={{ background: "#020A13", border: `1px solid ${PANEL_LINE}`, borderRadius: "12px", boxShadow: `0 0 24px -13px rgba(79,216,232,0.65)` }} className="p-2 relative overflow-hidden">
        <button onClick={zOpen}
          style={{ background: "rgba(2,10,19,0.92)", color: AMBER, border: `1px solid ${AMBER}`, clipPath: CHAMFER_SM, fontFamily: FONT_MONO, letterSpacing: "0.04em", boxShadow: "0 0 10px -3px rgba(79,216,232,0.65)" }}
          className="absolute top-3 right-3 z-10 text-[11px] px-3 py-2 font-normal uppercase">⤢ ขยาย</button>
        {children}
      </div>
    </div>
  );
}

function StepArrows({ step, setStep }) {
  return <div style={{ background: "rgba(2,10,19,0.94)", border: `1px solid ${PANEL_LINE_BRIGHT}`, borderRadius: "9px", fontFamily: FONT_MONO }} className="flex items-center overflow-hidden">
    <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step <= 1} className="px-4 py-2.5" style={{ color: step <= 1 ? TEXT_MUTE : AMBER }}>‹</button>
    <span className="px-3 text-[12px]" style={{ color: TEXT_LIGHT }}>{step}/5</span>
    <button onClick={() => setStep(Math.min(5, step + 1))} disabled={step >= 5} className="px-4 py-2.5" style={{ color: step >= 5 ? TEXT_MUTE : AMBER }}>›</button>
  </div>;
}

function SolutionSteps({ method, step, setStep, result, scale }) {
  const [open, setOpen] = useState(false);
  const rings = (v) => fmt(v / scale, 2);
  const flexible = [
    `ขีด ew ไปทาง ${fmtBrg(result.wDirToward)} ยาว ${fmt(result.twSpeed)} kt = ${rings(result.twSpeed)} วง`,
    `แบ่ง ew ครึ่งหนึ่งเป็นจุด t แล้วลากเส้นตั้งฉากผ่าน t`,
    `สร้างจุด o และวงกลมตำแหน่งมุมลมสัมพันธ์ ${fmt(result.dAngle)}°`,
    `ใช้ w เป็นศูนย์กลาง รัศมี ${fmt(result.dSpeed)} kt = ${rings(result.dSpeed)} วง หาจุด r1 และ r2`,
    `ลาก er1 และ er2 แล้วอ่านเข็ม/ความเร็วด้วยสเกล ${scale}:1`
  ];
  const rigid = [
    `ขีดแนว ew ไปทาง ${fmtBrg(result.wDirToward)} และทำจุด w ที่ ${fmt(result.twSpeed)} kt = ${rings(result.twSpeed)} วง`,
    `นับมุม ${fmt(result.dAngle)}° ${result.signed > 0 ? "ทวนเข็มนาฬิกา (หัวเรือขวา)" : "ตามเข็มนาฬิกา (หัวเรือซ้าย)"}`,
    `กำหนดจุด o ที่ ${fmt(result.dSpeed)} kt = ${rings(result.dSpeed)} วงจาก e`,
    `วงกลมศูนย์กลาง o รัศมี ${fmt(result.twSpeed)} kt ตัดแนว ew ที่ r1 และ r2`,
    `ทิศ or คือเข็ม ส่วนระยะ e-r คือความเร็วเรือ ด้วยสเกล ${scale}:1`
  ];
  const steps = method === "flexible" ? flexible : rigid;
  return <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ border: `1px solid ${PANEL_LINE}`, background: PANEL }}>
    <button onClick={() => setOpen(v => !v)} className="w-full flex justify-between items-center px-4 py-3" style={{ color: AMBER, background: "rgba(79,216,232,0.04)" }}><span>แสดงวิธีการแก้โจทย์ · {method === "flexible" ? "แบบอ่อนตัว" : "แบบแข็งตัว"}</span><span>{open ? "⌃" : "⌄"}</span></button>
    {open && <div className="p-3"><div className="flex items-center justify-between gap-3"><StepArrows step={step} setStep={setStep}/><button onClick={() => setStep(5)} className="px-3 py-2 text-[12px] rounded-lg" style={{ border: `1px solid ${AMBER}`, color: AMBER }}>ทั้งหมด</button></div><div className="mt-3 text-[13px] leading-relaxed" style={{ color: TEXT_LIGHT_MUTE }}>{steps[step - 1]}</div></div>}
  </div>;
}
function ResultCard({ children }) {
  return (
    <GlassPanel accentLeft>
      {children}
    </GlassPanel>
  );
}
function InputCard({ children }) {
  return <GlassPanel>{children}</GlassPanel>;
}
function EmptyNote() {
  return (
    <div style={{ color: TEXT_LIGHT_MUTE, fontFamily: FONT_BODY }} className="text-sm text-center py-2 tracking-wide">
      — กรอกข้อมูลด้านล่างแล้วกด "คำนวณ" —
    </div>
  );
}
function BigAnswer({ children }) {
  return (
    <div>
      <div style={{ color: AMBER, fontFamily: FONT_HEAD, letterSpacing: "0.06em", fontWeight: 400 }} className="text-[13px] text-center mb-2">ผลการคำนวณ</div>
      <div style={{ color: TEXT_LIGHT, fontFamily: FONT_MONO, fontWeight: 500 }} className="text-[17px] text-center mb-1 leading-relaxed">{children}</div>
    </div>
  );
}
function Accent({ children }) {
  return <span style={{ color: CRIMSON, fontWeight: 600 }}>{children}</span>;
}
function ResultGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: "9px", columnGap: "12px", borderTop: `1px dashed ${PANEL_LINE_BRIGHT}`, paddingTop: "11px", marginTop: "10px" }} className="text-sm">{children}</div>;
}
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <span style={{ background: AMBER, width: "5px", height: "5px", boxShadow: `0 0 6px ${AMBER}` }} className="inline-block rounded-full flex-shrink-0" />
      <span style={{ color: TEXT_LIGHT, fontFamily: FONT_HEAD, fontWeight: 400, letterSpacing: "0.06em" }} className="text-[13px]">{children}</span>
    </div>
  );
}
function SubDivider() {
  return <div style={{ borderTop: `1px dashed ${PANEL_LINE_BRIGHT}`, marginTop: "14px", paddingTop: "14px" }} />;
}
function ErrorText({ children }) {
  return (
    <div style={{ color: "#FFE3E6", background: CRIMSON_DEEP, borderLeft: `3px solid ${CRIMSON}`, fontFamily: FONT_MONO }} className="text-xs mt-3 px-3 py-2 rounded-r">
      {children}
    </div>
  );
}
function ModeRow({ options, value, onChange }) {
  return (
    <div className="w-full max-w-md flex gap-1.5 flex-wrap justify-center">
      {options.map(([id, label]) => {
        const active = value === id;
        return (
          <button key={id} onClick={() => onChange(id)}
            style={{
              background: active ? "rgba(79,216,232,0.18)" : "rgba(2,7,13,0.94)",
              color: active ? AMBER : TEXT_MUTE,
              border: `1px solid ${active ? AMBER : PANEL_LINE}`,
              clipPath: CHAMFER_SM,
              fontFamily: FONT_MONO, letterSpacing: "0.02em",
              boxShadow: active ? `inset 0 0 10px rgba(79,216,232,0.12), 0 0 12px -3px rgba(79,216,232,0.6)` : "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
            className="px-3 py-2 text-[12px] font-normal">{label}</button>
        );
      })}
    </div>
  );
}
function ScaleRow({ scale, setScale, scales = [1, 2, 3, 4, 5], extra, note, showDistanceRemark }) {
  const ydPerRing = scale * 1000;
  const nmPerRing = ydPerRing / YARDS_PER_NM;
  return (
    <div className="w-full max-w-md flex items-center justify-center gap-1.5 flex-wrap">
      <span style={{ color: TEXT_LIGHT_MUTE, fontFamily: FONT_HEAD }} className="text-[12px] uppercase tracking-wider mr-0.5">Scale</span>
      {scales.map((s) => {
        const active = scale === s;
        return (
          <button key={s} onClick={() => setScale(s)}
            style={{
              background: active ? "rgba(79,216,232,0.18)" : "rgba(2,7,13,0.94)",
              color: active ? "#fff" : TEXT_MUTE,
              border: `1px solid ${active ? AMBER : PANEL_LINE_BRIGHT}`,
              clipPath: CHAMFER_SM, fontFamily: FONT_MONO,
              boxShadow: active ? `inset 0 0 10px rgba(79,216,232,0.10), 0 0 10px -3px rgba(79,216,232,0.7)` : "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
            className="px-3 py-1.5 text-[12px] font-medium">{s}:1</button>
        );
      })}
      <span style={{ color: TEXT_LIGHT_MUTE, fontFamily: FONT_BODY }} className="text-[12px]">({extra})</span>
      {showDistanceRemark && (
        <span style={{ color: CRIMSON, fontFamily: FONT_BODY, border: `1px solid ${CRIMSON}`, clipPath: CHAMFER_SM }} className="text-[12px] w-full text-center py-1.5 mt-0.5 font-normal">
          ⚑ REMARK: 1 ช่อง (ring) = {ydPerRing.toLocaleString()} yds  (1:{ydPerRing.toLocaleString()}yds ≈ {nmPerRing.toFixed(2)} NM)
        </span>
      )}
      {note && <span style={{ color: AMBER, fontFamily: FONT_BODY }} className="text-[12px] w-full text-center opacity-90">{note}</span>}
    </div>
  );
}
function ButtonRow({ onClear, onRandom, onSolve, solveLabel = "คำนวณ" }) {
  return (
    <div className="flex gap-2 mt-4">
      <button onClick={onClear}
        style={{ background: "rgba(2,7,13,0.96)", color: TEXT_LIGHT_MUTE, border: `1px solid ${PANEL_LINE_BRIGHT}`, clipPath: CHAMFER_SM, fontFamily: FONT_MONO, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
        className="px-3.5 py-3 text-sm font-normal uppercase">Clear</button>
      {onRandom && (
        <button onClick={onRandom}
          style={{ background: "rgba(79,216,232,0.08)", color: TEXT_LIGHT, border: `1px solid ${PANEL_LINE_BRIGHT}`, clipPath: CHAMFER, fontFamily: FONT_MONO }}
          className="flex-1 py-3 text-sm font-normal tracking-wide">สุ่มโจทย์</button>
      )}
      <button onClick={onSolve}
        style={{ background: "linear-gradient(135deg, rgba(255,92,108,0.18), rgba(255,92,108,0.08))", color: "#FFDDE2", border: `1px solid ${CRIMSON}`, clipPath: CHAMFER, fontFamily: FONT_MONO, boxShadow: "0 0 12px -5px rgba(255,92,108,0.8)" }}
        className="flex-1 py-3 text-sm font-medium tracking-wide">▶ {solveLabel}</button>
    </div>
  );
}
const rowGrid4 = { display: "grid", gridTemplateColumns: "34px 1fr 1fr 1fr", columnGap: "8px", alignItems: "center" };
const rowGrid3 = { display: "grid", gridTemplateColumns: "34px 1fr 1fr", columnGap: "8px", alignItems: "center" };
function MiniLabel({ children }) { return <div style={{ color: TEXT_LIGHT_MUTE, fontSize: "12px", fontFamily: FONT_BODY, fontWeight: 400 }} className="tracking-wide text-center">{children}</div>; }
function PointName({ children }) { return <div style={{ color: AMBER, fontFamily: FONT_MONO, fontWeight: 600 }} className="text-sm">{children}</div>; }
function PointRow({ label, v1, v2, v3, onC1, onC2, onC3, p1, p2, p3 }) {
  return (
    <div style={rowGrid4} className="mb-1.5">
      <PointName>{label}</PointName>
      <Field value={v1} onChange={onC1} placeholder={p1} />
      <Field value={v2} onChange={onC2} placeholder={p2} />
      <Field value={v3} onChange={onC3} placeholder={p3} />
    </div>
  );
}
function TwoField({ l1, l2, v1, v2, onC1, onC2, p1, p2 }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "8px" }} className="mb-1">
        <MiniLabel>{l1}</MiniLabel><MiniLabel>{l2}</MiniLabel>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "8px" }}>
        <Field value={v1} onChange={onC1} placeholder={p1} />
        <Field value={v2} onChange={onC2} placeholder={p2} />
      </div>
    </>
  );
}
function RelativeWindField({ value, onChange, speedLabel = "ความเร็ว" }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.8fr 0.9fr", columnGap: "8px", rowGap: "5px" }}>
      <MiniLabel>กราบที่ลมมา</MiniLabel><MiniLabel>มุมจากหัวเรือ</MiniLabel><MiniLabel>{speedLabel}</MiniLabel>
      <div className="flex gap-1">
        {[["port", "ซ้าย"], ["starboard", "ขวา"]].map(([side, label]) => (
          <button key={side} type="button" onClick={() => onChange((p) => ({ ...p, side }))}
            style={{ background: value.side === side ? "rgba(79,216,232,0.18)" : "rgba(2,7,13,0.96)", color: value.side === side ? AMBER : TEXT_MUTE, border: `1px solid ${value.side === side ? AMBER : PANEL_LINE_BRIGHT}`, clipPath: CHAMFER_SM, fontFamily: FONT_BODY, boxShadow: value.side === side ? "0 0 10px -3px rgba(79,216,232,0.58)" : "inset 0 1px 0 rgba(255,255,255,0.04)" }}
            className="flex-1 min-w-0 px-1 py-2.5 text-[12px]">{label}</button>
        ))}
      </div>
      <Field value={value.angle} onChange={(e) => onChange((p) => ({ ...p, angle: e.target.value }))} placeholder="000-180°" />
      <Field value={value.speed} onChange={(e) => onChange((p) => ({ ...p, speed: e.target.value }))} placeholder="kt" />
    </div>
  );
}
function Field({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} inputMode="numeric"
      style={{ border: "1px solid rgba(79,216,232,0.42)", borderRadius: "4px", padding: "11px 7px", fontFamily: FONT_MONO, fontWeight: 400, color: TEXT_LIGHT, width: "100%", textAlign: "center", background: "#01050A", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.88), inset 0 0 0 1px rgba(255,255,255,0.015)", transition: "border-color 0.15s ease, box-shadow 0.15s ease" }} />
  );
}
function ResultItem({ label, value, accent, wide }) {
  if (wide) {
    return (
      <div style={{ gridColumn: "1 / span 2" }} className="flex flex-col items-center text-center gap-0.5 pt-1">
        <span style={{ color: TEXT_LIGHT_MUTE, fontFamily: FONT_BODY }} className="text-[12px] tracking-wide">{label}</span>
        <span style={{ color: accent ? CRIMSON : TEXT_LIGHT, fontFamily: FONT_MONO, fontWeight: 500 }} className="text-[15px]">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: TEXT_LIGHT_MUTE, fontFamily: FONT_BODY }} className="text-[12px] tracking-wide">{label}</span>
      <span style={{ color: accent ? CRIMSON : TEXT_LIGHT, fontFamily: FONT_MONO, fontWeight: 500 }} className="text-[15px]">{value}</span>
    </div>
  );
}
