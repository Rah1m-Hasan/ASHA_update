// Synthetic posture traces: MediaPipe-shaped pose landmarks for the shoulder
// and hip points the posture and rest detectors read.

import { rng, noisy } from "./random.mjs";

/**
 * Build a 33-point pose landmark array.
 *
 * `lean` tilts the shoulders relative to the hips (degrees), `shift` moves the
 * whole body, and `noise` is the per-point jitter a real detector produces.
 */
export function poseTrace({
  fps = 2,
  durationMs = 20000,
  seed = 5,
  lean = 0,
  shift = [0, 0],
  noise = 0.002,
  visibility = 0.95,
  dropouts = [],
} = {}) {
  const next = rng(seed);
  const step = 1000 / fps;
  const frames = [];
  const dropped = new Set(dropouts);
  let index = 0;
  for (let t = 0; t <= durationMs; t += step) {
    const i = index++;
    if (dropped.has(i)) {
      frames.push({ t, landmarks: null });
      continue;
    }
    const leanNow = typeof lean === "function" ? lean(t) : lean;
    const radians = (leanNow * Math.PI) / 180;
    const cx = 0.5 + shift[0];
    const cy = 0.6 + shift[1];
    const half = 0.12;
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility,
    }));
    const put = (index, x, y) => {
      landmarks[index] = {
        x: noisy(next, x, noise),
        y: noisy(next, y, noise),
        z: 0,
        visibility: noisy(next, visibility, noise),
      };
    };
    // The posture detector measures the lean as the angle of the shoulder
    // centre away from the hip centre, so the fixture has to place the
    // shoulders at that angle: the lateral offset is the shoulder-to-hip
    // distance times the tangent of the requested angle. Rotating the whole
    // body instead would produce a much smaller angle, because the distance
    // from the shoulders to the hips is far larger than the body is wide.
    const shoulderY = cy - 0.06;
    const hipY = cy + 0.12;
    const dx = Math.abs(shoulderY - hipY) * Math.tan(radians);
    put(11, cx - half + dx, shoulderY);
    put(12, cx + half + dx, shoulderY);
    put(23, cx - half * 0.7, hipY);
    put(24, cx + half * 0.7, hipY);
    frames.push({ t, landmarks });
  }
  return frames;
}
