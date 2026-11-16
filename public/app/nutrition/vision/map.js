// The trusted registry that turns a model's class name into something ASHA can offer.
//
// This is the ONLY place a model label becomes a food. Three rules hold everywhere here:
//
//   1. A label with no catalogue food produces NO suggestion. Not a placeholder, not "something
//      else", not a guess. The region is shown as unrecognised and the person adds what they ate.
//   2. A label that could be more than one dish produces CANDIDATES with alternatives, and the
//      person chooses. A region of "rice" might be plain rice, polao, khichuri or biryani, and
//      this layer says so rather than picking one.
//   3. Every id here exists in the catalogue. There is a test that proves it.
//
// The model names INGREDIENTS (see vision/seg-labels.js). It cannot name a Bangladeshi dish. So
// biryani, khichuri, dal, rui fish and the rest enter the flow through the catalogue and the
// person's confirmation, never through an invented label.
//
// A measured warning: on a real photograph of kidney beans this model said "chocolate" with a
// score of 0.66. Over a 200-image FoodSeg103 validation sample the region-level precision was
// 65.6% and the highest-scoring wrong label was "cabbage" at 0.99. A score that high and that
// wrong is the reason every entry here is a proposal and the threshold comes from a measured
// risk-coverage curve rather than a guess.
//
// `foodId: null` means "ASHA has no food for this". The alternatives then name the dishes a
// person might have meant, if there are any worth offering.

/**
 * @typedef {Object} ClassMapping
 * @property {string|null} foodId the catalogue id, or null when ASHA has no food for this class
 * @property {string[]} alternatives other catalogue ids this region might be
 * @property {boolean} ask true when the picture alone cannot settle it
 */

/** @type {Readonly<Record<string, ClassMapping>>} */
export const CLASS_TO_FOOD = Object.freeze({
  // Grains and starches. "rice" is the single most confusable thing on a Bangladeshi plate.
  rice: { foodId: "rice-cooked", alternatives: ["khichuri", "polao", "bd-chicken-biryani"], ask: true },
  "fried rice": { foodId: "bd-chicken-biryani", alternatives: ["khichuri", "rice-cooked"], ask: true },
  noodles: { foodId: null, alternatives: [], ask: true },
  pasta: { foodId: null, alternatives: [], ask: true },
  bread: { foodId: null, alternatives: [], ask: true },
  pizza: { foodId: null, alternatives: [], ask: true },
  pie: { foodId: null, alternatives: [], ask: true },

  // Meat. The model cannot tell chicken from mutton, so every meat region asks.
  "chicken duck": { foodId: "chicken-curry", alternatives: ["mutton-curry", "beef-bhuna"], ask: true },
  "fried meat": { foodId: "chicken-curry", alternatives: ["beef-bhuna", "mutton-curry"], ask: true },
  steak: { foodId: "beef-bhuna", alternatives: ["beef-roasted"], ask: true },
  lamb: { foodId: "mutton-curry", alternatives: ["mutton-roasted"], ask: true },
  sausage: { foodId: null, alternatives: [], ask: true },
  pork: { foodId: null, alternatives: [], ask: true },

  // Fish and shellfish. The model cannot tell rui from katla from ilish.
  fish: { foodId: "fish-curry", alternatives: ["carp-cooked", "tilapia-cooked"], ask: true },
  shrimp: { foodId: null, alternatives: [], ask: true },
  shellfish: { foodId: null, alternatives: [], ask: true },
  crab: { foodId: null, alternatives: [], ask: true },

  // Eggs and dairy.
  egg: { foodId: "egg-hard-boiled", alternatives: [], ask: true },
  "egg tart": { foodId: null, alternatives: [], ask: true },
  "cheese butter": { foodId: null, alternatives: [], ask: true },
  milk: { foodId: null, alternatives: [], ask: true },

  // Vegetables. A region of a vegetable is an ingredient, not a dish, so where the catalogue
  // holds only the raw form the person is asked to correct the preparation.
  potato: { foodId: "potato-boiled", alternatives: ["alu-bhorta"], ask: true },
  carrot: { foodId: "carrot-raw", alternatives: ["mixed-vegetables"], ask: true },
  eggplant: { foodId: null, alternatives: ["mixed-vegetables", "alu-bhorta"], ask: true },
  okra: { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  tomato: { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  onion: { foodId: "onion-raw", alternatives: [], ask: true },
  garlic: { foodId: "garlic-raw", alternatives: [], ask: true },
  ginger: { foodId: "ginger-raw", alternatives: [], ask: true },
  cabbage: { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  cauliflower: { foodId: "mixed-vegetables", alternatives: [], ask: true },
  broccoli: { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  pumpkin: { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  cucumber: { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  lettuce: { foodId: null, alternatives: [], ask: true },
  "white radish": { foodId: null, alternatives: [], ask: true },
  asparagus: { foodId: null, alternatives: [], ask: true },
  "green beans": { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  "French beans": { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  "bean sprouts": { foodId: null, alternatives: [], ask: true },
  "snow peas": { foodId: null, alternatives: [], ask: true },
  "spring onion": { foodId: null, alternatives: [], ask: true },
  "cilantro mint": { foodId: null, alternatives: [], ask: true },
  "celery stick": { foodId: null, alternatives: [], ask: true },
  salad: { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  kelp: { foodId: null, alternatives: [], ask: true },
  seaweed: { foodId: null, alternatives: [], ask: true },
  rape: { foodId: null, alternatives: ["mixed-vegetables"], ask: true },
  "bamboo shoots": { foodId: null, alternatives: [], ask: true },

  // Fruit. These the model can name, and ASHA has records for the common ones.
  banana: { foodId: "banana", alternatives: [], ask: false },
  apple: { foodId: "apple-raw", alternatives: [], ask: false },
  strawberry: { foodId: "strawberries-raw", alternatives: ["strawberries-frozen-plain"], ask: true },
  mango: { foodId: "mango-raw", alternatives: [], ask: false },
  orange: { foodId: "orange-raw", alternatives: [], ask: false },
  cherry: { foodId: null, alternatives: [], ask: true },
  blueberry: { foodId: null, alternatives: [], ask: true },
  raspberry: { foodId: null, alternatives: [], ask: true },
  lemon: { foodId: null, alternatives: [], ask: true },
  pear: { foodId: null, alternatives: [], ask: true },
  peach: { foodId: null, alternatives: [], ask: true },
  pineapple: { foodId: null, alternatives: [], ask: true },
  grape: { foodId: null, alternatives: [], ask: true },
  kiwi: { foodId: null, alternatives: [], ask: true },
  melon: { foodId: null, alternatives: [], ask: true },
  watermelon: { foodId: null, alternatives: [], ask: true },
  fig: { foodId: null, alternatives: [], ask: true },
  date: { foodId: null, alternatives: [], ask: true },
  apricot: { foodId: null, alternatives: [], ask: true },
  avocado: { foodId: null, alternatives: [], ask: true },

  // Things the model confuses easily. "chocolate" on a plate of dark red beans is a real,
  // measured mistake, so it gets no food at all rather than a wrong one.
  chocolate: { foodId: null, alternatives: [], ask: true },
  cake: { foodId: null, alternatives: [], ask: true },
  biscuit: { foodId: null, alternatives: [], ask: true },
  pudding: { foodId: null, alternatives: [], ask: true },
  "ice cream": { foodId: null, alternatives: [], ask: true },
  milkshake: { foodId: null, alternatives: [], ask: true },
  candy: { foodId: null, alternatives: [], ask: true },
  popcorn: { foodId: null, alternatives: [], ask: true },
  "french fries": { foodId: null, alternatives: [], ask: true },
  coffee: { foodId: null, alternatives: [], ask: true },
  tea: { foodId: null, alternatives: [], ask: true },
  juice: { foodId: null, alternatives: [], ask: true },
  wine: { foodId: null, alternatives: [], ask: true },

  // Sweets, breads and snacks.
  "wonton dumplings": { foodId: null, alternatives: [], ask: true },
  "hanamaki baozi": { foodId: null, alternatives: [], ask: true },
  hamburg: { foodId: null, alternatives: [], ask: true },

  // Nuts, beans and soy.
  "red beans": { foodId: "dal", alternatives: ["kidney-beans-boiled", "chickpeas-boiled"], ask: true },
  almond: { foodId: null, alternatives: [], ask: true },
  cashew: { foodId: null, alternatives: [], ask: true },
  walnut: { foodId: null, alternatives: [], ask: true },
  peanut: { foodId: null, alternatives: [], ask: true },
  "dried cranberries": { foodId: null, alternatives: [], ask: true },
  soy: { foodId: null, alternatives: [], ask: true },
  tofu: { foodId: null, alternatives: [], ask: true },
  olives: { foodId: null, alternatives: [], ask: true },

  // Mushrooms.
  "king oyster mushroom": { foodId: null, alternatives: [], ask: true },
  shiitake: { foodId: null, alternatives: [], ask: true },
  "enoki mushroom": { foodId: null, alternatives: [], ask: true },
  "oyster mushroom": { foodId: null, alternatives: [], ask: true },
  "white button mushroom": { foodId: null, alternatives: [], ask: true },

  // Corn.
  corn: { foodId: null, alternatives: [], ask: true },

  // Sauces and soups. A sauce region on a Bangladeshi plate is usually the gravy of a curry.
  sauce: { foodId: null, alternatives: ["chicken-curry", "mutton-curry", "beef-bhuna", "fish-curry"], ask: true },
  soup: { foodId: "dal", alternatives: ["fish-curry", "chicken-curry"], ask: true },
});

/**
 * The candidates for a model class name.
 *
 * @param {string} className the model's class name
 * @returns {{foodId:string, alternatives:string[], ask:boolean}|null} null when the class has no
 *   catalogue food, so the caller produces no suggestion at all
 */
export function candidatesFor(className) {
  if (typeof className !== "string") return null;
  const entry = CLASS_TO_FOOD[className.trim().toLowerCase()];
  if (!entry) return null;
  if (!entry.foodId) return null;
  return { foodId: entry.foodId, alternatives: [...entry.alternatives], ask: !!entry.ask };
}

/**
 * The class names the model has, that this registry gives no food for.
 *
 * "background" and "other ingredients" are always in this list, which is correct: neither names a
 * food. The rest are the honest gaps - the model's vocabulary is far wider than ASHA's catalogue,
 * and this list is how wide.
 *
 * @param {ReadonlyArray<string>} classNames
 * @returns {string[]}
 */
export function unmappedClasses(classNames) {
  return classNames.filter((name) => !CLASS_TO_FOOD[name]);
}

/**
 * The classes this registry has no catalogue food for.
 *
 * @returns {string[]}
 */
export function classesWithoutFood() {
  return Object.keys(CLASS_TO_FOOD).filter((name) => !CLASS_TO_FOOD[name].foodId);
}
