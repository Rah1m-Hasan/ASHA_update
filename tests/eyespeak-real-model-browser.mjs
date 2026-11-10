// EyeSpeak with the real camera engine and the real MediaPipe face model, on the official face
// fixture used by shared-camera-browser.mjs (artifacts/portrait-test.jpg). The camera is the photo,
// cropped to head and shoulders and streamed at 25 fps. Proves the real pipeline finds both irises
// and feeds EyeSpeak; a photo can't look around, so gaze accuracy is measured per person on screen.
//   node tests/eyespeak-real-model-browser.mjs   (needs the dev server, NEXT_TEST_URL, default http://127.0.0.1:4180)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.NEXT_TEST_URL || "http://127.0.0.1:4180";
const fixture = new URL("../artifacts/portrait-test.jpg", import.meta.url);
const image = await fs.readFile(fixture).catch(() => null);
if (!image) {
  console.log("EyeSpeak real model: skipped, artifacts/portrait-test.jpg is not on this machine");
  process.exit(0);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true, args: ["--no-sandbox", "--no-proxy-server"] });
const errors = [];
for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  await context.route("**/artifacts/portrait-test.jpg", (r) => r.fulfill({ contentType: "image/jpeg", body: image }));
  await context.route("**/api/session**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, events: [], status: null }) }));
  await context.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const photo = new Image();
        photo.src = "/artifacts/portrait-test.jpg";
        await photo.decode();
        const canvas = Object.assign(document.createElement("canvas"), { width: 640, height: 480 });
        const ctx = canvas.getContext("2d");
        // Head and shoulders, as a webcam at arm's length sees a person.
        const draw = () => ctx.drawImage(photo, 160, 10, 480, 360, 0, 0, 640, 480);
        draw();
        setInterval(draw, 40);
        return canvas.captureStream(25);
      },
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/dashboard/patient/eyespeak");
  await page.getByRole("heading", { name: "EyeSpeak", level: 1 }).waitFor();
  await page.getByRole("button", { name: "Start camera" }).first().click();
  const started = Date.now();
  await page.waitForFunction(() => document.querySelector("[data-testid=eye-overlay]")?.dataset.irises === "2");
  const firstMs = Date.now() - started;
  await page.getByTestId("eye-status").getByText("Both eyes and irises tracked").waitFor();
  let tracked = 0;
  for (let i = 0; i < 20; i++) {
    tracked += await page.evaluate(() => (document.querySelector("[data-testid=eye-overlay]")?.dataset.irises === "2" && !!document.querySelector("[data-testid=raw-eye-dot]") ? 1 : 0));
    await page.waitForTimeout(100);
  }
  assert.ok(tracked >= 18, `both irises in ${tracked} of 20 samples`);
  // EyeSpeak runs the face model alone, so results come steadily enough for a gaze dwell.
  const fps = Number(await page.getByTestId("eye-rate").getAttribute("data-fps"));
  assert.ok(fps >= 4, `face results per second shown on the page (${fps})`);
  assert.equal(await page.getByRole("button", { name: "Start calibration" }).isDisabled(), false, "calibration opens once the eyes are tracked");
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, "no sideways scrolling");
  console.log(`  ${viewport.width}px: first irises after ${firstMs} ms, both irises in ${tracked}/20 samples, ${fps} face results per second`);
  await context.close();
}
await browser.close();
assert.deepEqual(errors, [], "no page errors");
console.log("EyeSpeak real model: the MediaPipe face model finds both irises on a real face and EyeSpeak shows them, desktop and phone");
