// Synthetic EyeSpeak traces: gaze feature vectors for a known screen target,
// with the contamination a real calibration capture suffers (saccades, blinks,
// head drift). Deterministic from a seed.

import { rng, noisy, clamp } from "./random.mjs";

/**
 * Map a screen point to the 7 gaze features the ridge model consumes.
 * The mapping is linear with a per-person offset and scale, which is what a
 * ridge model can represent; the point is the *noise and contamination*, not
 * a claim about eye geometry.
 */
export function gazeFeatures(x, y, { offset = [0, 0], scale = [0.4, 0.3] } = {}) {
  return [
    (x - 0.5) * scale[0] + offset[0],
    (y - 0.5) * scale[1] + offset[1],
    (x - 0.5) * scale[0] * 0.95 + offset[0],
    (y - 0.5) * scale[1] * 0.94 + offset[1],
    0,
    0.3,
    0,
  ];
}

/**
 * A calibration capture for the given targets.
 *
 * `contamination` is the fraction of captured frames that are not really at
 * the target — a mid-saccade frame, a blink, or a partial gaze. Those frames
 * are labelled with the target anyway, which is exactly the failure the
 * calibration is supposed to survive.
 */
export function calibrationCapture({
  targets,
  framesPerTarget = 30,
  seed = 1,
  jitter = 0.004,
  contamination = 0,
  offset = [0, 0],
  scale = [0.4, 0.3],
} = {}) {
  const next = rng(seed);
  const samples = [];
  const truth = { clean: 0, contaminated: 0 };
  for (const [x, y] of targets) {
    for (let i = 0; i < framesPerTarget; i++) {
      const bad = next() < contamination;
      // A contaminated frame looks somewhere else on screen entirely.
      const gx = bad ? 0.05 + next() * 0.9 : x;
      const gy = bad ? 0.05 + next() * 0.9 : y;
      const features = gazeFeatures(gx, gy, { offset, scale }).map((value) =>
        noisy(next, value, jitter),
      );
      samples.push({ features, x, y, contaminated: bad });
      if (bad) truth.contaminated += 1;
      else truth.clean += 1;
    }
  }
  return { samples, truth };
}

/**
 * A live gaze trace over time: the patient holds a target, with tremor, a
 * saccade away and back, and blinks.
 */
export function gazeTrace({
  target = [0.5, 0.5],
  fps = 30,
  durationMs = 8000,
  seed = 2,
  jitter = 0.006,
  tremor = 0.01,
  saccade = null,
  blink = null,
  offset = [0, 0],
  scale = [0.4, 0.3],
} = {}) {
  const next = rng(seed);
  const step = 1000 / fps;
  const frames = [];
  for (let t = 0; t <= durationMs; t += step) {
    let gx = target[0];
    let gy = target[1];
    if (saccade && t >= saccade.at && t < saccade.at + saccade.durationMs) {
      const away = 1 - (t - saccade.at) / saccade.durationMs;
      gx = target[0] + (saccade.to[0] - target[0]) * away;
      gy = target[1] + (saccade.to[1] - target[1]) * away;
    }
    gx += noisy(next, 0, tremor);
    gy += noisy(next, 0, tremor);
    const features = gazeFeatures(clamp(gx, 0, 1), clamp(gy, 0, 1), { offset, scale }).map(
      (value) => noisy(next, value, jitter),
    );
    const closed = blink && t >= blink.at && t < blink.at + (blink.durationMs ?? 120);
    frames.push({ t, features, closed: !!closed });
  }
  return { frames };
}

/**
 * A frame the tracker got wrong: one eye's iris estimate is wrong, which is
 * what a blink, a half-closed eye or a face turning away looks like to the
 * feature extractor. The observation no longer fits the calibration surface
 * the model was fitted on.
 */
export function distort(features, amount = 0.2) {
  return features.map((value, index) => (index === 0 ? value + amount : value));
}
