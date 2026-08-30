import React, { useState, useRef } from "react";
import boardImg from "./assets/maneuvering-board.jpg";

/* ============================================================
   CONSTANTS & MATH — calibrated to the real board photo
   ============================================================ */
const VB_W = 1650;
const VB_H = 1275;
const CENTER = { x: 850.9, y: 550.7 };
const MAX_R_PX = 478;
const RING_COUNT = 20;
const PX_PER_RING = MAX_R_PX / RING_COUNT;
const YARDS_PER_NM = 2025.3718;

const PAPER = "#F5F1E4";
const INK = "#1E3A32";
const INK_SOFT = "#63766C";
const CRIMSON = "#A6392A";
const AMBER_DEEP = "#7A5019";
const AMBER = "#B8863B";
const BG = "#0B0F0D";
const PANEL = "#121B17";
const PANEL_LINE = "#243A31";
const TEXT_MUTE = "#8CA096";
const CARD = "#FCFBF6";

const FONT_HEAD = "'Oswald', sans-serif";
const FONT_BODY = "'IBM Plex Sans', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

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
  const s = String(hhmm).padStart(4, "0");
  const h = parseInt(s.slice(0, 2), 10);
  const m = parseInt(s.slice(2, 4), 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
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
function idealScaleForRangeYards(maxYards) {
  const thousandYd = maxYards / 1000;
  for (const s of [2, 3, 4, 5]) if (thousandYd / s <= RING_COUNT) return s;
  return 5;
}
function idealScaleForSpeed(maxKt) {
  for (const s of [2, 3, 4, 5]) if (maxKt / s <= RING_COUNT) return s;
  return 5;
}
function vAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function vSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function vLen(a) { return Math.hypot(a.x, a.y); }
function vBrg(a) { return mod360(toDeg(Math.atan2(a.x, a.y))); }

const IMG_DATA = boardImg;

/* ============================================================
   BOARD — real photo background, vectors overlaid & calibrated
   ============================================================ */
function BoardChrome({ children }) {
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full select-none" style={{ display: "block" }}>
      <defs>
        <clipPath id="boardClip"><circle cx={CENTER.x} cy={CENTER.y} r={MAX_R_PX} /></clipPath>
        <marker id="arrowAmber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={AMBER_DEEP} /></marker>
        <marker id="arrowCrimson" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={CRIMSON} /></marker>
        <marker id="arrowInk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={INK} /></marker>
      </defs>
      <image href={IMG_DATA} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" />
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
function ZoomModal({ z, children }) {
  if (!z.zoomed) return null;
  return (
    <div style={{ background: "#000" }} className="fixed inset-0 z-50 flex flex-col">
      <div className="flex justify-between items-center p-3" style={{ background: "#0B0F0D" }}>
        <span style={{ color: TEXT_MUTE }} className="text-xs">บีบนิ้ว/ลาก เพื่อซูมและเลื่อนดู</span>
        <button onClick={z.close} style={{ background: CRIMSON, color: "#fff" }} className="w-9 h-9 rounded-full font-bold flex items-center justify-center">✕</button>
      </div>
      <div className="flex-1 overflow-hidden touch-none" onTouchStart={z.onTouchStart} onTouchMove={z.onTouchMove} onTouchEnd={z.onTouchEnd} onWheel={z.onWheel} style={{ background: "#000" }}>
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "94%", transform: `translate(${z.zX}px, ${z.zY}px) scale(${z.zScale})`, transformOrigin: "center center" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB 1: Target Course / Speed + CPA / TCPA
   ============================================================ */
function TargetSpeedTab() {
  const [scale, setScale] = useState(2);
  const [m1, setM1] = useState({ time: "", bearing: "", range: "" });
  const [m2, setM2] = useState({ time: "", bearing: "", range: "" });
  const [own, setOwn] = useState({ course: "", speed: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const z = useZoomPan();

  const updatePoint = (setter) => (field) => (e) => setter((p) => ({ ...p, [field]: e.target.value }));
  const updateOwn = (field) => (e) => setOwn((p) => ({ ...p, [field]: e.target.value }));

  function solve() {
    setError("");
    const t1 = hhmmToMinutes(m1.time), t2 = hhmmToMinutes(m2.time);
    const b1 = parseFloat(m1.bearing), r1yd = parseFloat(m1.range);
    const b2 = parseFloat(m2.bearing), r2yd = parseFloat(m2.range);
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
    setScale(idealScaleForRangeYards(Math.max(r1yd, r2yd)));
    setResult({ P1, P2, er, em, DRM, SRM, cpaPoint, cpaRange, cpaBearing, tcpaDeltaMin, tcpaClockMin, targetCourse: vBrg(em), targetSpeed: vLen(em) });
  }
  function generateProblem() {
    const rc = () => Math.round(Math.random() * 359), rs = (a, b) => +(a + Math.random() * (b - a)).toFixed(1);
    const ownCourse = rc(), ownSpeed = rs(10, 20), tgtCourse = rc(), tgtSpeed = rs(8, 22);
    const t1min = 600 + Math.floor(Math.random() * 300), dt = 5 + Math.floor(Math.random() * 10), t2min = t1min + dt;
    const b1 = rc(), r1nm = rs(6, 16), P1 = polarToXY(b1, r1nm);
    const VrelSim = vSub(polarToXY(tgtCourse, tgtSpeed), polarToXY(ownCourse, ownSpeed));
    const P2 = { x: P1.x + (VrelSim.x * dt) / 60, y: P1.y + (VrelSim.y * dt) / 60 };
    const b2 = vBrg(P2), r2nm = vLen(P2);
    const toHHMM = (min) => String(Math.floor(min / 60) % 24).padStart(2, "0") + String(min % 60).padStart(2, "0");
    setM1({ time: toHHMM(t1min), bearing: String(Math.round(b1)).padStart(3, "0"), range: String(Math.round(r1nm * YARDS_PER_NM)) });
    setM2({ time: toHHMM(t2min), bearing: String(Math.round(b2)).padStart(3, "0"), range: String(Math.round(r2nm * YARDS_PER_NM)) });
    setOwn({ course: String(ownCourse).padStart(3, "0"), speed: String(ownSpeed) });
    setScale(idealScaleForRangeYards(Math.max(r1nm, r2nm) * YARDS_PER_NM));
    setResult(null); setError("");
  }
  function clearAll() {
    setM1({ time: "", bearing: "", range: "" }); setM2({ time: "", bearing: "", range: "" });
    setOwn({ course: "", speed: "" }); setResult(null); setError("");
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
      {rmlSeg && (() => { const a = scD(rmlSeg.a), b = scD(rmlSeg.b); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={CRIMSON} strokeWidth="2.2" strokeDasharray="9 7" opacity="0.75" />; })()}
      {(() => { const cp = scD(result.cpaPoint); return <line x1={CENTER.x} y1={CENTER.y} x2={cp.sx} y2={cp.sy} stroke={INK} strokeWidth="1.6" strokeDasharray="3 5" opacity="0.6" />; })()}
      {(() => { const cp = scD(result.cpaPoint); return <circle cx={cp.sx} cy={cp.sy} r="8" fill="none" stroke={INK} strokeWidth="2.4" />; })()}
      {(() => { const cp = scD(result.cpaPoint); return <text x={cp.sx} y={cp.sy - 14} fontSize="18" fontFamily={FONT_MONO} fill={INK} textAnchor="middle" fontWeight="700">M3</text>; })()}
      {(() => { const p = scD(result.P1); return <circle cx={p.sx} cy={p.sy} r="10" fill={CRIMSON} stroke={PAPER} strokeWidth="2.5" />; })()}
      {(() => { const p = scD(result.P1); return <text x={p.sx} y={p.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M1</text>; })()}
      {(() => { const p = scD(result.P2); return <circle cx={p.sx} cy={p.sy} r="10" fill={CRIMSON} stroke={PAPER} strokeWidth="2.5" />; })()}
      {(() => { const p = scD(result.P2); return <text x={p.sx} y={p.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M2</text>; })()}
      {(() => { const a = sc(result.er), b = sc(result.em); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={INK} strokeWidth="2.8" strokeDasharray="3 5" opacity="0.9" markerEnd="url(#arrowInk)" />; })()}
      {(() => { const a = sc(result.er); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={AMBER} strokeWidth="4.2" markerEnd="url(#arrowAmber)" />; })()}
      {(() => { const a = sc(result.er); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={AMBER_DEEP} textAnchor="middle" fontWeight="700">er</text>; })()}
      {(() => { const a = sc(result.em); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={CRIMSON} strokeWidth="4.2" markerEnd="url(#arrowCrimson)" />; })()}
      {(() => { const a = sc(result.em); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">em</text>; })()}
    </g>
  );

  return (
    <TabShell>
      <ScaleRow scale={scale} setScale={setScale} extra={`ระยะสูงสุด ${(RING_COUNT * scale * 1000).toLocaleString()} yds · ความเร็วสูงสุด ${RING_COUNT * scale} kt`} note='ระบบเลือกสเกลระยะให้อัตโนมัติหลังกด "คำนวณ"' />
      <BoardCard zOpen={z.open}><BoardChrome>{boardVectors}</BoardChrome></BoardCard>
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
        <div style={rowGrid4} className="mb-1.5"><div /><MiniLabel>เวลาพบเป้า</MiniLabel><MiniLabel>แบริ่ง</MiniLabel><MiniLabel>ระยะ</MiniLabel></div>
        <PointRow label="M1" v1={m1.time} v2={m1.bearing} v3={m1.range} onC1={updatePoint(setM1)("time")} onC2={updatePoint(setM1)("bearing")} onC3={updatePoint(setM1)("range")} p1="HHMM" p2="°T" p3="yds" />
        <PointRow label="M2" v1={m2.time} v2={m2.bearing} v3={m2.range} onC1={updatePoint(setM2)("time")} onC2={updatePoint(setM2)("bearing")} onC3={updatePoint(setM2)("range")} p1="HHMM" p2="°T" p3="yds" />
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
  const [mode, setMode] = useState("true"); // 'true' | 'desired'
  const [scale, setScale] = useState(3);
  const [own, setOwn] = useState({ course: "", speed: "" });
  const [rw, setRw] = useState({ from: "", speed: "" }); // apparent/relative wind measured on deck
  const [tw, setTw] = useState({ from: "", speed: "" }); // true wind (known, for 'desired' mode)
  const [desired, setDesired] = useState({ from: "", speed: "" }); // desired relative wind (for 'desired' mode)
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const z = useZoomPan();

  function solveTrueWind() {
    setError("");
    const Co = parseFloat(own.course), So = parseFloat(own.speed);
    const rwFrom = parseFloat(rw.from), rwSpeed = parseFloat(rw.speed);
    if ([Co, So, rwFrom, rwSpeed].some((v) => Number.isNaN(v))) { setError("กรอกข้อมูลให้ครบทุกช่อง"); setResult(null); return; }
    const er = polarToXY(Co, So);
    const awFromTrue = mod360(Co + rwFrom);
    const awTowardTrue = mod360(awFromTrue + 180);
    const awVec = polarToXY(awTowardTrue, rwSpeed);
    const ew = vAdd(er, awVec);
    const twFrom = mod360(vBrg(ew) + 180);
    const twSpeed = vLen(ew);
    setScale(idealScaleForSpeed(Math.max(So, rwSpeed, twSpeed)));
    setResult({ mode: "true", er, ew, awTip: ew, twFrom, twSpeed });
  }

  function solveDesired() {
    setError("");
    const twFrom = parseFloat(tw.from), twSpeed = parseFloat(tw.speed);
    const dFrom = parseFloat(desired.from), dSpeed = parseFloat(desired.speed);
    if ([twFrom, twSpeed, dFrom, dSpeed].some((v) => Number.isNaN(v))) { setError("กรอกข้อมูลให้ครบทุกช่อง"); setResult(null); return; }
    const delta = mod360(dFrom + 180); // offset of apparent-wind(toward) relative to ship's head
    const rad = toRad(delta);
    const cosD = Math.cos(rad), sinD = Math.sin(rad);
    const disc = twSpeed * twSpeed - dSpeed * dSpeed * sinD * sinD;
    if (disc < 0) { setError("ไม่มีคำตอบ — ลมจริงเบาเกินไปสำหรับลมสัมพัทธ์ที่ต้องการ"); setResult(null); return; }
    const sq = Math.sqrt(disc);
    const cands = [-dSpeed * cosD + sq, -dSpeed * cosD - sq].filter((s) => s > 0.05);
    if (cands.length === 0) { setError("ไม่มีคำตอบที่เป็นไปได้ (ความเร็วออกมาติดลบ)"); setResult(null); return; }
    const So = Math.min(...cands);
    const altSo = cands.length > 1 ? Math.max(...cands) : null;
    const wDirToward = mod360(twFrom + 180);
    const phi = toDeg(Math.atan2(dSpeed * sinD, So + dSpeed * cosD));
    const Co = mod360(wDirToward - phi);
    const er = polarToXY(Co, So);
    const awVec = polarToXY(mod360(Co + delta), dSpeed);
    const ew = vAdd(er, awVec);
    setScale(idealScaleForSpeed(Math.max(So, twSpeed, dSpeed, altSo || 0)));
    setResult({ mode: "desired", Co, So, altSo, er, ew, awTip: ew });
  }

  function clearAll() {
    setOwn({ course: "", speed: "" }); setRw({ from: "", speed: "" });
    setTw({ from: "", speed: "" }); setDesired({ from: "", speed: "" });
    setResult(null); setError("");
  }

  const sc = (xy) => xyToScreenSpeedScaled(xy.x, xy.y, scale);
  const boardVectors = result && (
    <g>
      {(() => { const a = sc(result.er), b = sc(result.awTip); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={INK} strokeWidth="2.8" strokeDasharray="3 5" opacity="0.9" markerEnd="url(#arrowInk)" />; })()}
      {(() => { const a = sc(result.er); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={AMBER} strokeWidth="4.2" markerEnd="url(#arrowAmber)" />; })()}
      {(() => { const a = sc(result.er); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={AMBER_DEEP} textAnchor="middle" fontWeight="700">er</text>; })()}
      {(() => { const a = sc(result.ew); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={CRIMSON} strokeWidth="4.2" markerEnd="url(#arrowCrimson)" />; })()}
      {(() => { const a = sc(result.ew); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">ew</text>; })()}
    </g>
  );

  return (
    <TabShell>
      <ModeRow options={[["true", "หา True Wind"], ["desired", "เข็มรับลม (ฮ./บิน)"]]} value={mode} onChange={(v) => { setMode(v); setResult(null); setError(""); }} />
      <ScaleRow scale={scale} setScale={setScale} extra={`ความเร็วสูงสุด ${RING_COUNT * scale} kt`} note='ระบบเลือกสเกลให้อัตโนมัติหลังคำนวณ' />
      <BoardCard zOpen={z.open}><BoardChrome>{boardVectors}</BoardChrome></BoardCard>

      <ResultCard>
        {result && result.mode === "true" && (
          <BigAnswer>ลมจริงมาจาก <Accent>{fmtBrg(result.twFrom)}</Accent> ความเร็ว <Accent>{fmt(result.twSpeed)} นอต</Accent></BigAnswer>
        )}
        {result && result.mode === "desired" && (
          <>
            <BigAnswer>เดินเข็ม <Accent>{fmtBrg(result.Co)}</Accent> ความเร็ว <Accent>{fmt(result.So)} นอต</Accent></BigAnswer>
            {result.altSo && <div style={{ color: INK_SOFT }} className="text-xs text-center mt-1">(อีกคำตอบที่เป็นไปได้: {fmt(result.altSo)} นอต ที่เข็มอื่น — ระบบเลือกความเร็วต่ำกว่าให้)</div>}
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
            <SectionLabel>ลมที่วัดได้บนดาดฟ้า (Relative Wind)</SectionLabel>
            <TwoField l1="ทิศลมมา (สัมพัทธ์)" l2="ความเร็ว" v1={rw.from} v2={rw.speed} onC1={(e) => setRw((p) => ({ ...p, from: e.target.value }))} onC2={(e) => setRw((p) => ({ ...p, speed: e.target.value }))} p1="°rel" p2="kt" />
            <ButtonRow onClear={clearAll} onSolve={solveTrueWind} solveLabel="หา True Wind" />
          </>
        ) : (
          <>
            <SectionLabel>ลมจริง (True Wind) ที่ทราบอยู่แล้ว</SectionLabel>
            <TwoField l1="ทิศลมมา" l2="ความเร็ว" v1={tw.from} v2={tw.speed} onC1={(e) => setTw((p) => ({ ...p, from: e.target.value }))} onC2={(e) => setTw((p) => ({ ...p, speed: e.target.value }))} p1="°T" p2="kt" />
            <SubDivider />
            <SectionLabel>ลมข้ามดาดฟ้าที่ต้องการ (Desired Relative Wind)</SectionLabel>
            <TwoField l1="ทิศสัมพัทธ์ที่ต้องการ" l2="ความเร็วที่ต้องการ" v1={desired.from} v2={desired.speed} onC1={(e) => setDesired((p) => ({ ...p, from: e.target.value }))} onC2={(e) => setDesired((p) => ({ ...p, speed: e.target.value }))} p1="°rel" p2="kt" />
            <ButtonRow onClear={clearAll} onSolve={solveDesired} solveLabel="หาเข็ม/ความเร็ว" />
          </>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </InputCard>
      <ZoomModal z={z}><BoardChrome>{boardVectors}</BoardChrome></ZoomModal>
    </TabShell>
  );
}

/* ============================================================
   TAB 3: Station Keeping (Changing Station)
   ============================================================ */
function StationTab() {
  const [mode, setMode] = useState("byTime"); // 'byTime' | 'byCourse' | 'bySpeed' | 'minSpeed'
  const [centerMode, setCenterMode] = useState("ownship"); // 'ownship' | 'guide'
  const [scale, setScale] = useState(2);
  const [guide, setGuide] = useState({ course: "", speed: "" });
  const [m1, setM1] = useState({ bearing: "", range: "" });
  const [m2, setM2] = useState({ bearing: "", range: "" });
  const [timeMinInput, setTimeMinInput] = useState("");
  const [courseInput, setCourseInput] = useState("");
  const [speedInput, setSpeedInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const z = useZoomPan();

  function baseParse() {
    const Cg = parseFloat(guide.course), Sg = parseFloat(guide.speed);
    const b1 = parseFloat(m1.bearing), r1yd = parseFloat(m1.range);
    const b2 = parseFloat(m2.bearing), r2yd = parseFloat(m2.range);
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
    setScale(Math.max(idealScaleForRangeYards(Math.max(r1yd, r2yd)), idealScaleForSpeed(Math.max(So, Sg))));
    setResult({ P1, P2, em, er, Co, So, timeMin, altNote });
  }

  function clearAll() {
    setGuide({ course: "", speed: "" }); setM1({ bearing: "", range: "" }); setM2({ bearing: "", range: "" });
    setTimeMinInput(""); setCourseInput(""); setSpeedInput(""); setResult(null); setError("");
  }

  const sc = (xy) => xyToScreenSpeedScaled(xy.x, xy.y, scale);
  const scD = (xy) => xyToScreenDistanceScaled(xy.x, xy.y, scale);
  const centerLabel = centerMode === "ownship" ? "เรือเรา" : "GUIDE";
  const boardVectors = result && (
    <g>
      {(() => { const a = scD(result.P1), b = scD(result.P2); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={CRIMSON} strokeWidth="2.2" strokeDasharray="9 7" opacity="0.75" />; })()}
      {(() => { const p = scD(result.P1); return <circle cx={p.sx} cy={p.sy} r="10" fill={CRIMSON} stroke={PAPER} strokeWidth="2.5" />; })()}
      {(() => { const p = scD(result.P1); return <text x={p.sx} y={p.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M1</text>; })()}
      {(() => { const p = scD(result.P2); return <circle cx={p.sx} cy={p.sy} r="10" fill={CRIMSON} stroke={PAPER} strokeWidth="2.5" />; })()}
      {(() => { const p = scD(result.P2); return <text x={p.sx} y={p.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M2</text>; })()}
      {(() => { const a = sc(result.er), b = sc(result.em); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={INK} strokeWidth="2.8" strokeDasharray="3 5" opacity="0.9" markerEnd="url(#arrowInk)" />; })()}
      {(() => { const a = sc(result.er); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={AMBER} strokeWidth="4.2" markerEnd="url(#arrowAmber)" />; })()}
      {(() => { const a = sc(result.er); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={AMBER_DEEP} textAnchor="middle" fontWeight="700">er</text>; })()}
      {(() => { const a = sc(result.em); return <line x1={CENTER.x} y1={CENTER.y} x2={a.sx} y2={a.sy} stroke={CRIMSON} strokeWidth="4.2" markerEnd="url(#arrowCrimson)" />; })()}
      {(() => { const a = sc(result.em); return <text x={a.sx} y={a.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">em</text>; })()}
      <text x={CENTER.x} y={CENTER.y + 26} fontSize="13" fontFamily={FONT_MONO} fill={INK} textAnchor="middle" fontWeight="700">{centerLabel}</text>
    </g>
  );

  return (
    <TabShell>
      <ModeRow options={[["ownship", "เรือเราอยู่ศูนย์กลาง"], ["guide", "Guide อยู่ศูนย์กลาง"]]} value={centerMode} onChange={(v) => { setCenterMode(v); setResult(null); setError(""); }} />
      <ModeRow options={[["byTime", "รู้เวลา"], ["byCourse", "รู้เข็ม"], ["bySpeed", "รู้ความเร็ว"], ["minSpeed", "ความเร็วต่ำสุด"]]} value={mode} onChange={(v) => { setMode(v); setResult(null); setError(""); }} />
      <ScaleRow scale={scale} setScale={setScale} extra={`ระยะสูงสุด ${(RING_COUNT * scale * 1000).toLocaleString()} yds`} note='ระบบเลือกสเกลให้อัตโนมัติหลังคำนวณ' />
      <BoardCard zOpen={z.open}><BoardChrome>{boardVectors}</BoardChrome></BoardCard>

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
        <div style={rowGrid3} className="mb-1.5"><div /><MiniLabel>แบริ่ง</MiniLabel><MiniLabel>ระยะ</MiniLabel></div>
        <div style={rowGrid3} className="items-center mb-1.5"><PointName>M1</PointName><Field value={m1.bearing} onChange={(e) => setM1((p) => ({ ...p, bearing: e.target.value }))} placeholder="°T" /><Field value={m1.range} onChange={(e) => setM1((p) => ({ ...p, range: e.target.value }))} placeholder="yds" /></div>
        <div style={rowGrid3} className="items-center"><PointName>M2</PointName><Field value={m2.bearing} onChange={(e) => setM2((p) => ({ ...p, bearing: e.target.value }))} placeholder="°T" /><Field value={m2.range} onChange={(e) => setM2((p) => ({ ...p, range: e.target.value }))} placeholder="yds" /></div>
        <SubDivider />
        {mode === "byTime" && (
          <>
            <SectionLabel>เวลาที่ต้องการใช้ให้ถึงสถานีใหม่</SectionLabel>
            <Field value={timeMinInput} onChange={(e) => setTimeMinInput(e.target.value)} placeholder="นาที" />
          </>
        )}
        {mode === "byCourse" && (
          <>
            <SectionLabel>เข็มที่จะใช้เดิน</SectionLabel>
            <Field value={courseInput} onChange={(e) => setCourseInput(e.target.value)} placeholder="°T" />
          </>
        )}
        {mode === "bySpeed" && (
          <>
            <SectionLabel>ความเร็วที่จะใช้เดิน</SectionLabel>
            <Field value={speedInput} onChange={(e) => setSpeedInput(e.target.value)} placeholder="kt" />
          </>
        )}
        {mode === "minSpeed" && <div style={{ color: INK_SOFT }} className="text-xs">ระบบจะหาเข็ม+ความเร็วต่ำสุดที่พาไปสถานีใหม่ได้ให้เอง</div>}
        <ButtonRow onClear={clearAll} onSolve={solve} solveLabel="คำนวณ" />
        {error && <ErrorText>{error}</ErrorText>}
      </InputCard>
      <ZoomModal z={z}><BoardChrome>{boardVectors}</BoardChrome></ZoomModal>
    </TabShell>
  );
}

/* ============================================================
   APP — tab switcher
   ============================================================ */
export default function App() {
  const [tab, setTab] = useState("target");
  const tabs = [
    ["target", "เข็ม/ความเร็วเป้า"],
    ["wind", "ปัญหาลม"],
    ["station", "เข้าสถานี"],
  ];
  return (
    <div
      style={{
        background: BG,
        fontFamily: FONT_BODY,
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehavior: "none",
      }}
      className="w-full flex flex-col items-center"
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        ::placeholder { color: #B7BEC3; opacity: 1; }
        button { transition: opacity 0.15s ease, transform 0.1s ease; }
        button:active { transform: scale(0.97); }
        input { font-size: 16px !important; }
      `}</style>
      <div className="w-full max-w-md flex gap-1 px-4 pt-4">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: tab === id ? PANEL : "transparent", color: tab === id ? "#E8B04B" : TEXT_MUTE, border: `1px solid ${tab === id ? PANEL_LINE : "transparent"}` }}
            className="flex-1 text-[11px] px-2 py-2 rounded-t-lg font-semibold">{label}</button>
        ))}
      </div>
      {tab === "target" && <TargetSpeedTab />}
      {tab === "wind" && <WindTab />}
      {tab === "station" && <StationTab />}
    </div>
  );
}

/* ============================================================
   Shared layout pieces
   ============================================================ */
function TabShell({ children }) {
  return <div className="w-full flex flex-col items-center p-4 gap-4">{children}</div>;
}
function BoardCard({ children, zOpen }) {
  return (
    <div style={{ background: PAPER }} className="w-full max-w-md rounded-xl p-2 shadow-lg relative">
      <button onClick={zOpen} style={{ background: "rgba(30,58,50,0.88)", color: "#fff" }} className="absolute top-3 right-3 z-10 text-[11px] px-2.5 py-1.5 rounded-md font-medium">⤢ ขยาย / ซูม</button>
      {children}
    </div>
  );
}
function ResultCard({ children }) {
  return <div style={{ background: PAPER }} className="w-full max-w-md rounded-xl p-4 shadow-lg">{children}</div>;
}
function InputCard({ children }) {
  return <div style={{ background: CARD }} className="w-full max-w-md rounded-xl p-4 shadow-lg">{children}</div>;
}
function EmptyNote() {
  return <div style={{ color: INK_SOFT }} className="text-sm text-center py-2">กรอกข้อมูลด้านล่างแล้วกด "คำนวณ" เพื่อดูคำตอบ</div>;
}
function BigAnswer({ children }) {
  return <div style={{ color: INK, fontFamily: FONT_MONO, fontWeight: 700 }} className="text-base text-center mb-1">{children}</div>;
}
function Accent({ children }) {
  return <span style={{ color: CRIMSON }}>{children}</span>;
}
function ResultGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: "8px", columnGap: "12px", borderTop: "1px solid #DCD6C2", paddingTop: "10px", marginTop: "8px" }} className="text-sm">{children}</div>;
}
function SectionLabel({ children }) {
  return <div style={{ color: "#8B98A3", fontFamily: FONT_HEAD, letterSpacing: "0.08em" }} className="text-[11px] uppercase mb-2">{children}</div>;
}
function SubDivider() {
  return <div style={{ borderTop: "1px solid #E7E2D0", marginTop: "12px", paddingTop: "12px" }} />;
}
function ErrorText({ children }) {
  return <div style={{ color: CRIMSON }} className="text-xs mt-2.5">{children}</div>;
}
function ModeRow({ options, value, onChange }) {
  return (
    <div className="w-full max-w-md flex gap-2 flex-wrap justify-center">
      {options.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          style={{ background: value === id ? "#3B5A6B" : PANEL, color: value === id ? "#fff" : TEXT_MUTE, border: `1px solid ${value === id ? "#3B5A6B" : PANEL_LINE}` }}
          className="px-3 py-1.5 rounded-full text-xs font-semibold">{label}</button>
      ))}
    </div>
  );
}
function ScaleRow({ scale, setScale, extra, note }) {
  return (
    <div className="w-full max-w-md flex items-center justify-center gap-2 flex-wrap">
      <span style={{ color: TEXT_MUTE }} className="text-xs uppercase tracking-wide">Scale</span>
      {[2, 3, 4, 5].map((s) => (
        <button key={s} onClick={() => setScale(s)}
          style={{ background: scale === s ? CRIMSON : PANEL, color: scale === s ? "#fff" : TEXT_MUTE, border: `1px solid ${scale === s ? CRIMSON : PANEL_LINE}` }}
          className="px-3 py-1 rounded-full text-xs font-semibold">{s}:1</button>
      ))}
      <span style={{ color: TEXT_MUTE }} className="text-[10px]">({extra})</span>
      {note && <span style={{ color: "#5C8A6E" }} className="text-[10px] w-full text-center">{note}</span>}
    </div>
  );
}
function ButtonRow({ onClear, onRandom, onSolve, solveLabel = "คำนวณ" }) {
  return (
    <div className="flex gap-2 mt-4">
      <button onClick={onClear} style={{ background: "#EDEAE0", color: "#5C6A63" }} className="px-3 py-2.5 rounded-lg text-sm font-medium">ล้าง</button>
      {onRandom && <button onClick={onRandom} style={{ background: "#3B5A6B", color: "#fff" }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold">สุ่มโจทย์</button>}
      <button onClick={onSolve} style={{ background: "#3F7A4C", color: "#fff" }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold">{solveLabel}</button>
    </div>
  );
}
const rowGrid4 = { display: "grid", gridTemplateColumns: "34px 1fr 1fr 1fr", columnGap: "8px", alignItems: "center" };
const rowGrid3 = { display: "grid", gridTemplateColumns: "34px 1fr 1fr", columnGap: "8px", alignItems: "center" };
function MiniLabel({ children }) { return <div style={{ color: "#9AA5AC", fontSize: "9.5px", fontFamily: FONT_BODY }} className="uppercase tracking-wide text-center">{children}</div>; }
function PointName({ children }) { return <div style={{ color: "#2B2B2B", fontFamily: FONT_MONO, fontWeight: 700 }} className="text-xs">{children}</div>; }
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
function Field({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} inputMode="numeric"
      style={{ border: "1px solid #D8D2C0", borderRadius: "7px", padding: "8px 5px", fontFamily: FONT_MONO, color: "#2B2B2B", width: "100%", textAlign: "center", background: "#fff" }} />
  );
}
function ResultItem({ label, value, accent, wide }) {
  if (wide) {
    return (
      <div style={{ gridColumn: "1 / span 2" }} className="flex flex-col items-center text-center gap-0.5 pt-1">
        <span style={{ color: INK_SOFT }} className="text-xs">{label}</span>
        <span style={{ color: accent ? CRIMSON : INK, fontFamily: FONT_MONO, fontWeight: 700 }} className="text-sm">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: INK_SOFT }} className="text-xs">{label}</span>
      <span style={{ color: accent ? CRIMSON : INK, fontFamily: FONT_MONO, fontWeight: 700 }} className="text-sm">{value}</span>
    </div>
  );
}
