// FaceSpeak shows an abnormal one-sided lip stretch with its time threshold, not "smile symmetry".
//   node tests/facespeak-stretch-browser.mjs   (needs the dev server, NEXT_TEST_URL, default http://127.0.0.1:4180)
// The camera is a fake engine that emits the engine's "frame" snapshots, so this checks what the page
// shows for each state of the real analysis (public/engine/face-analysis.js, covered by
// tests/face-analysis.test.mjs). It says nothing about detection on a real face.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.NEXT_TEST_URL || "http://127.0.0.1:4180";
const shot = process.env.STRETCH_SHOT;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true, args: ["--no-sandbox", "--no-proxy-server"] });
const errors = [];

const fakePerception = `
export class Perception extends EventTarget {
  constructor() { super(); this.running = false; this.snapshot = {}; this.pulse = {}; window.__perception = this; }
  async start() { this.running = true; }
  stop() { this.running = false; }
  setCalibration() {}
  setActiveModule() {}
  setGazeCursor() {}
  async setFacingMode(f) { return f; }
  resetFaceReference() {}
  resetVitalsBaseline() {}
  resetVitalsSession() {}
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, {detail})); }
}
`;

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  await context.route("**/engine/perception.js", (r) => r.fulfill({ contentType: "text/javascript", body: fakePerception }));
  await context.route("**/api/session**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, events: [], status: null }) }));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/dashboard/patient/facespeak");
  await page.getByRole("heading", { name: "FaceSpeak", level: 1 }).waitFor();
  const panel = page.getByTestId("abnormal-stretch");
  await panel.getByText("Start the camera to measure.").waitFor();
  assert.equal(await page.getByText("Smile symmetry").count(), 0, "no smile symmetry meter");
  await page.getByRole("button", { name: "Start camera" }).first().click();
  await page.waitForFunction(() => window.__perception?.running);
  // Keep sending one analysis snapshot, as the engine does every frame.
  const send = (analysis) =>
    page.evaluate((analysis) => {
      clearInterval(window.__frames);
      const tick = () => window.__perception.emit("frame", { t: performance.now(), raw: {}, face: {}, blinks: 0, latency: 30, analysis: { valid: true, ready: true, au: { values: {} }, head: { yaw: 0, pitch: 0, roll: 0 }, smile: { intensity: 0, symmetry: 100 }, eye: {}, ...analysis } });
      tick();
      window.__frames = setInterval(tick, 60);
    }, analysis);
  const status = () => page.getByTestId("stretch-status").textContent();
  const time = () => page.getByTestId("stretch-time").textContent();

  await send({ ready: false, neutralProgress: 12, lip: { deviation: 0.004, threshold: 0.035, side: "left", kind: "Lateral shift", active: false, duration: 0, latched: false } });
  await panel.getByText("Learning your resting face (12 of 45 frames)", { exact: false }).waitFor();

  await send({ lip: { deviation: 0.006, threshold: 0.035, side: "right", kind: "Lateral shift", active: false, duration: 0, latched: false } });
  await panel.getByText("Within your resting range.").waitFor();
  assert.equal(await time(), "0 of 60 s");

  // A one-sided pull beyond the threshold counts up; it is not logged before 60 seconds.
  await send({ lip: { deviation: -0.052, threshold: 0.035, side: "left", kind: "Lateral shift", active: true, duration: 12.4, latched: false } });
  await panel.getByText("Counting: lips pulled to the left. It is logged only if it lasts 60 seconds.").waitFor();
  assert.equal(await time(), "12 of 60 s");
  assert.equal(await page.getByTestId("stretch-value").textContent(), "Left · 5.2% of face width");
  assert.equal(await panel.getAttribute("data-active"), "true");
  if (shot && viewport.width > 1000) {
    await page.waitForTimeout(600); // let the bars finish moving
    await page.screenshot({ path: shot, fullPage: false });
  }

  // Over the threshold but not counted (an even smile, or the head turned).
  await send({ smile: { intensity: 0.7, symmetry: 95 }, lip: { deviation: 0.05, threshold: 0.035, side: "right", kind: "Lateral shift", active: false, duration: 0, latched: false } });
  await panel.getByText("Not counted: an even smile, or the head is turned or tilted.").waitFor();
  assert.equal(await time(), "0 of 60 s");

  // Held for the whole time on the same side.
  await send({ lip: { deviation: 0.046, threshold: 0.04, side: "right", kind: "Corner asymmetry", active: true, duration: 60, latched: true } });
  await panel.getByText("Held for 60 seconds on the right. Logged for review. This is an observation, not a diagnosis.").waitFor();
  assert.equal(await time(), "60 of 60 s");

  await send({ valid: false, lip: { duration: 0, latched: false } });
  await panel.getByText("Face not tracked, so nothing is counted.").waitFor();
  assert.match(await status(), /Face not tracked/);

  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(wide <= 1, `FaceSpeak overflows by ${wide}px at ${viewport.width}px`);
  await page.evaluate(() => clearInterval(window.__frames));
  await context.close();
}

await browser.close();
assert.deepEqual(errors, [], "no page errors");
console.log("FaceSpeak stretch browser: abnormal stretch with threshold and 60-second hold timer replaces smile symmetry; learning, resting, counting, not counted, logged and no-face states; desktop and phone passed");
