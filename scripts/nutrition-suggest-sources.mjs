// Prints candidate USDA SR Legacy records for a list of search terms.
//
//   node scripts/nutrition-suggest-sources.mjs <csv-dir> <term> [<term>...]
//
// It prints, for each term, the records whose description contains it, with their per-100 g
// nutrients. It is a lookup helper for choosing records by hand; the choices are written into
// scripts/build-nutrition-catalogue.mjs and the numbers come out of the CSV, never out of here.
import path from "node:path";
import { readCsv } from "./lib/csv.mjs";

const args = process.argv.slice(2);
const csvDir = path.resolve(args[0] ?? "datasets/sr-legacy/FoodData_Central_sr_legacy_food_csv_2018-04");
const terms = args.slice(1);

const { rows: foods } = readCsv(path.join(csvDir, "food.csv"));
const { rows: nutrients } = readCsv(path.join(csvDir, "nutrient.csv"));
const { rows: foodNutrients } = readCsv(path.join(csvDir, "food_nutrient.csv"));

const NUTRIENT_IDS = { kcal: "1008", protein: "1003", fat: "1004", carbohydrate: "1005", fiber: "1079", sodium: "1093" };
const nutrientNames = new Map(nutrients.map((n) => [n.id, n]));

const byFood = new Map();
for (const fn of foodNutrients) {
  const wanted = Object.entries(NUTRIENT_IDS).find(([, id]) => id === fn.nutrient_id);
  if (!wanted) continue;
  if (fn.amount === "" || fn.amount === undefined) continue;
  if (!byFood.has(fn.fdc_id)) byFood.set(fn.fdc_id, {});
  byFood.get(fn.fdc_id)[wanted[0]] = Number(fn.amount);
}

for (const term of terms) {
  const needle = term.toLowerCase();
  const hits = foods.filter((f) => f.description.toLowerCase().includes(needle)).slice(0, 6);
  console.log(`\n=== ${term}`);
  for (const food of hits) {
    const values = byFood.get(food.fdc_id) ?? {};
    const parts = Object.entries(NUTRIENT_IDS).map(([key]) => `${key}=${values[key] ?? "?"}`);
    console.log(`  ${food.fdc_id} | ${food.description.slice(0, 78)} | ${parts.join(" ")}`);
  }
}
