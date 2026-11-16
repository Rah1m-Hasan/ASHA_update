/**
 * What a reply may not assert.
 *
 * Two independent checks, so that neither one alone has to be perfect.
 *
 * The first is structural. The provider is asked to name every claim it
 * asserts, and a claim the app cannot back - a physiological reading, a
 * named condition, a medicine or dose, an action that has already happened
 * - makes the whole reply unusable. The check is on the structure of the
 * answer, not on the words in it, because the app's own knowledge base
 * contains correct negative statements ("it cannot measure blood
 * pressure") that a word list would refuse.
 *
 * The second is the pattern list the /api/care path has always used. It
 * catches the action claims that slip through when a model does not fill in
 * the structure. It lives here so the two paths cannot drift apart again.
 *
 * The pattern list is the only thing standing between a model that omits
 * the claims structure and the patient, so it has to cover the whole claim
 * family, not just its most obvious member. "I have called your caregiver"
 * is easy; "your caregiver has been contacted", "someone has let your
 * caregiver know", "I informed your caregiver" and "your request has been
 * sent" assert the same completed action in other grammars, and each of
 * them used to pass.
 */

/** The claim kinds the app can never back. */
export const FORBIDDEN_CLAIM_TYPES = new Set([
  "vital_value",
  "diagnosis",
  "medication",
  "completed_action",
]);

/**
 * Who a reply must never claim to have reached.
 *
 * The app can send a request to an assigned caregiver, but only after the
 * patient confirms it, and only the server knows that it arrived. No
 * provider reply may assert that any of these people or services were
 * reached.
 */
const RECIPIENT =
  "caregiver|carer|care\\s+worker|nurse|doctor|clinician|physician|" +
  "therapist|family|relative|friend|helper|support\\s+team|care\\s+team|team|" +
  "staff|clinic|emergency\\s+(?:service|team|call)|emergency|ambulance|" +
  "paramedic|police|hospital";

/**
 * Past-participle forms of "reach someone". The bare form ("contact") is
 * deliberately absent: a present-tense sentence ("your caregiver is
 * contacted when you confirm") describes how the app works and is not a
 * claim that anything happened.
 */
const REACHED_PARTICIPLE =
  "contacted|called|notified|informed|told|alerted|messaged|emailed|texted|" +
  "reached|invited|dispatched|escalated|warned|asked|sent";

/**
 * A gap that cannot cross a sentence boundary and cannot swallow a
 * negation.
 *
 * The negation guard is a tempered token: at every position the gap is
 * about to consume, it checks that a negation word does not start there.
 * That is what keeps "I have not contacted your caregiver" from reading as
 * "I have contacted your caregiver" - the gap stops dead at the "not".
 */
const NEGATION =
  "not|never|neither|nor|nobody|no\\s+one|without|cannot|can't|won't|don't|doesn't|didn't|isn't|aren't|hasn't|haven't|hadn't";
const gap = (max) =>
  `(?:(?!\\b(?:${NEGATION})\\b)[^.!?\\n]){0,${max}}?`;

/**
 * Action claims: "I have called your caregiver", "we ruled out an
 * emergency", "take 500 mg aspirin". These are assertions that something
 * happened or should be done, not descriptions of how the app works.
 *
 * The Bangla endings use a letter lookahead rather than `\b`: `\b` is an
 * ASCII word boundary, and Bangla letters are not word characters, so a
 * trailing `\b` after a Bangla word never matched and the Bangla safety
 * claims were silently never caught.
 */
export const UNSAFE_REPLY_PATTERN =
  /\b(?:ruled?\s*out|definitely\s*not|not\s*a)\s*(?:an?\s*)?(?:heart\s*attack|emergency)|\byou\s*(?:are|'re)\s*(?:safe|fine)\b|\b(?:i|we)\s*(?:have\s*)?(?:called|contacted|notified|diagnosed|prescribed)\b|\b(?:raise|lift)\s*(?:your|the)\s*arms?\b|\b(?:take|start|increase|stop)\s*(?:\d+\s*(?:mg|tablets?)|aspirin|insulin|antibiotic)|হার্ট\s*অ্যাটাক\s*(?:নয়|হয়নি)|আপনি\s*(?:নিরাপদ|সুস্থ)(?!\p{L})|হাত\s*(?:তুলুন|ওঠান)/iu;

/**
 * The completed-contact claims, split by grammar so that each one can be
 * read and tested on its own.
 */
export const UNSAFE_REPLY_PATTERNS = [
  // The recipient did the receiving: "your caregiver has been contacted",
  // "the caregiver was notified", "the emergency service has been alerted".
  new RegExp(
    `\\b(?:${RECIPIENT})\\b${gap(20)}(?:has|have|had|was|were)\\s+(?:already\\s+|just\\s+|also\\s+)?(?:been\\s+)?(?:${REACHED_PARTICIPLE})\\b`,
    "iu",
  ),
  // The speaker did the reaching: "I have asked your caregiver to come",
  // "I informed your caregiver", "we have messaged your caregiver".
  new RegExp(
    `\\b(?:i|we)\\b${gap(40)}(?:have|has|had)?\\s*(?:${REACHED_PARTICIPLE})\\b${gap(40)}\\b(?:${RECIPIENT})\\b`,
    "iu",
  ),
  // The request itself went out: "your request has been sent".
  new RegExp(
    `\\b(?:requests?|messages?|alerts?|notifications?|needs?)\\b${gap(20)}(?:has|have|had|was|were)\\s+(?:already\\s+|just\\s+|also\\s+)?(?:been\\s+)?(?:sent|delivered|forwarded|transmitted|relayed|shared)\\b`,
    "iu",
  ),
  // The request reached the recipient: "the request went through to your
  // caregiver", "your message reached the nurse".
  new RegExp(
    `\\b(?:requests?|messages?|alerts?|notifications?|needs?)\\b${gap(20)}(?:has|have|had|was|were)?\\s*(?:been\\s+)?(?:went\\s+through|got\\s+through|reached|arrived|delivered|landed|got|went)\\s+(?:to|at|with)?\\s*${gap(20)}\\b(?:${RECIPIENT})\\b`,
    "iu",
  ),
  // The recipient is already on the way: "your caregiver is on the way".
  new RegExp(
    `\\b(?:${RECIPIENT})\\b${gap(20)}(?:is|are|has\\s+been|have\\s+been)\\s+(?:on\\s+(?:the|its|their|his|her)\\s+way|coming|en\\s+route)\\b`,
    "iu",
  ),
  // Somebody let the recipient know: "someone has let your caregiver know".
  new RegExp(
    `\\b(?:someone|somebody|anyone|some\\s+one|the\\s+system|the\\s+team|we|i|asha)\\b${gap(30)}(?:has|have|had)\\s+let\\s+(?:your\\s+|the\\s+|a\\s+)?(?:${RECIPIENT})\\b${gap(20)}\\bknow\\b`,
    "iu",
  ),
  // Bangla: "আপনার কেয়ারগিভারকে জানানো হয়েছে", "আমি কেয়ারগিভারকে ডেকেছি".
  new RegExp(
    `(?:কেয়ারগিভার|কেয়ারগিভারকে|ডাক্তার|ডাক্তারকে|নার্স|নার্সকে|জরুরি\\s+সেবা|পরিবার|পরিবারের|ক্লিনিক)[^।!?\\n]{0,30}?(?:জানানো হয়েছে|জানানো হয়েছেন|ডাকা হয়েছে|বলা হয়েছে|পাঠানো হয়েছে|খবর দেওয়া হয়েছে|জানিয়েছি|ডেকেছি|বলেছি|পাঠিয়েছি|ডেকেছে|জানিয়েছে|বলেছে|পাঠিয়েছে)`,
    "u",
  ),
  // Bangla, verb first: "জানিয়েছি আপনার কেয়ারগিভারকে".
  new RegExp(
    `(?:জানিয়েছি|ডেকেছি|বলেছি|পাঠিয়েছি|জানানো হয়েছে|ডাকা হয়েছে|বলা হয়েছে|পাঠানো হয়েছে)[^।!?\\n]{0,30}?(?:কেয়ারগিভার|কেয়ারগিভারকে|ডাক্তার|ডাক্তারকে|নার্স|নার্সকে|জরুরি\\s+সেবা|পরিবার)`,
    "u",
  ),
  // Bangla, the request went out: "আপনার অনুরোধ পাঠানো হয়েছে".
  new RegExp(
    `(?:অনুরোধ|বার্তা|আবেদন)[^।!?\\n]{0,20}?পাঠানো হয়েছে`,
    "u",
  ),
];

/** Whether a reply's text is free of the action claims above. */
export function replyIsSafe(reply) {
  if (typeof reply !== "string" || !reply.trim()) return false;
  if (UNSAFE_REPLY_PATTERN.test(reply)) return false;
  return !UNSAFE_REPLY_PATTERNS.some((pattern) => pattern.test(reply));
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
 * claims and it asserts nothing the app can back.
 */
export function replyIsAllowed(reply, claims) {
  return replyIsSafe(reply) && claimsAreSafe(claims);
}
