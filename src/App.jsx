import React, { useState, useRef } from "react";
import boardImg from "./assets/maneuvering-board.jpg";

/* ============================================================
   CONSTANTS & MATH — calibrated to the real board photo
   (center & outer-ring radius detected from the actual scan)
   ============================================================ */
const VB_W = 1650;
const VB_H = 1275;
const CENTER = { x: 850.9, y: 550.7 };
const MAX_R_PX = 478;
const RING_COUNT = 20; // ยืนยันจากภาพจริง: 2:1 ที่วงนอกสุด = 40 → 40/2 = 20 วง
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

const FONT_HEAD = "'Oswald', sans-serif";
const FONT_BODY = "'IBM Plex Sans', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const mod360 = (d) => ((d % 360) + 360) % 360;
const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const fmtBrg = (n) => (Number.isFinite(n) ? String(Math.round(mod360(n))).padStart(3, "0") + "°" : "—°");
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
function xyToScreenScaled(x, y, scale) {
  const { bearing, range } = xyToPolar(x, y);
  return polarValueToScreen(bearing, range, scale);
}

const IMG_DATA = boardImg;

/* ============================================================
   BOARD — real photo as background, vectors overlaid & calibrated
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
   MAIN APP
   ============================================================ */
export default function App() {
  const [scale, setScale] = useState(2);
  const [m1, setM1] = useState({ time: "", bearing: "", range: "" });
  const [m2, setM2] = useState({ time: "", bearing: "", range: "" });
  const [own, setOwn] = useState({ course: "", speed: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [zoomed, setZoomed] = useState(false);

  // pinch/pan state for the zoom modal
  const [zScale, setZScale] = useState(1);
  const [zX, setZX] = useState(0);
  const [zY, setZY] = useState(0);
  const pinch = useRef({ dist: 0, startScale: 1 });
  const pan = useRef({ x: 0, y: 0, active: false });

  const updatePoint = (setter) => (field) => (e) => setter((prev) => ({ ...prev, [field]: e.target.value }));
  const updateOwn = (field) => (e) => setOwn((prev) => ({ ...prev, [field]: e.target.value }));

  function solve() {
    setError("");
    const t1 = hhmmToMinutes(m1.time);
    const t2 = hhmmToMinutes(m2.time);
    const b1 = parseFloat(m1.bearing);
    const r1yd = parseFloat(m1.range);
    const b2 = parseFloat(m2.bearing);
    const r2yd = parseFloat(m2.range);
    const Co = parseFloat(own.course);
    const So = parseFloat(own.speed);
    if ([t1, t2, b1, r1yd, b2, r2yd, Co, So].some((v) => Number.isNaN(v))) {
      setError("กรอกข้อมูลให้ครบทุกช่อง (ตรวจรูปแบบเวลา HHMM ด้วย)"); setResult(null); return;
    }
    const dt = t2 - t1;
    if (dt <= 0) { setError("เวลา M2 ต้องอยู่หลัง M1"); setResult(null); return; }

    const P1 = polarToXY(b1, r1yd / YARDS_PER_NM);
    const P2 = polarToXY(b2, r2yd / YARDS_PER_NM);
    const Vrel = { x: ((P2.x - P1.x) / dt) * 60, y: ((P2.y - P1.y) / dt) * 60 };
    const DRM = mod360(toDeg(Math.atan2(Vrel.x, Vrel.y)));
    const SRM = Math.hypot(Vrel.x, Vrel.y);

    const denom = Vrel.x * Vrel.x + Vrel.y * Vrel.y;
    const tCpaHours = denom > 0 ? -(P2.x * Vrel.x + P2.y * Vrel.y) / denom : NaN;
    const cpaPoint = { x: P2.x + Vrel.x * tCpaHours, y: P2.y + Vrel.y * tCpaHours };
    const cpaRange = Math.hypot(cpaPoint.x, cpaPoint.y);
    const cpaBearing = mod360(toDeg(Math.atan2(cpaPoint.x, cpaPoint.y)));
    const tcpaMin = t2 + tCpaHours * 60;

    const er = polarToXY(Co, So);
    const em = { x: er.x + Vrel.x, y: er.y + Vrel.y };
    const targetCourse = mod360(toDeg(Math.atan2(em.x, em.y)));
    const targetSpeed = Math.hypot(em.x, em.y);

    setResult({ P1, P2, er, em, DRM, SRM, cpaPoint, cpaRange, cpaBearing, tcpaMin, targetCourse, targetSpeed });
  }

  function generateProblem() {
    const randCourse = () => Math.round(Math.random() * 359);
    const randSpeed = (min, max) => +(min + Math.random() * (max - min)).toFixed(1);
    const ownCourse = randCourse(), ownSpeed = randSpeed(10, 20);
    const tgtCourse = randCourse(), tgtSpeed = randSpeed(8, 22);
    const t1min = 600 + Math.floor(Math.random() * 300);
    const dt = 5 + Math.floor(Math.random() * 10);
    const t2min = t1min + dt;
    const b1 = randCourse(), r1nm = randSpeed(6, 16);
    const P1 = polarToXY(b1, r1nm);
    const erV = polarToXY(ownCourse, ownSpeed);
    const emV = polarToXY(tgtCourse, tgtSpeed);
    const VrelSim = { x: emV.x - erV.x, y: emV.y - erV.y };
    const P2 = { x: P1.x + (VrelSim.x * dt) / 60, y: P1.y + (VrelSim.y * dt) / 60 };
    const b2 = mod360(toDeg(Math.atan2(P2.x, P2.y)));
    const r2nm = Math.hypot(P2.x, P2.y);
    const toHHMM = (min) => String(Math.floor(min / 60) % 24).padStart(2, "0") + String(min % 60).padStart(2, "0");
    setM1({ time: toHHMM(t1min), bearing: String(Math.round(b1)).padStart(3, "0"), range: String(Math.round(r1nm * YARDS_PER_NM)) });
    setM2({ time: toHHMM(t2min), bearing: String(Math.round(b2)).padStart(3, "0"), range: String(Math.round(r2nm * YARDS_PER_NM)) });
    setOwn({ course: String(ownCourse).padStart(3, "0"), speed: String(ownSpeed) });
    setResult(null); setError("");
  }

  function clearAll() {
    setM1({ time: "", bearing: "", range: "" });
    setM2({ time: "", bearing: "", range: "" });
    setOwn({ course: "", speed: "" });
    setResult(null); setError("");
  }

  const rmlSeg = result ? (() => {
    const dir = { x: result.P2.x - result.P1.x, y: result.P2.y - result.P1.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const u = { x: dir.x / len, y: dir.y / len };
    const far = 2 * RING_COUNT * scale;
    return { a: { x: result.P2.x - u.x * far, y: result.P2.y - u.y * far }, b: { x: result.P2.x + u.x * far, y: result.P2.y + u.y * far } };
  })() : null;
  const sc = (xy) => xyToScreenScaled(xy.x, xy.y, scale);

  const boardVectors = result && (
    <g>
      {rmlSeg && (() => { const a = sc(rmlSeg.a), b = sc(rmlSeg.b); return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={CRIMSON} strokeWidth="2.2" strokeDasharray="9 7" opacity="0.75" />; })()}
      {(() => { const cp = sc(result.cpaPoint); return <line x1={CENTER.x} y1={CENTER.y} x2={cp.sx} y2={cp.sy} stroke={INK} strokeWidth="1.6" strokeDasharray="3 5" opacity="0.6" />; })()}
      {(() => { const cp = sc(result.cpaPoint); return <circle cx={cp.sx} cy={cp.sy} r="8" fill="none" stroke={INK} strokeWidth="2.4" />; })()}
      {(() => { const p1s = sc(result.P1); return <circle cx={p1s.sx} cy={p1s.sy} r="10" fill={CRIMSON} stroke={PAPER} strokeWidth="2.5" />; })()}
      {(() => { const p1s = sc(result.P1); return <text x={p1s.sx} y={p1s.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M1</text>; })()}
      {(() => { const p2s = sc(result.P2); return <circle cx={p2s.sx} cy={p2s.sy} r="10" fill={CRIMSON} stroke={PAPER} strokeWidth="2.5" />; })()}
      {(() => { const p2s = sc(result.P2); return <text x={p2s.sx} y={p2s.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">M2</text>; })()}
      {(() => { const erS = sc(result.er), emS = sc(result.em); return <line x1={erS.sx} y1={erS.sy} x2={emS.sx} y2={emS.sy} stroke={INK} strokeWidth="2.8" strokeDasharray="3 5" opacity="0.9" markerEnd="url(#arrowInk)" />; })()}
      {(() => { const erS = sc(result.er); return <line x1={CENTER.x} y1={CENTER.y} x2={erS.sx} y2={erS.sy} stroke={AMBER} strokeWidth="4.2" markerEnd="url(#arrowAmber)" />; })()}
      {(() => { const erS = sc(result.er); return <text x={erS.sx} y={erS.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={AMBER_DEEP} textAnchor="middle" fontWeight="700">er</text>; })()}
      {(() => { const emS = sc(result.em); return <line x1={CENTER.x} y1={CENTER.y} x2={emS.sx} y2={emS.sy} stroke={CRIMSON} strokeWidth="4.2" markerEnd="url(#arrowCrimson)" />; })()}
      {(() => { const emS = sc(result.em); return <text x={emS.sx} y={emS.sy - 17} fontSize="20" fontFamily={FONT_MONO} fill={CRIMSON} textAnchor="middle" fontWeight="700">em</text>; })()}
    </g>
  );

  /* ---- pinch/pan handlers (modal only) ---- */
  function dist(touches) {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      pinch.current = { dist: dist(e.touches), startScale: zScale };
    } else if (e.touches.length === 1) {
      pan.current = { x: e.touches[0].clientX - zX, y: e.touches[0].clientY - zY, active: true };
    }
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const newDist = dist(e.touches);
      const next = Math.min(Math.max((pinch.current.startScale * newDist) / pinch.current.dist, 1), 6);
      setZScale(next);
    } else if (e.touches.length === 1 && pan.current.active) {
      setZX(e.touches[0].clientX - pan.current.x);
      setZY(e.touches[0].clientY - pan.current.y);
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length === 0) pan.current.active = false;
  }
  function onWheel(e) {
    e.preventDefault();
    const next = Math.min(Math.max(zScale - e.deltaY * 0.0015, 1), 6);
    setZScale(next);
  }
  function openZoom() { setZScale(1); setZX(0); setZY(0); setZoomed(true); }

  return (
    <div style={{ background: BG, fontFamily: FONT_BODY, minHeight: "100vh" }} className="w-full flex flex-col items-center p-4 gap-4">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        ::placeholder { color: #B7BEC3; opacity: 1; }
        button { transition: opacity 0.15s ease, transform 0.1s ease; }
        button:active { transform: scale(0.97); }
        input { font-size: 16px !important; }
      `}</style>

      <header className="w-full max-w-md text-center pt-1">
        <div style={{ fontFamily: FONT_HEAD, letterSpacing: "0.12em", color: "#E8B04B" }} className="text-xl uppercase">Target Course &amp; Speed</div>
        <div style={{ color: TEXT_MUTE }} className="text-xs mt-0.5">พร้อม CPA · TCPA — Maneuvering Board Solver</div>
      </header>

      {/* scale selector */}
      <div className="w-full max-w-md flex items-center justify-center gap-2 flex-wrap">
        <span style={{ color: TEXT_MUTE }} className="text-xs uppercase tracking-wide">Scale</span>
        {[2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => setScale(s)}
            style={{ background: scale === s ? CRIMSON : PANEL, color: scale === s ? "#fff" : TEXT_MUTE, border: `1px solid ${scale === s ? CRIMSON : PANEL_LINE}` }}
            className="px-3 py-1 rounded-full text-xs font-semibold">{s}:1</button>
        ))}
        <span style={{ color: TEXT_MUTE }} className="text-[10px]">(สูงสุด {RING_COUNT * scale} nm/kt)</span>
      </div>

      {/* ---- 1) BOARD (top) ---- */}
      <div style={{ background: PAPER }} className="w-full max-w-md rounded-xl p-2 shadow-lg relative">
        <button onClick={openZoom}
          style={{ background: "rgba(30,58,50,0.88)", color: "#fff" }}
          className="absolute top-3 right-3 z-10 text-[11px] px-2.5 py-1.5 rounded-md font-medium">
          ⤢ ขยาย / ซูม
        </button>
        <BoardChrome>{boardVectors}</BoardChrome>
      </div>

      {/* ---- 2) RESULTS ---- */}
      <div style={{ background: PAPER }} className="w-full max-w-md rounded-xl p-4 shadow-lg">
        {result ? (
          <>
            <div style={{ color: INK, fontFamily: FONT_MONO, fontWeight: 700 }} className="text-base text-center mb-3">
              เรือเป้าถือเข็ม <span style={{ color: CRIMSON }}>{fmtBrg(result.targetCourse)}</span>{" "}
              ความเร็ว <span style={{ color: CRIMSON }}>{fmt(result.targetSpeed)} นอต</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: "8px", columnGap: "12px", borderTop: "1px solid #DCD6C2", paddingTop: "10px" }} className="text-sm">
              <ResultItem label="DRM" value={fmtBrg(result.DRM)} />
              <ResultItem label="SRM" value={`${fmt(result.SRM)} kt`} />
              <ResultItem label="CPA Range" value={`${fmt(result.cpaRange)} nm`} accent />
              <ResultItem label="CPA Bearing" value={fmtBrg(result.cpaBearing)} accent />
              <ResultItem label="TCPA" value={`${fmt(result.tcpaMin, 0)} min`} accent />
            </div>
          </>
        ) : (
          <div style={{ color: INK_SOFT }} className="text-sm text-center py-2">กรอกข้อมูลด้านล่างแล้วกด "คำนวณ" เพื่อดูคำตอบ</div>
        )}
      </div>

      {/* ---- 3) INPUTS (bottom) ---- */}
      <div style={{ background: "#FCFBF6" }} className="w-full max-w-md rounded-xl p-4 shadow-lg">
        <div style={{ color: "#8B98A3", fontFamily: FONT_HEAD, letterSpacing: "0.08em" }} className="text-[11px] uppercase mb-3">Target Observations</div>
        <div style={rowGrid4} className="mb-1.5">
          <div /><MiniLabel>เวลาพบเป้า</MiniLabel><MiniLabel>แบริ่ง</MiniLabel><MiniLabel>ระยะ</MiniLabel>
        </div>
        <PointRow label="M1" v1={m1.time} v2={m1.bearing} v3={m1.range}
          onC1={updatePoint(setM1)("time")} onC2={updatePoint(setM1)("bearing")} onC3={updatePoint(setM1)("range")}
          p1="HHMM" p2="°T" p3="yds" />
        <PointRow label="M2" v1={m2.time} v2={m2.bearing} v3={m2.range}
          onC1={updatePoint(setM2)("time")} onC2={updatePoint(setM2)("bearing")} onC3={updatePoint(setM2)("range")}
          p1="HHMM" p2="°T" p3="yds" />

        <div style={{ borderTop: "1px solid #E7E2D0", marginTop: "12px", paddingTop: "12px" }}>
          <div style={{ color: "#8B98A3", fontFamily: FONT_HEAD, letterSpacing: "0.08em" }} className="text-[11px] uppercase mb-2">Own Ship</div>
          <div style={rowGrid3} className="mb-1.5">
            <div /><MiniLabel>เข็ม</MiniLabel><MiniLabel>ความเร็ว</MiniLabel>
          </div>
          <div style={rowGrid3} className="items-center">
            <PointName>R</PointName>
            <Field value={own.course} onChange={updateOwn("course")} placeholder="°T" />
            <Field value={own.speed} onChange={updateOwn("speed")} placeholder="kt" />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={clearAll} style={{ background: "#EDEAE0", color: "#5C6A63" }} className="px-3 py-2.5 rounded-lg text-sm font-medium">ล้าง</button>
          <button onClick={generateProblem} style={{ background: "#3B5A6B", color: "#fff" }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold">สุ่มโจทย์</button>
          <button onClick={solve} style={{ background: "#3F7A4C", color: "#fff" }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold">คำนวณ</button>
        </div>
        {error && <div style={{ color: CRIMSON }} className="text-xs mt-2.5">{error}</div>}
      </div>

      {/* ---- zoom modal (pinch & pan) ---- */}
      {zoomed && (
        <div
          style={{ background: "#000" }}
          className="fixed inset-0 z-50 flex flex-col"
        >
          <div className="flex justify-between items-center p-3" style={{ background: "#0B0F0D" }}>
            <span style={{ color: TEXT_MUTE }} className="text-xs">บีบนิ้ว/ลาก เพื่อซูมและเลื่อนดู</span>
            <button onClick={() => setZoomed(false)} style={{ background: CRIMSON, color: "#fff" }} className="w-9 h-9 rounded-full font-bold flex items-center justify-center">✕</button>
          </div>
          <div
            className="flex-1 overflow-hidden touch-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onWheel={onWheel}
            style={{ background: "#000" }}
          >
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "94%", transform: `translate(${zX}px, ${zY}px) scale(${zScale})`, transformOrigin: "center center" }}>
                <BoardChrome>{boardVectors}</BoardChrome>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   small UI pieces
   ============================================================ */
const rowGrid4 = { display: "grid", gridTemplateColumns: "34px 1fr 1fr 1fr", columnGap: "8px", alignItems: "center" };
const rowGrid3 = { display: "grid", gridTemplateColumns: "34px 1fr 1fr", columnGap: "8px", alignItems: "center" };

function MiniLabel({ children }) {
  return <div style={{ color: "#9AA5AC", fontSize: "9.5px", fontFamily: FONT_BODY }} className="uppercase tracking-wide text-center">{children}</div>;
}
function PointName({ children }) {
  return <div style={{ color: "#2B2B2B", fontFamily: FONT_MONO, fontWeight: 700 }} className="text-xs">{children}</div>;
}
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
function Field({ value, onChange, placeholder }) {
  return (
    <input
      value={value} onChange={onChange} placeholder={placeholder} inputMode="numeric"
      style={{ border: "1px solid #D8D2C0", borderRadius: "7px", padding: "8px 5px", fontFamily: FONT_MONO, color: "#2B2B2B", width: "100%", textAlign: "center", background: "#fff" }}
    />
  );
}
function ResultItem({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: INK_SOFT }} className="text-xs">{label}</span>
      <span style={{ color: accent ? CRIMSON : INK, fontFamily: FONT_MONO, fontWeight: 700 }} className="text-sm">{value}</span>
    </div>
  );
}
