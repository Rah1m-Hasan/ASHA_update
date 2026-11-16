// Renders every screen of Asha at every viewport, measures it, and writes a report.
//
//   node scripts/visual-audit.mjs [--base URL] [--out DIR] [--routes ids]
//                                 [--viewports sets] [--variant light|dark|bn] [--strict]
//
// This is a measurement tool, not an assertion suite. The pass/fail gate is
// tests/responsive-browser.mjs; this one finds and records what needs fixing.
//
// The app is served from a production build on http://127.0.0.1:4180, because
// next dev does not hydrate in this sandbox. See docs/TEST_RESULTS.md.

import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { ROUTES, VIEWPORTS } from "./visual-audit.routes.mjs";
import { PROBE_SOURCE } from "./visual-audit.probes.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = arg("base", process.env.NEXT_TEST_URL || "http://127.0.0.1:4180");
const OUT = arg("out", "artifacts/visual-audit");
const STRICT = process.argv.includes("--strict");
// light | dark | bn — the theme and the language the page is rendered in.
const VARIANT = arg("variant", "light");
const onlyRoutes = arg("routes", "").split(",").filter(Boolean);
const onlySets = arg("viewports", "desktop,mobile,tablet,zoom").split(",").filter(Boolean);

const ROUTES_TO_RUN = onlyRoutes.length ? ROUTES.filter((r) => onlyRoutes.includes(r.id)) : ROUTES;
const SIZES = onlySets.flatMap((s) => VIEWPORTS[s] || []);

// The same stubs the existing browser suites use: no camera, no real inference,
// no writes to the store. See tests/home-browser.mjs and tests/studio-browser.mjs.
//
// The stub must export the same names the real module exports, because both the
// React app and the legacy engine import { Perception } from it.
const fakePerception = `
export function medianHeadY() { return 0; }
const VITALS = {
  bpm: null, quality: 0, confidence: 0, status: "collecting",
  reason: "The camera is off in the visual audit.", signal: [], windowSeconds: 0,
  requiredSeconds: 12, breathingBpm: null, breathingReason: "", sampleFps: 0, roiCount: 0,
  snr: null, snrNull: null,
  hrv: { rmssd: null, meanIbi: null, beats: 0, provisional: true, reason: "" },
  baseline: { bpm: null, low: null, high: null, progress: 0, calibrating: true },
  trend: [], readings: [], at: null,
};
export class Perception extends EventTarget {
  constructor() {
    super();
    this.running = false;
    this.stream = null;
    this.analysis = null;
    this.rest = null;
    this.pulse = { ...VITALS };
    this.snapshot = { raw: {}, hands: [], posture: null, pulse: { ...VITALS }, ears: [] };
    this.neuralHandActive = false;
    this.yoloEnabled = false;
  }
  setActiveModule() {}
  setCalibration() {}
  enableYolo() {}
  invalidateVitals() {}
  resetFaceReference() {}
  resetVitalsBaseline() {}
  resetVitalsSession() {}
  async start() { this.running = true; }
  stop() { this.running = false; }
  destroy() { this.stop(); }
}`;
const API_FIXTURES = [
  { pattern: "**/api/session**", body: { ok: true, events: [], status: null, profile: { id: "demo" } } },
  { pattern: "**/api/care**", body: { ok: true, events: [], status: null } },
  { pattern: "**/api/asha**", body: { ok: true, reply: "", sources: [] } },
  { pattern: "**/api/nutrition**", body: { ok: true } },
  { pattern: "**/api/clinic**", body: { ok: true, workspaces: [], invitations: [], plans: [] } },
];

async function prepare(context, route) {
  await context.route("**/engine/perception.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: fakePerception }));
  // The legacy assistive app creates a real care-circle session to open its
  // demo, so its session calls are left alone; everything else is stubbed.
  const skip = route.surface === "assistive" ? "**/api/session**" : null;
  for (const f of API_FIXTURES) {
    if (f.pattern === skip) continue;
    await context.route(f.pattern, (r) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(f.body) }));
  }
  await context.addInitScript(() => {
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Camera unavailable", "NotAllowedError"));
  });
  // Dark theme is the app's own persisted choice, applied before first paint.
  if (VARIANT === "dark") {
    await context.addInitScript(() => {
      try { localStorage.setItem("asha_theme", "dark"); } catch (e) {}
    });
  }
  // Bangla on the React screens lives in the feature's own persisted store,
  // so it is seeded before the page loads.
  if (VARIANT === "bn" && route.bnSeed) {
    await context.addInitScript((seed) => {
      try {
        const raw = localStorage.getItem(seed.key);
        const value = raw ? JSON.parse(raw) : {};
        value.language = "bn";
        localStorage.setItem(seed.key, JSON.stringify(value));
      } catch (e) {}
    }, route.bnSeed);
  }
}

/** Runs the probe in a frame when the screen is an embedded one. */
async function measure(page, route) {
  const probe = () => page.evaluate(PROBE_SOURCE);
  if (!route.frameSrc) return probe();
  const frame = await page
    .waitForFunction(
      (src) => [...document.querySelectorAll("iframe")].some((f) => f.src.includes(src)),
      route.frameSrc,
      { timeout: 10000 },
    )
    .then(() => page.frames().find((f) => f.url().includes(route.frameSrc)))
    .catch(() => null);
  if (!frame) {
    return {
      findings: [{ type: "frameMissing", text: `no frame matching ${route.frameSrc}` }],
      pageOverflow: 0,
      width: 0,
      height: 0,
    };
  }
  return frame
    .evaluate(PROBE_SOURCE)
    .catch((e) => ({ findings: [{ type: "probeError", text: String(e) }], pageOverflow: 0, width: 0, height: 0 }));
}

async function open(page, route) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(BASE + route.path, { waitUntil: "domcontentloaded" });

  // `act` is a list of the app's own controls, clicked in order, so the legacy
  // surfaces are navigated the way a person navigates them.
  for (const step of route.act || []) {
    const target = page.locator(step).first();
    const attached = await target
      .waitFor({ state: "attached", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!attached) {
      errors.push(`navigation: "${step}" was never present`);
      continue;
    }
    await target.click({ timeout: 5000 }).catch(() => {
      errors.push(`navigation: "${step}" could not be clicked`);
    });
    await page.waitForTimeout(150);
  }

  // `ready` must become visible, not merely attached: the legacy views are
  // hidden sections, so "attached" would happily match the wrong screen.
  let readyOk = true;
  if (route.ready) {
    readyOk = await page
      .locator(route.ready)
      .first()
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!readyOk) errors.push(`navigation: "${route.ready}" never became visible`);
  }

  // Bangla: the legacy apps own a language select.
  if (VARIANT === "bn") {
    const select =
      route.surface === "everyday" ? "#language"
      : route.surface === "assistive" ? "#ashaLanguage"
      : route.bnSelect;
    if (select) {
      await page.locator(select).first().selectOption({ value: "bn" }).catch(() => {});
    }
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(250); // let fonts and the last layout settle
  return { errors, readyOk };
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ["--no-sandbox", "--no-proxy-server"],
});
await mkdir(OUT, { recursive: true });
const records = [];

for (const route of ROUTES_TO_RUN) {
  for (const size of SIZES) {
    const label = size.label || `${size.width}x${size.height}`;
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      serviceWorkers: "block",
      deviceScaleFactor: 1,
    });
    await prepare(context, route);
    const page = await context.newPage();
    const { errors, readyOk } = await open(page, route);
    const measured = await measure(page, route);
    await page
      .screenshot({ path: path.join(OUT, `${route.id}__${VARIANT}__${label}.png`), fullPage: true })
      .catch(() => {});
    records.push({
      route: route.id,
      label: route.label,
      surface: route.surface,
      variant: VARIANT,
      viewport: label,
      readyOk,
      ...measured,
      errors,
    });
    await context.close();
  }
}

await browser.close();

const findings = records.flatMap((r) =>
  r.findings.map((f) => ({ route: r.route, variant: r.variant, viewport: r.viewport, ...f })));
const byType = {};
for (const f of findings) byType[f.type] = (byType[f.type] || 0) + 1;

// Merge with any earlier run so the light, dark and Bangla sweeps share one report.
const reportPath = path.join(OUT, "report.json");
const previous = await readFile(reportPath, "utf8")
  .then((t) => JSON.parse(t))
  .catch(() => ({ records: [], findings: [] }));
const merged = {
  records: [...previous.records, ...records],
  findings: [...previous.findings, ...findings],
};
await writeFile(reportPath, JSON.stringify(merged, null, 2));

const lines = [
  "# Visual audit sweep",
  "",
  `- Routes: ${ROUTES_TO_RUN.length}`,
  `- Sizes: ${SIZES.length}`,
  `- Variant: ${VARIANT}`,
  `- Screens rendered: ${records.length}`,
  `- Findings: ${findings.length}`,
  "",
  "| Finding type | Count |",
  "| --- | --- |",
  ...Object.entries(byType).map(([k, v]) => `| ${k} | ${v} |`),
  "",
];
await writeFile(path.join(OUT, `report-${VARIANT}.md`), lines.join("\n"));

console.log(JSON.stringify({
  routes: ROUTES_TO_RUN.length,
  sizes: SIZES.length,
  renders: records.length,
  variant: VARIANT,
  byType,
}, null, 2));

if (
  STRICT &&
  (findings.some((f) => f.type === "pageOverflow") || records.some((r) => r.errors.length))
) {
  process.exitCode = 1;
}
