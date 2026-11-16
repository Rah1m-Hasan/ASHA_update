# Nutrition AI — Accuracy report

*Every number in this document was produced by a script in this repository on the machine that
built it. Nothing here is an estimate, a projection or a figure copied from a paper.*

```
node scripts/nutrition-benchmark.mjs          # the segmentation benchmark
node scripts/nutrition-catalogue-benchmark.mjs # the nutrition accuracy benchmark
```

## 1. The headline: are the nutrition numbers right?

`scripts/nutrition-catalogue-benchmark.mjs` takes **Nutrition5k** (`ai5labsOfficial/nutrition5k`,
CC-BY-4.0) — 3,490 real cafeteria plates, each with its ingredient list, the gram weight of
every ingredient, and the plate's total calories, fat, carbohydrate and protein.

The test takes the **ground-truth ingredient weights**, feeds them through ASHA's own catalogue
and calculator exactly as a confirmed meal is fed, and compares the result with the plate's
recorded numbers. The camera is not involved at all. This is deliberate: it measures the
*numbers*, separately from the *recognition*.

```
meals in the dataset:        3490
meals compared (exact map):  867
meals compared (with proxy): 324
meals skipped:               2299
meals compared in total:      1191 (34.1% of the dataset)
```

### Exact mappings only (867 meals)

| | n | MAE | RMSE |
|---|---|---|---|
| Energy | 867 | **28.32 kcal** | 100.38 kcal |
| Fat | 867 | **1.80 g** | 5.74 g |
| Carbohydrate | 867 | **2.21 g** | 12.98 g |
| Protein | 867 | **2.07 g** | 5.52 g |

### Including the meals that needed a proxy food (1,191 meals)

| | n | MAE | RMSE |
|---|---|---|---|
| Energy | 1,191 | **36.18 kcal** | 104.67 kcal |
| Fat | 1,191 | **2.40 g** | 6.59 g |
| Carbohydrate | 1,191 | **3.29 g** | 12.90 g |
| Protein | 1,191 | **2.23 g** | 5.65 g |

### What these numbers mean, and what they do not

Nutrition5k's totals come from **the dataset's own recipe database**, which uses USDA values of
its own vintage. So this measures *the distance between ASHA's catalogue + engine and
Nutrition5k's recipe database*. It is not a measurement of physical truth, and a person cannot
weigh a plate of rice and settle it.

Two features of the numbers are worth stating rather than hiding:

- **The RMSE is three to four times the MAE.** The error is heavily skewed: most plates are
  close, a minority are far off. The far-off ones are the plates whose ingredients include
  something the catalogue only approximates, or whose recorded oil weight differs. A mean
  absolute error alone would hide that.
- **Two thirds of the dataset could not be compared.** 2,299 meals were skipped because at
  least one of their ingredients has no catalogue record. The 119 unmatched ingredient names
  are printed by the script; the biggest are `almonds`, `shallots`, `cucumbers`, `cheese pizza`,
  `olives`, `parsley`, `bell peppers`, `mustard`, `caesar salad`, `wheat berry`, `corn on the
  cob`, `brussels sprouts`, `chard`, `green beans`, `soy sauce`, `jalapenos` and `kale`. A
  benchmark over the meals ASHA can actually compute is the honest subset; a benchmark that
  quietly used a different weight for an unknown food would not be.

### Leakage

There is none. The catalogue is built from the USDA SR Legacy bulk CSV; Nutrition5k's reference
numbers come from the dataset's own recipe file. The ingredient map in the benchmark script was
written by matching names, and the weights come from the dataset. Nothing is fitted.

The benchmark script is also the place where the catalogue grew: 30 further single-ingredient
USDA records were added (broccoli, sweet potato, pork, salmon, tofu, lettuce, pineapple,
avocado, olive oil, vinegar, quinoa, millet, oats, and so on) so that more real meals could be
compared. Each one is a real USDA record with its own numbers, read out of the same CSV.

## 2. The segmentation: can the model find the food?

`scripts/nutrition-benchmark.mjs` drives the **shipping worker** (`public/engine/food-segmenter-worker.js`)
through headless Chromium over 200 labelled FoodSeg103 validation photographs, with every
non-localhost request aborted.

```
region-level precision  65.6 %
region-level recall     58.5 %
region-level F1         61.9 %   (TP 494, FP 259, FN 350)
plate-level: every ground-truth class found   31 / 200
              partly found                    158 / 200
              none found                      11 / 200
latency  p50 612 ms, p95 658 ms   (desktop Chromium)
external requests  0
```

**Read the "in-domain" warning.** FoodSeg103 is the dataset this model was trained on. These
numbers measure that the implementation is correct — the decode, the letterbox, the mask
activation, the NMS, the area clipping — and they are **not** a generalisation figure, and they
are certainly not a figure for Bangladeshi food. The script prints this in its own header.

## 3. The finding that shaped the whole design

**A model score is not a probability that the person ate that food.**

On a real Nutrition5k plate of **kidney beans**, the segmenter returned:

```
chocolate   0.662
strawberry  0.401
```

Over the 200 labelled photographs, the **highest-scoring wrong label was "cabbage" at 0.99**.

Both facts are in the repository as code, not just as prose: `public/app/nutrition/vision/map.js`
quotes them in its header, and the review screen says *"camera score 0.66 — this is not a
probability"* next to every number.

The consequences are structural:

- Recognition is **never auto-applied**. Every proposal is shown, with alternatives, and is
  confirmed by the person.
- The `identification_confidence` field is never shown as a percentage.
- The identity threshold is a **placeholder** until a risk–coverage curve is measured, and the
  policy ships asking more than it accepts.

## 4. Portion estimation

**Not measured.** Portion accuracy needs a labelled dataset with a reference object or a
weighed ground truth in the frame. Nutrition5k has the weighed ground truth but its photographs
have no in-frame scale; FoodSeg103 has masks but no masses. Neither gives a portable plate
constant, and fitting one on the evaluation set would be leakage.

What *is* implemented and tested is the **uncertainty model**, not an accuracy figure:

- a picture with no scale produces **no gram estimate at all** (`estimatedGrams: null`);
- the shape factor (1.0–1.6) contributes a relative sigma of ~0.23 on its own, so an
  image-derived weight is **never** labelled "low uncertainty";
- a reference-object calibration applies the marker's error to both edges
  (`relativeError = markerPxError × √2 / pixels`);
- an image-derived weight is **inert until the person accepts it**, and is then recorded as
  `visual_estimate_confirmed`;
- `weighed` > `household_unit` > `visual_estimate_confirmed` in precedence.

## 5. Confidence calibration

**Not measured.** The calibration error is defined as the difference between the model's score
and the measured probability that the label is correct. It needs enough labelled regions to
bin the scores, and the 200-image in-domain sample is enough to *demonstrate* the problem
(chocolate at 0.66, cabbage at 0.99) but not to fit a curve.

`τ_id` is therefore a **declared placeholder** — 0.35, with the string
`"PLACEHOLDER thresholds. They have NOT been fitted to a measured risk–coverage curve."`
shipped in `public/app/nutrition/vision/policy.js` so it cannot be mistaken for a measured
value.

## 6. A summary table

| Question | Answer | Measured? |
|---|---|---|
| Do the nutrition numbers land near a real reference? | MAE **36.18 kcal** over 1,191 real meals | **Yes** |
| Can the model find food regions? | P **65.6 %**, R **58.5 %**, F1 **61.9 %**, in-domain | **Yes** |
| Is a model score a probability? | **No** — chocolate 0.66 on kidney beans; cabbage 0.99 and wrong | **Yes** |
| How accurate is the portion estimate? | — | **No** (no labelled data) |
| How well calibrated is the confidence? | — | **No** (not enough labelled regions) |
| Does it recognise Bangladeshi dishes? | **No.** It segments ingredients | **No**, and it cannot today |
| How fast? | p50 **612 ms**, p95 **658 ms**, desktop Chromium | **Yes** |
| Does it work offline? | Yes — 0 external requests, everything vendored | **Yes** |

## 7. What would change these numbers

1. **A labelled Bangladeshi food dataset.** This is the only thing that could make the
   recognition numbers mean anything for the people who use this app. There is none published
   under a permissive licence.
2. **A weighed-and-photographed plate dataset with a reference object.** This is what a portion
   accuracy figure needs.
3. **More labelled regions** for the risk–coverage curve, so `τ_id` stops being a placeholder.
4. **A Bangladesh food composition table**, so the catalogue's numbers come from Bangladesh
   measurements rather than from USDA records of the same foods.
