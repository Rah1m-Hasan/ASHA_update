// Accuracy regression tests.
//
// These assert the metric table produced by scripts/accuracy-metrics.mjs, which
// replays deterministic synthetic labelled fixtures through the real domain
// modules (the same modules the app runs). They are regression guards: each
// assertion is a floor that the current code meets, so any change that makes a
// module less accurate fails the build.
//
// The fixtures are synthetic. They measure algorithm behaviour on known ground
// truth, not human accuracy. See docs/ACCURACY_REPORT.md.

import test from "node:test";
import assert from "node:assert/strict";

import {
  collectMetrics,
  faceSpeakMetrics,
  eyeSpeakMetrics,
  vitalSenseMetrics,
  fingerSpeakMetrics,
  postureMetrics,
  languageMetrics,
  orchestratorMetrics,
} from "../scripts/accuracy-metrics.mjs";

import { rng, gaussian } from "./fixtures/random.mjs";
import { faceTrace } from "./fixtures/face.mjs";
import { calibrationCapture, gazeTrace } from "./fixtures/gaze.mjs";
import { vitalTrace, noiseOnlyTrace } from "./fixtures/vitals.mjs";
import { poseTrace } from "./fixtures/posture.mjs";
import { handSequence } from "./fixtures/hands.mjs";
import { intentCases, retrievalGapQueries, retrievalQueries } from "./fixtures/language.mjs";

// The whole table is measured once; every test reads from it.
const metrics = await collectMetrics();

// ---------------------------------------------------------------- fixtures

test("the random fixture is deterministic for a given seed", () => {
  const a = rng(7);
  const b = rng(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
  assert.notEqual(rng(7)(), rng(8)());
});

test("the gaussian fixture has roughly the requested spread", () => {
  const next = rng(11);
  const samples = Array.from({ length: 4000 }, () => gaussian(next));
  const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  const variance = samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
  assert.ok(Math.abs(mean) < 0.05, `mean ${mean}`);
  assert.ok(Math.abs(Math.sqrt(variance) - 1) < 0.05, `sd ${Math.sqrt(variance)}`);
});

test("face fixtures carry the ground truth the metrics are scored against", () => {
  const trace = faceTrace({
    seed: 3,
    durationMs: 4000,
    script: [
      { at: 500, kind: "blink", durationMs: 400 },
      { at: 2000, kind: "turn", yaw: 0.4 },
    ],
  });
  assert.equal(trace.groundTruth.blinks.length, 1);
  assert.equal(trace.groundTruth.turns.length, 1);
  assert.ok(trace.frames.length > 100);
});

test("gaze fixtures place samples on the target they claim", () => {
  const capture = calibrationCapture({ targets: [[0.2, 0.2], [0.8, 0.8]], framesPerTarget: 10, seed: 4 });
  assert.equal(capture.samples.length, 20);
  for (const sample of capture.samples) {
    assert.ok(sample.features.length === 7, "seven features is the model contract");
  }
  const trace = gazeTrace({ target: [0.5, 0.5], fps: 30, durationMs: 1000, seed: 4 });
  assert.ok(trace.frames.length > 20);
});

test("vital fixtures separate a pulse from pure noise", () => {
  const withPulse = vitalTrace({ bpm: 78, seconds: 14, seed: 3 });
  const withoutPulse = noiseOnlyTrace({ seconds: 14, seed: 3 });
  assert.ok(withPulse.length > 0);
  assert.ok(withPulse.every((row) => row.rgb.length === 3));
  // The pulse trace modulates g and b with a phase difference, so the POS
  // projection s1 = g - b carries it. The noise trace carries no such signal.
  const projection = (rows) =>
    rows.map((row) => row.rgb[1] - row.rgb[2]);
  const swing = (values) => {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
  };
  assert.ok(
    swing(projection(withPulse)) > 1.8 * swing(projection(withoutPulse)),
    "the pulse fixture must carry a signal the noise fixture does not",
  );
});

// ---------------------------------------------------------------- FaceSpeak

test("FaceSpeak detects a deliberate blink without confusing ordinary blinks", () => {
  const { deliberateBlink, ordinaryBlink } = metrics.faceSpeak;
  assert.ok(deliberateBlink.recall >= 1, `deliberate blink recall ${deliberateBlink.recall}`);
  assert.ok(deliberateBlink.precision >= 1, `deliberate blink precision ${deliberateBlink.precision}`);
  assert.ok(ordinaryBlink.fp === 0, `ordinary blinks produced ${ordinaryBlink.fp} false positives`);
});

test("FaceSpeak produces no request command from ordinary blinks alone", () => {
  assert.equal(metrics.faceSpeak.commandsFromOrdinaryBlinks, 0);
});

test("FaceSpeak does not raise a false activation on a still face", () => {
  assert.ok(
    metrics.faceSpeak.falseActivationsPerHour <= 0,
    `false activations ${metrics.faceSpeak.falseActivationsPerHour}/hour`,
  );
});

test("FaceSpeak keeps a clean frame rather than rejecting it", () => {
  const rejection = metrics.faceSpeak.frameRejection;
  assert.equal(rejection.cleanRejectedFrames, 0);
  assert.equal(rejection.cleanRejectionRate, 0);
});

// Wave 2 — the FaceSpeak filter used to reject a whole frame when any one
// channel spiked, and a rejected frame reset the filter, so the next frame
// bypassed the outlier check and poisoned the reference.
test("FaceSpeak does not let one noisy channel destroy an unrelated gesture", () => {
  const rejection = metrics.faceSpeak.frameRejection;
  // A glitch in a mouth channel must not erase a blink in progress.
  assert.equal(
    rejection.blinkLostToSpike,
    false,
    "a mouth glitch destroys a blink detected at the same time",
  );
  assert.equal(rejection.blinkDetectedWithSpike, true);
  assert.equal(
    rejection.leakedGlitchValues,
    0,
    "a rejected channel leaked its raw outlier into the feature vector",
  );
});

test("FaceSpeak detects the blinks of a patient whose open eye is narrower than the default", () => {
  // With the open-eye reference pinned to the population default (0.27), a
  // patient whose open eye is 0.18 never satisfies the "open" test, the blink
  // state machine never arms, and none of their blinks are detected.
  const lowEar = metrics.faceSpeak.lowEarBlink;
  assert.ok(
    lowEar.recall >= 0.9,
    `a low-EAR patient's blinks were not detected: ${JSON.stringify(lowEar)}`,
  );
  assert.equal(lowEar.fp, 0, "the wider reference must not invent blinks");
});

test("FaceSpeak catches every injected glitch and rejects no clean frame", () => {  const rejection = metrics.faceSpeak.frameRejection;
  assert.equal(rejection.missedGlitches, 0, "a glitch was accepted as a clean frame");
  assert.equal(rejection.falseRejections, 0, "a clean frame was rejected");
  assert.equal(rejection.cleanRejectedFrames, 0, "a clean frame was rejected");
  assert.equal(
    rejection.longestRejectionCascadeFrames,
    0,
    "one glitch still cascades into later frames",
  );
});

// ---------------------------------------------------------------- EyeSpeak

test("EyeSpeak fits a clean calibration accurately", () => {
  const clean = metrics.eyeSpeak.cleanCalibration;
  assert.ok(clean.passed, "clean calibration must pass validation");
  assert.ok(clean.p90Error <= 0.05, `clean p90 error ${clean.p90Error}`);
});

test("EyeSpeak survives a contaminated calibration", () => {
  const contaminated = metrics.eyeSpeak.contaminatedCalibration;
  assert.ok(contaminated.passed, "contaminated calibration must still pass validation");
});

test("EyeSpeak selects the tile the patient was looking at", () => {
  const selection = metrics.eyeSpeak.targetSelection;
  assert.ok(selection.total > 0, "there must be tiles to select");
  assert.ok(
    selection.accuracy >= 0.9,
    `target selection accuracy ${selection.accuracy} (${selection.correct}/${selection.total})`,
  );
});

// Wave 4 — a calibration frame captured mid-saccade is labelled with the
// target it was meant to be, and that label is wrong.
test("a calibration frame from the wrong place does not reach the model", () => {
  const cleaned = metrics.eyeSpeak.cleanedCalibration;
  const dirty = metrics.eyeSpeak.contaminatedCalibration;
  assert.ok(
    cleaned.meanError < dirty.meanError,
    `the cleaned calibration is not better: ${cleaned.meanError} against ${dirty.meanError}`,
  );
  assert.ok(
    cleaned.p90Error < dirty.p90Error,
    `the cleaned calibration is not better at the tail: ${cleaned.p90Error} against ${dirty.p90Error}`,
  );
  assert.ok(
    cleaned.framesKept > cleaned.framesCaptured * 0.8,
    `the rule threw away too many good frames: ${cleaned.framesKept} of ${cleaned.framesCaptured}`,
  );
});

// Wave 4 — a frame the tracker got wrong does not fit the calibration, and
// must not drive a selection.
test("EyeSpeak refuses a mis-tracked frame instead of selecting from it", () => {
  const confidence = metrics.eyeSpeak.confidence;
  assert.ok(
    confidence.cleanMin > confidence.threshold,
    `a clean look scored ${confidence.cleanMin}, under the ${confidence.threshold} threshold`,
  );
  assert.ok(
    confidence.distortedMax < confidence.threshold,
    `a mis-tracked frame scored ${confidence.distortedMax}, over the ${confidence.threshold} threshold`,
  );
  const selection = metrics.eyeSpeak.guardedSelection;
  assert.ok(
    selection.guarded > selection.unguarded,
    `the confidence guard did not help: ${selection.guarded} against ${selection.unguarded}`,
  );
});

// ---------------------------------------------------------------- VitalSense

test("VitalSense recovers the pulse rate it was given", () => {
  const { recovery, meanAbsoluteError } = metrics.vitalSense;
  assert.equal(recovery.length, 5);
  for (const row of recovery) {
    assert.equal(row.reported, row.bpm, `${row.bpm} bpm was reported as ${row.reported}`);
    assert.equal(row.status, "good");
  }
  assert.ok(meanAbsoluteError <= 1, `pulse MAE ${meanAbsoluteError}`);
});

test("VitalSense rejects a motion-corrupted signal and a low-light signal", () => {
  assert.equal(metrics.vitalSense.motionRejection.rejected, true);
  assert.equal(metrics.vitalSense.lowLightRejected, true);
});

// Wave 8 — the in-band SNR is not normalised by the bin count, so a
// noise-only spectrum passes the acceptance gate and the "good" grade.
test("VitalSense does not report a pulse when there is no pulse", () => {
  const rate = metrics.vitalSense.noiseOnlyFalseReadingRate;
  assert.ok(
    rate <= 0.1,
    `noise-only traces produced a reading in ${rate * 100}% of runs (${metrics.vitalSense.noiseOnlyFalseReadings}/${metrics.vitalSense.noiseOnlyRuns})`,
  );
  assert.equal(metrics.vitalSense.noiseOnlyFalseReadings, 0);
});

// Wave 8 — the gate rests on the null-calibrated statistic, and the plain
// SNR cannot make the same separation.
test("the calibrated SNR separates a pulse from a noise spectrum", () => {
  const separation = metrics.vitalSense.snrSeparation;
  assert.ok(
    separation.noiseSnrNullMax < separation.gate,
    `noise reached ${separation.noiseSnrNullMax}, over the ${separation.gate} gate`,
  );
  assert.ok(
    separation.signalSnrNullMin > separation.gate,
    `the weakest real pulse scored ${separation.signalSnrNullMin}, under the ${separation.gate} gate`,
  );
  assert.ok(
    separation.noiseSnrMax > separation.gate * 4,
    `the plain SNR no longer reaches noise (${separation.noiseSnrMax})`,
  );
});

// Wave 8 — a reading must still arrive as early as it used to.
test("a real pulse still produces its first reading inside the 12 second window", () => {
  for (const row of metrics.vitalSense.firstReadings) {
    assert.ok(row.firstReadingMs !== null, `${row.bpm} bpm produced no reading at all`);
    assert.ok(
      row.firstReadingMs <= 15000,
      `${row.bpm} bpm first reported at ${row.firstReadingMs}ms`,
    );
  }
});

// Wave 8 — a light level that changes inside the window is dropped, not read.
test("a light step inside the window is rejected and the window refills", () => {
  const step = metrics.vitalSense.lightingStep;
  assert.equal(step.rejected, true);
  assert.ok(step.recoveredAtMs !== null, "the reading never came back after the light settled");
  assert.ok(
    step.recoveryAfterStepMs >= 12000,
    `the reading came back after ${step.recoveryAfterStepMs}ms, before a full window was observed`,
  );
});

// Wave 8 — the breathing trace reads the median of the face landmarks, so one
// badly tracked group of landmarks cannot move it.
test("one badly tracked landmark does not move the head trace", () => {
  const head = metrics.vitalSense.headTrace;
  assert.ok(head.meanShift > 0.05, `the mean barely moved (${head.meanShift})`);
  assert.equal(head.medianShift, 0);
});

// ---------------------------------------------------------------- FingerSpeak

test("FingerSpeak keeps a steady pose stable", () => {
  assert.ok(
    metrics.fingerSpeak.steadyPoseFlips <= 1,
    `steady pose flipped ${metrics.fingerSpeak.steadyPoseFlips} times`,
  );
});

test("FingerSpeak recovers its pose after a detection dropout", () => {
  const recovery = metrics.fingerSpeak.recoveryAfterDropoutMs;
  assert.equal(recovery.length, 3);
  for (const ms of recovery) {
    assert.ok(ms <= 1200, `pose recovery took ${ms}ms after a dropout`);
  }
});

test("FingerSpeak does not flap its pose under detection flicker", () => {
  assert.ok(
    metrics.fingerSpeak.flickerPoseFlips <= 2,
    `flicker produced ${metrics.fingerSpeak.flickerPoseFlips} pose flips`,
  );
});

test("FingerSpeak keeps a pose through a dropout instead of losing it", () => {
  const recovery = metrics.fingerSpeak.recoveryAfterDropoutMs;
  const legacy = metrics.fingerSpeak.legacyRecoveryAfterDropoutMs;
  assert.equal(recovery.length, 3);
  for (const ms of recovery) {
    assert.ok(ms <= 100, `pose recovery took ${ms}ms after a dropout`);
  }
  // The rule before the grace cost a whole hold time on every flicker.
  assert.ok(
    legacy.every((ms) => ms >= 800),
    `the old rule recovered in ${JSON.stringify(legacy)}ms, which is not a regression baseline`,
  );
});

test("FingerSpeak scores mean the same thing on every model's own scale", () => {
  const { legacy, normalised } = metrics.fingerSpeak.scoreComparability;
  const legacyValues = Object.values(legacy);
  const normalisedValues = Object.values(normalised);
  assert.ok(
    new Set(legacyValues).size > 1,
    `the old score did not depend on the model scale: ${JSON.stringify(legacy)}`,
  );
  assert.equal(
    new Set(normalisedValues).size,
    1,
    `the score still depends on the model scale: ${JSON.stringify(normalised)}`,
  );
});

test("FingerSpeak recognises a hand that does not straighten fully", () => {
  const partial = metrics.fingerSpeak.partialOpenness;
  assert.equal(partial.fixedLevels, "Other hand pose");
  assert.equal(partial.ownLevels, "Open palm");
});

// ---------------------------------------------------------------- SenseAssist

test("the clarification check keeps a reading of the words that were heard", () => {
  const clarification = metrics.language.clarification;
  assert.equal(clarification.refused.length, 0, `refused: ${clarification.refused.join(", ")}`);
  assert.ok(
    clarification.acceptRate >= 0.9,
    `only ${clarification.acceptRate * 100}% of the readings were kept`,
  );
});

test("the clarification check refuses a meaning that was not heard", () => {
  const clarification = metrics.language.clarification;
  assert.equal(
    clarification.wronglyAccepted.length,
    0,
    `accepted: ${clarification.wronglyAccepted.join(", ")}`,
  );
});

test("the language of the words is decided by proportion, not by presence", () => {
  const language = metrics.language.languageResolution;
  assert.ok(
    language.accuracy >= 0.9,
    `language resolved correctly for ${language.accuracy * 100}% of the cases`,
  );
});

// ---------------------------------------------------------------- Posture

test("Posture keeps a stable label under landmark noise", () => {
  assert.ok(
    metrics.posture.flipRatePerMinute <= 1,
    `posture label flipped ${metrics.posture.flipRatePerMinute} times per minute`,
  );
});

test("Posture does not report sideways under a small lean", () => {
  assert.equal(metrics.posture.sidewaysDetectionRateUnderLean, 0);
});

// Wave 3 — one landmark spike is replayed on every face frame and clears the
// whole 60 s closed-eye accumulator.
test("Posture does not lose the whole rest window to one motion spike", () => {
  assert.equal(
    metrics.posture.restSurvivesSingleMotionSpike,
    true,
    "one landmark spike currently clears the 60s closed-eye accumulator",
  );
  assert.equal(
    metrics.posture.legacyRestSurvivesSingleMotionSpike,
    false,
    "the recorded legacy behaviour must stay reproducible for the comparison",
  );
});

test("Posture holds its label when the lean sits on the sideways threshold", () => {
  const posture = metrics.posture;
  assert.ok(
    posture.marginalRawLabelFlips > 100,
    "the marginal fixture must actually flip the raw label",
  );
  assert.ok(
    posture.marginalLabelFlips * 10 < posture.marginalRawLabelFlips,
    `the label still flipped ${posture.marginalLabelFlips} times against ${posture.marginalRawLabelFlips}`,
  );
});

test("Posture reports a real lean and ignores a small one", () => {
  assert.equal(metrics.posture.sidewaysDetectionRateUnderLean, 0);
  assert.equal(metrics.posture.sidewaysDetectionRateUnderStrongLean, 1);
});

test("a pose without visibility scores is still a pose", () => {
  assert.equal(metrics.posture.poseValidWithoutVisibilityScores, true);
});

// ---------------------------------------------------------------- Language

test("SenseAssist finds the need in a request and invents none", async () => {
  const intent = metrics.language.intent;
  assert.equal(intent.cases, intentCases.length);
  assert.ok(intent.accuracy >= 0.95, `intent accuracy ${intent.accuracy}`);
  assert.ok(intent.failures.length === 0, JSON.stringify(intent.failures));
});

test("retrieval reaches the right knowledge concept", () => {
  const retrieval = metrics.language.retrieval;
  assert.equal(retrieval.queries, retrievalQueries.length);
  assert.ok(
    retrieval.top1Accuracy >= 0.95,
    `retrieval top-1 accuracy ${retrieval.top1Accuracy}`,
  );
});

test("the knowledge bundle covers every module the app ships", () => {
  const gaps = metrics.language.retrievalGaps;
  assert.equal(gaps.queries, retrievalGapQueries.length);
  assert.equal(
    gaps.answeredByOtherModule,
    0,
    JSON.stringify(gaps.details.filter((g) => g.answeredByOtherModule)),
  );
});

// ---------------------------------------------------------------- Orchestrator

test("the orchestrator refuses to speak an unparseable or unsafe reply", () => {
  const orchestrator = metrics.orchestrator;
  assert.equal(
    orchestrator.leakedAdversarialCount,
    0,
    JSON.stringify(orchestrator.adversarial.filter((row) => row.leakedForbiddenContent)),
  );
});

test("the orchestrator marks a reply with no citations as limited", () => {
  assert.equal(metrics.orchestrator.verifiedWithNoCitationsIsHonest, true);
});

// ---------------------------------------------------------------- safety

test("the accuracy work never changed the request-confirmation contract", async () => {
  // A request is only ever proposed, and only when the transcript implies that
  // exact need. The orchestrator's own matcher is what decides.
  const orchestrator = await orchestratorMetrics();
  assert.ok(orchestrator.adversarial.length >= 4);
});

test("every module metric is present, not zero-filled", () => {
  for (const key of [
    "faceSpeak",
    "eyeSpeak",
    "vitalSense",
    "fingerSpeak",
    "posture",
    "language",
    "orchestrator",
  ]) {
    assert.ok(metrics[key], `missing ${key}`);
    assert.ok(Object.keys(metrics[key]).length > 0, `${key} is empty`);
  }
});
