// Every important screen stays inside its viewport, on the narrowest phone and on
// the widest desktop, with no console errors and no unnamed control.
//
//   node tests/responsive-browser.mjs   (needs the server on http://127.0.0.1:4180)
//
// The visual audit (scripts/visual-audit.mjs) finds and records what needs
// fixing; this suite is the gate that stops it coming back.

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.NEXT_TEST_URL || "http://127.0.0.1:4180";

// The sizes that broke the most, plus both ends of the range.
const SIZES = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

// One screen per layout family: shell, forms, tables, overlays, legacy surfaces.
const PATHS = [
  "/",
  "/login",
  "/register",
  "/dashboard/patient",
  "/dashboard/patient/communicate",
  "/dashboard/patient/nutrition",
  "/dashboard/patient/eyespeak",
  "/dashboard/patient/move/session",
  "/dashboard/patient/settings",
  "/dashboard/caregiver",
  "/dashboard/caregiver/requests",
  "/dashboard/caregiver/patients/new",
  "/assistive.html",
  "/everyday.html",
];

const fakePerception =
  "export function getPerception(){return {on(){return()=>{}},running:false,start(){},stop(){}}}";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ["--no-sandbox", "--no-proxy-server"],
});
const errors = [];
const failures = [];

async function open(context) {
  await context.route("**/engine/perception.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: fakePerception }));
  await context.route("**/api/**", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, events: [], status: null, workspaces: [], replies: [] }),
    }));
  await context.addInitScript(() => {
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("no camera", "NotAllowedError"));
  });
}

for (const size of SIZES) {
  const context = await browser.newContext({ viewport: size, serviceWorkers: "block" });
  await open(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${size.width}: ${e.message}`));

  for (const p of PATHS) {
    await page.goto(base + p, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (wide > 1) failures.push(`${p} overflows by ${wide}px at ${size.width}x${size.height}`);

    // A control nobody can hear about is a defect, not a style choice.
    const unnamed = await page.evaluate(() => {
      const name = (el) => {
        const aria = el.getAttribute("aria-label");
        if (aria && aria.trim()) return aria.trim();
        const ids = el.getAttribute("aria-labelledby");
        if (ids) {
          const t = ids
            .split(/\s+/)
            .map((id) => (document.getElementById(id) || {}).textContent || "")
            .join(" ")
            .trim();
          if (t) return t;
        }
        if (el.labels && el.labels.length) {
          const t = Array.from(el.labels).map((l) => l.textContent || "").join(" ").trim();
          if (t) return t;
        }
        const alt = el.getAttribute("alt");
        if (alt && alt.trim()) return alt.trim();
        const title = el.getAttribute("title");
        if (title && title.trim()) return title.trim();
        return (el.innerText || el.textContent || "").trim();
      };
      return Array.from(
        document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]'),
      )
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return false;
          const cs = getComputedStyle(el);
          return cs.visibility !== "hidden" && cs.display !== "none";
        })
        .filter((el) => !name(el))
        .map((el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""));
    });
    if (unnamed.length) {
      failures.push(`${p} has unnamed controls at ${size.width}x${size.height}: ${unnamed.join(", ")}`);
    }
  }
  await context.close();
}

await browser.close();

assert.deepEqual(errors, [], "no page errors");
assert.deepEqual(failures, [], "every screen fits its viewport and names its controls");
console.log("PASS Every important screen fits its viewport and names its controls at every size");
