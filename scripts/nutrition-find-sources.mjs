// Explores the USDA SR Legacy bulk CSV for the foods the Bangladeshi catalogue needs.
//
//   node scripts/nutrition-find-sources.mjs <csv-dir> "<search>" [...]
//
// Prints, for each search term, the matching SR Legacy foods with their fdc_id, description and
// their household portions. This is a lookup helper, not a build step: it is how a record was
// chosen rather than guessed, and the choices it prints are what scripts/build-nutrition-catalogue.mjs
// then pins.
import path from "node:path";
import { readCsv } from "./lib/csv.mjs";

const dir = process.argv[2];
const terms = process.argv.slice(3);
if (!dir || !terms.length) {
  console.error("usage: node scripts/nutrition-find-sources.mjs <csv-dir> <term> [...]");
  process.exit(1);
}

const { rows: foods } = readCsv(path.join(dir, "food.csv"));
const { rows: portions } = readCsv(path.join(dir, "food_portion.csv"));
const { rows: nutrients } = readCsv(path.join(dir, "nutrient.csv"));
const { rows: foodNutrients } = readCsv(path.join(dir, "food_nutrient.csv"));

const nutrientById = new Map(nutrients.map((n) => [n.id, n]));
const wanted = new Map(
  nutrients
    .filter((n) =>
      ["Protein", "Total lipid (fat)", "Carbohydrate, by difference", "Fiber, total dietary", "Sodium, Na"].includes(n.name) ||
      (n.name === "Energy" && String(n.unit_name).toUpperCase() === "KCAL"),
    )
    .map((n) => [n.id, n.name]),
);
const byFdc = new Map();
for (const fn of foodNutrients) {
  if (!wanted.has(fn.nutrient_id)) continue;
  const list = byFdc.get(fn.fdc_id) ?? [];
  list.push({ nutrient: wanted.get(fn.nutrient_id), amount: Number(fn.amount) });
  byFdc.set(fn.fdc_id, list);
}
const portionsByFdc = new Map();
for (const p of portions) {
  const list = portionsByFdc.get(p.fdc_id) ?? [];
  list.push(p);
  portionsByFdc.set(p.fdc_id, list);
}

for (const term of terms) {
  const needle = term.toLowerCase();
  const matches = foods.filter((f) => f.description.toLowerCase().includes(needle)).slice(0, 12);
  console.log(`\n=== ${term} (${matches.length} shown) ===`);
  for (const m of matches) {
    const n = byFdc.get(m.fdc_id) ?? [];
    const vals = n.map((x) => `${x.nutrient}=${x.amount}`).join(" ");
    console.log(`  fdc ${m.fdc_id}  ${m.description}`);
    console.log(`      ${vals}`);
    const ps = (portionsByFdc.get(m.fdc_id) ?? []).slice(0, 6);
    for (const p of ps) {
      console.log(`      portion: ${p.portion_description}${p.modifier ? " / " + p.modifier : ""} = ${p.gram_weight} g`);
    }
  }
}
