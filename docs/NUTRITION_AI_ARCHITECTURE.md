# Nutrition AI — Architecture

## The one-sentence version

A photo is **segmented** on the device into ingredient regions; each region is turned into a
**catalogue candidate** by a trusted registry; the person **confirms or corrects** every food
and its amount; only then is the meal **calculated** from sourced composition tables, **recalculated
by the server** and stored.

Nothing in that sentence is optional, and nothing in it is a language model.

## The stages

Each stage is a separate module with its own tests. No module recognises food, calculates
nutrition and persists a record together.

| # | Stage | Module | Test |
|---|---|---|---|
| 1 | Capture | `src/features/nutrition/image.js`, the page's file input | `tests/nutrition-v5.test.mjs` |
| 2 | Image quality validation | `public/app/nutrition/vision/quality.js` | `tests/nutrition-vision-policy.test.mjs` |
| 3 | Detection + segmentation | `public/engine/food-segmenter-worker.js` + `public/app/nutrition/vision/seg-codec.js` | `tests/nutrition-seg-codec.test.mjs` |
| 4 | Identity mapping | `public/app/nutrition/vision/map.js` | `tests/nutrition-vision-contract.test.mjs` |
| 5 | Structured output validation | `public/app/nutrition/vision/contract.js` | `tests/nutrition-vision-contract.test.mjs` |
| 6 | Portion estimation | `public/app/nutrition/portion.js` | `tests/nutrition-portion.test.mjs` |
| 7 | Confirmation policy | `public/app/nutrition/vision/policy.js` | `tests/nutrition-vision-policy.test.mjs` |
| 8 | Catalogue matching | `public/app/nutrition/catalogue/index.js` | `tests/nutrition-catalogue.test.mjs` |
| 9 | Deterministic calculation | `public/app/nutrition/engine.js` | `tests/nutrition-engine.test.mjs` |
| 10 | Result review | `src/features/nutrition/VisionResult.tsx` | `tests/nutrition-v5.test.mjs` |
| 11 | User confirmation | `src/features/nutrition/Review.tsx` | `tests/nutrition-vision-policy.test.mjs` |
| 12 | Storage | `src/server/handlers/nutrition.js` | `tests/nutrition-server-log.test.mjs` |

## The shared domain

Both surfaces and the server import the same code, because the legacy Everyday app can only
load from `public/`:

```
public/app/nutrition/
  catalogue/index.js     lookup, search (EN + বাংলা + synonyms), household portions
  catalogue/records.js   GENERATED from the USDA SR Legacy CSV — never typed by hand
  catalogue/recipes.js   ten Bangladeshi dishes, assembled from those records
  engine.js              the one calculator
  portion.js             the portion estimator and its uncertainty
  vision/map.js          the trusted registry: model label -> catalogue candidates
  vision/contract.js     the validated structured output
  vision/policy.js       the two gates: identity and portion
  vision/quality.js      image quality and the message for each problem
  vision/seg-codec.js    the pure-JS YOLOv8 segmentation decode
```

The browser and the Node server call the *same* `calculateMeal`, so a server-recalculated meal
cannot disagree with the preview the person saw.

## The arithmetic

Everything is done in **integer milli-units** and rounded once at the end:

```
base       = round(per100g × toBase)          // milli-kcal, or mg
food_mg    = round(grams × 1000)
nutrient   = divRound(base × food_mg, 100000)
```

`toBase` differs per nutrient because USDA reports energy in kcal, the macronutrients in grams
and sodium in milligrams. Getting this wrong turns 130 kcal of rice into 1300 kcal — it did,
once, and there is a test for it now.

A recipe's total is a sum of integers, so a recipe cannot drift. A food with no record produces
`null`, never `0`, and is listed in `excluded`.

## The models

| Artefact | Size | Licence | Where it runs |
|---|---|---|---|
| `yolov8_foodseg103.onnx` | 14.7 MB | AGPL-3.0 weights, Apache-2.0 dataset | in the browser, in a worker |
| `ort-wasm-simd-threaded.wasm` | 11.2 MB | MIT (onnxruntime) | in the browser, in the same worker |
| USDA SR Legacy CSV | 6.1 MB | CC0-1.0 | **build time only** — never shipped |

Both browser artefacts are **vendored under `public/`**, pinned by SHA-256 in
`public/models/manifest.json` and `public/engine/manifest.json`, and cached by the service
worker. The runtime was previously fetched unpinned from a CDN at run time; that is fixed, and a
regression test asserts that no worker contains a cross-origin `wasmPaths`.

**One ORT session runs at a time.** The ImageNet classifier leaves the dashboard path: the
segmenter covers the same ground better, and a phone should not run two runtimes at once.

## The decode, and why it is written the way it is

Every convention in `seg-codec.js` was **measured**, not assumed:

- the output is **channel-major** (`data[channel * 12096 + anchor]`);
- the class scores are **already probabilities** (no sigmoid);
- class 0 is `background` and is dropped, never shown;
- the prototype masks are **raw logits**, so the mask is `Σ coeff·proto` thresholded at `0`
  (the Ultralytics convention); the alternative formulation was measured to yield **0 %** of the
  box and is degenerate;
- the letterbox pads with `rgb(114,114,114)` and the mask area is clipped to the content rect,
  so a mask entirely in the pad band contributes exactly zero.

## The map layer

`map.js` is a **trusted registry**, not a model. It maps a model class name to catalogue
candidates, and it is written by hand:

```js
rice:            { foodId: "rice-cooked", alternatives: ["khichuri", "polao", "bd-chicken-biryani"], ask: true }
"chicken duck":  { foodId: "chicken-curry", alternatives: ["mutton-curry", "beef-bhuna"], ask: true }
chocolate:       { foodId: null, alternatives: [], ask: true }
```

Three properties it holds:

1. every id it names exists in the catalogue (a test asserts it);
2. a class with no catalogue food produces **no suggestion at all** — not a placeholder;
3. a confusable group (rice / biryani / khichuri / polao) is marked `ask: true`, so ASHA asks
   rather than guessing between them.

## The policy

`policy.js` keeps **two independent gates**:

- **identity** — on the model's class score;
- **portion** — on the relative sigma of a weight.

They are separate because "I know what this is but not how much" and "I know how much but not
what it is" need different questions. A food ASHA cannot look up is never "accepted", however
confident the model was.

The thresholds are **placeholders and are labelled as such**. The measured risk–coverage curve
that should replace them has not been produced.

## The confirmation workflow

`Review.tsx` is the screen where a proposal becomes a record. Three rules:

1. **Nothing is saved without the person's confirmation.** The server refuses a payload with
   `confirmed !== true`.
2. **The score is not a percentage.** It is shown as `camera score 0.66 — this is not a
   probability`, because over 200 labelled photographs the highest-scoring *wrong* answer was
   "cabbage" at **0.99**.
3. **A correction overrides the proposal.** Choosing another name, another amount or removing a
   food replaces what the camera said; the corrected value is what is calculated.

Proposed, corrected and confirmed are stored separately. The server keeps `confirmed` and
`confirmedAt`; the local mirror keeps the corrected values.

## The storage and the security boundary

```
client  ──▶  POST /api/nutrition  ──▶  src/server/handlers/nutrition.js
              { action: "log", confirmed: true,
                items: [{ foodId, grams, method }] }        ← ids and weights only
                    │
                    ▼
              calculateMeal(items)  ──▶  nutrients computed by the SERVER
                    │
                    ▼
              asha-live/v1/<patientId>/nutrition/meals/<id>.json
```

The payload is **whitelisted**. Any key named `nutrients`, `total`, `kcal`, `protein`, `photo`,
`image`, `blob`, `dataUrl`, `base64` or `pixels`, at any depth, is a **400**, not a silently
dropped field. A client that sends its own calorie number is refused.

Role separation is unchanged: the patient writes, a caregiver may read only meals the person
shared, and neither can act as the other. Photos never leave the device.

## The fallback ladder

| If this fails | Then |
|---|---|
| the model will not load | the person chooses the foods by name; the calculator still works |
| the model finds nothing | the person is asked; **nothing is invented** |
| the model times out | the person is asked |
| there is no catalogue match | the person is asked; the region is shown as unrecognised |
| the portion cannot be estimated | the person types the weight; there is no scale in the picture |
| the server is unreachable | the meal is kept in the local mirror and the interface says so |
| the server rejects the meal | the interface says why |

There is no path in which a failed inference becomes a prediction.
