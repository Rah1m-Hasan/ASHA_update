import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SEG_CLASSES, SEG_MODEL, className } from "../public/app/nutrition/vision/seg-labels.js";

// The class list is the one thing that connects a number the model produces to a word a person
// reads. If it drifts, every proposal gets the wrong name. These tests check it against the
// model file's own bytes, so the two cannot disagree.

const MODEL_PATH = "public/models/yolov8_foodseg103.onnx";

test("the class list has the model's own number of classes", () => {
  assert.equal(SEG_CLASSES.length, 104);
  assert.equal(SEG_MODEL.classes, 104);
  assert.equal(new Set(SEG_CLASSES).size, SEG_CLASSES.length, "class names must be unique");
});

test("the background class is first and is never a food", () => {
  assert.equal(SEG_CLASSES[0], "background");
});

test("every class name appears verbatim in the model file", async () => {
  const bytes = await readFile(MODEL_PATH);
  const text = bytes.toString("latin1");
  for (const name of SEG_CLASSES) {
    // The export stores the names with its own quoting. Two of them (" hanamaki baozi" and
    // " cabbage") carry a leading space in the export itself, so both spellings are accepted.
    const found = text.includes(`'${name}'`) || text.includes(`' ${name}'`) || text.includes(`"${name}"`);
    assert.ok(found, `class name "${name}" is not in the model's own metadata`);
  }
});

test("the class names appear in the model file in class-index order", async () => {
  // The export stores the names as one metadata_props entry holding a dictionary, so the offsets
  // of the names rise with the class index. If they did not, the list would be mis-ordered.
  const bytes = await readFile(MODEL_PATH);
  const text = bytes.toString("latin1");
  let previous = -1;
  for (const name of SEG_CLASSES) {
    let index = text.indexOf(`'${name}'`);
    if (index < 0) index = text.indexOf(`' ${name}'`);
    if (index < 0) continue; // covered by the previous test
    assert.ok(index > previous, `class "${name}" appears before the class before it`);
    previous = index;
  }
});

test("the model file is the one that is pinned", async () => {
  const bytes = await readFile(MODEL_PATH);
  assert.equal(bytes.length, SEG_MODEL.bytes);
});

test("a class index outside the list has no name", () => {
  assert.equal(className(0), "background");
  assert.equal(className(103), "other ingredients");
  for (const bad of [-1, 104, 1000, 1.5, NaN, null, undefined, "3"])
    assert.equal(className(bad), null);
});

test("the list holds no Bangladeshi dish name, because the model cannot name one", () => {
  // This test is a guard on a claim, not on the code: the model's vocabulary is ingredient-level
  // and Western. A dish like biryani or khichuri can only enter through the catalogue and the
  // person's confirmation, so if one ever appears here the naming has been invented.
  const lower = SEG_CLASSES.map((c) => c.toLowerCase());
  for (const dish of [
    "biryani",
    "khichuri",
    "polao",
    "polao",
    "dal",
    "daal",
    "rui",
    "katla",
    "ilish",
    "hilsa",
    "mutton curry",
    "beef bhuna",
    "kebab",
    "shak",
    "bhorta",
    "singara",
    "piyaju",
    "beguni",
    "fuchka",
    "chotpoti",
    "chira",
    "roti",
    "paratha",
  ])
    assert.ok(!lower.includes(dish), `"${dish}" must not be a model class name`);
});
