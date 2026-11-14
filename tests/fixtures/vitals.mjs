// Synthetic VitalSense traces: camera colour samples carrying a known pulse,
// with the failure conditions a real camera produces (motion, light steps,
// frame drops, and pure noise with no pulse at all).

import { rng, noisy, gaussian } from "./random.mjs";

/**
 * Colour samples for `VitalSense.add`.
 *
 * The POS projection is `s1 = g − b`, `s2 = g + b − 2r`. A pulse that the
 * pipeline can recover must modulate g and b with a phase difference — a
 * signal where g and b move together cancels in `s1`. The amplitude below is
 * what makes the recovered rate measurable against the noise floor.
 */
export function vitalTrace({
  bpm = 78,
  seconds = 20,
  fps = 30,
  seed = 3,
  noise = 0.0015,
  motion = 0.002,
  start = 0,
  lightStep = null,
  dropFrames = [],
  rgb = [0.56, 0.43, 0.32],
  breathingBpm = 15,
} = {}) {
  const next = rng(seed);
  const rows = [];
  const step = 1000 / fps;
  const dropped = new Set(dropFrames);
  const pulse = (2 * Math.PI * bpm) / 60;
  const breath = (2 * Math.PI * breathingBpm) / 60;
  for (let i = 0; i <= seconds * fps; i++) {
    if (dropped.has(i)) continue;
    const t = start + i * step;
    const phase = (pulse * t) / 1000;
    const breathPhase = (breath * t) / 1000;
    // g and b lead/lag by 60 degrees: s1 does not cancel.
    const g = rgb[1] + 0.006 * Math.sin(phase) + 0.0008 * Math.sin(breathPhase);
    const b = rgb[2] + 0.003 * Math.sin(phase + Math.PI / 3);
    const r = rgb[0] + 0.0012 * Math.sin(phase - Math.PI / 3);
    let brightnessScale = 1;
    if (lightStep && t >= lightStep.at) brightnessScale = lightStep.scale;
    rows.push({
      t,
      rgb: [
        noisy(next, r * brightnessScale, noise),
        noisy(next, g * brightnessScale, noise),
        noisy(next, b * brightnessScale, noise),
      ],
      headY: 0.5 + 0.001 * Math.sin(breathPhase),
      motion,
      roiCount: 3,
    });
  }
  return rows;
}

/** Colour samples with no pulse at all: the control for false readings. */
export function noiseOnlyTrace({
  seconds = 20,
  fps = 30,
  seed = 4,
  noise = 0.0015,
  rgb = [0.56, 0.43, 0.32],
} = {}) {
  return vitalTrace({ bpm: 0, seconds, fps, seed, noise, rgb });
}

/**
 * A stream of face landmark frames for the motion gate.
 *
 * The VitalSense gate compares a face-motion estimate against 0.075 normalised
 * landmark units per second. This produces the two situations that matter: a
 * face that is still but whose landmarks jitter (the estimate must not depend
 * on the frame rate), and a face that is genuinely moving (the estimate must
 * cross the gate).
 *
 * `motion` is the drift in normalised units per second; `shakeHz` adds a
 * sinusoidal sway on top.
 */
export function faceMotionStream({
  fps = 30,
  motion = 0,
  shakeHz = 0,
  shakeAmplitude = 0.02,
  seconds = 12,
  seed = 5,
  jitter = 0.001,
  landmarks = 60,
} = {}) {
  const next = rng(seed);
  const step = 1000 / fps;
  const frames = [];
  for (let i = 0; i * step <= seconds * 1000; i++) {
    const t = i * step;
    const drift = motion * (t / 1000);
    const sway = shakeHz ? shakeAmplitude * Math.sin((2 * Math.PI * shakeHz * t) / 1000) : 0;
    const points = [];
    for (let j = 0; j < landmarks; j++) {
      points.push({
        x: 0.5 + drift + sway + gaussian(next) * jitter,
        y: 0.5 + gaussian(next) * jitter,
      });
    }
    frames.push({ t, landmarks: points });
  }
  return frames;
}
