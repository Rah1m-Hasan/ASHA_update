#!/usr/bin/env node
// Replays the synthetic labelled fixtures through the real domain modules and
// writes the metric table to artifacts/accuracy-{baseline,after}.json.
//
// The fixtures are synthetic. They measure algorithm behaviour, not human
// accuracy — see docs/ACCURACY_REPORT.md for that limitation in full.
//
//   node scripts/accuracy-benchmark.mjs            # writes artifacts/accuracy-baseline.json
//   node scripts/accuracy-benchmark.mjs --after    # writes artifacts/accuracy-after.json
//   node scripts/accuracy-benchmark.mjs --compare  # diffs baseline against after
//   node scripts/accuracy-benchmark.mjs --quiet    # numbers only, no table

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

import { rng } from "../tests/fixtures/random.mjs";
import { faceTrace } from "../tests/fixtures/face.mjs";
import { calibrationCapture, distort, gazeTrace } from "../tests/fixtures/gaze.mjs";
import { vitalTrace, noiseOnlyTrace, faceMotionStream } from "../tests/fixtures/vitals.mjs";
import { poseTrace } from "../tests/fixtures/posture.mjs";
import { handLandmarks, handSequence, partialHandLandmarks } from "../tests/fixtures/hands.mjs";
import { intentCases, languageCases, mismatchedSpeechPairs, retrievalGapQueries, retrievalQueries, speechPairs } from "../tests/fixtures/language.mjs";
import { MotionMeter } from "../public/engine/motion-meter.js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

/** Load a UMD module from public/ the way the browser does. */
function umd(relative) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  return vm.runInThisContext(
    "(function(module,require){" + source + ";return module.exports;})",
  )({ exports: {} }, (request) => umd(path.join(path.dirname(relative), request.replace("./", "").replace(".js", ""))));
}

const { VitalSense } = await import("../public/engine/vitalsense.js");
const { poseFeatures, RestTracker } = await import("../public/engine/signals.js");
const { retrieveKnowledge } = await import("../src/server/lib/retrieval.js");
const { createAshaOrchestrator, resolveLanguage } = await import("../src/server/lib/asha-orchestrator.js");
const { candidateMatchesHeard } = await import("../src/server/lib/speech-similarity.js");
const {
  calibrationTargets,
  calibrationFrameIsOutlier,
  fitGazeModel,
  gazeConfidence,
  predictGaze,
  validateGazeModel,
  DwellSelector,
  CHECK_TARGETS,
  MIN_GAZE_CONFIDENCE,
} = await import("../public/app/everyday/gaze-engine.js");
const E = umd("public/neuroface/src/engine.js");
const FS = umd("public/neuroface/src/fingerspeak-signal.js");

// ---------------------------------------------------------------- helpers

const round = (value, places = 4) =>
  Number.isFinite(value) ? Number(value.toFixed(places)) : value;

function rate(hits, total) {
  return total ? Number((hits / total).toFixed(4)) : null;
}

function prf(tp, fp, fn) {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    tp,
    fp,
    fn,
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
  };
}

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/** Wall-clock cost of `fn`, in milliseconds, over `runs` calls. */
function timing(fn, runs = 200) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return round(ms / runs, 6);
}

// ---------------------------------------------------------------- FaceSpeak

/** Replay a face trace through the real engine and collect what it did. */
function runFace(frames) {
  const engine = new E.Engine({ adapt: false });
  const events = [];
  const commands = [];
  const timeline = [];
  for (const frame of frames) {
    const result = engine.process(frame);
    events.push(...result.events);
    commands.push(...result.commands);
    timeline.push({
      t: frame.timestamp,
      accepted: result.accepted,
      reason: result.reason ?? null,
      outliers: result.features?.outliers ?? [],
      features: result.features ?? null,
    });
  }
  return { events, commands, timeline };
}

/** Match a detected event to the nearest ground-truth event of the same kind. */
function matchEvents(detected, truth, windowMs = 700) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const used = new Set();
  for (const event of detected) {
    let best = -1;
    let bestDistance = Infinity;
    truth.forEach((candidate, index) => {
      if (used.has(index)) return;
      const distance = Math.abs(candidate.at - event.timestamp);
      if (distance <= windowMs && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    if (best >= 0) {
      used.add(best);
      tp += 1;
    } else fp += 1;
  }
  fn = truth.length - tp;
  return { tp, fp, fn };
}

export function faceSpeakMetrics() {
  // Deliberate blinks: three in a window trigger the water command.
  const deliberate = faceTrace({
    seed: 11,
    durationMs: 30000,
    script: [
      { at: 2000, kind: "blink", durationMs: 420 },
      { at: 3200, kind: "blink", durationMs: 420 },
      { at: 4400, kind: "blink", durationMs: 420 },
      { at: 12000, kind: "blink", durationMs: 420 },
      { at: 13200, kind: "blink", durationMs: 420 },
      { at: 14400, kind: "blink", durationMs: 420 },
    ],
  });
  const deliberateRun = runFace(deliberate.frames);
  const deliberateBlink = matchEvents(
    deliberateRun.events.filter((e) => e.type === "BLINK_COMPLETED"),
    deliberate.groundTruth.blinks,
  );

  // Ordinary blinks must never command.
  const ordinary = faceTrace({
    seed: 12,
    durationMs: 60000,
    script: Array.from({ length: 30 }, (_, i) => ({
      at: 1000 + i * 1900,
      kind: "blink",
      durationMs: 120,
      deliberate: false,
    })),
  });
  const ordinaryRun = runFace(ordinary.frames);
  const ordinaryBlink = matchEvents(
    ordinaryRun.events.filter((e) => e.type === "BLINK_COMPLETED"),
    ordinary.groundTruth.blinks,
  );
  const commandsFromOrdinary = ordinaryRun.commands.length;
  // False activations per hour, over the 60 s trace.
  const falseActivationsPerHour = commandsFromOrdinary * (3600000 / 60000);

  // Head turns.
  const turns = faceTrace({
    seed: 13,
    durationMs: 30000,
    script: [
      { at: 2000, kind: "turn", side: "left", degrees: 24 },
      { at: 8000, kind: "turn", side: "right", degrees: 24 },
      { at: 14000, kind: "turn", side: "left", degrees: 24 },
      { at: 20000, kind: "turn", side: "right", degrees: 24 },
    ],
  });
  const turnRun = runFace(turns.frames);
  const turnTruth = turns.groundTruth.turns.map((turn) => ({
    at: turn.at,
    side: turn.side,
  }));
  let turnTp = 0;
  let turnFp = 0;
  const turnUsed = new Set();
  for (const event of turnRun.events) {
    if (event.type !== "LEFT_TURN_COMPLETED" && event.type !== "RIGHT_TURN_COMPLETED")
      continue;
    const side = event.type === "LEFT_TURN_COMPLETED" ? "left" : "right";
    let best = -1;
    let bestDistance = Infinity;
    turnTruth.forEach((candidate, index) => {
      if (used(index)) return;
      const distance = Math.abs(candidate.at - event.timestamp);
      if (distance <= 900 && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    if (best >= 0 && turnTruth[best].side === side) {
      turnUsed.add(best);
      turnTp += 1;
    } else turnFp += 1;
  }
  function used(index) {
    return turnUsed.has(index);
  }
  const turnFn = turnTruth.length - turnTp;

  // Frame rejection: how often one noisy channel destroys a whole frame.
  const clean = faceTrace({ seed: 14, durationMs: 6000 });
  const cleanRun = runFace(clean.frames);
  const spiky = faceTrace({
    seed: 14,
    durationMs: 6000,
    script: [{ at: 2000, kind: "spike", channel: "mouthCornerLeftX", amount: 0.6 }],
  });
  const spikyRun = runFace(spiky.frames);
  const rejected = spikyRun.timeline.filter((row) => !row.accepted).length;
  let longestCascade = 0;
  let currentCascade = 0;
  for (const row of spikyRun.timeline) {
    if (!row.accepted) {
      currentCascade += 1;
      longestCascade = Math.max(longestCascade, currentCascade);
    } else currentCascade = 0;
  }
  const cleanRejected = cleanRun.timeline.filter((row) => !row.accepted).length;

  // A rejected frame resets the filter, so the frame right after it becomes a
  // fresh reference and is never checked for outliers. Two glitches on
  // different channels, one frame apart, show this: the second is accepted
  // and poisons the reference, so the clean frame after it is the one that
  // gets rejected.
  const doubleSpike = faceTrace({
    seed: 14,
    durationMs: 6000,
    script: [
      { at: 2000, kind: "spike", channel: "mouthCornerLeftX", amount: 0.6 },
      { at: 2033, kind: "spike", channel: "mouthCornerLeftY", amount: 0.6 },
    ],
  });
  const doubleRun = runFace(doubleSpike.frames);
  const spikeTimes = new Set(doubleSpike.groundTruth.spikes.map((s) => s.at));
  const rejectedAt = new Map();
  for (const row of doubleRun.timeline) {
    if (!row.accepted) rejectedAt.set(row.t, row.reason);
  }
  // A glitch is "caught" when the frame carrying it names the offending
  // channel as an outlier. The frame itself survives: the channel carries its
  // last filtered value forward instead of the raw spike.
  const caughtSpikes = [...spikeTimes].filter((at) =>
    doubleRun.timeline.some(
      (row) => Math.abs(row.t - at) <= 17 && row.outliers.length > 0,
    ),
  );
  // A frame with no glitch in it must never be rejected.
  const falseRejections = [...rejectedAt.entries()].filter(
    ([t]) => ![...spikeTimes].some((at) => Math.abs(t - at) <= 17),
  );
  // And the glitch itself must not reach the feature vector: a channel named
  // as an outlier has to carry its previous filtered value forward.
  let leakedGlitches = 0;
  doubleRun.timeline.forEach((row, index) => {
    if (!row.outliers.length || !row.features) return;
    const previous = doubleRun.timeline[index - 1]?.features;
    if (!previous) return;
    for (const channel of row.outliers) {
      if (row.features[channel] !== previous[channel]) leakedGlitches++;
    }
  });

  // A spike in the middle of a deliberate blink: does the blink survive?
  const blinkWithSpike = faceTrace({
    seed: 15,
    durationMs: 6000,
    script: [
      { at: 1000, kind: "blink", durationMs: 420 },
      { at: 1200, kind: "spike", channel: "mouthCornerLeftX", amount: 0.6 },
    ],
  });
  const blinkSpikeRun = runFace(blinkWithSpike.frames);
  const blinkSurvived = blinkSpikeRun.events.some((e) => e.type === "BLINK_COMPLETED");
  const blinkWithoutSpike = runFace(
    faceTrace({
      seed: 15,
      durationMs: 6000,
      script: [{ at: 1000, kind: "blink", durationMs: 420 }],
    }).frames,
  ).events.some((e) => e.type === "BLINK_COMPLETED");

  // A patient whose open eye is narrower than the population default
  // (0.27). With the reference pinned to the default, the ratio never reaches
  // the open threshold, the blink state machine never arms, and none of this
  // patient's blinks are detected at all.
  const lowEar = faceTrace({
    seed: 16,
    durationMs: 30000,
    ear: 0.18,
    script: [
      { at: 2000, kind: "blink", durationMs: 420 },
      { at: 5000, kind: "blink", durationMs: 420 },
      { at: 9000, kind: "blink", durationMs: 420 },
    ],
  });
  const lowEarRun = runFace(lowEar.frames);
  const lowEarBlink = matchEvents(
    lowEarRun.events.filter((e) => e.type === "BLINK_COMPLETED"),
    lowEar.groundTruth.blinks,
  );

  return {
    deliberateBlink: prf(deliberateBlink.tp, deliberateBlink.fp, deliberateBlink.fn),
    ordinaryBlink: prf(ordinaryBlink.tp, ordinaryBlink.fp, ordinaryBlink.fn),
    lowEarBlink: prf(lowEarBlink.tp, lowEarBlink.fp, lowEarBlink.fn),
    commandsFromOrdinaryBlinks: commandsFromOrdinary,
    falseActivationsPerHour: round(falseActivationsPerHour, 2),
    headTurn: prf(turnTp, turnFp, turnFn),
    frameRejection: {
      cleanRejectedFrames: cleanRejected,
      cleanTotalFrames: clean.frames.length,
      cleanRejectionRate: rate(cleanRejected, clean.frames.length),
      spikedRejectedFrames: rejected,
      spikedRejectionRate: rate(rejected, spiky.frames.length),
      longestRejectionCascadeFrames: longestCascade,
      // Of two glitches one frame apart, how many were caught?
      glitchesInjected: spikeTimes.size,
      glitchesCaught: caughtSpikes.length,
      missedGlitches: spikeTimes.size - caughtSpikes.length,
      // A rejected channel that let its raw value through anyway.
      leakedGlitchValues: leakedGlitches,
      // Clean frames wrongly rejected because the reference was poisoned.
      falseRejections: falseRejections.length,
      falseRejectionReasons: falseRejections.map(([, reason]) => reason),
      // A spike during a blink destroys the blink.
      blinkDetectedWithoutSpike: blinkWithoutSpike,
      blinkDetectedWithSpike: blinkSurvived,
      blinkLostToSpike: blinkWithoutSpike && !blinkSurvived,
    },
  };
}

// ---------------------------------------------------------------- EyeSpeak

export function eyeSpeakMetrics() {
  const targets = calibrationTargets(9);

  // Clean calibration.
  const clean = calibrationCapture({
    targets,
    framesPerTarget: 30,
    seed: 21,
    jitter: 0.004,
  });
  const cleanModel = fitGazeModel(clean.samples.map((s) => ({ features: s.features, x: s.x, y: s.y })));
  const cleanCheck = calibrationCapture({
    targets: CHECK_TARGETS,
    framesPerTarget: 20,
    seed: 22,
    jitter: 0.004,
  });
  const cleanValidation = validateGazeModel(
    cleanModel,
    cleanCheck.samples.map((s) => ({ features: s.features, x: s.x, y: s.y })),
  );

  // Contaminated calibration: 15% of the captured frames are mid-saccade.
  const dirty = calibrationCapture({
    targets,
    framesPerTarget: 30,
    seed: 21,
    jitter: 0.004,
    contamination: 0.15,
  });
  const dirtyModel = fitGazeModel(dirty.samples.map((s) => ({ features: s.features, x: s.x, y: s.y })));
  const dirtyValidation = validateGazeModel(
    dirtyModel,
    cleanCheck.samples.map((s) => ({ features: s.features, x: s.x, y: s.y })),
  );

  // The capture-time rule: a frame that is far from the other frames of its
  // own target is not a frame of that target. The same contaminated capture,
  // with those frames left out.
  const keptSamples = [];
  for (const [x, y] of targets) {
    const group = dirty.samples.filter((s) => s.x === x && s.y === y);
    const kept = [];
    for (const sample of group) {
      if (calibrationFrameIsOutlier(sample.features, kept.map((k) => k.features)))
        continue;
      kept.push(sample);
    }
    keptSamples.push(...kept);
  }
  const cleanedModel = fitGazeModel(
    keptSamples.map((s) => ({ features: s.features, x: s.x, y: s.y })),
  );
  const cleanedValidation = validateGazeModel(
    cleanedModel,
    cleanCheck.samples.map((s) => ({ features: s.features, x: s.x, y: s.y })),
  );

  // Target selection accuracy: hold each tile on the board and let the real
  // DwellSelector choose, then check the tile it picked is the one the
  // patient was looking at. The 3x3 grid mirrors the 9-tile board.
  const grid = [0.12, 0.5, 0.88];
  const board = [];
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      board.push({ id: `t${row}-${column}`, x: grid[column], y: grid[row] });
    }
  }
  const tileAt = (px, py) => {
    let best = null;
    let bestDistance = Infinity;
    for (const tile of board) {
      const distance = Math.hypot(px - tile.x, py - tile.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = tile;
      }
    }
    return best;
  };

  const selection = { correct: 0, total: 0 };
  const errors = [];
  for (const [x, y] of targets) {
    const trace = gazeTrace({
      target: [x, y],
      fps: 30,
      durationMs: 5000,
      seed: 23,
      tremor: 0.006,
    });
    const dwell = new DwellSelector({ dwellMs: 800, maxGapMs: 900 });
    let chosen = null;
    for (const frame of trace.frames) {
      const prediction = predictGaze(cleanModel, frame.features, { requireValidation: false });
      if (!prediction.valid) {
        dwell.update(null, frame.t, false);
        continue;
      }
      errors.push(Math.hypot(prediction.x - x, prediction.y - y));
      const picked = dwell.update(tileAt(prediction.x, prediction.y)?.id ?? null, frame.t, true);
      if (picked) chosen = picked;
    }
    selection.total += 1;
    const expectedTile = tileAt(x, y);
    if (chosen === expectedTile?.id) selection.correct += 1;
  }

  // The confidence: how well a clean observation fits the calibration, and
  // how well a frame the tracker got wrong fits it. The two eyes disagree in
  // the wrong frame, which no screen position can explain.
  const cleanConfidence = Math.min(
    ...clean.samples.map((s) => gazeConfidence(cleanModel, s.features)),
  );
  const distortedConfidence = Math.max(
    ...clean.samples.map((s) => gazeConfidence(cleanModel, distort(s.features))),
  );

  // A trace with frames the tracker got wrong. The confidence says so, and a
  // low-confidence point must not drive a dwell.
  const guarded = { correct: 0, total: 0 };
  const unguarded = { correct: 0, total: 0 };
  for (const [x, y] of targets) {
    const trace = gazeTrace({
      target: [x, y],
      fps: 30,
      durationMs: 5000,
      seed: 23,
      tremor: 0.006,
    });
    const frames = trace.frames.map((frame, index) => ({
      ...frame,
      features: index % 5 === 2 ? distort(frame.features) : frame.features,
    }));
    for (const mode of ["guarded", "unguarded"]) {
      const dwell = new DwellSelector({ dwellMs: 800, maxGapMs: 900 });
      let chosen = null;
      for (const frame of frames) {
        const prediction = predictGaze(cleanModel, frame.features, {
          requireValidation: false,
        });
        const usable =
          prediction.valid &&
          (mode === "unguarded" ||
            (prediction.confidence ?? 1) >= MIN_GAZE_CONFIDENCE);
        // A frame that cannot be used carries no information, so it is
        // skipped: the selection pauses and carries on, exactly as the board
        // does for a blink. It is not a failure of the tracking.
        if (!usable) continue;
        const picked = dwell.update(tileAt(prediction.x, prediction.y)?.id ?? null, frame.t, true);
        if (picked) chosen = picked;
      }
      const expectedTile = tileAt(x, y);
      const ok = chosen === expectedTile?.id;
      if (mode === "guarded") {
        guarded.total += 1;
        if (ok) guarded.correct += 1;
      } else {
        unguarded.total += 1;
        if (ok) unguarded.correct += 1;
      }
    }
  }

  return {
    cleanCalibration: {
      meanError: round(cleanValidation.meanError),
      p90Error: round(cleanValidation.p90Error),
      passed: cleanValidation.passed,
    },
    contaminatedCalibration: {
      meanError: round(dirtyValidation.meanError),
      p90Error: round(dirtyValidation.p90Error),
      passed: dirtyValidation.passed,
    },
    cleanedCalibration: {
      meanError: round(cleanedValidation.meanError),
      p90Error: round(cleanedValidation.p90Error),
      passed: cleanedValidation.passed,
      framesKept: keptSamples.length,
      framesCaptured: dirty.samples.length,
      framesContaminated: dirty.truth.contaminated,
    },
    targetSelection: {
      correct: selection.correct,
      total: selection.total,
      accuracy: rate(selection.correct, selection.total),
    },
    confidence: {
      cleanMin: round(cleanConfidence, 3),
      distortedMax: round(distortedConfidence, 3),
      threshold: MIN_GAZE_CONFIDENCE,
    },
    guardedSelection: {
      guarded: rate(guarded.correct, guarded.total),
      unguarded: rate(unguarded.correct, unguarded.total),
    },
    liveError: {
      mean: round(errors.reduce((a, b) => a + b, 0) / (errors.length || 1)),
      p90: round(percentile(errors, 0.9)),
    },
  };
}

// ---------------------------------------------------------------- VitalSense

export function vitalSenseMetrics() {
  const recovered = [];
  for (const bpm of [54, 66, 78, 96, 120]) {
    const engine = new VitalSense();
    let value;
    for (const row of vitalTrace({ bpm, seconds: 20, seed: 30 + bpm })) value = engine.add(row);
    recovered.push({ bpm, reported: value.bpm, status: value.status, error: value.bpm ? Math.abs(value.bpm - bpm) : null });
  }
  const errors = recovered.filter((r) => r.error !== null).map((r) => r.error);

  // The control: no pulse at all. Any number here is a fabricated reading.
  const noiseRuns = [];
  for (let seed = 40; seed < 50; seed++) {
    const engine = new VitalSense();
    let value;
    for (const row of noiseOnlyTrace({ seconds: 20, seed })) value = engine.add(row);
    noiseRuns.push({ seed, bpm: value.bpm, status: value.status, reason: value.reason });
  }
  const falseReadings = noiseRuns.filter((run) => run.bpm !== null);

  // Motion rejection.
  const motionEngine = new VitalSense();
  let motionValue;
  for (const row of vitalTrace({ bpm: 78, seconds: 20, seed: 60 })) motionValue = motionEngine.add(row);
  const beforeMotion = motionValue.bpm;
  const afterMotion = motionEngine.add({
    t: 21000,
    rgb: [0.56, 0.43, 0.32],
    headY: 0.5,
    motion: 0.2,
    roiCount: 3,
  });

  // Low light.
  const darkEngine = new VitalSense();
  let darkValue;
  for (const row of vitalTrace({ bpm: 78, seconds: 20, seed: 61, rgb: [0.05, 0.04, 0.03] })) darkValue = darkEngine.add(row);

  return {
    recovery: recovered.map((r) => ({ ...r, error: round(r.error, 2) })),
    meanAbsoluteError: round(errors.reduce((a, b) => a + b, 0) / (errors.length || 1), 3),
    maxAbsoluteError: round(Math.max(0, ...errors), 2),
    noiseOnlyRuns: noiseRuns.length,
    noiseOnlyFalseReadings: falseReadings.length,
    noiseOnlyFalseReadingRate: rate(falseReadings.length, noiseRuns.length),
    noiseOnlyExamples: falseReadings.slice(0, 5),
    motionRejection: {
      beforeMotionBpm: beforeMotion,
      afterMotionBpm: afterMotion.bpm,
      rejected: afterMotion.bpm === null,
    },
    lowLightRejected: darkValue.bpm === null,
  };
}

// ------------------------------------------------------------------ Motion gate

/**
 * The face-motion estimate that guarded the VitalSense window before the
 * Wave 1 change, kept here so the before/after numbers stay reproducible.
 *
 * It took the displacement between two CONSECUTIVE face results, divided by
 * the time between them, and smoothed it with per-sample weights:
 *
 *     sample = meanLandmarkDisplacement / elapsedSeconds
 *     value  = 0.7 * value + 0.3 * sample
 */
function legacyMotionEstimate(frames) {
  const values = [];
  let value = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i].landmarks;
    const b = frames[i - 1].landmarks;
    const elapsed = frames[i].t - frames[i - 1].t;
    let displacement = 0;
    let count = 0;
    for (let j = 0; j < Math.min(a.length, b.length); j += 8) {
      displacement += Math.hypot(a[j].x - b[j].x, a[j].y - b[j].y);
      count++;
    }
    const sample = (displacement / Math.max(1, count) * 1000) / elapsed;
    value = 0.7 * value + 0.3 * sample;
    values.push(value);
  }
  return values;
}

/**
 * The face-motion estimate that guards the VitalSense window.
 *
 * The gate threshold is 0.075 normalised landmark units per second. Two
 * properties decide whether the gate means anything: a still face must stay
 * below the gate at EVERY frame rate (a face that jitters more on a fast
 * device must not read as moving), and a moving face must cross it at every
 * frame rate.
 */
export function motionGateMetrics() {
  const gate = 0.075;
  const fpsList = [10, 20, 30, 40];

  const measure = (frames) => {
    const meter = new MotionMeter();
    const values = frames.map((frame) => meter.update(frame.t, frame.landmarks));
    const sorted = [...values].sort((a, b) => a - b);
    return {
      median: sorted[Math.floor(sorted.length / 2)],
      trips: values.filter((v) => v > gate).length,
      total: values.length,
      firstTripMs: (() => {
        const index = values.findIndex((v) => v > gate);
        return index < 0 ? null : Math.round((frames[index].t - frames[0].t) * 10) / 10;
      })(),
    };
  };

  const legacyMeasure = (frames) => {
    const values = legacyMotionEstimate(frames);
    const sorted = [...values].sort((a, b) => a - b);
    return {
      median: sorted[Math.floor(sorted.length / 2)],
      trips: values.filter((v) => v > gate).length,
      total: values.length,
    };
  };

  const still = fpsList.map((fps) => ({ fps, ...measure(faceMotionStream({ fps })) }));
  const noisy = fpsList.map((fps) => ({
    fps,
    ...measure(faceMotionStream({ fps, jitter: 0.002 })),
  }));
  const moving = fpsList.map((fps) => ({ fps, ...measure(faceMotionStream({ fps, motion: 0.15 })) }));
  const shake = [1, 2, 3, 4, 6].map((hz) => ({
    hz,
    ...measure(faceMotionStream({ fps: 30, shakeHz: hz })),
  }));

  const legacyStill = fpsList.map((fps) => ({ fps, ...legacyMeasure(faceMotionStream({ fps })) }));
  const legacyNoisy = fpsList.map((fps) => ({
    fps,
    ...legacyMeasure(faceMotionStream({ fps, jitter: 0.002 })),
  }));

  const readings = still.map((row) => row.median);
  return {
    gate,
    stillMedianByFps: still.map((row) => ({ fps: row.fps, median: round(row.median, 4) })),
    stillMedianSpread: round(Math.max(...readings) - Math.min(...readings), 4),
    stillFalseTrips: still.reduce((sum, row) => sum + row.trips, 0),
    noisyStillMedianByFps: noisy.map((row) => ({ fps: row.fps, median: round(row.median, 4) })),
    noisyStillFalseTrips: noisy.reduce((sum, row) => sum + row.trips, 0),
    movingDetectedFractionByFps: moving.map((row) => ({
      fps: row.fps,
      fraction: round(row.trips / row.total, 3),
      latencyMs: row.firstTripMs,
    })),
    shakeDetectedFractionByHz: shake.map((row) => ({
      hz: row.hz,
      fraction: round(row.trips / row.total, 3),
    })),
    // The formula this replaced, measured on the same fixtures.
    legacy: {
      stillMedianByFps: legacyStill.map((row) => ({ fps: row.fps, median: round(row.median, 4) })),
      stillFalseTrips: legacyStill.reduce((sum, row) => sum + row.trips, 0),
      noisyStillFalseTrips: legacyNoisy.reduce((sum, row) => sum + row.trips, 0),
    },
  };
}

// ---------------------------------------------------------------- FingerSpeak

export function fingerSpeakMetrics() {  // A stable open hand, and the same hand with detection dropouts.
  const steady = handSequence({ fps: 20, durationMs: 6000, open: true, seed: 70 });
  const steadyTracker = new FS.PoseTracker(800);
  let steadyFlips = 0;
  let lastPose = null;
  for (const frame of steady) {
    const states = steadyTracker.update(frame.hands, frame.t);
    for (const state of states) {
      if (lastPose && state.pose !== lastPose) steadyFlips += 1;
      lastPose = state.pose;
    }
  }

  const flickery = handSequence({
    fps: 20,
    durationMs: 6000,
    open: true,
    seed: 70,
    dropouts: Array.from({ length: 12 }, (_, i) => 10 + i * 15),
  });
  const flickerTracker = new FS.PoseTracker(800);
  let flickerFlips = 0;
  let observingFrames = 0;
  let totalFrames = 0;
  let flickerLastPose = null;
  for (const frame of flickery) {
    const states = flickerTracker.update(frame.hands, frame.t);
    for (const state of states) {
      totalFrames += 1;
      if (state.pose === "Observing…") observingFrames += 1;
      if (flickerLastPose && state.pose !== flickerLastPose) flickerFlips += 1;
      flickerLastPose = state.pose;
    }
  }

  // How long after a dropout does the stable pose come back? The dropout
  // happens after the pose has settled, so this is the flicker case.
  const recovery = [];
  for (const dropout of [30, 40, 50]) {
    const sequence = handSequence({
      fps: 20,
      durationMs: 4000,
      open: true,
      seed: 70,
      dropouts: [dropout],
    });
    const tracker = new FS.PoseTracker(800);
    let recoveredAt = null;
    const dropoutFrame = sequence[dropout];
    for (const frame of sequence) {
      // The tracker sees every frame; the recovery is only looked for from
      // the dropout onwards.
      const states = tracker.update(frame.hands, frame.t);
      if (frame.t < dropoutFrame.t) continue;
      if (states.length && states[0].pose === "Open palm") {
        recoveredAt = frame.t - dropoutFrame.t;
        break;
      }
    }
    recovery.push({ dropoutFrame, recoveryMs: recoveredAt });
  }

  // The same measurement before the grace: a hand that was missed for one
  // frame lost its pose, so it had to be held again before it counted.
  const legacyTracker = (holdMs) => {
    const states = new Map();
    return (hands, t) => {
      const seen = new Set();
      const result = hands.map((hand, i) => {
        const key = hand.id || hand.label || `slot-${i}`;
        const pose = FS.classifyPose(hand.lm);
        seen.add(key);
        let state = states.get(key);
        if (!state || state.candidate !== pose.name) state = { candidate: pose.name, since: t, stable: "Observing…" };
        if (t - state.since >= holdMs) state.stable = pose.name;
        states.set(key, state);
        return { id: key, pose: state.stable, stale: false };
      });
      for (const key of Array.from(states.keys())) if (!seen.has(key)) states.delete(key);
      return result;
    };
  };
  const legacyRecovery = [];
  for (const dropout of [30, 40, 50]) {
    const sequence = handSequence({
      fps: 20,
      durationMs: 4000,
      open: true,
      seed: 70,
      dropouts: [dropout],
    });
    const tracker = legacyTracker(800);
    let recoveredAt = null;
    const dropoutFrame = sequence[dropout];
    for (const frame of sequence) {
      const states = tracker(frame.hands, frame.t);
      if (frame.t < dropoutFrame.t) continue;
      if (states.length && states[0].pose === "Open palm") {
        recoveredAt = frame.t - dropoutFrame.t;
        break;
      }
    }
    legacyRecovery.push(recoveredAt);
  }

  // The score the distance-based models used to produce, and the score they
  // produce now. The old score depended on the model's own distance scale,
  // so one cut-off meant something different for every model.
  const scoreComparability = { legacy: {}, normalised: {} };
  for (const scale of [0.1, 1, 10]) {
    const distances = [scale, 2 * scale, 3 * scale, 4 * scale, 5 * scale];
    const legacy = distances.map((d) => 1 / (1 + d));
    const legacyTotal = legacy.reduce((a, b) => a + b, 0) || 1;
    scoreComparability.legacy[scale] = round(legacy[0] / legacyTotal, 4);
    const normalised = distances.map((d) => FS.distanceSimilarity(d, scale));
    const normalisedTotal = normalised.reduce((a, b) => a + b, 0) || 1;
    scoreComparability.normalised[scale] = round(normalised[0] / normalisedTotal, 4);
  }

  // A person whose fingers do not straighten fully: the fixed levels are
  // never reached, the person's own levels are.
  const partialTracker = new FS.PoseTracker(180);
  let partialT = 0;
  for (let i = 0; i < 5; i++) {
    partialT += 200;
    partialTracker.update([{ lm: handLandmarks({ open: false }), label: "right" }], partialT);
  }
  let partialPose = null;
  for (let i = 0; i < 10; i++) {
    partialT += 200;
    partialPose = partialTracker.update([{ lm: partialHandLandmarks({ amount: 0.6 }), label: "right" }], partialT)[0].pose;
  }
  const fixedPose = FS.classifyPose(partialHandLandmarks({ amount: 0.6 })).name;

  return {
    steadyPoseFlips: steadyFlips,
    flickerPoseFlips: flickerFlips,
    observingFrameRate: rate(observingFrames, totalFrames),
    recoveryAfterDropoutMs: recovery.map((r) => round(r.recoveryMs, 1)),
    legacyRecoveryAfterDropoutMs: legacyRecovery.map((r) => round(r, 1)),
    scoreComparability: scoreComparability,
    partialOpenness: { fixedLevels: fixedPose, ownLevels: partialPose },
  };
}

// ---------------------------------------------------------------- Posture

export function postureMetrics() {
  // Noise-only posture: the label must not flap.
  const noisy = poseTrace({ fps: 2, durationMs: 120000, seed: 80, noise: 0.006 });
  let previous = null;
  const labels = [];
  const rawLabels = [];
  for (const frame of noisy) {
    const features = poseFeatures(frame.landmarks, previous, frame.t);
    previous = features.valid ? features : previous;
    labels.push(features.label);
    rawLabels.push(features.rawLabel ?? features.label);
  }
  let flips = 0;
  for (let i = 1; i < labels.length; i++) if (labels[i] !== labels[i - 1]) flips += 1;
  // The label before the hysteresis was added: the raw reading on every
  // sample, with no hold.
  let rawFlips = 0;
  for (let i = 1; i < rawLabels.length; i++)
    if (rawLabels[i] !== rawLabels[i - 1]) rawFlips += 1;

  // A lean that hovers on the sideways threshold: the raw reading flips on
  // every noisy sample, and the label has to hold.
  const marginal = poseTrace({ fps: 10, durationMs: 120000, seed: 83, lean: 25, noise: 0.008 });
  let marginalLabels = [];
  let marginalRaw = [];
  previous = null;
  for (const frame of marginal) {
    const features = poseFeatures(frame.landmarks, previous, frame.t);
    previous = features.valid ? features : previous;
    marginalLabels.push(features.label);
    marginalRaw.push(features.rawLabel ?? features.label);
  }
  const countFlips = (list) => {
    let n = 0;
    for (let i = 1; i < list.length; i++) if (list[i] !== list[i - 1]) n += 1;
    return n;
  };

  // A small lean must not be reported as sideways, and a real lean must be.
  const leaning = poseTrace({ fps: 2, durationMs: 120000, seed: 81, lean: 12 });
  let sidewaysFrames = 0;
  let totalFrames = 0;
  previous = null;
  for (const frame of leaning) {
    const features = poseFeatures(frame.landmarks, previous, frame.t);
    previous = features.valid ? features : previous;
    totalFrames += 1;
    if (features.sideways) sidewaysFrames += 1;
  }
  const strongLean = poseTrace({ fps: 2, durationMs: 120000, seed: 84, lean: 40 });
  let strongSideways = 0;
  previous = null;
  for (const frame of strongLean) {
    const features = poseFeatures(frame.landmarks, previous, frame.t);
    previous = features.valid ? features : previous;
    if (features.sideways) strongSideways += 1;
  }

  // The rest detector as the pipeline drives it: the pose arrives every
  // 500 ms and each pose sample is consumed once, so the face frames in
  // between carry no new motion sample at all.
  const rest = new RestTracker();
  let cue = null;
  let spikeDelivered = false;
  for (let t = 0; t <= 70000; t += 33) {
    const isPose = t % 500 === 0;
    const spike = isPose && !spikeDelivered && t >= 30000;
    if (spike) spikeDelivered = true;
    cue = rest.update({
      t,
      valid: true,
      closed: true,
      motion: isPose ? (spike ? 0.2 : 0) : null,
      motionRate: isPose ? (spike ? 0.4 : 0) : null,
    });
  }
  const restingAfterSpike = rest.resting;

  // The same window through the previous rule: the stale motion value was
  // replayed on every face frame, and one sample above the threshold cleared
  // the whole closed-eye accumulator. Kept so the before/after is permanent.
  let legacyClosedSince = null;
  let legacyResting = false;
  let legacyMotion = 0;
  let legacySpike = false;
  for (let t = 0; t <= 70000; t += 33) {
    const isPose = t % 500 === 0;
    if (isPose) {
      legacySpike = !legacySpike && t >= 30000;
      legacyMotion = legacySpike ? 0.2 : 0;
    }
    if (legacyMotion > 0.04) {
      legacyClosedSince = null;
    } else {
      legacyClosedSince ??= t;
      if (t - legacyClosedSince >= 60000) legacyResting = true;
    }
  }

  // A landmark set that publishes no visibility scores at all must not make
  // the whole pose invisible.
  const noVisibility = poseTrace({ fps: 2, durationMs: 2000, seed: 82 })[0].landmarks.map(
    (p) => ({ x: p.x, y: p.y, z: p.z }),
  );
  const withoutScores = poseFeatures(noVisibility, null, 0);

  return {
    labelFlipsUnderNoise: flips,
    rawLabelFlipsUnderNoise: rawFlips,
    totalFrames: labels.length,
    flipRatePerMinute: round((flips / (labels.length / 120)) * 60, 3),
    rawFlipRatePerMinute: round((rawFlips / (labels.length / 120)) * 60, 3),
    marginalLabelFlips: countFlips(marginalLabels),
    marginalRawLabelFlips: countFlips(marginalRaw),
    marginalFlipRatePerMinute: round(
      (countFlips(marginalLabels) / (marginalLabels.length / 120)) * 60,
      3,
    ),
    marginalRawFlipRatePerMinute: round(
      (countFlips(marginalRaw) / (marginalRaw.length / 120)) * 60,
      3,
    ),
    sidewaysDetectionRateUnderLean: rate(sidewaysFrames, totalFrames),
    sidewaysDetectionRateUnderStrongLean: rate(strongSideways, strongLean.length),
    restSurvivesSingleMotionSpike: restingAfterSpike,
    legacyRestSurvivesSingleMotionSpike: legacyResting,
    restCue: cue,
    poseValidWithoutVisibilityScores: withoutScores.valid,
  };
}

// ---------------------------------------------------------------- Language

export async function languageMetrics() {
  const retrieval = [];
  for (const item of retrievalQueries) {
    const results = retrieveKnowledge({ query: item.query, limit: 3 });
    const top = results[0];
    retrieval.push({
      query: item.query,
      topId: top?.id ?? null,
      hit: !!top && item.expect(top.id),
      hitsInTop3: results.filter((r) => item.expect(r.id)).length,
    });
  }
  const hits = retrieval.filter((r) => r.hit).length;

  // Queries about a module the knowledge bundle has no concept for. These are
  // measured so the gap is visible rather than hidden by a loose fixture.
  const gaps = [];
  for (const item of retrievalGapQueries) {
    const results = retrieveKnowledge({ query: item.query, limit: 3 });
    gaps.push({
      query: item.query,
      module: item.module,
      topId: results[0]?.id ?? null,
      answeredByOtherModule: !!results[0] && !results[0].id.includes(`:${item.module}:`),
    });
  }

  // SenseAssist intent: the local matcher must find the need in the message
  // and must not invent one. It is reached the way the product reaches it —
  // through the orchestrator's tool verification — because it is not exported.
  const intentDetails = [];
  let correct = 0;
  for (const item of intentCases) {
    const found = await requestIntentThroughOrchestrator(item.text);
    const ok = found === item.expected;
    if (ok) correct += 1;
    intentDetails.push({ text: item.text, expected: item.expected, found, ok });
  }

  // The clarification check: a suggested meaning that is a reading of the
  // heard words is kept, and one that is not is refused.
  const readings = speechPairs.filter((pair) => pair.reading !== false);
  const acceptedReadings = readings.filter((pair) =>
    candidateMatchesHeard(pair.heard, pair.confirmed),
  );
  const refusedReadings = readings.filter(
    (pair) => !candidateMatchesHeard(pair.heard, pair.confirmed),
  );
  const wronglyAccepted = mismatchedSpeechPairs.filter((pair) =>
    candidateMatchesHeard(pair.heard, pair.candidate),
  );

  // Which language the words are in.
  const languageDetails = languageCases.map((item) => ({
    text: item.text,
    expected: item.expected,
    found: resolveLanguage(item.text),
  }));
  const languageCorrect = languageDetails.filter(
    (item) => item.found === item.expected,
  ).length;

  return {
    retrieval: {
      queries: retrieval.length,
      top1Hits: hits,
      top1Accuracy: rate(hits, retrieval.length),
      details: retrieval,
    },
    clarification: {
      readings: readings.length,
      accepted: acceptedReadings.length,
      acceptRate: rate(acceptedReadings.length, readings.length),
      refused: refusedReadings.map((pair) => pair.heard),
      mismatched: mismatchedSpeechPairs.length,
      wronglyAccepted: wronglyAccepted.map((pair) => pair.heard),
      wrongAcceptRate: rate(wronglyAccepted.length, mismatchedSpeechPairs.length),
    },
    languageResolution: {
      cases: languageCases.length,
      correct: languageCorrect,
      accuracy: rate(languageCorrect, languageCases.length),
      details: languageDetails,
    },
    retrievalGaps: {
      queries: gaps.length,
      answeredByOtherModule: gaps.filter((g) => g.answeredByOtherModule).length,
      details: gaps,
    },
    intent: {
      cases: intentCases.length,
      correct,
      accuracy: rate(correct, intentCases.length),
      failures: intentDetails.filter((d) => !d.ok),
    },
    speechPairs: speechPairs.length,
  };
}

/**
 * The orchestrator proposes a caregiver request only when the deterministic
 * matcher agrees with it, and falls back to that matcher's own answer when
 * the model proposes nothing. So the request that comes back is the matcher's
 * decision, whatever the model said.
 */
async function requestIntentThroughOrchestrator(text) {
  const provider = {
    async ask() {
      return {
        text: JSON.stringify({ reply: "I understand.", source_ids: [] }),
        model: "test",
        task: "conversation",
        profileName: "test",
        elapsedMs: 1,
        fallback: false,
      };
    },
  };
  const orchestrator = createAshaOrchestrator({ provider });
  const result = await orchestrator.run({
    patientId: "fixture",
    profile: { assessment: {}, supportContext: {} },
    text,
    module: "companion",
    mode: "chat",
    language: "en",
  });
  return result.proposal?.kind ?? null;
}

// ---------------------------------------------------------------- Orchestrator

export async function orchestratorMetrics() {
  const profile = {
    assessment: { eyes: "reliable", head: "limited", speech: "limited" },
    supportContext: { categories: [], goals: [], note: "" },
  };

  const adversarial = [
    {
      name: "unparseable output",
      text: "Water is on the way.",
      // The raw model text must never reach the patient.
      forbidden: ["Water is on the way."],
    },
    {
      name: "empty citations reported as verified",
      text: JSON.stringify({ reply: "Drink water.", source_ids: [] }),
      forbidden: [],
    },
    {
      name: "wrong citation",
      text: JSON.stringify({ reply: "Drink water.", source_ids: ["guide:nosuch:1"] }),
      forbidden: ["Drink water."],
    },
    {
      name: "unsupported action claim",
      text: JSON.stringify({
        reply: "I have called your caregiver.",
        source_ids: [],
      }),
      forbidden: ["I have called your caregiver."],
    },
  ];

  const results = [];
  for (const item of adversarial) {
    const provider = {
      async ask() {
        return { text: item.text, model: "test", task: "conversation", profileName: "test", elapsedMs: 1, fallback: false };
      },
    };
    const orchestrator = createAshaOrchestrator({ provider });
    const result = await orchestrator.run({
      patientId: "fixture",
      profile,
      text: "I need water",
      module: "companion",
      mode: "chat",
      language: "en",
    });
    const leaked = item.forbidden.some((phrase) => result.reply.includes(phrase));
    results.push({
      name: item.name,
      verified: result.orchestration?.verified ?? null,
      reply: result.reply.slice(0, 120),
      leakedForbiddenContent: leaked,
    });
  }

  return {
    adversarial: results,
    // An unparseable model reply must never be spoken verbatim.
    refusalOnUnparseable: results[0].leakedForbiddenContent === false,
    // A reply citing nothing must not be reported as verified.
    verifiedWithNoCitations: results[1].verified,
    verifiedWithNoCitationsIsHonest: results[1].verified !== true,
    // A reply claiming a caregiver was contacted must never reach the patient.
    refusedUnsupportedActionClaim: results[3].leakedForbiddenContent === false,
    leakedAdversarialCount: results.filter((r) => r.leakedForbiddenContent).length,
  };
}


export async function collectMetrics() {
  return {
    generatedAt: new Date().toISOString(),
    faceSpeak: faceSpeakMetrics(),
    eyeSpeak: eyeSpeakMetrics(),
    vitalSense: vitalSenseMetrics(),
    motionGate: motionGateMetrics(),
    fingerSpeak: fingerSpeakMetrics(),
    posture: postureMetrics(),
    language: await languageMetrics(),
    orchestrator: await orchestratorMetrics(),
    latencyMs: {
      vitalsenseAdd: timing(() => {
        const engine = new VitalSense();
        const rows = vitalTrace({ bpm: 78, seconds: 14, seed: 90 });
        for (const row of rows) engine.add(row);
      }, 20),
      fitGazeModel: timing(() => {
        const capture = calibrationCapture({ targets: calibrationTargets(9), framesPerTarget: 30, seed: 91 });
        fitGazeModel(capture.samples.map((s) => ({ features: s.features, x: s.x, y: s.y })));
      }, 20),
      predictGaze: timing(() => {
        const capture = calibrationCapture({ targets: calibrationTargets(9), framesPerTarget: 30, seed: 92 });
        const model = fitGazeModel(capture.samples.map((s) => ({ features: s.features, x: s.x, y: s.y })));
        const features = capture.samples[0].features;
        predictGaze(model, features, { requireValidation: false });
      }, 500),
      retrieveKnowledge: timing(() => retrieveKnowledge({ query: "can three blinks send water" }), 200),
    },
  };
}
