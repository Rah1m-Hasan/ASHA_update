// ASHA Move safety gate. Deterministic rules only: no model output is read here, and nothing a
// language model says can change a decision. Precautionary, not diagnostic, and pending clinical review.

// This module is shared by two surfaces: the React Move under /dashboard and
// the Everyday Move under /everyday.html. The Everyday app is a static
// browser app served from /public, so it cannot import from /src - the policy
// has to live here, next to the Everyday modules that use it. The React side
// reaches it through src/features/move/safety.js, which re-exports this file.
import { evaluateSafety, emergencyContact } from "./safety.js";

export const MOVE_SAFETY_VERSION = "move-safety/1.0.0";
/** After an emergency stop, Move stays locked this long unless a clinician assessment is recorded. */
export const EMERGENCY_LOCK_MS = 12 * 60 * 60 * 1000;
/** Nobody can dismiss an emergency and restart straight away, even with an attestation. */
export const MIN_ATTEST_MS = 30 * 60 * 1000;
/** After stopping for dizziness or palpitations, wait before another session. */
export const REST_LOCK_MS = 15 * 60 * 1000;
/** A recorded clinician clearance is reviewed again after a year. */
export const CLEARANCE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/** Pre-session screen. "unsure" is treated as the cautious answer. */
export const SCREEN_QUESTIONS = Object.freeze([
  {
    id: "emergency_now",
    en: "Right now, do you have chest pain or pressure, severe breathlessness, faintness, sudden weakness or numbness on one side, slurred speech, or a sudden severe headache?",
    bn: "এখন কি বুকে ব্যথা বা চাপ, তীব্র শ্বাসকষ্ট, অজ্ঞান লাগা, হঠাৎ শরীরের এক পাশ দুর্বল বা অবশ, কথা জড়িয়ে যাওয়া বা হঠাৎ তীব্র মাথাব্যথা আছে?",
  },
  {
    id: "clinician_limit",
    en: "Has a doctor or clinician told you to avoid or limit exercise?",
    bn: "কোনো চিকিৎসক কি আপনাকে ব্যায়াম এড়াতে বা কমাতে বলেছেন?",
  },
  {
    id: "heart",
    en: "Do you have a known heart condition, such as a past heart attack, heart failure or a heart rhythm problem?",
    bn: "আপনার কি জানা হৃদরোগ আছে, যেমন আগে হার্ট অ্যাটাক, হার্ট ফেইলিউর বা হৃদস্পন্দনের সমস্যা?",
  },
  {
    id: "recent_event",
    en: "In the last 6 weeks, have you had surgery, a fall, a new injury or a hospital stay?",
    bn: "গত ৬ সপ্তাহে কি অস্ত্রোপচার, পড়ে যাওয়া, নতুন আঘাত বা হাসপাতালে ভর্তি হয়েছিলেন?",
  },
  {
    id: "pregnancy",
    en: "Are you pregnant, or did you give birth in the last 3 months?",
    bn: "আপনি কি গর্ভবতী, বা গত ৩ মাসে সন্তান জন্ম দিয়েছেন?",
  },
  {
    id: "balance",
    en: "Do you often feel dizzy, lose your balance or fall?",
    bn: "আপনার কি প্রায়ই মাথা ঘোরে, ভারসাম্য হারান বা পড়ে যান?",
  },
  {
    id: "pain",
    en: "Do you have pain today in a joint or area you plan to move?",
    bn: "আজ যে অংশ নাড়াবেন সেখানে কি ব্যথা আছে?",
  },
]);

/** Areas for a "yes" to pain. Each maps to catalog screeningFlags to leave out. */
export const PAIN_AREAS = Object.freeze([
  { id: "knee", en: "Knee or hip", bn: "হাঁটু বা নিতম্ব", flags: ["knee_injury"] },
  { id: "shoulder", en: "Shoulder, arm or wrist", bn: "কাঁধ, হাত বা কবজি", flags: ["shoulder_injury"] },
  { id: "back", en: "Back", bn: "পিঠ", flags: ["back_injury"] },
  { id: "jaw", en: "Jaw or face", bn: "চোয়াল বা মুখ", flags: ["tmj", "facial_neuro"] },
]);

const REVIEW_REASONS = {
  clinician_limit: "A clinician has told you to avoid or limit exercise.",
  heart: "You have a known heart condition. Many people with heart conditions can exercise safely with a plan from their clinician.",
  recent_event: "You recently had surgery, a fall, an injury or a hospital stay.",
  pregnancy: "Pregnancy and the months after birth need a clinician's advice on exercise.",
};

/**
 * Screen before a session.
 * @param {Record<string,"yes"|"no"|"unsure">} answers
 * @param {{painAreas?:string[], clearance?:object|null, lockout?:object|null, now?:number}} context
 */
export function screen(answers = {}, { painAreas = [], clearance = null, lockout = null, now = Date.now() } = {}) {
  const yes = (id) => answers[id] === "yes" || answers[id] === "unsure";
  const result = { version: MOVE_SAFETY_VERSION, status: "clear_for_general_wellness", reasons: [], excludeFlags: [], supportNeeded: false, heartConscious: false, needsClearance: false, clearanceValid: false };
  if (lockoutActive(lockout, now)) {
    result.status = lockout.kind === "emergency" ? "emergency_stop" : "paused";
    result.locked = true;
    result.reasons.push(lockout.kind === "emergency" ? "Move is paused after an emergency stop." : "Move is paused so you can rest after stopping.");
    return result;
  }
  const unanswered = SCREEN_QUESTIONS.filter((q) => !(q.id in answers));
  if (unanswered.length) {
    result.status = "review_required";
    result.reasons.push("Answer every safety question before starting.");
    return result;
  }
  if (yes("emergency_now")) {
    result.status = "emergency_stop";
    result.reasons.push(answers.emergency_now === "unsure" ? "Unsure warning symptoms need urgent assessment." : "Warning symptoms need urgent medical help, not exercise.");
    return result;
  }
  const review = Object.keys(REVIEW_REASONS).filter(yes);
  result.heartConscious = yes("heart");
  result.clearanceValid = clearanceValid(clearance, now);
  if (review.length) {
    result.reasons.push(...review.map((id) => REVIEW_REASONS[id]));
    result.needsClearance = true;
    if (!result.clearanceValid) result.status = "review_required";
  }
  if (yes("balance")) {
    result.supportNeeded = true;
    result.excludeFlags.push("balance_unsupported");
    result.reasons.push("Balance concerns: use seated or supported exercises and have someone nearby.");
  }
  if (yes("pain")) {
    const areas = PAIN_AREAS.filter((a) => painAreas.includes(a.id));
    if (!areas.length) {
      result.status = "review_required";
      result.reasons.push("Tell us where it hurts so painful movements can be left out.");
    } else {
      for (const a of areas) result.excludeFlags.push(...a.flags);
      result.reasons.push(`Movements that load the painful area (${areas.map((a) => a.en.toLowerCase()).join(", ")}) are left out today.`);
    }
  }
  result.excludeFlags = [...new Set(result.excludeFlags)];
  return result;
}

/** Exercises that free-standing balance makes risky when the person reported balance problems. */
const UNSUPPORTED_BALANCE = new Set(["squat", "lunge"]);

/** Is this exercise allowed after screening? Returns a reason when not. */
export function exerciseAllowed(exercise, screening) {
  if (!screening || screening.status === "emergency_stop" || screening.status === "paused") return { allowed: false, reason: "Move is paused for safety." };
  if (screening.excludeFlags.includes("balance_unsupported") && UNSUPPORTED_BALANCE.has(exercise.id)) return { allowed: false, reason: "Left out because of balance concerns. Try a supported version." };
  const hit = exercise.screeningFlags.find((f) => screening.excludeFlags.includes(f));
  if (hit) return { allowed: false, reason: "Left out today because of pain in that area." };
  return { allowed: true, reason: "" };
}

/** A clearance the person records from their clinician. ASHA cannot verify it; it is labelled as self-reported. */
export function recordClearance({ clinicianName, date, scope = "general", limits = "" } = {}, now = Date.now()) {
  const name = String(clinicianName ?? "").trim();
  const when = Date.parse(date);
  if (!name) throw new Error("Enter the clinician's name.");
  if (!Number.isFinite(when)) throw new Error("Enter the date your clinician cleared you.");
  if (when > now + 24 * 3600 * 1000) throw new Error("The clearance date can't be in the future.");
  if (now - when > CLEARANCE_MAX_AGE_MS) throw new Error("That clearance is over a year old. Please check with your clinician again.");
  return { clinicianName: name.slice(0, 120), date: new Date(when).toISOString(), scope: scope === "plan" ? "plan" : "general", limits: String(limits).slice(0, 500), recordedAt: new Date(now).toISOString(), source: "self_reported" };
}

export function clearanceValid(clearance, now = Date.now()) {
  if (!clearance?.clinicianName || !Number.isFinite(Date.parse(clearance.date))) return false;
  return now - Date.parse(clearance.date) <= CLEARANCE_MAX_AGE_MS;
}

/** Symptoms the person can report from the live session with one tap. */
export const SESSION_SYMPTOMS = Object.freeze([
  { id: "chest", en: "Chest pain or pressure", bn: "বুকে ব্যথা বা চাপ", action: "emergency" },
  { id: "breath", en: "Can't catch my breath", bn: "শ্বাস নিতে পারছি না", action: "emergency" },
  { id: "faint", en: "Faint or about to pass out", bn: "অজ্ঞান লাগছে", action: "emergency" },
  { id: "one_side", en: "Weakness, numbness or drooping on one side, or trouble speaking", bn: "এক পাশ দুর্বল, অবশ বা বাঁকা, বা কথা বলতে কষ্ট", action: "emergency" },
  { id: "palpitations", en: "Racing or irregular heartbeat", bn: "বুক ধড়ফড় বা অনিয়মিত হৃদস্পন্দন", action: "stop_rest" },
  { id: "dizzy", en: "Dizzy or light-headed", bn: "মাথা ঘুরছে", action: "stop_rest" },
  { id: "sharp_pain", en: "Sharp or worsening pain", bn: "তীক্ষ্ণ বা বাড়তে থাকা ব্যথা", action: "stop_exercise" },
  { id: "tired", en: "Too tired to continue", bn: "আর পারছি না, ক্লান্ত", action: "end" },
]);

const NEURO = /\b(?:face\s*(?:is\s*)?droop\w*|droop\w*\s*(?:face|mouth|eyelid)|slurr\w*\s*(?:speech|words)|(?:can['’]?t|cannot|trouble|difficulty)\s*(?:speak\w*|talk\w*)|(?:weak\w*|numb\w*)\s*(?:on\s*)?(?:one|left|right)\s*side|(?:one|left|right)\s*side\s*(?:of\s*my\s*(?:body|face))?\s*(?:is\s*)?(?:weak|numb)\w*|(?:sudden|worst)\s*(?:severe\s*)?headache|sudden\s*(?:vision|sight)\s*loss|arm\s*(?:went|is|feels)\s*(?:weak|numb|dead))\b|মুখ\s*(?:বেঁকে|বাঁকা|ঝুলে)|এক\s*পাশ\s*(?:অবশ|দুর্বল)|হাত\s*(?:অবশ|দুর্বল)|কথা\s*(?:জড়িয়ে|জড়িয়ে|বলতে\s*পারছি\s*না)|হঠাৎ\s*(?:তীব্র\s*)?মাথা\s*ব্যথা|\bmukh\s*(?:beke|baka)\b|\bkotha\s*(?:joriye|jorie)\b/giu;
const PALPITATIONS = /\b(?:palpitation\w*|heart\s*(?:is\s*)?(?:racing|pounding|fluttering|skipping)|irregular\s*heart\w*)\b|বুক\s*ধড়ফড়|বুক\s*ধড়ফড়|\bbuk\s*dhorfor\b/giu;
const DIZZY = /\b(?:dizz\w*|light[-\s]?headed\w*|room\s*(?:is\s*)?spinning|vertigo)\b|মাথা\s*(?:ঘোরা|ঘুরছে|ঘোরাচ্ছে|ঝিমঝিম)|\bmatha\s*ghur\w*\b/giu;
const PAIN = /\b(?:sharp|stabbing|shooting|severe|worsening|bad)\s*pain\b|\bpain\s*(?:is\s*)?(?:getting\s*worse|worse)\b|\b(?:knee|back|shoulder|hip|wrist|neck|jaw)\s*(?:pain|hurts?)\b|\bjaw\s*(?:click\w*|lock\w*)\b|তীব্র\s*ব্যথা|(?:হাঁটু|হাঁটু|পিঠ|কাঁধ|কোমর|ঘাড়|ঘাড়|চোয়াল|চোয়াল)\s*(?:ে|য়|য়)?\s*ব্যথা/giu;
const DENIAL_BEFORE = /(?:\b(?:no|not|without|never|don['’]?t\s*have|didn['’]?t\s*have)\b(?:\s+\w+){0,3})\s*$/iu;
const DENIAL_AFTER = /^\s*(?:নেই|নাই|না\b|nai\b|nei\b|is\s*absent)/iu;

function affirmed(text, pattern) {
  for (const clause of text.split(/[.!?;\n]|\bbut\b|কিন্তু|তবে/iu))
    for (const m of clause.matchAll(pattern)) {
      const before = clause.slice(Math.max(0, m.index - 40), m.index);
      const after = clause.slice(m.index + m[0].length, m.index + m[0].length + 12);
      if (DENIAL_BEFORE.test(before) || DENIAL_AFTER.test(after)) continue;
      return true;
    }
  return false;
}

/**
 * Classify a typed or spoken symptom during Move. Extra fields (for example a model's opinion)
 * are deliberately ignored: only these rules decide.
 * @returns {{action:"emergency"|"stop_rest"|"stop_exercise"|"continue", reasons:string[], version:string}}
 */
export function checkSymptomText(input, { region = "BD" } = {}) {
  const text = String(input ?? "").normalize("NFKC").toLowerCase().replace(/[​-‍﻿]/g, "").slice(0, 4000);
  const base = evaluateSafety(text, { region });
  const reasons = [...base.reasons];
  if (affirmed(text, NEURO)) reasons.push("Possible stroke warning signs.");
  if (reasons.length) return { action: "emergency", reasons, version: MOVE_SAFETY_VERSION };
  if (affirmed(text, PALPITATIONS)) return { action: "stop_rest", reasons: ["Racing or irregular heartbeat."], version: MOVE_SAFETY_VERSION };
  if (affirmed(text, DIZZY)) return { action: "stop_rest", reasons: ["Dizziness or light-headedness."], version: MOVE_SAFETY_VERSION };
  if (affirmed(text, PAIN)) return { action: "stop_exercise", reasons: ["Sharp or worsening pain."], version: MOVE_SAFETY_VERSION };
  return { action: "continue", reasons: [], version: MOVE_SAFETY_VERSION };
}

export function symptomAction(symptomId) {
  return SESSION_SYMPTOMS.find((s) => s.id === symptomId)?.action ?? "stop_rest";
}

/**
 * @typedef {{kind:"emergency"|"rest", since:number, until:number, reasons:string[], cleared?:boolean, audit:Record<string, unknown>[]}} Lockout
 */

/**
 * Create the lockout that follows a safety stop.
 * @returns {Lockout | null}
 */
export function createLockout(action, reasons, now = Date.now()) {
  if (action === "emergency") return { kind: "emergency", since: now, until: now + EMERGENCY_LOCK_MS, reasons, audit: [{ at: new Date(now).toISOString(), event: "emergency_stop", reasons }] };
  if (action === "stop_rest") return { kind: "rest", since: now, until: now + REST_LOCK_MS, reasons, audit: [{ at: new Date(now).toISOString(), event: "rest_stop", reasons }] };
  return null;
}

export function lockoutActive(lockout, now = Date.now()) {
  return !!lockout && !lockout.cleared && now < lockout.until;
}

/** Earliest time an attestation can lift an emergency lockout. */
export const attestAvailableAt = (lockout) => (lockout ? lockout.since + MIN_ATTEST_MS : 0);

/**
 * Lift an emergency lockout early, only with a named clinician assessment, and keep the record.
 * @param {Lockout | null} lockout
 * @param {{clinicianName?: string, confirmed?: boolean}} attestation
 * @returns {Lockout | null}
 */
export function attestAssessment(lockout, { clinicianName, confirmed }, now = Date.now()) {
  if (!lockoutActive(lockout, now)) return lockout;
  if (lockout.kind !== "emergency") throw new Error("This pause ends on its own shortly.");
  if (now < attestAvailableAt(lockout)) throw new Error("Please get medical help first. This can't be dismissed straight away.");
  const name = String(clinicianName ?? "").trim();
  if (!confirmed || !name) throw new Error("Confirm that a clinician assessed you and enter their name.");
  return { ...lockout, cleared: true, audit: [...lockout.audit, { at: new Date(now).toISOString(), event: "assessment_attested", clinicianName: name.slice(0, 120) }] };
}

/** Urgent guidance. Bangla and English. Never suggests a self-test. */
export function urgentGuidance(language = "en", region = "BD", reasons = []) {
  const contact = emergencyContact(region);
  const neuro = reasons.some((r) => /stroke/i.test(r));
  if (language === "bn")
    return [
      "ব্যায়াম বন্ধ করুন।",
      `এখনই জরুরি চিকিৎসা সহায়তা নিন। ${contact ? contact + " নম্বরে কল করুন।" : "স্থানীয় জরুরি নম্বরে কল করুন।"}`,
      neuro ? "লক্ষণ কখন শুরু হয়েছে সময়টি মনে রাখুন।" : "আরামদায়ক অবস্থায় বসুন বা শুয়ে থাকুন।",
      "নিজে গাড়ি চালাবেন না। পারলে কাউকে কাছে থাকতে বলুন।",
      "লক্ষণ পরীক্ষা করতে কোনো ব্যায়াম বা অ্যাপ টেস্ট করবেন না।",
    ];
  return [
    "Stop exercising.",
    `Get urgent medical help now. ${contact ? `Call ${contact}.` : "Call your local emergency number."}`,
    neuro ? "Note the time the symptoms started." : "Sit or lie down in a comfortable position.",
    "Don't drive yourself. Ask someone to stay with you if you can.",
    "Don't try an exercise or app test to check these symptoms.",
  ];
}

/**
 * Whether a session may start, given the screen result and what the person
 * has chosen.
 *
 * The rules are the ones the React Move already applies:
 *
 * - warning symptoms stop the session, whatever else was chosen;
 * - a pause after a safety stop is honoured until it ends on its own;
 * - a screen that has not been answered cannot be started;
 * - a screen that needs a clinician is answered by a clinician's own plan -
 *   ASHA never gives medical clearance itself.
 *
 * @param {ReturnType<typeof screen>|null} screening
 * @param {{clinicianPlan?: boolean, answers?: Record<string,"yes"|"no"|"unsure">, painAreas?: string[]}} context
 */
export function startDecision(
  screening,
  { clinicianPlan = false, answers = {}, painAreas = [] } = {},
) {
  const reasons = (screening?.reasons ?? []).join(" ");
  if (!screening)
    return {
      allowed: false,
      kind: "incomplete",
      reason: "Complete the safety check first.",
    };
  if (screening.status === "emergency_stop")
    return { allowed: false, kind: "emergency", reason: reasons };
  if (screening.status === "paused")
    return { allowed: false, kind: "paused", reason: reasons };
  // "Right now" symptoms are asked every time, so an unanswered question here
  // is a question the person has not been shown yet.
  const unanswered = SCREEN_QUESTIONS.filter((q) => !(q.id in answers));
  const painUnanswered =
    (answers.pain === "yes" || answers.pain === "unsure") &&
    !painAreas.length;
  if (unanswered.length || painUnanswered)
    return {
      allowed: false,
      kind: "answers",
      reason:
        reasons || "Answer every safety question before starting.",
    };
  if (screening.status === "review_required") {
    // A clinician's own plan is the clinician's assessment. ASHA cannot give
    // medical clearance itself.
    if (screening.needsClearance && clinicianPlan)
      return { allowed: true, kind: "clinician_plan", reason: reasons };
    return { allowed: false, kind: "review", reason: reasons };
  }
  return { allowed: true, kind: "clear", reason: reasons };
}

export function restGuidance(language = "en", region = "BD") {
  const contact = emergencyContact(region);
  return language === "bn"
    ? ["ব্যায়াম বন্ধ করে বসুন বা শুয়ে পড়ুন।", "পানি খান এবং কয়েক মিনিট বিশ্রাম নিন।", `কয়েক মিনিটে না কমলে, বা বুকে ব্যথা, শ্বাসকষ্ট বা অজ্ঞান লাগলে এখনই জরুরি সহায়তা নিন${contact ? ` (${contact})` : ""}।`]
    : ["Stop and sit or lie down.", "Sip water and rest for a few minutes.", `If it doesn't settle within a few minutes, or you get chest pain, breathlessness or faintness, get urgent help now${contact ? ` (call ${contact})` : ""}.`];
}
