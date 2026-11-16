/**
 * The daily provider quota.
 *
 * The quota used to be one document that two endpoints read, changed and
 * wrote back. Two requests arriving together both read the same count and
 * both wrote count+1, so the count lost one - and the gap between requests
 * was decided by the same stale value. The /api/asha handler even started
 * reading it before the request was authenticated, so the value it compared
 * against could be seconds old. A burst of a hundred requests arriving at
 * once therefore passed the quota check a hundred times, and a hundred
 * provider calls were made.
 *
 * The quota is now claimed with a slot. A request writes a file whose name
 * carries the cooldown window it falls in, and the write is a
 * create-if-not-exists, so only one request in a window can create it. The
 * number of files for the day is the number of requests the day has used.
 *
 * The write is atomic on every store the app has: the in-memory store
 * refuses to overwrite, Supabase refuses a duplicate key and Vercel Blob
 * refuses to overwrite an existing blob. That is what makes the slot a slot.
 */

import { store } from "./common.js";

/** Requests one patient may make to the provider in a day. */
export const DAILY_LIMIT = 160;
/** The shortest gap between two provider calls for one patient. */
export const COOLDOWN_MS = 1500;

/**
 * Where one day's slots live.
 *
 * They sit outside the patient's own folder so the cleanup job can drop old
 * days without listing every patient.
 */
export const usagePrefix = (patientId, date) =>
  `asha-live/usage/${date}/${patientId}/`;

/**
 * Claim one provider call for a patient.
 *
 * @param {string} patientId
 * @param {{limit?: number, cooldownMs?: number, now?: number}} [options]
 * @returns {Promise<{allowed: boolean, reason?: "daily"|"cooldown", used?: number}>}
 */
export async function claimUsage(
  patientId,
  { limit = DAILY_LIMIT, cooldownMs = COOLDOWN_MS, now = Date.now() } = {},
) {
  const date = new Date(now).toISOString().slice(0, 10);
  const prefix = usagePrefix(patientId, date);
  // Count first, so a patient who is over the limit does not write a file
  // for every attempt.
  const used = await store.list(prefix, limit + 1);
  if (used.length >= limit) return { allowed: false, reason: "daily", used: used.length };
  const slot = `${prefix}${Math.floor(now / cooldownMs)}.json`;
  try {
    await store.write(slot, { at: now }, false);
  } catch {
    // The slot for this window is already taken. Another request is inside
    // the cooldown, so this one is not.
    return { allowed: false, reason: "cooldown" };
  }
  return { allowed: true, slot, date };
}
