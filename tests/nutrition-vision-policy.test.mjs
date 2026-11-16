import test from "node:test";
import assert from "node:assert/strict";

import {
  QUALITY_CODES,
  QUALITY_TEXT,
  assessImageQuality,
  coverage,
  laplacianVariance,
  meanLuma,
  qualityMessage,
  qualityMessages,
} from "../public/app/nutrition/vision/quality.js";
import {
  OUTCOMES,
  RECOGNITION_POLICY,
  decide,
  identityGate,
  portionGate,
} from "../public/app/nutrition/vision/policy.js";

/**
 * A picture of a given brightness and detail.
 *
 * @param {number} size
 * @param {number} level the grey level
 * @param {(x:number,y:number)=>number} [pattern] overrides the level per pixel
 * @returns {Uint8ClampedArray}
 */
function pixels(size, level, pattern) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = pattern ? pattern(x, y) : level;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  return data;
}

test("a bright, detailed picture passes the quality gate", () => {
  const good = pixels(400, 200, (x, y) => ((x + y) % 2 ? 180 : 60));
  const result = assessImageQuality(good, 400, 400);
  assert.equal(result.ok, true, `a usable picture must pass, but got ${result.codes.join(",")}`);
  assert.equal(result.codes.length, 0);
});

test("a dark picture is reported as too dark, with a message the person can act on", () => {
  const dark = pixels(400, 200, (x, y) => ((x + y) % 2 ? 90 : 10));
  const result = assessImageQuality(dark, 400, 400);
  assert.ok(result.codes.includes("low_light"));
  const message = qualityMessage("low_light", "en");
  assert.match(message, /light/i);
  assert.match(message, /light|আলো/i, "the message must say what to do");
});

test("a washed out picture is reported as overexposed", () => {
  const bright = pixels(400, 252);
  const result = assessImageQuality(bright, 400, 400);
  assert.ok(result.codes.includes("overexposed"));
});

test("a small picture is reported as too small", () => {
  const result = assessImageQuality(pixels(100, 120), 100, 100);
  assert.ok(result.codes.includes("low_resolution"));
});

test("a flat picture is reported as blurry even when it is bright enough", () => {
  const flat = pixels(400, 128);
  const result = assessImageQuality(flat, 400, 400);
  assert.ok(result.codes.includes("low_detail_or_blur"), "a picture with no detail is blurry");
});

test("every quality code has an English and a Bangla message", () => {
  for (const code of QUALITY_CODES) {
    assert.ok(QUALITY_TEXT[code], `${code} must have text`);
    assert.ok(QUALITY_TEXT[code].en.length > 10, `${code} needs a real English sentence`);
    assert.ok(QUALITY_TEXT[code].bn.length > 5, `${code} needs a real Bangla sentence`);
  }
});

test("an unknown quality code still produces a message rather than nothing", () => {
  const message = qualityMessage("not-a-code", "en");
  assert.ok(message.length > 0);
});

test("quality messages keep the order they were given in", () => {
  const messages = qualityMessages(["low_light", "low_resolution"], "en");
  assert.equal(messages.length, 2);
  assert.match(messages[0], /dark/i);
});

test("the brightness and detail helpers measure what they claim to", () => {
  assert.ok(meanLuma(pixels(20, 200)) > 190);
  assert.ok(meanLuma(pixels(20, 10)) < 20);
  const sharp = laplacianVariance(pixels(40, 120, (x, y) => ((x + y) % 2 ? 220 : 20)), 40, 40);
  const flat = laplacianVariance(pixels(40, 120), 40, 40);
  assert.ok(sharp > flat, "a pattern must have more detail than a flat grey");
});

test("coverage counts how much of the frame is lit", () => {
  const half = coverage(pixels(20, 200));
  assert.ok(half.litRatio > 0.9);
  const black = coverage(pixels(20, 0));
  assert.equal(black.litRatio, 0);
});

test("the identity gate asks when the score is missing", () => {
  const gate = identityGate({ score: null });
  assert.equal(gate.outcome, OUTCOMES.ASK);
  assert.equal(gate.reason, "no_score");
});

test("the identity gate asks rather than accepts a low score", () => {
  assert.equal(identityGate({ score: 0.1 }).outcome, OUTCOMES.ASK);
  assert.equal(identityGate({ score: 0.5 }).outcome, OUTCOMES.ASK);
});

test("the identity gate accepts only a clear score, and even then only as a proposal", () => {
  assert.equal(identityGate({ score: 0.95 }).outcome, OUTCOMES.ACCEPT);
});

test("the portion gate accepts a weight the person measured or declared", () => {
  assert.equal(portionGate({ method: "weighed" }).outcome, OUTCOMES.ACCEPT);
  assert.equal(portionGate({ method: "household_unit" }).outcome, OUTCOMES.ACCEPT);
});

test("the portion gate refuses an image-derived weight the person has not accepted", () => {
  const gate = portionGate({ method: "visual_estimate_confirmed", accepted: false, relativeSigma: 0.1 });
  assert.equal(gate.outcome, OUTCOMES.ASK);
  assert.equal(gate.reason, "not_accepted");
});

test("the portion gate declines a weight that is too wide to be a number", () => {
  const gate = portionGate({ method: "visual_estimate_confirmed", accepted: true, relativeSigma: 1.2 });
  assert.equal(gate.outcome, OUTCOMES.DECLINE);
  assert.equal(gate.reason, "too_wide");
});

test("the portion gate asks about a wide weight and accepts a narrow one", () => {
  assert.equal(
    portionGate({ method: "visual_estimate_confirmed", accepted: true, relativeSigma: 0.3 }).outcome,
    OUTCOMES.ASK,
  );
  assert.equal(
    portionGate({ method: "visual_estimate_confirmed", accepted: true, relativeSigma: 0.1 }).outcome,
    OUTCOMES.ACCEPT,
  );
});

test("a food ASHA cannot look up is never accepted, however confident the model was", () => {
  const decision = decide({ score: 0.99, hasCatalogueFood: false, portion: { method: "weighed" } });
  assert.notEqual(decision.outcome, OUTCOMES.ACCEPT);
  assert.ok(decision.missing.includes("catalogue_match"));
});

test("the two gates are independent: a certain food with no weight still needs asking", () => {
  const decision = decide({ score: 0.99, hasCatalogueFood: true, portion: null });
  assert.equal(decision.outcome, OUTCOMES.ASK);
  assert.ok(decision.missing.includes("portion"));
  assert.ok(!decision.missing.includes("identity"), "the identity was certain and must not be re-asked");
});

test("the thresholds say plainly that they have not been measured", () => {
  assert.match(RECOGNITION_POLICY.source, /PLACEHOLDER/);
  assert.match(RECOGNITION_POLICY.source, /NOT been fitted/i);
});
