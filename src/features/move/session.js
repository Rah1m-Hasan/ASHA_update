// ASHA Move session: one exercise at a time, driven by explicit states. Timers use a monotonic clock
// passed in by the caller (performance.now in the browser); across a reload only elapsed amounts are
// kept and the session comes back PAUSED, so nothing advances while nobody is watching.
//
// Every exercise is guided: LEARN (demonstration) -> CAMERA_SETUP (framing, camera mode only) ->
// PRACTICE (not counted) -> EXERCISE -> REST. Counting starts only from EXERCISE, and the next
// exercise never starts by itself unless the person turned on auto-next.

import { EXERCISES, validateProgram, title } from "./catalog.js";
import { exerciseAllowed, checkSymptomText, symptomAction, createLockout, SESSION_SYMPTOMS } from "./safety.js";

export const STATES = Object.freeze([
  "NOT_STARTED", "PRECHECK", "WARM_UP", "LEARN", "CAMERA_SETUP", "PRACTICE", "EXERCISE", "REST", "NEXT_EXERCISE", "COOL_DOWN",
  "SUMMARY", "PAUSED", "TRACKING_LOST", "SAFETY_STOP", "CANCELLED", "COMPLETED",
]);
const TERMINAL = new Set(["SAFETY_STOP", "CANCELLED", "COMPLETED"]);
const PAUSABLE = new Set(["WARM_UP", "LEARN", "CAMERA_SETUP", "PRACTICE", "EXERCISE", "REST", "COOL_DOWN", "TRACKING_LOST"]);
const TIMED = new Set(["WARM_UP", "REST", "COOL_DOWN"]);
const SKIPPABLE = new Set(["LEARN", "CAMERA_SETUP", "PRACTICE", "EXERCISE", "TRACKING_LOST"]);
/** States where the camera's view is being checked or counted. */
export const WATCHING = Object.freeze(["CAMERA_SETUP", "PRACTICE", "EXERCISE", "TRACKING_LOST"]);

export const LOST_AFTER_MS = 1000;
export const FRAMING_OK_MS = 1000;
export const PRACTICE_HOLD_MS = 2000;
export const EXTRA_REST_MS = 30000;
export const MAX_EVENTS = 500;
/** Longest gap between two camera frames that still counts as one continuous hold. */
export const HOLD_GAP_MS = 500;
/** Kept only so sessions saved by the previous version restore; nothing enters it any more. */
export const NEXT_PREVIEW_MS = 0;
export const TRACKING_LOST_MESSAGE = "Can't see your movement; reposition camera.";
export const TRACKING_LOST_MESSAGE_BN = "আপনার নড়াচড়া দেখা যাচ্ছে না; ক্যামেরা ঠিক করুন।";
const HEART_WARM_MS = 120000;

/** @typedef {{atMs:number, exerciseId:string|null, kind:"COUNT"|"HOLD"|"TRACKING_LOST"|"MANUAL"|"CUE"|"SAFETY_STOP", source:"camera"|"user"|"system", details?:Record<string, unknown>}} SessionEvent */

export class WorkoutSession {
  /**
   * @param {{program: import("./catalog.js").WorkoutProgram & {limits?: unknown}, mode?: "camera"|"manual", screening: any, language?: "en"|"bn", region?: string, wallClock?: () => number, tracked?: (id: string) => boolean, practiceTarget?: (id: string) => number, autoNext?: boolean}} options
   */
  constructor({ program, mode = "camera", screening, language = "en", region = "BD", wallClock = () => Date.now(), tracked = () => false, practiceTarget = () => 1, autoNext = false }) {
    validateProgram(program);
    this.program = program;
    this.mode = mode === "manual" ? "manual" : "camera";
    this.screening = screening ?? null;
    this.language = language === "bn" ? "bn" : "en";
    this.region = region;
    this.wallClock = wallClock;
    this.tracked = tracked;
    this.practiceTarget = practiceTarget;
    this.autoNext = !!autoNext;
    this.state = "NOT_STARTED";
    this.resumeTo = null;
    this.index = 0;
    this.set = 1;
    this.reps = 0;
    this.repsBy = { camera: 0, manual: 0 };
    this.partials = 0;
    this.practiceReps = 0;
    this.practiceHoldDone = false;
    this.phaseMs = 0;
    this.elapsedMs = 0;
    this.activeMs = 0;
    this.lastTick = null;
    this.holdRunning = false;
    this.lastHoldT = null;
    this.holdMs = 0;
    this.invalidSince = null;
    this.validSince = null;
    this.framingOk = false;
    this.restDone = false;
    this.detectorEpoch = 0;
    this.countEpoch = 0;
    this.startedAt = null;
    this.endedAt = null;
    this.endedBy = null;
    this.blockReason = "";
    /** @type {{action: string, reasons: string[]} | null} */
    this.safety = null;
    /** @type {import("./safety.js").Lockout | null} */
    this.lockout = null;
    /** @type {SessionEvent[]} */
    this.events = [];
    this.announcements = [];
    const heart = !!screening?.heartConscious;
    this.warmUpMs = Math.max(program.warmUpSeconds * 1000, heart ? HEART_WARM_MS : 0);
    this.coolDownMs = Math.max(program.coolDownSeconds * 1000, heart ? HEART_WARM_MS : 0);
    this.results = program.sequence.map((step) => {
      const allowed = exerciseAllowed(EXERCISES[step.exerciseId], screening);
      return { exerciseId: step.exerciseId, step, sets: [], skipped: !allowed.allowed, excluded: !allowed.allowed, skipReason: allowed.allowed ? "" : allowed.reason, practiced: false, track: { frames: 0, clear: 0, lost: 0 } };
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
  /** Practice repetitions wanted before counting (0 when the exercise isn't camera-tracked). */
  get practiceGoal() {
    return this.cameraCounting ? Math.max(0, this.practiceTarget(this.exercise.id) ?? 1) : 0;
  }
  /** Start counting is allowed once the camera has had a usable view for a second. */
  get canStartCounting() {
    return this.state === "PRACTICE" && this.framingOk;
  }
  /** The next exercise that will actually run, for the "Next up" preview. */
  get upNext() {
    if (this.state === "REST" && this.set < (this.step?.sets ?? 0)) return { exerciseId: this.exercise.id, set: this.set + 1 };
    const i = this.nextAllowedIndex();
    return i === -1 ? null : { exerciseId: this.results[i].exerciseId, set: 1 };
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
  /** @param {SessionEvent["kind"]} kind @param {SessionEvent["source"]} source */
  log(kind, source, details) {
    this.events.push({ atMs: Math.round(this.activeMs), exerciseId: this.exercise?.id ?? null, kind, source, ...(details ? { details } : {}) });
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
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
    if (screening.status === "emergency_stop") return this.safetyStop("emergency", screening.reasons, { lock: !screening.locked, source: "system" });
    this.blockReason = "";
    if (this.results.every((r) => r.skipped)) {
      this.blockReason = "Every exercise in this plan was left out by today's safety check. Choose another plan.";
      return this;
    }
    this.advanceToFirstAllowed();
    this.enter("WARM_UP", this.warmUpMs);
    this.say("Warm up: march gently in place or seated, roll your shoulders and breathe normally.");
    return this;
  }

  advanceToFirstAllowed() {
    while (this.index < this.results.length && this.results[this.index].skipped) this.index++;
  }

  /** Show how the current exercise is done. Nothing is measured here. */
  learn() {
    this.enter("LEARN");
    this.practiceReps = 0;
    this.practiceHoldDone = false;
    this.framingOk = false;
    this.validSince = this.invalidSince = null;
    this.detectorEpoch++;
    this.say(`Next: ${title(this.exercise, this.language)}. Watch how it's done, then tap Ready.`);
    return this;
  }

  /** LEARN -> camera framing for tracked exercises, or straight to the exercise when counting by hand. */
  ready() {
    if (this.state !== "LEARN") return this;
    if (this.cameraCounting) {
      this.enter("CAMERA_SETUP");
      this.framingOk = false;
      this.validSince = null;
      this.say("Set up your camera so ASHA can see the parts of you this exercise needs.");
    } else this.startExercise();
    return this;
  }

  /** Switch to manual counting at any point. The camera never counts again in this session. */
  useManual() {
    if (TERMINAL.has(this.state)) return this;
    this.mode = "manual";
    this.invalidSince = this.validSince = null;
    this.holdRunning = false;
    if (this.state === "CAMERA_SETUP" || this.state === "PRACTICE") this.startExercise();
    if (this.state === "TRACKING_LOST") this.state = "EXERCISE";
    if (this.state === "PAUSED") {
      if (this.resumeTo === "TRACKING_LOST") this.resumeTo = "EXERCISE";
      if (this.resumeTo === "CAMERA_SETUP" || this.resumeTo === "PRACTICE") this.resumeTo = "LEARN";
    }
    this.log("MANUAL", "user", { switchedToManual: true });
    this.say("Manual counting: tap once for each repetition you finish.");
    return this;
  }

  /** CAMERA_SETUP -> PRACTICE only after a usable view has been seen for a second. */
  confirmCamera() {
    if (this.state !== "CAMERA_SETUP" || !this.framingOk) return this;
    this.enter("PRACTICE");
    this.practiceReps = 0;
    this.practiceHoldDone = false;
    const n = this.practiceGoal;
    this.say(this.holdTarget ? "Practice: get into position and hold for a moment. This isn't counted." : `Practice: try ${n === 1 ? "one repetition" : `${n} repetitions`}. ${n === 1 ? "It isn't" : "They aren't"} counted.`);
    return this;
  }

  /** PRACTICE -> EXERCISE. Only while the camera has a usable view; practice itself is optional. */
  startCounting() {
    if (!this.canStartCounting) return this;
    this.results[this.index].practiced = this.practiceReps > 0;
    this.startExercise();
    return this;
  }

  tick(t) {
    if (!Number.isFinite(t)) return this;
    const dt = this.lastTick === null ? 0 : Math.max(0, t - this.lastTick);
    this.lastTick = t;
    if (this.state === "PAUSED" || TERMINAL.has(this.state) || this.state === "NOT_STARTED" || this.state === "PRECHECK" || this.state === "SUMMARY") return this;
    this.activeMs += dt;
    if (this.state === "EXERCISE" && this.holdTarget) {
      // Camera-timed holds advance from the camera's own frame timestamps in observe(); the
      // person's own timer (manual mode) advances here.
      if (this.holdRunning && !this.cameraCounting) {
        this.holdMs += dt;
        if (this.holdMs >= this.holdTarget) this.finishSet();
      }
      return this;
    }
    if (!TIMED.has(this.state)) return this;
    this.elapsedMs += dt;
    if (this.elapsedMs < this.phaseMs) return this;
    if (this.state === "WARM_UP") this.learn();
    else if (this.state === "REST" && !this.restDone) {
      this.restDone = true;
      if (this.autoNext) this.afterRest();
      else this.say("Rest is over. Tap Next when you're ready, or rest a little longer.");
    } else if (this.state === "COOL_DOWN") this.toSummary("completed");
    return this;
  }

  startExercise() {
    this.enter("EXERCISE");
    this.reps = 0;
    this.repsBy = { camera: 0, manual: 0 };
    this.manualCount = 0;
    this.partials = 0;
    this.holdMs = 0;
    this.holdRunning = false;
    this.lastHoldT = null;
    this.invalidSince = this.validSince = null;
    // The detector keeps what it learned (e.g. the neutral face) but restarts its repetition phase.
    this.countEpoch++;
    const s = this.step;
    const what = this.holdTarget ? `${Math.round(this.holdTarget / 1000)} seconds` : `${s.targetReps} repetitions`;
    this.say(`${title(this.exercise, this.language)}. Set ${this.set} of ${s.sets}: ${what}.`);
    return this;
  }

  framing(result, t) {
    if (result.valid && result.phase !== "lost") {
      this.validSince ??= t;
      if (t - this.validSince >= FRAMING_OK_MS) this.framingOk = true;
    } else {
      this.validSince = null;
      this.framingOk = false;
    }
  }

  /** Feed one detector result. Counts only in EXERCISE, only when the camera counts this exercise. */
  observe(result) {
    const t = result?.t;
    if (!Number.isFinite(t)) return this;
    if (this.state === "CAMERA_SETUP") return this.framing(result, t), this;
    if (this.state === "PRACTICE") {
      this.framing(result, t);
      // Practice is shown and praised, never counted.
      if (result.valid && result.counted) {
        this.practiceReps++;
        this.say(`Great, that's practice ${this.practiceReps}. It wasn't counted.${this.practiceReps >= this.practiceGoal ? " Tap Start counting when you're ready." : ""}`, "praise");
      } else if (result.valid && result.holding && (result.heldMs ?? 0) >= PRACTICE_HOLD_MS && !this.practiceHoldDone) {
        this.practiceHoldDone = true;
        this.practiceReps++;
        this.say("Great, that's the position. It wasn't timed. Tap Start counting when you're ready.", "praise");
      } else if (result.valid && !result.holding) this.practiceHoldDone = false;
      return this;
    }
    if (!this.cameraCounting || (this.state !== "EXERCISE" && this.state !== "TRACKING_LOST")) return this;
    const track = this.results[this.index].track;
    track.frames++;
    if (!result.valid) {
      this.holdRunning = false;
      this.lastHoldT = null;
      this.invalidSince ??= t;
      if (this.state === "EXERCISE" && t - this.invalidSince >= LOST_AFTER_MS) {
        this.state = "TRACKING_LOST";
        track.lost++;
        this.log("TRACKING_LOST", "system", { reason: result.reason ?? null });
        this.say(this.language === "bn" ? TRACKING_LOST_MESSAGE_BN : TRACKING_LOST_MESSAGE, "warning");
      }
      return this;
    }
    track.clear++;
    this.invalidSince = null;
    if (this.state === "TRACKING_LOST") {
      this.state = "EXERCISE";
      this.say("Tracking again. The unfinished repetition was not counted.");
    }
    if (this.holdTarget) {
      // Camera-timed hold: time runs only between consecutive frames that both saw the position.
      this.holdRunning = !!result.holding;
      if (this.holdRunning && this.lastHoldT !== null && t > this.lastHoldT && t - this.lastHoldT <= HOLD_GAP_MS) this.holdMs += t - this.lastHoldT;
      this.lastHoldT = this.holdRunning ? t : null;
      if (this.holdMs >= this.holdTarget) this.finishSet();
      return this;
    }
    if (result.event === "partial") {
      this.partials++;
      this.log("CUE", "camera", { reason: result.reason ?? "partial" });
    }
    if (result.counted) this.addRep("camera");
    return this;
  }

  addRep(source) {
    if (this.state !== "EXERCISE" || this.holdTarget) return;
    this.reps++;
    this.repsBy[source === "camera" ? "camera" : "manual"]++;
    this.lastSource = source;
    this.log(source === "camera" ? "COUNT" : "MANUAL", source === "camera" ? "camera" : "user");
    const target = this.step.targetReps ?? 0;
    this.say(String(this.reps), "count");
    if (target && this.reps >= target) this.finishSet();
  }

  /** One tap per repetition the person finished. Allowed in camera mode too, and recorded as manual. */
  manualRep() {
    this.manualCount = (this.manualCount ?? 0) + 1;
    this.addRep("manual");
    return this;
  }

  /** The person's own timer for holds and durations the camera doesn't measure. */
  startHold() {
    if (this.state === "EXERCISE" && this.holdTarget && !this.cameraCounting) this.holdRunning = true;
    return this;
  }

  /** Close the current set with what actually happened (fewer reps than planned is fine). */
  finishSet() {
    if (this.state !== "EXERCISE" && this.state !== "TRACKING_LOST") return this;
    const r = this.results[this.index];
    const timed = !!this.holdTarget;
    if (timed) {
      const by = this.cameraCounting ? "camera" : "timer";
      r.sets.push({ seconds: Math.round(this.holdMs / 1000), targetSeconds: Math.round(this.holdTarget / 1000), countedBy: by });
      this.log("HOLD", by === "camera" ? "camera" : "user", { seconds: Math.round(this.holdMs / 1000) });
    } else {
      const { camera, manual } = this.repsBy;
      const countedBy = camera && manual ? "camera and manual" : camera ? "camera" : manual ? "manual" : this.cameraCounting ? "camera" : "manual";
      r.sets.push({ reps: this.reps, targetReps: this.step.targetReps ?? null, partials: this.partials, camera, manual, countedBy });
    }
    this.manualCount = 0;
    this.holdRunning = false;
    const lastSet = this.set >= this.step.sets;
    const lastExercise = this.nextAllowedIndex() === -1;
    if (lastSet && lastExercise) {
      this.enter("COOL_DOWN", this.coolDownMs);
      this.say("Well done. Cool down: walk or march slowly and breathe easily.");
    } else {
      this.enter("REST", (this.step.restSeconds ?? 0) * 1000);
      this.restDone = false;
      if (this.phaseMs === 0) this.afterRest();
      else this.say(`Rest for ${this.step.restSeconds ?? 0} seconds.`);
    }
    return this;
  }

  nextAllowedIndex() {
    for (let i = this.index + 1; i < this.results.length; i++) if (!this.results[i].skipped) return i;
    return -1;
  }

  afterRest() {
    this.restDone = false;
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
    this.learn();
  }

  /** Rest longer. Always allowed while resting. */
  extendRest(ms = EXTRA_REST_MS) {
    if (this.state !== "REST") return this;
    this.phaseMs = Math.max(this.phaseMs, this.elapsedMs) + ms;
    this.restDone = false;
    this.say(`Resting ${Math.round(ms / 1000)} seconds longer.`);
    return this;
  }

  /** The one primary "go on" action for the current screen. */
  next() {
    if (this.state === "WARM_UP") this.learn();
    else if (this.state === "LEARN") this.ready();
    else if (this.state === "REST") this.afterRest();
    else if (this.state === "COOL_DOWN") this.toSummary("completed");
    return this;
  }

  skip(reason = "Skipped") {
    if (!SKIPPABLE.has(this.state)) return this;
    const r = this.results[this.index];
    r.skipped = r.sets.length === 0;
    r.skipReason = reason;
    this.holdRunning = false;
    const next = this.nextAllowedIndex();
    if (next === -1) {
      this.enter("COOL_DOWN", this.coolDownMs);
      return this;
    }
    this.index = next;
    this.set = 1;
    return this.learn();
  }

  pause() {
    if (!PAUSABLE.has(this.state)) return this;
    this.resumeTo = this.state;
    this.state = "PAUSED";
    this.holdRunning = false;
    this.invalidSince = this.validSince = null;
    this.framingOk = false;
    this.say("Paused.");
    return this;
  }

  resume(t) {
    if (this.state !== "PAUSED") return this;
    // Lost tracking resumes as exercise: counting restarts only once the camera sees a usable view.
    this.state = this.resumeTo === "TRACKING_LOST" ? "EXERCISE" : this.resumeTo ?? "EXERCISE";
    this.resumeTo = null;
    if (Number.isFinite(t)) this.lastTick = t;
    this.countEpoch++;
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
    if (decision.action === "emergency" || decision.action === "stop_rest") this.safetyStop(decision.action, decision.reasons, { source: "user" });
    else if (TERMINAL.has(this.state) || this.state === "SUMMARY") return decision;
    else if (decision.action === "stop_exercise") {
      this.say("Stopping this exercise. Don't push through sharp pain.", "warning");
      if (this.state === "PAUSED") this.state = this.resumeTo === "TRACKING_LOST" ? "EXERCISE" : this.resumeTo ?? "EXERCISE";
      this.skip("Stopped for pain");
    } else if (decision.action === "end") {
      this.endedBy = "stopped_tired";
      this.enter("COOL_DOWN", this.coolDownMs);
      this.say("Let's ease off. Cool down slowly.");
    }
    return decision;
  }

  safetyStop(action, reasons, { lock = true, source = "user" } = {}) {
    this.safety = { action, reasons };
    this.lockout = lock ? createLockout(action, reasons, this.wallClock()) : null;
    if (!(TERMINAL.has(this.state) || this.state === "SUMMARY")) {
      this.endedBy = "safety_stop";
      this.endedAt = new Date(this.wallClock()).toISOString();
    }
    this.holdRunning = false;
    this.log("SAFETY_STOP", source, { action });
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
    const exercises = this.results.map((r) => {
      const sum = (k) => r.sets.reduce((n, s) => n + (s[k] ?? 0), 0);
      const cameraReps = r.sets.reduce((n, s) => n + (s.camera ?? (s.countedBy === "camera" ? s.reps ?? 0 : 0)), 0);
      const manualReps = r.sets.reduce((n, s) => n + (s.manual ?? (s.countedBy === "manual" ? s.reps ?? 0 : 0)), 0);
      return {
        exerciseId: r.exerciseId,
        title: EXERCISES[r.exerciseId].title,
        plannedSets: r.step.sets,
        setsDone: r.sets.length,
        reps: sum("reps"),
        cameraReps,
        manualReps,
        seconds: sum("seconds"),
        partials: sum("partials"),
        countedBy: [...new Set(r.sets.map((s) => s.countedBy))],
        skipped: r.skipped,
        skipReason: r.skipReason,
        excludedBySafetyCheck: !!r.excluded,
        practiced: !!r.practiced,
        // Landmark visibility while counting, from the camera's own frames. Not a form score.
        quality: r.track?.frames ? { framesSeen: r.track.frames, clearViewShare: Math.round((r.track.clear / r.track.frames) * 100) / 100, trackingLost: r.track.lost } : null,
      };
    });
    const planned = this.results.filter((r) => !r.excluded).reduce((n, r) => n + r.step.sets, 0);
    const done = exercises.reduce((n, e) => n + e.setsDone, 0);
    const bySource = { camera: 0, user: 0, system: 0 };
    for (const e of this.events) bySource[e.source]++;
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
      eventsBySource: bySource,
      // Deliberately absent: calories, heart rate, form-accuracy scores or any value ASHA did not measure.
      note: "Counts are camera estimates or your own taps, shown separately. No calories, vital signs or form scores are estimated.",
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
      autoNext: this.autoNext,
      state: live ? "PAUSED" : this.state,
      resumeTo: live ? (this.state === "TRACKING_LOST" ? "EXERCISE" : this.state) : this.resumeTo,
      index: this.index, set: this.set, reps: this.reps, repsBy: this.repsBy, partials: this.partials, practiceReps: this.practiceReps,
      phaseMs: this.phaseMs, elapsedMs: this.elapsedMs, activeMs: this.activeMs, holdMs: this.holdMs, restDone: this.restDone,
      framingOk: false, detectorEpoch: this.detectorEpoch, countEpoch: this.countEpoch,
      startedAt: this.startedAt, endedAt: this.endedAt, endedBy: this.endedBy,
      blockReason: this.blockReason, safety: this.safety, lockout: this.lockout,
      results: this.results, events: this.events,
      warmUpMs: this.warmUpMs, coolDownMs: this.coolDownMs,
    });
  }

  static restore(json, { wallClock, tracked, practiceTarget } = {}) {
    const d = typeof json === "string" ? JSON.parse(json) : json;
    if (d?.v !== 1) throw new Error("Saved session format is not supported.");
    const s = new WorkoutSession({ program: d.program, mode: d.mode, screening: d.screening, language: d.language, region: d.region, wallClock, tracked, practiceTarget, autoNext: d.autoNext });
    for (const k of ["state", "resumeTo", "index", "set", "reps", "repsBy", "partials", "practiceReps", "phaseMs", "elapsedMs", "activeMs", "holdMs", "restDone", "detectorEpoch", "countEpoch", "startedAt", "endedAt", "endedBy", "blockReason", "safety", "lockout", "results", "events", "warmUpMs", "coolDownMs"])
      if (k in d && d[k] !== undefined) s[k] = d[k];
    // Sessions saved before guided lessons used a timed "up next" preview: resume at the lesson instead.
    if (s.state === "NEXT_EXERCISE") s.state = "LEARN";
    if (s.resumeTo === "NEXT_EXERCISE") s.resumeTo = "LEARN";
    if (!STATES.includes(s.state)) throw new Error("Saved session state is invalid.");
    s.repsBy ??= { camera: 0, manual: 0 };
    for (const r of s.results) r.track ??= { frames: 0, clear: 0, lost: 0 };
    s.lastTick = null;
    s.detectorEpoch++;
    return s;
  }
}
