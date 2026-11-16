# Nutrition AI — Audit of the existing module

*Wave 0. Written before the implementation, from the repository as it stood at commit `9533f8e`.*
*The audit is kept as it was written: it describes what was there, not what is there now.*

## What the module was

ASHA had **two** Nutrition implementations that did not know about each other.

| | Where | What it is |
|---|---|---|
| Legacy Everyday | `public/app/everyday/nutrition.js`, `public/app/everyday/foods.js` | A vanilla-DOM meal journal: pick a food, type a weight, tick "I checked", save. Eleven USDA records, six editable recipe templates. |
| Dashboard V5 | `src/app/dashboard/patient/nutrition/`, `src/features/nutrition/` | A React flow with a camera, an interview, an ingredient review and a result screen. Sixteen records, a `DISHES` list, a `FOOD_VISION` map. |

Both kept their own catalogue, their own calculator and their own vocabulary. The dashboard
imported `FOODS` from the legacy module, so the *records* were shared but nothing else was.

## The ten questions

**1. How does an image enter the system?**
Through a file input (`accept="image/*"`, `capture="environment"`) in both surfaces, or through
the camera in the dashboard. The file is decoded with `createImageBitmap`, drawn to a canvas,
and checked by `checkFile` / `checkDimensions` / `checkPhotoQuality` (MIME, size, and light and
blur). **The image then went nowhere.** It was used to decide whether to continue and was
displayed as a preview. No pixel ever reached a model and no pixel ever left the device.

**2. Is there any food classification?**
Yes, and it was tiny. `public/engine/food-classifier-worker.js` ran MediaPipe
EfficientNet-Lite0 on **ImageNet-1k** — 1,000 classes of which three were food
(banana, Granny Smith, strawberry). `FOOD_VISION` in `src/features/nutrition/catalog.js:163`
mapped the 1,000 ImageNet labels onto exactly those three, with a hard-coded confidence
threshold. It ran in the live camera loop at ~2.5 Hz on a 224×224 crop.

**3. How are calories computed?**
`estimateMeal` in `src/features/nutrition/engine.js` multiplied each item's per-100 g values by
its weight, summed them, and produced a `{min, max}` range from the interview's answers. The
numbers came from `FOOD_RECORDS`, which the header of `catalog.js` documents honestly: eleven
records were checked against the USDA API, and five more were transcribed by hand from two
published copies of the same USDA data because the API host was blocked at the time. Those five
are marked `cross_checked` and their fibre is left unknown.

**4. Is a portion assumed?**
Yes — and this was the largest source of error. Portions were assumed to be *servings* of
*ingredients*. `toGrams(amount, unit, gramsPerServing)` multiplied a number of servings by a
number the person typed. There was no picture-based portion, no household measure, and no
reference object.

**5. Is multiple food supported?**
In the *interview*, yes: the dashboard could ask about several `DISHES`. From a *photograph*,
no: the classifier returned three possible labels from a whole-frame crop of the centre of the
picture, so two foods side by side were one food at best.

**6. Can the user correct it?**
The interview was fully correctable — every question could be reopened and changed, and
`correction calculations do not mutate originals` was a tested property. The classifier's
suggestions could be removed but not *replaced*: there was no catalogue search in the V5 flow,
only the `DISHES` list.

**7. How is uncertainty handled?**
By status strings — `estimate`, `range`, `lower_bound`, `uncertain`, `unavailable` — and by a
`{min, max}` range on every nutrient. A food with no record produced `null`, never `0`, and was
listed in `excluded` rather than counted as zero. This was the module's strongest property and
it was kept.

**8. Is there a meal history?**
Yes, in the browser, under the `nutrition_v5` key in `src/lib/storage.ts`, capped at 500 meals
with a 200-entry audit trail. **It was only ever in the browser.** There was no server-side meal
record at all.

**9. How are the privacy boundaries kept?**
Strictly: no image was uploaded, no food image was stored, no server call carried a picture.
The server had no Nutrition endpoint at all.

**10. What did the documentation claim?**
`docs/NUTRITION_V5.md` was accurate and unflattering: *"ASHA does not recognise meals from
photos"*, and it named the blocker as *"a licensed/evaluated Bangladesh food classifier and
segmentation/portion dataset"*. The `FOOD_VISION` map had three foods and a hard-coded
threshold with no evaluation behind it.

## The defects, in order of how much they mattered

1. **The only classifier was trained on ImageNet.** It could see three fruits. It was asked
   about plates of food. The threshold (`FOOD_VISION`) was a constant with no measurement
   behind it, so the app could confidently suggest "banana" for a plate of curry.
2. **No segmentation.** The classifier cropped the centre square of the frame. There was no
   concept of "where on the plate is each food", so there was nothing to estimate a portion
   from even in principle.
3. **One bowl does not weigh the same for every food.** Portions were ingredient weights, not
   food weights, and there was no path from a picture to a weight at all.
4. **Two catalogues, two calculators, two vocabularies.** The legacy app and the dashboard
   disagreed about what "dal" was.
5. **Meals existed only in the browser.** A caregiver could not see them; a lost device lost
   them.
6. **The ImageNet worker and the ONNX runtime both ran on the phone**, and the ONNX runtime was
   fetched unpinned from a CDN at run time (`public/engine/yolo-worker.js:9-10`), so the "pinned
   weights" claim did not cover the runtime and offline use of the posture model was not actually
   offline.
7. **The `FOOD_VISION` map referenced foods that did not exist in the catalogue**, and the
   confidence threshold was a magic number.

## What was reusable

- The status vocabulary and the `{min, max}` ranges.
- The "unknown is `null`, never `0`" rule.
- The interview and its correction model.
- `checkPhotoQuality` and the image validation order.
- The storage abstraction and the role-separated credential model.
- The `FOOD_RECORDS` verification statuses and their provenance discipline.
- The pattern of loading browser inference from `/engine/*.js` at runtime, outside the bundler.

## What had to be built

- A catalogue that covers Bangladeshi food, sourced rather than typed.
- A model that segments rather than classifies a whole frame.
- A portion path that is honest about its uncertainty.
- One shared domain (catalogue, calculator, contract) that both surfaces and the server import.
- A server-side, role-separated meal record.
- A confirmation screen where a correction overrides the proposal.

## Why the blocker in `docs/NUTRITION_V5.md` was only half true

The blocker named two things: a *licensed/evaluated* classifier, and a *segmentation/portion*
dataset.

The second is now solved: FoodSeg103 (Apache-2.0) ships as a YOLOv8n-seg ONNX export, and the
model's licence is compatible with the repository's existing YOLO precedent.

The first is **not** solved and cannot be: no permissively licensed, labelled dataset of
Bangladeshi food photographs exists that anyone has published. What exists are Western
ingredients. The consequence is structural and permanent for now: **ASHA can segment food and
offer candidates; it cannot name a Bangladeshi dish.** Every dish enters through the catalogue
and the person's confirmation, and no document in this repository claims otherwise.
