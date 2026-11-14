import test from "node:test";
import assert from "node:assert/strict";
import {
  RestTracker,
  SustainedCue,
  RequestGate,
  poseFeatures,
  pulseEstimate,
  recommendations,
} from "../public/engine/signals.js";
import {
  assessment,
  recommend,
  eventValue,
  safeStatus,
  hash,
  equal,
  pushEndpoint,
} from "../src/server/lib/logic.js";
test("assessment recommends speech alongside usable face and does not gate modules", () => {
  const a = assessment({ eyes: "reliable", speech: "limited" });
  assert.deepEqual(recommendations(a), ["facespeak", "senseassist"]);
  assert.equal(recommend(a).primary, "facespeak");
});
test("no wake cue from an absent face or isolated long eye closure", () => {
  const r = new RestTracker();
  for (let t = 0; t < 90000; t += 100)
    assert.equal(r.update({ t, valid: false, closed: true, motion: 0 }), null);
  assert.equal(r.resting, false);
  assert.equal(
    r.update({ t: 90000, valid: true, closed: false, motion: 0.03 }),
    null,
  );
});
test("continuous 60 sec rest plus movement and 2.5 sec eyes open can prompt once", () => {
  const r = new RestTracker();
  for (let t = 0; t <= 61000; t += 100)
    r.update({ t, valid: true, closed: true, motion: 0 });
  assert.equal(r.resting, true);
  let cues = 0;
  for (let t = 61100; t < 70000; t += 100)
    if (r.update({ t, valid: true, closed: false, motion: 0.02 })) cues++;
  assert.equal(cues, 1);
});
test("tracking gap resets sustained posture and wake evidence", () => {
  const r = new RestTracker();
  for (let t = 0; t <= 61000; t += 100)
    r.update({ t, valid: true, closed: true, motion: 0 });
  r.update({ t: 70000, valid: true, closed: false, motion: 0.03 });
  assert.equal(r.resting, false);
  const c = new SustainedCue();
  c.update(true, true, 0);
  assert.equal(c.update(true, true, 61000), false);
});
test("asymmetry requires a full minute of uninterrupted valid observation", () => {
  const c = new SustainedCue();
  let count = 0;
  for (let t = 0; t <= 70000; t += 100) if (c.update(true, true, t)) count++;
  assert.equal(count, 1);
  c.update(false, true, 70100);
  assert.equal(c.update(true, true, 70200), false);
});
test("a request needs a separate confirmation and expires", () => {
  const g = new RequestGate();
  g.propose("water", "water", "face", 0);
  assert.equal(g.confirm(10), null);
  assert.equal(g.confirm(800).kind, "water");
  assert.equal(g.confirm(900), null);
  assert.equal(g.propose("help", "help", "face", 1000), null);
  g.propose("help", "help", "face", 4000);
  assert.equal(g.confirm(35000), null);
});
test("pose never guesses from missing/occluded shoulders", () => {
  assert.equal(poseFeatures([], null).valid, false);
  const lm = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.9,
  }));
  lm[11] = { x: 0.3, y: 0.3, visibility: 0.9 };
  lm[12] = { x: 0.7, y: 0.3, visibility: 0.9 };
  lm[23] = { x: 0.4, y: 0.7, visibility: 0.9 };
  lm[24] = { x: 0.6, y: 0.7, visibility: 0.9 };
  assert.equal(poseFeatures(lm).label, "Upright");
  lm[11].visibility = 0.2;
  assert.equal(poseFeatures(lm).valid, false);
});
test("pulse rejects insufficient data, motion and constant color", () => {
  assert.equal(pulseEstimate([]).bpm, null);
  const a = Array.from({ length: 600 }, (_, i) => ({
    t: i * 40,
    rgb: [100, 100, 100],
    motion: 0,
  }));
  assert.equal(pulseEstimate(a).bpm, null);
  a.forEach((x) => (x.motion = 0.2));
  assert.equal(pulseEstimate(a).bpm, null);
});
test("pulse spectral estimator recovers synthetic 72 bpm without claiming clinical accuracy", () => {
  const a = Array.from({ length: 600 }, (_, i) => ({
    t: i * 40,
    rgb: [
      100 + 0.6 * Math.sin(i * 0.04 * 2 * Math.PI * 1.2),
      120 + 2 * Math.sin(i * 0.04 * 2 * Math.PI * 1.2),
      85 + 0.2 * Math.cos(i * 0.04 * 2 * Math.PI * 1.2),
    ],
    motion: 0,
  }));
  assert.ok(Math.abs(pulseEstimate(a).bpm - 72) < 3);
});
test("server rejects unknown and emergency event names, sanitizes status", () => {
  assert.throws(() => eventValue({ kind: "emergency" }));
  assert.equal(safeStatus({ bpm: 250 }).bpm, null);
  assert.equal(
    eventValue({ kind: "water", text: "abc\nxyz", confirmed: true }).text,
    "abc xyz",
  );
});
test("role tokens and push endpoints are restricted", () => {
  assert.ok(equal(hash("x"), hash("x")));
  assert.equal(equal(hash("x"), hash("y")), false);
  assert.equal(pushEndpoint("https://evil.test/"), false);
  assert.equal(pushEndpoint("http://fcm.googleapis.com/x"), false);
  assert.equal(pushEndpoint("https://fcm.googleapis.com/fcm/send/x"), true);
});

// ---------------------------------------------------------------- Wave 3
test("one motion spike does not clear the closed-eye accumulator, two do", () => {
  // The pipeline delivers a motion sample once per pose result, so the
  // frames in between carry no new sample at all.
  const feed = (tracker, samples) => {
    samples.forEach((motion, i) => {
      tracker.update({
        t: i * 500,
        valid: true,
        closed: true,
        motion,
        motionRate: motion,
      });
    });
  };
  const window = new Array(130).fill(0);

  const once = new RestTracker();
  const withOneSpike = window.slice();
  withOneSpike[10] = 0.2;
  feed(once, withOneSpike);
  assert.equal(once.resting, true, "one spike must not discard a minute of observation");

  const twice = new RestTracker();
  const withTwoSpikes = window.slice();
  withTwoSpikes[10] = 0.2;
  withTwoSpikes[11] = 0.2;
  feed(twice, withTwoSpikes);
  assert.equal(twice.resting, false, "two consecutive spikes clear the accumulator");
});

test("the same movement means the same thing at any pose cadence", () => {
  // The same physical movement, sampled at 500 ms and at 50 ms. The
  // displacement per sample differs by ten, the rate does not.
  const slow = new RestTracker();
  slow.update({ t: 0, valid: true, closed: true, motion: 0.02, motionRate: 0.04 });
  const fast = new RestTracker();
  fast.update({ t: 0, valid: true, closed: true, motion: 0.002, motionRate: 0.04 });
  // 0.04 units/s is above the awake threshold (0.024) for both, so both see
  // the movement.
  assert.equal(slow.motionSeen, false);
  assert.equal(fast.motionSeen, false);
  const slowAwake = new RestTracker();
  slowAwake.resting = true;
  slowAwake.update({ t: 0, valid: true, closed: false, motion: 0.02, motionRate: 0.04 });
  const fastAwake = new RestTracker();
  fastAwake.resting = true;
  fastAwake.update({ t: 0, valid: true, closed: false, motion: 0.002, motionRate: 0.04 });
  assert.equal(slowAwake.motionSeen, true);
  assert.equal(fastAwake.motionSeen, true);
});

test("the posture label holds until a lean is sustained", () => {
  const lean = (x) => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    lm[11] = { x: 0.3 + x * 0.1, y: 0.54, visibility: 0.9 };
    lm[12] = { x: 0.7 + x * 0.1, y: 0.54, visibility: 0.9 };
    lm[23] = { x: 0.4, y: 0.72, visibility: 0.9 };
    lm[24] = { x: 0.6, y: 0.72, visibility: 0.9 };
    return lm;
  };
  let previous = null;
  // A single sample that leans must not change the label.
  let features = poseFeatures(lean(0), previous, 0);
  previous = features;
  assert.equal(features.label, "Upright");
  features = poseFeatures(lean(1), previous, 500);
  previous = features;
  assert.equal(features.label, "Upright", "one leaning sample must not flip the label");
  assert.equal(features.rawLabel, "Leaning", "but the raw reading must still see it");
  // Held for longer than the entry time, the label follows.
  features = poseFeatures(lean(1), previous, 1500);
  assert.equal(features.label, "Leaning");
});

test("a pose without visibility scores is not an invisible pose", () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  lm[11] = { x: 0.3, y: 0.54 };
  lm[12] = { x: 0.7, y: 0.54 };
  lm[23] = { x: 0.4, y: 0.72 };
  lm[24] = { x: 0.6, y: 0.72 };
  const features = poseFeatures(lm, null, 0);
  assert.equal(features.valid, true);
  assert.equal(features.label, "Upright");
});

test("the motion rate is the same movement per second at any cadence", () => {
  const lm = (x) => {
    const out = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    out[11] = { x: 0.3, y: 0.54, visibility: 0.9 };
    out[12] = { x: 0.7 + x, y: 0.54, visibility: 0.9 };
    out[23] = { x: 0.4, y: 0.72, visibility: 0.9 };
    out[24] = { x: 0.6, y: 0.72, visibility: 0.9 };
    return out;
  };
  let slow = poseFeatures(lm(0), null, 0);
  const slowNext = poseFeatures(lm(0.01), slow, 500);
  let fast = poseFeatures(lm(0), null, 0);
  const fastNext = poseFeatures(lm(0.001), fast, 50);
  assert.ok(Math.abs(slowNext.motionRate - fastNext.motionRate) < 0.002);
  // The displacement itself is unchanged and still per interval.
  assert.ok(slowNext.motion > fastNext.motion);
});
