// The 104 class names of the pinned food segmentation model, in the model's own class-index order.
//
// The names are transcribed from the model's embedded metadata (which carries them as
// "{0: 'background', 1: 'candy', ...}") and were cross-checked against the FoodSeg103 dataset's
// id2label.json. Two of them carry a leading space in the export (" hanamaki baozi", " cabbage"),
// so they are trimmed here; the trimmed list is what the rest of the code sees.
//
// The order and the spelling are pinned by tests/nutrition-seg-labels.test.mjs, which also checks
// the list against the bytes of the model file itself, so the two cannot drift apart.
//
// These are INGREDIENT-level names. The model cannot say "biryani" or "khichuri" or "dal" or
// "rui fish" - it says "rice", "chicken duck", "sauce". Turning a region into a dish is the map
// layer's job (public/app/nutrition/vision/map.js), and the person confirms it.

/** @type {ReadonlyArray<string>} */
export const SEG_CLASSES = Object.freeze([
  "background",
  "candy",
  "egg tart",
  "french fries",
  "chocolate",
  "biscuit",
  "popcorn",
  "pudding",
  "ice cream",
  "cheese butter",
  "cake",
  "wine",
  "milkshake",
  "coffee",
  "juice",
  "milk",
  "tea",
  "almond",
  "red beans",
  "cashew",
  "dried cranberries",
  "soy",
  "walnut",
  "peanut",
  "egg",
  "apple",
  "date",
  "apricot",
  "avocado",
  "banana",
  "strawberry",
  "cherry",
  "blueberry",
  "raspberry",
  "mango",
  "olives",
  "peach",
  "lemon",
  "pear",
  "fig",
  "pineapple",
  "grape",
  "kiwi",
  "melon",
  "orange",
  "watermelon",
  "steak",
  "pork",
  "chicken duck",
  "sausage",
  "fried meat",
  "lamb",
  "sauce",
  "crab",
  "fish",
  "shellfish",
  "shrimp",
  "soup",
  "bread",
  "corn",
  "hamburg",
  "pizza",
  "hanamaki baozi",
  "wonton dumplings",
  "pasta",
  "noodles",
  "rice",
  "pie",
  "tofu",
  "eggplant",
  "potato",
  "garlic",
  "cauliflower",
  "tomato",
  "kelp",
  "seaweed",
  "spring onion",
  "rape",
  "ginger",
  "okra",
  "lettuce",
  "pumpkin",
  "cucumber",
  "white radish",
  "carrot",
  "asparagus",
  "bamboo shoots",
  "broccoli",
  "celery stick",
  "cilantro mint",
  "snow peas",
  "cabbage",
  "bean sprouts",
  "onion",
  "pepper",
  "green beans",
  "French beans",
  "king oyster mushroom",
  "shiitake",
  "enoki mushroom",
  "oyster mushroom",
  "white button mushroom",
  "salad",
  "other ingredients",
]);

/** The pinned model's identity, for the log and the docs. */
export const SEG_MODEL = Object.freeze({
  id: "magnusdtd/yolov8-foodseg103",
  file: "/models/yolov8_foodseg103.onnx",
  bytes: 14707923,
  sha256: "d81ba2e44c45cead8c20581f2185928fa1a33fbf0e8643fbce4bdf476df201c5",
  license: "AGPL-3.0 (weights); FoodSeg103 dataset is Apache-2.0",
  inputSize: 768,
  classes: SEG_CLASSES.length,
  source: "https://huggingface.co/magnusdtd/yolov8-foodseg103",
  retrieved: "2026-11-16",
});

/**
 * The class name for an index, or null when the index is outside the list.
 *
 * @param {number} classId
 * @returns {string|null}
 */
export function className(classId) {
  if (!Number.isInteger(classId) || classId < 0 || classId >= SEG_CLASSES.length) return null;
  return SEG_CLASSES[classId];
}
