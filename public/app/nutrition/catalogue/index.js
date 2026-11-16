// The one catalogue both surfaces and the server use.
//
// Records (single ingredients, per-100 g from USDA) and recipes (dishes assembled from records)
// live side by side here, behind one lookup and one search. The dashboard, the legacy Everyday
// app and the Node server all import this file, so there is exactly one set of numbers in ASHA.
//
// THE SEARCH RULE
//
// A person looking for a food types whatever they know: "bhat", "ভাত", "rice", "murgi", "chicken".
// So every record and recipe is searched over its English name, its Bangla name, its synonyms
// and its transliterations. A Bangla query that finds nothing returns nothing - it does not fall
// back to an English guess, because a wrong food is worse than no food.
//
// THE HOUSEHOLD-UNIT RULE
//
// A portion is per food, never per app. A cup of cooked rice is 158 g and a cup of boiled lentils
// is 198 g, both from USDA's own portion table for that food. There is no shared "one bowl = X g"
// constant, because that number would be wrong for most of the catalogue.
//
// A portion measured by VOLUME (a tablespoon, a teaspoon) carries no footprint on the plate, so it
// has no vessel. Those are usable when a person names the measure, but they can never feed the
// area-based portion estimate - that path needs an area, and a volume is not an area.
import { RECORDS, RECORD_IDS, CATALOGUE_VERSION } from "./records.js";
import { RECIPES, RECIPE_IDS } from "./recipes.js";

export { RECORDS, RECORD_IDS, CATALOGUE_VERSION, RECIPES, RECIPE_IDS };

/**
 * @typedef {Object} CatalogueEntry
 * @property {string} id
 * @property {"record"|"recipe"} kind
 * @property {string} en
 * @property {string} bn
 * @property {string[]} aliases
 * @property {string} category
 */

/** The records, keyed by id. */
const RECORD_BY_ID = new Map(RECORDS.map((r) => [r.id, r]));

/** The recipes, keyed by id. */
const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/**
 * A record, or null.
 *
 * @param {string} id
 * @returns {object|null}
 */
export function getRecord(id) {
  return RECORD_BY_ID.get(id) ?? null;
}

/**
 * A recipe, or null.
 *
 * @param {string} id
 * @returns {object|null}
 */
export function getRecipe(id) {
  return RECIPE_BY_ID.get(id) ?? null;
}

/**
 * A record or a recipe, whichever the id names.
 *
 * @param {string} id
 * @returns {CatalogueEntry|null}
 */
export function getEntry(id) {
  const record = RECORD_BY_ID.get(id);
  if (record) {
    return {
      id: record.id,
      kind: "record",
      en: record.en,
      bn: record.bn,
      aliases: [...record.aliases],
      category: record.category,
      source: record,
    };
  }
  const recipe = RECIPE_BY_ID.get(id);
  if (recipe) {
    return {
      id: recipe.id,
      kind: "recipe",
      en: recipe.en,
      bn: recipe.bn,
      aliases: [...recipe.aliases],
      category: recipe.category,
      source: recipe,
    };
  }
  return null;
}

/**
 * Every entry, records first then recipes.
 *
 * @returns {CatalogueEntry[]}
 */
export function allEntries() {
  return [...RECORDS.map((r) => getEntry(r.id)), ...RECIPES.map((r) => getEntry(r.id))];
}

/**
 * Normalise a query for matching: lower case, and strip the punctuation people leave out.
 *
 * @param {string} text
 * @returns {string}
 */
function normalise(text) {
  return String(text ?? "")
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * The search index, built once.
 *
 * Each entry is indexed under its id, its English name, its Bangla name and every alias. An
 * alias that contains a space is also indexed under its words, so "roast beef" is found by "beef".
 */
const INDEX = (() => {
  const index = new Map();
  const add = (key, entry) => {
    const k = normalise(key);
    if (!k) return;
    const list = index.get(k) ?? [];
    if (!list.includes(entry)) list.push(entry);
    index.set(k, list);
  };
  for (const entry of allEntries()) {
    add(entry.id, entry);
    add(entry.en, entry);
    add(entry.bn, entry);
    for (const alias of entry.aliases) {
      add(alias, entry);
      for (const word of String(alias).split(/\s+/)) {
        if (word.length > 2) add(word, entry);
      }
    }
  }
  return index;
})();

/**
 * Find foods and recipes by name, in English or Bangla.
 *
 * An exact match comes first, then a prefix match, then a substring match. A query that matches
 * nothing returns an empty list - it never returns a near miss.
 *
 * @param {string} query
 * @param {{limit?:number, kind?:("record"|"recipe")|"all"}} opts
 * @returns {CatalogueEntry[]}
 */
export function searchFoods(query, opts = {}) {
  const key = normalise(query);
  if (!key) return [];
  const limit = Number.isFinite(opts.limit) ? opts.limit : 20;
  const wantKind = opts.kind ?? "all";
  const filter = (entry) => wantKind === "all" || entry.kind === wantKind;

  const exact = INDEX.get(key) ?? [];
  const out = [];
  const seen = new Set();
  const push = (entry) => {
    if (!filter(entry) || seen.has(entry.id)) return;
    seen.add(entry.id);
    out.push(entry);
  };
  exact.forEach(push);

  if (out.length < limit) {
    for (const [candidate, entries] of INDEX) {
      if (candidate === key) continue;
      if (!candidate.startsWith(key)) continue;
      entries.forEach(push);
      if (out.length >= limit) break;
    }
  }
  if (out.length < limit) {
    for (const [candidate, entries] of INDEX) {
      if (candidate === key || candidate.startsWith(key)) continue;
      if (!candidate.includes(key)) continue;
      entries.forEach(push);
      if (out.length >= limit) break;
    }
  }
  return out.slice(0, limit);
}

/**
 * The household measures for a food, taken from that food's own USDA portions.
 *
 * A record with no portions returns an empty list rather than a made-up default.
 *
 * @param {string} id
 * @returns {Array<{id:string, en:string, bn:string, grams:number, amount:number, vessel:string|null}>}
 */
export function householdPortions(id) {
  const record = RECORD_BY_ID.get(id);
  if (!record) return [];
  return record.portions.map((p) => ({ ...p }));
}

/**
 * The measure that has a footprint on the plate, for the area-based portion estimate.
 *
 * @param {string} id
 * @returns {{grams:number, vessel:string, areaDefining:true}|null}
 */
export function areaDefiningPortion(id) {
  const record = RECORD_BY_ID.get(id);
  if (!record) return null;
  const portion = record.portions.find((p) => p.vessel);
  if (!portion) return null;
  return { grams: portion.grams, vessel: portion.vessel, areaDefining: true };
}

/**
 * The catalogue's own identifier for an entry, in the form the database uses.
 *
 * A record is "fdc:<id>" and a recipe is "recipe:<id>", so a stored meal can be traced back to
 * exactly where its numbers came from.
 *
 * @param {string} id
 * @returns {string|null}
 */
export function databaseRecordId(id) {
  const record = RECORD_BY_ID.get(id);
  if (record) return record.databaseRecordId;
  const recipe = RECIPE_BY_ID.get(id);
  if (recipe) return `recipe:${recipe.id}`;
  return null;
}

/**
 * Whether an id names something ASHA can calculate.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isKnownFood(id) {
  return RECORD_BY_ID.has(id) || RECIPE_BY_ID.has(id);
}
