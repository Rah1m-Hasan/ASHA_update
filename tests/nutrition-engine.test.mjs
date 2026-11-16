import test from "node:test";
import assert from "node:assert/strict";

import {
  calculate,
  calculateMeal,
  calculateRecipe,
  calculateRecord,
  nutrientsFor,
  nutrientsInBase,
  baseToUnits,
  NUTRIENT_KEYS,
  approx,
} from "../public/app/nutrition/engine.js";
import { getRecord, getRecipe } from "../public/app/nutrition/catalogue/index.js";

test("the per-100 g values come straight from the catalogue record", () => {
  const record = getRecord("rice-cooked");
  const nutrients = calculate("rice-cooked", 100).nutrients;
  for (const key of NUTRIENT_KEYS) {
    assert.equal(nutrients[key], record.per100g[key], `${key} at 100 g must equal the record's per-100 g value`);
  }
});

test("the nutrient amount is proportional to the weight", () => {
  const full = calculate("rice-cooked", 200).nutrients;
  const half = calculate("rice-cooked", 100).nutrients;
  assert.equal(full.kcal, half.kcal * 2);
  assert.equal(full.protein, half.protein * 2);
  assert.equal(full.carbohydrate, half.carbohydrate * 2);
});

test("a food ASHA cannot calculate has unknown nutrients, never zero", () => {
  const result = calculate("not-a-food", 100);
  assert.equal(result.status, "unavailable");
  for (const key of NUTRIENT_KEYS) {
    assert.equal(result.nutrients[key], null, `${key} must be unknown, not zero`);
  }
});

test("a zero weight produces zero, and a negative weight is refused rather than computed", () => {
  assert.equal(calculate("rice-cooked", 0).nutrients.kcal, 0);
  const negative = calculate("rice-cooked", -50).nutrients;
  for (const key of NUTRIENT_KEYS) assert.equal(negative[key], null, "a negative weight must not produce a number");
});

test("the arithmetic is done in integer base units, so it does not drift", () => {
  const base = nutrientsInBase(getRecord("rice-cooked"), 100);
  assert.equal(Number.isInteger(base.kcal), true, "the base amount must be an integer");
  assert.equal(Number.isInteger(base.protein), true, "the base amount must be an integer");
  // The same food at the same weight gives exactly the same base, every time.
  const again = nutrientsInBase(getRecord("rice-cooked"), 100);
  assert.deepEqual(base, again);
});

test("a recipe's nutrients are the sum of its ingredients, and the oil is one of them", () => {
  const recipe = getRecipe("chicken-curry");
  const { nutrients, components } = calculateRecipe(recipe, recipe.cookedYieldGrams);
  const oil = components.find((c) => c.foodId === "oil-mustard");
  assert.ok(oil, "the oil must be a component of the recipe");
  assert.ok(oil.nutrients.kcal > 150, "18 g of mustard oil carries about 160 kcal");
  assert.ok(nutrients.kcal > oil.nutrients.kcal, "the dish carries more than its oil alone");
});

test("a recipe at a fraction of its yield scales down", () => {
  const recipe = getRecipe("chicken-curry");
  const whole = calculateRecipe(recipe, recipe.cookedYieldGrams).nutrients;
  const half = calculateRecipe(recipe, recipe.cookedYieldGrams / 2).nutrients;
  assert.ok(Math.abs(half.kcal - whole.kcal / 2) < 1, "half the dish is about half the energy");
});

test("a recipe reports the assumptions it made", () => {
  const result = calculate("chicken-curry", 200);
  assert.equal(result.kind, "recipe");
  assert.ok(result.assumptions.length > 0);
  assert.ok(result.assumptions.every((a) => a.en && a.bn), "every assumption needs both languages");
});

test("a recipe's oil is a real cost, so a dish with more oil has more energy", () => {
  const withOil = calculate("chicken-curry", 210).nutrients.kcal;
  // The same dish with the oil removed, worked out by hand from the recipe.
  const recipe = getRecipe("chicken-curry");
  const withoutOil = recipe.ingredients
    .filter((i) => i.role !== "oil")
    .reduce((sum, i) => sum + calculate(i.foodId, (i.grams * 210) / recipe.cookedYieldGrams).nutrients.kcal, 0);
  // Half the dish, so half the oil. 18 g of mustard oil is about 160 kcal, so 9 g is about 80.
  assert.ok(Math.abs(withOil - withoutOil - 80) < 2, "the oil must account for the difference");
  assert.ok((withOil - withoutOil) / withOil > 0.15, "the oil must be a meaningful share of the dish");
});

test("the same input always gives the same output", () => {
  const a = JSON.stringify(calculate("bd-chicken-biryani", 240).nutrients);
  const b = JSON.stringify(calculate("bd-chicken-biryani", 240).nutrients);
  assert.equal(a, b, "the calculator must be deterministic");
});

test("a meal totals its foods and lists the ones it could not calculate", () => {
  const meal = calculateMeal([
    { uid: "a", foodId: "rice-cooked", grams: 150 },
    { uid: "b", foodId: "dal", grams: 200 },
  ]);
  assert.equal(meal.status, "estimate");
  assert.deepEqual(meal.excluded, []);
  const rice = calculate("rice-cooked", 150).nutrients.kcal;
  const dal = calculate("dal", 200).nutrients.kcal;
  assert.ok(Math.abs(meal.total.kcal - (rice + dal)) < 0.5, "the meal total is the sum of its foods");
});

test("a meal with a food ASHA cannot calculate excludes it and says so, and does not count it as zero", () => {
  const meal = calculateMeal([
    { uid: "a", foodId: "rice-cooked", grams: 150 },
    { uid: "b", foodId: "not-a-food", grams: 100 },
  ]);
  assert.deepEqual(meal.excluded, ["b"], "the unknown food must be listed as excluded");
  assert.equal(meal.status, "uncertain", "the meal is uncertain because one food is unknown");
  // ASHA's convention, and the one the rest of the app already uses: a food with no responsible
  // number is LEFT OUT of the total and listed, never counted as zero. So the total here is the
  // rice's energy and the unknown food is named separately.
  assert.equal(meal.total.kcal, calculate("rice-cooked", 150).nutrients.kcal);
  assert.notEqual(meal.total.kcal, 0, "the known food must still count");
});

test("the same food twice in a meal is refused", () => {
  assert.throws(
    () => calculateMeal([{ uid: "a", foodId: "rice-cooked", grams: 100 }, { uid: "a", foodId: "rice-cooked", grams: 50 }]),
    RangeError,
  );
});

test("an empty meal has no total and is unavailable, not zero", () => {
  const meal = calculateMeal([]);
  assert.equal(meal.status, "unavailable");
  assert.equal(meal.total.kcal, null);
});

test("a record and a recipe give the same shape of answer", () => {
  const record = calculate("rice-cooked", 100);
  const recipe = calculate("dal", 100);
  for (const key of ["foodId", "kind", "status", "nutrients", "components", "missing", "assumptions", "databaseRecordId"]) {
    assert.ok(key in record, `a record result must have ${key}`);
    assert.ok(key in recipe, `a recipe result must have ${key}`);
  }
});

test("a recipe states its cooked yield, so a portion can be scaled against it", () => {
  const result = calculate("khichuri", 180);
  assert.equal(result.cookedYieldGrams, getRecipe("khichuri").cookedYieldGrams);
  assert.equal(result.state, "cooked");
});

test("a record keeps its preparation state, so cooked rice never claims to be dry rice", () => {
  assert.equal(calculate("rice-cooked", 100).state, "cooked");
  assert.equal(calculate("rice-raw", 100).state, "raw");
});

test("the base units convert back to the nutrient's own unit without losing the value", () => {
  const base = nutrientsInBase(getRecord("lentils-boiled"), 250);
  const units = baseToUnits(base);
  assert.equal(units.protein, 22.55, "250 g of boiled lentils is 22.55 g of protein");
  assert.equal(units.kcal, 290);
  assert.equal(units.sodium, 5);
});

test("the display rounding does not make a number look more exact than it is", () => {
  assert.equal(approx(103.4, "kcal"), 105, "energy is rounded to the nearest 5 above 50");
  assert.equal(approx(12.3, "protein"), 12, "grams are rounded to whole numbers above 10");
  assert.equal(approx(1.24, "protein"), 1.2, "small gram values keep one decimal");
  assert.equal(approx(null), null);
});
