// Original animated demonstrations for ASHA Move. Each demo is a short loop of key poses for a simple
// stick figure, face or hand, interpolated by joint angle so limbs keep their length. Every segment
// names the caption it belongs to, so captions and narration stay in step with the movement.
// These are illustrations drawn for ASHA, not recordings of a person and not clinical references.

export const DEMO_VERSION = "move-demo/1.0.0";

/** Ground line and segment lengths, in a 200 x 200 view box. */
export const GROUND = 186;
const L = { shin: 38, thigh: 38, trunk: 50, neck: 6, head: 9, upper: 27, fore: 25, toe: 13, heel: 4 };
const rad = (d) => (d * Math.PI) / 180;
const add = (p, len, deg, down = false) => ({ x: p.x + len * Math.sin(rad(deg)), y: p.y + (down ? 1 : -1) * len * Math.cos(rad(deg)) });

/** Two-link inverse kinematics: elbow position for a hand placed at `target`. */
function reach(shoulder, target, bend = 1) {
  const dx = target.x - shoulder.x, dy = target.y - shoulder.y;
  const d = Math.min(Math.hypot(dx, dy), L.upper + L.fore - 0.01);
  const a = Math.atan2(dy, dx);
  const cos = (L.upper ** 2 + d ** 2 - L.fore ** 2) / (2 * L.upper * d);
  const b = Math.acos(Math.max(-1, Math.min(1, cos)));
  const elbow = { x: shoulder.x + L.upper * Math.cos(a + bend * b), y: shoulder.y + L.upper * Math.sin(a + bend * b) };
  const hand = { x: shoulder.x + d * Math.cos(a), y: shoulder.y + d * Math.sin(a) };
  return { elbow, hand };
}

/**
 * Side view, facing right. Angles in degrees.
 * Feet anchored (default): ankle on the ground at `ax`; `shin` and `thigh` are measured from vertical
 * going up (positive leans right). Hip anchored (`hip: {x,y}`): `thighDown` from straight down
 * (positive is forward) and `knee` flexion bends the shin back.
 */
export function sideFigure(p) {
  let ankle, knee, hip;
  if (p.hip) {
    hip = { ...p.hip };
    knee = add(hip, L.thigh, p.thighDown ?? 0, true);
    ankle = add(knee, L.shin, (p.thighDown ?? 0) - (p.knee ?? 0), true);
  } else {
    ankle = { x: p.ax ?? 100, y: GROUND - 3 - (p.heel ?? 0) };
    knee = add(ankle, L.shin, p.shin ?? 0);
    hip = add(knee, L.thigh, p.thigh ?? 0);
  }
  const shoulder = add(hip, L.trunk, p.trunk ?? 0);
  const neck = add(shoulder, L.neck, p.trunk ?? 0);
  const head = add(neck, L.head, p.trunk ?? 0);
  let elbow, hand;
  if (p.hand) ({ elbow, hand } = reach(shoulder, p.hand, p.bend ?? 1));
  else {
    elbow = add(shoulder, L.upper, p.arm ?? 0, true);
    hand = add(elbow, L.fore, (p.arm ?? 0) + (p.elbow ?? 0), true);
  }
  const lift = p.heel ?? 0;
  const toe = { x: ankle.x + L.toe, y: p.hip ? ankle.y + 3 : GROUND };
  const heel = { x: ankle.x - L.heel, y: ankle.y + 3 - (p.hip ? 0 : lift * 0.2) };
  const out = { view: "side", head, neck, shoulder, elbow, hand, hip, knee, ankle, heel, toe };
  if (p.far) {
    const fk = add(hip, L.thigh, p.far.thighDown, true);
    const fa = add(fk, L.shin, p.far.thighDown - p.far.knee, true);
    out.farKnee = fk;
    out.farAnkle = fa;
    out.farToe = { x: fa.x + L.toe, y: Math.min(GROUND, fa.y + 3) };
  }
  return out;
}

/** Front view. `armL`/`armR` are abduction from the side (0 down, 90 shoulder height). */
export function frontFigure(p) {
  const cx = 100, hipY = 110 - (p.drop ?? 0), shrug = p.shrug ?? 0;
  const shoulderY = hipY - L.trunk - shrug;
  const sL = { x: cx - 16, y: shoulderY }, sR = { x: cx + 16, y: shoulderY };
  const arm = (s, deg, flex, dir) => {
    const e = { x: s.x + dir * L.upper * Math.sin(rad(deg)), y: s.y + L.upper * Math.cos(rad(deg)) };
    const h = { x: e.x + dir * L.fore * Math.sin(rad(deg + flex)), y: e.y + L.fore * Math.cos(rad(deg + flex)) };
    return [e, h];
  };
  const [eL, hL] = arm(sL, p.armL ?? 8, p.elbowL ?? 0, -1);
  const [eR, hR] = arm(sR, p.armR ?? 8, p.elbowR ?? 0, 1);
  const hipL = { x: cx - 10, y: hipY }, hipR = { x: cx + 10, y: hipY };
  const kneeL = { x: cx - 12, y: hipY + L.thigh }, kneeR = { x: cx + 12, y: hipY + L.thigh };
  const ankleL = { x: cx - 13, y: GROUND - 3 }, ankleR = { x: cx + 13, y: GROUND - 3 };
  return {
    view: "front",
    head: { x: cx, y: shoulderY - L.neck - L.head + shrug * 0.6 },
    neck: { x: cx, y: shoulderY - L.neck + shrug * 0.6 },
    shoulderL: sL, shoulderR: sR, elbowL: eL, elbowR: eR, handL: hL, handR: hR,
    hipL, hipR, kneeL, kneeR, ankleL, ankleR,
  };
}

/** Face parameters, each 0..1: smile, brow, puff, purse, jaw. */
export const faceFigure = (p) => ({ view: "face", smile: p.smile ?? 0, brow: p.brow ?? 0, puff: p.puff ?? 0, purse: p.purse ?? 0, jaw: p.jaw ?? 0 });
/** Hand: `open` 0 (closed) .. 1 (fingers spread). */
export const handFigure = (p) => ({ view: "hand", open: p.open ?? 0 });

const FIGURES = { side: sideFigure, front: frontFigure, face: faceFigure, hand: handFigure };

// ---- Key poses ----
const STAND = { shin: 0, thigh: 0, trunk: 0, arm: 4, elbow: 6 };
const SQUAT_LOW = { shin: 28, thigh: -62, trunk: 38, arm: 75, elbow: 0 };
const CHAIR_LOW = { shin: 22, thigh: -58, trunk: 34, arm: 70, elbow: 0 };
const SEATED = { shin: 8, thigh: -84, trunk: 8, arm: 20, elbow: 50 };
const SEATED_LEAN = { shin: 14, thigh: -84, trunk: 42, arm: 25, elbow: 30 };
const RISING = { shin: 16, thigh: -45, trunk: 38, arm: 22, elbow: 25 };
const WALL = { ax: 58, bend: 1 };
const lean = (deg, extra = {}) => ({ shin: deg, thigh: deg, trunk: deg, ...extra });

/**
 * Segment = move to `to` over `ms` (eased), showing caption `cap`. `key` marks the poses shown as a
 * still strip when motion is reduced. The loop wraps from the last pose back to the first.
 */
export const DEMOS = Object.freeze({
  arm_raise: {
    view: "front", props: [],
    segments: [
      { to: { armL: 8, armR: 8 }, ms: 1200, cap: 0, key: true },
      { to: { armL: 88, armR: 88 }, ms: 2200, cap: 1, key: true },
      { to: { armL: 88, armR: 88 }, ms: 900, cap: 2 },
      { to: { armL: 8, armR: 8 }, ms: 2400, cap: 3 },
    ],
  },
  squat: {
    view: "side", props: [],
    segments: [
      { to: STAND, ms: 1200, cap: 0, key: true },
      { to: SQUAT_LOW, ms: 2200, cap: 1, key: true },
      { to: SQUAT_LOW, ms: 500, cap: 1 },
      { to: STAND, ms: 2000, cap: 2 },
    ],
  },
  chair_squat: {
    view: "side", props: [{ type: "chair", x: 56, seat: 132, facing: 1 }],
    segments: [
      { to: STAND, ms: 1200, cap: 0, key: true },
      { to: CHAIR_LOW, ms: 2300, cap: 1, key: true },
      { to: CHAIR_LOW, ms: 500, cap: 1 },
      { to: STAND, ms: 2000, cap: 2 },
    ],
  },
  sit_to_stand: {
    view: "side", props: [{ type: "chair", x: 42, seat: 145, facing: 1 }],
    segments: [
      { to: SEATED, ms: 1200, cap: 0, key: true },
      { to: SEATED_LEAN, ms: 1000, cap: 1 },
      { to: RISING, ms: 900, cap: 1 },
      { to: STAND, ms: 1100, cap: 1, key: true },
      { to: STAND, ms: 700, cap: 2 },
      { to: RISING, ms: 1100, cap: 3 },
      { to: SEATED, ms: 1200, cap: 3 },
    ],
  },
  wall_pushup: {
    view: "side", props: [{ type: "wall", x: 142 }],
    segments: [
      { to: lean(18, { ...WALL, hand: { x: 140, y: 82 } }), ms: 1200, cap: 0, key: true },
      { to: lean(26, { ...WALL, hand: { x: 140, y: 82 } }), ms: 2000, cap: 1, key: true },
      { to: lean(18, { ...WALL, hand: { x: 140, y: 82 } }), ms: 2000, cap: 2 },
    ],
  },
  incline_pushup: {
    view: "side", props: [{ type: "table", x: 140, top: 130 }],
    segments: [
      { to: lean(42, { ax: 40, bend: 1, hand: { x: 152, y: 129 } }), ms: 1200, cap: 0, key: true },
      { to: lean(52, { ax: 40, bend: 1, hand: { x: 152, y: 129 } }), ms: 2000, cap: 1, key: true },
      { to: lean(42, { ax: 40, bend: 1, hand: { x: 152, y: 129 } }), ms: 2000, cap: 2 },
    ],
  },
  supported_plank: {
    view: "side", props: [{ type: "table", x: 140, top: 130 }],
    segments: [
      { to: lean(36, { ax: 54, bend: 1, hand: { x: 152, y: 129 } }), ms: 1500, cap: 0, key: true },
      { to: lean(44, { ax: 46, bend: 1, hand: { x: 152, y: 129 } }), ms: 1600, cap: 1, key: true },
      { to: lean(45, { ax: 46, bend: 1, hand: { x: 152, y: 129 } }), ms: 2200, cap: 2 },
      { to: lean(44, { ax: 46, bend: 1, hand: { x: 152, y: 129 } }), ms: 2200, cap: 2 },
      { to: lean(36, { ax: 54, bend: 1, hand: { x: 152, y: 129 } }), ms: 1500, cap: 3 },
    ],
  },
  heel_raise: {
    view: "side", props: [{ type: "chair", x: 122, seat: 140, facing: 1 }],
    segments: [
      { to: { ...STAND, ax: 96, hand: { x: 123, y: 101 } }, ms: 1200, cap: 0, key: true },
      { to: { ...STAND, ax: 96, heel: 11, hand: { x: 123, y: 101 } }, ms: 1700, cap: 1, key: true },
      { to: { ...STAND, ax: 96, heel: 11, hand: { x: 123, y: 101 } }, ms: 600, cap: 1 },
      { to: { ...STAND, ax: 96, hand: { x: 123, y: 101 } }, ms: 1900, cap: 2 },
    ],
  },
  lunge: {
    view: "side", props: [],
    segments: [
      { to: { ...STAND, ax: 112, far: { thighDown: -4, knee: 4 } }, ms: 1200, cap: 0, key: true },
      { to: { ax: 118, shin: 6, thigh: -22, trunk: 2, arm: 6, elbow: 6, far: { thighDown: -28, knee: 8 } }, ms: 1300, cap: 0 },
      { to: { ax: 118, shin: 14, thigh: -70, trunk: 4, arm: 6, elbow: 6, far: { thighDown: -12, knee: 74 } }, ms: 1900, cap: 1, key: true },
      { to: { ax: 118, shin: 6, thigh: -22, trunk: 2, arm: 6, elbow: 6, far: { thighDown: -28, knee: 8 } }, ms: 1700, cap: 2 },
      { to: { ...STAND, ax: 112, far: { thighDown: -4, knee: 4 } }, ms: 1200, cap: 2 },
    ],
  },
  bridge: {
    view: "side", props: [{ type: "mat" }],
    segments: [
      { to: { hip: { x: 100, y: 177 }, thighDown: 131.6, knee: 97, trunk: -95, arm: 90, elbow: 0 }, ms: 1200, cap: 0, key: true },
      { to: { hip: { x: 100, y: 152 }, thighDown: 97.5, knee: 78.6, trunk: -121, arm: 90, elbow: 0 }, ms: 2000, cap: 1, key: true },
      { to: { hip: { x: 100, y: 152 }, thighDown: 97.5, knee: 78.6, trunk: -121, arm: 90, elbow: 0 }, ms: 900, cap: 1 },
      { to: { hip: { x: 100, y: 177 }, thighDown: 131.6, knee: 97, trunk: -95, arm: 90, elbow: 0 }, ms: 2000, cap: 2 },
    ],
  },
  knee_extension: {
    view: "side", props: [{ type: "chair", x: 50, seat: 149, facing: 1 }],
    segments: [
      { to: { hip: { x: 76, y: 145 }, thighDown: 90, knee: 90, trunk: 4, arm: 16, elbow: 40 }, ms: 1200, cap: 0, key: true },
      { to: { hip: { x: 76, y: 145 }, thighDown: 90, knee: 18, trunk: 4, arm: 16, elbow: 40 }, ms: 2000, cap: 1, key: true },
      { to: { hip: { x: 76, y: 145 }, thighDown: 90, knee: 18, trunk: 4, arm: 16, elbow: 40 }, ms: 700, cap: 1 },
      { to: { hip: { x: 76, y: 145 }, thighDown: 90, knee: 90, trunk: 4, arm: 16, elbow: 40 }, ms: 2000, cap: 2 },
    ],
  },
  elbow_flexion: {
    view: "side", props: [],
    segments: [
      { to: { ...STAND, arm: 2, elbow: 4 }, ms: 1200, cap: 0, key: true },
      { to: { ...STAND, arm: 6, elbow: 125 }, ms: 2000, cap: 1, key: true },
      { to: { ...STAND, arm: 6, elbow: 125 }, ms: 500, cap: 1 },
      { to: { ...STAND, arm: 2, elbow: 4 }, ms: 2100, cap: 2 },
    ],
  },
  shoulder_flexion: {
    view: "side", props: [],
    segments: [
      { to: { ...STAND, arm: 4, elbow: 2 }, ms: 1200, cap: 0, key: true },
      { to: { ...STAND, arm: 115, elbow: 2 }, ms: 2300, cap: 1, key: true },
      { to: { ...STAND, arm: 115, elbow: 2 }, ms: 500, cap: 1 },
      { to: { ...STAND, arm: 4, elbow: 2 }, ms: 2300, cap: 2 },
    ],
  },
  walk_log: {
    view: "side", props: [],
    segments: [
      { to: { hip: { x: 100, y: 107 }, thighDown: 0, knee: 2, trunk: 2, arm: -14, elbow: 20, far: { thighDown: 0, knee: 2 } }, ms: 1100, cap: 0, key: true },
      { to: { hip: { x: 100, y: 105 }, thighDown: 55, knee: 70, trunk: 2, arm: 22, elbow: 30, far: { thighDown: -2, knee: 2 } }, ms: 1100, cap: 1, key: true },
      { to: { hip: { x: 100, y: 107 }, thighDown: 0, knee: 2, trunk: 2, arm: -14, elbow: 20, far: { thighDown: 0, knee: 2 } }, ms: 1100, cap: 1 },
      { to: { hip: { x: 100, y: 105 }, thighDown: -2, knee: 2, trunk: 2, arm: -18, elbow: 20, far: { thighDown: 55, knee: 70 } }, ms: 1100, cap: 2 },
      { to: { hip: { x: 100, y: 107 }, thighDown: 0, knee: 2, trunk: 2, arm: -14, elbow: 20, far: { thighDown: 0, knee: 2 } }, ms: 1100, cap: 2 },
    ],
  },
  shoulder_mobility: {
    view: "front", props: [],
    segments: [
      { to: { shrug: 0 }, ms: 1200, cap: 0, key: true },
      { to: { shrug: 9 }, ms: 1300, cap: 1, key: true },
      { to: { shrug: 4 }, ms: 1000, cap: 1 },
      { to: { shrug: -2 }, ms: 1000, cap: 2 },
      { to: { shrug: 0 }, ms: 900, cap: 2 },
    ],
  },
  smile: {
    view: "face", props: [],
    segments: [
      { to: { smile: 0 }, ms: 1300, cap: 0, key: true },
      { to: { smile: 1 }, ms: 1300, cap: 1, key: true },
      { to: { smile: 1 }, ms: 2000, cap: 2 },
      { to: { smile: 0 }, ms: 1400, cap: 3 },
    ],
  },
  eyebrow_raise: {
    view: "face", props: [],
    segments: [
      { to: { brow: 0 }, ms: 1300, cap: 0, key: true },
      { to: { brow: 1 }, ms: 1200, cap: 1, key: true },
      { to: { brow: 1 }, ms: 2000, cap: 2 },
      { to: { brow: 0 }, ms: 1400, cap: 3 },
    ],
  },
  cheek_puff: {
    view: "face", props: [],
    segments: [
      { to: { puff: 0 }, ms: 1300, cap: 0, key: true },
      { to: { puff: 1 }, ms: 1300, cap: 1, key: true },
      { to: { puff: 1 }, ms: 2000, cap: 2 },
      { to: { puff: 0 }, ms: 1400, cap: 3 },
    ],
  },
  lip_purse: {
    view: "face", props: [],
    segments: [
      { to: { purse: 0 }, ms: 1300, cap: 0, key: true },
      { to: { purse: 1 }, ms: 1300, cap: 1, key: true },
      { to: { purse: 1 }, ms: 1500, cap: 1 },
      { to: { purse: 0 }, ms: 1400, cap: 2 },
    ],
  },
  jaw_open_close: {
    view: "face", props: [],
    segments: [
      { to: { jaw: 0 }, ms: 1300, cap: 0, key: true },
      { to: { jaw: 0.7 }, ms: 1800, cap: 1, key: true },
      { to: { jaw: 0.7 }, ms: 700, cap: 1 },
      { to: { jaw: 0 }, ms: 1800, cap: 2 },
    ],
  },
  finger_opening: {
    view: "hand", props: [],
    segments: [
      { to: { open: 0 }, ms: 1300, cap: 0, key: true },
      { to: { open: 1 }, ms: 1500, cap: 1, key: true },
      { to: { open: 1 }, ms: 900, cap: 1 },
      { to: { open: 0 }, ms: 1700, cap: 2 },
    ],
  },
});

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const lerp = (a, b, k) => a + (b - a) * k;
/** Interpolate any nested numeric parameters; non-numbers switch at the halfway point. */
function mix(a, b, k) {
  if (typeof a === "number" && typeof b === "number") return lerp(a, b, k);
  if (a && b && typeof a === "object" && typeof b === "object") {
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) out[key] = key in a && key in b ? mix(a[key], b[key], k) : k < 0.5 ? a[key] ?? b[key] : b[key] ?? a[key];
    return out;
  }
  return k < 0.5 ? a : b;
}

export const loopMs = (id) => DEMOS[id].segments.reduce((n, s) => n + s.ms, 0);

/** Pose and caption at `ms` into the loop. */
export function demoAt(id, ms) {
  const demo = DEMOS[id];
  if (!demo) throw new Error(`No demonstration for ${id}`);
  const total = loopMs(id);
  let t = ((ms % total) + total) % total;
  const segs = demo.segments;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (t < seg.ms || i === segs.length - 1) {
      const from = segs[(i - 1 + segs.length) % segs.length].to;
      const params = mix(from, seg.to, ease(Math.min(1, t / seg.ms)));
      return { params, figure: FIGURES[demo.view](params), cap: seg.cap, segment: i, view: demo.view, props: demo.props };
    }
    t -= seg.ms;
  }
  throw new Error("unreachable");
}

/** The key poses, for a still demonstration when motion is reduced. */
export function keyPoses(id) {
  const demo = DEMOS[id];
  return demo.segments.filter((s) => s.key).map((s) => ({ figure: FIGURES[demo.view](s.to), cap: s.cap, view: demo.view, props: demo.props }));
}

// ---- Drawing: plain shape lists, so React and the visual check share one renderer ----
/** @typedef {{t:"line",x1:number,y1:number,x2:number,y2:number,w?:number,tone?:string}|{t:"circle",cx:number,cy:number,r:number,w?:number,tone?:string,fill?:string}|{t:"ellipse",cx:number,cy:number,rx:number,ry:number,w?:number,tone?:string,fill?:string}|{t:"path",d:string,w?:number,tone?:string,fill?:string}} Shape */

const seg = (a, b, w = 5, tone = "body") => ({ t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, w, tone });

/** @returns {Shape[]} */
export function propShapes(props = [], view = "side") {
  /** @type {Shape[]} */
  const out = [];
  if (view === "side" || view === "front") out.push({ t: "line", x1: 10, y1: GROUND, x2: 190, y2: GROUND, w: 2, tone: "prop" });
  for (const p of props) {
    if (p.type === "chair") {
      const back = p.facing === 1 ? p.x : p.x + 34;
      out.push({ t: "line", x1: p.x, y1: p.seat, x2: p.x + 34, y2: p.seat, w: 4, tone: "prop" });
      out.push({ t: "line", x1: back, y1: p.seat, x2: back, y2: p.seat - 40, w: 4, tone: "prop" });
      out.push({ t: "line", x1: p.x + 2, y1: p.seat, x2: p.x + 2, y2: GROUND, w: 3, tone: "prop" });
      out.push({ t: "line", x1: p.x + 32, y1: p.seat, x2: p.x + 32, y2: GROUND, w: 3, tone: "prop" });
    } else if (p.type === "wall") {
      out.push({ t: "line", x1: p.x, y1: 18, x2: p.x, y2: GROUND, w: 6, tone: "prop" });
    } else if (p.type === "table") {
      out.push({ t: "line", x1: p.x, y1: p.top, x2: p.x + 46, y2: p.top, w: 5, tone: "prop" });
      out.push({ t: "line", x1: p.x + 6, y1: p.top, x2: p.x + 6, y2: GROUND, w: 3, tone: "prop" });
      out.push({ t: "line", x1: p.x + 40, y1: p.top, x2: p.x + 40, y2: GROUND, w: 3, tone: "prop" });
    } else if (p.type === "mat") {
      out.push({ t: "path", d: `M24 ${GROUND - 3} H176 V${GROUND} H24 Z`, tone: "prop", fill: "prop" });
    }
  }
  return out;
}

/** @returns {Shape[]} */
export function figureShapes(f) {
  /** @type {Shape[]} */
  const out = [];
  if (f.view === "side") {
    if (f.farKnee) out.push(seg(f.hip, f.farKnee, 5, "far"), seg(f.farKnee, f.farAnkle, 5, "far"), seg(f.farAnkle, f.farToe, 4, "far"));
    out.push(seg(f.hip, f.knee), seg(f.knee, f.ankle), seg(f.heel, f.toe, 4));
    out.push(seg(f.neck, f.hip, 6));
    out.push(seg(f.shoulder, f.elbow), seg(f.elbow, f.hand));
    out.push({ t: "circle", cx: f.head.x, cy: f.head.y, r: 9, w: 4, tone: "body", fill: "skin" });
    for (const j of [f.hip, f.knee, f.ankle, f.shoulder, f.elbow]) out.push({ t: "circle", cx: j.x, cy: j.y, r: 2.6, tone: "joint", fill: "joint" });
  } else if (f.view === "front") {
    out.push(seg(f.hipL, f.kneeL), seg(f.kneeL, f.ankleL), seg(f.hipR, f.kneeR), seg(f.kneeR, f.ankleR), seg(f.hipL, f.hipR));
    out.push(seg(f.neck, { x: 100, y: (f.hipL.y + f.hipR.y) / 2 }, 6), seg(f.shoulderL, f.shoulderR));
    out.push(seg(f.shoulderL, f.elbowL), seg(f.elbowL, f.handL), seg(f.shoulderR, f.elbowR), seg(f.elbowR, f.handR));
    out.push({ t: "circle", cx: f.head.x, cy: f.head.y, r: 10, w: 4, tone: "body", fill: "skin" });
    for (const j of [f.shoulderL, f.shoulderR, f.elbowL, f.elbowR, f.hipL, f.hipR, f.kneeL, f.kneeR]) out.push({ t: "circle", cx: j.x, cy: j.y, r: 2.6, tone: "joint", fill: "joint" });
  } else if (f.view === "face") {
    const jaw = f.jaw, puff = f.puff;
    out.push({ t: "ellipse", cx: 100, cy: 100 + jaw * 5, rx: 56 + puff * 7, ry: 70 + jaw * 7, w: 4, tone: "body", fill: "skin" });
    if (puff > 0.02) for (const x of [64 - puff * 4, 136 + puff * 4]) out.push({ t: "circle", cx: x, cy: 122, r: 4 + 12 * puff, w: 2, tone: "accent", fill: "accentSoft" });
    for (const x of [78, 122]) out.push({ t: "circle", cx: x, cy: 88, r: 5, tone: "body", fill: "body" });
    const lift = f.brow * 16;
    out.push({ t: "path", d: `M64 ${75 - lift} Q77 ${68 - lift * 1.1} 90 ${73 - lift}`, w: 4, tone: "body" });
    out.push({ t: "path", d: `M110 ${73 - lift} Q123 ${68 - lift * 1.1} 136 ${75 - lift}`, w: 4, tone: "body" });
    out.push({ t: "path", d: "M100 92 L95 114 L104 115", w: 3, tone: "body" });
    if (f.purse > 0.05 || jaw > 0.05) {
      const rx = 16 * (1 - 0.6 * f.purse), ry = 2 + 6 * f.purse + 15 * jaw;
      out.push({ t: "ellipse", cx: 100, cy: 136 + jaw * 6, rx, ry, w: 4, tone: "body", fill: jaw > 0.05 ? "mouth" : undefined });
    } else {
      const s = f.smile;
      out.push({ t: "path", d: `M${83 - 6 * s} ${135 - 8 * s} Q100 ${137 + 12 * s} ${117 + 6 * s} ${135 - 8 * s}`, w: 4, tone: "body" });
    }
  } else if (f.view === "hand") {
    const o = f.open;
    out.push({ t: "path", d: "M74 176 L72 128 Q72 112 88 110 L116 110 Q130 112 130 128 L126 176 Z", w: 4, tone: "body", fill: "skin" });
    const bases = [[79, 112], [93, 109], [107, 109], [121, 112]];
    const lengths = [44, 50, 47, 38];
    bases.forEach(([x, y], i) => {
      const spread = (i - 1.5) * 9 * o;
      const len = lengths[i] * (0.3 + 0.7 * o);
      const tip = { x: x + len * Math.sin(rad(spread)), y: y - len * Math.cos(rad(spread)) };
      out.push(seg({ x, y }, tip, 9, "body"));
      out.push({ t: "circle", cx: tip.x, cy: tip.y, r: 2.6, tone: "joint", fill: "joint" });
    });
    const thumb = 40 + 70 * o, tl = 34;
    out.push(seg({ x: 76, y: 150 }, { x: 76 - tl * Math.sin(rad(thumb)), y: 150 - tl * Math.cos(rad(thumb)) * 0.9 }, 10, "body"));
  }
  return out;
}

/** Everything to draw for one moment of a demonstration. */
export const demoShapes = (frame) => [...propShapes(frame.props, frame.view), ...figureShapes(frame.figure)];
