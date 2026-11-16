// The Bangladeshi dishes, assembled from the USDA-backed records.
//
// WHAT A RECIPE IS HERE
//
// A recipe is a list of ingredients with weights, a cooking method, and a cooked yield. It is
// NOT a single nutrition record: its nutrients are computed from its ingredients by the engine
// (public/app/nutrition/engine.js), so a change to an ingredient's USDA record changes the dish's
// numbers automatically.
//
// The rules this file follows:
//
//   - A dish is never a copy of another dish. A generic biryani does not stand in for a chicken
//     biryani, and a chicken curry does not stand in for a mutton curry. If the meat is not
//     known, the dish is not offered.
//   - Every ingredient points at a record in records.js. There are no invented ingredients and no
//     invented numbers. If a record is missing, the dish is not here.
//   - Cooking oil is an INGREDIENT with a weight, not an afterthought. A curry without its oil is
//     not the dish, and oil is 120 kcal per tablespoon.
//   - Raw weights and cooked weights are kept apart. A recipe's ingredients are raw; its yield is
//     the cooked weight. The WATER the cooking uses is stated too, because rice absorbs it and a
//     dal boils most of it away. Without that number the cooked yield would look like a mistake:
//     200 g of dry rice weighs about 400 g once cooked, and a reader is entitled to know why.
//   - Every assumption is written down in `assumptions[]`, in English and Bangla, and shown to the
//     person. An assumption that is not shown is a hidden assumption.
//   - A dish whose composition ASHA cannot know stays name-only. It is not here.
//
// The recipes are deliberately ten, not thirty. A large set of half-specified dishes would be
// untestable and unmaintainable, and every dish added would need the same verification.

/**
 * @typedef {Object} RecipeIngredient
 * @property {string} foodId the record in records.js this ingredient uses
 * @property {number} grams the raw weight, per the recipe's yield
 * @property {"raw"|"cooked"} state the state that weight is in
 * @property {string} role "main" | "aromatic" | "oil" | "spice" | "garnish"
 */

/**
 * @typedef {Object} Recipe
 * @property {string} id
 * @property {string} en
 * @property {string} bn
 * @property {string[]} aliases
 * @property {string} category
 * @property {RecipeIngredient[]} ingredients
 * @property {number} cookedYieldGrams the weight of the dish after cooking
 * @property {number} waterAddedGrams the water the cooking uses, which is absorbed or boiled off
 * @property {number} servings how many servings the yield makes
 * @property {{en:string, bn:string}[]} assumptions
 * @property {string[]} missingInputs what ASHA still needs to be told
 * @property {string[]} interchangeable the dish ids that may be swapped in, with a reason
 */

/** @type {ReadonlyArray<Recipe>} */
export const RECIPES = Object.freeze([
  {
    id: "chicken-curry",
    en: "Chicken curry",
    bn: "মুরগির ঝোল",
    aliases: ["murgir jhol", "chicken curry", "murgi", "curry chicken"],
    category: "curry",
    ingredients: [
      { foodId: "chicken-roasted", grams: 250, state: "cooked", role: "main" },
      { foodId: "onion-raw", grams: 120, state: "raw", role: "aromatic" },
      { foodId: "garlic-raw", grams: 15, state: "raw", role: "aromatic" },
      { foodId: "ginger-raw", grams: 15, state: "raw", role: "aromatic" },
      { foodId: "tomato-raw", grams: 100, state: "raw", role: "aromatic" },
      { foodId: "oil-mustard", grams: 18, state: "raw", role: "oil" },
      { foodId: "turmeric", grams: 2, state: "raw", role: "spice" },
      { foodId: "chili-pepper", grams: 2, state: "raw", role: "spice" },
      { foodId: "coriander-seed", grams: 2, state: "raw", role: "spice" },
      { foodId: "cumin-seed", grams: 2, state: "raw", role: "spice" },
    ],
    cookedYieldGrams: 420, waterAddedGrams: 200,
    servings: 2,
    assumptions: [
      {
        en: "The chicken is counted as roasted chicken breast with the skin off. Fried chicken carries more oil, and ASHA cannot see the skin from a photo.",
        bn: "মুরগির ওজন রোস্ট করা মুরগির বুকের হিসাবে নেওয়া হয়েছে, খোসা ছাড়া। ভাজা মুরগিতে তেল বেশি থাকে, আর ছবি থেকে খোসা বোঝা যায় না।",
      },
      {
        en: "The oil is 3 tablespoons of mustard oil. A home kitchen often uses more or less, so tell ASHA if this was different.",
        bn: "তেল ৩ টেবিল চামচ সরিষার তেল ধরা হয়েছে। ঘরে সাধারণত এর বেশি বা কম হয়, তাই ভিন্ন হলে আশাকে জানান।",
      },
    ],
    missingInputs: [],
    interchangeable: [
      { foodId: "oil-soybean", why: "Many households cook with soybean oil instead of mustard oil." },
      { foodId: "oil-palm", why: "Some households use palm oil." },
    ],
  },
  {
    id: "beef-bhuna",
    en: "Beef bhuna",
    bn: "গরুর ভুনা",
    aliases: ["gorir bhuna", "beef bhuna", "bhuna", "beef curry"],
    category: "curry",
    ingredients: [
      { foodId: "beef-roasted", grams: 250, state: "cooked", role: "main" },
      { foodId: "onion-raw", grams: 150, state: "raw", role: "aromatic" },
      { foodId: "garlic-raw", grams: 20, state: "raw", role: "aromatic" },
      { foodId: "ginger-raw", grams: 20, state: "raw", role: "aromatic" },
      { foodId: "tomato-raw", grams: 120, state: "raw", role: "aromatic" },
      { foodId: "oil-mustard", grams: 24, state: "raw", role: "oil" },
      { foodId: "cumin-seed", grams: 3, state: "raw", role: "spice" },
      { foodId: "coriander-seed", grams: 3, state: "raw", role: "spice" },
      { foodId: "chili-pepper", grams: 3, state: "raw", role: "spice" },
      { foodId: "cinnamon", grams: 1, state: "raw", role: "spice" },
    ],
    cookedYieldGrams: 400, waterAddedGrams: 250,
    servings: 2,
    assumptions: [
      {
        en: "The beef is counted as roasted tenderloin. A fattier cut carries more energy, and ASHA cannot tell the cut from a photo.",
        bn: "গরুর মাংসের ওজন রোস্ট করা টেন্ডারলয়িনের হিসাবে নেওয়া হয়েছে। চর্বি বেশি থাকলে ক্যালরি বেশি হয়, আর ছবি থেকে কাট বোঝা যায় না।",
      },
      {
        en: "Bhuna is cooked down for a long time, so the oil is 4 tablespoons. Much of the water goes off, so the dish weighs less than its raw ingredients.",
        bn: "ভুনা ধীরে ধীরে রান্না হয়, তাই তেল ৪ টেবিল চামচ ধরা হয়েছে। অনেক পানি বেরিয়ে যায়, তাই খাবারের ওজন কাঁচা উপকরণের চেয়ে কম।",
      },
    ],
    missingInputs: [],
    interchangeable: [{ foodId: "beef-ground-70", why: "Some households use minced beef for bhuna." }],
  },
  {
    id: "mutton-curry",
    en: "Mutton curry",
    bn: "ছাগলের ঝোল",
    aliases: ["khashir jhol", "mutton curry", "khasi", "goat curry"],
    category: "curry",
    ingredients: [
      { foodId: "mutton-roasted", grams: 250, state: "cooked", role: "main" },
      { foodId: "onion-raw", grams: 120, state: "raw", role: "aromatic" },
      { foodId: "garlic-raw", grams: 15, state: "raw", role: "aromatic" },
      { foodId: "ginger-raw", grams: 15, state: "raw", role: "aromatic" },
      { foodId: "tomato-raw", grams: 100, state: "raw", role: "aromatic" },
      { foodId: "oil-mustard", grams: 18, state: "raw", role: "oil" },
      { foodId: "cumin-seed", grams: 2, state: "raw", role: "spice" },
      { foodId: "coriander-seed", grams: 2, state: "raw", role: "spice" },
      { foodId: "cinnamon", grams: 1, state: "raw", role: "spice" },
      { foodId: "chili-pepper", grams: 2, state: "raw", role: "spice" },
    ],
    cookedYieldGrams: 400, waterAddedGrams: 200,
    servings: 2,
    assumptions: [
      {
        en: "The mutton is counted as roasted lamb with the fat left on. Mutton with the fat trimmed off carries less energy.",
        bn: "ছাগলের মাংসের ওজন রোস্ট করা ল্যাম্বের হিসাবে নেওয়া হয়েছে, চর্বি রেখে দেওয়া অবস্থায়। চর্বি ছাড়ালে ক্যালরি কম হয়।",
      },
      {
        en: "The oil is 3 tablespoons of mustard oil.",
        bn: "তেল ৩ টেবিল চামচ সরিষার তেল ধরা হয়েছে।",
      },
    ],
    missingInputs: [],
    interchangeable: [],
  },
  {
    id: "fish-curry",
    en: "Fish curry",
    bn: "মাছের ঝোল",
    aliases: ["macher jhol", "fish curry", "rui", "katla", "rui fish curry", "mach"],
    category: "curry",
    ingredients: [
      { foodId: "carp-cooked", grams: 250, state: "cooked", role: "main" },
      { foodId: "onion-raw", grams: 80, state: "raw", role: "aromatic" },
      { foodId: "garlic-raw", grams: 10, state: "raw", role: "aromatic" },
      { foodId: "ginger-raw", grams: 10, state: "raw", role: "aromatic" },
      { foodId: "turmeric", grams: 2, state: "raw", role: "spice" },
      { foodId: "chili-pepper", grams: 2, state: "raw", role: "spice" },
      { foodId: "oil-mustard", grams: 18, state: "raw", role: "oil" },
      { foodId: "coriander-seed", grams: 2, state: "raw", role: "spice" },
    ],
    cookedYieldGrams: 350, waterAddedGrams: 180,
    servings: 2,
    assumptions: [
      {
        en: "The fish is counted as carp. ASHA uses carp for rui and katla because both are carp, and both are close in food value. Ilish is a different fish and has more fat, so tell ASHA if that is what it was.",
        bn: "মাছের ওজন রুই হিসেবে নেওয়া হয়েছে। রুই ও কাতলা দুটোই কার্প জাতীয় এবং খাদ্যমূল্য কাছাকাছি। ইলিশ আলাদা মাছ এবং চর্বি বেশি, তাই ইলিশ হলে আশাকে জানান।",
      },
      {
        en: "The oil is 3 tablespoons of mustard oil.",
        bn: "তেল ৩ টেবিল চামচ সরিষার তেল ধরা হয়েছে।",
      },
    ],
    missingInputs: [],
    interchangeable: [{ foodId: "tilapia-cooked", why: "Tilapia is sometimes used instead of rui." }],
  },
  {
    id: "bd-chicken-biryani",
    en: "Chicken biryani",
    bn: "চিকেন বিরিয়ানি",
    aliases: ["chicken biryani", "biryani", "biriyani", "kachi biryani", "dhaka biryani"],
    category: "rice_dish",
    ingredients: [
      { foodId: "rice-raw", grams: 200, state: "raw", role: "main" },
      { foodId: "chicken-roasted", grams: 200, state: "cooked", role: "main" },
      { foodId: "onion-raw", grams: 150, state: "raw", role: "aromatic" },
      { foodId: "oil-mustard", grams: 24, state: "raw", role: "oil" },
      { foodId: "yogurt-plain-whole", grams: 80, state: "raw", role: "aromatic" },
      { foodId: "garlic-raw", grams: 12, state: "raw", role: "aromatic" },
      { foodId: "ginger-raw", grams: 12, state: "raw", role: "aromatic" },
      { foodId: "cumin-seed", grams: 3, state: "raw", role: "spice" },
      { foodId: "coriander-seed", grams: 3, state: "raw", role: "spice" },
      { foodId: "cinnamon", grams: 2, state: "raw", role: "spice" },
      { foodId: "chili-pepper", grams: 2, state: "raw", role: "spice" },
      { foodId: "turmeric", grams: 2, state: "raw", role: "spice" },
    ],
    cookedYieldGrams: 480, waterAddedGrams: 250,
    servings: 2,
    assumptions: [
      {
        en: "The rice is counted as dry rice, because that is what goes into the pot. The cooked weight is what the recipe yields.",
        bn: "চালের ওজন শুকনো চাল হিসেবে নেওয়া হয়েছে, কারণ পাত্রে শুকনো চালই যায়। রান্নার পরের ওজনই রেসিপির ফলন।",
      },
      {
        en: "The oil is 4 tablespoons. Kacchi biryani and dhaka biryani use more oil and more meat than this, so this is the lighter end.",
        bn: "তেল ৪ টেবিল চামচ। কাচি বিরিয়ানি ও ঢাকা বিরিয়ানিতে এর চেয়ে বেশি তেল ও মাংস থাকে, তাই এটি হালকা দিকের।",
      },
      {
        en: "Saffron and kewra water add a little energy but no measured amount, so they are left out rather than guessed at.",
        bn: "জাফরান ও কেওয়রা জলে সামান্য ক্যালরি যোগ হয়, কিন্তু সঠিক পরিমাণ জানা নেই, তাই অনুমান না করে বাদ দেওয়া হয়েছে।",
      },
    ],
    missingInputs: [],
    interchangeable: [],
  },
  {
    id: "khichuri",
    en: "Khichuri",
    bn: "খিচুড়ি",
    aliases: ["khichuri", "khichri", "khichoodi", "khichdi"],
    category: "rice_dish",
    ingredients: [
      { foodId: "rice-raw", grams: 180, state: "raw", role: "main" },
      { foodId: "lentils-boiled", grams: 100, state: "cooked", role: "main" },
      { foodId: "onion-raw", grams: 80, state: "raw", role: "aromatic" },
      { foodId: "oil-mustard", grams: 18, state: "raw", role: "oil" },
      { foodId: "turmeric", grams: 2, state: "raw", role: "spice" },
      { foodId: "cumin-seed", grams: 2, state: "raw", role: "spice" },
      { foodId: "chili-pepper", grams: 2, state: "raw", role: "spice" },
      { foodId: "ginger-raw", grams: 8, state: "raw", role: "aromatic" },
    ],
    cookedYieldGrams: 360, waterAddedGrams: 150,
    servings: 2,
    assumptions: [
      {
        en: "Khichuri is made with split lentils, not whole ones, and they cook down further. The lentils are counted as boiled lentils.",
        bn: "খিচুড়িতে ভাঙা ডাল ব্যবহার হয়, পুরো নয়, আর সেটা আরও ফুটে যায়। ডালকে সেদ্ধ ডাল হিসেবে ধরা হয়েছে।",
      },
      {
        en: "The oil is 3 tablespoons of mustard oil. Some kitchens use ghee instead - tell ASHA and the number will change.",
        bn: "তেল ৩ টেবিল চামচ সরিষার তেল। কিছু রান্নাঘরে ঘি ব্যবহার হয় - আশাকে জানালে হিসাব বদলে যাবে।",
      },
    ],
    missingInputs: [],
    interchangeable: [],
  },
  {
    id: "polao",
    en: "Polao",
    bn: "পোলাও",
    aliases: ["polao", "pilau", "pulao", "biriani rice", "plain pilaf"],
    category: "rice_dish",
    ingredients: [
      { foodId: "rice-raw", grams: 200, state: "raw", role: "main" },
      { foodId: "oil-mustard", grams: 20, state: "raw", role: "oil" },
      { foodId: "onion-raw", grams: 120, state: "raw", role: "aromatic" },
      { foodId: "garlic-raw", grams: 8, state: "raw", role: "aromatic" },
      { foodId: "ginger-raw", grams: 8, state: "raw", role: "aromatic" },
      { foodId: "cumin-seed", grams: 2, state: "raw", role: "spice" },
      { foodId: "cinnamon", grams: 1, state: "raw", role: "spice" },
    ],
    cookedYieldGrams: 400, waterAddedGrams: 120,
    servings: 2,
    assumptions: [
      {
        en: "Polao has no meat in it. Biryani does, and the two are counted separately.",
        bn: "পোলাওতে মাংস থাকে না। বিরিয়ানিতে থাকে, এবং দুটি আলাদা করে ধরা হয়েছে।",
      },
      {
        en: "The oil is about 3½ tablespoons. A richer polao uses more.",
        bn: "তেল প্রায় ৩½ টেবিল চামচ। বেশি তেলের পোলাওতে এর চেয়ে বেশি হয়।",
      },
    ],
    missingInputs: [],
    interchangeable: [],
  },
  {
    id: "dal",
    en: "Dal",
    bn: "ডাল",
    aliases: ["dal", "daal", "masur dal", "lentil soup", "mosur dal"],
    category: "curry",
    ingredients: [
      { foodId: "lentils-boiled", grams: 200, state: "cooked", role: "main" },
      { foodId: "oil-mustard", grams: 12, state: "raw", role: "oil" },
      { foodId: "onion-raw", grams: 50, state: "raw", role: "aromatic" },
      { foodId: "garlic-raw", grams: 6, state: "raw", role: "aromatic" },
      { foodId: "ginger-raw", grams: 6, state: "raw", role: "aromatic" },
      { foodId: "turmeric", grams: 2, state: "raw", role: "spice" },
      { foodId: "cumin-seed", grams: 2, state: "raw", role: "spice" },
      { foodId: "chili-pepper", grams: 1, state: "raw", role: "spice" },
    ],
    cookedYieldGrams: 240, waterAddedGrams: 400,
    servings: 2,
    assumptions: [
      {
        en: "The lentils are counted as boiled lentils. A thin dal has more water and so weighs less for the same spoonful.",
        bn: "ডাল সেদ্ধ ডাল হিসেবে ধরা হয়েছে। পাতলা ডালে পানি বেশি থাকে, তাই একই চামচে ওজন কম।",
      },
      {
        en: "The oil is 2 tablespoons, used for the tadka. Dal without any oil at all would be much lower in energy.",
        bn: "তেল ২ টেবিল চামচ, তড়কার জন্য। তেল ছাড়া ডালের ক্যালরি অনেক কম হতো।",
      },
    ],
    missingInputs: [],
    interchangeable: [{ foodId: "chickpeas-boiled", why: "Some households make dal with chickpeas instead of lentils." }],
  },
  {
    id: "alu-bhorta",
    en: "Alu bhorta",
    bn: "আলুর ভর্তা",
    aliases: ["alu bhorta", "aloo bhorta", "bhorta", "potato bharta", " mashed potato"],
    category: "vegetable_dish",
    ingredients: [
      { foodId: "potato-boiled", grams: 250, state: "cooked", role: "main" },
      { foodId: "oil-mustard", grams: 10, state: "raw", role: "oil" },
      { foodId: "onion-raw", grams: 40, state: "raw", role: "aromatic" },
      { foodId: "ginger-raw", grams: 6, state: "raw", role: "aromatic" },
      { foodId: "chili-pepper", grams: 1, state: "raw", role: "spice" },
      { foodId: "turmeric", grams: 1, state: "raw", role: "spice" },
    ],
    cookedYieldGrams: 220, waterAddedGrams: 40,
    servings: 1,
    assumptions: [
      {
        en: "The potato is counted as boiled potato without salt. Salt adds no energy, so it does not change the number.",
        bn: "আলু সেদ্ধ ও লবণ ছাড়া হিসেবে ধরা হয়েছে। লবণে ক্যালরি নেই, তাই হিসাব বদলায় না।",
      },
      {
        en: "The oil is about 2 teaspoons of mustard oil for the tempering.",
        bn: "তেল প্রায় ২ চা চামচ সরিষার তেল, তেল দেওয়ার জন্য।",
      },
    ],
    missingInputs: [],
    interchangeable: [],
  },
  {
    id: "mixed-vegetables",
    en: "Mixed vegetables",
    bn: "মিক্সড সবজি",
    aliases: ["mixed vegetables", "shak", "vegetables", "mixed veg", "shak bhaja"],
    category: "vegetable_dish",
    ingredients: [
      { foodId: "potato-boiled", grams: 120, state: "cooked", role: "main" },
      { foodId: "carrot-raw", grams: 60, state: "raw", role: "main" },
      { foodId: "eggplant-raw", grams: 60, state: "raw", role: "main" },
      { foodId: "okra-raw", grams: 50, state: "raw", role: "main" },
      { foodId: "cauliflower-raw", grams: 80, state: "raw", role: "main" },
      { foodId: "onion-raw", grams: 60, state: "raw", role: "aromatic" },
      { foodId: "oil-mustard", grams: 14, state: "raw", role: "oil" },
      { foodId: "garlic-raw", grams: 6, state: "raw", role: "aromatic" },
      { foodId: "turmeric", grams: 1, state: "raw", role: "spice" },
    ],
    cookedYieldGrams: 400, waterAddedGrams: 150,
    servings: 2,
    assumptions: [
      {
        en: "This is a plain vegetable fry. A bhaji with more oil, or a shak with different vegetables, will not match it exactly.",
        bn: "এটি সাধারণ ভাজা সবজি। বেশি তেলের ভাজি বা অন্য সবজির শাক হলে হিসাব হুবহু মিলবে না।",
      },
      {
        en: "The vegetables are counted raw, because that is their weight before cooking. The cooked weight is smaller.",
        bn: "সবজির ওজন কাঁচা অবস্থায় ধরা হয়েছে, কারণ রান্নার আগে এই ওজনই থাকে। রান্নার পর ওজন কমে যায়।",
      },
      {
        en: "The oil is about 2½ tablespoons. Vegetables take up more oil than most people expect.",
        bn: "তেল প্রায় ২½ টেবিল চামচ। সবজিতে অনেকের চেয়ে বেশি তেল লাগে।",
      },
    ],
    missingInputs: [],
    interchangeable: [],
  },
]);

/** The recipe ids, for lookup. */
export const RECIPE_IDS = Object.freeze(RECIPES.map((r) => r.id));
