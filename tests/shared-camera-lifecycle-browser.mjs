// The shared camera opens once for every module and is released when it stops.
//
// The model-level suites (tests/shared-camera-browser.mjs) need the
// git-ignored face photos in artifacts/, which are not on every machine.
// This checks the camera lifecycle itself, which does not need a person in
// frame: one stream across every module, tracks released on pause, and no
// application errors.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.ASHA_TEST_BASE || "http://127.0.0.1:4180/";
await fs.mkdir("artifacts", { recursive: true });

const profile = {
  patientId: "0123456789abcdef01234567",
  label: "Shared camera lifecycle",
  assessment: {
    leftHand: "reliable",
    rightHand: "reliable",
    wrist: "reliable",
    fingers: "reliable",
    eyes: "reliable",
    lips: "reliable",
    head: "reliable",
    speech: "limited",
    canSee: true,
    canHear: true,
  },
  supportContext: { categories: [], goals: [], note: "" },
  recommendation: { primary: "facespeak", suggested: ["facespeak"] },
  voice: { name: "", rate: 0.9 },
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox", "--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/api/session**", (route) => {
    const body = route.request().postDataJSON();
    if (body?.action === "create")
      return route.fulfill({
        json: { ...profile, patientToken: "demo-patient-token" },
      });
    return route.fulfill({
      json: { profile, role: "patient", events: [], status: null },
    });
  });
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { cloudConfigured: false } }),
  );
  await page.addInitScript(() => {
    window.cameraOpenCount = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        window.cameraOpenCount++;
        // A plain canvas stream: the camera lifecycle is what is under test.
        const canvas = Object.assign(document.createElement("canvas"), {
          width: 640,
          height: 480,
        });
        const ctx = canvas.getContext("2d");
        const draw = () => {
          ctx.fillStyle = "#4a5a6a";
          ctx.fillRect(0, 0, 640, 480);
        };
        draw();
        window.fixtureTimer = setInterval(draw, 40);
        const stream = canvas.captureStream(25);
        stream.getTracks()[0].addEventListener("ended", () =>
          clearInterval(window.fixtureTimer),
        );
        window.fixtureStream = stream;
        return stream;
      },
    });
  });

  await page.goto(base + "?module=facespeak");
  await page.locator("#studioStart").waitFor();
  await page.locator("#studioStart").click();

  // The camera opens and the models load.
  await page.waitForFunction(
    () => !document.getElementById("pauseMonitoring").hidden,
    null,
    { timeout: 90000 },
  );
  assert.equal(await page.evaluate(() => window.cameraOpenCount), 1);

  // Every module reads the same stream: the camera is not reopened.
  for (const module of [
    "facespeak",
    "fingerspeak",
    "vitalsense",
    "senseassist",
    "posture",
  ]) {
    await page.locator(`[data-module=${module}]`).click();
    await page.waitForTimeout(1200);
    assert.equal(
      await page.evaluate(() => window.cameraOpenCount),
      1,
      `${module} must not open a second camera`,
    );
  }

  // Stopping releases the camera. The Shared camera panel button toggles.
  await page.locator("#studioStart").click();
  await page.waitForFunction(
    () =>
      window.fixtureStream.getTracks().every((t) => t.readyState === "ended"),
    null,
    { timeout: 10000 },
  );

  // Starting again opens exactly one camera.
  await page.locator("#studioStart").click();
  await page.waitForFunction(
    () => !document.getElementById("pauseMonitoring").hidden,
    null,
    { timeout: 90000 },
  );
  assert.equal(await page.evaluate(() => window.cameraOpenCount), 2);

  assert.deepEqual(errors, [], "no application errors");
  const report = {
    base,
    oneCameraAcrossModules: true,
    cameraReleasedOnPause: true,
    restartOpensOneCamera: true,
    applicationErrors: errors,
  };
  console.log(JSON.stringify(report));
  await fs.writeFile(
    "artifacts/shared-camera-lifecycle.json",
    JSON.stringify(report, null, 2),
  );
} catch (error) {
  await page.screenshot({
    path: "artifacts/shared-camera-lifecycle-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
