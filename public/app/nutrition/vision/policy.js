// When to accept what the camera said, when to ask, and when to refuse.
//
// TWO SEPARATE QUESTIONS, and this file keeps them separate on purpose:
//
//   1. Do I know WHAT this is?     The identity gate, on the model's score.
//   2. Do I know HOW MUCH it is?    The portion gate, on the weight's relative uncertainty.
//
// A food can be certain and the portion unknown ("this is rice, and I have no idea how much"),
// or the portion can be known and the identity unknown ("150 g, but I cannot say what it is").
// Flattening both into one confidence number loses exactly the information the person needs to
// decide what to do.
//
// THE THRESHOLDS
//
// These are PLACEHOLDERS and they are labelled as such. The measured risk-coverage curve that
// should replace them has not been produced yet. Until it is, the policy asks more than it
// accepts, because asking costs the person one tap and accepting wrongly costs them a wrong
// number in their record.
//
// The number that makes this concrete: over 200 labelled photographs the highest-scoring WRONG
// answer was "cabbage" at a score of 0.99. A high score is not evidence of correctness. The
// score is a model score, not a probability that the person ate that food.

/**
 * The policy thresholds.
 *
 * `identityScore` is the model's class score. `maxRelativeSigma` is the relative standard
 * deviation of a weight estimate.
 */
export const RECOGNITION_POLICY = Object.freeze({
  /** Below this score the identity is not offered on its own; the person is asked. */
  identityScore: 0.35,
  /** Above this score the identity may be shown without asking first. It is still confirmed. */
  identityScoreClear: 0.75,
  /** A weight whose relative sigma is above this is too wide to offer as a number. */
  maxRelativeSigma: 0.6,
  /** Below this relative sigma a weight is narrow enough to offer as an estimate. */
  narrowRelativeSigma: 0.2,
  source:
    "PLACEHOLDER thresholds. They have NOT been fitted to a measured risk-coverage curve. They are set conservatively so the flow asks more than it accepts until the evaluation produces real numbers.",
});

/** What the policy decided to do. */
export const OUTCOMES = Object.freeze({
  ACCEPT: "accept",
  ASK: "ask",
  DECLINE: "decline",
});

/**
 * The identity gate.
 *
 * @param {{score:number|null}|null} identity
 * @returns {{outcome:string, score:number|null, reason:string}}
 */
export function identityGate(identity) {
  const score = identity?.score;
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return { outcome: OUTCOMES.ASK, score: null, reason: "no_score" };
  }
  if (score >= RECOGNITION_POLICY.identityScoreClear) {
    return { outcome: OUTCOMES.ACCEPT, score, reason: "clear" };
  }
  if (score >= RECOGNITION_POLICY.identityScore) {
    return { outcome: OUTCOMES.ASK, score, reason: "unsure" };
  }
  return { outcome: OUTCOMES.ASK, score, reason: "low" };
}

/**
 * The portion gate.
 *
 * A weight is only offered when the estimate is narrow enough AND the person has a way to check
 * it. Without a reference object in the picture there is no scale at all, so there is no weight.
 *
 * @param {{relativeSigma:number|null, method:string|null, accepted:boolean}|null} portion
 * @returns {{outcome:string, reason:string}}
 */
export function portionGate(portion) {
  if (!portion) return { outcome: OUTCOMES.ASK, reason: "no_portion" };
  if (portion.method === "weighed") return { outcome: OUTCOMES.ACCEPT, reason: "weighed" };
  if (portion.method === "household_unit") return { outcome: OUTCOMES.ACCEPT, reason: "household" };
  if (portion.method !== "visual_estimate_confirmed") {
    return { outcome: OUTCOMES.ASK, reason: "not_confirmed" };
  }
  if (!portion.accepted) return { outcome: OUTCOMES.ASK, reason: "not_accepted" };
  const sigma = portion.relativeSigma;
  if (sigma === null || sigma === undefined || !Number.isFinite(sigma)) {
    return { outcome: OUTCOMES.ASK, reason: "no_sigma" };
  }
  if (sigma > RECOGNITION_POLICY.maxRelativeSigma) {
    return { outcome: OUTCOMES.DECLINE, reason: "too_wide" };
  }
  if (sigma > RECOGNITION_POLICY.narrowRelativeSigma) {
    return { outcome: OUTCOMES.ASK, reason: "wide" };
  }
  return { outcome: OUTCOMES.ACCEPT, reason: "narrow" };
}

/**
 * The whole decision for one item.
 *
 * @param {{score:number|null, hasCatalogueFood:boolean, portion:object|null}} item
 * @returns {{outcome:string, identity:object, portion:object, missing:string[]}}
 */
export function decide(item) {
  const identity = identityGate({ score: item?.score ?? null });
  const portion = portionGate(item?.portion ?? null);
  const missing = [];
  if (identity.outcome === OUTCOMES.ASK) missing.push("identity");
  if (portion.outcome !== OUTCOMES.ACCEPT) missing.push("portion");
  if (item && !item.hasCatalogueFood) missing.push("catalogue_match");

  // The worst outcome wins. A food ASHA cannot look up is never "accepted" however confident
  // the model was, because there is nothing to calculate.
  const order = [OUTCOMES.ACCEPT, OUTCOMES.ASK, OUTCOMES.DECLINE];
  const worst = (a, b) => order[Math.max(order.indexOf(a), order.indexOf(b))];
  let outcome = worst(identity.outcome, portion.outcome);
  if (item && !item.hasCatalogueFood && outcome === OUTCOMES.ACCEPT) {
    outcome = OUTCOMES.ASK;
  }
  return { outcome, identity, portion, missing };
}
