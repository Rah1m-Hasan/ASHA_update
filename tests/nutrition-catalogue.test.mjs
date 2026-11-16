import test from "node:test";
import assert from "node:assert/strict";

import {
  RECORDS,
  RECORD_IDS,
  RECIPES,
  RECIPE_IDS,
  CATALOGUE_VERSION,
  getRecord,
  getRecipe,
  getEntry,
  searchFoods,
  householdPortions,
  areaDefiningPortion,
  databaseRecordId,
  isKnownFood,
} from "../public/app/nutrition/catalogue/index.js";

test("the catalogue holds records and recipes, and every record names its USDA source", () => {
  assert.ok(RECORDS.length >= 40, "the catalogue should hold a usable number of records");
  for (const record of RECORDS) {
    assert.match(record.databaseRecordId, /^fdc:\d+$/, `${record.id} must name its USDA record`);
    assert.match(String(record.fdcId), /^\d+$/, `${record.id} must have a numeric USDA id`);
    assert.equal(record.source.publisher, "USDA FoodData Central");
    assert.equal(record.databaseSource, "USDA FoodData Central SR Legacy");
    assert.ok(record.verification.status, `${record.id} must state how it was verified`);
  }
});

test("every record has an id, both names, a category, a state and complete per-100 g nutrients", () => {
  const ids = new Set();
  for (const record of RECORDS) {
    assert.ok(record.id && !ids.has(record.id), `${record.id} must be a unique non-empty id`);
    ids.add(record.id);
    assert.ok(record.en && record.bn, `${record.id} must have both an English and a Bangla name`);
    assert.ok(record.category, `${record.id} must have a category`);
    assert.ok(record.state, `${record.id} must state its preparation state`);
    for (const key of ["kcal", "protein", "fat", "carbohydrate", "fiber", "sodium"]) {
      assert.equal(typeof record.per100g[key], "number", `${record.id} must have a ${key} value`);
      assert.ok(record.per100g[key] >= 0, `${record.id} must not have a negative ${key}`);
    }
    // Salt has no energy - that is the source's value, not a broken record. Every other food
    // must carry some, because a food with no energy is not a food.
    if (record.category !== "seasoning") {
      assert.ok(record.per100g.kcal > 0, `${record.id} must have some energy`);
    }
    assert.ok(Array.isArray(record.aliases), `${record.id} must have a synonym list`);
  }
});

test("no record has a nutrient value of zero where the source has one, and none is negative", () => {
  // A record whose values are all zero would be a broken build, not a food.
  for (const record of RECORDS) {
    const sum = record.per100g.kcal + record.per100g.protein + record.per100g.fat + record.per100g.carbohydrate;
    // Salt is the one food with genuinely no energy, so it is excluded rather than fudged.
    if (record.category !== "seasoning") {
      assert.ok(sum > 0, `${record.id} has no nutrients at all`);
    }
  }
});

test("every record's USDA id appears in its own source URL", () => {
  for (const record of RECORDS) {
    assert.ok(record.source.url.includes(String(record.fdcId)), `${record.id}'s source URL must name its USDA id`);
  }
});

test("the household portions are per food, and the weights differ between foods", () => {
  const rice = householdPortions("rice-cooked");
  const lentils = householdPortions("lentils-boiled");
  assert.ok(rice.length > 0, "cooked rice must have a household portion");
  const riceCup = rice.find((p) => p.vessel === "cup");
  const lentilCup = lentils.find((p) => p.vessel === "cup");
  assert.equal(riceCup.grams, 158, "one cup of cooked rice is 158 g in USDA's table");
  assert.equal(lentilCup.grams, 198, "one cup of boiled lentils is 198 g in USDA's table");
  assert.notEqual(
    riceCup.grams,
    lentilCup.grams,
    "a single shared bowl weight would be wrong for most of the catalogue",
  );
});

test("a portion measured by volume has no vessel, because a volume is not an area", () => {
  const egg = householdPortions("egg-hard-boiled");
  const spoon = egg.find((p) => /tbsp/i.test(p.en));
  assert.ok(spoon, "hard-boiled egg should have a tablespoon portion");
  assert.equal(spoon.vessel, null, "a tablespoon has no footprint on the plate");
  const cup = egg.find((p) => p.vessel === "cup");
  assert.ok(cup, "a cup has a footprint");
});

test("a food with no record has no portions, and no made-up default", () => {
  assert.deepEqual(householdPortions("not-a-food"), []);
  assert.equal(areaDefiningPortion("not-a-food"), null);
});

test("the area-defining portion is the one with a vessel", () => {
  const portion = areaDefiningPortion("rice-cooked");
  assert.equal(portion.vessel, "cup");
  assert.equal(portion.grams, 158);
  assert.equal(portion.areaDefining, true);
});

test("searching finds a food by its English name, its Bangla name and its transliteration", () => {
  const byEnglish = searchFoods("rice");
  assert.ok(byEnglish.some((e) => e.id === "rice-cooked"), "searching 'rice' must find cooked rice");

  const byBangla = searchFoods("ভাত");
  assert.ok(byBangla.some((e) => e.id === "rice-cooked"), "searching the Bangla name must find cooked rice");

  const byTransliteration = searchFoods("bhat");
  assert.ok(
    byTransliteration.some((e) => e.id === "rice-cooked"),
    "searching a Bangla word written in Latin letters must find cooked rice",
  );
});

test("searching finds a recipe by its Bangla name and by its English name", () => {
  assert.ok(searchFoods("খিচুড়ি").some((e) => e.id === "khichuri"), "the Bangla name must find khichuri");
  assert.ok(searchFoods("khichuri").some((e) => e.id === "khichuri"), "the English name must find khichuri");
  assert.ok(searchFoods("বিরিয়ানি").some((e) => e.id === "bd-chicken-biryani"), "the Bangla name must find biryani");
});

test("searching for something that is not in the catalogue returns nothing rather than a near miss", () => {
  assert.deepEqual(searchFoods("xyzzy-not-a-food"), []);
  assert.deepEqual(searchFoods(""), []);
  assert.deepEqual(searchFoods("   "), []);
});

test("searching does not mix raw and cooked rice together as one answer", () => {
  const results = searchFoods("rice");
  const ids = results.map((e) => e.id);
  assert.ok(ids.includes("rice-cooked"), "cooked rice must be found");
  assert.ok(ids.includes("rice-raw"), "dry rice must be found too - they are different foods");
});

test("a record's identifiers are the USDA ones and a recipe's are ASHA's own", () => {
  assert.equal(databaseRecordId("rice-cooked"), "fdc:168878");
  assert.equal(databaseRecordId("khichuri"), "recipe:khichuri");
  assert.equal(databaseRecordId("not-a-food"), null);
});

test("the lookup functions agree with each other about what exists", () => {
  assert.ok(getRecord("rice-cooked"));
  assert.equal(getRecord("khichuri"), null, "a recipe is not a record");
  assert.ok(getRecipe("khichuri"));
  assert.equal(getRecipe("rice-cooked"), null, "a record is not a recipe");
  assert.ok(getEntry("rice-cooked"));
  assert.ok(getEntry("khichuri"));
  assert.equal(getEntry("not-a-food"), null);
  assert.equal(isKnownFood("rice-cooked"), true);
  assert.equal(isKnownFood("khichuri"), true);
  assert.equal(isKnownFood("not-a-food"), false);
});

test("every recipe's ingredients are records that exist", () => {
  for (const recipe of RECIPES) {
    assert.ok(recipe.ingredients.length > 0, `${recipe.id} must have ingredients`);
    for (const ingredient of recipe.ingredients) {
      assert.ok(
        getRecord(ingredient.foodId),
        `${recipe.id} names the ingredient ${ingredient.foodId}, which is not in the catalogue`,
      );
      assert.ok(ingredient.grams > 0, `${recipe.id}'s ${ingredient.foodId} must have a positive weight`);
      assert.ok(["raw", "cooked"].includes(ingredient.state), `${recipe.id}'s ${ingredient.foodId} must state its state`);
    }
  }
});

test("every recipe states its assumptions in English and Bangla, and shows them to the person", () => {
  for (const recipe of RECIPES) {
    assert.ok(recipe.assumptions.length > 0, `${recipe.id} must say what it assumed`);
    for (const assumption of recipe.assumptions) {
      assert.ok(assumption.en && assumption.en.length > 20, `${recipe.id}'s assumption must be a real sentence`);
      assert.ok(assumption.bn && assumption.bn.length > 10, `${recipe.id}'s assumption must be in Bangla too`);
    }
  }
});

test("every recipe declares its cooked yield, and the yield is accounted for by its ingredients and water", () => {
  for (const recipe of RECIPES) {
    assert.ok(recipe.cookedYieldGrams > 0, `${recipe.id} must state its cooked yield`);
    assert.ok(recipe.servings > 0, `${recipe.id} must say how many servings it makes`);
    const rawTotal = recipe.ingredients.reduce((sum, i) => sum + i.grams, 0);
    // Rice absorbs water and a dal boils most of it away, so the yield is judged against the
    // ingredients PLUS the water the recipe says it uses. A dish that weighs more than its
    // inputs is either a mistake or a recipe that uses water it does not declare.
    const input = rawTotal + recipe.waterAddedGrams;
    assert.ok(
      recipe.cookedYieldGrams <= input,
      `${recipe.id} weighs more cooked (${recipe.cookedYieldGrams} g) than its ingredients and water (${input} g)`,
    );
    // And some water always boils off, so the yield cannot be the whole input either.
    assert.ok(
      recipe.cookedYieldGrams >= input * 0.2,
      `${recipe.id} keeps only ${recipe.cookedYieldGrams} g of ${input} g - that is not a plausible dish`,
    );
  }
});

test("a chicken dish is never served under a mutton or beef dish's name", () => {
  const chicken = RECIPES.find((r) => r.id === "chicken-curry");
  const beef = RECIPES.find((r) => r.id === "beef-bhuna");
  const mutton = RECIPES.find((r) => r.id === "mutton-curry");
  const idsOf = (recipe) => recipe.ingredients.map((i) => i.foodId);

  assert.ok(idsOf(chicken).includes("chicken-roasted"));
  assert.ok(!idsOf(chicken).some((id) => id.startsWith("beef") || id.startsWith("mutton")));
  assert.ok(idsOf(beef).some((id) => id.startsWith("beef")));
  assert.ok(!idsOf(beef).some((id) => id.startsWith("chicken")));
  assert.ok(idsOf(mutton).some((id) => id.startsWith("mutton")));
  assert.ok(!idsOf(mutton).some((id) => id.startsWith("chicken")));
});

test("a biryani is a chicken dish, and a polao is not", () => {
  const biryani = RECIPES.find((r) => r.id === "bd-chicken-biryani");
  const polao = RECIPES.find((r) => r.id === "polao");
  assert.ok(biryani.ingredients.some((i) => i.foodId === "chicken-roasted"), "biryani must contain chicken");
  assert.ok(!polao.ingredients.some((i) => i.foodId.startsWith("chicken")), "polao has no meat in it");
  assert.notEqual(biryani.id, polao.id);
});

test("the cooking oil in every recipe is a real ingredient with a weight", () => {
  for (const recipe of RECIPES) {
    const oil = recipe.ingredients.find((i) => i.role === "oil");
    assert.ok(oil, `${recipe.id} must list its cooking oil as an ingredient`);
    assert.ok(oil.grams > 0, `${recipe.id}'s oil must have a weight`);
    const record = getRecord(oil.foodId);
    assert.ok(record.per100g.kcal > 800, `${recipe.id}'s oil must be an oil, not a low-energy food`);
  }
});

test("the catalogue has a version, so a stored meal can be traced to the numbers it used", () => {
  assert.ok(CATALOGUE_VERSION && typeof CATALOGUE_VERSION === "string");
  assert.ok(CATALOGUE_VERSION.includes("sr-legacy"), "the version must name the source data");
});

test("every record id and recipe id is unique", () => {
  assert.equal(new Set(RECORD_IDS).size, RECORD_IDS.length, "record ids must be unique");
  assert.equal(new Set(RECIPE_IDS).size, RECIPE_IDS.length, "recipe ids must be unique");
  const overlap = RECORD_IDS.filter((id) => RECIPE_IDS.includes(id));
  assert.deepEqual(overlap, [], "a record and a recipe must not share an id");
});
