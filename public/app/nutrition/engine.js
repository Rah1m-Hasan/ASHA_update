// The deterministic nutrition calculator for the catalogue path.
//
// This is the calculator the server uses to recalculate a meal, and the one the browser uses to
// preview it. There is only one, so a stored meal can never disagree with what the person saw.
//
// THE ARITHMETIC
//
// Everything is done in INTEGER MILLIGRAMS and rounded once at the end. Doing it in grams with
// floating point gives results that differ in the last decimal between the browser and Node,
// which makes "the server recalculated it and got a different number" a bug that only shows up
// sometimes. With integer milligrams the browser and the server produce identical numbers, and
// the same input always produces the same output.
//
//   nutrient_mg = round(per100g_mg * food_mg / 100000)
//
// which is just "per 100 g of food, times the food's weight", with 100000 because the divisor is
// 100 g and the unit is milligrams.
//
// THE RULES
//
//   - The per-100 g values come from the catalogue. Nothing here invents a number.
//   - An unknown food produces null, never zero. A food ASHA cannot calculate is not a food with
//     no energy; it is a food whose energy is unknown.
//   - A recipe's nutrients come from its ingredients. Its oil is an ingredient with a weight.
//   - Raw ingredient weights are never presented as cooked food weights. A recipe states both.
//   - The result is an ESTIMATE. It says so, and it carries the assumptions it made.

import { getRecord, getRecipe, isKnownFood, databaseRecordId } from "./catalogue/index.js";

/** The nutrients ASHA computes. */
export const NUTRIENT_KEYS = Object.freeze(["kcal", "protein", "fat", "carbohydrate", "fiber", "sodium"]);

/**
 * How each nutrient's per-100 g value is scaled to the integer base unit, and back.
 *
 * The base unit is the MILLI-unit of the nutrient's own measure: milli-kcal for energy, milligrams
 * for the macronutrients, and milligrams for sodium.
 *
 * `toBase` differs between nutrients because USDA reports them in different units per 100 g:
 * energy in kcal, the macronutrients in grams, and sodium in milligrams. Sodium therefore needs no
 * scaling at all, while the others are multiplied by 1000. Getting this wrong is not a rounding
 * detail - it turns 130 kcal of rice into 1300 kcal.
 *
 * `fromBase` is the inverse: the divisor that turns the base back into the nutrient's own unit.
 */
const BASE = {
  kcal: { toBase: 1000, fromBase: 1000, decimals: 0 },
  protein: { toBase: 1000, fromBase: 1000, decimals: 2 },
  fat: { toBase: 1000, fromBase: 1000, decimals: 2 },
  carbohydrate: { toBase: 1000, fromBase: 1000, decimals: 2 },
  fiber: { toBase: 1000, fromBase: 1000, decimals: 2 },
  sodium: { toBase: 1, fromBase: 1, decimals: 1 },
};

/**
 * Divide two integers, rounding to nearest, with no floating point in the division.
 *
 * `scaled` must be below 2^53 for the products to stay exact. It is: the largest case is a
 * food of 3000 g at 900 kcal per 100 g, which is 2.7e12.
 *
 * @param {number} scaled
 * @param {number} divisor
 * @returns {number}
 */
function divRound(scaled, divisor) {
  const q = Math.floor(scaled / divisor);
  const r = scaled - q * divisor;
  return r * 2 >= divisor ? q + 1 : q;
}

/**
 * Round to a fixed number of decimals, without the float noise of `toFixed`.
 *
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * The nutrient amounts of a food of a given weight, in the integer base units.
 *
 * The base units are what get summed, so a recipe's total is a sum of integers and cannot drift.
 * The conversion to the nutrient's own unit happens once, at the end.
 *
 * @param {{per100g:Record<string,number>}} record
 * @param {number} grams
 * @returns {Record<string, number|null>} the base-unit amount (milli-kcal, mg)
 */
export function nutrientsInBase(record, grams) {
  const out = {};
  if (!record || !Number.isFinite(grams) || grams < 0) {
    for (const key of NUTRIENT_KEYS) out[key] = null;
    return out;
  }
  const foodMg = Math.round(grams * 1000);
  for (const key of NUTRIENT_KEYS) {
    const per100g = record.per100g?.[key];
    if (!Number.isFinite(per100g)) {
      out[key] = null;
      continue;
    }
    const base = Math.round(per100g * BASE[key].toBase);
    const scaled = base * foodMg;
    // base is per 100 g = per 100000 mg of food.
    out[key] = divRound(scaled, 100000);
  }
  return out;
}

/**
 * The base-unit amounts, in each nutrient's own unit.
 *
 * @param {Record<string, number|null>} base
 * @returns {Record<string, number|null>}
 */
export function baseToUnits(base) {
  const out = {};
  for (const key of NUTRIENT_KEYS) {
    const value = base?.[key];
    if (value === null || value === undefined) {
      out[key] = null;
      continue;
    }
    out[key] = roundTo(value / BASE[key].fromBase, BASE[key].decimals);
  }
  return out;
}

/**
 * The nutrient amount in a food of a given weight.
 *
 * @param {{per100g:Record<string,number>}} record
 * @param {number} grams
 * @returns {Record<string, number|null>} the amount for that weight, in the nutrient's own unit
 */
export function nutrientsFor(record, grams) {
  return baseToUnits(nutrientsInBase(record, grams));
}

/**
 * The nutrients of a recipe's ingredients, summed.
 *
 * Every ingredient is scaled by `portionGrams / cookedYieldGrams`, because a person ate part of
 * the dish and the dish is what the recipe describes.
 *
 * @param {object} recipe
 * @param {number} portionGrams the cooked weight of the portion eaten
 * @returns {{nutrients:Record<string,number|null>, components:object[], missing:object[]}}
 */
export function calculateRecipe(recipe, portionGrams) {
  const components = [];
  const missing = [];
  const totals = {};
  for (const key of NUTRIENT_KEYS) totals[key] = 0;

  const yieldGrams = Number(recipe?.cookedYieldGrams);
  const grams = Number(portionGrams);
  if (!recipe || !Number.isFinite(yieldGrams) || yieldGrams <= 0 || !Number.isFinite(grams) || grams <= 0) {
    for (const key of NUTRIENT_KEYS) totals[key] = null;
    return { nutrients: baseToUnits(totals), base: totals, components, missing };
  }
  const factor = grams / yieldGrams;

  for (const ingredient of recipe.ingredients ?? []) {
    const record = getRecord(ingredient.foodId);
    if (!record) {
      missing.push({ foodId: ingredient.foodId, reason: "no_record" });
      continue;
    }
    const ingredientGrams = ingredient.grams * factor;
    // The sum is done in base units so it is a sum of integers.
    const base = nutrientsInBase(record, ingredientGrams);
    components.push({
      foodId: ingredient.foodId,
      role: ingredient.role,
      grams: ingredientGrams,
      base,
      nutrients: baseToUnits(base),
      databaseRecordId: record.databaseRecordId,
      state: record.state,
      source: record.source,
    });
    for (const key of NUTRIENT_KEYS) {
      if (totals[key] === null || base[key] === null) {
        totals[key] = null;
        continue;
      }
      totals[key] += base[key];
    }
  }

  // An ingredient ASHA has no record for makes the whole recipe's number unknown, not partial.
  if (missing.length) {
    for (const key of NUTRIENT_KEYS) totals[key] = null;
    return { nutrients: baseToUnits(totals), base: totals, components, missing };
  }
  return { nutrients: baseToUnits(totals), base: totals, components, missing };
}

/**
 * The nutrients of a single record at a given weight.
 *
 * @param {object} record
 * @param {number} grams
 * @returns {{nutrients:Record<string,number|null>, components:object[], missing:object[]}}
 */
export function calculateRecord(record, grams) {
  if (!record) {
    const empty = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, null]));
    return { nutrients: empty, base: empty, components: [], missing: [] };
  }
  const base = nutrientsInBase(record, grams);
  return {
    nutrients: baseToUnits(base),
    base,
    components: [
      {
        foodId: record.id,
        role: "main",
        grams: Number(grams),
        base,
        nutrients: baseToUnits(base),
        databaseRecordId: record.databaseRecordId,
        state: record.state,
        source: record.source,
      },
    ],
    missing: [],
  };
}

/**
 * The nutrients of any catalogue food at a given weight.
 *
 * A recipe and a record take different paths but produce the same shape.
 *
 * @param {string} foodId
 * @param {number} grams
 * @returns {{foodId:string, kind:string, status:string, nutrients:Record<string,number|null>, components:object[], missing:object[], assumptions:object[], databaseRecordId:string|null}}
 */
export function calculate(foodId, grams) {
  const recipe = getRecipe(foodId);
  if (recipe) {
    const { nutrients, base, components, missing } = calculateRecipe(recipe, grams);
    return {
      foodId,
      kind: "recipe",
      status: missing.length ? "unavailable" : "estimate",
      nutrients,
      base,
      // The weight of the portion that was asked about, which is NOT the weight of any one
      // ingredient. A recipe's components carry the ingredient weights; this carries the dish.
      portionGrams: grams,
      components,
      missing,
      assumptions: recipe.assumptions ?? [],
      databaseRecordId: databaseRecordId(foodId),
      recipeId: recipe.id,
      cookedYieldGrams: recipe.cookedYieldGrams,
      state: "cooked",
    };
  }
  const record = getRecord(foodId);
  if (record) {
    const { nutrients, base, components } = calculateRecord(record, grams);
    return {
      foodId,
      kind: "record",
      status: "estimate",
      nutrients,
      base,
      portionGrams: grams,
      components,
      missing: [],
      assumptions: [],
      databaseRecordId: record.databaseRecordId,
      state: record.state,
    };
  }
  const empty = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, null]));
  return {
    foodId,
    kind: "unknown",
    status: "unavailable",
    nutrients: empty,
    base: empty,
    components: [],
    missing: [{ foodId, reason: "not_in_catalogue" }],
    assumptions: [],
    databaseRecordId: null,
    state: null,
  };
}

/**
 * The whole meal, from confirmed items.
 *
 * Each item is {foodId, grams}. A food ASHA cannot calculate is left out of the total and listed
 * in `excluded` - it is never counted as zero, because "we do not know" and "none" are different.
 *
 * @param {Array<{uid?:string, foodId:string, grams:number}>} items
 * @returns {{total:Record<string,number|null>, items:Array<{uid:string, foodId:string, kind:string, status:string, nutrients:Record<string,number|null>, base:Record<string,number|null>, components:object[], missing:object[], assumptions:object[], databaseRecordId:string|null, portionGrams:number, state:string|null}>, counted:string[], excluded:string[], status:string}}
 */
export function calculateMeal(items) {
  const results = [];
  const seen = new Set();
  for (const item of items ?? []) {
    const uid = item.uid ?? item.foodId;
    if (seen.has(uid)) throw new RangeError("The same food was added twice.");
    seen.add(uid);
    results.push({ uid, ...calculate(item.foodId, item.grams) });
  }
  const counted = results.filter((r) => r.status !== "unavailable");
  const excluded = results.filter((r) => r.status === "unavailable").map((r) => r.uid);

  // The meal total is summed in base units, so it is a sum of integers.
  const totalBase = {};
  for (const key of NUTRIENT_KEYS) totalBase[key] = 0;
  if (!counted.length) {
    for (const key of NUTRIENT_KEYS) totalBase[key] = null;
  } else {
    for (const key of NUTRIENT_KEYS) {
      if (counted.some((r) => r.nutrients[key] === null)) {
        totalBase[key] = null;
        continue;
      }
      totalBase[key] = counted.reduce((sum, r) => sum + (r.base?.[key] ?? 0), 0);
    }
  }
  const total = baseToUnits(totalBase);

  let status = "estimate";
  if (!counted.length) status = "unavailable";
  else if (excluded.length) status = "uncertain";
  else if (counted.some((r) => r.missing.length)) status = "uncertain";

  return { total, items: results, counted: counted.map((r) => r.uid), excluded, status };
}

/**
 * Round a number for display without making it look more exact than it is.
 *
 * @param {number|null} value
 * @param {string} key
 * @returns {number|null}
 */
export function approx(value, key = "kcal") {
  if (!Number.isFinite(value)) return null;
  if (key === "kcal") return value >= 50 ? Math.round(value / 5) * 5 : Math.round(value);
  if (key === "sodium") return value >= 20 ? Math.round(value / 5) * 5 : Math.round(value);
  return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
}

/**
 * "about 105 kcal", "90–120 kcal" (and the Bangla equivalents).
 *
 * @param {{min:number,max:number|null}|null} value
 * @param {string} key
 * @param {string} lang
 * @returns {string}
 */
export function formatValue(value, key, lang = "en") {
  const unit = key === "kcal" ? (lang === "bn" ? "কিলোক্যালরি" : "kcal") : key === "sodium" ? (lang === "bn" ? "মিগ্রা" : "mg") : lang === "bn" ? "গ্রাম" : "g";
  const digits = (x) => (lang === "bn" ? String(x).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]) : String(x));
  if (!value || !Number.isFinite(value.min)) return lang === "bn" ? "অজানা" : "unknown";
  const lo = approx(value.min, key);
  const hi = value.max === null || !Number.isFinite(value.max) ? null : approx(value.max, key);
  if (hi === null) return lang === "bn" ? `অন্তত ${digits(lo)} ${unit}` : `at least ${lo} ${unit}`;
  if (hi !== lo) return `${digits(lo)}–${digits(hi)} ${unit}`;
  return lang === "bn" ? `প্রায় ${digits(lo)} ${unit}` : `about ${lo} ${unit}`;
}

export { isKnownFood, getRecord, getRecipe };
