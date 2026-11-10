import test from "node:test";
import assert from "node:assert/strict";
import { WorkoutSession, TRACKING_LOST_MESSAGE, LOST_AFTER_MS } from "../src/features/move/session.js";
import { screen, SCREEN_QUESTIONS, recordClearance } from "../src/features/move/safety.js";
import { isTracked } from "../src/features/move/detectors.js";
import { LESSONS } from "../src/features/move/lessons.js";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const clear = screen(Object.fromEntries(SCREEN_QUESTIONS.map((q) => [q.id, "no"])), { now: NOW });
const program = {
  id: "p1", name: "Test plan", category: "lower_body", userGoal: "leg_strength", locale: "en", warmUpSeconds: 30, coolDownSeconds: 30,
  authoredBy: "user", version: "test",
  sequence: [
    { exerciseId: "chair_squat", sets: 2, targetReps: 3, restSeconds: 20 },
    { exerciseId: "supported_plank", sets: 1, holdSeconds: 10, restSeconds: 0 },
  ],
};
const practiceTarget = (id) => LESSONS[id].practice;
const make = (opts = {}) => new WorkoutSession({ program, screening: clear, wallClock: () => NOW, tracked: isTracked, practiceTarget, ...opts });
const ok = (t, extra = {}) => ({ valid: true, phase: "toward_target", counted: false, t, ...extra });

function tickFor(s, from, ms, step = 500) {
  let t = from;
  for (; t < from + ms; t += step) s.tick(t);
  s.tick(t);
  return t;
}
/** Warm-up skipped, lesson read, camera framed for a second, practice skipped: counting starts. */
function frameAndStart(s, t) {
  for (const end = t + 1200; t <= end; t += 100) s.observe(ok(t));
  s.confirmCamera();
  s.observe(ok(t));
  s.startCounting();
  return t;
}

test("Guided flow in camera mode: warm-up -> learn -> camera setup -> practice -> exercise; nothing counts before it", () => {
  const s = make();
  s.begin(0);
  assert.equal(s.state, "WARM_UP");
  s.observe(ok(100, { counted: true }));
  assert.equal(s.reps, 0, "warm-up movements are never counted");
  tickFor(s, 0, 30000);
  assert.equal(s.state, "LEARN", "warm-up ends at the first lesson, which waits for the person");
  tickFor(s, 30000, 60000);
  assert.equal(s.state, "LEARN", "a lesson never times out into counting");
  s.ready();
  assert.equal(s.state, "CAMERA_SETUP");
  s.observe(ok(90100, { counted: true }));
  s.confirmCamera();
  assert.equal(s.state, "CAMERA_SETUP", "a single frame isn't a usable view");
  for (let t = 90100; t <= 91200; t += 100) s.observe(ok(t));
  s.confirmCamera();
  assert.equal(s.state, "PRACTICE");
  s.observe(ok(91300, { counted: true }));
  assert.equal(s.practiceReps, 1);
  assert.equal(s.reps, 0, "practice repetitions are praised, not counted");
  assert.ok(s.drain().some((a) => /practice 1\. It wasn't counted/.test(a.text)));
  s.observe({ valid: false, t: 91400, reason: "Move back" });
  s.startCounting();
  assert.equal(s.state, "PRACTICE", "Start counting needs a usable view right now");
  for (let t = 91500; t <= 92600; t += 100) s.observe(ok(t));
  const epoch = s.countEpoch;
  s.startCounting();
  assert.equal(s.state, "EXERCISE");
  assert.ok(s.countEpoch > epoch, "the detector is told to restart its repetition phase after practice");
  assert.equal(s.results[0].practiced, true);
  s.observe(ok(92700, { counted: true }));
  assert.equal(s.reps, 1);
});

test("Full sequential run: sets, rest waits for the person, next lesson, camera-timed plank, cool-down, summary", () => {
  const s = make();
  s.begin(0);
  s.next();
  s.ready();
  let t = frameAndStart(s, 0);
  for (let i = 0; i < 3; i++) s.observe(ok((t += 1000), { counted: true }));
  assert.equal(s.state, "REST");
  assert.equal(s.remainingMs, 20000);
  assert.deepEqual(s.upNext, { exerciseId: "chair_squat", set: 2 });
  t = tickFor(s, t, 25000);
  assert.equal(s.state, "REST", "without auto-next, rest ends only when the person taps Next");
  assert.equal(s.restDone, true);
  s.extendRest();
  assert.equal(s.restDone, false);
  assert.ok(s.remainingMs > 0, "resting longer is always allowed");
  s.next();
  assert.equal(s.state, "EXERCISE");
  assert.equal(s.set, 2);
  for (let i = 0; i < 2; i++) s.observe(ok((t += 1000), { counted: true }));
  s.manualRep();
  assert.equal(s.state, "REST");
  s.next();
  assert.equal(s.state, "LEARN");
  assert.equal(s.exercise.id, "supported_plank");
  assert.equal(s.cameraCounting, true, "the plank hold is now timed by the camera");
  s.ready();
  t = frameAndStart(s, t);
  assert.equal(s.state, "EXERCISE");
  s.startHold();
  t = tickFor(s, t, 3000);
  assert.equal(s.remainingMs, 10000, "the camera times the hold; the manual timer button does nothing in camera mode");
  const hold = (ms, holding) => {
    for (const end = t + ms; t < end; ) s.observe(ok((t += 100), { holding }));
  };
  hold(4100, true);
  assert.equal(s.remainingMs, 6000, "4 s held between frames that both saw the position");
  hold(3000, false);
  s.observe({ valid: false, t: (t += 100) });
  t += 2000;
  assert.equal(s.remainingMs, 6000, "time stops while the position is lost or unseen");
  hold(6100, true);
  assert.equal(s.state, "COOL_DOWN");
  t = tickFor(s, t, 30000);
  assert.equal(s.state, "SUMMARY");
  const sum = s.summary();
  assert.equal(sum.endedBy, "completed");
  assert.deepEqual(sum.exercises.map((e) => [e.exerciseId, e.setsDone, e.reps, e.cameraReps, e.manualReps, e.seconds]), [["chair_squat", 2, 6, 5, 1, 0], ["supported_plank", 1, 0, 0, 0, 10]]);
  assert.deepEqual(sum.exercises[0].countedBy, ["camera", "camera and manual"]);
  assert.deepEqual(sum.exercises[1].countedBy, ["camera"]);
  assert.equal(sum.setsDone, sum.setsPlanned);
  assert.ok(sum.exercises[0].quality.clearViewShare > 0.9);
  for (const key of ["calories", "kcal", "heartRate", "bpm", "accuracy", "formScore"]) assert.ok(!(key in sum), key);
  const kinds = s.events.map((e) => `${e.kind}:${e.source}`);
  assert.ok(kinds.includes("COUNT:camera") && kinds.includes("MANUAL:user") && kinds.includes("HOLD:camera"));
  assert.equal(sum.eventsBySource.camera, 6, "5 camera counts and 1 camera-timed hold");
  s.finish();
  assert.equal(s.state, "COMPLETED");
});

test("Auto-next is opt-in: when on, rest flows into the next set by itself", () => {
  const s = make({ autoNext: true });
  s.begin(0);
  s.next();
  s.ready();
  let t = frameAndStart(s, 0);
  for (let i = 0; i < 3; i++) s.observe(ok((t += 1000), { counted: true }));
  t = tickFor(s, t, 21000);
  assert.equal(s.state, "EXERCISE");
  assert.equal(s.set, 2);
});

test(`Tracking loss: after ${LOST_AFTER_MS} ms announces "${TRACKING_LOST_MESSAGE}" and resumes when seen again`, () => {
  const s = make();
  s.begin(0);
  s.next();
  s.ready();
  frameAndStart(s, 0);
  s.drain();
  s.observe({ valid: false, t: 2000, reason: "Can't see your body" });
  s.observe({ valid: false, t: 2500 });
  assert.equal(s.state, "EXERCISE", "a brief miss is tolerated");
  s.observe({ valid: false, t: 3000 });
  assert.equal(s.state, "TRACKING_LOST");
  assert.ok(s.drain().some((a) => a.text === TRACKING_LOST_MESSAGE));
  assert.ok(s.events.some((e) => e.kind === "TRACKING_LOST" && e.source === "system"));
  s.observe(ok(3100, { counted: true }));
  assert.equal(s.state, "EXERCISE");
  assert.equal(s.reps, 1);
  assert.equal(s.summary().exercises[0].quality.trackingLost, 1);
});

test("Pause freezes timers; resume continues where it left off", () => {
  const s = make({ mode: "manual" });
  s.begin(0);
  assert.equal(s.state, "WARM_UP");
  s.tick(10000);
  s.pause();
  s.tick(500000);
  assert.equal(s.state, "PAUSED");
  s.resume(500000);
  assert.equal(s.state, "WARM_UP");
  assert.equal(s.remainingMs, 20000);
});

test("Reload: state is restored PAUSED with the remaining time kept, never auto-advancing", () => {
  const s = make({ mode: "manual" });
  s.begin(0);
  s.next();
  assert.equal(s.state, "LEARN");
  s.ready();
  assert.equal(s.state, "EXERCISE", "manual mode goes from the lesson straight to the exercise");
  s.manualRep();
  s.manualRep();
  const saved = s.serialize();
  const r = WorkoutSession.restore(saved, { wallClock: () => NOW, tracked: isTracked });
  assert.equal(r.state, "PAUSED");
  r.tick(99999999);
  assert.equal(r.state, "PAUSED");
  r.resume(5);
  assert.equal(r.state, "EXERCISE");
  assert.equal(r.reps, 2);
  r.manualRep();
  assert.equal(r.state, "REST");
  assert.deepEqual(r.results[0].sets[0], { reps: 3, targetReps: 3, partials: 0, camera: 0, manual: 3, countedBy: "manual" });
  assert.throws(() => WorkoutSession.restore({ v: 99 }), /not supported/);
  const old = JSON.parse(saved);
  old.resumeTo = "NEXT_EXERCISE";
  const legacy = WorkoutSession.restore(old, { wallClock: () => NOW, tracked: isTracked });
  legacy.resume(1);
  assert.equal(legacy.state, "LEARN", "an old timed preview resumes as the lesson, never auto-starting");
});

test("Manual mode and switching to manual mid-session never use the camera", () => {
  const s = make();
  s.begin(0);
  s.next();
  s.ready();
  assert.equal(s.state, "CAMERA_SETUP");
  s.useManual();
  assert.equal(s.state, "EXERCISE");
  s.observe(ok(100, { counted: true }));
  assert.equal(s.reps, 0);
  s.manualRep();
  assert.equal(s.reps, 1);
  assert.ok(s.events.some((e) => e.kind === "MANUAL" && e.details?.switchedToManual));
});

test("Emergency symptom: immediate SAFETY_STOP with a 12-hour lockout; no restart from the same session", () => {
  const s = make({ mode: "manual" });
  s.begin(0);
  s.next();
  s.ready();
  s.reportSymptom("chest");
  assert.equal(s.state, "SAFETY_STOP");
  assert.equal(s.lockout.kind, "emergency");
  assert.equal(s.summary().endedBy, "safety_stop");
  assert.ok(s.events.some((e) => e.kind === "SAFETY_STOP" && e.source === "user"));
  s.resume(10);
  s.next();
  s.manualRep();
  assert.equal(s.state, "SAFETY_STOP");
  assert.equal(s.reps, 0);
  assert.equal(screen(Object.fromEntries(SCREEN_QUESTIONS.map((q) => [q.id, "no"])), { lockout: s.lockout, now: NOW + 1000 }).status, "emergency_stop");
});

test("Emergency during practice or a lesson stops too: no state is exempt", () => {
  for (const reach of [(s) => s.next(), (s) => (s.next(), s.ready()), (s) => (s.next(), s.ready(), frameAndStart(s, 0), s.pause())]) {
    const s = make();
    s.begin(0);
    reach(s);
    s.reportSymptom("I have chest pressure");
    assert.equal(s.state, "SAFETY_STOP");
  }
});

test("Typed symptoms go through the same rules: Bangla chest pain stops, knee pain skips that exercise only", () => {
  const a = make({ mode: "manual" });
  a.begin(0);
  a.next();
  a.ready();
  assert.equal(a.reportSymptom("বুকে ব্যথা").action, "emergency");
  assert.equal(a.state, "SAFETY_STOP");
  const b = make({ mode: "manual" });
  b.begin(0);
  b.next();
  b.ready();
  b.reportSymptom("my knee hurts");
  assert.equal(b.state, "LEARN");
  assert.equal(b.exercise.id, "supported_plank");
  assert.equal(b.results[0].skipReason, "Stopped for pain");
  const c = make({ mode: "manual" });
  c.begin(0);
  c.next();
  c.reportSymptom("dizzy");
  assert.equal(c.state, "SAFETY_STOP");
  assert.equal(c.lockout.kind, "rest");
});

test("Safety screen gates the session: review blocks, emergency stops, exclusions are skipped up front", () => {
  const review = screen({ ...Object.fromEntries(SCREEN_QUESTIONS.map((q) => [q.id, "no"])), heart: "yes" }, { now: NOW });
  const blocked = make({ screening: review });
  blocked.begin(0);
  assert.equal(blocked.state, "PRECHECK");
  assert.match(blocked.blockReason, /heart condition/);
  const clearance = recordClearance({ clinicianName: "Dr. Rahman", date: "2026-10-01" }, NOW);
  const heart = make({ screening: screen({ ...Object.fromEntries(SCREEN_QUESTIONS.map((q) => [q.id, "no"])), heart: "yes" }, { clearance, now: NOW }), mode: "manual" });
  heart.begin(0);
  assert.equal(heart.state, "WARM_UP");
  assert.ok(heart.remainingMs >= 120000, "heart-conscious sessions warm up for at least 2 minutes");
  const knee = make({ screening: screen({ ...Object.fromEntries(SCREEN_QUESTIONS.map((q) => [q.id, "no"])), pain: "yes" }, { painAreas: ["knee"], now: NOW }), mode: "manual" });
  knee.begin(0);
  knee.next();
  assert.equal(knee.exercise.id, "supported_plank", "chair squat was left out for knee pain");
  assert.equal(knee.summary().exercises[0].excludedBySafetyCheck, true);
  const emergency = make({ screening: screen({ ...Object.fromEntries(SCREEN_QUESTIONS.map((q) => [q.id, "no"])), emergency_now: "yes" }, { now: NOW }) });
  emergency.begin(0);
  assert.equal(emergency.state, "SAFETY_STOP");
  assert.equal(emergency.lockout.kind, "emergency");
});

test("Stopping early keeps what was actually done, and nothing more", () => {
  const s = make({ mode: "manual" });
  s.begin(0);
  s.next();
  s.ready();
  s.manualRep();
  s.finishSet();
  s.stop();
  const sum = s.summary();
  assert.equal(s.state, "CANCELLED");
  assert.equal(sum.endedBy, "cancelled");
  assert.deepEqual(sum.exercises[0].reps, 1);
  assert.equal(sum.exercises[0].manualReps, 1);
  assert.equal(sum.setsDone, 1);
});

test("Ending in the middle of a set keeps the reps already done; an empty set records nothing", () => {
  const s = make({ mode: "manual" });
  s.begin(0);
  s.next();
  s.ready();
  s.manualRep();
  s.manualRep();
  s.pause();
  s.stop();
  const e = s.summary().exercises[0];
  assert.equal(e.reps, 2);
  assert.equal(e.manualReps, 2);
  assert.equal(e.setsDone, 0, "an unfinished set isn't a finished set");
  assert.equal(s.results[0].sets[0].unfinished, true);
  const empty = make({ mode: "manual" });
  empty.begin(0);
  empty.next();
  empty.ready();
  empty.reportSymptom("chest");
  assert.equal(empty.state, "SAFETY_STOP");
  assert.equal(empty.summary().exercises[0].setsDone, 0, "no set is invented");
});

test("A symptom reported after the workout ended still stops further exercise and keeps how it ended", () => {
  const s = make({ mode: "manual" });
  s.begin(0);
  s.next();
  s.stop();
  assert.equal(s.reportSymptom("faint").action, "emergency");
  assert.equal(s.state, "SAFETY_STOP");
  assert.equal(s.lockout.kind, "emergency");
  assert.equal(s.summary().endedBy, "cancelled");
  assert.deepEqual(s.summary().safety, { action: "emergency", reasons: ["faint"] });
});

test("Skipping from a lesson moves to the next lesson; the event log is bounded", () => {
  const s = make({ mode: "manual" });
  s.begin(0);
  s.next();
  s.skip();
  assert.equal(s.state, "LEARN");
  assert.equal(s.exercise.id, "supported_plank");
  assert.equal(s.summary().exercises[0].skipped, true);
  for (let i = 0; i < 700; i++) s.log("CUE", "system");
  assert.equal(s.events.length, 500);
});
