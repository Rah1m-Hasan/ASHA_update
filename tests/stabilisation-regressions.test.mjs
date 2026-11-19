// The regressions repaired in the final stabilisation pass, pinned here.
//
// Each test names the defect it holds shut. A fix without a test is a fix
// that comes back, and these are the fixes whose absence was invisible:
// the responsive gate that died before asserting anything, the sweep that
// lost its report to a crash, and the server behaviours that were wrong in
// ways no test had looked at.

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// The responsive gate.
//
// It read VARIANTS before declaring it, so it died with a ReferenceError
// before it had asserted anything. Every document in the repository described
// this file as the gate that kept the visual defects out; for a while there
// was a gate that gated nothing.
// ---------------------------------------------------------------------------

test("the responsive gate declares its variants before it uses them", async () => {
  const src = await readFile(
    path.join(root, "tests/responsive-browser.mjs"),
    "utf8",
  );
  const declared = src.indexOf("const VARIANTS =");
  const used = src.indexOf("VARIANTS;");
  assert.notEqual(declared, -1, "the gate declares its variants");
  assert.notEqual(used, -1, "the gate uses its variants");
  assert.ok(
    declared < used,
    "the declaration has to come before the use, or the module throws before it runs",
  );
});

test("the responsive gate measures light, dark and Bangla", async () => {
  const src = await readFile(
    path.join(root, "tests/responsive-browser.mjs"),
    "utf8",
  );
  for (const variant of ["light", "dark", "bn"]) {
    assert.ok(
      src.includes(`"${variant}"`),
      `the gate covers the ${variant} variant`,
    );
  }
});

test("the responsive gate fails on the eight defect codes the probe emits", async () => {
  const src = await readFile(
    path.join(root, "tests/responsive-browser.mjs"),
    "utf8",
  );
  const block = src.slice(src.indexOf("const DEFECT_TYPES"), src.indexOf("];", src.indexOf("const DEFECT_TYPES")));
  for (const code of [
    "pageOverflow",
    "offender",
    "clipped",
    "overlap",
    "tinyTarget",
    "missingName",
    "contrast",
    "heading",
  ]) {
    assert.ok(block.includes(code), `the gate fails on ${code}`);
  }
  assert.ok(
    !block.includes("chromeOverlap"),
    "floating chrome crossing the content it floats over is furniture, not a defect",
  );
});

test("every defect code the probe emits is one the gate knows about", async () => {
  const probe = await readFile(
    path.join(root, "scripts/visual-audit.probes.mjs"),
    "utf8",
  );
  const gate = await readFile(
    path.join(root, "tests/responsive-browser.mjs"),
    "utf8",
  );
  const emitted = new Set();
  // The probe pushes findings both directly and through a ternary (a
  // floating control over the content is reported separately from a real
  // collision), so both spellings are picked up.
  for (const m of probe.matchAll(/push\(\s*"([a-zA-Z]+)"/g)) emitted.add(m[1]);
  for (const m of probe.matchAll(/push\([^)]*?\?\s*"([a-zA-Z]+)"\s*:\s*"([a-zA-Z]+)"/g)) {
    emitted.add(m[1]);
    emitted.add(m[2]);
  }
  assert.ok(emitted.size >= 8, "the probe emits several defect codes");
  for (const code of emitted) {
    if (code === "chromeOverlap" || code === "browserDied" || code === "renderError")
      continue;
    assert.ok(
      gate.includes(`"${code}"`),
      `the probe emits ${code}, so the gate must know about it`,
    );
  }
});

// ---------------------------------------------------------------------------
// The sweep.
//
// It wrote its report once, at the very end, so every crash lost the whole
// measurement. It also died with the browser rather than relaunching it.
// ---------------------------------------------------------------------------

test("the sweep writes its report as it goes, not only at the end", async () => {
  const src = await readFile(path.join(root, "scripts/visual-audit.mjs"), "utf8");
  // The report is written inside the route loop, so a crash at the last
  // route still leaves the first ones measured.
  const loop = src.indexOf("for (const route of ROUTES_TO_RUN)");
  const writeInLoop = src.indexOf("await writeReport()", loop);
  assert.ok(loop !== -1, "the sweep loops over the routes");
  assert.ok(
    writeInLoop !== -1,
    "the sweep writes the report inside the loop",
  );
  assert.ok(
    writeInLoop < src.indexOf("await browser.close()", writeInLoop),
    "the report is written before the browser is closed",
  );
});

test("the sweep relaunches the browser when it dies", async () => {
  const src = await readFile(path.join(root, "scripts/visual-audit.mjs"), "utf8");
  assert.ok(
    src.includes("browserDied"),
    "the sweep recognises a browser that has gone away",
  );
  assert.ok(
    src.includes("await LAUNCH()"),
    "the sweep launches a new browser",
  );
});

test("the sweep keeps the baseline and the current build in separate files", async () => {
  const src = await readFile(path.join(root, "scripts/visual-audit.mjs"), "utf8");
  assert.ok(
    src.includes('arg("out"'),
    "the output directory is a flag, so a baseline run writes elsewhere",
  );
});

// ---------------------------------------------------------------------------
// The route manifest.
//
// 1024x768 was in both the desktop and the tablet set, so one render
// overwrote the other and the sweep measured nineteen sizes, not twenty.
// ---------------------------------------------------------------------------

test("the viewport labels are unique, so no render is measured twice", async () => {
  const { VIEWPORTS } = await import("../scripts/visual-audit.routes.mjs");
  const labels = Object.values(VIEWPORTS)
    .flat()
    .map((v) => v.label || `${v.width}x${v.height}`);
  const unique = new Set(labels);
  assert.equal(
    labels.length,
    unique.size,
    `duplicate viewport labels: ${labels.length} sizes, ${unique.size} distinct`,
  );
  assert.equal(labels.length, 20, "twenty sizes per screen");
});

test("the Move plan routes are labelled the way the pages are titled", async () => {
  const { ROUTES } = await import("../scripts/visual-audit.routes.mjs");
  const plan = ROUTES.find((r) => r.id === "patient-move-plan");
  const start = ROUTES.find((r) => r.id === "patient-move-start");
  // /move/plan is the goal wizard; /move/start is the saved plan.
  assert.match(plan.label, /Build a plan/);
  assert.match(start.label, /My plan/);
});

// ---------------------------------------------------------------------------
// The server.
//
// The care-circle setup budget and the meal-logging budget shared one
// directory, so on a shared address setting up a care circle spent the
// person's meal allowance and the other way round.
// ---------------------------------------------------------------------------

test("the setup budget and the meal budget use different directories", async () => {
  const session = await readFile(
    path.join(root, "src/server/handlers/session.js"),
    "utf8",
  );
  const nutrition = await readFile(
    path.join(root, "src/server/handlers/nutrition.js"),
    "utf8",
  );
  const sessionBucket = session.match(/limits\/\$\{today\}\/([a-z]+)\//);
  const nutritionBucket = nutrition.match(/limits\/\$\{today\}\/([a-z]+)\//);
  assert.ok(sessionBucket, "the setup budget is in its own directory");
  assert.ok(nutritionBucket, "the meal budget is in its own directory");
  assert.notEqual(
    sessionBucket[1],
    nutritionBucket[1],
    "the two budgets must not share a directory",
  );
});

test("the request adapter aborts the handler when the request is given up on", async () => {
  const { toRouteHandler } = await import("../src/server/node-adapter.ts");
  let aborted = false;
  const route = toRouteHandler(
    (req, res) =>
      new Promise((resolve) => {
        req.signal.addEventListener("abort", () => {
          aborted = true;
          resolve();
        });
      }),
    { timeoutMs: 60 },
  );
  const response = await route(
    new Request("http://127.0.0.1/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(response.status, 503);
  assert.ok(
    aborted,
    "an outbound call the handler started must not outlive the request",
  );
});

test("the handler is told the body limit its route declared", async () => {
  const { toRouteHandler } = await import("../src/server/node-adapter.ts");
  let seen = null;
  const route = toRouteHandler(
    (req, res) => {
      seen = req.bodyLimit;
      res.json({ ok: true });
    },
    { maxBodyLength: 660000 },
  );
  await route(
    new Request("http://127.0.0.1/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(seen, 660000);
});

test("the body reader uses the route's limit rather than a second one of its own", async () => {
  const common = await readFile(
    path.join(root, "src/server/lib/common.js"),
    "utf8",
  );
  const bodyFn = common.slice(
    common.indexOf("export function body("),
    common.indexOf("export async function authenticate"),
  );
  assert.ok(
    !/b\.length > 20000/.test(bodyFn),
    "the body reader must not carry its own hard-coded limit",
  );
  assert.ok(
    bodyFn.includes("bodyLimit"),
    "the body reader uses the limit the route declared",
  );
});

test("the provider gives up before the request adapter does", async () => {
  const provider = await readFile(
    path.join(root, "src/server/lib/maira-provider.js"),
    "utf8",
  );
  const adapter = await readFile(
    path.join(root, "src/server/node-adapter.ts"),
    "utf8",
  );
  const providerMs = Number(
    provider.match(/PROVIDER_TIMEOUT_MS\s*=\s*(\d+)/)?.[1],
  );
  const adapterMs = Number(
    adapter.match(/DEFAULT_TIMEOUT_MS\s*=\s*(\d+)/)?.[1],
  );
  assert.ok(providerMs > 0, "the provider has a budget of its own");
  assert.ok(
    providerMs < adapterMs,
    `the provider (${providerMs}ms) must give up before the adapter (${adapterMs}ms)`,
  );
});

test("a meal with the same food twice is refused as the person's mistake", async () => {
  const nutrition = await readFile(
    path.join(root, "src/server/handlers/nutrition.js"),
    "utf8",
  );
  assert.ok(
    nutrition.includes("seenFoods"),
    "the duplicate food is caught before the calculator throws",
  );
  assert.ok(
    /status\(400\)/.test(nutrition.slice(nutrition.indexOf("seenFoods.has"))),
    "a duplicate food is a 400, not a 500",
  );
});

// ---------------------------------------------------------------------------
// The visual harness's perception stub.
//
// The stub replaces the real perception module in the browser, so that the
// sweep and the gate can measure a page without a camera. It left `analysis`,
// `rest` and `vitals` as null, because the real module builds them as
// objects and nothing in the app had touched them yet.
//
// Then the legacy assistive app called `perception.rest.reset()` when the
// page was backgrounded, and every assistive screen threw a TypeError on
// every one of the twenty viewports. The error was in the sweep's own
// report, and it was not a defect in the app: with the real module, `rest`
// is always a RestTracker.
//
// A stub that is not faithful does not just measure the wrong page - it
// hides real defects behind a fake one.
// ---------------------------------------------------------------------------

test("the perception stub is not thinner than the module it replaces", async () => {
  const harness = await readFile(
    path.join(root, "scripts/visual-audit.harness.mjs"),
    "utf8",
  );
  const real = await readFile(
    path.join(root, "public/engine/perception.js"),
    "utf8",
  );
  const stub = harness.slice(
    harness.indexOf("export const fakePerception"),
    harness.indexOf("export const API_FIXTURES"),
  );

  // The app calls methods on these three; the real module always builds them
  // as objects, so a stub that leaves them null makes the page throw.
  for (const member of ["analysis", "rest", "vitals"]) {
    assert.ok(
      real.includes(`this.${member} = new`),
      `the real module builds ${member}`,
    );
    assert.ok(
      !new RegExp(`this\\.${member}\\s*=\\s*null`).test(stub),
      `the stub must not leave ${member} null: the app calls methods on it`,
    );
    assert.ok(
      new RegExp(`this\\.${member}\\s*=\\s*\\{`).test(stub),
      `the stub must give ${member} the object the real module gives it`,
    );
  }

  // The two the app calls by name.
  assert.ok(
    stub.includes("addLog("),
    "the app records movements with analysis.addLog, so the stub has it",
  );
  assert.ok(
    /reset\(\)\s*\{[^}]*this\.resting/.test(stub) || stub.includes("reset()"),
    "the app resets the rest tracker when the page is backgrounded",
  );
});

test("the gate reads the page's errors after the page is closed, not before", async () => {
  const src = await readFile(
    path.join(root, "tests/responsive-browser.mjs"),
    "utf8",
  );
  const closeAt = src.indexOf("await context.close()");
  const readAt = src.indexOf("for (const e of navErrors) errors.push");
  assert.ok(closeAt > -1 && readAt > -1, "the gate closes the context and reads the errors");
  assert.ok(
    readAt > closeAt,
    "the errors must be read after the context is closed: a page that throws " +
      "while it is torn down throws after the navigation is over",
  );
});

test("a screen that is supposed to answer 404 may say so", async () => {
  const routes = await readFile(
    path.join(root, "scripts/visual-audit.routes.mjs"),
    "utf8",
  );
  const harness = await readFile(
    path.join(root, "scripts/visual-audit.harness.mjs"),
    "utf8",
  );
  const notFound = routes
    .split("\n")
    .find((l) => l.includes('id: "not-found"'));
  assert.ok(notFound, "the manifest measures the page that is not found");
  assert.ok(
    notFound.includes("expectStatus: 404"),
    "the not-found screen declares the status it is supposed to answer",
  );
  assert.ok(
    harness.includes("expectStatus"),
    "the harness honours the declared status instead of calling the browser's " +
      "report of it an error",
  );
});
