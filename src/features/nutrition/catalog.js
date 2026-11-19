// ASHA Nutrition V5 food records and dishes. Every number here has a named source record.
//
// The eleven records already shipped with Everyday were checked against the USDA FoodData Central
// API when they were added, and are reused unchanged. The five records added for V5 (apple,
// strawberries fresh / frozen plain / frozen sweetened, uncooked rice) could not be fetched from
// the API in this build because the API host was blocked; their values were transcribed from two
// published copies of the same USDA data (the VA VistA nutrient file and FoodData Central SR
// Legacy CSV extracts), which agree. They are marked `cross_checked` and their fibre is left
// unknown until verified. `scripts/verify-nutrition-records.mjs` re-checks all of them against the API.
import { FOODS as EVERYDAY_FOODS, FOOD_DATA_VERSION as EVERYDAY_DATA_VERSION } from "../../../public/app/everyday/foods.js";

export const NUTRITION_DATA_VERSION = "asha-nutrition-v5/2026-11-10";
export const NUTRIENT_KEYS = Object.freeze(["kcal", "protein", "fat", "carbohydrate", "fiber", "sodium"]);
export const NUTRIENT_LABEL = Object.freeze({
  kcal: { en: "Energy", bn: "শক্তি", unit: "kcal" },
  protein: { en: "Protein", bn: "প্রোটিন", unit: "g" },
  fat: { en: "Fat", bn: "চর্বি", unit: "g" },
  carbohydrate: { en: "Carbohydrate", bn: "শর্করা", unit: "g" },
  fiber: { en: "Fibre", bn: "আঁশ", unit: "g" },
  sodium: { en: "Sodium", bn: "সোডিয়াম", unit: "mg" },
});

const SR_LEGACY = { publisher: "USDA FoodData Central", type: "SR Legacy", published: "2019-04-01", license: "CC0-1.0" };
// Food state is part of a record's identity: cooked rice is never matched to dry rice.
const EVERYDAY_STATE = {
  "rice-cooked": "cooked",
  "lentils-boiled": "cooked",
  "potato-boiled": "cooked",
  banana: "raw",
  "chicken-roasted": "cooked",
  "tilapia-cooked": "cooked",
  "carrot-raw": "raw",
  "spinach-raw": "raw",
  "soybean-oil": "as_sold",
  salt: "as_sold",
  sugar: "as_sold",
};

const fromEveryday = EVERYDAY_FOODS.map((f) =>
  Object.freeze({
    id: f.id,
    fdcId: f.fdcId,
    en: f.en,
    bn: f.bn,
    description: f.description,
    aliases: f.aliases,
    state: EVERYDAY_STATE[f.id] ?? "as_sold",
    per100g: f.per100g,
    source: f.source,
    databaseSource: "USDA FoodData Central SR Legacy",
    databaseRecordId: `fdc:${f.fdcId}`,
    dataVersion: EVERYDAY_DATA_VERSION,
    verification: { status: "api_verified", note: "Checked against the FoodData Central API when added to ASHA Everyday." },
  }),
);

function crossChecked(id, fdcId, en, bn, description, state, [kcal, protein, fat, carbohydrate, sodium], aliases = []) {
  return Object.freeze({
    id,
    fdcId,
    en,
    bn,
    description,
    aliases: Object.freeze(aliases),
    state,
    // Per 100 g edible food. Fibre is null (unknown) until verified against the API, never zero.
    per100g: Object.freeze({ kcal, protein, fat, carbohydrate, fiber: null, sodium }),
    source: Object.freeze({ ...SR_LEGACY, retrieved: "2026-11-10", url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients` }),
    databaseSource: "USDA FoodData Central SR Legacy",
    databaseRecordId: `fdc:${fdcId}`,
    dataVersion: NUTRITION_DATA_VERSION,
    verification: {
      status: "cross_checked",
      note: "Transcribed from two published copies of the USDA data that agree; not yet re-fetched from the FoodData Central API (host blocked in this build). Fibre left unknown.",
    },
  });
}

const added = [
  crossChecked("apple-raw", 171688, "Apple · raw, with skin", "আপেল · কাঁচা, খোসাসহ", "Apples, raw, with skin", "raw", [52, 0.26, 0.17, 13.81, 1], ["apple", "apel", "আপেল"]),
  crossChecked("strawberries-raw", 167762, "Strawberries · fresh", "স্ট্রবেরি · তাজা", "Strawberries, raw", "raw", [32, 0.67, 0.3, 7.68, 1], ["strawberry", "স্ট্রবেরি"]),
  crossChecked("strawberries-frozen-plain", 168173, "Strawberries · frozen, unsweetened", "স্ট্রবেরি · হিমায়িত, চিনি ছাড়া", "Strawberries, frozen, unsweetened", "frozen", [35, 0.43, 0.11, 9.13, 2], ["frozen strawberry"]),
  crossChecked("strawberries-frozen-sweetened", 168174, "Strawberries · frozen, sweetened, sliced", "স্ট্রবেরি · হিমায়িত, চিনিযুক্ত, টুকরো", "Strawberries, frozen, sweetened, sliced", "frozen", [96, 0.53, 0.13, 25.92, 3], ["sweetened strawberry"]),
  crossChecked("rice-raw", 168877, "Rice · uncooked (dry), white", "চাল · রান্নার আগে (শুকনো)", "Rice, white, long-grain, regular, raw, enriched", "dried", [365, 7.13, 0.66, 79.95, 5], ["chal", "চাল", "dry rice"]),
];

export const FOOD_RECORDS = Object.freeze([...fromEveryday, ...added]);
export const getRecord = (id) => FOOD_RECORDS.find((r) => r.id === id) ?? null;

/** USDA SR Legacy food portion weights (edible grams), cross-checked against a published copy. */
export const PORTION_SOURCE = "USDA SR Legacy food portion weights";
export const PORTIONS = Object.freeze({
  banana: [
    { id: "small", en: "Small (6–7 in long)", bn: "ছোট (৬–৭ ইঞ্চি)", grams: 101 },
    { id: "medium", en: "Medium (7–8 in long)", bn: "মাঝারি (৭–৮ ইঞ্চি)", grams: 118 },
    { id: "large", en: "Large (8–9 in long)", bn: "বড় (৮–৯ ইঞ্চি)", grams: 136 },
  ],
  "apple-raw": [
    { id: "small", en: "Small (2¾ in across)", bn: "ছোট (২¾ ইঞ্চি)", grams: 149 },
    { id: "medium", en: "Medium (3 in across)", bn: "মাঝারি (৩ ইঞ্চি)", grams: 182 },
    { id: "large", en: "Large (3¼ in across)", bn: "বড় (৩¼ ইঞ্চি)", grams: 223 },
  ],
  // SR Legacy food_portion for fdc 168878: 1 cup cooked rice = 158 g.
  "rice-cooked": [{ id: "cup", en: "Cup (about 240 ml)", bn: "কাপ (প্রায় ২৪০ মিলি)", grams: 158 }],
});
/** Spoon weights from the same USDA portion tables: soybean oil, granulated sugar, table salt. */
export const SPOON_GRAMS = Object.freeze({ oil: { tsp: 4.5, tbsp: 13.6 }, sugar: { tsp: 4.2 }, salt: { tsp: 6.0 } });

/**
 * What a person can log. `category` picks the questions (interview.js). Recipe dishes list the
 * whole-pot ingredients the questions fill in; nothing is added that the person didn't confirm,
 * except the ASHA template amounts named in `assumption`, which are shown and editable.
 */
export const DISHES = Object.freeze({
  banana: { id: "banana", category: "whole_fruit", en: "Banana", bn: "কলা", record: "banana", portions: "banana" },
  apple: { id: "apple", category: "whole_fruit", en: "Apple", bn: "আপেল", record: "apple-raw", portions: "apple-raw" },
  strawberries: { id: "strawberries", category: "frozen_fruit", en: "Strawberries", bn: "স্ট্রবেরি", records: { fresh: "strawberries-raw", frozen_plain: "strawberries-frozen-plain", frozen_sweetened: "strawberries-frozen-sweetened" } },
  rice: { id: "rice", category: "rice", en: "Rice", bn: "ভাত", records: { cooked: "rice-cooked", dry: "rice-raw" } },
  dal: {
    id: "dal",
    category: "curry",
    en: "Dal",
    bn: "ডাল",
    main: "lentils-boiled",
    bowlGrams: 100,
    assumption: { en: "One bowl of dal is taken as 100 g of boiled lentils (ASHA's template, not a measured value). Thin dal has less, thick dal more.", bn: "এক বাটি ডালে ১০০ গ্রাম সেদ্ধ ডাল ধরা হয়েছে (আশার নমুনা, মাপা নয়)। পাতলা ডালে কম, ঘন ডালে বেশি।" },
  },
  fish_curry: {
    id: "fish_curry",
    category: "curry",
    en: "Fish curry",
    bn: "মাছের ঝোল",
    main: "tilapia-cooked",
    side: "potato-boiled",
    assumption: { en: "Fish is counted with USDA's cooked tilapia values. Other fish differ; spices and water add little energy and are not counted.", bn: "মাছ USDA-র রান্না করা তেলাপিয়ার মান দিয়ে গোনা। অন্য মাছে মান আলাদা; মসলা ও পানির শক্তি সামান্য, গোনা হয়নি।" },
  },
  packaged: { id: "packaged", category: "packaged", en: "Packaged food", bn: "প্যাকেটজাত খাবার" },
  other: { id: "other", category: "unknown", en: "Something else", bn: "অন্য কিছু" },
});
export const dishLabel = (id, lang) => (lang === "bn" ? DISHES[id]?.bn : DISHES[id]?.en) ?? id;

/** Foods the "something else" search can find directly (simple foods with a single record). */
export const SIMPLE_FOODS = Object.freeze(["potato-boiled", "chicken-roasted", "tilapia-cooked", "carrot-raw", "spinach-raw", "lentils-boiled", "rice-cooked", "banana", "apple-raw", "strawberries-raw"]);

export function searchFoods(query = "") {
  const words = String(query).normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const dishes = Object.values(DISHES)
    .filter((d) => d.id !== "other")
    .filter((d) => words.every((w) => `${d.en} ${d.bn} ${d.id}`.toLocaleLowerCase().includes(w)))
    .map((d) => ({ kind: "dish", id: d.id, en: d.en, bn: d.bn }));
  const records = SIMPLE_FOODS.map(getRecord)
    .filter((r) => words.every((w) => `${r.en} ${r.bn} ${r.description} ${r.aliases.join(" ")}`.toLocaleLowerCase().includes(w)))
    .map((r) => ({ kind: "record", id: r.id, en: r.en, bn: r.bn }));
  return [...dishes, ...records].slice(0, 12);
}

/**
 * ASHA's on-device food recogniser: EfficientNetV2-B0 (ImageNet weights, Keras Applications, Apache-2.0)
 * with a classification head trained by ASHA on Open Images V7 photos (CC BY 2.0) for 34 foods plus
 * "not food". Measured on 4,951 held-out Open Images photos: 77.2% top-1, 96.8% top-5 (see
 * docs/NUTRITION_PUBLIC_DATA_VALIDATION.md). Public-photo accuracy is not clinical validation.
 *
 * Only the model's single best guess can become a suggestion, and only when it is at least
 * `minScore`. ASHA never skips past the best guess to a lower one it happens to have a record for:
 * that is how an orange used to be suggested as "apple" (the old general model's top label was
 * "orange", which ASHA ignored, and its lower "Granny Smith" label became apple).
 * Foods ASHA has no nutrition record for are named ("Looks like an orange") but never get numbers.
 */
export const FOOD_VISION = Object.freeze({
  modelId: "asha/food-effv2b0-oi35-int8",
  modelVersion: "2026-11-19",
  sha256: "c00a37dfe953870e139b962f2e79f53a539443a1c1d07b6fca5ef867545cb31a",
  bytes: 7122072,
  url: "/models/asha-food-35-int8.onnx",
  license: "Backbone Apache-2.0 (Keras Applications EfficientNetV2-B0); head trained by ASHA on Open Images V7 (CC BY 2.0 images, CC BY 4.0 labels)",
  experimental: true,
  input: Object.freeze({ size: 224, layout: "NHWC", range: "0-255 RGB" }),
  minScore: 0.5,
  // Output order of the model's probabilities. Never reorder without retraining.
  classes: Object.freeze(["apple", "banana", "bell_pepper", "bread", "cabbage", "cake", "carrot", "cauliflower", "chili", "cucumber", "curry", "grape", "grapefruit_pomelo", "hamburger", "lemon_lime", "milk", "noodles", "not_food", "omelette", "onion", "orange", "peach", "pear", "pineapple", "pizza", "pomegranate", "potato", "pumpkin", "rice", "salad", "sandwich", "strawberry", "tea", "tomato", "watermelon"]),
  // Recognised foods that ASHA can log with sourced nutrition.
  dishFor: Object.freeze({ apple: "apple", banana: "banana", strawberry: "strawberries", rice: "rice" }),
  labels: Object.freeze({
    apple: { en: "Apple", bn: "আপেল" }, banana: { en: "Banana", bn: "কলা" }, bell_pepper: { en: "Bell pepper (capsicum)", bn: "ক্যাপসিকাম" },
    bread: { en: "Bread", bn: "পাউরুটি" }, cabbage: { en: "Cabbage", bn: "বাঁধাকপি" }, cake: { en: "Cake", bn: "কেক" }, carrot: { en: "Carrot", bn: "গাজর" },
    cauliflower: { en: "Cauliflower", bn: "ফুলকপি" }, chili: { en: "Chilli", bn: "মরিচ" }, cucumber: { en: "Cucumber", bn: "শসা" }, curry: { en: "Curry", bn: "তরকারি" },
    grape: { en: "Grapes", bn: "আঙুর" }, grapefruit_pomelo: { en: "Grapefruit or pomelo (jambura)", bn: "জাম্বুরা" }, hamburger: { en: "Burger", bn: "বার্গার" },
    lemon_lime: { en: "Lemon or lime", bn: "লেবু" }, milk: { en: "Milk", bn: "দুধ" }, noodles: { en: "Noodles", bn: "নুডলস" }, not_food: { en: "Not a food", bn: "খাবার নয়" },
    omelette: { en: "Omelette", bn: "ডিম ভাজি / অমলেট" }, onion: { en: "Onion", bn: "পেঁয়াজ" }, orange: { en: "Orange (or malta)", bn: "কমলা / মাল্টা" }, peach: { en: "Peach", bn: "পীচ ফল" },
    pear: { en: "Pear", bn: "নাশপাতি" }, pineapple: { en: "Pineapple", bn: "আনারস" }, pizza: { en: "Pizza", bn: "পিৎজা" }, pomegranate: { en: "Pomegranate", bn: "ডালিম" },
    potato: { en: "Potato", bn: "আলু" }, pumpkin: { en: "Pumpkin", bn: "মিষ্টি কুমড়া" }, rice: { en: "Rice", bn: "ভাত" }, salad: { en: "Salad", bn: "সালাদ" },
    sandwich: { en: "Sandwich", bn: "স্যান্ডউইচ" }, strawberry: { en: "Strawberries", bn: "স্ট্রবেরি" }, tea: { en: "Tea", bn: "চা" }, tomato: { en: "Tomato", bn: "টমেটো" },
    watermelon: { en: "Watermelon", bn: "তরমুজ" },
  }),
});
/** The ASHA dish a recognised label maps to, or null when ASHA has no nutrition record for it. */
export const suggestionFor = (label) => FOOD_VISION.dishFor[label] ?? null;
/** Display name of a recogniser label (falls back to the raw label). */
export const visionLabel = (label, lang = "en") => FOOD_VISION.labels[label]?.[lang === "bn" ? "bn" : "en"] ?? label;
