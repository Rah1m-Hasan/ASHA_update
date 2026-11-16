# Nutrition AI — Dataset guide

How to get real, labelled data into this repository, and what must not go in it.

## The rules

1. **Third-party photographs are never committed.** They are fetched by a script, they land in
   `datasets/`, and `datasets/` is in `.gitignore`. What *is* committed is the manifest: the
   dataset name, the licence, the source URL and the row index.
2. **A split is by meal or by cooking instance**, never by photograph. One plate photographed
   five times is one meal. Putting two frames of the same plate into the training and the
   test split is the single easiest way to make a number meaningless.
3. **Synthetic fixtures are labelled as synthetic.** They are fine for testing arithmetic and
   the failure paths. They are never presented as a recognition benchmark, and no accuracy
   figure in this repository comes from them.
4. **A dataset without a licence that permits this use is not used.** That rule is why
   Food-101 is not in this repository.

## The two datasets already used

### FoodSeg103 — segmentation ground truth

| | |
|---|---|
| Source | `EduardoPacheco/FoodSeg103` on Hugging Face |
| Licence | Apache-2.0 |
| Fetch | `node scripts/nutrition-fetch-dataset.mjs --count 200 --out datasets/foodseg103` |
| What it gives | which of 104 ingredient classes are present in each picture |
| What it does not give | bounding boxes or masses |

FoodSeg103's **official** train/validation split is used (4,983 / 2,135). It is not re-split.
Its validation split is **in-domain** for the model, and the benchmark prints that in its own
header so the number cannot be quoted as generalisation.

### Nutrition5k — nutrition ground truth

| | |
|---|---|
| Source | `ai5labsOfficial/nutrition5k` on Hugging Face |
| Licence | CC-BY-4.0 |
| Fetch | `curl -L -o datasets/nutrition5k/metadata.csv https://huggingface.co/datasets/ai5labsOfficial/nutrition5k/resolve/main/metadata.csv` |
| What it gives | per meal: the ingredient list with each ingredient's grams, and the plate's total calories, fat, carbohydrate and protein |
| What it does not give | a scale in the frame, so no portion grams are recoverable from the pixels |

**3,490 meals.** The distinct plate count is lower than the row count, because the capture rig
photographed some plates more than once; the benchmark therefore compares meals, never frames.

The `ingredients` column is `name:grams;name:grams;…`. The names are USDA-ish and there are
**240 distinct** ones. `scripts/nutrition-catalogue-benchmark.mjs` holds an explicit map from
those 240 names to catalogue ids, and prints the unmatched list every time it runs.

## Importing your own labelled data

Write a folder like this:

```
datasets/mine/
  manifest.json
  images/
    0001.jpg
    0002.jpg
```

`manifest.json`:

```json
{
  "dataset": "your-dataset-name",
  "split": "test",
  "licence": "CC-BY-4.0",
  "source": "https://wherever-it-came-from",
  "fetchedAt": "2026-11-16",
  "notes": "One row per MEAL. Frames of the same meal share a mealId.",
  "rows": [
    {
      "file": "0001.jpg",
      "mealId": "session-2026-11-16-lunch-01",
      "foods": [
        { "class": "rice", "foodId": "rice-cooked", "grams": 180, "method": "weighed" }
      ],
      "nutrients": { "kcal": 310.4, "protein": 8.2, "fat": 4.1, "carbohydrate": 55.3 }
    }
  ]
}
```

The fields, and why each one is there:

| Field | Why it exists |
|---|---|
| `file` | the image, relative to `images/` |
| `mealId` | frames of one meal share it, so a split by `mealId` prevents leakage |
| `foods[].class` | the **model's** class name, so recognition can be scored against the truth |
| `foods[].foodId` | the **catalogue's** id, so nutrition can be scored against the truth |
| `foods[].grams` | the weighed mass, so portion estimation can be scored |
| `foods[].method` | how the mass was obtained: `weighed`, `household_unit`, `visual_estimate_confirmed` |
| `nutrients` | the reference totals, so the catalogue's arithmetic can be scored |

`foods[].class` and `foods[].foodId` are **both** needed and they are different things. A
picture of kidney beans has the class `other ingredients` and the food id `kidney-beans-boiled`.
Scoring only the class would measure the model; scoring only the id would measure the
catalogue. The pipeline needs both.

## Scoring a dataset

**Recognition** (region level): for each predicted region, match it to a ground-truth region
of the same class with an IoU threshold, then report precision, recall, F1 and the
per-class breakdown. Report the **highest-scoring wrong label** alongside them: in the
FoodSeg103 run that was "cabbage" at 0.99, and it is the single most useful number in the
report.

**Calibration**: bin the predictions by score and compare the mean score with the measured
fraction of correct labels in each bin. Sum the weighted gaps for the expected calibration
error. Only meaningful once there are enough labelled regions to fill the bins.

**Portion**: compare the estimated mass with the weighed mass. Report MAE in grams, and MAPE
only where the weighed mass is large enough for a percentage to mean something. Report the
result **by method** — a weighed estimate and a visual estimate are different instruments and
one number for both hides which one is failing.

**Nutrition**: feed the ground-truth ingredient weights through `calculateMeal` and compare
with the reference totals. This is what `scripts/nutrition-catalogue-benchmark.mjs` does.

## Splits

```
train   70 %   fitted things: τ_id from the risk–coverage curve, the plate constant
test    30 %   every reported number
```

Group by `mealId` first. Then split the groups. A split that is done row by row will leak, and
the leak will make the number better than the truth, which is the worst outcome available.

## Adding a dataset to the repository

1. Add a fetch script under `scripts/` that downloads it and writes a manifest. Do not commit
   the images.
2. Record the licence in the manifest and in `docs/IMPLEMENTATION_STATUS.md`. If the licence
   does not permit this use, do not use it — Food-101's terms are the example.
3. Add the dataset folder to `.gitignore` (it already covers `datasets/`).
4. Write the scoring into a script under `scripts/`, and print the numbers the same way
   `scripts/nutrition-benchmark.mjs` does: the count, the metric, and the caveat.
5. Put the measured numbers in `docs/NUTRITION_AI_ACCURACY_REPORT.md` with the command that
   produced them, and nowhere else.

## What would help most

| Dataset | What it would unlock |
|---|---|
| Bangladeshi food photographs with class labels | recognition accuracy that means anything for this app's users |
| Bangladeshi plates photographed with a reference object and weighed | portion accuracy, and a fitted plate constant |
| A Bangladesh food composition table | catalogue values from Bangladesh measurements rather than from USDA records of the same foods |
| Dishes photographed with their ingredient list and weights | recipe validation: does ASHA's chicken curry match a real one? |
