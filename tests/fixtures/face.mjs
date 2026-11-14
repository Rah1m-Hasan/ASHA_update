// Synthetic FaceSpeak traces: the raw feature frames the engine consumes, with
// a ground truth of what actually happened. Deterministic from a seed.
//
// The frames here are the engine's own feature shape (EAR, blendshapes, mouth
// corners, head pose) — the same shape `NF_vision.Extractor.extract` produces
// from MediaPipe. Driving the engine with these measures the temporal logic;
// it does not measure MediaPipe's detection accuracy.

import { rng, noisy } from "./random.mjs";

/** A neutral, well-tracked face with the given open-eye aspect ratio. */
export function neutralFace({
  ear = 0.3,
  yaw = 0,
  pitch = 0,
  roll = 0,
  faceQuality = 1,
  smile = 0.02,
} = {}) {
  return {
    facePresent: true,
    poseValid: true,
    blendshapesValid: true,
    faceQuality,
    earLeft: ear,
    earRight: ear,
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    mouthSmileLeft: smile,
    mouthSmileRight: smile,
    cheekSquintLeft: 0,
    cheekSquintRight: 0,
    mouthClose: 1,
    jawOpen: 0,
    mouthPucker: 0,
    mouthCornerLeftX: 0.2,
    mouthCornerLeftY: 0,
    mouthCornerRightX: -0.2,
    mouthCornerRightY: 0,
    yaw,
    pitch,
    roll,
    faceSize: 0.4,
    centerX: 0.5,
    centerY: 0.5,
    inFrame: true,
    brightness: 120,
    fps: 30,
    poseSpeed: 0,
    mouthWidth: 0.15,
    browGap: 0.05,
    lipDeviation: 0,
  };
}

/**
 * Build a face trace.
 *
 * `script` is a list of events placed on the timeline:
 *   { at, kind: "blink", durationMs, deliberate }
 *   { at, kind: "turn", side: "left"|"right", degrees }
 *   { at, kind: "nod", degrees }
 *   { at, kind: "smile", durationMs }
 *   { at, kind: "spike", channel, amount }   — a one-frame glitch on one channel
 *
 * `groundTruth` records what really happened so the benchmark can score the
 * engine against it.
 */
export function faceTrace({
  script = [],
  fps = 30,
  durationMs = 20000,
  seed = 1,
  ear = 0.3,
  noise = 0,
  spikes = [],
} = {}) {
  const next = rng(seed);
  const step = 1000 / fps;
  const frames = [];
  const groundTruth = { blinks: [], turns: [], nods: [], smiles: [], spikes: [] };

  for (const event of script) {
    if (event.kind === "blink") {
      groundTruth.blinks.push({
        at: event.at,
        durationMs: event.durationMs,
        deliberate: event.deliberate !== false,
      });
    } else if (event.kind === "turn") {
      // The degrees belong to the ground truth too: the trace reads them
      // back when it builds the pose, and without them the head never moves.
      groundTruth.turns.push({ at: event.at, side: event.side, degrees: event.degrees });
    } else if (event.kind === "nod") {
      groundTruth.nods.push({ at: event.at, degrees: event.degrees });
    } else if (event.kind === "smile") {
      groundTruth.smiles.push({ at: event.at, durationMs: event.durationMs });
    } else if (event.kind === "spike") {
      groundTruth.spikes.push({ at: event.at, channel: event.channel });
    }
  }

  for (let t = 0; t <= durationMs; t += step) {
    const frame = neutralFace({ ear });

    // Blinks: the eye closes (EAR drops, the blink blendshapes rise) and reopens.
    for (const blink of groundTruth.blinks) {
      const start = blink.at;
      const end = start + blink.durationMs;
      if (t < start - 60 || t > end + 60) continue;
      let closure = 0;
      if (t >= start && t <= end) closure = 1;
      else if (t > start - 60 && t < start) closure = (t - (start - 60)) / 60;
      else if (t > end && t < end + 60) closure = 1 - (t - end) / 60;
      const closedEar = ear * (1 - 0.68 * closure);
      frame.earLeft = closedEar;
      frame.earRight = closedEar;
      frame.eyeBlinkLeft = 0.95 * closure;
      frame.eyeBlinkRight = 0.95 * closure;
    }

    // Head turns and nods move the pose away from centre and back.
    for (const turn of groundTruth.turns) {
      const start = turn.at;
      const end = start + 500;
      if (t < start - 100 || t > end + 300) continue;
      const magnitude = turn.side === "left" ? -turn.degrees : turn.degrees;
      frame.yaw = magnitude * holdProfile(t, start, end);
    }
    for (const nod of groundTruth.nods) {
      const start = nod.at;
      const end = start + 400;
      if (t < start - 100 || t > end + 300) continue;
      frame.pitch = nod.degrees * holdProfile(t, start, end);
    }
    for (const smile of groundTruth.smiles) {
      const start = smile.at;
      const end = start + smile.durationMs;
      if (t < start - 80 || t > end + 200) continue;
      const amount = t < start ? (t - (start - 80)) / 80 : t > end ? 1 - (t - end) / 200 : 1;
      frame.mouthSmileLeft = 0.02 + 0.6 * amount;
      frame.mouthSmileRight = 0.02 + 0.6 * amount;
      frame.cheekSquintLeft = 0.3 * amount;
      frame.cheekSquintRight = 0.3 * amount;
    }

    // Sensor noise on every channel.
    if (noise) {
      for (const key of [
        "earLeft",
        "earRight",
        "eyeBlinkLeft",
        "eyeBlinkRight",
        "mouthSmileLeft",
        "mouthSmileRight",
        "cheekSquintLeft",
        "cheekSquintRight",
        "mouthClose",
        "jawOpen",
        "mouthPucker",
        "mouthCornerLeftX",
        "mouthCornerLeftY",
        "mouthCornerRightX",
        "mouthCornerRightY",
        "yaw",
        "pitch",
        "roll",
      ]) {
        frame[key] = noisy(next, frame[key], noise);
      }
    }

    // A one-frame glitch on a single channel.
    for (const spike of groundTruth.spikes) {
      if (Math.abs(t - spike.at) < step / 2 && frame[spike.channel] !== undefined) {
        frame[spike.channel] = frame[spike.channel] + (spike.amount ?? 0.5);
      }
    }

    frame.timestamp = Math.round(t * 1000) / 1000;
    frames.push(frame);
  }
  return { frames, groundTruth };
}

/** 0 → 1 → 0 envelope across a movement, with short ramps. */
function holdProfile(t, start, end) {
  const ramp = 120;
  if (t < start) return 0;
  if (t < start + ramp) return (t - start) / ramp;
  if (t < end) return 1;
  if (t < end + ramp) return 1 - (t - end) / ramp;
  return 0;
}
