import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
// The base is joined with a path, so a trailing slash in the environment
// variable must not produce a doubled one.
const base = (process.env.NEXT_TEST_URL || "http://127.0.0.1:4180").replace(/\/+$/, "");
console.log("Next patient browser: launching");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ["--no-sandbox", "--no-proxy-server"],
});
const patientId = "a".repeat(24);
console.log("Next patient browser: browser ready");
const baseline = { blinkIntent: { version: 1, rapidMin: 65, rapidMax: 500, minAmplitude: 0.08, confirmMin: 400, confirmMax: 1200 } };
const allSignals = ["NOD_COMPLETED", "LEFT_TURN_COMPLETED", "RIGHT_TURN_COMPLETED", "SMILE_COMPLETED"];
const blinkSignals = ["RAPID_BLINK_REQUEST", "BLINK_CONFIRM"];
const defaultAssessment = {
  leftHand: "reliable", rightHand: "reliable", wrist: "reliable", fingers: "reliable",
  eyes: "none", lips: "none", head: "reliable", speech: "limited", canSee: true, canHear: true,
};
const errors = [];
const contexts = [];

// Real BlinkIntent/CompanionGuide are retained. Only camera hardware and network delivery are controlled.
const fakePerception = `
export class Perception extends EventTarget {
  constructor() { super(); this.running = false; this.snapshot = {}; this.pulse = {}; this.calls = 0; window.__perception = this; }
  async start() { this.running = true; }
  stop() { this.running = false; }
  setCalibration() { this.calls++; }
  setActiveModule() {}
  resetFaceReference() {}
  resetVitalsBaseline() {}
  resetVitalsSession() {}
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, {detail})); }
}
`;

async function setup({ enabled = allSignals, assessment = defaultAssessment, linked = true, proactive = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  contexts.push(context);
  const events = [];
  const cloud = [];
  const profile = { patientId, label: "Browser test", assessment, voice: { name: "", rate: 0.9 }, supportContext: {categories: [], goals: [], note: ""}, recommendation: { primary: "facespeak", suggested: ["facespeak"] } };
  await context.route("**/engine/perception.js", (r) => r.fulfill({ contentType: "text/javascript", body: fakePerception }));
  await context.route("**/api/session**", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.action === "event") events.push(body);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body ? { ok: true, push: "not_enabled" } : { profile, role: "patient", events: [], status: null }) });
  });
  await context.route("**/api/asha", async (route) => {
    cloud.push(route.request().postDataJSON());
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Unexpected cloud call"}' });
  });
  await context.addInitScript(({ patientId, linked, enabled, baseline, proactive }) => {
    if (linked) localStorage.setItem("asha_live_patient", JSON.stringify({ patientId, token: "test-patient-token" }));
    localStorage.setItem("asha_live_settings", JSON.stringify({ proactive, cloud: false }));
    localStorage.setItem("asha_live_calibration_" + (linked ? patientId : "local-demo"), JSON.stringify({ baseline, enabled, savedAt: "2026-11-10" }));
    window.__utterances = [];
    window.__recognitionStarts = 0;
    window.__recognitionAborts = 0;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [], cancel() {},
      speak(u) { window.__utterances.push(u); window.__output = u; },
    } });
    window.SpeechRecognition = class {
      start() { window.__recognitionStarts++; window.__recognition = this; }
      abort() { window.__recognitionAborts++; }
    };
  }, { patientId, linked, enabled, baseline, proactive });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => { errors.push(e.message); console.error("Patient browser error:", e.message); });
  page.on("requestfailed", (r) => console.error("Patient request failed:", r.url(), r.failure()?.errorText));
  page.on("console", (m) => { if (m.type() === "error") console.error("Patient console:", m.text()); });
  await page.goto(base + "/dashboard/patient");
  await page.getByRole("button", { name: /^Water/ }).waitFor();
  await page.waitForLoadState("networkidle");
  console.log("Hydration:", await page.evaluate(() => ({ storage: Object.keys(localStorage), buttons: Object.keys(document.querySelector('button') || {}), text: document.body.innerText.slice(-1000) })));
  if (linked) await page.getByText("Caregiver linked", { exact: true }).waitFor();
  return { page, context, events, cloud };
}

async function finishOutput(page) {
  await page.evaluate(() => window.__output?.onend?.());
  await page.waitForTimeout(50);
}
async function startCamera(page) {
  await page.getByRole("button", { name: "Start camera", exact: true }).first().click();
  await page.waitForFunction(() => window.__perception?.running && window.__utterances.length > 0);
  await finishOutput(page);
}
async function emit(page, type, detail) {
  await page.evaluate(({ type, detail }) => window.__perception.emit(type, detail), { type, detail });
  await page.waitForTimeout(50);
}
async function sent(page, events, count) {
  for (let i = 0; i < 30 && events.length !== count; i++) await page.waitForTimeout(50);
  assert.equal(events.length, count);
}

try {
  console.log("Next patient browser: touch confirmation");
  const touch = await setup({ proactive: false });
  await touch.page.getByRole("button", { name: /^Water/ }).click();
  console.log("Touch state:", await touch.page.evaluate(() => ({ outputs: window.__utterances.map((u) => u.text), dialogs: [...document.querySelectorAll('dialog')].map((d) => ({open: d.open, text: d.textContent})) })), errors);
  await touch.page.getByRole("dialog").waitFor();
  assert.equal(touch.events.length, 0, "a proposal cannot send a caregiver event");
  await touch.page.waitForTimeout(700);
  await touch.page.getByRole("button", { name: "Yes, send", exact: true }).evaluate((button) => { button.click(); button.click(); });
  await sent(touch.page, touch.events, 1);
  assert.equal(touch.events[0].confirmed, true);
  await touch.context.close();
  console.log("Next patient browser: guided face");

  const face = await setup();
  await startCamera(face.page);
  const calls = await face.page.evaluate(() => window.__perception.calls);
  for (let i = 0; i < 12; i++) await emit(face.page, "frame", { t: i * 150, analysis: { valid: true } });
  assert.equal(await face.page.evaluate(() => window.__perception.calls), calls, "frames must not reset learned gesture state");
  await emit(face.page, "gesture", { type: "BLINK_COMPLETED" });
  assert.equal(await face.page.getByRole("dialog").count(), 0, "natural blinks do not propose requests");
  await emit(face.page, "gesture", { type: "NOD_COMPLETED" });
  await face.page.getByRole("dialog").waitFor();
  assert.equal(face.events.length, 0, "a guided nod only proposes water");
  await finishOutput(face.page);
  await face.page.waitForTimeout(700);
  await emit(face.page, "gesture", { type: "NOD_COMPLETED" });
  await sent(face.page, face.events, 1);
  assert.equal(face.events[0].kind, "water");
  await face.context.close();
  console.log("Next patient browser: deliberate blink");

  const blink = await setup({ enabled: blinkSignals, assessment: { ...defaultAssessment, eyes: "reliable", head: "none" } });
  await startCamera(blink.page);
  const t = await blink.page.evaluate(() => performance.now() + 10000);
  const eye = async (at, last) => emit(blink.page, "frame", { t: at, analysis: { valid: true, eye: { state: "OPEN", last } } });
  await eye(t);
  await eye(t + 700);
  const quick = (offset) => ({ start: t + offset, timestamp: t + offset + 100, duration: 100, amplitude: 0.4 });
  await eye(t + 900, quick(800));
  await eye(t + 1300, quick(1200));
  await eye(t + 1700, quick(1600));
  await blink.page.getByRole("dialog").waitFor();
  assert.equal(blink.events.length, 0);
  // This blink occurs while the question is still being spoken, so it cannot answer it.
  await eye(t + 2400);
  await eye(t + 3200, { start: t + 2600, timestamp: t + 3200, duration: 600, amplitude: 0.4 });
  assert.equal(blink.events.length, 0, "a blink during the question must not confirm");
  await finishOutput(blink.page);
  await blink.page.waitForTimeout(700);
  await eye(t + 3400);
  await eye(t + 4100);
  await eye(t + 4900, { start: t + 4300, timestamp: t + 4900, duration: 600, amplitude: 0.4 });
  await sent(blink.page, blink.events, 1);
  assert.equal(blink.events[0].source, "deliberate blink");
  await blink.context.close();
  console.log("Next patient browser: local safety");

  const local = await setup({ linked: false, proactive: false });
  await local.page.goto(base + "/dashboard/patient/assistant");
  await local.page.getByLabel("Message Asha").fill("I have chest pain");
  await local.page.getByRole("button", { name: "Send", exact: true }).click();
  await local.page.getByText(/Get urgent medical help now/).waitFor();
  assert.equal(local.cloud.length, 0, "urgent local guidance cannot require cloud access");
  await local.page.goto(base + "/dashboard/patient/senseassist");
  await local.page.getByRole("button", { name: "Start listening" }).click();
  await local.page.waitForFunction(() => window.__recognitionStarts === 1);
  await local.page.getByLabel("What was heard (you can edit it)").fill("I cannot breathe");
  await local.page.getByRole("button", { name: "Clarify with Asha" }).click();
  await local.page.getByRole("alert").filter({ hasText: "Get urgent medical help now" }).waitFor();
  assert.equal(local.cloud.length, 0);
  assert.ok(await local.page.evaluate(() => window.__recognitionAborts > 0), "recognition stops before Asha speaks");
  assert.equal(await local.page.getByRole("button", { name: "Yes, speak this" }).count(), 0, "an urgent response is not a reusable interpretation candidate");
  await local.context.close();
  assert.deepEqual(errors, [], "patient flows should have no unhandled browser errors");
  console.log("Next patient browser: separate confirmation, stable sensing, guided nod, deliberate blink and local safety passed.");
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
}
