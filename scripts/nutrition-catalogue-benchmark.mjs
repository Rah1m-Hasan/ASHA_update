// The headline benchmark: does ASHA's catalogue and calculator reproduce the numbers of real
// meals?
//
//   node scripts/nutrition-catalogue-benchmark.mjs [--meta datasets/nutrition5k/metadata.csv]
//
// WHAT THIS MEASURES
//
// Nutrition5k (ai5labsOfficial/nutrition5k, CC-BY-4.0) is a capture-rig dataset of 3,490 real
// cafeteria plates. Every row gives the plate's ingredient list with the weight of each
// ingredient in grams, and the plate's total calories, fat, carbohydrate and protein.
//
// The test is deliberately NOT about the camera. It takes the ground-truth ingredient weights,
// feeds them through ASHA's own catalogue and calculator exactly as a confirmed meal would be
// fed, and compares the result with the plate's recorded numbers.
//
// WHAT THE NUMBERS MEAN, PRECISELY
//
// Nutrition5k's totals were computed by the dataset's own recipe database, which uses USDA
// values of its own vintage. So this measures: "how far is ASHA's catalogue+engine from
// Nutrition5k's recipe database?" It is a measure of the ESTIMATOR against an independent
// reference, not a measure of physical truth. A large disagreement means one of the two is
// using different ingredients, different states or different weights - which is exactly what
// the report has to say.
//
// ONLY meals whose EVERY ingredient maps to a catalogue record are used, because a partial meal
// cannot be compared with a whole plate. The number of meals that qualify is printed.
//
// LEAKAGE
//
// The catalogue is built from USDA SR Legacy. Nutrition5k's reference numbers come from the
// dataset's own recipe file. The two are different sources, so nothing here is fitted: the
// ingredient map below was written by matching names, and the weights come from the dataset.

import fs from "node:fs";
import path from "node:path";
import { calculateMeal } from "../public/app/nutrition/engine.js";
import { RECORDS } from "../public/app/nutrition/catalogue/index.js";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const metaFile = path.resolve(arg("--meta", "datasets/nutrition5k/metadata.csv"));

/**
 * The ingredient map.
 *
 * A value of `{id}` is the same food. `{id, proxy: true}` is a NEARER NEIGHBOUR standing in for
 * a food the catalogue does not hold: the benchmark counts those separately and the report says
 * so, because a proxy inflates the error and hiding it would be dishonest.
 */
const MAP = {
  "cherry tomatoes": { id: "tomato-raw" },
  "roasted potatoes": { id: "potato-boiled" },
  "mashed potatoes": { id: "potato-boiled" },
  "spinach (raw)": { id: "spinach-raw" },
  "spinach (cooked)": { id: "spinach-raw", proxy: true },
  "mixed greens": { id: "lettuce-green-leaf", proxy: true },
  arugula: { id: "lettuce-green-leaf", proxy: true },
  "bok choy": { id: "cabbage-raw", proxy: true },
  yam: { id: "sweet-potato-cooked", proxy: true },
  "brown rice": { id: "rice-cooked", proxy: true },
  "wild rice": { id: "rice-cooked", proxy: true },
  "country rice": { id: "rice-cooked" },
  steak: { id: "beef-roasted" },
  brisket: { id: "beef-roasted", proxy: true },
  "grilled chicken": { id: "chicken-roasted" },
  "chicken thighs": { id: "chicken-thigh-roasted" },
  "ground turkey": { id: "chicken-roasted", proxy: true },
  turkey: { id: "chicken-roasted", proxy: true },
  "turkey bacon": { id: "bacon-cooked", proxy: true },
  bacon: { id: "bacon-cooked" },
  "chicken apple sausage": { id: "sausage-pork", proxy: true },
  sausage: { id: "sausage-pork" },
  eggs: { id: "egg-hard-boiled" },
  "poached eggs": { id: "egg-hard-boiled", proxy: true },
  omelets: { id: "egg-fried", proxy: true },
  "greek yogurt": { id: "yogurt-plain-whole" },
  "frozen yogurt": { id: "yogurt-plain-whole", proxy: true },
  "mandarin oranges": { id: "orange-raw" },
  "orange with peel": { id: "orange-raw" },
  lime: { id: "lemon-raw", proxy: true },
  bagels: { id: "bread-white", proxy: true },
  toast: { id: "bread-white", proxy: true },
  "white bread": { id: "bread-white" },
  "wheat bread": { id: "bread-white", proxy: true },
  "multigrain bread": { id: "bread-white", proxy: true },
  "pita bread": { id: "bread-white", proxy: true },
  "flatbread": { id: "bread-white", proxy: true },
  "blueberries": { id: "strawberries-raw", proxy: true },
  raspberries: { id: "strawberries-raw", proxy: true },
  blackberries: { id: "strawberries-raw", proxy: true },
  berries: { id: "strawberries-raw", proxy: true },
  "white beans": { id: "chickpeas-boiled", proxy: true },
  "black beans": { id: "kidney-beans-boiled", proxy: true },
  "pinto beans": { id: "kidney-beans-boiled", proxy: true },
  "baby carrots": { id: "carrot-raw" },
  "sun dried tomatoes": { id: "tomato-raw", proxy: true },
  scallions: { id: "onion-raw", proxy: true },
  "green onions": { id: "onion-raw", proxy: true },
  "chive": { id: "onion-raw", proxy: true },
  "cilantro": { id: "parsley-raw", proxy: true },
  "frozen strawberries": { id: "strawberries-frozen-plain" },
  "orange juice": { id: "orange-raw", proxy: true },
  "grapefruit juice": { id: "orange-raw", proxy: true },
  "apple cider": { id: "apple-raw", proxy: true },
  "raisins": { id: "strawberries-frozen-plain", proxy: true },
};

/**
 * The alias index: a catalogue record's own names.
 *
 * @returns {Map<string,string>}
 */
function aliasIndex() {
  const index = new Map();
  for (const record of RECORDS) {
    for (const key of [record.en, ...(record.aliases ?? [])]) {
      const normalised = String(key).toLowerCase().trim();
      if (normalised && !index.has(normalised)) index.set(normalised, record.id);
    }
  }
  return index;
}

/**
 * Split a CSV line, honouring quotes.
 *
 * @param {string} line
 * @returns {string[]}
 */
function splitLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Parse the metadata CSV.
 *
 * @param {string} file
 * @returns {Array<{dishId:string, kcal:number, fat:number, carb:number, protein:number, ingredients:Array<{name:string, grams:number}>}>}
 */
function readMetadata(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    if (cells.length < 7) continue;
    const ingredients = [];
    for (const part of (cells[6] ?? "").split(";")) {
      const [name, grams] = part.split(":");
      const value = Number(grams);
      if (!name || !Number.isFinite(value) || value <= 0) continue;
      ingredients.push({ name: name.trim().toLowerCase(), grams: value });
    }
    if (!ingredients.length) continue;
    rows.push({
      dishId: cells[0],
      kcal: Number(cells[1]),
      fat: Number(cells[3]),
      carb: Number(cells[4]),
      protein: Number(cells[5]),
      ingredients,
    });
  }
  return rows;
}

/**
 * The error statistics.
 *
 * @param {number[]} errors
 */
function stats(errors) {
  if (!errors.length) return { n: 0, mae: null, rmse: null, mape: null };
  const abs = errors.map((e) => Math.abs(e));
  const mae = abs.reduce((a, b) => a + b, 0) / abs.length;
  const rmse = Math.sqrt(errors.reduce((a, b) => a + b * b, 0) / errors.length);
  return { n: errors.length, mae, rmse };
}

const index = aliasIndex();
const rows = readMetadata(metaFile);

let exactMeals = 0;
let proxyMeals = 0;
let skippedMeals = 0;
const unmatched = new Map();
const errors = { kcal: [], fat: [], carb: [], protein: [] };
const proxyErrors = { kcal: [], fat: [], carb: [], protein: [] };

for (const row of rows) {
  const items = [];
  let usedProxy = false;
  let ok = true;
  for (const ingredient of row.ingredients) {
    const mapped = MAP[ingredient.name] ?? (index.has(ingredient.name) ? { id: index.get(ingredient.name) } : null);
    if (!mapped) {
      unmatched.set(ingredient.name, (unmatched.get(ingredient.name) ?? 0) + 1);
      ok = false;
      break;
    }
    if (mapped.proxy) usedProxy = true;
    items.push({ uid: `${ingredient.name}-${items.length}`, foodId: mapped.id, grams: ingredient.grams });
  }
  if (!ok) {
    skippedMeals += 1;
    continue;
  }
  const meal = calculateMeal(items);
  const target = { kcal: row.kcal, fat: row.fat, carb: row.carb, protein: row.protein };
  const bucket = usedProxy ? proxyErrors : errors;
  for (const key of Object.keys(errors)) {
    // The engine calls it "carbohydrate"; Nutrition5k calls it "carb_g".
    const engineKey = key === "carb" ? "carbohydrate" : key;
    const predicted = meal.total[engineKey];
    if (predicted === null || predicted === undefined) continue;
    bucket[key].push(predicted - target[key]);
  }
  if (usedProxy) proxyMeals += 1;
  else exactMeals += 1;
}

const totalMeals = exactMeals + proxyMeals;
console.log("Nutrition5k catalogue benchmark");
console.log("==============================");
console.log(`meals in the dataset:        ${rows.length}`);
console.log(`meals compared (exact map):  ${exactMeals}`);
console.log(`meals compared (with proxy): ${proxyMeals}`);
console.log(`meals skipped:               ${skippedMeals}`);
console.log(`meals compared in total:     ${totalMeals} (${((totalMeals / rows.length) * 100).toFixed(1)}% of the dataset)`);
console.log("");
console.log("Exact mappings only");
console.log("-------------------");
for (const key of ["kcal", "fat", "carb", "protein"]) {
  const s = stats(errors[key]);
  const unit = key === "kcal" ? "kcal" : "g";
  console.log(
    `  ${key.padEnd(8)} n=${String(s.n).padStart(4)}  MAE ${s.mae === null ? "n/a" : s.mae.toFixed(2)} ${unit}  RMSE ${s.rmse === null ? "n/a" : s.rmse.toFixed(2)} ${unit}`,
  );
}
console.log("");
console.log("Mappings that used a proxy food");
console.log("--------------------------------");
for (const key of ["kcal", "fat", "carb", "protein"]) {
  const s = stats(proxyErrors[key]);
  const unit = key === "kcal" ? "kcal" : "g";
  console.log(
    `  ${key.padEnd(8)} n=${String(s.n).padStart(4)}  MAE ${s.mae === null ? "n/a" : s.mae.toFixed(2)} ${unit}  RMSE ${s.rmse === null ? "n/a" : s.rmse.toFixed(2)} ${unit}`,
  );
}
console.log("");
console.log("Combined");
console.log("--------");
for (const key of ["kcal", "fat", "carb", "protein"]) {
  const s = stats([...errors[key], ...proxyErrors[key]]);
  const unit = key === "kcal" ? "kcal" : "g";
  console.log(
    `  ${key.padEnd(8)} n=${String(s.n).padStart(4)}  MAE ${s.mae === null ? "n/a" : s.mae.toFixed(2)} ${unit}  RMSE ${s.rmse === null ? "n/a" : s.rmse.toFixed(2)} ${unit}`,
  );
}
console.log("");
console.log(`Ingredients with no catalogue match: ${unmatched.size}`);
console.log(
  "  " +
    [...unmatched.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([name, count]) => `${name} (${count})`)
      .join(", "),
);
