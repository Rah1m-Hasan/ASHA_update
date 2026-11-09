// ASHA Move session: one exercise at a time, driven by explicit states. Timers use a monotonic clock
// passed in by the caller (performance.now in the browser); across a reload only elapsed amounts are
// kept and the session comes back PAUSED, so nothing advances while nobody is watching.

import { EXERCISES, validateProgram, title } from "./catalog.js";
import { exerciseAllowed, checkSymptomText, symptomAction, createLockout, SESSION_SYMPTOMS } from "./safety.js";

export const STATES = Object.freeze([
  "NOT_STARTED", "PRECHECK", "CAMERA_SETUP", "WARM_UP", "EXERCISE", "REST", "NEXT_EXERCISE", "COOL_DOWN",
  "SUMMARY", "PAUSED", "TRACKING_LOST", "SAFETY_STOP", "CANCELLED", "COMPLETED",
]);
const TERMINAL = new Set(["SAFETY_STOP", "CANCELLED", "COMPLETED"]);
const PAUSABLE = new Set(["CAMERA_SETUP", "WARM_UP", "EXERCISE", "REST", "NEXT_EXERCISE", "COOL_DOWN", "TRACKING_LOST"]);
const TIMED = new Set(["WARM_UP", "REST", "NEXT_EXERCISE", "COOL_DOWN"]);

export const LOST_AFTER_MS = 1000;
export const FRAMING_OK_MS = 1000;
export const NEXT_PREVIEW_MS = 10000;
export const TRACKING_LOST_MESSAGE = "Can't see your movement; reposition camera.";
export const TRACKING_LOST_MESSAGE_BN = "আপনার নড়াচড়া দেখা যাচ্ছে না; ক্যামেরা ঠিক করুন।";
const HEART_WARM_MS = 120000;

export class WorkoutSession {
  /**
   * @param {{program: import("./catalog.js").WorkoutProgram & {limits?: unknown}, mode?: "camera"|"manual", screening: any, language?: "en"|"bn", region?: string, wallClock?: () => number, tracked?: (id: string) => boolean}} options
   */
  constructor({ program, mode = "camera", screening, language = "en", region = "BD", wallClock = () => Date.now(), tracked = () => false }) {
    validateProgram(program);
    this.program = program;
    this.mode = mode === "manual" ? "manual" : "camera";
    this.screening = screening ?? null;
    this.language = language === "bn" ? "bn" : "en";
    this.region = region;
    this.wallClock = wallClock;
    this.tracked = tracked;
    this.state = "NOT_STARTED";
    this.resumeTo = null;
    this.index = 0;
    this.set = 1;
    this.reps = 0;
    this.partials = 0;
    this.phaseMs = 0;
    this.elapsedMs = 0;
    this.activeMs = 0;
    this.lastTick = null;
    this.holdRunning = false;
    this.holdMs = 0;
    this.invalidSince = null;
    this.validSince = null;
    this.framingOk = false;
    this.detectorEpoch = 0;
    this.startedAt = null;
    this.endedAt = null;
    this.endedBy = null;
    this.blockReason = "";
    /** @type {{action: string, reasons: string[]} | null} */
    this.safety = null;
    /** @type {import("./safety.js").Lockout | null} */
    this.lockout = null;
    this.announcements = [];
    const heart = !!screening?.heartConscious;
    this.warmUpMs = Math.max(program.warmUpSeconds * 1000, heart ? HEART_WARM_MS : 0);
    this.coolDownMs = Math.max(program.coolDownSeconds * 1000, heart ? HEART_WARM_MS : 0);
    this.results = program.sequence.map((step) => {
      const allowed = exerciseAllowed(EXERCISES[step.exerciseId], screening);
      return { exerciseId: step.exerciseId, step, sets: [], skipped: !allowed.allowed, excluded: !allowed.allowed, skipReason: allowed.allowed ? "" : allowed.reason };
    });
  }

  get step() {
    return this.program.sequence[this.index];
  }
  get exercise() {
    return EXERCISES[this.step?.exerciseId];
  }
  /** Does the camera count the current exercise? */
  get cameraCounting() {
    return this.mode === "camera" && !!this.exercise && this.tracked(this.exercise.id);
  }
  get remainingMs() {
    if (this.state === "EXERCISE" && this.holdTarget) return Math.max(0, this.holdTarget - this.holdMs);
    return TIMED.has(this.state) ? Math.max(0, this.phaseMs - this.elapsedMs) : 0;
  }
  get holdTarget() {
    const s = this.step, kind = this.exercise?.kind;
    if (kind === "timed_hold") return (s.holdSeconds ?? 0) * 1000;
    if (kind === "duration") return (s.durationSeconds ?? 0) * 1000;
    return 0;
  }

  say(text, kind = "info") {
    this.announcements.push({ text, kind, at: this.lastTick });
  }
  /** Take queued announcements (for speech and the live region). */
  drain() {
    const out = this.announcements;
    this.announcements = [];
    return out;
  }
  enter(state, phaseMs = 0) {
    this.state = state;
    this.phaseMs = phaseMs;
    this.elapsedMs = 0;
  }

  begin(t) {
    if (this.state !== "NOT_STARTED") return this;
    this.startedAt = new Date(this.wallClock()).toISOString();
    this.lastTick = t;
    this.enter("PRECHECK");
    return this.precheck(this.screening);
  }

  /** Apply the rule-based screen. Nothing past PRECHECK happens without a clear result. */
  precheck(screening) {
    if (this.state !== "PRECHECK") return this;
    this.screening = screening;
    if (!screening || screening.status === "review_required" || screening.status === "paused") {
      this.blockReason = screening?.reasons?.join(" ") || "Complete the safety check first.";
      return this;
    }
    // A lockout that is already running is kept as it is, so re-screening can't restart its clock.
    if (screening.status === "emergency_stop") return this.safetyStop("emergency", screening.reasons, { lock: !screening.locked });
    this.blockReason = "";
    if (this.results.every((r) => r.skipped)) {
      this.blockReason = "Every exercise in this plan was left out by today's safety check. Choose another plan.";
      return this;
    }
    this.advanceToFirstAllowed();
    if (this.mode === "camera" && this.results.some((r) => !r.skipped && this.tracked(r.exerciseId))) this.enter("CAMERA_SETUP");
    else this.enter("WARM_UP", this.warmUpMs), this.say("Warm up: march gently in place or seated, roll your shoulders and breathe normally.");
    return this;
  }

  advanceToFirstAllowed() {
    while (this.index < this.results.length && this.results[this.index].skipped) this.index++;
  }

  /** Switch to manual counting at any point. The camera never counts again in this session. */
  useManual() {
    if (TERMINAL.has(this.state)) return this;
    this.mode = "manual";
    this.invalidSince = this.validSince = null;
    if (this.state === "CAMERA_SETUP") this.enter("WARM_UP", this.warmUpMs);
    if (this.state === "TRACKING_LOST") this.state = "EXERCISE";
    if (this.state === "PAUSED" && this.resumeTo === "TRACKING_LOST") this.resumeTo = "EXERCISE";
    this.say("Manual counting: tap once for each repetition you finish.");
    return this;
  }

  /** CAMERA_SETUP -> WARM_UP only after a usable view has been seen. */
  confirmCamera() {
    if (this.state !== "CAMERA_SETUP" || !this.framingOk) return this;
    this.enter("WARM_UP", this.warmUpMs);
    this.say("Warm up: march gently in place or seated, roll your shoulders and breathe normally.");
    return this;
  }

  tick(t) {
    if (!Number.isFinite(t)) return this;
    const dt = this.lastTick === null ? 0 : Math.max(0, t - this.lastTick);
    this.lastTick = t;
    if (this.state === "PAUSED" || TERMINAL.has(this.state) || this.state === "NOT_STARTED" || this.state === "PRECHECK" || this.state === "SUMMARY") return this;
    this.activeMs += dt;
    if (this.state === "EXERCISE" && this.holdTarget) {
      if (this.holdRunning) {
        this.holdMs += dt;
        if (this.holdMs >= this.holdTarget) this.finishSet();
      }
      return this;
    }
    if (!TIMED.has(this.state)) return this;
    this.elapsedMs += dt;
    if (this.elapsedMs < this.phaseMs) return this;
    if (this.state === "WARM_UP") this.startExercise();
    else if (this.state === "REST") this.afterRest();
    else if (this.state === "NEXT_EXERCISE") this.startExercise();
    else if (this.state === "COOL_DOWN") this.toSummary("completed");
    return this;
  }

  startExercise() {
    this.enter("EXERCISE");
    this.reps = 0;
    this.partials = 0;
    this.holdMs = 0;
    this.holdRunning = false;
    this.invalidSince = this.validSince = null;
    this.detectorEpoch++;
    const s = this.step;
    const what = this.holdTarget ? `${Math.round(this.holdTarget / 1000)} seconds` : `${s.targetReps} repetitions`;
    this.say(`${title(this.exercise, this.language)}. Set ${this.set} of ${s.sets}: ${what}.`);
  }

  /** Feed one detector result. Only counts in EXERCISE, only when the camera counts this exercise. */
  observe(result) {
    const t = result?.t;
    if (!Number.isFinite(t)) return this;
    if (this.state === "CAMERA_SETUP") {
      if (result.valid && result.phase !== "lost") {
        this.validSince ??= t;
        if (t - this.validSince >= FRAMING_OK_MS) this.framingOk = true;
      } else {
        this.validSince = null;
        this.framingOk = false;
      }
      return this;
    }
    if (!this.cameraCounting || (this.state !== "EXERCISE" && this.state !== "TRACKING_LOST")) return this;
    if (!result.valid) {
      this.invalidSince ??= t;
      if (this.state === "EXERCISE" && t - this.invalidSince >= LOST_AFTER_MS) {
        this.state = "TRACKING_LOST";
        this.say(this.language === "bn" ? TRACKING_LOST_MESSAGE_BN : TRACKING_LOST_MESSAGE, "warning");
      }
      return this;
    }
    this.invalidSince = null;
    if (this.state === "TRACKING_LOST") {
      this.state = "EXERCISE";
      this.say("Tracking again. The unfinished repetition was not counted.");
    }
    if (result.event === "partial") this.partials++;
    if (result.counted) this.addRep("camera");
    return this;
  }

  addRep(source) {
    if (this.state !== "EXERCISE" || this.holdTarget) return;
    this.reps++;
    this.lastSource = source;
    const target = this.step.targetReps ?? 0;
    this.say(String(this.reps), "count");
    if (target && this.reps >= target) this.finishSet(source);
  }

  /** One tap per repetition the person finished. Allowed in camera mode too, and recorded as manual. */
  manualRep() {
    this.manualCount = (this.manualCount ?? 0) + 1;
    this.addRep("manual");
    return this;
  }

  startHold() {
    if (this.state === "EXERCISE" && this.holdTarget) this.holdRunning = true;
    return this;
  }

  /** Close the current set with what actually happened (fewer reps than planned is fine). */
  finishSet(source) {
    if (this.state !== "EXERCISE" && this.state !== "TRACKING_LOST") return this;
    const r = this.results[this.index];
    const timed = !!this.holdTarget;
    r.sets.push(timed
      ? { seconds: Math.round(this.holdMs / 1000), targetSeconds: Math.round(this.holdTarget / 1000), countedBy: "timer" }
      : { reps: this.reps, targetReps: this.step.targetReps ?? null, partials: this.partials, countedBy: source ?? (this.cameraCounting && !this.manualCount ? "camera" : "manual") });
    this.manualCount = 0;
    this.holdRunning = false;
    const lastSet = this.set >= this.step.sets;
    const lastExercise = this.nextAllowedIndex() === -1;
    if (lastSet && lastExercise) {
      this.enter("COOL_DOWN", this.coolDownMs);
      this.say("Well done. Cool down: walk or march slowly and breathe easily.");
    } else {
      this.enter("REST", (this.step.restSeconds ?? 0) * 1000);
      this.say(`Rest for ${this.step.restSeconds ?? 0} seconds.`);
      if (this.phaseMs === 0) this.afterRest();
    }
    return this;
  }

  nextAllowedIndex() {
    for (let i = this.index + 1; i < this.results.length; i++) if (!this.results[i].skipped) return i;
    return -1;
  }

  afterRest() {
    if (this.set < this.step.sets) {
      this.set++;
      this.startExercise();
      return;
    }
    const next = this.nextAllowedIndex();
    if (next === -1) {
      this.enter("COOL_DOWN", this.coolDownMs);
      this.say("Well done. Cool down: walk or march slowly and breathe easily.");
      return;
    }
    this.index = next;
    this.set = 1;
    this.enter("NEXT_EXERCISE", NEXT_PREVIEW_MS);
    this.detectorEpoch++;
    this.say(`Up next: ${title(this.exercise, this.language)}.`);
  }

  /** Skip the preview, the rest or the warm-up early. */
  next() {
    if (this.state === "NEXT_EXERCISE" || this.state === "WARM_UP") this.startExercise();
    else if (this.state === "REST") this.afterRest();
    else if (this.state === "COOL_DOWN") this.toSummary("completed");
    return this;
  }

  skip(reason = "Skipped") {
    if (!["EXERCISE", "TRACKING_LOST", "NEXT_EXERCISE"].includes(this.state)) return this;
    const r = this.results[this.index];
    r.skipped = r.sets.length === 0;
    r.skipReason = reason;
    const next = this.nextAllowedIndex();
    if (next === -1) {
      this.enter("COOL_DOWN", this.coolDownMs);
      return this;
    }
    this.index = next;
    this.set = 1;
    this.enter("NEXT_EXERCISE", NEXT_PREVIEW_MS);
    this.detectorEpoch++;
    this.say(`Up next: ${title(this.exercise, this.language)}.`);
    return this;
  }

  pause() {
    if (!PAUSABLE.has(this.state)) return this;
    this.resumeTo = this.state;
    this.state = "PAUSED";
    this.holdRunning = false;
    this.invalidSince = this.validSince = null;
    this.detectorEpoch++;
    this.say("Paused.");
    return this;
  }

  resume(t) {
    if (this.state !== "PAUSED") return this;
    // Lost tracking resumes as exercise: counting restarts only once the camera sees a usable view.
    this.state = this.resumeTo === "TRACKING_LOST" ? "EXERCISE" : this.resumeTo ?? "EXERCISE";
    this.resumeTo = null;
    if (Number.isFinite(t)) this.lastTick = t;
    this.say("Resumed.");
    return this;
  }

  stop() {
    if (TERMINAL.has(this.state) || this.state === "SUMMARY") return this;
    this.endedBy = "cancelled";
    this.endedAt = new Date(this.wallClock()).toISOString();
    this.enter("CANCELLED");
    return this;
  }

  /** Report a symptom by id (one-tap list) or as free text. Rules decide; there is no override. */
  reportSymptom(input) {
    // Symptoms still count after a workout ends: guidance and the lockout apply all the same.
    if (this.state === "SAFETY_STOP") return { action: "none" };
    const known = SESSION_SYMPTOMS.some((symptom) => symptom.id === input);
    const decision = known ? { action: symptomAction(input), reasons: [input] } : checkSymptomText(input, { region: this.region });
    if (decision.action === "emergency" || decision.action === "stop_rest") this.safetyStop(decision.action, decision.reasons);
    else if (TERMINAL.has(this.state) || this.state === "SUMMARY") return decision;
    else if (decision.action === "stop_exercise") {
      this.say("Stopping this exercise. Don't push through sharp pain.", "warning");
      this.skip("Stopped for pain");
    } else if (decision.action === "end") {
      this.endedBy = "stopped_tired";
      this.enter("COOL_DOWN", this.coolDownMs);
      this.say("Let's ease off. Cool down slowly.");
    }
    return decision;
  }

  safetyStop(action, reasons, { lock = true } = {}) {
    this.safety = { action, reasons };
    this.lockout = lock ? createLockout(action, reasons, this.wallClock()) : null;
    if (!(TERMINAL.has(this.state) || this.state === "SUMMARY")) {
      this.endedBy = "safety_stop";
      this.endedAt = new Date(this.wallClock()).toISOString();
    }
    this.enter("SAFETY_STOP");
    this.say(action === "emergency" ? "Stop exercising and get urgent medical help now." : "Stop and rest.", "alert");
    return this;
  }

  toSummary(by) {
    this.endedBy ??= by;
    this.endedAt = new Date(this.wallClock()).toISOString();
    this.enter("SUMMARY");
    return this;
  }

  /** The person has seen the summary; the record is final. */
  finish() {
    if (this.state === "SUMMARY") this.enter("COMPLETED");
    return this;
  }

  summary() {
    const exercises = this.results.map((r) => ({
      exerciseId: r.exerciseId,
      title: EXERCISES[r.exerciseId].title,
      plannedSets: r.step.sets,
      setsDone: r.sets.length,
      reps: r.sets.reduce((n, s) => n + (s.reps ?? 0), 0),
      seconds: r.sets.reduce((n, s) => n + (s.seconds ?? 0), 0),
      partials: r.sets.reduce((n, s) => n + (s.partials ?? 0), 0),
      countedBy: [...new Set(r.sets.map((s) => s.countedBy))],
      skipped: r.skipped,
      skipReason: r.skipReason,
      excludedBySafetyCheck: !!r.excluded,
    }));
    const planned = this.results.filter((r) => !r.excluded).reduce((n, r) => n + r.step.sets, 0);
    const done = exercises.reduce((n, e) => n + e.setsDone, 0);
    return {
      programId: this.program.id,
      programName: this.program.name,
      authoredBy: this.program.authoredBy,
      clinicianName: this.program.clinicianName ?? null,
      catalogVersion: this.program.version,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      endedBy: this.endedBy,
      activeMinutes: Math.round(this.activeMs / 6000) / 10,
      mode: this.mode,
      exercises,
      setsDone: done,
      setsPlanned: planned,
      safety: this.safety,
      // Deliberately absent: calories, heart rate or any other value ASHA did not measure.
      note: "Counts are camera estimates or your own taps. No calories or vital signs are estimated.",
    };
  }

  serialize() {
    const live = PAUSABLE.has(this.state);
    return JSON.stringify({
      v: 1,
      program: this.program,
      mode: this.mode,
      screening: this.screening,
      language: this.language,
      region: this.region,
      state: live ? "PAUSED" : this.state,
      resumeTo: live ? (this.state === "TRACKING_LOST" ? "EXERCISE" : this.state) : this.resumeTo,
      index: this.index, set: this.set, reps: this.reps, partials: this.partials,
      phaseMs: this.phaseMs, elapsedMs: this.elapsedMs, activeMs: this.activeMs, holdMs: this.holdMs,
      framingOk: this.framingOk, detectorEpoch: this.detectorEpoch,
      startedAt: this.startedAt, endedAt: this.endedAt, endedBy: this.endedBy,
      blockReason: this.blockReason, safety: this.safety, lockout: this.lockout,
      results: this.results,
      warmUpMs: this.warmUpMs, coolDownMs: this.coolDownMs,
    });
  }

  static restore(json, { wallClock, tracked } = {}) {
    const d = typeof json === "string" ? JSON.parse(json) : json;
    if (d?.v !== 1) throw new Error("Saved session format is not supported.");
    const s = new WorkoutSession({ program: d.program, mode: d.mode, screening: d.screening, language: d.language, region: d.region, wallClock, tracked });
    for (const k of ["state", "resumeTo", "index", "set", "reps", "partials", "phaseMs", "elapsedMs", "activeMs", "holdMs", "framingOk", "detectorEpoch", "startedAt", "endedAt", "endedBy", "blockReason", "safety", "lockout", "results", "warmUpMs", "coolDownMs"])
      if (k in d) s[k] = d[k];
    if (!STATES.includes(s.state)) throw new Error("Saved session state is invalid.");
    s.lastTick = null;
    s.detectorEpoch++;
    return s;
  }
}
