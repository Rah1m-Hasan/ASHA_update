// ASHA Nutrition V5 calculator. Deterministic: the same answers always give the same numbers, and
// every number comes from a named food record (catalog.js) or from a package label the person
// typed in. Nothing here looks at the photo. The classifier only suggests which food to ask about.
//
// Each value is a range {min, max}. min === max is a single estimate. max === null means "at least
// min": something that adds energy is known to be there but its amount is not. A nutrient that is
// null is unknown (for example sodium when the salt amount is unknown) and is never shown as zero.
import { DISHES, getRecord, NUTRIENT_KEYS, NUTRITION_DATA_VERSION, PORTIONS, PORTION_SOURCE, SPOON_GRAMS } from "./catalog.js";

export const ENGINE_VERSION = "asha-nutrition-engine/1.0.0";

/** Worst wins when an item or meal combines several of these. */
export const STATUS_ORDER = Object.freeze(["estimate", "range", "lower_bound", "uncertain", "unavailable"]);
const worse = (a, b) => STATUS_ORDER[Math.max(STATUS_ORDER.indexOf(a), STATUS_ORDER.indexOf(b))];

const t = (en, bn) => ({ en, bn });
const known = (a) => !!a && !a.dontKnow && !a.skipped;
const positive = (n) => Number.isFinite(n) && n > 0;
const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
const round1 = (n) => Math.round(n * 10) / 10;

/** Where a number came from, attached to every component. */
export function provenance(record) {
  return {
    foodId: record.id,
    label: t(record.en, record.bn),
    description: record.description,
    state: record.state,
    databaseSource: record.databaseSource,
    databaseRecordId: record.databaseRecordId,
    dataVersion: record.dataVersion,
    verification: record.verification.status,
    url: record.source.url,
  };
}

/** Oil, sugar and salt by the spoon, using USDA portion weights. Returns grams, 0 for "none", or null for unknown. */
export function spoonGrams(answer, kind) {
  if (!known(answer)) return null;
  if (answer.choice === "none") return 0;
  const per = SPOON_GRAMS[kind]?.[answer.choice];
  const n = num(answer.value);
  if (!per || !Number.isFinite(n) || n < 0) return null;
  return n * per;
}

function component({ foodIds, grams, role, scope = "plate", potGrams = null }) {
  const records = foodIds.map((id) => {
    const r = getRecord(id);
    if (!r) throw new RangeError(`Unknown food record: ${String(id).slice(0, 60)}`);
    return r;
  });
  const nutrients = {};
  for (const key of NUTRIENT_KEYS) {
    const per = records.map((r) => r.per100g[key]);
    if (per.some((v) => !Number.isFinite(v))) {
      nutrients[key] = null;
      continue;
    }
    nutrients[key] = {
      min: Math.min(...per.map((v) => (v * grams.min) / 100)),
      max: grams.max === null ? null : Math.max(...per.map((v) => (v * grams.max) / 100)),
    };
  }
  return { foodIds, role, scope, grams, potGrams, nutrients, sources: records.map(provenance) };
}

function labelComponent({ name, kcalPerServing, servings, extras }) {
  const nutrients = {};
  for (const key of NUTRIENT_KEYS) {
    const per = key === "kcal" ? kcalPerServing : num(extras?.[key]);
    nutrients[key] = Number.isFinite(per) && per >= 0 ? { min: per * servings, max: per * servings } : null;
  }
  const slug = String(name || "packaged").normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "-").slice(0, 60);
  return {
    foodIds: [],
    role: "label",
    scope: "plate",
    grams: Number.isFinite(num(extras?.servingGrams)) ? { min: num(extras.servingGrams) * servings, max: num(extras.servingGrams) * servings } : null,
    potGrams: null,
    nutrients,
    sources: [
      {
        foodId: null,
        label: t(name || "Packaged food", name || "প্যাকেটজাত খাবার"),
        description: "Values typed in from the package label",
        state: "as_sold",
        databaseSource: "Package label (entered by the person)",
        databaseRecordId: `label:${slug}`,
        dataVersion: null,
        verification: "entered_by_person",
        url: null,
      },
    ],
  };
}

const per100 = (id) => {
  const r = getRecord(id);
  return r ? { foodId: id, kcal: r.per100g.kcal, label: t(r.en, r.bn), databaseRecordId: r.databaseRecordId } : null;
};

/**
 * Turns one food's answers into components. Returns everything the item needs except the sums.
 * Questions live in interview.js; this only reads their answers.
 */
function buildComponents(item) {
  const dish = DISHES[item.dishId];
  const a = item.answers ?? {};
  const out = {
    components: [],
    assumptions: [],
    missingInputs: [],
    qualityFlags: [],
    notes: [],
    blocked: null, // "uncertain" or "unavailable" when no responsible number can be given
    unknownNutrients: {}, // key -> reason
    reference: null, // per-100 g figure shown when the amount is unknown
    canonical: {},
  };
  const missing = (key, why, status = "uncertain") => {
    out.missingInputs.push(key);
    out.notes.push(why);
    out.blocked = out.blocked ? worse(out.blocked, status) : status;
  };
  if (!dish) {
    missing("food", t("ASHA doesn't know which food this is.", "আশা জানে না এটি কোন খাবার।"), "unavailable");
    return out;
  }

  // Shared pot: oil and salt are asked for the whole pot, then divided by the person's share.
  const potShare = () => {
    const s = a.share;
    const made = num(s?.value), eaten = num(s?.value2);
    if (known(s) && positive(made) && Number.isFinite(eaten) && eaten >= 0 && eaten <= made) return eaten / made;
    return null;
  };
  const addPot = (role, foodId, potGrams, share, unknownNote) => {
    if (potGrams === null) return "unknown";
    if (potGrams === 0) return "none";
    if (share === null) {
      out.missingInputs.push("share");
      out.notes.push(t("The pot's servings are not known, so ASHA can't work out your share of the oil and salt.", "পাতিলে কত জনের খাবার ছিল জানা নেই, তাই তেল ও লবণে আপনার ভাগ বের করা যায়নি।"));
      out.components.push(component({ foodIds: [foodId], grams: { min: 0, max: role === "salt" ? 0 : null }, role, scope: "pot", potGrams }));
      if (role === "salt") out.unknownNutrients.sodium = unknownNote;
      return "share_unknown";
    }
    const g = potGrams * share;
    out.components.push(component({ foodIds: [foodId], grams: { min: g, max: g }, role, scope: "pot", potGrams }));
    return "counted";
  };

  if (dish.category === "whole_fruit") {
    const portions = PORTIONS[dish.portions] ?? [];
    const size = a.size;
    let grams = null;
    let count = 1;
    if (known(size) && size.choice === "grams") {
      const g = num(size.value);
      if (positive(g)) grams = { min: g, max: g };
      out.canonical = { servingUnit: "g", servingCount: null };
    } else {
      const c = a.count;
      if (known(c)) count = num(c.value ?? c.choice);
      if (!positive(count)) count = 1;
      const unknownCount = !known(a.count) && a.count !== undefined;
      const p = known(size) ? portions.find((x) => x.id === size.choice) : null;
      if (p) {
        grams = { min: p.grams * count, max: p.grams * count };
        out.assumptions.push(t(`${dish.en} sizes use USDA weights for the edible part: ${p.en.toLowerCase()} ≈ ${p.grams} g.`, `${dish.bn}: মাপ USDA-র খাওয়ার অংশের ওজনে, ${p.bn} ≈ ${p.grams} গ্রাম।`));
      } else if (portions.length) {
        const lo = portions[0], hi = portions[portions.length - 1];
        grams = { min: lo.grams * count, max: hi.grams * count };
        out.missingInputs.push("size");
        out.assumptions.push(t(`Size not given: the range covers USDA's ${lo.en.toLowerCase().split(" (")[0]} to ${hi.en.toLowerCase().split(" (")[0]} (${lo.grams}–${hi.grams} g each). A very small or very large one falls outside it.`, `মাপ জানা নেই: সীমাটি USDA-র ছোট থেকে বড় (প্রতিটি ${lo.grams}–${hi.grams} গ্রাম)। খুব ছোট বা খুব বড় হলে এর বাইরে পড়বে।`));
      }
      if (unknownCount) {
        out.missingInputs.push("count");
        if (grams) grams = { min: grams.min, max: null };
        out.notes.push(t("How many is not known, so this counts one and shows “at least”.", "কয়টি জানা নেই, তাই একটি ধরে “অন্তত” দেখানো হয়েছে।"));
      }
      out.canonical = { servingUnit: p?.id ?? "piece", servingCount: count };
    }
    if (!grams) {
      out.reference = per100(dish.record);
      missing("amount", t("The amount is not known.", "পরিমাণ জানা নেই।"));
    } else out.components.push(component({ foodIds: [dish.record], grams, role: "main" }));
    out.canonical.state = getRecord(dish.record)?.state;
    return out;
  }

  if (dish.category === "frozen_fruit") {
    const kind = a.kind;
    let ids;
    if (known(kind) && dish.records[kind.choice]) ids = [dish.records[kind.choice]];
    else {
      ids = Object.values(dish.records);
      out.missingInputs.push("kind");
      out.assumptions.push(t("Not known whether sugar or syrup was added at the factory: the range runs from plain to sweetened strawberries.", "কারখানায় চিনি বা সিরাপ দেওয়া কিনা জানা নেই: সীমাটি চিনি ছাড়া থেকে চিনিযুক্ত স্ট্রবেরি পর্যন্ত।"));
    }
    const g = known(a.grams) ? num(a.grams.value) : NaN;
    if (!positive(g)) {
      out.reference = per100(ids[ids.length - 1]);
      missing("amount", t("The amount is not known. ASHA has no checked cup weight for strawberries yet, so it needs grams.", "পরিমাণ জানা নেই। স্ট্রবেরির কাপের যাচাই করা ওজন আশার কাছে এখনো নেই, তাই গ্রাম দরকার।"));
    } else out.components.push(component({ foodIds: ids, grams: { min: g, max: g }, role: "main" }));
    const sugar = spoonGrams(a.sugar, "sugar");
    if (sugar === null && a.sugar !== undefined) {
      out.missingInputs.push("addedSugar");
      out.components.push(component({ foodIds: ["sugar"], grams: { min: 0, max: null }, role: "added_sugar" }));
      out.notes.push(t(`Added sugar is not known. Each teaspoon adds about ${Math.round((SPOON_GRAMS.sugar.tsp * getRecord("sugar").per100g.kcal) / 100)} kcal.`, `যোগ করা চিনি জানা নেই। প্রতি চা-চামচে প্রায় ${Math.round((SPOON_GRAMS.sugar.tsp * getRecord("sugar").per100g.kcal) / 100)} কিলোক্যালরি বাড়ে।`));
    } else if (sugar > 0) out.components.push(component({ foodIds: ["sugar"], grams: { min: sugar, max: sugar }, role: "added_sugar" }));
    out.canonical = { state: getRecord(ids[0]).state, servingUnit: "g", servingCount: null, addedSugarGrams: sugar };
    // Storage answers are kept for the tips only. They never reach the numbers above.
    if (known(a.storageTips) && a.storageTips.choice === "yes") out.storage = { frozenFor: a.frozenFor?.choice ?? null, freezerTemp: a.freezerTemp?.choice ?? null };
    return out;
  }

  if (dish.category === "rice") {
    const dry = known(a.form) && a.form.choice === "dry";
    if (!known(a.form) && a.form !== undefined) out.assumptions.push(t("Counted as cooked rice on the plate.", "প্লেটের রান্না করা ভাত হিসেবে গোনা হয়েছে।"));
    const id = dry ? dish.records.dry : dish.records.cooked;
    let g = NaN;
    if (dry && known(a.dryGrams)) g = num(a.dryGrams.value);
    if (!dry && known(a.cooked)) {
      if (a.cooked.choice === "cup") {
        const cup = PORTIONS["rice-cooked"][0].grams;
        g = num(a.cooked.value) * cup;
        out.assumptions.push(t(`1 cup of cooked rice ≈ ${cup} g (${PORTION_SOURCE}).`, `১ কাপ রান্না করা ভাত ≈ ${cup} গ্রাম (USDA)।`));
        out.canonical.servingUnit = "cup";
        out.canonical.servingCount = num(a.cooked.value);
      } else g = num(a.cooked.value);
    }
    if (dry) out.assumptions.push(t("Weighed dry, before cooking, and counted with USDA's uncooked rice values (never the cooked ones).", "রান্নার আগে শুকনো ওজন, USDA-র কাঁচা চালের মানে গোনা (রান্না করা ভাতের মানে নয়)।"));
    if (!positive(g)) {
      out.reference = per100(id);
      missing("amount", t("The amount of rice is not known.", "ভাতের পরিমাণ জানা নেই।"));
    } else out.components.push(component({ foodIds: [id], grams: { min: g, max: g }, role: "main" }));
    const prep = a.prep;
    if (known(prep) && prep.choice === "plain") {
      out.assumptions.push(t("Plain rice is counted without added salt.", "সাদা ভাতে লবণ ধরা হয়নি।"));
    } else if (prep !== undefined) {
      const oil = known(prep) ? spoonGrams(a.oil, "oil") : null;
      if (oil === null) {
        out.missingInputs.push("addedFat");
        out.components.push(component({ foodIds: ["soybean-oil"], grams: { min: 0, max: null }, role: "added_fat" }));
        out.notes.push(t(`Oil or ghee is not known. Each tablespoon adds about ${Math.round((SPOON_GRAMS.oil.tbsp * getRecord("soybean-oil").per100g.kcal) / 100)} kcal.`, `তেল বা ঘি জানা নেই। প্রতি টেবিল-চামচে প্রায় ${Math.round((SPOON_GRAMS.oil.tbsp * getRecord("soybean-oil").per100g.kcal) / 100)} কিলোক্যালরি বাড়ে।`));
      } else if (oil > 0) out.components.push(component({ foodIds: ["soybean-oil"], grams: { min: oil, max: oil }, role: "added_fat" }));
      if (oil > 0) out.assumptions.push(t("Ghee or butter is counted as cooking oil; their energy is similar but not the same.", "ঘি বা মাখন রান্নার তেল হিসেবে গোনা; শক্তি কাছাকাছি, একই নয়।"));
      out.unknownNutrients.sodium = t("Salt in fried rice or polao is not known.", "পোলাও বা ভাজা ভাতে লবণ জানা নেই।");
      out.canonical.addedFatGrams = oil;
    }
    out.canonical.state = getRecord(id).state;
    out.canonical.servingUnit ??= "g";
    return out;
  }

  if (dish.category === "curry") {
    const share = potShare();
    let mainGrams = NaN;
    if (dish.id === "dal") {
      if (known(a.dalType) && a.dalType.choice === "other") {
        out.qualityFlags.push("stand_in_record");
        out.assumptions.push(t("Counted as masoor (red lentil) dal, the only dal ASHA has values for. Other dals differ; chana dal has more energy.", "মসুর ডাল হিসেবে গোনা, আশার কাছে কেবল এর মান আছে। অন্য ডালে মান আলাদা; ছোলার ডালে শক্তি বেশি।"));
      } else if (!known(a.dalType) && a.dalType !== undefined) out.assumptions.push(t("Counted as masoor (red lentil) dal.", "মসুর ডাল হিসেবে গোনা।"));
      const amt = a.amount;
      if (known(amt)) {
        const bowls = { half: 0.5, one: 1, two: 2 }[amt.choice] ?? (amt.choice === "bowls" ? num(amt.value) : NaN);
        if (positive(bowls)) {
          mainGrams = bowls * dish.bowlGrams;
          out.assumptions.push(dish.assumption);
          out.canonical.servingUnit = "bowl";
          out.canonical.servingCount = bowls;
        } else if (amt.choice === "grams") {
          mainGrams = num(amt.value);
          out.assumptions.push(t("Weighed dal is counted as boiled lentils. Watery dal has fewer lentils per gram, so this may be high for thin dal.", "মাপা ডাল সেদ্ধ মসুর হিসেবে গোনা। পাতলা ডালে প্রতি গ্রামে ডাল কম, তাই এটি বেশি দেখাতে পারে।"));
        }
      }
    } else {
      const fish = a.fishType;
      if (!known(fish) || fish.choice !== "tilapia") {
        out.qualityFlags.push("stand_in_record");
        if (known(fish) && fish.choice === "hilsa") {
          out.notes.push(t("Ilish (hilsa) is an oily fish with more energy than tilapia, so the real value is higher than this.", "ইলিশ তেলযুক্ত মাছ, তেলাপিয়ার চেয়ে শক্তি বেশি; তাই আসল মান এর চেয়ে বেশি।"));
          out.hilsa = true;
        }
      }
      out.assumptions.push(dish.assumption);
      if (known(a.fishGrams)) mainGrams = num(a.fishGrams.value);
      const potato = a.potato;
      if (known(potato) && potato.choice === "grams" && positive(num(potato.value))) {
        const pg = num(potato.value);
        out.components.push(component({ foodIds: [dish.side], grams: { min: pg, max: pg }, role: "side" }));
      } else if (potato !== undefined && !known(potato)) {
        out.missingInputs.push("potato");
        out.components.push(component({ foodIds: [dish.side], grams: { min: 0, max: null }, role: "side" }));
        out.notes.push(t("Potato amount is not known.", "আলুর পরিমাণ জানা নেই।"));
      }
    }
    if (!positive(mainGrams)) {
      out.reference = per100(dish.main);
      missing("amount", dish.id === "dal" ? t("The amount of dal is not known.", "ডালের পরিমাণ জানা নেই।") : t("The weight of the fish is not known. A photo can't tell it reliably.", "মাছের ওজন জানা নেই। ছবি দেখে তা নির্ভরযোগ্যভাবে বলা যায় না।"));
    } else out.components.unshift(component({ foodIds: [dish.main], grams: { min: mainGrams, max: out.hilsa ? null : mainGrams }, role: "main" }));

    const oilPot = spoonGrams(a.oil, "oil");
    const oilState = a.oil === undefined ? "not_asked" : addPot("added_fat", "soybean-oil", oilPot, share);
    if (oilState === "unknown") {
      out.missingInputs.push("addedFat");
      out.components.push(component({ foodIds: ["soybean-oil"], grams: { min: 0, max: null }, role: "added_fat", scope: "pot" }));
      const perTbsp = (SPOON_GRAMS.oil.tbsp * getRecord("soybean-oil").per100g.kcal) / 100;
      const yours = share !== null ? Math.round(perTbsp * share) : null;
      out.notes.push(
        yours !== null
          ? t(`Oil in the pot is not known. Each tablespoon in the pot adds about ${yours} kcal to your share.`, `পাতিলের তেল জানা নেই। পাতিলে প্রতি টেবিল-চামচ তেল আপনার ভাগে প্রায় ${yours} কিলোক্যালরি যোগ করে।`)
          : t(`Oil in the pot is not known. Each tablespoon in the pot adds about ${Math.round(perTbsp)} kcal, shared by everyone who ate from it.`, `পাতিলের তেল জানা নেই। প্রতি টেবিল-চামচে প্রায় ${Math.round(perTbsp)} কিলোক্যালরি, যারা খেয়েছেন সবার মধ্যে ভাগ হয়।`),
      );
    }
    const saltPot = spoonGrams(a.salt, "salt");
    const saltNote = t("Salt in the pot is not known, so sodium is unknown. A photo can't show salt.", "পাতিলের লবণ জানা নেই, তাই সোডিয়াম অজানা। ছবিতে লবণ দেখা যায় না।");
    const saltState = a.salt === undefined ? "not_asked" : addPot("salt", "salt", saltPot, share, saltNote);
    if (saltState === "unknown" || saltState === "not_asked") {
      if (saltState === "unknown") out.missingInputs.push("salt");
      out.unknownNutrients.sodium = saltNote;
    }
    if (share !== null) {
      out.canonical.recipeServingsMade = num(a.share.value);
      out.canonical.recipeServingsEaten = num(a.share.value2);
    }
    out.canonical.addedFatGrams = oilPot === null ? null : share !== null ? oilPot * share : null;
    out.canonical.state = "cooked";
    out.canonical.servingUnit ??= "g";
    return out;
  }

  if (dish.category === "packaged") {
    const name = known(a.productName) ? String(a.productName.text ?? "").trim().slice(0, 80) : "";
    let kcal = NaN;
    if (known(a.labelKcal)) kcal = a.labelKcal.choice === "kJ" ? num(a.labelKcal.value) / 4.184 : num(a.labelKcal.value);
    const servings = known(a.servings) ? ({ half: 0.5, one: 1, two: 2 }[a.servings.choice] ?? num(a.servings.value)) : NaN;
    out.canonical = { state: "as_sold", servingUnit: "label_serving", servingCount: Number.isFinite(servings) ? servings : null, packagedServings: Number.isFinite(servings) ? servings : null, productName: name || null };
    out.assumptions.push(t("Uses the label values you typed in. ASHA doesn't read labels or guess them from the brand.", "আপনার লেখা লেবেলের মান ব্যবহার করা হয়েছে। আশা লেবেল পড়ে না, ব্র্যান্ড দেখে অনুমানও করে না।"));
    if (!(Number.isFinite(kcal) && kcal >= 0)) {
      missing("labelKcal", t("The label's energy per serving is needed to count a packaged food.", "প্যাকেটের খাবার গুনতে লেবেলের প্রতি পরিবেশনের শক্তি লাগবে।"), "unavailable");
      return out;
    }
    if (!(Number.isFinite(servings) && servings > 0)) {
      out.reference = { foodId: null, kcal: Math.round(kcal), perServing: true, label: t(name || "Packaged food", name || "প্যাকেটজাত খাবার"), databaseRecordId: null };
      missing("servings", t("How many servings you had is not known.", "কত পরিবেশন খেয়েছেন জানা নেই।"));
      return out;
    }
    if (a.labelKcal.choice === "kJ") out.assumptions.push(t("Label energy in kJ was converted at 4.184 kJ per kcal.", "লেবেলের kJ, প্রতি কিলোক্যালরি ৪.১৮৪ kJ ধরে রূপান্তরিত।"));
    out.components.push(labelComponent({ name, kcalPerServing: kcal, servings, extras: known(a.labelExtras) ? a.labelExtras : null }));
    if (!known(a.labelExtras) || !Number.isFinite(num(a.labelExtras.sodium))) out.unknownNutrients.sodium ??= t("Sodium was not entered from the label.", "লেবেল থেকে সোডিয়াম লেখা হয়নি।");
    return out;
  }

  // "Something else": a simple food picked from ASHA's list, or a name only.
  const recordId = item.recordId ?? a.whatFood?.recordId ?? null;
  const record = recordId ? getRecord(recordId) : null;
  if (!record) {
    const name = a.whatFood?.text ? String(a.whatFood.text).trim().slice(0, 80) : "";
    out.canonical = { productName: name || null };
    missing("food", t(name ? `“${name}” isn't in ASHA's checked food list yet, so it is logged by name only, without numbers.` : "No food was chosen.", name ? `“${name}” এখনো আশার যাচাই করা তালিকায় নেই, তাই কেবল নাম লেখা হলো, সংখ্যা ছাড়া।` : "কোনো খাবার বাছাই করা হয়নি।"), "unavailable");
    return out;
  }
  const g = known(a.grams) ? num(a.grams.value) : NaN;
  if (!positive(g)) {
    out.reference = per100(record.id);
    missing("amount", t("The amount is not known.", "পরিমাণ জানা নেই।"));
  } else out.components.push(component({ foodIds: [record.id], grams: { min: g, max: g }, role: "main" }));
  out.canonical = { state: record.state, servingUnit: "g", servingCount: null };
  return out;
}

function sumNutrients(components, unknownNutrients) {
  const total = {};
  for (const key of NUTRIENT_KEYS) {
    if (unknownNutrients[key] || components.some((c) => c.nutrients[key] === null)) {
      total[key] = null;
      continue;
    }
    total[key] = components.reduce((acc, c) => ({ min: acc.min + c.nutrients[key].min, max: acc.max === null || c.nutrients[key].max === null ? null : acc.max + c.nutrients[key].max }), { min: 0, max: 0 });
  }
  return total;
}

function statusOf(kcal, blocked) {
  if (blocked) return blocked;
  if (!kcal) return "uncertain";
  if (kcal.max === null) return "lower_bound";
  return Math.abs(kcal.max - kcal.min) > 1e-9 ? "range" : "estimate";
}

/**
 * One food's estimate. `item` = {uid, dishId, answers, recordId?, capture?, manualCorrections?}.
 * Returns the status, sums, every component with its source, what was assumed and what is missing,
 * and the canonical fields from the V5 spec.
 */
export function estimateItem(item) {
  const dish = DISHES[item.dishId];
  const built = buildComponents(item);
  const blocked = built.blocked;
  const nutrients = blocked ? Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, null])) : sumNutrients(built.components, built.unknownNutrients);
  const status = statusOf(nutrients.kcal, blocked);
  const main = built.components.find((c) => c.role === "main" || c.role === "label");
  const mainSource = main?.sources?.[0] ?? null;
  const unknownWhy = Object.fromEntries(NUTRIENT_KEYS.filter((k) => nutrients[k] === null && !blocked).map((k) => [k, built.unknownNutrients[k] ?? t("Not in the source record yet.", "উৎস রেকর্ডে এখনো নেই।")]));
  const capture = item.capture ?? {};
  const canonical = {
    foodId: mainSource?.foodId ?? null,
    label: dish ? t(dish.en, dish.bn) : null,
    databaseSource: mainSource?.databaseSource ?? null,
    databaseRecordId: mainSource?.databaseRecordId ?? null,
    state: built.canonical.state ?? mainSource?.state ?? null,
    edibleGrams: main?.grams ? { min: round1(main.grams.min), max: main.grams.max === null ? null : round1(main.grams.max) } : null,
    servingUnit: built.canonical.servingUnit ?? null,
    servingCount: built.canonical.servingCount ?? null,
    recipeIngredients: dish?.category === "curry" ? built.components.map((c) => ({ foodId: c.foodIds[0], grams: c.grams?.max === null ? null : round1(c.grams.min), potGrams: c.potGrams, scope: c.scope, state: c.sources[0].state, kcalPer100g: getRecord(c.foodIds[0])?.per100g.kcal ?? null, sourceId: c.sources[0].databaseRecordId })) : [],
    // Shared pots are divided by servings, which people know; the pot's cooked weight usually isn't.
    recipeTotalYieldGrams: null,
    portionOfRecipeGrams: null,
    recipeServingsMade: built.canonical.recipeServingsMade ?? null,
    recipeServingsEaten: built.canonical.recipeServingsEaten ?? null,
    addedFatGrams: built.canonical.addedFatGrams ?? null,
    addedSugarGrams: built.canonical.addedSugarGrams ?? null,
    packagedServings: built.canonical.packagedServings ?? null,
    productName: built.canonical.productName ?? null,
    assumptions: built.assumptions.map((x) => x.en),
    missingInputs: [...new Set(built.missingInputs)],
    qualityFlags: [...new Set([...built.qualityFlags, ...(capture.qualityFlags ?? [])])],
    manualCorrections: item.manualCorrections ?? [],
    modelId: capture.modelId ?? null,
    modelVersion: capture.modelVersion ?? null,
    dataVersion: NUTRITION_DATA_VERSION,
    engineVersion: ENGINE_VERSION,
    captureMethod: capture.method ?? "manual",
  };
  return {
    uid: item.uid,
    dishId: item.dishId,
    label: canonical.label,
    status,
    nutrients,
    unknownWhy,
    components: built.components,
    assumptions: built.assumptions,
    notes: built.notes,
    reference: built.reference,
    storage: built.storage ?? null,
    canonical,
  };
}

const EATEN = Object.freeze({ all: 1, most: 0.75, half: 0.5, little: 0.25, none: 0 });
export const EATEN_CHOICES = Object.freeze(Object.keys(EATEN));

/**
 * The whole meal. Foods are kept separate and added once each. Foods without a responsible number
 * are left out of the total and listed, never counted as zero. `eaten` maps uid -> how much of it
 * the person says they ate; "energy you ate" exists only once every counted food has an answer.
 */
export function estimateMeal(items, eaten = {}) {
  const seen = new Set();
  const results = items.map((it) => {
    if (seen.has(it.uid)) throw new RangeError("The same food was added twice.");
    seen.add(it.uid);
    return estimateItem(it);
  });
  const counted = results.filter((r) => r.status !== "uncertain" && r.status !== "unavailable");
  const excluded = results.filter((r) => !counted.includes(r)).map((r) => r.uid);
  const sum = (rows, factor = () => 1) => {
    const out = {};
    for (const key of NUTRIENT_KEYS) {
      if (!rows.length || rows.some((r) => r.nutrients[key] === null)) {
        out[key] = null;
        continue;
      }
      out[key] = rows.reduce((acc, r) => {
        const f = factor(r), v = r.nutrients[key];
        return { min: acc.min + v.min * f, max: acc.max === null || v.max === null ? null : acc.max + v.max * f };
      }, { min: 0, max: 0 });
    }
    return out;
  };
  let status = results.reduce((s, r) => worse(s, r.status), "estimate");
  if (counted.length && excluded.length) status = "uncertain";
  const eatenKnown = counted.length > 0 && counted.every((r) => eaten[r.uid] in EATEN);
  return {
    items: results,
    status,
    total: sum(counted),
    eaten: eatenKnown ? sum(counted, (r) => EATEN[eaten[r.uid]]) : null,
    eatenAnswers: Object.fromEntries(counted.map((r) => [r.uid, eaten[r.uid] ?? null])),
    counted: counted.map((r) => r.uid),
    excluded,
    dataVersion: NUTRITION_DATA_VERSION,
    engineVersion: ENGINE_VERSION,
  };
}

/** Rounded for display: nearest 5 kcal above 50, so the number doesn't look more exact than it is. */
export function approx(n, key = "kcal") {
  if (!Number.isFinite(n)) return null;
  if (key === "kcal") return n >= 50 ? Math.round(n / 5) * 5 : Math.round(n);
  if (key === "sodium") return n >= 20 ? Math.round(n / 5) * 5 : Math.round(n);
  return n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
}

/** "about 105 kcal", "90–120 kcal", "at least 210 kcal" (and the Bangla equivalents). */
export function formatValue(v, key, lang = "en") {
  const unit = key === "kcal" ? (lang === "bn" ? "কিলোক্যালরি" : "kcal") : key === "sodium" ? (lang === "bn" ? "মিগ্রা" : "mg") : lang === "bn" ? "গ্রাম" : "g";
  const bn = (x) => (lang === "bn" ? String(x).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]) : String(x));
  if (!v) return lang === "bn" ? "অজানা" : "unknown";
  const lo = approx(v.min, key), hi = v.max === null ? null : approx(v.max, key);
  if (hi === null) return lang === "bn" ? `অন্তত ${bn(lo)} ${unit}` : `at least ${lo} ${unit}`;
  if (hi !== lo) return `${bn(lo)}–${bn(hi)} ${unit}`;
  return lang === "bn" ? `প্রায় ${bn(lo)} ${unit}` : `about ${lo} ${unit}`;
}

export const STATUS_TEXT = Object.freeze({
  estimate: t("Estimate", "আনুমানিক"),
  range: t("Estimated range", "আনুমানিক সীমা"),
  lower_bound: t("At least this much", "অন্তত এতটুকু"),
  uncertain: t("Estimate uncertain", "অনুমান অনিশ্চিত"),
  unavailable: t("No estimate", "অনুমান নেই"),
});
