import test from "node:test";
import assert from "node:assert/strict";

import { validateRecognition, RECOGNITION_STATUSES, MISSING_INFO_TEXT } from "../public/app/nutrition/vision/contract.js";
import { candidatesFor, CLASS_TO_FOOD, unmappedClasses } from "../public/app/nutrition/vision/map.js";
import { RECORDS, RECIPES } from "../public/app/nutrition/catalogue/index.js";

/** The catalogue as the validator wants it. */
const CATALOGUE = {
  records: Object.fromEntries([...Array(46)].map((_, i) => [`f${i}`, { id: `f${i}` }])),
  dishes: Object.fromEntries(["rice-cooked", "dal", "khichuri", "polao", "chicken-curry", "beef-bhuna", "mutton-curry", "fish-curry", "bd-chicken-biryani", "mixed-vegetables", "alu-bhorta", "carp-cooked", "tilapia-cooked", "beef-roasted", "mutton-roasted", "kidney-beans-boiled", "chickpeas-boiled", "strawberries-frozen-plain"].map((id) => [id, { id }])),
};

const goodItem = {
  food_id: "rice-cooked",
  display_name: "Rice",
  display_name_bn: "ভাত",
  alternatives: ["khichuri", "polao"],
  identification_confidence: 0.72,
  portion: {
    estimated_grams: { min: 120, max: 180 },
    method: "visual_estimate",
    uncertainty: { relative_sigma: 0.28, level: "medium", text: "rough", text_bn: "আনুমানিক" },
  },
  region: { x: 10, y: 20, w: 100, h: 80 },
  area_ratio: 0.04,
};

test("a well-formed result passes and keeps every field it should", () => {
  const result = validateRecognition({ food_items: [goodItem] }, CATALOGUE);
  assert.equal(result.ok, true);
  assert.equal(result.value.status, "ok");
  assert.equal(result.value.food_items.length, 1);
  const item = result.value.food_items[0];
  assert.equal(item.food_id, "rice-cooked");
  assert.deepEqual(item.alternatives, ["khichuri", "polao"]);
  assert.equal(item.identification_confidence, 0.72);
  assert.deepEqual(item.portion.estimated_grams, { min: 120, max: 180 });
  assert.equal(item.portion.method, "visual_estimate");
  assert.deepEqual(item.region, { x: 10, y: 20, w: 100, h: 80 });
});

test("a model's own nutrient values are discarded at the boundary, not merely unread", () => {
  const result = validateRecognition(
    {
      food_items: [{ ...goodItem, kcal: 9999, protein: 500, fat: 200, nutrition: { kcal: 1 }, nutrients: { kcal: 2 } }],
    },
    CATALOGUE,
  );
  assert.equal(result.ok, true);
  const item = result.value.food_items[0];
  // The result is BUILT from an explicit field list, so these keys are not present at all.
  assert.equal("kcal" in item, false, "a model-supplied calorie value must not exist on the result");
  assert.equal("protein" in item, false);
  assert.equal("nutrition" in item, false);
  assert.equal("nutrients" in item, false);
  assert.deepEqual(Object.keys(item).sort(), [
    "alternatives",
    "area_ratio",
    "display_name",
    "display_name_bn",
    "food_id",
    "identification_confidence",
    "portion",
    "region",
  ]);
});

test("a food id that is not in the catalogue is dropped and reported, never remapped", () => {
  const result = validateRecognition({ food_items: [goodItem, { ...goodItem, food_id: "sushi-mystery" }] }, CATALOGUE);
  assert.equal(result.ok, true);
  assert.equal(result.value.food_items.length, 1, "the unknown food must be dropped");
  assert.ok(result.value.missing_information.some((m) => m.code === "unknown_food_id"));
  assert.ok(!result.value.food_items.some((i) => i.food_id === "sushi-mystery"));
});

test("an alternative that is not in the catalogue is dropped too", () => {
  const result = validateRecognition({ food_items: [{ ...goodItem, alternatives: ["khichuri", "not-a-food"] }] }, CATALOGUE);
  assert.deepEqual(result.value.food_items[0].alternatives, ["khichuri"]);
});

test("a confidence outside 0 to 1 is refused", () => {
  for (const bad of [1.5, -0.2, Number.NaN, "high", null, undefined]) {
    const result = validateRecognition({ food_items: [{ ...goodItem, identification_confidence: bad }] }, CATALOGUE);
    assert.equal(result.ok, true);
    assert.equal(result.value.food_items.length, 0, `a confidence of ${bad} must not be accepted`);
    assert.ok(result.value.missing_information.some((m) => m.code === "bad_confidence"));
  }
});

test("the status is derived, never read from the source", () => {
  const claiming = validateRecognition({ status: "ok", food_items: [goodItem] }, CATALOGUE);
  assert.equal(claiming.value.status, "ok", "the derived status wins");

  const nothing = validateRecognition({ status: "ok", food_items: [] }, CATALOGUE);
  assert.equal(nothing.value.status, "no_food", "a model cannot declare itself ok when it found nothing");
});

test("a worker failure and a bad image are the two things the source may state", () => {
  const unavailable = validateRecognition({ __model_unavailable: true }, CATALOGUE);
  assert.equal(unavailable.value.status, "model_unavailable");
  const invalid = validateRecognition({ __invalid_image: true }, CATALOGUE);
  assert.equal(invalid.value.status, "invalid_image");
});

test("items the catalogue does not know give the unknown_food status", () => {
  const result = validateRecognition({ food_items: [{ ...goodItem, food_id: "mystery" }] }, CATALOGUE);
  assert.equal(result.value.status, "unknown_food");
});

test("a result below the identification threshold is flagged low_confidence", () => {
  const result = validateRecognition({ food_items: [{ ...goodItem, identification_confidence: 0.1 }] }, CATALOGUE);
  assert.equal(result.value.status, "low_confidence");
  assert.ok(result.value.missing_information.some((m) => m.code === "low_confidence"));
});

test("the threshold can be set by the caller, so it can come from a measurement", () => {
  const result = validateRecognition({ food_items: [{ ...goodItem, identification_confidence: 0.5 }] }, { ...CATALOGUE, minIdentification: 0.6 });
  assert.equal(result.value.status, "low_confidence");
});

test("an impossible portion is refused but the name is kept", () => {
  const result = validateRecognition(
    { food_items: [{ ...goodItem, portion: { estimated_grams: { min: 5000, max: 6000 }, method: "visual_estimate" } }] },
    CATALOGUE,
  );
  assert.equal(result.value.food_items.length, 1, "the food is still offered");
  assert.equal(result.value.food_items[0].portion.estimated_grams, null, "the impossible weight is dropped");
  assert.ok(result.value.missing_information.some((m) => m.code === "implausible_portion"));
});

test("a portion with its minimum above its maximum is refused", () => {
  const result = validateRecognition({ food_items: [{ ...goodItem, portion: { estimated_grams: { min: 200, max: 100 } } }] }, CATALOGUE);
  assert.equal(result.value.food_items[0].portion.estimated_grams, null);
});

test("a model cannot invent a portion method that is not one of the three", () => {
  const result = validateRecognition({ food_items: [{ ...goodItem, portion: { method: "monocular_depth_estimate" } }] }, CATALOGUE);
  assert.equal(result.value.food_items[0].portion.method, null);
});

test("a null portion is legal, because not every food has a weight", () => {
  const result = validateRecognition({ food_items: [{ food_id: "rice-cooked", identification_confidence: 0.9 }] }, CATALOGUE);
  assert.equal(result.ok, true);
  assert.equal(result.value.food_items[0].portion.estimated_grams, null);
  assert.equal(result.value.food_items[0].portion.method, null);
});

test("a result that is not an object is rejected outright", () => {
  for (const bad of [null, undefined, "a string", 42, []]) {
    const result = validateRecognition(bad, CATALOGUE);
    assert.equal(result.ok, false, `${JSON.stringify(bad)} must be rejected`);
    assert.ok(result.errors.length > 0);
  }
});

test("the same input always gives the same output", () => {
  const source = { food_items: [goodItem], model: { id: "m", version: "1", sha256: "abc" } };
  const a = JSON.stringify(validateRecognition(source, CATALOGUE).value);
  const b = JSON.stringify(validateRecognition(source, CATALOGUE).value);
  assert.equal(a, b);
});

test("every status the validator can produce is one of the declared ones", () => {
  const cases = [
    { food_items: [goodItem] },
    { food_items: [] },
    { food_items: [{ ...goodItem, food_id: "nope" }] },
    { food_items: [{ ...goodItem, identification_confidence: 0.01 }] },
    { __model_unavailable: true },
    { __invalid_image: true },
  ];
  for (const source of cases) {
    const result = validateRecognition(source, CATALOGUE);
    assert.ok(RECOGNITION_STATUSES.includes(result.value.status), `${result.value.status} must be a declared status`);
  }
});

test("every missing-information code has a message in both languages", () => {
  for (const [code, text] of Object.entries(MISSING_INFO_TEXT)) {
    assert.ok(text.en && text.en.length > 10, `${code} needs a real English message`);
    assert.ok(text.bn && text.bn.length > 5, `${code} needs a Bangla message`);
  }
});

test("every id the map offers exists in the catalogue", () => {
  const known = new Set([...RECORDS.map((r) => r.id), ...RECIPES.map((r) => r.id)]);
  for (const [className, entry] of Object.entries(CLASS_TO_FOOD)) {
    assert.ok(Array.isArray(entry.alternatives), `${className} must have an alternatives list`);
    assert.ok("foodId" in entry, `${className} must say what it maps to, even if that is nothing`);
    if (entry.foodId !== null) {
      assert.ok(known.has(entry.foodId), `${className} maps to ${entry.foodId}, which is not in the catalogue`);
    }
    for (const alternative of entry.alternatives) {
      assert.ok(known.has(alternative), `${className} offers ${alternative} as an alternative, which is not in the catalogue`);
      assert.notEqual(alternative, entry.foodId, `${className} must not list its own food as an alternative`);
    }
  }
});

test("a class with no catalogue food produces no suggestion, not a placeholder", () => {
  assert.equal(candidatesFor("chocolate"), null, "chocolate is not in the catalogue, so nothing is offered");
  assert.equal(candidatesFor("noodles"), null, "noodles is not in the catalogue, so nothing is offered");
  const placeholder = Object.values(CLASS_TO_FOOD).find((e) => e.foodId === "other");
  assert.equal(placeholder, undefined, "no class may fall back to a generic placeholder food");
});

test("a class the map does not know produces no suggestion at all", () => {
  assert.equal(candidatesFor("a-class-that-does-not-exist"), null);
  assert.equal(candidatesFor(""), null);
  assert.equal(candidatesFor(null), null);
  assert.equal(candidatesFor(42), null);
});

test("the background class and the catch-all class produce no food", () => {
  assert.equal(candidatesFor("background"), null, "background is not a food");
  assert.equal(candidatesFor("other ingredients"), null, "the catch-all is not a food");
});

test("a mapped class gives its candidates", () => {
  const rice = candidatesFor("rice");
  assert.equal(rice.foodId, "rice-cooked");
  assert.ok(rice.alternatives.includes("khichuri"), "rice could be khichuri");
  assert.ok(rice.alternatives.includes("bd-chicken-biryani"), "rice could be biryani");
  assert.equal(rice.ask, true, "rice must be asked about, because the picture cannot settle it");
});

test("a class name is matched without regard to case or spacing", () => {
  assert.ok(candidatesFor("Rice"), "the class name must match with a capital letter");
  assert.ok(candidatesFor("  rice  "), "the class name must match with stray spaces");
});

test("the classes the map does not cover are listed, so the gap is visible", () => {
  const unmapped = unmappedClasses(["rice", "background", "other ingredients", "something-new"]);
  assert.ok(unmapped.includes("background"));
  assert.ok(unmapped.includes("other ingredients"));
  assert.ok(unmapped.includes("something-new"));
  assert.ok(!unmapped.includes("rice"));
});
