// ASHA Nutrition V5 questions. Only questions that change the estimate are asked, one at a time, in
// the order identity → portion → preparation → additions → optional. Every question offers
// "I don't know" and "Skip"; both are recorded and the calculator treats them honestly (a range,
// "at least", or "estimate uncertain"), never as zero. The frozen-fruit storage questions are an
// optional tips branch: their answers are never read by the calculator.
import { DISHES, getRecord, PORTIONS, SPOON_GRAMS } from "./catalog.js";

const t = (en, bn) => ({ en, bn });
export const STAGES = Object.freeze(["identity", "portion", "preparation", "additions", "optional"]);

const G = t("grams", "গ্রাম");
const grams = (max = 3000) => ({ unit: G, min: 1, max, step: 1 });
const count = (unit, max = 20, step = 1, min = 1) => ({ unit, min, max, step });
const TSP = t("teaspoons", "চা-চামচ");
const TBSP = t("tablespoons", "টেবিল-চামচ");

const NONE = { id: "none", ...t("None", "একদম না") };
const oilOptions = [NONE, { id: "tsp", ...t(`Teaspoons (1 tsp ≈ ${SPOON_GRAMS.oil.tsp} g)`, `চা-চামচ (১ চা-চামচ ≈ ${SPOON_GRAMS.oil.tsp} গ্রাম)`), input: count(TSP, 40, 0.5, 0.5) }, { id: "tbsp", ...t(`Tablespoons (1 tbsp ≈ ${SPOON_GRAMS.oil.tbsp} g)`, `টেবিল-চামচ (১ টেবিল-চামচ ≈ ${SPOON_GRAMS.oil.tbsp} গ্রাম)`), input: count(TBSP, 20, 0.5, 0.5) }];
const saltOptions = [NONE, { id: "tsp", ...t(`Teaspoons (1 tsp ≈ ${SPOON_GRAMS.salt.tsp} g)`, `চা-চামচ (১ চা-চামচ ≈ ${SPOON_GRAMS.salt.tsp} গ্রাম)`), input: count(TSP, 10, 0.25, 0.25) }];
const sugarOptions = [NONE, { id: "tsp", ...t(`Teaspoons (1 tsp ≈ ${SPOON_GRAMS.sugar.tsp} g)`, `চা-চামচ (১ চা-চামচ ≈ ${SPOON_GRAMS.sugar.tsp} গ্রাম)`), input: count(TSP, 20, 0.5, 0.5) }];

const has = (a, id) => !!a && !a.dontKnow && !a.skipped && a.choice === id;
const positiveAmount = (a) => !!a && !a.dontKnow && !a.skipped && a.choice !== "none" && Number(a.value) > 0;

// Shared pot questions for dal and fish curry.
const potQuestions = (thing) => [
  { id: "oil", stage: "additions", text: t(`How much oil or ghee went into the whole pot of ${thing.en}?`, `পুরো পাতিলের ${thing.bn} রান্নায় কতটা তেল বা ঘি দেওয়া হয়েছিল?`), help: t("Oil adds the most energy in a curry, and a photo can't show it.", "তরকারিতে তেলেই সবচেয়ে বেশি শক্তি, আর ছবিতে তা দেখা যায় না।"), options: oilOptions },
  { id: "salt", stage: "additions", text: t("How much salt went into the whole pot?", "পুরো পাতিলে কতটা লবণ দেওয়া হয়েছিল?"), help: t("Salt changes sodium only, not calories.", "লবণে শুধু সোডিয়াম বদলায়, ক্যালরি নয়।"), options: saltOptions },
  {
    id: "share",
    stage: "additions",
    kind: "share",
    text: t("How many servings did the pot make, and how many were yours?", "পাতিলে কত জনের পরিবেশন ছিল, আর আপনার কতটা?"),
    help: t("Your share of the oil and salt is worked out from this.", "এ থেকে তেল ও লবণে আপনার ভাগ হিসাব হয়।"),
    fields: [
      { id: "value", ...t("Servings in the pot", "পাতিলে মোট পরিবেশন"), min: 1, max: 50, step: 1 },
      { id: "value2", ...t("Servings you had", "আপনার পরিবেশন"), min: 0.25, max: 50, step: 0.25 },
    ],
    when: (a) => positiveAmount(a.oil) || positiveAmount(a.salt),
  },
];

/** The questions for one food, in order. Some depend on earlier answers (`when`). */
export function questionsFor(dishId) {
  const dish = DISHES[dishId];
  if (!dish) return [];
  if (dish.category === "whole_fruit") {
    const portions = PORTIONS[dish.portions] ?? [];
    return [
      {
        id: "size",
        stage: "portion",
        text: t(`How big was the ${dish.en.toLowerCase()}?`, `${dish.bn} কত বড় ছিল?`),
        options: [...portions.map((p) => ({ id: p.id, en: `${p.en} · ${p.grams} g`, bn: `${p.bn} · ${p.grams} গ্রাম` })), { id: "grams", ...t("I know the weight", "ওজন জানি"), input: grams(2000) }],
        help: t("Weights are the edible part, from USDA.", "ওজন খাওয়ার অংশের, USDA থেকে।"),
      },
      {
        id: "count",
        stage: "portion",
        text: t("How many did you have?", "কয়টি খেয়েছেন?"),
        options: [{ id: "1", ...t("1", "১") }, { id: "2", ...t("2", "২") }, { id: "3", ...t("3", "৩") }, { id: "n", ...t("Another number", "অন্য সংখ্যা"), input: count(t("pieces", "টি"), 20, 0.5, 0.5) }],
        when: (a) => !has(a.size, "grams"),
      },
    ];
  }
  if (dish.category === "frozen_fruit") {
    return [
      {
        id: "kind",
        stage: "identity",
        text: t("Were they fresh or frozen?", "এগুলো তাজা না হিমায়িত?"),
        options: [{ id: "fresh", ...t("Fresh", "তাজা") }, { id: "frozen_plain", ...t("Frozen, plain (no sugar)", "হিমায়িত, চিনি ছাড়া") }, { id: "frozen_sweetened", ...t("Frozen with sugar or syrup", "হিমায়িত, চিনি বা সিরাপসহ") }],
        help: t("Sugar or syrup from the factory changes the calories; freezing itself doesn't.", "কারখানার চিনি বা সিরাপে ক্যালরি বদলায়; শুধু হিমায়িত করায় বদলায় না।"),
      },
      { id: "grams", stage: "portion", text: t("About how many grams did you have?", "আনুমানিক কত গ্রাম খেয়েছেন?"), options: [{ id: "grams", ...t("Weight in grams", "ওজন গ্রামে"), input: grams(2000) }], help: t("The packet weight or a kitchen scale helps.", "প্যাকেটের ওজন বা রান্নাঘরের পাল্লা সাহায্য করে।") },
      { id: "sugar", stage: "additions", text: t("Did you add sugar?", "নিজে চিনি দিয়েছিলেন?"), options: sugarOptions },
      {
        id: "storageTips",
        stage: "optional",
        optional: true,
        text: t("Would you like tips on storing frozen fruit? This doesn't change the calories.", "হিমায়িত ফল রাখার পরামর্শ চান? এতে ক্যালরি বদলায় না।"),
        options: [{ id: "yes", ...t("Yes, show tips", "হ্যাঁ, পরামর্শ দেখান") }, { id: "no", ...t("No thanks", "না, দরকার নেই") }],
        when: (a) => !has(a.kind, "fresh"),
      },
      {
        id: "frozenFor",
        stage: "optional",
        optional: true,
        text: t("Roughly how long were they in the freezer?", "আনুমানিক কতদিন ফ্রিজারে ছিল?"),
        options: [{ id: "lt1m", ...t("Less than a month", "এক মাসের কম") }, { id: "1to6m", ...t("1 to 6 months", "১ থেকে ৬ মাস") }, { id: "6to12m", ...t("6 to 12 months", "৬ থেকে ১২ মাস") }, { id: "gt12m", ...t("More than a year", "এক বছরের বেশি") }],
        when: (a) => has(a.storageTips, "yes"),
      },
      {
        id: "freezerTemp",
        stage: "optional",
        optional: true,
        text: t("Did they stay frozen solid the whole time?", "পুরো সময় কি শক্ত হয়ে জমে ছিল?"),
        options: [{ id: "solid", ...t("Yes, frozen solid", "হ্যাঁ, শক্ত জমে ছিল") }, { id: "thawed", ...t("They thawed and were frozen again", "গলে গিয়ে আবার জমানো হয়েছে") }],
        when: (a) => has(a.storageTips, "yes"),
      },
    ];
  }
  if (dish.category === "rice") {
    const cup = PORTIONS["rice-cooked"][0];
    return [
      {
        id: "form",
        stage: "identity",
        text: t("Which amount do you know?", "কোন পরিমাণটি জানেন?"),
        options: [{ id: "cooked", ...t("Cooked rice on the plate", "প্লেটের রান্না করা ভাত") }, { id: "dry", ...t("Dry rice, weighed before cooking", "রান্নার আগে মাপা শুকনো চাল") }],
        help: t("Cooked and dry rice weigh very differently, so ASHA never mixes them.", "রান্না করা ভাত আর শুকনো চালের ওজন অনেক আলাদা, তাই আশা দুটো মেশায় না।"),
      },
      {
        id: "cooked",
        stage: "portion",
        text: t("How much cooked rice?", "কতটা ভাত?"),
        options: [{ id: "cup", ...t(`Cups (1 cup ≈ ${cup.grams} g)`, `কাপ (১ কাপ ≈ ${cup.grams} গ্রাম)`), input: count(t("cups", "কাপ"), 10, 0.25, 0.25) }, { id: "grams", ...t("Weight in grams", "ওজন গ্রামে"), input: grams(3000) }],
        when: (a) => !has(a.form, "dry"),
      },
      { id: "dryGrams", stage: "portion", text: t("How many grams of dry rice were cooked for you?", "আপনার জন্য কত গ্রাম শুকনো চাল রান্না হয়েছিল?"), options: [{ id: "grams", ...t("Dry weight in grams", "শুকনো ওজন গ্রামে"), input: grams(1000) }], when: (a) => has(a.form, "dry") },
      {
        id: "prep",
        stage: "preparation",
        text: t("How was it cooked?", "কীভাবে রান্না হয়েছিল?"),
        options: [{ id: "plain", ...t("Plain boiled rice (bhat)", "সাধারণ সেদ্ধ ভাত") }, { id: "fried", ...t("With oil or ghee (polao, fried rice, khichuri)", "তেল বা ঘি দিয়ে (পোলাও, ভাজা ভাত, খিচুড়ি)") }],
      },
      { id: "oil", stage: "additions", text: t("How much oil or ghee was in your portion?", "আপনার অংশে কতটা তেল বা ঘি ছিল?"), options: oilOptions, when: (a) => has(a.prep, "fried") },
    ];
  }
  if (dish.id === "dal") {
    return [
      { id: "dalType", stage: "identity", text: t("Which dal was it?", "কোন ডাল ছিল?"), options: [{ id: "masoor", ...t("Masoor (red lentil)", "মসুর") }, { id: "other", ...t("Another dal (mung, chana, mashkalai…)", "অন্য ডাল (মুগ, ছোলা, মাষকলাই…)") }] },
      {
        id: "amount",
        stage: "portion",
        text: t("How much dal did you have?", "কতটা ডাল খেয়েছেন?"),
        options: [{ id: "half", ...t("Half a bowl", "আধা বাটি") }, { id: "one", ...t("1 bowl", "১ বাটি") }, { id: "two", ...t("2 bowls", "২ বাটি") }, { id: "bowls", ...t("Another number of bowls", "অন্য সংখ্যক বাটি"), input: count(t("bowls", "বাটি"), 10, 0.5, 0.5) }, { id: "grams", ...t("Weight in grams", "ওজন গ্রামে"), input: grams(2000) }],
        help: dish.assumption,
      },
      ...potQuestions(t("dal", "ডাল")),
    ];
  }
  if (dish.id === "fish_curry") {
    return [
      {
        id: "fishType",
        stage: "identity",
        text: t("Which fish was it?", "কোন মাছ ছিল?"),
        options: [{ id: "tilapia", ...t("Tilapia", "তেলাপিয়া") }, { id: "river", ...t("Rui, katla or another river fish", "রুই, কাতলা বা অন্য নদীর মাছ") }, { id: "hilsa", ...t("Ilish (hilsa)", "ইলিশ") }, { id: "other", ...t("Another fish", "অন্য মাছ") }],
        help: t("ASHA has checked values for cooked tilapia only. Other fish are counted with them and marked.", "আশার কাছে কেবল রান্না করা তেলাপিয়ার যাচাই করা মান আছে। অন্য মাছ সেটি দিয়ে গোনা হয় এবং চিহ্নিত থাকে।"),
      },
      { id: "fishGrams", stage: "portion", text: t("How much fish did you eat, without bones?", "কাঁটা ছাড়া কতটা মাছ খেয়েছেন?"), options: [{ id: "grams", ...t("Weight in grams", "ওজন গ্রামে"), input: grams(1000) }], help: t("A photo can't tell the weight of a piece reliably. A rough guess in grams is fine.", "ছবি দেখে টুকরোর ওজন নির্ভরযোগ্যভাবে বলা যায় না। গ্রামে মোটামুটি আন্দাজই যথেষ্ট।") },
      { id: "potato", stage: "portion", text: t("Was there potato on your plate?", "আপনার প্লেটে আলু ছিল?"), options: [NONE, { id: "grams", ...t("Yes, about this many grams", "হ্যাঁ, প্রায় এত গ্রাম"), input: grams(1000) }] },
      ...potQuestions(t("curry", "তরকারি")),
    ];
  }
  if (dish.category === "packaged") {
    return [
      { id: "productName", stage: "identity", kind: "text", text: t("What is the product called?", "পণ্যটির নাম কী?"), placeholder: t("For example: biscuits, noodles", "যেমন: বিস্কুট, নুডলস") },
      {
        id: "labelKcal",
        stage: "portion",
        text: t("What does the label say for energy per serving?", "লেবেলে প্রতি পরিবেশনে শক্তি কত লেখা?"),
        options: [{ id: "kcal", ...t("Calories (kcal)", "ক্যালরি (kcal)"), input: count(t("kcal", "কিলোক্যালরি"), 3000, 1, 0) }, { id: "kJ", ...t("Kilojoules (kJ)", "কিলোজুল (kJ)"), input: count(t("kJ", "kJ"), 12000, 1, 0) }],
        help: t("Look for “Energy” or “Calories” in the nutrition table. ASHA doesn't guess it from the brand.", "পুষ্টি তালিকায় “Energy” বা “Calories” দেখুন। আশা ব্র্যান্ড দেখে অনুমান করে না।"),
      },
      { id: "servings", stage: "portion", text: t("How many servings did you have?", "কত পরিবেশন খেয়েছেন?"), options: [{ id: "half", ...t("Half a serving", "আধা পরিবেশন") }, { id: "one", ...t("1 serving", "১ পরিবেশন") }, { id: "two", ...t("2 servings", "২ পরিবেশন") }, { id: "n", ...t("Another number", "অন্য সংখ্যা"), input: count(t("servings", "পরিবেশন"), 20, 0.25, 0.25) }] },
      {
        id: "labelExtras",
        stage: "optional",
        optional: true,
        kind: "fields",
        text: t("Add more from the label? (per serving, all optional)", "লেবেল থেকে আরও যোগ করবেন? (প্রতি পরিবেশনে, ইচ্ছা হলে)"),
        fields: [
          { id: "servingGrams", ...t("Serving size (g)", "পরিবেশনের ওজন (গ্রাম)"), min: 0, max: 2000, step: 1 },
          { id: "protein", ...t("Protein (g)", "প্রোটিন (গ্রাম)"), min: 0, max: 500, step: 0.1 },
          { id: "fat", ...t("Fat (g)", "চর্বি (গ্রাম)"), min: 0, max: 500, step: 0.1 },
          { id: "carbohydrate", ...t("Carbohydrate (g)", "শর্করা (গ্রাম)"), min: 0, max: 500, step: 0.1 },
          { id: "sodium", ...t("Sodium (mg)", "সোডিয়াম (মিগ্রা)"), min: 0, max: 20000, step: 1 },
        ],
      },
    ];
  }
  // Something else: pick a food from ASHA's list, or keep a name only.
  return [
    { id: "whatFood", stage: "identity", kind: "search", text: t("What food is this?", "এটি কোন খাবার?"), help: t("Search ASHA's checked food list. If it isn't there, type the name and it is logged without numbers.", "আশার যাচাই করা তালিকায় খুঁজুন। না পেলে নাম লিখুন, সংখ্যা ছাড়া লেখা থাকবে।") },
    { id: "grams", stage: "portion", text: t("How many grams did you have?", "কত গ্রাম খেয়েছেন?"), options: [{ id: "grams", ...t("Weight in grams", "ওজন গ্রামে"), input: grams(3000) }], when: (a) => !!a.whatFood?.recordId },
  ];
}

/** Questions that apply now, given the answers so far. */
export function applicable(item) {
  const a = item.answers ?? {};
  return questionsFor(item.dishId).filter((q) => !q.when || q.when(a));
}

export function nextQuestion(item) {
  const a = item.answers ?? {};
  return applicable(item).find((q) => a[q.id] === undefined) ?? null;
}

export function progress(item) {
  const qs = applicable(item);
  const a = item.answers ?? {};
  return { done: qs.filter((q) => a[q.id] !== undefined).length, total: qs.length };
}

/** Is this answer complete enough to accept? (An option with a number needs a valid number.) */
export function validAnswer(q, ans) {
  if (!ans) return false;
  if (ans.dontKnow || ans.skipped) return true;
  if (q.kind === "text") return typeof ans.text === "string" && ans.text.trim().length > 0 && ans.text.length <= 80;
  if (q.kind === "search") return !!(ans.recordId && getRecord(ans.recordId)) || !!(ans.dishId && DISHES[ans.dishId]) || (typeof ans.text === "string" && ans.text.trim().length > 0);
  const inRange = (v, f) => Number.isFinite(Number(v)) && Number(v) >= f.min && Number(v) <= f.max;
  if (q.kind === "share") return inRange(ans.value, q.fields[0]) && inRange(ans.value2, q.fields[1]) && Number(ans.value2) <= Number(ans.value);
  if (q.kind === "fields") return q.fields.every((f) => ans[f.id] === undefined || ans[f.id] === "" || inRange(ans[f.id], f));
  const opt = q.options?.find((o) => o.id === ans.choice);
  if (!opt) return false;
  return !opt.input || inRange(ans.value, opt.input);
}

const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);

/**
 * Record an answer and return the new item. Answers to questions that no longer apply are dropped,
 * so a changed answer can't leave a stale one behind. Once a result has been shown, every change
 * is kept in `manualCorrections`.
 */
export function answer(item, questionId, ans, now = Date.now()) {
  const q = questionsFor(item.dishId).find((x) => x.id === questionId);
  if (!q) throw new RangeError(`Unknown question ${questionId}`);
  if (!validAnswer(q, ans)) throw new RangeError("That answer isn't complete.");
  // "Something else" → a dish from the list: start that dish's own questions.
  if (q.kind === "search" && ans.dishId && !ans.dontKnow && !ans.skipped) {
    return { ...item, dishId: ans.dishId, recordId: undefined, answers: {}, history: [], switchedFrom: "other" };
  }
  // A question reopened from the review keeps its old answer aside, so the change is still recorded.
  const before = item.answers?.[questionId] ?? item.reopened?.[questionId];
  const reopened = { ...(item.reopened ?? {}) };
  delete reopened[questionId];
  let answers = { ...(item.answers ?? {}), [questionId]: ans };
  const history = [...(item.history ?? []).filter((h) => h !== questionId), questionId];
  const corrections = [...(item.manualCorrections ?? [])];
  if (item.calculated && before !== undefined && !same(before, ans)) corrections.push({ question: questionId, before, after: ans, at: new Date(now).toISOString() });
  const next = { ...item, answers, history, reopened, manualCorrections: corrections, recordId: q.kind === "search" ? ans.recordId : item.recordId };
  // Drop answers to questions whose condition no longer holds.
  const live = new Set(applicable(next).map((x) => x.id));
  answers = Object.fromEntries(Object.entries(answers).filter(([k]) => live.has(k)));
  return { ...next, answers, history: history.filter((h) => live.has(h)) };
}

/** "Edit previous answer": remove the last answer and go back to that question. */
export function back(item) {
  const history = [...(item.history ?? [])];
  const last = history.pop();
  if (!last) return { item, question: null };
  const answers = { ...(item.answers ?? {}) };
  delete answers[last];
  const next = { ...item, answers, history };
  return { item: next, question: questionsFor(item.dishId).find((q) => q.id === last) ?? null, previous: item.answers?.[last] };
}

/** Clear one answer so its question is asked again (used by "Change" on the review screen). */
export function reopen(item, questionId) {
  const answers = { ...(item.answers ?? {}) };
  const previous = answers[questionId];
  delete answers[questionId];
  const reopened = { ...(item.reopened ?? {}), ...(previous !== undefined ? { [questionId]: previous } : {}) };
  return { item: { ...item, answers, reopened, history: (item.history ?? []).filter((h) => h !== questionId) }, previous };
}

/** A short, readable version of an answer for the review screen. */
export function describeAnswer(q, ans, lang = "en") {
  const L = (x) => (lang === "bn" ? x.bn : x.en);
  if (!ans) return "";
  if (ans.dontKnow) return lang === "bn" ? "জানি না" : "I don't know";
  if (ans.skipped) return lang === "bn" ? "বাদ দেওয়া" : "Skipped";
  if (q.kind === "text") return ans.text;
  if (q.kind === "search") {
    if (ans.recordId) {
      const r = getRecord(ans.recordId);
      return r ? (lang === "bn" ? r.bn : r.en) : ans.recordId;
    }
    return ans.text ?? "";
  }
  if (q.kind === "share") return lang === "bn" ? `${ans.value2} / ${ans.value} পরিবেশন` : `${ans.value2} of ${ans.value} servings`;
  if (q.kind === "fields") return q.fields.filter((f) => ans[f.id] !== undefined && ans[f.id] !== "").map((f) => `${L(f)}: ${ans[f.id]}`).join(", ") || (lang === "bn" ? "কিছু যোগ হয়নি" : "Nothing added");
  const opt = q.options?.find((o) => o.id === ans.choice);
  if (!opt) return "";
  return opt.input ? `${ans.value} ${L(opt.input.unit)}` : L(opt);
}

/**
 * Tips for storing frozen fruit, only when asked for. General food-safety guidance (USDA FSIS,
 * "Freezing and Food Safety"): food kept frozen at 0 °F / −18 °C stays safe; quality, not safety,
 * declines with long storage. ASHA does not judge spoilage from a photo or from the time alone.
 */
export function storageTips(storage, lang = "en") {
  if (!storage) return [];
  const tips = [
    t("Food kept frozen at −18 °C (0 °F) or colder stays safe to eat. Long storage changes taste and texture, not calories.", "−১৮ °C (০ °F) বা তার চেয়ে ঠান্ডায় জমিয়ে রাখা খাবার খাওয়া নিরাপদ থাকে। বেশিদিন রাখলে স্বাদ ও গঠন বদলায়, ক্যালরি নয়।"),
    t("Dry, white patches (freezer burn) affect quality only. Cut them off if you like.", "শুকনো সাদা দাগ (ফ্রিজার বার্ন) শুধু মান কমায়। চাইলে কেটে ফেলুন।"),
  ];
  if (storage.frozenFor === "gt12m" || storage.frozenFor === "6to12m") tips.push(t("After many months, fruit is best used in cooking or smoothies, where texture matters less.", "অনেক মাস পর ফল রান্না বা স্মুদিতে ব্যবহার করাই ভালো, যেখানে গঠন কম গুরুত্বপূর্ণ।"));
  if (storage.freezerTemp === "thawed") tips.push(t("Fruit that thawed and was frozen again loses texture. If it thawed for a long time outside the fridge, it is safer not to eat it. ASHA can't tell this from a photo.", "গলে গিয়ে আবার জমানো ফলের গঠন নষ্ট হয়। ফ্রিজের বাইরে অনেকক্ষণ গলে থাকলে না খাওয়াই নিরাপদ। ছবি দেখে আশা এটা বলতে পারে না।"));
  tips.push(t("Source: USDA Food Safety and Inspection Service, “Freezing and Food Safety”.", "উৎস: USDA Food Safety and Inspection Service, “Freezing and Food Safety”।"));
  return tips.map((x) => (lang === "bn" ? x.bn : x.en));
}

let seq = 0;
/**
 * A new food on the plate. `capture` says how it got here (camera suggestion, upload, manual).
 * @param {string} dishId
 * @param {{method: string, modelId?: string, modelVersion?: string, suggestion?: {label: string, score: number} | null, qualityFlags?: string[]}} [capture]
 */
export function newItem(dishId, capture = { method: "manual" }) {
  seq += 1;
  return { uid: `f${Date.now().toString(36)}${seq}`, dishId, answers: {}, history: [], manualCorrections: [], capture };
}
