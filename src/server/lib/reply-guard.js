/**
 * What a reply may not assert.
 *
 * Two independent checks, so that neither one alone has to be perfect.
 *
 * The first is structural. The provider is asked to name every claim it
 * asserts, and a claim the app cannot support - a physiological reading, a
 * named condition, a medicine or dose, an action that has already happened
 * - makes the whole reply unusable. The check is on the structure of the
 * answer, not on the words in it, because the app's own knowledge base
 * contains correct negative statements ("it cannot measure blood
 * pressure") that a word list would refuse.
 *
 * The second is the pattern list the /api/care path has always used. It
 * catches the action claims that slip through when a model does not fill in
 * the structure. It lives here so the two paths cannot drift apart again.
 */

/** The claim kinds the app can never back. */
export const FORBIDDEN_CLAIM_TYPES = new Set([
  "vital_value",
  "diagnosis",
  "medication",
  "completed_action",
]);

/**
 * Action claims: "I have called your caregiver", "we ruled out an
 * emergency", "take 500 mg aspirin". These are assertions that something
 * happened or should be done, not descriptions of how the app works.
 */
export const UNSAFE_REPLY_PATTERN =
  /\b(?:ruled?\s*out|definitely\s*not|not\s*a)\s*(?:a\s*)?(?:heart\s*attack|emergency)|\byou\s*(?:are|'re)\s*(?:safe|fine)\b|\b(?:i|we)\s*(?:have\s*)?(?:called|contacted|notified|diagnosed|prescribed)\b|\b(?:raise|lift)\s*(?:your|the)\s*arms?\b|\b(?:take|start|increase|stop)\s*(?:\d+\s*(?:mg|tablets?)|aspirin|insulin|antibiotic)|হার্ট\s*অ্যাটাক\s*(?:নয়|নয়|হয়নি|হয়নি)|আপনি\s*(?:নিরাপদ|সুস্থ)\b|হাত\s*(?:তুলুন|ওঠান)/iu;

/** Whether a reply's text is free of the action claims above. */
export function replyIsSafe(reply) {
  if (typeof reply !== "string" || !reply.trim()) return false;
  return !UNSAFE_REPLY_PATTERN.test(reply);
}

/**
 * Whether the claims the provider named are all ones the app can back.
 *
 * A missing list means the model did not use the structure at all, which is
 * not itself a refusal: the pattern check still applies. A list with an
 * entry the app cannot back, or an entry that says nothing about what kind
 * of claim it is, refuses the reply - the model was asked to be specific
 * and was not.
 */
export function claimsAreSafe(claims) {
  if (claims === undefined || claims === null) return true;
  if (!Array.isArray(claims)) return false;
  return claims.every((claim) => {
    const type = typeof claim === "string" ? claim : claim?.type;
    if (typeof type !== "string" || !type.trim()) return false;
    return !FORBIDDEN_CLAIM_TYPES.has(type.trim().toLowerCase());
  });
}

/**
 * Whether a reply may be shown to the patient: its text is free of action
 * claims and it asserts nothing the app cannot back.
 */
export function replyIsAllowed(reply, claims) {
  return replyIsSafe(reply) && claimsAreSafe(claims);
}
