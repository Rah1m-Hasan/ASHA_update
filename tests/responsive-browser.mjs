// Every important screen stays inside its viewport, keeps its text readable,
// names its controls, keeps its targets big enough and its contrast clear —
// in the light theme and in the dark one.
//
//   node tests/responsive-browser.mjs   (needs the server on http://127.0.0.1:4180)
//
// The visual audit (scripts/visual-audit.mjs) finds and records what needs
// fixing; this suite is the gate that stops it coming back. Both use the same
// probes (scripts/visual-audit.probes.mjs), the same stubs and the same
// navigation (scripts/visual-audit.harness.mjs), so the gate measures exactly
// what the sweep measured — on the same screens, reached the same way.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { PROBE_SOURCE } from "../scripts/visual-audit.probes.mjs";
import { prepare, openRoute } from "../scripts/visual-audit.harness.mjs";
import { ROUTES, supportsBangla } from "../scripts/visual-audit.routes.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
// The base is joined with a path, so a trailing slash in the environment
// variable must not produce a doubled one.
const base = (process.env.NEXT_TEST_URL || "http://127.0.0.1:4180").replace(/\/+$/, "");

// Both spellings are accepted: `--routes ids` and `--routes=ids`.
const arg = (name, fallback) => {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const at = process.argv.indexOf(`--${name}`);
  if (at !== -1 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--")) {
    return process.argv[at + 1];
  }
  return fallback;
};

// The variants the gate measures. Light and dark are the two themes; Bangla is
// the third visual combination, and a layout that survives English can still
// break in Bangla, because Bangla runs taller and its words are longer.
//
// This declaration has to come before its first use. It used to come after,
// and the gate died with "Cannot access 'VARIANTS' before initialization"
// before it had asserted anything at all — so for a while there was a gate
// that gated nothing, described in three documents as the thing that kept the
// defects out.
const VARIANTS = ["light", "dark", "bn"];

// The sizes that broke the most, plus both ends of the range.
const SIZES = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

// One screen per layout family: shell, forms, tables, overlays, legacy
// surfaces. The ids are the sweep's own route ids, so the gate and the sweep
// measure the same screens.
const GATE_ROUTES = [
  "landing",
  "login",
  "register",
  "patient-home",
  "patient-assistant",
  "patient-communicate",
  "patient-nutrition",
  "patient-eyespeak",
  "patient-move-session",
  "patient-settings",
  "caregiver-home",
  "caregiver-requests",
  "caregiver-patient-new",
  "assistive-welcome",
  "assistive-patient",
  "everyday-home",
].map((id) => ROUTES.find((r) => r.id === id)).filter(Boolean);

// A smoke run: `--routes landing,patient-home` measures only those screens,
// and `--themes light` only that theme. The full run is the default.
const onlyRoutes = arg("routes", "")
  .split(",")
  .filter(Boolean);
const onlyThemes = arg("themes", "")
  .split(",")
  .filter(Boolean);
const routesToCheck = onlyRoutes.length
  ? GATE_ROUTES.filter((r) => onlyRoutes.includes(r.id))
  : GATE_ROUTES;
const themesToCheck = onlyThemes.length ? onlyThemes : VARIANTS;

/**
 * The variants one screen is measured in.
 *
 * Bangla is only measured where the screen has a Bangla path at all. A screen
 * without one would render in English and be recorded as if it had been
 * checked in Bangla, which is how a gap becomes a false claim.
 */
const variantsFor = (route) =>
  themesToCheck.filter((v) => v !== "bn" || supportsBangla(route));

// The findings that are defects. "chromeOverlap" is not on this list: a fixed
// bar or a floating bubble crossing the content it floats over is what
// floating furniture does, and the sweep reports it separately.
const DEFECT_TYPES = [
  "pageOverflow",
  "offender",
  "clipped",
  "overlap",
  "tinyTarget",
  "missingName",
  "contrast",
  "heading",
];

const describe = (f) => {
  switch (f.type) {
    case "pageOverflow":
      return `the page scrolls sideways by ${f.amount}px`;
    case "offender":
      return `crosses the viewport edge (${f.left}..${f.right}px)`;
    case "clipped":
      return `content is clipped (${f.hiddenY}px below, ${f.hiddenX}px across)`;
    case "overlap":
      return `overlaps \`${f.b}\``;
    case "tinyTarget":
      return `target is ${(f.size || []).join("x")}px`;
    case "missingName":
      return "has no accessible name";
    case "contrast":
      return `contrast ${f.ratio}:1 (needs ${f.need}:1)`;
    case "heading":
      return f.text;
    default:
      return "";
  }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ["--no-sandbox", "--no-proxy-server"],
});
const errors = [];
const failures = [];

let render = 0;
const measuredByVariant = {};

for (const route of routesToCheck) {
  for (const variant of variantsFor(route)) {
    for (const size of SIZES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        serviceWorkers: "block",
        deviceScaleFactor: 1,
      });
      // The legacy assistive app opens a real care-circle session, and the
      // server allows only a handful of new sessions per address per day. Each
      // render is given its own address, so the gate is not throttled by a
      // limit that exists to slow down real people.
      await context.setExtraHTTPHeaders({
        "x-forwarded-for": `10.${(render >> 16) & 255}.${(render >> 8) & 255}.${render & 255}`,
      });
      render++;
      await prepare(context, route, variant);
      const page = await context.newPage();
      const { errors: navErrors, readyOk } = await openRoute(page, base, route, variant);
      if (!readyOk) failures.push(`${route.id} ${variant} ${size.width}: the screen never appeared`);

      const measured = await page.evaluate(PROBE_SOURCE);
      for (const f of measured.findings) {
        if (!DEFECT_TYPES.includes(f.type)) continue;
        failures.push(
          `${route.id} ${variant} ${size.width}x${size.height}: ${f.type} on \`${f.el || "page"}\` — ${describe(f)}`,
        );
      }
      measuredByVariant[variant] = (measuredByVariant[variant] || 0) + 1;
      // The context is closed before the errors are read, because a page that
      // throws while it is being torn down throws *after* the navigation is
      // over: the legacy app resets its rest tracker on `visibilitychange`,
      // which fires as the page is hidden, and that error was arriving after
      // the gate had already copied the list. Reading the list afterwards
      // catches it. The list is read by reference, so the copy below sees
      // every error the page raised, whenever it raised it.
      await context.close();
      for (const e of navErrors) errors.push(`${route.id} ${variant} ${size.width}: ${e}`);
    }
  }
}

await browser.close();

assert.deepEqual(errors, [], "no page errors");
assert.deepEqual(failures, [], "every screen fits its viewport and reads cleanly");

// The summary names every variant that ran, and how many renders each one
// got, so "the gate covers Bangla" is visible in the output rather than
// something a reader has to take on trust.
const perVariant = Object.entries(measuredByVariant)
  .map(([v, n]) => `${v} ${n}`)
  .join(", ");
console.log(
  `PASS ${routesToCheck.length} screens × ${SIZES.length} sizes × ${themesToCheck.length} themes (${perVariant}): no overflow, no clipped text, no unnamed control, no target under 24x24, no contrast failure`,
);
