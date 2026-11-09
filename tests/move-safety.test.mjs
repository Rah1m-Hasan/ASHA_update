import test from "node:test";
import assert from "node:assert/strict";
import {
  screen, SCREEN_QUESTIONS, checkSymptomText, createLockout, lockoutActive, attestAssessment, recordClearance,
  clearanceValid, exerciseAllowed, urgentGuidance, restGuidance, EMERGENCY_LOCK_MS, MIN_ATTEST_MS, REST_LOCK_MS,
} from "../src/features/move/safety.js";
import { EXERCISES, GOALS, recommendProgram, validateProgram, importClinicianProgram, CATALOG_VERSION, TEMPLATES } from "../src/features/move/catalog.js";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const allNo = Object.fromEntries(SCREEN_QUESTIONS.map((q) => [q.id, "no"]));

test("Screen: all clear allows general wellness; unanswered questions block", () => {
  assert.equal(screen(allNo, { now: NOW }).status, "clear_for_general_wellness");
  const partial = { ...allNo };
  delete partial.heart;
  assert.equal(screen(partial, { now: NOW }).status, "review_required");
});

test("Screen: warning symptoms now, or unsure, stop before any exercise", () => {
  for (const answer of ["yes", "unsure"]) {
    const r = screen({ ...allNo, emergency_now: answer }, { now: NOW });
    assert.equal(r.status, "emergency_stop", answer);
  }
});

test("Screen: a heart condition is not a blanket ban; a recorded clinician clearance allows a heart-conscious plan", () => {
  const without = screen({ ...allNo, heart: "yes" }, { now: NOW });
  assert.equal(without.status, "review_required");
  assert.match(without.reasons.join(" "), /Many people with heart conditions can exercise/);
  assert.doesNotMatch(without.reasons.join(" "), /shouldn'?t exercise|must not exercise/i);
  const clearance = recordClearance({ clinicianName: "Dr. Rahman", date: "2026-10-01" }, NOW);
  assert.equal(clearance.source, "self_reported");
  const withClearance = screen({ ...allNo, heart: "yes" }, { clearance, now: NOW });
  assert.equal(withClearance.status, "clear_for_general_wellness");
  assert.equal(withClearance.heartConscious, true);
  assert.throws(() => recordClearance({ clinicianName: "", date: "2026-10-01" }, NOW), /name/);
  assert.throws(() => recordClearance({ clinicianName: "Dr. A", date: "2030-01-01" }, NOW), /future/);
  assert.throws(() => recordClearance({ clinicianName: "Dr. A", date: "2024-01-01" }, NOW), /over a year/);
  assert.equal(clearanceValid({ clinicianName: "Dr. A", date: "2025-01-01" }, NOW), false);
});

test("Screen: pain areas leave out matching exercises; balance concerns leave out unsupported ones", () => {
  const knee = screen({ ...allNo, pain: "yes" }, { painAreas: ["knee"], now: NOW });
  assert.equal(knee.status, "clear_for_general_wellness");
  assert.equal(exerciseAllowed(EXERCISES.chair_squat, knee).allowed, false);
  assert.equal(exerciseAllowed(EXERCISES.arm_raise, knee).allowed, true);
  assert.equal(screen({ ...allNo, pain: "yes" }, { now: NOW }).status, "review_required", "pain with no area named");
  const balance = screen({ ...allNo, balance: "yes" }, { now: NOW });
  assert.equal(exerciseAllowed(EXERCISES.squat, balance).allowed, false);
  assert.equal(exerciseAllowed(EXERCISES.sit_to_stand, balance).allowed, true);
  assert.ok(balance.supportNeeded);
});

test("Symptoms in English, Bangla and Banglish: emergencies stop; denials and routine fatigue don't", () => {
  const emergency = [
    "I have chest pain", "can't breathe", "I feel faint", "my face is drooping", "slurred speech suddenly",
    "weakness on one side", "বুকে ব্যথা করছে", "শ্বাস নিতে কষ্ট হচ্ছে", "মুখ বেঁকে গেছে", "কথা জড়িয়ে যাচ্ছে", "buke betha", "chest pain, maybe",
  ];
  for (const text of emergency) assert.equal(checkSymptomText(text).action, "emergency", text);
  assert.equal(checkSymptomText("I feel dizzy").action, "stop_rest");
  assert.equal(checkSymptomText("মাথা ঘুরছে").action, "stop_rest");
  assert.equal(checkSymptomText("my heart is racing").action, "stop_rest");
  assert.equal(checkSymptomText("my knee hurts").action, "stop_exercise");
  assert.equal(checkSymptomText("sharp pain in my shoulder").action, "stop_exercise");
  for (const text of ["no chest pain, just tired", "বুকে ব্যথা নেই", "I'm a bit tired", "no dizziness"]) assert.equal(checkSymptomText(text).action, "continue", text);
});

test("Symptom rules ignore any other opinion passed in (an AI cannot downgrade an emergency)", () => {
  const r = checkSymptomText("chest pain", { region: "BD", modelOpinion: "safe", override: "continue", allowLLM: true });
  assert.equal(r.action, "emergency");
});

test("Emergency lockout: lasts 12 hours, cannot be dismissed straight away, and keeps an audit trail", () => {
  const lock = createLockout("emergency", ["Reported chest pain"], NOW);
  assert.equal(lock.until - lock.since, EMERGENCY_LOCK_MS);
  assert.ok(lockoutActive(lock, NOW + 60_000));
  const screened = screen(allNo, { lockout: lock, now: NOW + 60_000 });
  assert.equal(screened.status, "emergency_stop");
  assert.ok(screened.locked, "answering 'no' again can't restart during the lockout");
  assert.throws(() => attestAssessment(lock, { clinicianName: "Dr. Rahman", confirmed: true }, NOW + 60_000), /straight away/);
  assert.throws(() => attestAssessment(lock, { clinicianName: "", confirmed: true }, NOW + MIN_ATTEST_MS), /clinician/);
  const cleared = attestAssessment(lock, { clinicianName: "Dr. Rahman", confirmed: true }, NOW + MIN_ATTEST_MS);
  assert.equal(lockoutActive(cleared, NOW + MIN_ATTEST_MS), false);
  assert.deepEqual(cleared.audit.map((a) => a.event), ["emergency_stop", "assessment_attested"]);
  assert.equal(lockoutActive(lock, NOW + EMERGENCY_LOCK_MS + 1), false);
});

test("Rest lockout after dizziness is short and not shown as an emergency", () => {
  const lock = createLockout("stop_rest", ["Dizziness"], NOW);
  assert.equal(lock.until - lock.since, REST_LOCK_MS);
  assert.equal(screen(allNo, { lockout: lock, now: NOW + 1000 }).status, "paused");
  assert.equal(createLockout("stop_exercise", [], NOW), null);
});

test("Urgent guidance gives the emergency number, no self-tests, in both languages", () => {
  const en = urgentGuidance("en", "BD", ["Possible stroke warning signs."]).join(" ");
  assert.match(en, /Call 999/);
  assert.match(en, /Note the time/);
  assert.match(en, /Don't try an exercise or app test/);
  const bn = urgentGuidance("bn", "BD").join(" ");
  assert.match(bn, /999/);
  assert.match(bn, /ব্যায়াম বন্ধ করুন/);
  assert.match(restGuidance("en").join(" "), /urgent help/);
});

test("Catalog: versioned, bilingual and complete enough to drive every screen", () => {
  assert.match(CATALOG_VERSION, /^\d{4}\.\d+\.\d+$/);
  for (const e of Object.values(EXERCISES)) {
    assert.ok(e.title && e.titleBn && e.steps.length && e.stepsBn.length === e.steps.length, e.id);
    assert.ok(e.stopCues.length && e.limitation && e.defaults.sets >= 1, e.id);
    for (const alt of e.alternatives) assert.ok(EXERCISES[alt], `${e.id} alternative ${alt}`);
  }
  for (const t of Object.values(TEMPLATES)) validateProgram({ ...t, authoredBy: "content_team" });
});

test("Goals that promise spot reduction or reshaping get an honest clarification", () => {
  for (const [category, id] of [["face", "facial_fat"], ["face", "jawline"], ["core", "belly_fat"], ["full_body", "lose_fast"]]) {
    const g = GOALS[category].find((x) => x.id === id);
    assert.ok(g?.clarify, id);
  }
  assert.match(GOALS.face.find((g) => g.id === "facial_fat").clarify, /not been shown to reduce facial fat/);
  assert.match(GOALS.core.find((g) => g.id === "belly_fat").clarify, /No exercise burns fat from one area/);
});

test("Starter plans adapt to the answers; rehab and heart need a clinician", () => {
  const seated = recommendProgram({ category: "lower_body", level: "inactive", seatedOnly: true, minutes: 10 });
  assert.ok(seated.sequence.every((s) => !["chair_squat", "squat", "sit_to_stand", "heel_raise"].includes(s.exerciseId)));
  const beginner = recommendProgram({ category: "upper_body", level: "beginner", minutes: 10 });
  assert.ok(beginner.sequence.every((s) => s.sets === 1 && (s.targetReps ?? 0) <= 5));
  assert.equal(recommendProgram({ category: "face", minutes: 5 }).sequence.length, 2);
  assert.equal(recommendProgram({ category: "rehab" }), null);
  assert.equal(recommendProgram({ category: "heart" }), null);
  assert.match(recommendProgram({ category: "core" }).why, /not a prescription/);
});

test("Plans are validated; clinician-only exercises need a clinician plan with origin, name and date", () => {
  assert.throws(() => validateProgram({ authoredBy: "user", sequence: [{ exerciseId: "jaw_open_close", sets: 1, targetReps: 5, restSeconds: 30 }] }), /clinician/);
  assert.throws(() => validateProgram({ authoredBy: "user", sequence: [{ exerciseId: "squat", sets: 11, targetReps: 5, restSeconds: 30 }] }), /Sets/);
  assert.throws(() => validateProgram({ authoredBy: "user", sequence: [{ exerciseId: "nope", sets: 1, restSeconds: 30 }] }), /Unknown/);
  assert.throws(() => importClinicianProgram({ value: { clinicianName: "Dr. A", approvedAt: "2026-11-01", exercises: [{ exerciseId: "squat" }] } }), /clinician-approved/);
  const plan = importClinicianProgram({ plan: { source: "clinician", value: { clinicianName: "Dr. A", approvedAt: "2026-11-01", exercises: [{ exerciseId: "knee_extension", sets: 2, repsPerSet: 8 }, { exerciseId: "jaw_open_close", sets: 1 }] } } });
  assert.equal(plan.authoredBy, "clinician");
  assert.deepEqual(plan.sequence.map((s) => [s.exerciseId, s.clinicianLocked]), [["knee_extension", true], ["jaw_open_close", true]]);
  // The Clinic workspace's own plan record (hyphenated ids, clinician angles, approval time in `at`).
  const clinic = importClinicianProgram({ id: "a".repeat(24), patientId: "b".repeat(24), exerciseId: "elbow-flexion", startAngle: 150, targetAngle: 80, returnAngle: 140, holdMs: 400, reps: 6, side: "right", source: "clinician", clinicianName: "Dr. Akter", at: "2026-11-01T09:00:00Z" });
  assert.deepEqual(clinic.sequence[0], { exerciseId: "elbow_flexion", sets: 1, targetReps: 6, holdSeconds: undefined, restSeconds: 45, limits: { start: 150, target: 80, return: 140 }, holdMs: 400, side: "right", clinicianLocked: true });
  assert.equal(clinic.professionalIdentityVerified, false);
  assert.throws(() => validateProgram({ authoredBy: "user", sequence: [{ exerciseId: "squat", sets: 1, targetReps: 5, restSeconds: 30, limits: { start: 170, target: 60, return: 160 } }] }), /Only a clinician/);
  assert.throws(() => validateProgram({ authoredBy: "user", sequence: [{ exerciseId: "knee_extension", sets: 1, targetReps: 5, restSeconds: 30 }] }), /clinician-assigned/);
});
