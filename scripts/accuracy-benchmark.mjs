#!/usr/bin/env node
// Replays the synthetic labelled fixtures through the real domain modules and
// writes the metric table to artifacts/accuracy-{baseline,after}.json.
//
//   node scripts/accuracy-benchmark.mjs            # baseline
//   node scripts/accuracy-benchmark.mjs --after    # after a wave
//   node scripts/accuracy-benchmark.mjs --compare  # baseline -> after table
//
// The metrics themselves live in scripts/accuracy-metrics.mjs so the
// regression tests in tests/accuracy-*.test.mjs assert the same numbers.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectMetrics } from "./accuracy-metrics.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

/** The metric rows worth watching across a wave, and which direction is better. */
const COMPARISON_ROWS = [
  ["faceSpeak.deliberateBlink.f1", "up"],
  ["faceSpeak.ordinaryBlink.f1", "up"],
  ["faceSpeak.lowEarBlink.f1", "up"],
  ["faceSpeak.headTurn.f1", "up"],
  ["faceSpeak.falseActivationsPerHour", "down"],
  ["faceSpeak.frameRejection.missedGlitches", "down"],
  ["faceSpeak.frameRejection.falseRejections", "down"],
  ["faceSpeak.frameRejection.blinkLostToSpike", "down"],
  ["eyeSpeak.contaminatedCalibration.p90Error", "down"],
  ["eyeSpeak.targetSelection.accuracy", "up"],
  ["vitalSense.meanAbsoluteError", "down"],
  ["vitalSense.noiseOnlyFalseReadingRate", "down"],
  ["motionGate.stillMedianSpread", "down"],
  ["motionGate.stillFalseTrips", "down"],
  ["motionGate.noisyStillFalseTrips", "down"],
  ["fingerSpeak.observingFrameRate", "down"],
  ["fingerSpeak.steadyPoseFlips", "down"],
  ["fingerSpeak.recoveryAfterDropoutMs.0", "down"],
  ["posture.flipRatePerMinute", "down"],
  ["posture.restSurvivesSingleMotionSpike", "up"],
  ["language.intent.accuracy", "up"],
  ["language.retrieval.top1Accuracy", "up"],
  ["orchestrator.leakedAdversarialCount", "down"],
  ["orchestrator.verifiedWithNoCitationsIsHonest", "up"],
];

function readAt(object, dotted) {
  return dotted.split(".").reduce((node, key) => (node == null ? undefined : node[key]), object);
}

async function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes("--quiet");
  const after = args.includes("--after");
  const compare = args.includes("--compare");

  const metrics = await collectMetrics();

  const dir = path.join(root, "artifacts");
  fs.mkdirSync(dir, { recursive: true });
  // `--compare` must never write the baseline: it reads it. Only a plain run
  // records the baseline and `--after` records the result of the current code.
  if (!compare) {
    const file = path.join(dir, after ? "accuracy-after.json" : "accuracy-baseline.json");
    fs.writeFileSync(file, JSON.stringify(metrics, null, 2));
  }

  if (!quiet) {
    console.log(
      compare
        ? "Accuracy metrics compared against the recorded baseline"
        : `Accuracy metrics written to ${path.relative(root, after ? "accuracy-after.json" : "accuracy-baseline.json")}`,
    );
    console.log("");
    console.log("faceSpeak.deliberateBlink      ", JSON.stringify(metrics.faceSpeak.deliberateBlink));
    console.log("faceSpeak.ordinaryBlink        ", JSON.stringify(metrics.faceSpeak.ordinaryBlink));
    console.log("faceSpeak.lowEarBlink          ", JSON.stringify(metrics.faceSpeak.lowEarBlink));
    console.log("faceSpeak.falseActivations/hour", metrics.faceSpeak.falseActivationsPerHour);
    console.log("faceSpeak.frameRejection       ", JSON.stringify(metrics.faceSpeak.frameRejection));
    console.log("eyeSpeak.cleanCalibration      ", JSON.stringify(metrics.eyeSpeak.cleanCalibration));
    console.log("eyeSpeak.contaminated          ", JSON.stringify(metrics.eyeSpeak.contaminatedCalibration));
    console.log("eyeSpeak.targetSelection       ", JSON.stringify(metrics.eyeSpeak.targetSelection));
    console.log("vitalSense.meanAbsoluteError   ", metrics.vitalSense.meanAbsoluteError);
    console.log("vitalSense.noiseOnlyFalseRate  ", metrics.vitalSense.noiseOnlyFalseReadingRate);
    console.log("motionGate.stillMedianByFps    ", JSON.stringify(metrics.motionGate.stillMedianByFps));
    console.log("motionGate.stillFalseTrips     ", metrics.motionGate.stillFalseTrips);
    console.log("motionGate.noisyFalseTrips     ", metrics.motionGate.noisyStillFalseTrips);
    console.log("motionGate.movingByFps         ", JSON.stringify(metrics.motionGate.movingDetectedFractionByFps));
    console.log("fingerSpeak.flickerFlips       ", metrics.fingerSpeak.flickerPoseFlips);
    console.log("fingerSpeak.observingFrameRate ", metrics.fingerSpeak.observingFrameRate);
    console.log("posture.flipRatePerMinute      ", metrics.posture.flipRatePerMinute);
    console.log("posture.restSurvivesSpike      ", metrics.posture.restSurvivesSingleMotionSpike);
    console.log("language.intentAccuracy        ", metrics.language.intent.accuracy);
    console.log("language.retrievalTop1         ", metrics.language.retrieval.top1Accuracy);
    console.log("orchestrator.leakedAdversarial ", metrics.orchestrator.leakedAdversarialCount);
  }

  if (!compare) return;

  const baselinePath = path.join(dir, "accuracy-baseline.json");
  if (!fs.existsSync(baselinePath)) {
    console.error("No baseline to compare against.");
    process.exitCode = 1;
    return;
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  console.log("");
  console.log("Comparison (baseline -> after):");
  for (const [dotted, direction] of COMPARISON_ROWS) {
    const before = readAt(baseline, dotted);
    const now = readAt(metrics, dotted);
    let mark = "";
    if (before === undefined) {
      // The metric did not exist when the baseline was recorded.
      mark = "  (not measured at baseline)";
    } else if (before !== now) {
      const improved =
        direction === "up" ? now > before : now < before;
      mark = improved ? "  <-- improved" : "  <-- REGRESSED";
    }
    console.log(
      `  ${dotted.padEnd(46)} ${String(before).padStart(10)} -> ${String(now).padStart(10)}${mark}`,
    );
  }
}

await main();
