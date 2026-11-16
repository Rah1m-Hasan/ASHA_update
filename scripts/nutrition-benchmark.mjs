// Runs the real food segmenter over a labelled folder and reports detection metrics.
//
//   node scripts/nutrition-benchmark.mjs --dir datasets/foodseg103 [--limit 100] [--json out.json]
//
// This drives the SHIPPING worker (public/engine/food-segmenter-worker.js) in headless Chromium
// through the same vendored ONNX Runtime the app uses, so the numbers describe the code that runs
// on a patient's device rather than a research re-implementation.
//
// It needs a static server over public/ on http://127.0.0.1:4198 (the script starts one) and
// Playwright with a Chromium binary.
//
// WHAT IS MEASURED, AND WHAT IS NOT - read this before quoting a number.
//
//   - The ground truth is FoodSeg103's class PRESENCE. Each picture lists the classes in it. This
//     script therefore measures class-level precision, recall and F1. It does NOT measure
//     instance overlap (IoU), because the ground-truth masks are not in this sample.
//   - FoodSeg103 is the dataset this model was TRAINED on, so these numbers are IN-DOMAIN. They
//     are not a held-out generalisation result and they are not Bangladeshi food performance.
//   - The model's score is its confidence that a region is that class. It is NOT the probability
//     that the person ate that food. The report says so wherever a score appears.
//
// Nothing here uploads a picture: the worker runs on the local machine and the pictures never
// leave it.
import fs from "node:fs/promises";
import fsSync from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dir = path.resolve(arg("--dir", "datasets/foodseg103"));
const limit = Number(arg("--limit", "0")) || 0;
const jsonOut = arg("--json", null);
const PORT = 4198;

/**
 * Serves public/ and the dataset folder, so the worker can be loaded from its real path.
 *
 * @param {string} datasetDir
 * @returns {Promise<http.Server>}
 */
function serve(datasetDir) {
  const types = {
    ".html": "text/html",
    ".mjs": "text/javascript",
    ".js": "text/javascript",
    ".wasm": "application/wasm",
    ".onnx": "application/octet-stream",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".json": "application/json",
  };
  const server = http.createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === "/__probe.html") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end("<!doctype html><meta charset=utf-8><title>probe</title><body>probe</body>");
    }
    if (rel.startsWith("/__img/")) {
      const file = path.join(datasetDir, "images", path.basename(rel));
      if (!fs.existsSync(file)) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "content-type": "image/jpeg" });
      return fsSync.createReadStream(file).pipe(res);
    }
    const file = path.join(root, "public", rel);
    let info = null;
    try {
      info = await fs.stat(file);
    } catch {
      info = null;
    }
    if (!info || info.isDirectory()) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fsSync.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

/**
 * Precision, recall and F1 from raw counts.
 *
 * @param {number} tp
 * @param {number} fp
 * @param {number} fn
 */
function prf(tp, fp, fn) {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

async function main() {
  const manifestPath = path.join(dir, "manifest.json");
  let rows = [];
  if (await fs.stat(manifestPath).catch(() => null)) {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    rows = manifest.rows ?? [];
  } else {
    // A plain folder of pictures with no labels: the run still measures latency.
    const files = (await fs.readdir(path.join(dir, "images"))).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
    rows = files.map((file) => ({ file, classes: [] }));
  }
  if (limit) rows = rows.slice(0, limit);

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

  // The pictures are handed to the page as bytes rather than fetched over the network, so the
  // benchmark measures the model and not the plumbing.
  const payload = [];
  for (const row of rows) {
    const bytes = await fs.readFile(path.join(dir, "images", row.file));
    payload.push({ file: row.file, b64: bytes.toString("base64") });
  }

  const results = await page.evaluate(async (items) => {
    const worker = new Worker("/engine/food-segmenter-worker.js", { type: "module" });
    const next = () => new Promise((resolve) => { worker.onmessage = (e) => resolve(e.data); });
    worker.postMessage({ type: "init" });
    const ready = await next();
    if (ready.type === "error") return { ready, rows: [] };
    const rows = [];
    for (const [i, item] of items.entries()) {
      const binary = atob(item.b64);
      const bytes = new Uint8Array(binary.length);
      for (let k = 0; k < binary.length; k++) bytes[k] = binary.charCodeAt(k);
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
      worker.postMessage({ type: "detect", id: i, bitmap }, [bitmap]);
      const result = await next();
      rows.push({ file: item.file, ms: result.ms ?? null, items: result.items ?? [], error: result.error ?? null });
    }
    worker.terminate();
    return { ready, rows };
  }, payload);

  await browser.close();
  server.close();

  if (results.ready?.type === "error") {
    console.error(`worker failed to load: ${results.ready.message}`);
    process.exit(1);
  }
  if (external.length) {
    console.error(`the worker tried to reach ${external.length} external URL(s): ${external.slice(0, 3).join(", ")}`);
    process.exit(1);
  }

  const timings = results.rows.map((r) => r.ms).filter((v) => typeof v === "number").sort((a, b) => a - b);
  const pct = (p) => (timings.length ? timings[Math.min(timings.length - 1, Math.floor(timings.length * p))] : null);

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let platesAll = 0;
  let platesPartial = 0;
  let platesNone = 0;
  const perClass = new Map();
  const confusions = [];

  for (const [i, row] of results.rows.entries()) {
    const gt = new Set((rows[i].classes ?? []).filter((c) => c !== "background"));
    const items = row.items ?? [];
    const hit = new Set();
    for (const item of items) {
      if (gt.has(item.className)) {
        tp++;
        hit.add(item.className);
      } else {
        fp++;
        confusions.push({ name: item.className, score: item.score });
      }
      const entry = perClass.get(item.className) ?? { tp: 0, fp: 0 };
      if (gt.has(item.className)) entry.tp++;
      else entry.fp++;
      perClass.set(item.className, entry);
    }
    for (const g of gt) if (!hit.has(g)) fn++;
    if (gt.size) {
      if (hit.size === gt.size) platesAll++;
      else if (hit.size) platesPartial++;
      else platesNone++;
    }
  }

  const overall = prf(tp, fp, fn);
  const classes = [...perClass.entries()].map(([name, e]) => ({ name, ...prf(e.tp, e.fp, 0), support: e.tp + e.fp })).sort((a, b) => b.support - a.support);

  const report = {
    dataset: "FoodSeg103 validation (in-domain: this model was trained on it)",
    images: results.rows.length,
    labelledImages: rows.filter((r) => (r.classes ?? []).length).length,
    regionLevel: { tp, fp, fn, ...overall },
    plateLevel: { allClassesFound: platesAll, partiallyFound: platesPartial, noneFound: platesNone },
    timingMs: { p50: pct(0.5), p95: pct(0.95), min: timings[0] ?? null, max: timings[timings.length - 1] ?? null },
    externalRequests: external.length,
    perClass: classes,
    highestScoringWrongLabels: confusions.sort((a, b) => b.score - a.score).slice(0, 15),
  };

  console.log(`\nFoodSeg103 validation, ${report.images} images (in-domain for this model)`);
  console.log(`region-level  precision ${(overall.precision * 100).toFixed(1)}%  recall ${(overall.recall * 100).toFixed(1)}%  F1 ${(overall.f1 * 100).toFixed(1)}%`);
  console.log(`             TP ${tp}  FP ${fp}  FN ${fn}`);
  console.log(`plate-level   every ground-truth class found in ${platesAll}, partly in ${platesPartial}, none in ${platesNone}`);
  console.log(`latency       p50 ${report.timingMs.p50} ms   p95 ${report.timingMs.p95} ms  (desktop Chromium, not a phone)`);
  console.log(`external requests ${external.length}`);
  console.log("\nmost frequent classes:");
  for (const c of classes.slice(0, 12)) console.log(`  ${c.name.padEnd(22)} P ${(c.precision * 100).toFixed(0)}%  n ${c.support}`);
  console.log("\nhighest-scoring wrong labels (these are why every proposal must be confirmed):");
  for (const c of report.highestScoringWrongLabels.slice(0, 8)) console.log(`  ${c.name.padEnd(22)} ${c.score.toFixed(2)}`);

  if (jsonOut) {
    await fs.writeFile(path.resolve(jsonOut), JSON.stringify(report, null, 2));
    console.log(`\nwrote ${jsonOut}`);
  }
}

await main();
