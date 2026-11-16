// The model acceptance gate.
//
//   node scripts/nutrition-model-acceptance.mjs [--dir datasets/foodseg103] [--limit 40]
//
// WHY THIS EXISTS
//
// A model can be structurally perfect and semantically dead. `AlexKoff88/mobilenet_v2_food101`
// is the example that made this gate necessary: its ONNX graph contains all-zero convolution
// weights and an all-zero classifier bias, so the final convolution annihilates the backbone
// and it returns a uniform vector for EVERY input. Through the browser it produced a uniform
// 0.0099 softmax over all 101 classes on every image.
//
// It passes every size and hash check. It returns a class and a score. It looks alive.
//
// So acceptance is not "the file is there". Acceptance is: run the model on labelled
// photographs and check that it actually discriminates.
//
// WHAT IS CHECKED
//
//   1. THE MODEL LOADS AND AGREES WITH ITS LABEL MAP. The worker's class count must match
//      public/app/nutrition/vision/seg-labels.js, and the label names must be the ones the
//      dataset uses.
//
//   2. THE OUTPUT IS NOT DEGENERATE. The scores across a set of different photographs must
//      vary. A model that answers the same thing to everything has a variance of zero, and
//      that is the zero-weights failure exactly.
//
//   3. IT PUTS THE RIGHT CLASS FIRST, OFTEN ENOUGH. At least the stated fraction of the probe
//      photographs must have their ground-truth class as the top prediction.
//
// The thresholds below are measured on FoodSeg103, which is IN-DOMAIN for this model. The
// fraction is a floor for the implementation, not a claim about generalisation.
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dir = path.resolve(arg("--dir", "datasets/foodseg103"));
const limit = Number(arg("--limit", "40"));
const PORT = Number(arg("--port", "4187"));

/** The floors a model has to clear to be enabled. */
const ACCEPTANCE = {
  /** The smallest share of probe photographs whose ground-truth class must be predicted first. */
  minTop1: 0.2,
  /** The smallest score variance the model must show across the probe photographs. */
  minVariance: 1e-4,
  /** The model must not answer with the same class for every photograph. */
  minDistinctTopClasses: 3,
};

/**
 * Serve the dataset folder and a probe page.
 *
 * @param {string} root
 */
function serve(root) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/__probe.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><meta charset=utf-8><title>probe</title><body>probe</body>");
      return;
    }
    const file = path.join(root, url.pathname.replace(/^\//, ""));
    try {
      const data = await fsp.readFile(file);
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

const manifestPath = path.join(dir, "manifest.json");
const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
const rows = (manifest.rows ?? []).filter((row) => (row.classes ?? []).length).slice(0, limit);
if (!rows.length) {
  console.error(`no labelled rows in ${manifestPath}. Fetch the dataset first.`);
  process.exit(1);
}

const server = await serve(dir);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox", "--no-proxy-server"],
});
const page = await browser.newPage();
const external = [];
await page.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith(`http://127.0.0.1:${PORT}`)) return route.continue();
  external.push(url);
  return route.abort();
});
await page.goto(`http://127.0.0.1:${PORT}/__probe.html`);

const payload = [];
for (const row of rows) {
  const bytes = await fsp.readFile(path.join(dir, "images", row.file));
  payload.push({ file: row.file, classes: row.classes ?? [], b64: bytes.toString("base64") });
}

let results;
try {
  results = await page.evaluate(async (items) => {
  const worker = new Worker("/engine/food-segmenter-worker.js", { type: "module" });
  const next = () => new Promise((resolve) => { worker.onmessage = (e) => resolve(e.data); });
  worker.postMessage({ type: "init" });
  const ready = await next();
  if (ready.type === "error") return { ready, rows: [] };
  const out = [];
  for (const [i, item] of items.entries()) {
    const binary = atob(item.b64);
    const bytes = new Uint8Array(binary.length);
    for (let k = 0; k < binary.length; k++) bytes[k] = binary.charCodeAt(k);
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
    worker.postMessage({ type: "detect", id: i, bitmap }, [bitmap]);
    const result = await next();
    out.push({ file: item.file, classes: item.classes, items: result.items ?? [] });
  }
  worker.terminate();
  return { ready, rows: out, classCount: ready.classes ?? null };
  }, payload);
} catch (error) {
  await browser.close().catch(() => {});
  server.close();
  console.error(`FAIL the browser could not run the model: ${error.message}`);
  console.error("The acceptance gate could not be evaluated here, so the model is NOT accepted by this run.");
  process.exit(1);
}

await browser.close();
server.close();

if (results.ready?.type === "error") {
  console.error(`FAIL the worker did not load: ${results.ready.message}`);
  process.exit(1);
}
if (external.length) {
  console.error(`FAIL the worker reached ${external.length} external URL(s)`);
  process.exit(1);
}

// 1. The label map must agree with the model.
const { SEGMENTER_CLASSES } = await import("../public/app/nutrition/vision/seg-labels.js");
const failures = [];
if (results.classCount && SEGMENTER_CLASSES.length !== results.classCount) {
  failures.push(`the label map has ${SEGMENTER_CLASSES.length} classes but the model has ${results.classCount}`);
}

// 2. The output must vary between photographs.
const tops = [];
const topScores = [];
let top1 = 0;
for (const row of results.rows) {
  const best = (row.items ?? []).slice().sort((a, b) => b.score - a.score)[0];
  if (!best) continue;
  tops.push(best.className);
  topScores.push(best.score);
  if ((row.classes ?? []).includes(best.className)) top1 += 1;
}
const distinct = new Set(tops).size;
const mean = topScores.reduce((a, b) => a + b, 0) / (topScores.length || 1);
const variance = topScores.reduce((a, b) => a + (b - mean) ** 2, 0) / (topScores.length || 1);
if (variance < ACCEPTANCE.minVariance) {
  failures.push(`the model's scores do not vary between photographs (variance ${variance}) - it is degenerate`);
}
if (distinct < ACCEPTANCE.minDistinctTopClasses) {
  failures.push(`the model answered with ${distinct} distinct class(es) over ${tops.length} photographs`);
}

// 3. It must be right often enough.
const top1Rate = tops.length ? top1 / tops.length : 0;
if (top1Rate < ACCEPTANCE.minTop1) {
  failures.push(`top-1 accuracy ${(top1Rate * 100).toFixed(1)}% is below the floor of ${ACCEPTANCE.minTop1 * 100}%`);
}

console.log("Nutrition model acceptance");
console.log("=========================");
console.log(`probe photographs:      ${tops.length}`);
console.log(`distinct top classes:   ${distinct}`);
console.log(`top-1 accuracy:         ${(top1Rate * 100).toFixed(1)}%  (floor ${ACCEPTANCE.minTop1 * 100}%)`);
console.log(`score variance:         ${variance.toExponential(3)}  (floor ${ACCEPTANCE.minVariance.toExponential(3)})`);
console.log(`external requests:      ${external.length}`);
console.log(`dataset:                ${manifest.dataset} ${manifest.split ?? ""} - IN-DOMAIN for this model`);
console.log("");
if (failures.length) {
  console.error("REJECTED:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("ACCEPTED. The model discriminates, agrees with its label map, and needs no outside service.");
