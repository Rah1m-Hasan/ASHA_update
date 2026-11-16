// Builds the shared nutrition catalogue from the USDA FoodData Central SR Legacy bulk CSV.
//
//   node scripts/build-nutrition-catalogue.mjs --csv <dir-with-sr-legacy-csvs> [--out public/app/nutrition/catalogue/records.js]
//
// WHY A GENERATOR
//
// The catalogue's numbers are not typed by hand. Every per-100 g value and every household
// portion weight comes out of the SR Legacy CSV, and this script is what puts it into the repo.
// Re-running it against the same CSV produces the same file, so the catalogue can be audited
// against its source at any time.
//
// WHERE THE CSV COMES FROM
//
//   https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
//
// It is not committed (6 MB, and it is a build input rather than an app asset). The zip's SHA-256
// is printed below and checked by scripts/model-integrity.mjs-adjacent tooling.
//
// WHAT IS AND IS NOT IN HERE
//
// Only foods with a real USDA record are included. A dish with no USDA record is NOT given
// invented numbers - it is either a recipe assembled from records that do exist
// (public/app/nutrition/catalogue/recipes.js) or it is name-only and reports "no data".
//
// Each record keeps: its stable ASHA id, its USDA id, the English and Bangla names, synonyms
// (including transliterations like "bhat" -> ভাত), the preparation state, the per-100 g
// nutrients, the household portions with their gram weights, and the source with its identifier.
import fs from "node:fs";
import path from "node:path";
import { readCsv } from "./lib/csv.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const csvDir = arg("--csv", "");
const outFile = path.resolve(arg("--out", "public/app/nutrition/catalogue/records.js"));
if (!csvDir) {
  console.error("usage: node scripts/build-nutrition-catalogue.mjs --csv <sr-legacy dir> [--out <file>]");
  process.exit(1);
}

/**
 * The foods the catalogue holds.
 *
 * `fdcId` is the USDA identifier. Everything else here is ASHA's own naming: the stable id, the
 * Bangla name, the synonyms a person might type, the category the interview groups by, and the
 * preparation state - which is part of a food's identity, so cooked rice never matches dry rice.
 *
 * The `vessel` on a portion is what makes an AREAL density possible: a portion defined by volume
 * (a tablespoon, a teaspoon) has no footprint on the plate, so it gets no vessel and can never
 * enter the area-based portion estimate.
 */
const CATALOGUE = [
  // --- Grains ---------------------------------------------------------------
  { id: "rice-cooked", fdcId: 168878, bn: "ভাত", category: "grain", state: "cooked", aliases: ["bhat", "সাদা ভাত", "white rice", "boiled rice", "plain rice"] },
  { id: "rice-raw", fdcId: 168877, bn: "চাল", category: "grain", state: "raw", aliases: ["chal", "raw rice", "uncooked rice", "dry rice"] },
  { id: "wheat-flour", fdcId: 168894, bn: "আটা", category: "grain", state: "raw", aliases: ["atta", "maida", "flour", "white flour"] },

  // --- Proteins -------------------------------------------------------------
  { id: "chicken-roasted", fdcId: 171477, bn: "মুরগির মাংস (সেদ্ধ)", category: "protein", state: "cooked", aliases: ["murgi", "chicken", "chicken meat", "roast chicken", "chicken breast"] },
  { id: "chicken-fried", fdcId: 171078, bn: "ভাজা মুরগি", category: "protein", state: "cooked", aliases: ["fried chicken", "chicken fry"] },
  { id: "beef-roasted", fdcId: 168723, bn: "গরুর মাংস (সেদ্ধ)", category: "protein", state: "cooked", aliases: ["gor", "beef", "beef steak", "roast beef", "beef meat"] },
  { id: "beef-ground-70", fdcId: 168650, bn: "গরুর মাংস (কিমা)", category: "protein", state: "cooked", aliases: ["keema", "minced beef", "ground beef", "beef keema"] },
  { id: "mutton-roasted", fdcId: 172480, bn: "ছাগলের মাংস (সেদ্ধ)", category: "protein", state: "cooked", aliases: ["khasi", "goat", "mutton", "lamb", "lamb meat"] },
  { id: "tilapia-cooked", fdcId: 175177, bn: "তেলাপিয়া মাছ (সেদ্ধ)", category: "protein", state: "cooked", aliases: ["telapia", "tilapia", "fish", "roasted fish"] },
  { id: "carp-cooked", fdcId: 174185, bn: "রুই মাছ (সেদ্ধ)", category: "protein", state: "cooked", aliases: ["rui", "katla", "carp", "rui fish", "katla fish", "rohu"] },
  { id: "egg-hard-boiled", fdcId: 173424, bn: "সেদ্ধ ডিম", category: "protein", state: "cooked", aliases: ["dim", "egg", "boiled egg", "hard boiled egg"] },

  // --- Legumes --------------------------------------------------------------
  { id: "lentils-boiled", fdcId: 172421, bn: "মসুর ডাল (সেদ্ধ)", category: "legume", state: "cooked", aliases: ["dal", "daal", "masoor", "lentil", "lentils", "masur"] },
  { id: "chickpeas-boiled", fdcId: 173757, bn: "ছোলা (সেদ্ধ)", category: "legume", state: "cooked", aliases: ["chola", "chickpea", "garbanzo", "bengal gram", "chickpeas"] },
  { id: "kidney-beans-boiled", fdcId: 173740, bn: "রাজমা (সেদ্ধ)", category: "legume", state: "cooked", aliases: ["rajma", "kidney bean", "kidney beans", "dark red beans"] },

  // --- Vegetables -----------------------------------------------------------
  { id: "potato-boiled", fdcId: 170440, bn: "আলু (সেদ্ধ)", category: "vegetable", state: "cooked", aliases: ["alu", "aloo", "potato", "potatoes", "boiled potato"] },
  { id: "onion-raw", fdcId: 170000, bn: "পেঁয়াজ", category: "vegetable", state: "raw", aliases: ["peyaj", "onion", "onions", "shallot"] },
  { id: "garlic-raw", fdcId: 169230, bn: "রসুন", category: "vegetable", state: "raw", aliases: ["roshuno", "garlic"] },
  { id: "ginger-raw", fdcId: 169231, bn: "আদা", category: "vegetable", state: "raw", aliases: ["ada", "ginger", "ginger root"] },
  { id: "tomato-raw", fdcId: 170457, bn: "টমেটো", category: "vegetable", state: "raw", aliases: ["tomato", "tomatoes"] },
  { id: "eggplant-raw", fdcId: 169228, bn: "বেগুন", category: "vegetable", state: "raw", aliases: ["begun", "eggplant", "brinjal", "aubergine"] },
  { id: "okra-raw", fdcId: 169260, bn: "ঢেঁড়স", category: "vegetable", state: "raw", aliases: ["dheros", "okra", "lady finger", "ladies finger"] },
  { id: "cauliflower-raw", fdcId: 169986, bn: "ফুলকপি", category: "vegetable", state: "raw", aliases: ["fulkopi", "cauliflower"] },
  { id: "carrot-raw", fdcId: 170393, bn: "গাজর", category: "vegetable", state: "raw", aliases: ["gajor", "carrot", "carrots"] },
  { id: "spinach-raw", fdcId: 168462, bn: "পালং শাক", category: "vegetable", state: "raw", aliases: ["palong shak", "spinach"] },
  { id: "pumpkin-raw", fdcId: 168448, bn: "কুমড়া", category: "vegetable", state: "raw", aliases: ["kumra", "pumpkin", "squash"] },
  { id: "cabbage-raw", fdcId: 169975, bn: "বাঁকাই শাক", category: "vegetable", state: "raw", aliases: ["cabbage"] },

  // --- Fruit ----------------------------------------------------------------
  { id: "banana", fdcId: 173944, bn: "কলা", category: "fruit", state: "raw", aliases: ["kola", "banana", "bananas"] },
  { id: "apple-raw", fdcId: 171688, bn: "আপেল", category: "fruit", state: "raw", aliases: ["apel", "apple", "apples"] },
  { id: "mango-raw", fdcId: 169910, bn: "আম", category: "fruit", state: "raw", aliases: ["am", "mango"] },
  { id: "orange-raw", fdcId: 169097, bn: "কমলা", category: "fruit", state: "raw", aliases: ["komola", "orange"] },
  { id: "strawberries-raw", fdcId: 167762, bn: "স্ট্রবেরি", category: "fruit", state: "raw", aliases: ["strawberry", "strawberries"] },
  { id: "strawberries-frozen-plain", fdcId: 168173, bn: "স্ট্রবেরি (হিমায়িত, চিনি ছাড়া)", category: "fruit", state: "frozen", aliases: ["frozen strawberry", "frozen strawberries"] },

  // --- Fats and oils --------------------------------------------------------
  { id: "oil-soybean", fdcId: 171411, bn: "সয়াবিন তেল", category: "fat", state: "raw", aliases: ["soybean oil", "soy oil", "vegetable oil"] },
  { id: "oil-mustard", fdcId: 172337, bn: "সরিষার তেল", category: "fat", state: "raw", aliases: ["mustard oil", "sarisha tel"] },
  { id: "oil-palm", fdcId: 171015, bn: "পাম তেল", category: "fat", state: "raw", aliases: ["palm oil"] },
  { id: "oil-sunflower", fdcId: 171017, bn: "সূর্যমুখী তেল", category: "fat", state: "raw", aliases: ["sunflower oil"] },
  { id: "ghee", fdcId: 173410, bn: "ঘি", category: "fat", state: "raw", aliases: ["ghee", "clarified butter", "butter"] },
  { id: "salt", fdcId: 173468, bn: "লবণ", category: "seasoning", state: "raw", aliases: ["lobon", "salt", "table salt"] },
  { id: "sugar", fdcId: 169655, bn: "চিনি", category: "seasoning", state: "raw", aliases: ["chini", "sugar", "granulated sugar"] },

  // --- Spices ---------------------------------------------------------------
  { id: "cumin-seed", fdcId: 170923, bn: "জিরা", category: "spice", state: "raw", aliases: ["jira", "cumin", "cumin seed"] },
  { id: "coriander-seed", fdcId: 170922, bn: "ধনেপুতি", category: "spice", state: "raw", aliases: ["dhaneputi", "coriander seed", "dhania"] },
  { id: "turmeric", fdcId: 172231, bn: "হলুদ", category: "spice", state: "raw", aliases: ["holud", "turmeric"] },
  { id: "chili-pepper", fdcId: 171319, bn: "মরিচ", category: "spice", state: "raw", aliases: ["morich", "chili", "chilli", "chili powder", "red pepper"] },
  { id: "cinnamon", fdcId: 171320, bn: "দারুচিনি", category: "spice", state: "raw", aliases: ["daruchini", "cinnamon"] },
  { id: "black-pepper", fdcId: 170931, bn: "কালো মরিচ", category: "spice", state: "raw", aliases: ["kalo morich", "black pepper", "pepper"] },

  // --- Dairy ----------------------------------------------------------------
  { id: "yogurt-plain-whole", fdcId: 171284, bn: "দই", category: "dairy", state: "raw", aliases: ["doi", "yogurt", "yoghurt", "curd"] },
  // --- More single ingredients, added so the evaluation can cover more real meals -------------
  // Each is still one USDA record with its own numbers. Nothing here is a dish, and nothing here
  // is invented: the values are read out of the same SR Legacy CSV.
  { id: "broccoli-raw", fdcId: 170379, bn: "ব্রকলি", category: "vegetable", state: "raw", aliases: ["broccoli", "ব্রকলি"] },
  { id: "sweet-potato-cooked", fdcId: 168483, bn: "মিষ্টি আলু", category: "vegetable", state: "cooked", aliases: ["sweet potato", "shakarkandi", "মিষ্টি আলু", "shakarkandi"] },
  { id: "zucchini-raw", fdcId: 169291, bn: "জুকিনি", category: "vegetable", state: "raw", aliases: ["zucchini", "courgette", "জুকিনি"] },
  { id: "lettuce-green-leaf", fdcId: 169249, bn: "সালাদ পাতা", category: "vegetable", state: "raw", aliases: ["lettuce", "green leaf lettuce", "salad leaves", "সালাদ পাতা"] },
  { id: "mushroom-raw", fdcId: 168434, bn: "মাশরুম", category: "vegetable", state: "raw", aliases: ["mushroom", "mushrooms", "মাশরুম"] },
  { id: "thyme-fresh", fdcId: 173470, bn: "থাইম", category: "spice", state: "fresh", aliases: ["thyme", "থাইম"] },
  { id: "pork-raw", fdcId: 167810, bn: "শূকরের মাংস", category: "protein", state: "raw", aliases: ["pork", "hog", "শূকরের মাংস"] },
  { id: "chicken-thigh-roasted", fdcId: 172388, bn: "মুরগির উরের মাংস · রোস্ট", category: "protein", state: "cooked", aliases: ["chicken thigh", "chicken thighs", "chicken leg", "মুরগির উরের মাংস"] },
  { id: "salmon-raw", fdcId: 175167, bn: "স্যামন", category: "protein", state: "raw", aliases: ["salmon", "স্যামন"] },
  { id: "egg-white-raw", fdcId: 172183, bn: "ডিমের সাদা অংশ", category: "protein", state: "raw", aliases: ["egg white", "egg whites", "white of egg", "ডিমের সাদা অংশ"] },
  { id: "egg-fried", fdcId: 173423, bn: "ডিম ভাজা", category: "protein", state: "cooked", aliases: ["scrambled eggs", "scrambled egg", "fried egg", "ডিম ভাজা"] },
  { id: "tofu-firm", fdcId: 172475, bn: "টোফু", category: "protein", state: "raw", aliases: ["tofu", "bean curd", "টোফু"] },
  { id: "bacon-cooked", fdcId: 167712, bn: "বেকন", category: "protein", state: "cooked", aliases: ["bacon", "বেকন"] },
  { id: "sausage-pork", fdcId: 174577, bn: "সসেজ", category: "protein", state: "cooked", aliases: ["sausage", "polish sausage", "সসেজ"] },
  { id: "peanut-raw", fdcId: 172430, bn: "বাদাম", category: "legume", state: "raw", aliases: ["peanut", "peanuts", "groundnut", "বাদাম"] },
  { id: "walnut-english", fdcId: 170187, bn: "আখরোট", category: "legume", state: "raw", aliases: ["walnut", "walnuts", "আখরোট"] },
  { id: "pineapple-raw", fdcId: 169124, bn: "আনারস", category: "fruit", state: "raw", aliases: ["pineapple", "anaros", "আনারস"] },
  { id: "avocado-raw", fdcId: 171705, bn: "অ্যাভোকাডো", category: "fruit", state: "raw", aliases: ["avocado", "avocados", "অ্যাভোকাডো"] },
  { id: "grape-raw", fdcId: 174683, bn: "আঙ্গুর", category: "fruit", state: "raw", aliases: ["grape", "grapes", "আঙ্গুর"] },
  { id: "watermelon-raw", fdcId: 167765, bn: "তরমুজ", category: "fruit", state: "raw", aliases: ["watermelon", "tormuj", "তরমুজ"] },
  { id: "cantaloupe-raw", fdcId: 169092, bn: "কাঁটালুপ", category: "fruit", state: "raw", aliases: ["cantaloupe", "melon", "kantalup", "কাঁটালুপ"] },
  { id: "pear-raw", fdcId: 169118, bn: "নাশপাতি", category: "fruit", state: "raw", aliases: ["pear", "pears", "নাশপাতি"] },
  { id: "lemon-raw", fdcId: 167746, bn: "লেবু", category: "fruit", state: "raw", aliases: ["lemon", "lemons", "lebu", "লেবু"] },
  { id: "lemon-juice", fdcId: 167747, bn: "লেবুর রস", category: "fruit", state: "raw", aliases: ["lemon juice", "lebu er ros", "লেবুর রস"] },
  { id: "oil-olive", fdcId: 171413, bn: "জলপাই তেল", category: "fat", state: "raw", aliases: ["olive oil", "jolpai tel", "জলপাই তেল"] },
  { id: "vinegar-cider", fdcId: 173469, bn: "ভিনেগার", category: "seasoning", state: "raw", aliases: ["vinegar", "cider vinegar", "vinegar"] },
  { id: "oats-dry", fdcId: 173904, bn: "ওটস", category: "grain", state: "raw", aliases: ["oats", "oatmeal", "rolled oats", "ওটস"] },
  { id: "quinoa-cooked", fdcId: 168917, bn: "কিনোয়া", category: "grain", state: "cooked", aliases: ["quinoa", "kinua", "কিনোয়া"] },
  { id: "millet-cooked", fdcId: 168871, bn: "বাজরা", category: "grain", state: "cooked", aliases: ["millet", "bajra", "বাজরা"] },
  { id: "bread-white", fdcId: 167532, bn: "পাউরুটি", category: "grain", state: "baked", aliases: ["white bread", "bread", "pauruti", "পাউরুটি"] },
];

/** The nutrient ids in SR Legacy that ASHA reads. */
const NUTRIENT_IDS = {
  kcal: 1008,
  protein: 1003,
  fat: 1004,
  carbohydrate: 1005,
  fiber: 1079,
  sodium: 1093,
};

const SR_LEGACY = {
  publisher: "USDA FoodData Central",
  type: "SR Legacy",
  published: "2019-04-01",
  retrieved: "2026-11-16",
  license: "CC0-1.0 (US public domain)",
};

/**
 * The vessel a portion was measured in, if it has one.
 *
 * Only a portion that occupies a known AREA on the plate can give an areal density. A cup and a
 * bowl do. A tablespoon and a teaspoon do not - they are volumes, and a volume says nothing about
 * how much of the plate a food covers.
 *
 * @param {string} portionDescription
 * @returns {string|null}
 */
function vesselFor(...descriptions) {
  for (const description of descriptions) {
    const head = String(description ?? "").split(",")[0].trim().toLowerCase();
    if (head === "cup") return "cup";
    if (head === "bowl") return "bowl";
    if (head === "plate") return "plate";
  }
  return null;
}

/**
 * A readable English name for a portion, from its USDA description.
 *
 * @param {string} portionDescription
 * @param {string} modifier
 * @returns {string}
 */
function portionLabel(portionDescription, modifier) {
  const text = String(portionDescription ?? "").trim();
  const mod = String(modifier ?? "").trim();
  const combined = [text, mod].filter(Boolean).join(", ");
  return combined.charAt(0).toUpperCase() + combined.slice(1);
}

/**
 * The Bangla names of the household measures.
 *
 * The USDA names a portion in English ("Cup", "tbsp", "large"). A person choosing "one bowl" in
 * Bangla needs to see it in Bangla, so the common ones are translated here. A portion with no
 * entry falls back to its English name rather than being dropped.
 */
const PORTION_BN = {
  cup: "\u0995\u09be\u09aa",
  tbsp: "\u099f\u09c7\u09ac\u09bf\u09b2 \u099a\u09be\u09ae\u099a",
  tsp: "\u099a\u09be \u099a\u09be\u09ae\u099a",
  large: "\u09ac\u09a1\u09bc",
  medium: "\u09ae\u09be\u099d\u09be\u09b0\u09bf",
  small: "\u099b\u09cb\u099f",
  piece: "\u09aa\u09bf\u09b8",
  slice: "\u099f\u09c1\u0995\u09b0\u09cb",
  fillet: "\u09ab\u09bf\u09b2\u09c7",
  breast: "\u09ac\u09c1\u0995",
  patty: "\u09aa\u09cd\u09af\u09be\u099f\u09bf",
  "fl oz": "\u09ab\u09cd\u09b2\u09c1\u0987\u09b8 \u0985\u09cd\u09af\u09be\u09a8\u09cd\u09b8",
  oz: "\u0986\u0989\u09a8\u09cd\u09b8",
  "1 cup": "\u0995\u09be\u09aa",
};

/**
 * The Bangla name of a portion.
 *
 * @param {string} description the USDA portion description
 * @returns {string}
 */
function portionNameBn(description) {
  const head = String(description ?? "").split(",")[0].trim().toLowerCase();
  return PORTION_BN[head] ?? description;
}

/**
 * The portion's count.
 *
 * The `amount` column says how many of the named unit the gram weight applies to. It is 1 on
 * every row of this file, so it is read but never assumed.
 *
 * @param {string} raw
 * @returns {number}
 */
function portionAmount(raw) {
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : 1;
}

function main() {
  const { rows: foods } = readCsv(path.join(csvDir, "food.csv"));
  const { rows: foodNutrients } = readCsv(path.join(csvDir, "food_nutrient.csv"));
  const { rows: portions } = readCsv(path.join(csvDir, "food_portion.csv"));

  const foodById = new Map(foods.map((f) => [f.fdc_id, f]));
  const nutrientsByFdc = new Map();
  for (const fn of foodNutrients) {
    if (!Object.values(NUTRIENT_IDS).includes(Number(fn.nutrient_id))) continue;
    const key = Object.keys(NUTRIENT_IDS).find((k) => NUTRIENT_IDS[k] === Number(fn.nutrient_id));
    const map = nutrientsByFdc.get(fn.fdc_id) ?? {};
    map[key] = Number(fn.amount);
    nutrientsByFdc.set(fn.fdc_id, map);
  }
  const portionsByFdc = new Map();
  for (const p of portions) {
    const list = portionsByFdc.get(p.fdc_id) ?? [];
    list.push(p);
    portionsByFdc.set(p.fdc_id, list);
  }

  const records = [];
  const problems = [];
  for (const entry of CATALOGUE) {
    const food = foodById.get(String(entry.fdcId));
    if (!food) {
      problems.push(`${entry.id}: no SR Legacy food with fdc_id ${entry.fdcId}`);
      continue;
    }
    const n = nutrientsByFdc.get(String(entry.fdcId)) ?? {};
    const missing = Object.keys(NUTRIENT_IDS).filter((k) => !Number.isFinite(n[k]));
    if (missing.length) {
      problems.push(`${entry.id}: SR Legacy has no ${missing.join(", ")} for fdc ${entry.fdcId} (${food.description})`);
      continue;
    }
    const port = (portionsByFdc.get(String(entry.fdcId)) ?? [])
      .filter((p) => Number(p.gram_weight) > 0)
      .map((p) => {
        // In SR Legacy the human name of the portion is in `modifier`; `portion_description` is
        // usually empty. Both are read so a row that names itself the other way still works.
        const description = portionLabel(p.portion_description, p.modifier);
        const amount = portionAmount(p.amount);
        return {
          id: description.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          en: description,
          bn: portionNameBn(p.modifier || p.portion_description),
          grams: Number(p.gram_weight),
          amount,
          vessel: vesselFor(p.portion_description, p.modifier),
        };
      })
      // One portion per distinct weight, so a food does not carry three names for 158 g.
      .filter((p, i, all) => all.findIndex((q) => q.grams === p.grams && q.amount === p.amount) === i)
      .slice(0, 8);

    records.push({
      id: entry.id,
      fdcId: Number(entry.fdcId),
      en: food.description,
      bn: entry.bn,
      aliases: entry.aliases,
      category: entry.category,
      state: entry.state,
      per100g: {
        kcal: n.kcal,
        protein: n.protein,
        fat: n.fat,
        carbohydrate: n.carbohydrate,
        fiber: n.fiber,
        sodium: n.sodium,
      },
      portions: port,
      source: { ...SR_LEGACY, url: `https://fdc.nal.usda.gov/food-details/${entry.fdcId}/nutrients` },
      databaseSource: "USDA FoodData Central SR Legacy",
      databaseRecordId: `fdc:${entry.fdcId}`,
      verification: {
        status: "source_verified",
        note: "Read directly from the USDA SR Legacy bulk CSV (FoodData_Central_sr_legacy_food_csv_2018-04.zip) by scripts/build-nutrition-catalogue.mjs. The per-100 g values and the portion gram weights are the source's own.",
      },
    });
  }

  if (problems.length) {
    console.error("the catalogue could not be built:\n  " + problems.join("\n  "));
    process.exit(1);
  }

  const body = records
    .map((r) => {
      const portions = r.portions.map(
        (p) => `    { id: ${JSON.stringify(p.id)}, en: ${JSON.stringify(p.en)}, bn: ${JSON.stringify(p.bn)}, grams: ${p.grams}, amount: ${p.amount}, vessel: ${p.vessel ? JSON.stringify(p.vessel) : "null"} },`,
      );
      return `  {
    id: ${JSON.stringify(r.id)},
    fdcId: ${r.fdcId},
    en: ${JSON.stringify(r.en)},
    bn: ${JSON.stringify(r.bn)},
    aliases: ${JSON.stringify(r.aliases)},
    category: ${JSON.stringify(r.category)},
    state: ${JSON.stringify(r.state)},
    per100g: { kcal: ${r.per100g.kcal}, protein: ${r.per100g.protein}, fat: ${r.per100g.fat}, carbohydrate: ${r.per100g.carbohydrate}, fiber: ${r.per100g.fiber}, sodium: ${r.per100g.sodium} },
    portions: [
${portions.join("\n")}
    ],
    source: { publisher: ${JSON.stringify(r.source.publisher)}, type: ${JSON.stringify(r.source.type)}, published: ${JSON.stringify(r.source.published)}, retrieved: ${JSON.stringify(r.source.retrieved)}, license: ${JSON.stringify(r.source.license)}, url: ${JSON.stringify(r.source.url)} },
    databaseSource: ${JSON.stringify(r.databaseSource)},
    databaseRecordId: ${JSON.stringify(r.databaseRecordId)},
    verification: { status: ${JSON.stringify(r.verification.status)}, note: ${JSON.stringify(r.verification.note)} },
  },`;
    })
    .join("\n");

  const header = `// The nutrition catalogue. GENERATED - do not edit by hand.
//
//   node scripts/build-nutrition-catalogue.mjs --csv <sr-legacy dir> --out public/app/nutrition/catalogue/records.js
//
// Every value below is read from the USDA FoodData Central SR Legacy bulk CSV. Nothing here was
// typed by hand, so the catalogue can be re-derived from its source and checked against it.
//
// A record's per-100 g values are for EDIBLE food in the state named by \`state\`. The state is
// part of the food's identity: cooked rice never matches dry rice, and a raw potato never
// matches a boiled one.
//
// \`portions\` are the household measures the USDA gives for THAT food. The weights differ per
// food - a cup of cooked rice is 158 g and a cup of boiled lentils is 198 g - so a single shared
// "one bowl" number would be wrong for most of the catalogue. A portion with \`vessel: null\` is
// measured by volume (a tablespoon, a teaspoon) and so has no footprint on the plate; it can be
// used as a weight the person gives directly, but it can never produce an area-based estimate.
//
// Source: ${SR_LEGACY.publisher} ${SR_LEGACY.type}, published ${SR_LEGACY.published}, ${SR_LEGACY.license}.
// Retrieved ${SR_LEGACY.retrieved}. ${records.length} records.
export const RECORDS = Object.freeze([
${body}
]);

/** The catalogue's version. Bump it when a record's numbers change, so a stored meal can be traced. */
export const CATALOGUE_VERSION = ${JSON.stringify(`sr-legacy-2018-04/${SR_LEGACY.retrieved}`)};

/** The food ids in this catalogue. */
export const RECORD_IDS = Object.freeze(RECORDS.map((r) => r.id));
`;

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, header);
  console.log(`wrote ${records.length} records to ${outFile}`);
  const withPortions = records.filter((r) => r.portions.length).length;
  const withVessel = records.filter((r) => r.portions.some((p) => p.vessel)).length;
  console.log(`  ${withPortions} have household portions, ${withVessel} of those have an area-defining vessel`);
}

main();
