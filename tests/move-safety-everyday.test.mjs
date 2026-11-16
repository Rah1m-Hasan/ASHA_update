// The Everyday Move is a separately shipped surface: it is reachable at
// /everyday.html without touching the React dashboard. It used to carry no
// safety code at all - no screen, no symptom report, no pause after a safety
// stop - so a person exercising there got none of the protections the React
// Move has.
//
// These tests pin the two things that make that safe again: there is only
// one policy (both surfaces import the same module), and that policy stops
// the session when it should.

import test from "node:test";
import assert from "node:assert/strict";

import {
  screen,
  SCREEN_QUESTIONS,
  startDecision,
  createLockout,
  lockoutActive,
  exerciseAllowed,
  checkSymptomText,
  symptomAction,
  SESSION_SYMPTOMS,
  EMERGENCY_LOCK_MS,
  REST_LOCK_MS,
} from "../public/app/everyday/move-safety.js";
// The React Move reaches the same file through this path. If the two ever
// stop being one module, there would be two policies again.
import * as reactSafety from "../src/features/move/safety.js";
import { EXERCISES } from "../public/app/everyday/move-engine.js";
import { EXERCISES as REACT_EXERCISES } from "../src/features/move/catalog.js";
import {
  readSafetyState,
  writeSafetyState,
  clearSafetyState,
  SAFETY_STATE_KEY,
} from "../public/app/everyday/move-safety-state.js";

const NOW = Date.parse("2026-11-14T09:00:00Z");
const allNo = Object.fromEntries(SCREEN_QUESTIONS.map((q) => [q.id, "no"]));

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("the Everyday Move and the React Move share one safety policy", () => {
  assert.equal(
    reactSafety.screen,
    screen,
    "both surfaces must run the same screen",
  );
  assert.equal(reactSafety.createLockout, createLockout);
  assert.equal(typeof reactSafety.startDecision, "function");
});

test("the Everyday catalogue carries the same screening flags as the React one", () => {
  for (const [id, spec] of Object.entries(EXERCISES)) {
    const react = REACT_EXERCISES[id];
    assert.ok(react, `the React catalogue has ${id}`);
    assert.deepEqual(
      spec.screeningFlags,
      react.screeningFlags,
      `${id} must carry the same screening flags`,
    );
  }
});

test("an unanswered safety question stops the Everyday session", () => {
  const partial = { ...allNo };
  delete partial.heart;
  const screening = screen(partial, { now: NOW });
  assert.equal(screening.status, "review_required");
  const decision = startDecision(screening, {
    answers: partial,
    painAreas: [],
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.kind, "answers");
});

test("warning symptoms stop the Everyday session before it starts", () => {
  for (const value of ["yes", "unsure"]) {
    const answers = { ...allNo, emergency_now: value };
    const screening = screen(answers, { now: NOW });
    assert.equal(screening.status, "emergency_stop");
    const decision = startDecision(screening, { answers, painAreas: [] });
    assert.equal(decision.allowed, false);
    assert.equal(decision.kind, "emergency");
  }
});

test("a known condition needs a clinician, and ASHA gives no clearance itself", () => {
  const answers = { ...allNo, heart: "yes" };
  const screening = screen(answers, { now: NOW });
  assert.equal(screening.status, "review_required");
  assert.equal(screening.needsClearance, true);
  const alone = startDecision(screening, { answers, painAreas: [] });
  assert.equal(alone.allowed, false);
  assert.equal(alone.kind, "review");
  // A clinician's own plan is the clinician's assessment.
  const withPlan = startDecision(screening, {
    answers,
    painAreas: [],
    clinicianPlan: true,
  });
  assert.equal(withPlan.allowed, true);
  assert.equal(withPlan.kind, "clinician_plan");
});

test("a movement that loads a painful area is left out", () => {
  const answers = { ...allNo, pain: "yes" };
  const screening = screen(answers, { painAreas: ["knee"], now: NOW });
  assert.equal(screening.status, "clear_for_general_wellness");
  assert.equal(
    exerciseAllowed(EXERCISES.knee_extension, screening).allowed,
    false,
    "a painful knee rules out the knee extension",
  );
  assert.equal(
    exerciseAllowed(EXERCISES.elbow_flexion, screening).allowed,
    true,
    "an unrelated movement is still offered",
  );
});

test("pain without an area is asked for before the session starts", () => {
  const answers = { ...allNo, pain: "yes" };
  const screening = screen(answers, { painAreas: [], now: NOW });
  const decision = startDecision(screening, { answers, painAreas: [] });
  assert.equal(decision.allowed, false);
  assert.equal(decision.kind, "answers");
});

test("a reported symptom stops the session and pauses it", () => {
  const emergency = SESSION_SYMPTOMS.find((s) => s.id === "chest");
  assert.equal(emergency.action, "emergency");
  assert.equal(symptomAction("chest"), "emergency");
  assert.equal(symptomAction("dizzy"), "stop_rest");

  const spoken = checkSymptomText("I have chest pain", { region: "BD" });
  assert.equal(spoken.action, "emergency");
  const denied = checkSymptomText("I have no chest pain", { region: "BD" });
  assert.equal(denied.action, "continue");
});

test("the pause after an emergency stop is the same twelve hours", () => {
  const lock = createLockout("emergency", ["Warning symptoms"], NOW);
  assert.equal(lock.until - lock.since, EMERGENCY_LOCK_MS);
  assert.ok(lockoutActive(lock, NOW + 60 * 60 * 1000));
  assert.equal(lockoutActive(lock, NOW + EMERGENCY_LOCK_MS), false);
  const rest = createLockout("stop_rest", ["Dizziness"], NOW);
  assert.equal(rest.until - rest.since, REST_LOCK_MS);
});

test("the pause survives a reload", () => {
  const storage = fakeStorage();
  const lock = createLockout("emergency", ["Warning symptoms"], NOW);
  assert.equal(writeSafetyState({ lockout: lock }, storage), true);
  // A reload reads the same store back.
  const restored = readSafetyState(storage);
  assert.equal(restored.lockout.until, lock.until);
  assert.ok(lockoutActive(restored.lockout, NOW + 1000));
  const screening = screen(allNo, { lockout: restored.lockout, now: NOW });
  assert.equal(screening.status, "emergency_stop");
  const decision = startDecision(screening, {
    answers: allNo,
    painAreas: [],
  });
  assert.equal(decision.allowed, false);
});

test("a stored entry that cannot be read is treated as no state at all", () => {
  const broken = fakeStorage({ [SAFETY_STATE_KEY]: "{not json" });
  assert.deepEqual(readSafetyState(broken), {
    lockout: null,
    answers: {},
    painAreas: [],
    remember: false,
  });
  // A pause without an end time is not a pause.
  const partial = fakeStorage({
    [SAFETY_STATE_KEY]: JSON.stringify({ lockout: { kind: "emergency" } }),
  });
  assert.equal(readSafetyState(partial).lockout, null);
});

test("a 'right now' answer is never remembered", () => {
  const storage = fakeStorage();
  writeSafetyState(
    {
      lockout: null,
      answers: { emergency_now: "yes", heart: "yes" },
      painAreas: ["knee"],
      remember: true,
    },
    storage,
  );
  const state = readSafetyState(storage);
  assert.equal(state.answers.emergency_now, undefined);
  assert.equal(state.answers.heart, "yes");
  assert.deepEqual(state.painAreas, ["knee"]);
  assert.equal(state.remember, true);
});

test("forgetting the safety state clears it", () => {
  const storage = fakeStorage();
  writeSafetyState({ lockout: createLockout("emergency", ["x"], NOW) }, storage);
  assert.ok(readSafetyState(storage).lockout);
  assert.equal(clearSafetyState(storage), true);
  assert.equal(readSafetyState(storage).lockout, null);
});

test("a store that cannot be written does not break the app", () => {
  const broken = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(writeSafetyState({ lockout: null }, broken), false);
  assert.equal(readSafetyState(broken).lockout, null);
  assert.equal(clearSafetyState(broken), false);
});
