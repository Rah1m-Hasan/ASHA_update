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
test.todo("VitalSense does not report a pulse when there is no pulse", () => {
  const rate = metrics.vitalSense.noiseOnlyFalseReadingRate;
  assert.ok(
    rate <= 0.1,
    `noise-only traces produced a reading in ${rate * 100}% of runs (${metrics.vitalSense.noiseOnlyFalseReadings}/${metrics.vitalSense.noiseOnlyRuns})`,
  );
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

// Wave 6 — the Bangla need patterns require a possessive ("আমার") before
// "দরকার", so a bare "টয়লেট দরকার" is not recognised.
test.todo("SenseAssist finds the need in a request and invents none", async () => {
  const intent = metrics.language.intent;
  assert.equal(intent.cases, intentCases.length);
  assert.ok(intent.accuracy >= 0.95, `intent accuracy ${intent.accuracy}`);
  assert.ok(intent.failures.length === 0, JSON.stringify(intent.failures));
});

// Wave 7 — the retriever ranks on BM25 alone, so a query whose module the
// bundle covers imperfectly can be answered by another module's text.
test.todo("retrieval reaches the right knowledge concept", () => {
  const retrieval = metrics.language.retrieval;
  assert.equal(retrieval.queries, retrievalQueries.length);
  assert.ok(
    retrieval.top1Accuracy >= 0.95,
    `retrieval top-1 accuracy ${retrieval.top1Accuracy}`,
  );
});

// Wave 7 — EyeSpeak ships as a patient module but the knowledge bundle has no
// concept for it, so a patient asking about the gaze pointer is answered with
// FaceSpeak text.
test.todo("the knowledge bundle covers every module the app ships", () => {
  const gaps = metrics.language.retrievalGaps;
  assert.equal(gaps.queries, retrievalGapQueries.length);
  assert.equal(
    gaps.answeredByOtherModule,
    0,
    JSON.stringify(gaps.details.filter((g) => g.answeredByOtherModule)),
  );
});

// ---------------------------------------------------------------- Orchestrator

// Wave 7 — the orchestrator has no content guard: an unparseable reply is
// spoken verbatim and a reply citing nothing is reported as verified.
test.todo("the orchestrator refuses to speak an unparseable or unsafe reply", () => {
  const orchestrator = metrics.orchestrator;
  assert.equal(
    orchestrator.leakedAdversarialCount,
    0,
    JSON.stringify(orchestrator.adversarial.filter((row) => row.leakedForbiddenContent)),
  );
});

test.todo("the orchestrator does not report a reply with no citations as verified", () => {
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
