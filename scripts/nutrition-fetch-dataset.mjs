// Fetches a labelled sample of FoodSeg103's validation split so the benchmark has real ground truth.
//
//   node scripts/nutrition-fetch-dataset.mjs [--count 100] [--out datasets/foodseg103]
//
// The images are NOT committed: FoodSeg103 is large and the repository does not ship third-party
// photographs. The fetched folder holds a manifest.json recording the dataset's licence, the
// source URL, and one row per image with its ground-truth classes.
//
// The dataset is FoodSeg103 (EduardoPacheco/FoodSeg103 on Hugging Face), Apache-2.0. Its images are
// served from the Hugging Face datasets-server, which is why this script asks that service row by
// row rather than downloading the whole parquet.
//
// What the ground truth is: FoodSeg103 labels which classes are present in each picture. It does
// not label bounding boxes, so a class-presence match is what this sample can measure. Instance
// overlap (IoU) needs the mask annotations and is not attempted here.
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const count = Number(args[args.indexOf("--count") + 1]) || 100;
const outIndex = args.indexOf("--out");
const outDir = path.resolve(args[outIndex + 1] || "datasets/foodseg103");

const DATASET = "EduardoPacheco/FoodSeg103";
const ROWS = "https://datasets-server.huggingface.co/rows";

async function main() {
  await fs.mkdir(path.join(outDir, "images"), { recursive: true });
  const labelUrl = `https://huggingface.co/datasets/${DATASET}/resolve/main/id2label.json`;
  const id2label = JSON.parse(await (await fetch(labelUrl)).text());

  const manifest = { dataset: DATASET, split: "validation", licence: "Apache-2.0", fetchedAt: new Date().toISOString().slice(0, 10), rows: [] };

  // The datasets-server caps a page at 100 rows, so a larger sample is fetched in pages.
  const PAGE = 100;
  for (let offset = 0; offset < count; offset += PAGE) {
    const length = Math.min(PAGE, count - offset);
    const url = `${ROWS}?dataset=${encodeURIComponent(DATASET)}&config=default&split=validation&offset=${offset}&length=${length}`;
    const payload = await (await fetch(url)).json();
    if (payload.error) throw new Error(`datasets-server: ${JSON.stringify(payload.error)}`);
    if (!payload.rows?.length) break;

    for (const row of payload.rows) {
      const image = row.row?.image?.src;
      if (!image) continue;
      const classes = (row.row?.classes_on_image ?? []).map((c) => id2label[String(c)] ?? String(c));
      const name = `img_${String(row.row.id).padStart(6, "0")}.jpg`;
      const bytes = Buffer.from(await (await fetch(image)).arrayBuffer());
      await fs.writeFile(path.join(outDir, "images", name), bytes);
      manifest.rows.push({ file: name, id: row.row.id, width: row.row.image?.width ?? null, height: row.row.image?.height ?? null, classes });
      process.stdout.write(".");
    }
  }

  await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nwrote ${manifest.rows.length} labelled images to ${outDir}`);
}

await main();
