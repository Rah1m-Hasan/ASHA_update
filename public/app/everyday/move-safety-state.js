// Where the Everyday Move keeps the pause that follows a safety stop.
//
// The pause has to survive a reload. If it did not, closing the page and
// opening it again would let a person start exercising straight after an
// emergency stop, which is the one thing the pause exists to prevent.
//
// Only the pause and the person's own choice to remember their answers are
// stored here. Nothing about a session, a camera frame or a symptom report
// is kept: the pause is a timer, not a record.

const KEY = "asha_everyday_move_safety";

/** The answers that may be remembered. "Right now" symptoms are never one. */
const REMEMBERABLE = new Set([
  "clinician_limit",
  "heart",
  "recent_event",
  "pregnancy",
  "balance",
  "pain",
]);

function storageOf(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Storage can be blocked entirely (private mode, disabled cookies).
    return null;
  }
}

/**
 * Read the stored safety state.
 *
 * Anything unreadable is treated as no state at all: a corrupt entry must
 * never be read as a pause that has ended, and never as a pause that has not
 * started.
 *
 * @param {Storage|null} [storage]
 */
export function readSafetyState(storage) {
  const store = storageOf(storage);
  const empty = { lockout: null, answers: {}, painAreas: [], remember: false };
  if (!store) return empty;
  let parsed;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return empty;
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;
  const lockout =
    parsed.lockout &&
    typeof parsed.lockout === "object" &&
    Number.isFinite(parsed.lockout.until)
      ? parsed.lockout
      : null;
  const answers = {};
  for (const [id, value] of Object.entries(parsed.answers ?? {})) {
    if (!REMEMBERABLE.has(id)) continue;
    if (value !== "yes" && value !== "no" && value !== "unsure") continue;
    answers[id] = value;
  }
  const painAreas = Array.isArray(parsed.painAreas)
    ? parsed.painAreas.filter((id) => typeof id === "string")
    : [];
  return {
    lockout,
    answers,
    painAreas,
    remember: parsed.remember === true,
  };
}

/**
 * Write the safety state.
 *
 * @param {{lockout?: object|null, answers?: Record<string,string>, painAreas?: string[], remember?: boolean}} state
 * @param {Storage|null} [storage]
 */
export function writeSafetyState(state, storage) {
  const store = storageOf(storage);
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify(state ?? {}));
    return true;
  } catch {
    // A full or blocked store must not stop the app from running.
    return false;
  }
}

/** Forget everything stored. */
export function clearSafetyState(storage) {
  const store = storageOf(storage);
  if (!store) return false;
  try {
    store.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export const SAFETY_STATE_KEY = KEY;
