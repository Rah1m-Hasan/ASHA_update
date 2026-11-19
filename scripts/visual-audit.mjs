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
import { ROUTES, VIEWPORTS, routesForVariant } from "./visual-audit.routes.mjs";
import { PROBE_SOURCE } from "./visual-audit.probes.mjs";
import { prepare, openRoute } from "./visual-audit.harness.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// Both spellings are accepted: `--variant=dark` and `--variant dark`. A
// space-separated flag that is silently ignored is worse than one that
// errors, because the sweep then measures the wrong thing and says nothing.
const arg = (name, fallback) => {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const at = process.argv.indexOf(`--${name}`);
  if (at !== -1 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--")) {
    return process.argv[at + 1];
  }
  return fallback;
};

const BASE = arg("base", process.env.NEXT_TEST_URL || "http://127.0.0.1:4180");
const OUT = arg("out", "artifacts/visual-audit");
const STRICT = process.argv.includes("--strict");
// light | dark | bn — the theme and the language the page is rendered in.
const VARIANT = arg("variant", "light");
const onlyRoutes = arg("routes", "").split(",").filter(Boolean);
const onlySets = arg("viewports", "desktop,mobile,tablet,zoom").split(",").filter(Boolean);

// The variant decides which screens the sweep covers: the light sweep is the
// whole app, and the dark and Bangla sweeps cover the screens those two
// changes actually put at risk. The split lives in the manifest, next to the
// routes it describes, so the report's coverage claim can be checked.
const VARIANT_ROUTES = routesForVariant(VARIANT);
const ROUTES_TO_RUN = onlyRoutes.length
  ? VARIANT_ROUTES.filter((r) => onlyRoutes.includes(r.id))
  : VARIANT_ROUTES;
const SIZES = onlySets.flatMap((s) => VIEWPORTS[s] || []);

/**
 * A bound on a step that could otherwise wait for ever.
 *
 * Playwright's own default is thirty seconds for an action, which is far too
 * long when the step is one of a thousand: a select that is hidden costs half
 * a minute per render and the sweep crawls. Every step that touches the page
 * is bounded here, so one slow screen costs one lost render and not the run.
 */
const STEP_TIMEOUT_MS = 8000;

/**
 * Runs a step, and gives up on it after `ms`.
 *
 * A step that times out returns `undefined` rather than throwing, so the
 * caller can record what did not happen instead of losing the whole sweep.
 */
async function bounded(fn, ms = STEP_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(undefined), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Runs the probe in a frame when the screen is an embedded one. */
async function measure(page, route) {
  const timedOut = () => ({
    findings: [
      {
        type: "probeTimeout",
        text: "the probe did not finish; the page did not answer",
      },
    ],
    pageOverflow: 0,
    width: 0,
    height: 0,
  });
  const probe = async () => {
    const measured = await bounded(async () => {
      try {
        return await page.evaluate(PROBE_SOURCE);
      } catch (e) {
        return {
          findings: [{ type: "probeError", text: String(e) }],
          pageOverflow: 0,
          width: 0,
          height: 0,
        };
      }
    }, 15000);
    return measured === undefined ? timedOut() : measured;
  };
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
  const measured = await bounded(async () => {
    try {
      return await frame.evaluate(PROBE_SOURCE);
    } catch (e) {
      return {
        findings: [{ type: "probeError", text: String(e) }],
        pageOverflow: 0,
        width: 0,
        height: 0,
      };
    }
  }, 15000);
  return measured === undefined ? timedOut() : measured;
}

/**
 * Clicks a control inside an embedded frame.
 *
 * A module that lives in an iframe can only be reached from inside that
 * frame: the tab strip of the FingerSpeak studio is in the studio's own
 * document, not in the page that hosts it. `frameAct` names the frame and
 * the controls to press, in the order a person would press them.
 */
async function actInFrame(page, route) {
  const plan = route.frameAct;
  if (!plan || !plan.steps || !plan.steps.length) return [];
  const errors = [];
  const frame = await page
    .waitForFunction(
      (src) => [...document.querySelectorAll("iframe")].some((f) => f.src.includes(src)),
      plan.frameSrc,
      { timeout: 10000 },
    )
    .then(() => page.frames().find((f) => f.url().includes(plan.frameSrc)))
    .catch(() => null);
  if (!frame) {
    errors.push(`navigation: no frame matching ${plan.frameSrc}`);
    return errors;
  }
  for (const step of plan.steps) {
    const pressed = await frame
      .locator(step)
      .first()
      .click({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!pressed) errors.push(`navigation: "${step}" could not be clicked in the frame`);
    await page.waitForTimeout(200);
  }
  return errors;
}

const LAUNCH = () =>
  chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    headless: true,
    args: ["--no-sandbox", "--no-proxy-server"],
  });

await mkdir(OUT, { recursive: true });
const records = [];

// The browser dies. It has died in every previous sweep, partway through,
// with "Target page, context or browser has been closed" — and the whole
// sweep's report was lost with it, because the report was written once, at
// the end. A measurement that a crash can erase is not a measurement.
//
// So the report is written after every route, and a dead browser is relaunched
// rather than ending the run. The machine this runs on has 7.6 GB of RAM and
// about 1.5 GB free, and a thousand Chromium contexts will eventually exhaust
// it; a sweep that survives that is worth more than a sweep that dies at
// render 400 and reports nothing.
let browser = await LAUNCH();

/** True when the error is the browser going away rather than the page's fault. */
const browserDied = (e) =>
  /Target page, context or browser has been closed|browser has been closed|has been closed/i.test(
    String(e?.message || e),
  );

const reportPath = path.join(OUT, "report.json");

/**
 * Writes the merged report.
 *
 * A screen measured again replaces its earlier record: the newest measurement
 * of a route at a viewport is the one that describes the code as it is now.
 * The light, dark and Bangla sweeps share one report, so the merge is with
 * whatever the file already holds.
 */
async function writeReport() {
  const previous = await readFile(reportPath, "utf8")
    .then((t) => JSON.parse(t))
    .catch(() => ({ records: [], findings: [] }));
  const key = (r) => `${r.route}|${r.variant}|${r.viewport}`;
  const merged = new Map(previous.records.map((r) => [key(r), r]));
  for (const r of records) merged.set(key(r), r);
  const mergedRecords = [...merged.values()];
  const mergedFindings = mergedRecords.flatMap((r) =>
    r.findings.map((f) => ({ route: r.route, variant: r.variant, viewport: r.viewport, ...f })),
  );
  await writeFile(reportPath, JSON.stringify({ records: mergedRecords, findings: mergedFindings }, null, 2));
  return { mergedRecords, mergedFindings };
}

const started = Date.now();
let render = 0;
// Relaunching on a schedule as well as on a crash: a browser that is
// degrading usually dies outright, but not always, and a fresh browser every
// hundred and fifty renders is cheap against a sweep of a thousand.
const RELAUNCH_EVERY = 150;
let sinceLaunch = 0;

for (const route of ROUTES_TO_RUN) {
  for (const size of SIZES) {
    const label = size.label || `${size.width}x${size.height}`;
    let context = null;
    let page = null;
    try {
      if (sinceLaunch >= RELAUNCH_EVERY) {
        await browser.close().catch(() => {});
        browser = await LAUNCH();
        sinceLaunch = 0;
      }
      context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        serviceWorkers: "block",
        deviceScaleFactor: 1,
      });
      // The legacy assistive app opens a real care-circle session, and the
      // server allows only a handful of new sessions per address per day. Each
      // render is given its own address so a sweep of hundreds of screens is
      // not throttled by a limit that exists to slow down real people.
      await context.setExtraHTTPHeaders({
        "x-forwarded-for": `10.${(render >> 16) & 255}.${(render >> 8) & 255}.${render & 255}`,
      });
      render++;
      await prepare(context, route, VARIANT);
      page = await context.newPage();
      const { errors, readyOk } = await openRoute(page, BASE, route, VARIANT);
      errors.push(...(await actInFrame(page, route)));
      const measured = await measure(page, route);
      await bounded(
        () =>
          page.screenshot({
            path: path.join(OUT, `${route.id}__${VARIANT}__${label}.png`),
            fullPage: true,
          }),
        15000,
      ).catch(() => {});
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
    } catch (e) {
      if (browserDied(e)) {
        // The browser went away. Record the render as failed, relaunch, and
        // carry on — one lost render is a measurement; a lost sweep is not.
        records.push({
          route: route.id,
          label: route.label,
          surface: route.surface,
          variant: VARIANT,
          viewport: label,
          readyOk: false,
          findings: [{ type: "browserDied", text: String(e?.message || e) }],
          pageOverflow: 0,
          width: size.width,
          height: size.height,
          errors: [`browser died during the render: ${String(e?.message || e)}`],
        });
        await browser.close().catch(() => {});
        browser = await LAUNCH();
        sinceLaunch = 0;
        console.error(
          `  the browser died on ${route.id} ${label}; relaunched and continuing`,
        );
      } else {
        records.push({
          route: route.id,
          label: route.label,
          surface: route.surface,
          variant: VARIANT,
          viewport: label,
          readyOk: false,
          findings: [{ type: "renderError", text: String(e?.message || e) }],
          pageOverflow: 0,
          width: size.width,
          height: size.height,
          errors: [`render failed: ${String(e?.message || e)}`],
        });
        console.error(`  render failed on ${route.id} ${label}: ${e?.message || e}`);
      }
    } finally {
      await context?.close().catch(() => {});
      sinceLaunch++;
      if (render % 25 === 0 || render === ROUTES_TO_RUN.length * SIZES.length) {
        const secs = Math.round((Date.now() - started) / 1000);
        console.error(
          `  ${render}/${ROUTES_TO_RUN.length * SIZES.length} renders · ${route.id} ${label} · ${secs}s`,
        );
      }
    }
  }
  // The report is written after every route, so a crash at render 900 cannot
  // take the first 899 with it.
  await writeReport();
}

await browser.close().catch(() => {});

const findings = records.flatMap((r) =>
  r.findings.map((f) => ({ route: r.route, variant: r.variant, viewport: r.viewport, ...f })));
const byType = {};
for (const f of findings) byType[f.type] = (byType[f.type] || 0) + 1;

const { mergedRecords, mergedFindings } = await writeReport();

const lines = [
  "# Visual audit sweep",
  "",
  `- Routes: ${ROUTES_TO_RUN.length}`,
  `- Sizes: ${SIZES.length}`,
  `- Variant: ${VARIANT}`,
  `- Screens rendered: ${records.length}`,
  `- Findings: ${findings.length}`,
  `- Report records (all variants): ${mergedRecords.length}`,
  `- Report findings (all variants): ${mergedFindings.length}`,
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
