// Face-motion estimate for the VitalSense gate.
//
// The gate in public/engine/vitalsense.js compares this value against 0.075 and
// invalidates the whole vital window when it is exceeded. The unit is
// "normalised face-landmark units per second" and the threshold is unchanged.
//
// How it used to work, and why it was wrong
// -----------------------------------------
// The old estimate took the displacement between two CONSECUTIVE face results
// and divided by the time between them:
//
//     sample = meanLandmarkDisplacement / elapsedSeconds
//     value  = 0.7 * value + 0.3 * sample
//
// Two defects follow from that shape:
//
// 1. Per-frame landmark jitter does not shrink when the frame rate rises, but
//    dividing by a smaller `elapsed` multiplies it. The same still face
//    therefore reads as more motion on a faster device. Measured on synthetic
//    landmarks (60 sampled landmarks, 0.001 normalised jitter): 0.017 at
//    10 fps, 0.035 at 20 fps, 0.053 at 30 fps, 0.071 at 40 fps. At 40 fps a
//    completely still face crossed the 0.075 gate on 26 of 480 frames; with
//    twice the jitter it crossed on 479 of 480 frames, which invalidates the
//    vital window continuously and no reading is ever produced.
//
// 2. The smoothing weights (0.7/0.3) are per sample, not per second, so the
//    time constant of the filter changes with the frame rate.
//
// What this module does instead
// -----------------------------
// The velocity is measured over fixed time BASELINES (100 ms and 250 ms)
// rather than between consecutive frames, and the result is smoothed with a
// time-constant EMA (tau = 250 ms). Both changes make the estimate depend on
// elapsed time rather than on the number of samples, so a 10 fps device and a
// 40 fps device report the same value for the same physical movement.
//
// Two baselines are used and the larger velocity wins. The long baseline is
// the accurate one for slow drift; the short baseline is what catches a head
// shake that reverses inside the long window and would otherwise net to zero.
// On synthetic shakes from 1 Hz to 6 Hz this keeps detection equal to the
// old formula.
//
// Measured on the same synthetic streams (sigma 0.001): a still face reads
// 0.017-0.018 at 10, 20, 30 and 40 fps (the old formula read 0.017-0.071 and
// produced false gate trips at 40 fps). A steady drift of 0.15 units/s is still
// detected at every frame rate, with 225-300 ms of latency.
//
// The 0.075 threshold and its units are unchanged, and the gate keeps its
// existing reason string.

const LANDMARK_STRIDE = 8; // matches the sampling the previous code used

// Mean per-landmark displacement magnitude between two landmark sets.
function meanDisplacement(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let total = 0;
  let count = 0;
  for (let i = 0; i < n; i += LANDMARK_STRIDE) {
    total += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
    count++;
  }
  return count ? total / count : 0;
}

export class MotionMeter {
  constructor(options = {}) {
    this.baselines = options.baselines || [100, 250];
    this.tauMs = options.tauMs ?? 250;
    this.history = [];
    this.value = 0;
    this.updatedAt = 0;
    // True when the last call did not measure anything: the face was lost or
    // the landmarks were missing. The value is then UNKNOWN, not zero.
    this.stale = true;
  }

  reset() {
    this.history = [];
    this.value = 0;
    this.updatedAt = 0;
    this.stale = true;
  }

  // The frame closest to (t - baselineMs): the oldest one not newer than it.
  reference(t, baselineMs) {
    let best = null;
    for (const frame of this.history) {
      const age = t - frame.t;
      if (age > 0 && age <= baselineMs && (!best || age > t - best.t)) best = frame;
    }
    return best;
  }

  update(t, landmarks) {
    if (!landmarks || landmarks.length < 2) return this.hold();
    const points = [];
    for (let i = 0; i < landmarks.length; i += LANDMARK_STRIDE) points.push(landmarks[i]);
    if (points.length < 2) return this.hold();

    this.history.push({ t, points });
    const cutoff = t - (Math.max(...this.baselines) + 100);
    while (this.history.length > 2 && this.history[0].t < cutoff) this.history.shift();

    let sample = 0;
    for (const baseline of this.baselines) {
      const ref = this.reference(t, baseline);
      if (!ref) continue;
      const dt = t - ref.t;
      if (dt <= 0) continue;
      const velocity = meanDisplacement(points, ref.points) / (dt / 1000);
      if (velocity > sample) sample = velocity;
    }
    if (!sample) {
      // No usable reference yet (first frame after a reset): nothing to say.
      this.stale = true;
      return this.value;
    }

    const step = this.updatedAt ? Math.max(1, t - this.updatedAt) : 33;
    const alpha = 1 - Math.exp(-step / this.tauMs);
    this.value += alpha * (sample - this.value);
    this.updatedAt = t;
    this.stale = false;
    return this.value;
  }

  // A gap in the face results. The motion is unknown, so the last estimate is
  // held rather than reset to zero: a stuttering camera must not read as a
  // perfectly still face.
  hold() {
    this.stale = true;
    return this.value;
  }
}

export default MotionMeter;
