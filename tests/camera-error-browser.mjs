// The reported bug: on an insecure origin the browser exposes no camera API,
// and the patient used to be shown a raw JavaScript exception.
//
// 127.0.0.1 is itself a secure context, so the insecure origin is simulated:
// navigator.mediaDevices is removed and isSecureContext is set to false.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.NEXT_TEST_URL || "http://127.0.0.1:4180";
await fs.mkdir("artifacts", { recursive: true });

const profile = {
  patientId: "c".repeat(24),
  label: "Camera error check",
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

/** Remove the camera API, the way an http:// origin does. */
function insecureOrigin() {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: false,
  });
  window.speechSynthesis = {
    getVoices: () => [],
    cancel() {},
    speak() {},
  };
}

const RAW = /getUserMedia|Cannot read properties of undefined/;
const SECURE = /https/i;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox", "--no-proxy-server"],
});
const errors = [];
const report = { base };
let openPage = null;

try {
  // ---- the legacy assistive shell, the surface in the bug report ----------
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    openPage = page;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(insecureOrigin);
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
    await page.goto(base + "?module=facespeak");
    await page.locator("#studioStart").waitFor();
    await page.locator("#studioStart").click();

    // The reason reaches the patient, in words.
    await page.waitForFunction(
      () => /https/i.test(document.getElementById("cameraStatus")?.textContent || ""),
      null,
      { timeout: 20000 },
    );
    const status = await page.locator("#cameraStatus").innerText();
    const toast = await page.locator("#toast").innerText();
    assert.match(status, SECURE, "the camera panel explains the https address");
    assert.doesNotMatch(status, RAW, "no raw exception on the camera panel");
    assert.doesNotMatch(toast, RAW, "no raw exception in the toast");
    assert.equal(
      await page.locator("#toast").isVisible(),
      true,
      "the patient is told at once",
    );
    await page.screenshot({
      path: "artifacts/camera-error-legacy.png",
      fullPage: true,
    });
    report.legacy = { status, toast, rawExceptionShown: false };
    await context.close();
  }

  // ---- the React dashboard ------------------------------------------------
  // The camera lives in the sidebar dock (desktop) and on each camera page
  // (mobile), so both are checked.
  for (const [where, viewport, path] of [
    ["dock", { width: 1280, height: 900 }, "/dashboard/patient"],
    ["mobile page", { width: 390, height: 844 }, "/dashboard/patient/facespeak"],
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    openPage = page;
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(insecureOrigin);
    await page.addInitScript((patientId) => {
      localStorage.setItem(
        "asha_live_patient",
        JSON.stringify({ patientId, token: "test-patient-token" }),
      );
    }, profile.patientId);
    await page.route("**/api/session**", (route) =>
      route.fulfill({
        json: { profile, role: "patient", events: [], status: null },
      }),
    );
    await page.route("**/api/health", (route) =>
      route.fulfill({ json: { cloudConfigured: false } }),
    );
    await page.goto(base + path);
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .first()
      .waitFor();
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .first()
      .click();

    await page.waitForFunction(
      () => /https/i.test(document.body.innerText),
      null,
      { timeout: 20000 },
    );
    const text = await page.evaluate(() => document.body.innerText);
    assert.match(text, SECURE, `the ${where} explains the https address`);
    assert.doesNotMatch(text, RAW, `no raw exception on the ${where}`);
    // The reason is visible on the page, not only held in state.
    assert.ok(
      (await page.getByText(/secure \(https\) address/i).count()) > 0,
      `the reason is shown to the patient in the ${where}`,
    );
    await page.screenshot({
      path: `artifacts/camera-error-dashboard-${where.replace(/ /g, "-")}.png`,
      fullPage: true,
    });
    report[where] = { rawExceptionShown: false };
    await context.close();
  }

  assert.deepEqual(errors, [], "no application errors");
  report.applicationErrors = errors;
  console.log(JSON.stringify(report));
  await fs.writeFile(
    "artifacts/camera-error-verification.json",
    JSON.stringify(report, null, 2),
  );
} catch (error) {
  await openPage?.screenshot?.({
    path: "artifacts/camera-error-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
