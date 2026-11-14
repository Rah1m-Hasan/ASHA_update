import test from "node:test";
import assert from "node:assert/strict";
import { MotionMeter } from "../public/engine/motion-meter.js";
import { Perception } from "../public/engine/perception.js";
import { faceMotionStream as stream } from "./fixtures/vitals.mjs";
import { rng, gaussian } from "./fixtures/random.mjs";

// The VitalSense motion gate (public/engine/vitalsense.js) invalidates the
// whole vital window when the face-motion estimate exceeds 0.075 normalised
// landmark units per second. These tests pin the properties the estimate must
// have for that gate to mean anything on a real device.

const GATE = 0.075;
const LANDMARKS = 60;
const JITTER = 0.001; // per-axis sigma of per-frame landmark noise

function run(frames, meter = new MotionMeter()) {
  const values = [];
  for (const frame of frames) values.push(meter.update(frame.t, frame.landmarks));
  return { values, meter };
}

test("a still face reads the same motion at every frame rate", () => {
  const readings = [10, 20, 30, 40].map((fps) => {
    const { values } = run(stream({ fps }));
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  });
  const spread = Math.max(...readings) - Math.min(...readings);
  assert.ok(
    spread < 0.02,
    `the estimate must not depend on the frame rate: ${readings.join(", ")}`,
  );
  for (const reading of readings) {
    assert.ok(reading < GATE, `a still face must not trip the gate: ${reading}`);
  }
});

test("a still face never trips the gate, even with twice the landmark jitter", () => {
  for (const fps of [15, 30, 40]) {
    const frames = stream({ fps }).map((frame, index) => ({
      ...frame,
      landmarks: frame.landmarks.map((point, j) =>
        j % 2
          ? point
          : {
              x: point.x + gaussian(rng(fps + j), 0, JITTER),
              y: point.y + gaussian(rng(fps + j + 7), 0, JITTER),
            },
      ),
    }));
    const { values } = run(frames);
    const trips = values.filter((v) => v > GATE).length;
    assert.equal(trips, 0, `${fps} fps produced ${trips} false gate trips on a still face`);
  }
});

test("a moving face trips the gate at every frame rate", () => {
  for (const fps of [10, 20, 30, 40]) {
    const { values } = run(stream({ fps, motion: 0.15 }));
    const trips = values.filter((v) => v > GATE).length;
    assert.ok(trips > values.length / 2, `${fps} fps only tripped ${trips} times`);
  }
});

test("a head shake is detected at every frequency", () => {
  for (const hz of [1, 2, 3, 4, 6]) {
    const frames = stream({ fps: 30, shakeHz: hz });
    const { values } = run(frames);
    const trips = values.filter((v) => v > GATE).length;
    assert.ok(trips > frames.length / 4, `${hz} Hz shake only tripped ${trips} times`);
  }
});

test("a gap holds the last estimate instead of reporting a still face", () => {
  const meter = new MotionMeter();
  const frames = stream({ fps: 30, motion: 0.15 });
  let last = 0;
  for (const frame of frames.slice(0, 30)) last = meter.update(frame.t, frame.landmarks);
  assert.ok(last > GATE, "the face was moving, so the estimate should be above the gate");
  // The face is lost for a second: the motion is unknown, not zero.
  const held = meter.update(frames[30].t + 1000, null);
  assert.equal(held, last, "the last estimate must be held, not reset");
  assert.equal(meter.stale, true);
});

test("the ROI freshness bound never tightens below 600ms", () => {
  const perception = Object.create(Perception.prototype);
  perception.faceResultAt = 0;
  assert.equal(perception.roiFreshnessMs(), 600, "with no observed cadence the old bound applies");

  // A device whose face results arrive every 333ms must not have its ROI
  // rejected between results.
  let at = 1000;
  perception.faceResultAt = at;
  for (let i = 0; i < 10; i++) {
    at += 333;
    perception.faceResultAt = at;
    perception.roiFreshnessMs();
  }
  assert.ok(perception.faceResultIntervalMs > 250, "the face cadence was not observed");
  assert.ok(
    perception.roiFreshnessMs() >= 3 * perception.faceResultIntervalMs - 1,
    "the bound must cover three face-result intervals on a slow device",
  );

  // A fast device keeps the original bound.
  const fast = Object.create(Perception.prototype);
  fast.faceResultAt = 0;
  for (let i = 0; i < 40; i++) {
    fast.faceResultAt += 25;
    fast.roiFreshnessMs();
  }
  assert.equal(fast.roiFreshnessMs(), 600, "a fast device keeps the original 600ms bound");
});
