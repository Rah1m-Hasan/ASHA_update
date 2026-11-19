// The Nutrition meal store.
//
// THE RULE THIS FILE EXISTS TO ENFORCE
//
// The CLIENT NEVER SENDS NUTRITION NUMBERS. It sends the answers - which food, how much, how it
// was cooked - and this handler looks the food up in the catalogue and computes the nutrients
// itself, using the same calculator the browser previewed (public/app/nutrition/engine.js). A
// client that sends "kcal: 4000" gets that key rejected outright.
//
// WHY THE SERVER COMPUTES IT
//
// The browser's copy is a preview. The server's copy is the record. If they were computed
// separately they could disagree, and then a person's history would contain numbers the app never
// showed them. One calculator, called twice, gives the same number twice.
//
// WHAT IS STORED
//
// The answers, the computed nutrients, where each number came from (the catalogue record id and
// its version), and the fact that a person confirmed it. The photo is never uploaded and never
// stored - ASHA does not hold a copy of anybody's meal.
//
// WHAT IS REFUSED
//
// Any key that could carry an image, a nutrient value or a computed total is rejected. That is a
// whitelist, not a blacklist, so a new key cannot slip through.
import {
  begin,
  body,
  authenticate,
  clientIp,
  store,
  path,
  base,
  authFail,
} from "../lib/common.js";
import { hash } from "../lib/logic.js";
import { calculate, calculateMeal, NUTRIENT_KEYS } from "../../../public/app/nutrition/engine.js";
import { CATALOGUE_VERSION, isKnownFood } from "../../../public/app/nutrition/catalogue/index.js";

/**
 * The keys a meal payload may contain.
 *
 * Anything not on this list is refused. The list is short on purpose: a food, a weight, a
 * preparation, and the fact that a person confirmed it.
 */
const ALLOWED_ITEM_KEYS = new Set(["foodId", "grams", "method", "source"]);

/**
 * Keys that must never appear anywhere in the payload.
 *
 * A whitelist on the item keys is the main defence, but the payload may also carry top-level
 * fields, and those are checked by name too. The names cover the ways an image or a number can be
 * smuggled in.
 */
const FORBIDDEN_KEYS = new Set([
  "nutrients",
  "nutrient",
  "nutrition",
  "total",
  "totals",
  "kcal",
  "calories",
  "protein",
  "carbohydrate",
  "carb",
  "fat",
  "fiber",
  "sodium",
  "photo",
  "image",
  "images",
  "blob",
  "dataurl",
  "data_url",
  "base64",
  "pixels",
  "thumbnail",
  "canvas",
]);

/** The largest a meal item may weigh. */
const MAX_ITEM_GRAMS = 3000;

/** The most items one meal may hold. */
const MAX_ITEMS = 20;

/** How many meals a person may log in a day. */
const DAILY_MEAL_LIMIT = 20;

/**
 * Every forbidden key anywhere in the payload.
 *
 * @param {unknown} value
 * @param {string[]} path
 * @returns {string[]} the paths of the offending keys
 */
function findForbiddenKeys(value, path = []) {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => found.push(...findForbiddenKeys(entry, [...path, String(index)])));
    return found;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const here = [...path, key];
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) found.push(here.join("."));
      found.push(...findForbiddenKeys(child, here));
    }
  }
  return found;
}

/**
 * The portion methods ASHA accepts.
 *
 * "weighed" is a weight the person entered. "household_unit" is a named household measure.
 * "visual_estimate_confirmed" is a picture estimate the person accepted. The last one is only
 * allowed with the person having accepted it, and ASHA records that it was accepted.
 */
const PORTION_METHODS = new Set(["weighed", "household_unit", "visual_estimate_confirmed"]);

/**
 * A clean item, or a reason it was refused.
 *
 * @param {unknown} raw
 * @returns {{ok:true, item:object}|{ok:false, reason:string}}
 */
function cleanItem(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "An item was not an object." };
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_ITEM_KEYS.has(key)) return { ok: false, reason: `The field "${key}" is not accepted.` };
  }
  const foodId = typeof raw.foodId === "string" ? raw.foodId.trim() : "";
  if (!foodId) return { ok: false, reason: "A food was not named." };
  if (!isKnownFood(foodId)) return { ok: false, reason: `ASHA does not know the food "${foodId}".` };
  const grams = Number(raw.grams);
  if (!Number.isFinite(grams) || grams <= 0) return { ok: false, reason: "The amount must be more than zero." };
  if (grams > MAX_ITEM_GRAMS) return { ok: false, reason: `The amount must be under ${MAX_ITEM_GRAMS} g.` };
  const method = typeof raw.method === "string" ? raw.method : "weighed";
  if (!PORTION_METHODS.has(method)) return { ok: false, reason: `The method "${method}" is not one ASHA knows.` };
  const source = typeof raw.source === "string" ? raw.source.slice(0, 40) : null;
  return { ok: true, item: { foodId, grams: Math.round(grams * 10) / 10, method, source } };
}

export default async function handler(req, res) {
  if (!begin(req, res)) return;
  try {
    const b = req.method === "POST" ? body(req) : {};

    if (b.action === "list") {
      const id = b.patientId || req.query.patientId;
      const auth = await authenticate(req, id);
      if (!auth) return authFail(res);
      const { role } = auth;
      const files = await store.list(`${base(id)}/nutrition/meals/`);
      const meals = await Promise.all(files.map((f) => store.read(f)));
      const rows = meals
        .filter(Boolean)
        .filter((m) => (role === "caregiver" ? m.sharedWithCaregiver === true : true))
        .sort((a, b2) => String(b2.at).localeCompare(String(a.at)));
      return res.json({ meals: rows, count: rows.length });
    }

    if (b.action === "delete") {
      const id = b.patientId || req.query.patientId;
      const auth = await authenticate(req, id);
      if (!auth) return authFail(res);
      const { role } = auth;
      // Only the patient may delete their own meal. A caregiver can read a shared meal, but
      // deleting a person's record is not a caregiver's job.
      if (role !== "patient") return res.status(403).json({ error: "Only the person can remove a meal." });
      const mealId = typeof b.mealId === "string" ? b.mealId : "";
      if (!/^[a-z0-9-]{1,64}$/i.test(mealId)) return res.status(400).json({ error: "Which meal?" });
      const file = path(id, `nutrition/meals/${mealId}`);
      const existing = await store.read(file);
      if (!existing) return res.status(404).json({ error: "That meal is not in the history." });
      await store.write(`${base(id)}/nutrition/deleted/${mealId}.json`, { at: new Date().toISOString() });
      await store.remove([file]);
      return res.json({ ok: true, mealId });
    }

    if (b.action !== "log") {
      return res.status(400).json({ error: "Unknown action." });
    }

    const id = b.patientId || req.query.patientId;
    const auth = await authenticate(req, id);
    if (!auth) return authFail(res);
    const { role } = auth;
    if (role !== "patient") {
      return res.status(403).json({ error: "Only the person can log a meal." });
    }

    // A meal must be confirmed by the person before it is stored. An unconfirmed proposal is
    // never saved as a confirmed meal.
    if (b.confirmed !== true) {
      return res.status(400).json({ error: "A meal has to be confirmed before it is saved." });
    }

    // Nothing that looks like an image or a nutrient value may be in the payload at all.
    const forbidden = findForbiddenKeys(b);
    if (forbidden.length) {
      return res.status(400).json({ error: `The payload must not contain ${forbidden[0]}.` });
    }

    const rawItems = Array.isArray(b.items) ? b.items : [];
    if (!rawItems.length) return res.status(400).json({ error: "A meal needs at least one food." });
    if (rawItems.length > MAX_ITEMS) return res.status(400).json({ error: `A meal may hold up to ${MAX_ITEMS} foods.` });

    const items = [];
    const seenFoods = new Set();
    for (const raw of rawItems) {
      const cleaned = cleanItem(raw);
      if (!cleaned.ok) return res.status(400).json({ error: cleaned.reason });
      // The same food twice in one meal is a mistake in the payload, not a
      // fault on the server. It used to reach the calculator, which threw,
      // and the person was told the meal could not be saved.
      if (seenFoods.has(cleaned.item.foodId))
        return res.status(400).json({
          error: "The same food was added twice. Change its amount, or remove one of them.",
        });
      seenFoods.add(cleaned.item.foodId);
      items.push(cleaned.item);
    }

    // The daily budget, keyed by a hash of the caller's address. No patient data in the key.
    //
    // The budget lives under its own name. It used to share the limits
    // directory with the care-circle setup budget, so on a shared address
    // setting up a care circle spent the person's meal-logging allowance, and
    // logging meals spent the setup allowance.
    const ip = hash(clientIp(req));
    const today = new Date().toISOString().slice(0, 10);
    const bucket = `asha-live/limits/${today}/meals/${ip}/`;
    const quota = await store.list(bucket, 200);
    if (quota.length >= DAILY_MEAL_LIMIT) {
      return res.status(429).json({ error: "Too many meals logged today." });
    }

    // The server computes. The client's numbers are not used, because they were never sent.
    const meal = calculateMeal(items);
    const mealId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      id: mealId,
      at: new Date().toISOString(),
      status: meal.status,
      items: meal.items.map((item) => ({
        foodId: item.foodId,
        // The weight of the portion, which for a recipe is the dish's weight and not the weight
        // of its first ingredient.
        grams: item.portionGrams ?? null,
        method: items.find((i) => i.foodId === item.foodId)?.method ?? "weighed",
        nutrients: item.nutrients,
        databaseRecordId: item.databaseRecordId,
        kind: item.kind,
        assumptions: item.assumptions.map((a) => a.en),
      })),
      total: meal.total,
      counted: meal.counted,
      excluded: meal.excluded,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      dataVersion: CATALOGUE_VERSION,
      engineVersion: "asha-nutrition-catalogue/1.0.0",
      sharedWithCaregiver: b.shareWithCaregiver === true,
    };
    // An idempotent write: the same meal id always stores the same record.
    await store.write(path(id, `nutrition/meals/${mealId}`), record, true);
    await store.write(`${bucket}${mealId}.json`, { at: record.at });

    return res.json({ ok: true, meal: record });
  } catch (err) {
    console.error("nutrition handler failed", err);
    return res.status(500).json({ error: "The meal could not be saved." });
  }
}
