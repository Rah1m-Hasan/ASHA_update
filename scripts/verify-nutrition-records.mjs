// Re-checks every ASHA Nutrition food record, portion weight and spoon weight against the official
// USDA FoodData Central API.
//
//   FDC_API_KEY=<key> node scripts/verify-nutrition-records.mjs
//
// DEMO_KEY works for a few calls (USDA rate-limits it). Prints each value next to the API's value
// and exits 1 on any mismatch, or 2 if the API can't be reached. Records marked "cross_checked" in
// src/features/nutrition/catalog.js can be marked "api_verified" (and their fibre filled in) only
// after this passes. Sends only FDC ids; no personal data.
import { FOOD_RECORDS, PORTIONS, SPOON_GRAMS } from "../src/features/nutrition/catalog.js";

const key = process.env.FDC_API_KEY || "DEMO_KEY";
const NUMBERS = { kcal: "208", protein: "203", fat: "204", carbohydrate: "205", fiber: "291", sodium: "307" };
const SPOON_RECORDS = { oil: 171411, sugar: 169655, salt: 173468 };
const close = (a, b) => Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 0.005);

async function food(fdcId) {
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(key)}&format=full`);
  if (!res.ok) throw new Error(`FDC ${fdcId}: HTTP ${res.status}`);
  return res.json();
}
const nutrient = (f, number) => f.foodNutrients?.find((n) => String(n.nutrient?.number ?? n.number) === number)?.amount ?? null;
const portionsOf = (f) => (f.foodPortions ?? []).map((p) => ({ text: `${p.amount ?? ""} ${p.modifier ?? ""} ${p.portionDescription ?? ""}`.trim(), grams: p.gramWeight }));

let failures = 0;
const report = (ok, line) => {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${line}`);
};

try {
  for (const r of FOOD_RECORDS) {
    const f = await food(r.fdcId);
    report(f.description === r.description, `${r.id} description: "${f.description}"`);
    for (const [k, num] of Object.entries(NUMBERS)) {
      const api = nutrient(f, num);
      const ours = r.per100g[k];
      if (ours === null) console.log(`info ${r.id}.${k}: ASHA has unknown, API says ${api}`);
      else report(api !== null && close(ours, api), `${r.id}.${k}: ASHA ${ours}, API ${api}`);
    }
    const ps = PORTIONS[r.id];
    if (ps) {
      const api = portionsOf(f);
      for (const p of ps) report(api.some((x) => close(p.grams, x.grams)), `${r.id} portion ${p.id} ${p.grams} g; API portions: ${api.map((x) => `${x.text}=${x.grams}`).join("; ")}`);
    }
  }
  for (const [kind, id] of Object.entries(SPOON_RECORDS)) {
    const api = portionsOf(await food(id));
    for (const [unit, grams] of Object.entries(SPOON_GRAMS[kind])) report(api.some((x) => close(grams, x.grams) && x.text.includes(unit)), `${kind} ${unit} ${grams} g; API: ${api.map((x) => `${x.text}=${x.grams}`).join("; ")}`);
  }
} catch (err) {
  console.error(`Could not reach the FoodData Central API: ${err.cause?.message || err.message}`);
  process.exit(2);
}
console.log(failures ? `\n${failures} mismatch(es).` : "\nAll records, portions and spoon weights match the API.");
process.exit(failures ? 1 : 0);
