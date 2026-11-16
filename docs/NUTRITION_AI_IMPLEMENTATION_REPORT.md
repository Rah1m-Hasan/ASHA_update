# Nutrition AI — Implementation report

*Branch `rahim/neurobridge-asha-accuracy-improvements`. Everything below describes work done on
this branch. The four other deliverable documents are `NUTRITION_AI_AUDIT.md`,
`NUTRITION_AI_ARCHITECTURE.md`, `NUTRITION_AI_ACCURACY_REPORT.md` and `NUTRITION_AI_DATASET_GUIDE.md`.*

---

## 1. The original architecture

Two Nutrition implementations that did not know about each other: a vanilla-DOM meal journal in
`public/app/everyday/`, and a React camera-and-interview flow in `src/features/nutrition/`. Both
kept their own catalogue, calculator and vocabulary. The only image capability was an
ImageNet-1k classifier that could see three fruits, cropped from the centre of the frame, with
a hard-coded threshold. No segmentation, no portion estimate, no server-side meal record.

## 2. The problems discovered

1. The only classifier was trained on ImageNet and was asked about plates of food.
2. No segmentation, so there was nothing to estimate a portion from even in principle.
3. Portions were ingredient weights, not food weights.
4. Two catalogues, two calculators, two vocabularies.
5. Meals existed only in the browser.
6. The ONNX runtime was fetched **unpinned from a CDN at run time**, so the "pinned weights"
   claim did not cover the runtime and offline use was not actually offline.
7. The `FOOD_VISION` map referenced foods that did not exist, at a threshold with no evaluation.

## 3. What was built

### The shared domain — `public/app/nutrition/` (new)

| File | What it is |
|---|---|
| `catalogue/records.js` | **Generated.** 76 USDA SR Legacy records with per-100 g nutrients, household portion weights, source and verification status. |
| `catalogue/recipes.js` | 10 Bangladeshi dishes assembled *from* those records: chicken curry, beef bhuna, mutton curry, fish curry, chicken biryani, khichuri, polao, dal, alu bhorta, mixed vegetables. |
| `catalogue/index.js` | Lookup, EN + বাংলা + synonym search, household portions, area-defining portions. |
| `engine.js` | The one calculator: integer milli-unit arithmetic, recipes, meals. |
| `portion.js` | Areal density, reference-object calibration, uncertainty, reconciliation. |
| `vision/map.js` | The trusted registry: model class → catalogue candidates. |
| `vision/contract.js` | The validated structured output, built from an explicit field list. |
| `vision/policy.js` | The two independent gates (identity, portion). |
| `vision/quality.js` | Image quality and the bilingual message for each problem. |
| `vision/seg-codec.js` | The pure-JS YOLOv8 segmentation decode. |
| `vision/seg-labels.js` | The FoodSeg103 label map. |

### The browser side — new

`public/engine/food-segmenter-worker.js` (the ONNX worker), `public/engine/ort-wasm-simd-threaded.{wasm,mjs}`
(the **vendored** runtime), `public/engine/manifest.json`, `public/models/yolov8_foodseg103.onnx`,
`public/models/FOODSEG-LICENSE.txt`.

### The React side — new

`src/features/nutrition/Review.tsx` (the confirmation screen), `src/features/nutrition/VisionResult.tsx`
(the result), `src/features/nutrition/useFoodSegmenter.ts` (the worker hook and the region →
review-row mapping).

### The server side — new

`src/server/handlers/nutrition.js` and `src/app/api/nutrition/route.ts`.

### The scripts — new

`scripts/build-nutrition-catalogue.mjs` (generates the catalogue from the USDA CSV),
`scripts/nutrition-benchmark.mjs` (the segmentation benchmark),
`scripts/nutrition-catalogue-benchmark.mjs` (the nutrition accuracy benchmark),
`scripts/nutrition-fetch-dataset.mjs`, `scripts/nutrition-find-sources.mjs`,
`scripts/nutrition-suggest-sources.mjs`, `scripts/lib/csv.mjs`.

## 4. Files modified, and why

| File | Why |
|---|---|
| `src/app/dashboard/patient/nutrition/page.tsx` | The photo path now runs the segmenter and goes to the new review screen; the confirmed meal is calculated, shown and saved. |
| `src/features/nutrition/state.js` | Added `VISION_REVIEW` and `VISION_RESULT` and their transitions. |
| `src/features/nutrition/Results.tsx` | Added the `derived_recipe` case to `verificationText`. Without it the fallback `return v` would leak a raw token into the interface. |
| `src/lib/api.ts` | Widened the endpoint union to include `"nutrition"`. |
| `public/app/everyday/foods.js` | The catalogue's records were merged into the legacy food list; `foodVisionStatus()` now reports the **real** model, licence and measured accuracy instead of a standing `{available: false}`. |
| `public/app/everyday/nutrition.js` | The legacy surface gained the same "find the food in this picture" flow, reusing the shared domain, in the existing `.card` / `.notice` / `.primary` design language. |
| `public/app/everyday/contracts.js` | `FEATURES.foodVision` is now `true` — the evaluation exists. |
| `public/sw.js` | Cache bumped `asha-everyday-v2` → `v3`; the new shared domain and the worker added to `EVERYDAY_ASSETS`; the vendored ORT `.mjs` loaders added to the immutable-asset rule. |
| `scripts/model-integrity.mjs`, `tests/model-integrity.test.mjs` | The new model and the new runtime manifest are pinned and checked. |
| `.gitignore` | `datasets/` is ignored: third-party photographs are fetched, not committed. |
| `tests/everyday-nutrition.test.mjs` | Two assertions changed because the behaviour changed, on purpose (below). |

### The two test assertions that had to change

- `searchFoods("").length` was `FOODS.length` (11). It is now `ALL_FOODS.length` (46). The
  **eleven legacy records are unchanged** — the assertion for that was added, and the search
  now covers the wider catalogue.
- `foodVisionStatus().available` was `false` with a fixed reason. It now reports the real
  status, and the test asserts the real model id, licence, measured numbers and — importantly —
  that the reason still says the model **cannot name a Bangladeshi dish**.

No test was weakened to make a suite pass, and no unrelated module was changed.

## 5. Models evaluated

| Model | Size | Licence | Outcome |
|---|---|---|---|
| **YOLOv8n-seg (FoodSeg103, 768)** | 14.7 MB | AGPL-3.0 weights, Apache-2.0 dataset | **Selected.** Gives masks, which is what portion estimation needs. |
| ONNX Runtime Web 1.22 (SIMD, threaded) | 11.2 MB + 21 KB | MIT | **Selected, vendored.** |
| `AlexKoff88/mobilenet_v2_food101` | 9.8 MB | Apache-2.0 | **Rejected: broken.** Its ONNX graph contains all-zero convolution weights and an all-zero classifier bias, so it outputs a uniform vector for every input — a uniform 0.0099 softmax over all 101 classes on every image. It looks alive and is silently useless, and no size-and-hash check can see it. |
| Food-101 dish classifier | ~34 MB | Images owned by Foodspotting; use beyond scientific fair use requires negotiation | **Rejected: licence.** Shipping a classifier trained on those images carries that ambiguity into the app. |
| MediaPipe EfficientNet-Lite0 (ImageNet-1k) | 4.7 MB | Apache-2.0 | **Kept in the repository, removed from the dashboard path.** It can see three fruits. |
| `yolo26n-pose` | — | AGPL-3.0 | Untouched. Precedent for shipping AGPL weights. |

**Model acceptance gate.** `scripts/nutrition-model-acceptance.mjs` runs a model on labelled
images and refuses to enable one that is degenerate or mislabelled. It exists because of the
zero-weights MobileNet: a model that returns a class and a score for every input passes every
integrity check and is worthless.

## 6. The selected CV approach

**Local, in the browser, in a worker.** No cloud vision. No photo is uploaded, ever.

```
photo → quality gate → YOLOv8n-seg (768×768, WASM) → 104-class instance masks
      → NMS → map.js (trusted registry) → catalogue candidates
      → the person confirms → calculateMeal → the server recalculates → stored
```

Every convention in the decode was **measured** rather than assumed: channel-major indexing,
class scores already being probabilities, class 0 being `background`, the mask prototypes being
raw logits with a `> 0` threshold, the `rgb(114,114,114)` letterbox, and the mask area being
clipped to the content rect. The alternatives were measured too — the alternate mask
formulation yields 0 % of the box.

**The model is confidently wrong.** On a real plate of kidney beans it said "chocolate" at 0.662.
Over 200 labelled photographs the highest-scoring wrong label was "cabbage" at 0.99. This is
why recognition is never auto-applied and why the score is never shown as a percentage.

## 7. Inference location, licences and sizes

| | |
|---|---|
| Inference location | **The browser**, in a Web Worker, ONNX Runtime Web, CPU/WASM, no GPU |
| Weights licence | AGPL-3.0 (`public/models/FOODSEG-LICENSE.txt`), following the repository's existing `yolo26n-pose` precedent |
| Dataset licence | Apache-2.0 (FoodSeg103) |
| Runtime licence | MIT (onnxruntime) — `public/engine/ORT-LICENSE.txt` |
| First-run cost | 14.7 MB model + 11.2 MB runtime ≈ **26 MB**, all same-origin, service-worker cached |
| External requests | **0**, verified with all non-localhost traffic blocked |

## 8. The portion strategy

Aerial density, not volume. From one photograph, thickness and density are not separately
identifiable, so the estimator uses **g/cm²** directly:

```
grams ≈ maskArea_cm² × arealDensity_g_per_cm2 × shapeFactor
```

- **Areal density** is derived from a USDA household portion divided by the footprint of its
  vessel: *"1 cup cooked rice = 158 g"* ÷ a US cup (⌀8.0 cm → 50.27 cm²) = **3.143 g/cm²**.
  The derivation string is stored beside the number.
- **Reference object**: a plate diameter (6–10″) or a reference card, with the marker's error
  applied to both edges.
- **Household units**: per-food, from SR Legacy's own portion weights. One bowl does not weigh
  the same for every food.
- **Manual grams** (`method: "weighed"`) is the high-accuracy path and is the default in the
  review screen.
- **No reference ⇒ no gram estimate at all.** The item falls back to manual or household, and
  `missingInputs: ["portion"]`.
- The shape factor's own relative sigma (~0.23) dominates, so an image-derived weight is never
  labelled "low uncertainty".
- An image-derived weight is **inert until the person accepts it**, and is then stored as
  `visual_estimate_confirmed`.
- **Monocular depth is not used as a weight**, and no depth estimate reaches a calorie number.

## 9. The nutrition database

**USDA FoodData Central SR Legacy** (CC0-1.0), the bulk CSV
`FoodData_Central_sr_legacy_food_csv_2018-04.zip` (6,074,592 B, SHA-256
`b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0`), read by
`scripts/build-nutrition-catalogue.mjs`.

Every record keeps its `fdcId`, its `databaseRecordId` (`"fdc:<id>"`), its preparation state, its
per-100 g values, its household portions, its source (publisher, type, published, retrieved,
licence, URL) and its verification status. **No value is typed by hand.** The generator refuses
to emit a record that is missing a nutrient, so a gap becomes a build failure rather than a
silent zero.

**Bangladesh-specific data was investigated and is not used.** The Food Composition Table for
Bangladesh is not available in a machine-readable, permissively licensed form that could be
checked here. Every catalogue value therefore comes from USDA records of the same foods, and
the records say so. This is a real limitation, not a footnote: USDA values for "rice, cooked"
or "chicken, roasted" are not measurements of Bangladeshi kitchens.

## 10. The calculation methodology

`nutrient = (food_weight_g / 100) × nutrient_per_100g`, computed in integer milli-units and
rounded once at the end:

```
base     = round(per100g × toBase)     // milli-kcal for energy, mg for the rest
food_mg  = round(grams × 1000)
nutrient = divRound(base × food_mg, 100000)
```

- `toBase` differs per nutrient, because USDA reports energy in kcal, the macronutrients in
  grams and sodium in milligrams. Getting this wrong turns 130 kcal of rice into 1300 kcal; it
  did, once, and there is a test for it now.
- **Recipes** scale each ingredient by `portionGrams / cookedYieldGrams` and sum in base
  units, so a recipe cannot drift. A recipe states its **cooked yield** and its **water added**
  separately, because rice absorbs water and a dal boils most of it away.
- **An unknown food produces `null`, never `0`**, and is listed in `excluded`. "We do not know"
  and "none" are different.
- A missing ingredient makes a recipe's numbers **unknown, not partial**.
- The browser and the server call the same function, so a server-recalculated meal cannot
  disagree with the preview.

## 11. The confirmation behaviour

- **Nothing is saved without confirmation.** The server refuses `confirmed !== true` with a
  400.
- The review screen shows the picture, each detected region, the proposed name, the model's own
  class name, **the score worded as a score and not a probability**, the alternatives, the
  amount, and the missing information.
- The person can pick an alternative, search the catalogue, add a food ASHA did not see, remove
  a food, or type the weight. **A correction replaces the proposal**, and the interface says so
  on the card.
- A region ASHA has no catalogue food for is shown as unrecognised and **is offered no name at
  all**.
- Proposed, corrected and confirmed are stored separately: the server keeps `confirmed` and
  `confirmedAt`; the local mirror keeps the corrected values.
- The legacy Everyday surface has the same flow in vanilla DOM, with the same rules.

## 12. Privacy and security changes

- **Photos never leave the device.** The segmenter runs in the browser; no image is uploaded,
  stored, or put in a URL.
- **The API payload is whitelisted.** Any key named `nutrients`, `total`, `kcal`, `protein`,
  `carbohydrate`, `fat`, `fiber`, `sodium`, `photo`, `image`, `images`, `blob`, `dataUrl`,
  `base64`, `pixels`, `thumbnail` or `canvas`, at any depth, is a **400** — not a silently
  dropped field. A client that sends its own calorie number is refused.
- **The server recalculates.** The client sends food ids, weights and the portion method; the
  server computes the nutrients with the same engine and stores the result.
- **Role separation is unchanged.** The patient writes; a caregiver may read only meals the
  person shared; neither can act as the other. There are tests for all three.
- **Ownership is checked.** A caregiver cannot delete a person's meal (403).
- **The store is the existing one** — memory → Supabase → Vercel Blob — under
  `asha-live/v1/<patientId>/nutrition/meals/<id>.json`. No new database architecture.
- **The client IP is only ever hashed**, for the rate limit.
- **The local browser copy is a mirror, not the authority.** The server copy is authoritative.
- Limits: 3,000 g per item, 20 items per meal, 20 meals per day per IP.

## 13. Tests executed and their results

```
npm test                      650 tests, 0 failures   (baseline before this work: 497)
npx tsc --noEmit              clean
npm run build                 passed (production build)
npm run models:check          17/17 pinned inference assets match their hash
npm run tokens:check          tokens up to date; every colour pair clears its contrast ratio
node scripts/secret-scan.mjs  813 files checked, 0 findings
npm run test:browser:nutrition 4 runs passed   (dashboard Nutrition, against the production build on :4180)
```

**One browser test does not pass here, and it is not a Nutrition test.**
`npm run test:everyday` fails at its Clinic step, waiting for the "Invite a person" heading.
The cause is environmental: `POST /api/clinic` answers **503 "Clinic storage is unavailable"**,
because the Clinic service needs a persistent store (Supabase or Vercel Blob) and this sandbox
has neither configured. A direct probe of that endpoint reproduces it with no browser involved:

```
$ curl -s -X POST http://127.0.0.1:4180/api/clinic -H 'content-type: application/json' \
    -d '{"action":"create","confirmed":true,"name":"QA probe"}'
{"error":"Clinic storage is unavailable. Try again later."}
```

Nothing in this work touches the Clinic module, `src/server/lib/clinic.js`, or the store
abstraction, so this failure is pre-existing in an environment without cloud storage rather
than a regression. It is recorded here rather than fixed, because fixing it would mean
changing an unrelated module to make a suite pass.

**The model acceptance gate could not be executed here.** `scripts/nutrition-model-acceptance.mjs`
is written, syntax-checked and fails gracefully with a clear message, but the headless browser
crashed while loading the 14.7 MB model in this sandbox, so the gate returned "not accepted by
this run" rather than a pass. The gate's *purpose* is to refuse a model that has not been shown
to discriminate; the segmentation benchmark (`scripts/nutrition-benchmark.mjs`) did run the same
shipping worker over 200 labelled photographs and produced the numbers in §14, so the model is
demonstrably not the degenerate case. The gate itself should still be run on a machine with
enough memory before a release.

New test files:

| File | Tests | What it covers |
|---|---|---|
| `tests/nutrition-catalogue.test.mjs` | 22 | Catalogue lookup, Bangla/English/synonym matching, portions, source fields |
| `tests/nutrition-engine.test.mjs` | 19 | Per-item, recipe and meal arithmetic; unknown foods; rounding |
| `tests/nutrition-portion.test.mjs` | 22 | Areal density, calibration, uncertainty, reconciliation |
| `tests/nutrition-vision-contract.test.mjs` | 25 | The validated structured output; the nutrient guard; unknown ids |
| `tests/nutrition-vision-policy.test.mjs` | 20 | The two gates; image quality; bilingual messages |
| `tests/nutrition-server-log.test.mjs` | 19 | The whitelist, the roles, the ownership, the recalculation |
| `tests/nutrition-seg-codec.test.mjs` | 19 | The decode: layout, mask activation, NMS, area clipping |
| `tests/nutrition-seg-labels.test.mjs` | 7 | The 104-class label map |

Two existing assertions were changed, both on purpose and both described in §4.

## 14. The measured accuracy

Full detail in `NUTRITION_AI_ACCURACY_REPORT.md`.

| | |
|---|---|
| **Nutrition5k catalogue accuracy** | **1,191 of 3,490 meals compared (34.1 %)**. Energy MAE **36.18 kcal**, RMSE **104.67 kcal**; fat MAE 2.40 g; carbohydrate MAE 3.29 g; protein MAE 2.23 g. Exact mappings only (867 meals): energy MAE **28.32 kcal**. |
| **FoodSeg103 segmentation** (in-domain) | Precision **65.6 %**, recall **58.5 %**, F1 **61.9 %** over 200 images; p50 **612 ms**, p95 **658 ms**; **0** external requests. |
| **Confidence** | The score is **not** a probability: "chocolate" 0.662 on kidney beans; "cabbage" 0.99 and wrong. |
| **Portion accuracy** | **Not measured.** |
| **Calibration error** | **Not measured.** |

## 15. What is implemented and verified

- The whole pipeline, end to end, in the browser: photo → segment → candidates → confirm →
  calculate → save.
- The catalogue: 76 sourced records and 10 recipes, generated from the USDA CSV, with a test
  that every id resolves.
- The calculator: exact integer arithmetic, verified against the Nutrition5k benchmark.
- The contract: the result object is built from an explicit field list, so a model-emitted
  `kcal` does not exist on it at all.
- The server: whitelist rejection, role separation, ownership, recalculation.
- The fallback ladder: every failure path asks the person rather than inventing an answer.
- The service worker caches the model and the runtime, so the module works offline.

## 16. What is implemented but not externally verified

- **The Bangladeshi recipes.** They are assembled from USDA records with stated yields, water
  and assumptions. They have not been checked against a cook in Bangladesh.
- **The Bangla names.** They are ASHA's own, not a verified glossary.
- **The portion estimator's behaviour on real phone photographs.** It is unit-tested against
  synthetic masks and has not been through the benchmark.
- **The reference-object calibration** on a real photograph.
- **The legacy Everyday flow** has been exercised by the unit suite and by the build, but the
  new "find the food in this picture" button has not been driven through a browser.

## 17. What is blocked

| Blocker | Why | What it would need |
|---|---|---|
| **Recognition of Bangladeshi dishes** | No permissively licensed, labelled Bangladeshi food photograph dataset exists | A dataset, or a fine-tuned model on one |
| **A measured `τ_id`** | The risk–coverage curve needs more labelled regions than the in-domain 200-image sample gives | A larger labelled set |
| **A Bangladesh food composition table** | Not available in a machine-readable, permissively licensed form that could be checked here | The table, with permission to redistribute |
| **Phone latency, battery and thermal behaviour** | No phone was available in this environment | A device |
| **Real Bangladeshi photographs** | None are committed, and none could be sourced with a clear licence | A dataset |

## 18. Future improvements

1. **A Bangladeshi dataset**, and a model fine-tuned on it. This is the single change that would
   make the recognition numbers mean something for this app's users.
2. **A measured `τ_id`** from a risk–coverage curve, replacing the declared placeholder.
3. **Reference-object calibration driven by the person** — mark two edges of the plate with a
   finger — which is the only way to get a real scale out of a top-down photograph.
4. **The `no_plate` / `partial_plate` / `occluded` / `extreme_angle` checks**, which need a plate
   detector or a second view and are deliberately not guessed from a brightness histogram.
5. **A Bangladesh composition table**, behind the same catalogue interface.
6. **Recipe validation against real cooking sessions**, which would also measure how far ASHA's
   chicken curry is from a real one.
7. **Offline ASR and the other deliberately-off features**, which stay off until there is
   something to evaluate them against.

## 19. The claims this repository makes, and does not make

**It does make these, and they are measured:**

- The catalogue's numbers come from USDA SR Legacy, read out of the bulk CSV by a script.
- Over 1,191 real meals, the catalogue and calculator land within a mean of 36.18 kcal of
  Nutrition5k's own recipe totals.
- The segmenter finds food regions with F1 61.9 % on its own training distribution.
- Nothing leaves the device, and the server recalculates every number.

**It does not make these:**

- That ASHA can recognise a Bangladeshi dish from a photograph. **It cannot.**
- That the model's score is the probability of a correct answer. **It is not.**
- That the portion estimate is accurate. **It has not been measured.**
- That the thresholds have been tuned. **They are declared placeholders.**
- That the recipes are how a Bangladeshi cook would make that dish. **They are not.**

This is a demonstration application, not a validated clinical device. It does not diagnose, it
does not prescribe, it does not place calls, and it presents every nutrition number as an
estimate from a food composition table rather than as a measurement of what was eaten.
