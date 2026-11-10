// Runs ASHA Nutrition's real classifier worker (public/engine/food-classifier-worker.js) in headless
// Chromium on a folder of photos and prints, for each, the top labels, the suggestion ASHA would
// make, whether a face was found, the quality warnings and the time taken.
//
//   node scripts/nutrition-vision-check.mjs <folder-of-jpg-or-png>
//
// Needs the dev server (NEXT_TEST_URL, default http://127.0.0.1:4180). Photos stay on this machine.
// This is a smoke check of the pipeline, not an accuracy evaluation.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { suggestionsFrom } from "../src/features/nutrition/scan.js";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/nutrition-vision-check.mjs <folder>");
  process.exit(2);
}
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.NEXT_TEST_URL || "http://127.0.0.1:4180";
const files = (await fs.readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox", "--no-proxy-server"] });
const page = await browser.newPage();
for (const f of files) await page.route(`**/__img/${encodeURIComponent(f)}`, async (r) => r.fulfill({ body: await fs.readFile(path.join(dir, f)) }));
await page.goto(base + "/manifest.webmanifest").catch(() => page.goto(base));
const out = await page.evaluate(async (files) => {
  const w = new Worker("/engine/food-classifier-worker.js");
  const next = () => new Promise((res) => (w.onmessage = (e) => res(e.data)));
  const t0 = performance.now();
  w.postMessage({ type: "init" });
  const ready = await next();
  ready.wallMs = Math.round(performance.now() - t0);
  const rows = [];
  for (const f of files) {
    const img = new Image();
    img.src = "/__img/" + encodeURIComponent(f);
    await img.decode();
    // The same centre square (80% of the short side, 224 px) and 640 px frame the app sends.
    const side = Math.round(Math.min(img.width, img.height) * 0.8);
    const times = [];
    let last = null;
    for (let i = 0; i < 6; i++) {
      const crop = await createImageBitmap(img, Math.round((img.width - side) / 2), Math.round((img.height - side) / 2), side, side, { resizeWidth: 224, resizeHeight: 224 });
      const s = Math.min(1, 640 / Math.max(img.width, img.height));
      const frame = await createImageBitmap(img, { resizeWidth: Math.round(img.width * s), resizeHeight: Math.round(img.height * s) });
      w.postMessage({ type: "classify", id: i, crop, frame }, [crop, frame]);
      last = await next();
      times.push(last.ms);
    }
    rows.push({ file: f, ...last, times });
  }
  w.terminate();
  return { ready, rows, ua: navigator.userAgent };
}, files);
await browser.close();
console.log(`Worker ready in ${out.ready.wallMs} ms (models ${out.ready.loadMs} ms, face check ${out.ready.faceCheck ? "on" : "off"})`);
for (const r of out.rows) {
  const s = suggestionsFrom(r.categories);
  const sorted = [...r.times].sort((a, b) => a - b);
  console.log(
    `${r.file}: top ${r.categories.slice(0, 3).map((c) => `${c.label} ${c.score.toFixed(2)}`).join(", ")} -> suggestion ${s.map((x) => x.dishId).join(", ") || "none"}; faces ${r.faceCount}; warnings ${r.quality.warnings.join(",") || "none"}; ${sorted[Math.floor(sorted.length / 2)]} ms median of ${sorted.length} (first ${r.times[0]} ms)`,
  );
}
