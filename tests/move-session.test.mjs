import test from "node:test";
import assert from "node:assert/strict";
import { WorkoutSession, TRACKING_LOST_MESSAGE, LOST_AFTER_MS } from "../src/features/move/session.js";
import { screen, SCREEN_QUESTIONS, recordClearance } from "../src/features/move/safety.js";
import { isTracked } from "../src/features/move/detectors.js";

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
const make = (opts = {}) => new WorkoutSession({ program, screening: clear, wallClock: () => NOW, tracked: isTracked, ...opts });
const ok = (t, extra = {}) => ({ valid: true, phase: "toward_target", counted: false, t, ...extra });

function tickFor(s, from, ms, step = 500) {
  let t = from;
  for (; t < from + ms; t += step) s.tick(t);
  s.tick(t);
  return t;
}

test("Camera mode: no counting before a usable view is confirmed, nor during warm-up", () => {
  const s = make();
  s.begin(0);
  assert.equal(s.state, "CAMERA_SETUP");
  s.observe(ok(100, { counted: true }));
  s.confirmCamera();
  assert.equal(s.state, "CAMERA_SETUP", "a single frame isn't a usable view");
  for (let t = 100; t <= 1200; t += 100) s.observe(ok(t));
  s.confirmCamera();
  assert.equal(s.state, "WARM_UP");
  s.observe(ok(1300, { counted: true }));
  assert.equal(s.reps, 0, "warm-up movements are never counted");
  tickFor(s, 1300, 30000);
  assert.equal(s.state, "EXERCISE");
});

test("Full sequential run: sets, rest, next exercise preview, timed hold, cool-down, summary", () => {
  const s = make();
  s.begin(0);
  for (let t = 0; t <= 1200; t += 100) s.observe(ok(t));
  s.confirmCamera();
  let t = tickFor(s, 1200, 30000);
  assert.equal(s.state, "EXERCISE");
  for (let i = 0; i < 3; i++) s.observe(ok((t += 1000), { counted: true }));
  assert.equal(s.state, "REST");
  assert.equal(s.remainingMs, 20000);
  t = tickFor(s, t, 20000);
  assert.equal(s.state, "EXERCISE");
  assert.equal(s.set, 2);
  for (let i = 0; i < 3; i++) s.observe(ok((t += 1000), { counted: true }));
  t = tickFor(s, t, 20000);
  assert.equal(s.state, "NEXT_EXERCISE");
  assert.equal(s.exercise.id, "supported_plank");
  t = tickFor(s, t, 10000);
  assert.equal(s.state, "EXERCISE");
  assert.equal(s.cameraCounting, false, "the plank is manual: its time comes from the timer the person starts");
  t = tickFor(s, t, 5000);
  assert.equal(s.remainingMs, 10000, "the hold timer waits for the person");
  s.startHold();
  t = tickFor(s, t, 10000);
  assert.equal(s.state, "COOL_DOWN");
  t = tickFor(s, t, 30000);
  assert.equal(s.state, "SUMMARY");
  const sum = s.summary();
  assert.equal(sum.endedBy, "completed");
  assert.deepEqual(sum.exercises.map((e) => [e.exerciseId, e.setsDone, e.reps, e.seconds]), [["chair_squat", 2, 6, 0], ["supported_plank", 1, 0, 10]]);
  assert.deepEqual(sum.exercises[0].countedBy, ["camera"]);
  assert.equal(sum.setsDone, sum.setsPlanned);
  for (const key of ["calories", "kcal", "heartRate", "bpm"]) assert.ok(!(key in sum), key);
  s.finish();
  assert.equal(s.state, "COMPLETED");
});

test(`Tracking loss: after ${LOST_AFTER_MS} ms announces "${TRACKING_LOST_MESSAGE}" and resumes when seen again`, () => {
  const s = make();
  s.begin(0);
  for (let t = 0; t <= 1200; t += 100) s.observe(ok(t));
  s.confirmCamera();
  s.next();
  s.drain();
  s.observe({ valid: false, t: 2000, reason: "Can't see your body" });
  s.observe({ valid: false, t: 2500 });
  assert.equal(s.state, "EXERCISE", "a brief miss is tolerated");
  s.observe({ valid: false, t: 3000 });
  assert.equal(s.state, "TRACKING_LOST");
  assert.ok(s.drain().some((a) => a.text === TRACKING_LOST_MESSAGE));
  s.observe(ok(3100, { counted: true }));
  assert.equal(s.state, "EXERCISE");
  assert.equal(s.reps, 1);
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
  assert.deepEqual(r.results[0].sets[0], { reps: 3, targetReps: 3, partials: 0, countedBy: "manual" });
  assert.throws(() => WorkoutSession.restore({ v: 99 }), /not supported/);
});

test("Manual mode and switching to manual mid-session never use the camera", () => {
  const s = make();
  s.begin(0);
  s.useManual();
  assert.equal(s.state, "WARM_UP");
  s.next();
  s.observe(ok(100, { counted: true }));
  assert.equal(s.reps, 0);
  s.manualRep();
  assert.equal(s.reps, 1);
});

test("Emergency symptom: immediate SAFETY_STOP with a 12-hour lockout; no restart from the same session", () => {
  const s = make({ mode: "manual" });
  s.begin(0);
  s.next();
  s.reportSymptom("chest");
  assert.equal(s.state, "SAFETY_STOP");
  assert.equal(s.lockout.kind, "emergency");
  assert.equal(s.summary().endedBy, "safety_stop");
  s.resume(10);
  s.next();
  assert.equal(s.state, "SAFETY_STOP");
  assert.equal(screen(Object.fromEntries(SCREEN_QUESTIONS.map((q) => [q.id, "no"])), { lockout: s.lockout, now: NOW + 1000 }).status, "emergency_stop");
});

test("Typed symptoms go through the same rules: Bangla chest pain stops, knee pain skips that exercise only", () => {
  const a = make({ mode: "manual" });
  a.begin(0);
  a.next();
  assert.equal(a.reportSymptom("বুকে ব্যথা").action, "emergency");
  assert.equal(a.state, "SAFETY_STOP");
  const b = make({ mode: "manual" });
  b.begin(0);
  b.next();
  b.reportSymptom("my knee hurts");
  assert.equal(b.state, "NEXT_EXERCISE");
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
  s.manualRep();
  s.finishSet();
  s.stop();
  const sum = s.summary();
  assert.equal(s.state, "CANCELLED");
  assert.equal(sum.endedBy, "cancelled");
  assert.deepEqual(sum.exercises[0].reps, 1);
  assert.equal(sum.setsDone, 1);
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
