// Deterministic rep detectors for ASHA Move. Every threshold here is a documented demo value, not a
// clinically validated one. A detector never counts what it cannot see: when the needed body part
// is missing, low-confidence or out of frame it reports why and drops the incomplete repetition.

export const DETECTOR_VERSION = "move-detectors/1.0.0";

/** MediaPipe pose landmark indices, person-relative. */
const POSE = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};
const MIN_VISIBILITY = 0.6;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Angle at b in the image plane, with the frame's aspect ratio restored. */
export function jointAngle(a, b, c, width = 1, height = 1) {
  if (![a, b, c].every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const ux = (a.x - b.x) * width, uy = (a.y - b.y) * height;
  const vx = (c.x - b.x) * width, vy = (c.y - b.y) * height;
  const m = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (m < 1e-9) return null;
  return (Math.acos(clamp((ux * vx + uy * vy) / m, -1, 1)) * 180) / Math.PI;
}

const visibility = (p) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? Math.min(p.visibility ?? 0, p.presence ?? 1) : 0;
const inFrame = (p) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99;

/** Light smoothing that resets across tracking gaps, so a stale value never bridges an occlusion. */
export class Smoother {
  constructor(alpha = 0.45, gapMs = 700) {
    this.alpha = alpha;
    this.gapMs = gapMs;
    this.reset();
  }
  reset() {
    this.value = null;
    this.t = null;
  }
  update(value, t) {
    if (!Number.isFinite(value)) return this.reset(), null;
    if (this.value === null || this.t === null || t - this.t > this.gapMs || t <= this.t) this.value = value;
    else this.value += this.alpha * (value - this.value);
    this.t = t;
    return this.value;
  }
}

/**
 * Counts one full start -> target (held) -> return cycle. Works for any scalar signal.
 * direction "decrease": start is high, target is low (squat knee angle). "increase": the reverse.
 */
export class PhaseCounter {
  constructor({ direction, start, target, ret, holdMs = 150, settleMs = 200, maxRepMs = 20000, gapMs = 700, partialFraction = 0.4 }) {
    if (!["increase", "decrease"].includes(direction)) throw new Error("direction must be increase or decrease");
    const ordered = direction === "increase" ? start <= ret && ret < target : start >= ret && ret > target;
    if (!ordered) throw new Error("start, return and target thresholds must be separated in the movement direction");
    Object.assign(this, { direction, start, target, ret, holdMs, settleMs, maxRepMs, gapMs, partialFraction });
    this.reps = 0;
    this.partials = 0;
    this.reset();
  }
  reset() {
    this.phase = "find_start";
    this.since = null;
    this.startedAt = null;
    this.best = null;
    this.last = null;
  }
  progressed(v, threshold) {
    return this.direction === "increase" ? v >= threshold : v <= threshold;
  }
  atStart(v) {
    return this.direction === "increase" ? v <= this.start : v >= this.start;
  }
  /** 0 at the start threshold, 1 at the target threshold. */
  progress(v) {
    return clamp((v - this.start) / (this.target - this.start), 0, 1);
  }
  update(v, t, extraTarget = true) {
    if (!Number.isFinite(v) || !Number.isFinite(t)) {
      this.reset();
      return this.out(false, null);
    }
    if (this.last !== null && (t <= this.last || t - this.last > this.gapMs)) this.reset();
    this.last = t;
    if (this.startedAt !== null && t - this.startedAt > this.maxRepMs) this.reset(), (this.last = t);
    let event = null;
    if (this.phase === "find_start") {
      if (!this.atStart(v)) this.since = null;
      else if (t - (this.since ??= t) >= this.settleMs) {
        this.phase = "toward_target";
        this.since = null;
        this.startedAt = t;
        this.best = v;
      }
    } else if (this.phase === "toward_target") {
      this.best = this.direction === "increase" ? Math.max(this.best, v) : Math.min(this.best, v);
      if (this.progressed(v, this.target) && extraTarget) {
        if (t - (this.since ??= t) >= this.holdMs) {
          this.phase = "returning";
          this.since = null;
        }
      } else {
        this.since = null;
        // Came back to the start without reaching the target: tell the person, count nothing.
        if (this.atStart(v) && this.progress(this.best) >= this.partialFraction) {
          this.partials++;
          event = "partial";
          this.best = v;
          this.startedAt = t;
        }
      }
    } else if (this.phase === "returning") {
      const back = this.direction === "increase" ? v <= this.ret : v >= this.ret;
      if (!back) this.since = null;
      else if (t - (this.since ??= t) >= this.settleMs) {
        this.reps++;
        this.reset();
        this.last = t;
        return this.out(true, "rep", v);
      }
    }
    return this.out(false, event, v);
  }
  out(counted, event, v = null) {
    return { reps: this.reps, partials: this.partials, phase: this.phase, counted, event, progress: v === null ? 0 : this.progress(v) };
  }
}

/** Demo thresholds per tracked body exercise. Angles in degrees. */
export const POSE_RULES = Object.freeze({
  squat: { joint: ["hip", "knee", "ankle"], direction: "decrease", start: 160, target: 110, ret: 155, hipDrop: 0.15, view: "side", cue: { down: "Lower a little more", up: "Stand all the way up" } },
  chair_squat: { joint: ["hip", "knee", "ankle"], direction: "decrease", start: 155, target: 120, ret: 150, hipDrop: 0.1, view: "side", cue: { down: "Lower toward the seat", up: "Stand tall again" } },
  sit_to_stand: { joint: ["hip", "knee", "ankle"], direction: "increase", start: 115, target: 155, ret: 120, hipRise: 0.12, view: "side", cue: { down: "Sit back down slowly", up: "Stand up fully" } },
  wall_pushup: { joint: ["shoulder", "elbow", "wrist"], direction: "decrease", start: 150, target: 115, ret: 145, view: "side", cue: { down: "Bend your elbows a little more", up: "Push back until your arms are nearly straight" } },
  arm_raise: { joint: ["hip", "shoulder", "elbow"], direction: "increase", start: 40, target: 75, ret: 45, eitherArm: true, view: "front", cue: { down: "Lower your arm slowly", up: "Raise to shoulder height" } },
  // Clinician-assigned movements: these defaults are replaced by the clinician's own angles.
  knee_extension: { joint: ["hip", "knee", "ankle"], direction: "increase", start: 110, target: 155, ret: 115, view: "side", cue: { down: "Lower your foot slowly", up: "Straighten your knee to the set range" } },
  elbow_flexion: { joint: ["shoulder", "elbow", "wrist"], direction: "decrease", start: 150, target: 75, ret: 145, view: "side", cue: { down: "Straighten your arm slowly", up: "Bend your elbow to the set range" } },
  shoulder_flexion: { joint: ["hip", "shoulder", "elbow"], direction: "increase", start: 30, target: 85, ret: 35, view: "side", cue: { down: "Lower your arm slowly", up: "Raise your arm to the set range" } },
});

/** Demo thresholds per tracked face exercise, relative to the person's own neutral face. */
export const FACE_RULES = Object.freeze({
  smile: { signal: (b) => ((b.mouthSmileLeft ?? 0) + (b.mouthSmileRight ?? 0)) / 2, rise: 0.28, minTarget: 0.35, cue: "Smile a little more" },
  eyebrow_raise: { signal: (b) => Math.max(b.browInnerUp ?? 0, ((b.browOuterUpLeft ?? 0) + (b.browOuterUpRight ?? 0)) / 2), rise: 0.22, minTarget: 0.3, cue: "Lift your eyebrows a little higher" },
  cheek_puff: { signal: (b) => b.cheekPuff ?? 0, rise: 0.15, minTarget: 0.2, experimental: true, cue: "Puff a little more air into your cheeks" },
});

export const isTracked = (exerciseId) => exerciseId in POSE_RULES || exerciseId in FACE_RULES;
export const detectorKind = (exerciseId) => (exerciseId in POSE_RULES ? "pose" : exerciseId in FACE_RULES ? "face" : null);

/** Which side of the body the camera sees best for these joints. Sticky, so it doesn't flip mid-rep. */
function chooseSide(landmarks, joints, previous) {
  const score = (side) => Math.min(...joints.map((j) => visibility(landmarks[POSE[side][j]])));
  const l = score("left"), r = score("right");
  if (previous && (previous === "left" ? l : r) >= MIN_VISIBILITY) return { side: previous, confidence: previous === "left" ? l : r };
  return l >= r ? { side: "left", confidence: l } : { side: "right", confidence: r };
}

export class PoseDetector {
  /** `limits` and `side` come only from a clinician plan; the counter rejects ranges that aren't separated. */
  constructor(exerciseId, { holdMs = 150, limits = null, side = null } = {}) {
    const rule = POSE_RULES[exerciseId];
    if (!rule) throw new Error(`No camera detector for ${exerciseId}`);
    this.exerciseId = exerciseId;
    this.rule = rule;
    const l = limits ? { start: limits.start, target: limits.target, ret: limits.return ?? limits.start } : { start: rule.start, target: rule.target, ret: rule.ret };
    this.counter = new PhaseCounter({ direction: rule.direction, ...l, holdMs });
    this.smooth = new Smoother();
    this.fixedSide = side === "left" || side === "right" ? side : null;
    this.side = this.fixedSide;
    this.anchorHip = null;
    this.legLength = null;
    this.goodFrames = 0;
    this.badFrames = 0;
  }
  get reps() {
    return this.counter.reps;
  }
  lost(reason, t) {
    this.badFrames++;
    this.counter.reset();
    this.smooth.reset();
    this.anchorHip = null;
    return { valid: false, reason, reps: this.counter.reps, partials: this.counter.partials, phase: "lost", counted: false, progress: 0, confidence: 0, t };
  }
  update(frame) {
    const t = frame?.timestamp;
    if (!frame || !Number.isFinite(t)) return this.lost("Waiting for the camera", t);
    if (!frame.landmarks?.length) return this.lost("Can't see your body. Step into the camera view.", t);
    if (frame.personCount > 1) return this.lost("Keep only one person in view.", t);
    const lm = frame.landmarks;
    const { rule } = this;
    const needs = rule.hipDrop || rule.hipRise ? [...new Set([...rule.joint, "hip", "knee", "ankle"])] : rule.joint;
    let angle, side, confidence;
    if (rule.eitherArm) {
      // Front view: count whichever arm is raised; each visible arm is measured on its own.
      let best = null;
      for (const s of ["left", "right"]) {
        const pts = rule.joint.map((j) => lm[POSE[s][j]]);
        const conf = Math.min(...pts.map(visibility));
        if (conf < MIN_VISIBILITY || !pts.every(inFrame)) continue;
        const a = jointAngle(...pts, frame.width ?? 1, frame.height ?? 1);
        if (a !== null && (best === null || a > best.angle)) best = { angle: a, side: s, conf };
      }
      if (!best) return this.lost("Keep your shoulders, elbows and hips in view.", t);
      ({ angle, side } = best);
      confidence = best.conf;
    } else {
      ({ side, confidence } = this.fixedSide ? { side: this.fixedSide, confidence: Math.min(...needs.map((j) => visibility(lm[POSE[this.fixedSide][j]]))) } : chooseSide(lm, needs, this.side));
      if (confidence < MIN_VISIBILITY) return this.lost(`Keep your ${needs.join(", ")} in view, side-on to the camera.`, t);
      const pts = needs.map((j) => lm[POSE[side][j]]);
      if (!pts.every(inFrame)) return this.lost("Move back so your whole body stays inside the frame.", t);
      angle = jointAngle(...rule.joint.map((j) => lm[POSE[side][j]]), frame.width ?? 1, frame.height ?? 1);
      if (angle === null) return this.lost("Turn side-on so your joints don't overlap.", t);
    }
    this.side = side;
    this.goodFrames++;
    const value = this.smooth.update(angle, t);
    // Squats must move the hips, not just bend a knee; sit to stand must lift them.
    let extra = true;
    if (rule.hipDrop || rule.hipRise) {
      const hip = lm[POSE[side].hip], knee = lm[POSE[side].knee], ankle = lm[POSE[side].ankle];
      const leg = Math.max(0.08, Math.hypot(hip.x - knee.x, hip.y - knee.y) + Math.hypot(knee.x - ankle.x, knee.y - ankle.y));
      if (this.counter.phase === "find_start" || this.anchorHip === null) {
        this.anchorHip = hip.y;
        this.legLength = leg;
      }
      extra = rule.hipDrop ? hip.y - this.anchorHip >= rule.hipDrop * this.legLength : this.anchorHip - hip.y >= rule.hipRise * this.legLength;
    }
    const r = this.counter.update(value, t, extra);
    const toward = this.counter.phase === "returning" ? rule.cue.up : rule.cue.down;
    const reason = r.event === "partial" ? `Not counted: ${rule.cue.down.toLowerCase()}.` : r.counted ? "Counted" : r.phase === "find_start" ? `Get into the start position` : toward;
    return { valid: true, reason, ...r, angle: value, side, confidence, t };
  }
  quality() {
    const total = this.goodFrames + this.badFrames;
    return total ? this.goodFrames / total : 0;
  }
}

export class FaceDetector {
  constructor(exerciseId, { holdMs = 2000, calibrateMs = 1500, maxHeadDegrees = 20 } = {}) {
    const rule = FACE_RULES[exerciseId];
    if (!rule) throw new Error(`No camera detector for ${exerciseId}`);
    this.exerciseId = exerciseId;
    this.rule = rule;
    this.holdMs = holdMs;
    this.calibrateMs = calibrateMs;
    this.maxHead = maxHeadDegrees;
    this.samples = [];
    this.calibStart = null;
    this.baseline = null;
    this.counter = null;
    this.smooth = new Smoother(0.5);
    this.goodFrames = 0;
    this.badFrames = 0;
    this.repsBefore = 0;
    this.partialsBefore = 0;
  }
  get reps() {
    return this.repsBefore + (this.counter?.reps ?? 0);
  }
  get calibrating() {
    return this.baseline === null;
  }
  lost(reason, t) {
    this.badFrames++;
    this.counter?.reset();
    this.smooth.reset();
    if (this.baseline === null) (this.samples = []), (this.calibStart = null);
    return { valid: false, reason, reps: this.reps, partials: this.partialsBefore + (this.counter?.partials ?? 0), phase: "lost", counted: false, progress: 0, confidence: 0, t };
  }
  /** Re-learn the neutral face (e.g. the person was already smiling at the start). */
  recalibrate() {
    this.repsBefore = this.reps;
    this.partialsBefore += this.counter?.partials ?? 0;
    this.baseline = null;
    this.counter = null;
    this.samples = [];
    this.calibStart = null;
  }
  update(frame) {
    const t = frame?.timestamp;
    if (!frame || !Number.isFinite(t)) return this.lost("Waiting for the camera", t);
    const b = frame.blendshapes;
    if (!frame.faceVisible || !b || !Object.keys(b).length) return this.lost("Can't see your face. Face the camera in good light.", t);
    if (Math.abs(frame.yaw ?? 0) > this.maxHead || Math.abs(frame.pitch ?? 0) > this.maxHead) return this.lost("Face the camera straight on.", t);
    const raw = this.rule.signal(b);
    if (!Number.isFinite(raw)) return this.lost("Face signal unavailable.", t);
    this.goodFrames++;
    if (this.baseline === null) {
      this.calibStart ??= t;
      this.samples.push(raw);
      if (t - this.calibStart < this.calibrateMs) return { valid: true, phase: "calibrating", reason: this.rejected ? "Relax your face to start" : "Keep a relaxed face for a moment", reps: this.reps, partials: this.partialsBefore, counted: false, progress: (t - this.calibStart) / this.calibrateMs, confidence: 1, t };
      const sorted = [...this.samples].sort((x, y) => x - y);
      const neutral = sorted[Math.floor(sorted.length / 2)];
      const target = Math.max(this.rule.minTarget, neutral + this.rule.rise);
      if (target > 0.95) {
        this.rejected = true;
        this.samples = [];
        this.calibStart = null;
        return { valid: true, phase: "calibrating", reason: "Relax your face to start", reps: this.reps, partials: this.partialsBefore, counted: false, progress: 0, confidence: 1, t };
      }
      this.baseline = neutral;
      this.rejected = false;
      const start = neutral + (target - neutral) * 0.3;
      const ret = neutral + (target - neutral) * 0.45;
      // Face signals rise toward the target, so the counter runs in the "increase" direction.
      this.counter = new PhaseCounter({ direction: "increase", start, target, ret, holdMs: this.holdMs, settleMs: 150, maxRepMs: 15000, gapMs: 600 });
    }
    const value = this.smooth.update(raw, t);
    const r = this.counter.update(value, t);
    const reason = r.event === "partial" ? `Not counted: ${this.rule.cue.toLowerCase()} or hold a little longer.` : r.counted ? "Counted" : r.phase === "find_start" ? "Relax your face" : r.phase === "returning" ? "Now relax" : r.progress >= 1 ? "Hold it" : this.rule.cue;
    return { valid: true, ...r, reps: this.reps, partials: this.partialsBefore + r.partials, reason, value, baseline: this.baseline, confidence: 1, t };
  }
  quality() {
    const total = this.goodFrames + this.badFrames;
    return total ? this.goodFrames / total : 0;
  }
}

/** Returns a detector for camera-tracked exercises, or null when the exercise is manual-only. */
export function createDetector(exerciseId, options = {}) {
  if (exerciseId in POSE_RULES) return new PoseDetector(exerciseId, options);
  if (exerciseId in FACE_RULES) return new FaceDetector(exerciseId, { ...options, holdMs: options.holdMs ?? 2000 });
  return null;
}

/** Adapt the shared camera engine's face snapshot to the face detector's input. */
export function faceFrame(snapshot) {
  return {
    timestamp: snapshot?.t,
    blendshapes: snapshot?.blendshapes,
    faceVisible: !!snapshot?.analysis?.valid,
    yaw: snapshot?.analysis?.head?.yaw,
    pitch: snapshot?.analysis?.head?.pitch,
  };
}
