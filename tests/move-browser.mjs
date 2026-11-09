// ASHA Move end to end: goal wizard -> safety check -> camera setup -> counted reps -> tracking loss
// -> emergency stop and lockout; plus a face routine to summary and a mobile layout check.
// Camera hardware is replaced by a fake engine that emits the same "pose" and "frame" events.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.NEXT_TEST_URL || "http://127.0.0.1:4180";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true, args: ["--no-sandbox", "--no-proxy-server"] });
const errors = [];

const fakePerception = `
export class Perception extends EventTarget {
  constructor() { super(); this.running = false; this.snapshot = {}; this.pulse = {}; this.module = ""; window.__perception = this; }
  async start() { this.running = true; }
  stop() { this.running = false; }
  setCalibration() {}
  setActiveModule(name) { this.module = name; }
  resetFaceReference() {}
  resetVitalsBaseline() {}
  resetVitalsSession() {}
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, {detail})); }
}
`;

// Runs inside the page: plays knee angles (side view, left leg) as pose events at 20 fps.
const playLeg = async (page, segments, visibility = 0.95) =>
  page.evaluate(
    async ({ segments, visibility }) => {
      const frame = (deg) => {
        const lm = Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.5, visibility: i % 2 ? 0.95 : 0.2 }));
        const r = (deg * Math.PI) / 180, knee = { x: 0.5, y: 0.65 };
        const hip = { x: knee.x + 0.25 * Math.sin(r), y: knee.y + 0.25 * Math.cos(r) };
        lm[27] = { x: 0.5, y: 0.9, visibility };
        lm[25] = { ...knee, visibility };
        lm[23] = { ...hip, visibility };
        lm[11] = { x: hip.x - 0.02, y: hip.y - 0.28, visibility };
        return { landmarks: lm, personCount: 1, timestamp: performance.now(), width: 1, height: 1 };
      };
      for (const [from, to, ms] of segments) {
        const n = Math.max(1, Math.round(ms / 50));
        for (let i = 0; i < n; i++) {
          window.__perception.emit("pose", frame(from + ((to - from) * i) / Math.max(1, n - 1)));
          await new Promise((r) => setTimeout(r, 50));
        }
      }
    },
    { segments, visibility },
  );

const playFace = async (page, segments) =>
  page.evaluate(async (segments) => {
    for (const [from, to, ms] of segments) {
      const n = Math.max(1, Math.round(ms / 50));
      for (let i = 0; i < n; i++) {
        const v = from + ((to - from) * i) / Math.max(1, n - 1);
        window.__perception.emit("frame", { t: performance.now(), analysis: { valid: true, head: { yaw: 0, pitch: 0 } }, blendshapes: { mouthSmileLeft: v, mouthSmileRight: v } });
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }, segments);

async function setup(init = null, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  await context.route("**/engine/perception.js", (r) => r.fulfill({ contentType: "text/javascript", body: fakePerception }));
  await context.route("**/api/session**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, events: [], status: null }) }));
  await context.addInitScript((init) => {
    window.__utterances = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [], cancel() {}, speak(u) { window.__utterances.push(u.text); u.onend?.(); } } });
    if (init && !sessionStorage.getItem("seeded")) {
      localStorage.setItem("asha_live_move_v2", JSON.stringify(init));
      sessionStorage.setItem("seeded", "1");
    }
  }, init);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
async function answerNo(page) {
  await page.getByRole("radiogroup").first().waitFor();
  for (const question of await page.getByRole("radiogroup").all()) await question.getByRole("button", { name: "No", exact: true }).click();
}
const cameraOn = (page) => page.waitForFunction(() => window.__perception?.running);
const waitState = (page, value) => page.locator(`[data-testid=move-state][data-state=${value}]`).waitFor();
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("asha_live_move_v2") || "{}"));

// ---------- 1. Wizard, honest goals, camera reps, tracking loss, emergency stop ----------
{
  const { context, page } = await setup();
  await page.goto(base + "/dashboard/patient/move");
  await page.getByRole("link", { name: /Move/ }).first().waitFor();
  await page.getByRole("link", { name: /Core and weight management/ }).click();
  await page.getByRole("button", { name: "Burn belly fat" }).click();
  await page.getByText("No exercise burns fat from one area").waitFor();
  await page.goto(base + "/dashboard/patient/move/start?category=lower_body");
  await page.getByRole("button", { name: "Stronger legs for daily life" }).click();
  await page.getByRole("button", { name: "Beginner" }).click();
  await page.getByRole("button", { name: "I can stand and move freely" }).click();
  await page.getByRole("button", { name: /Yes, a stable chair/ }).click();
  await page.getByRole("button", { name: "5 min", exact: true }).click();
  for (let i = 0; i < 7; i++) await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: /Use my camera to count/ }).click();
  await page.getByText("Your recommended starter plan").waitFor();
  const reps = page.getByLabel("Reps").first();
  await reps.fill("2");
  await page.getByRole("button", { name: "Save and start" }).click();
  await page.waitForURL(/\/move\/session$/);
  // The wizard's answers carry over; nothing is asked twice within 15 minutes.
  await page.getByRole("button", { name: "Start workout" }).click();
  await waitState(page, "CAMERA_SETUP");
  await cameraOn(page);
  assert.equal(await page.evaluate(() => window.__perception.module), "move", "pose runs at the Move cadence on this page");
  assert.ok(await page.getByRole("button", { name: /Waiting for a clear view/ }).isDisabled(), "no start before a usable view");
  await playLeg(page, [[178, 178, 1600]]);
  await page.getByRole("button", { name: /I can be seen. Start/ }).click();
  await waitState(page, "WARM_UP");
  await playLeg(page, [[178, 100, 800], [100, 178, 800]]);
  await page.getByRole("button", { name: "I'm warmed up" }).click();
  await waitState(page, "EXERCISE");
  assert.equal(await page.getByTestId("move-reps").textContent(), "0 / 2", "warm-up movement isn't counted");
  const rep = [[178, 178, 400], [178, 100, 900], [100, 100, 300], [100, 178, 900], [178, 178, 400]];
  await playLeg(page, rep);
  assert.equal(await page.getByTestId("move-reps").textContent(), "1 / 2");
  // A shallow dip is not a repetition.
  await playLeg(page, [[178, 140, 700], [140, 178, 700], [178, 178, 300]]);
  assert.equal(await page.getByTestId("move-reps").textContent(), "1 / 2");
  await playLeg(page, rep);
  await waitState(page, "REST");
  await page.getByRole("button", { name: "Skip rest" }).click();
  await waitState(page, "NEXT_EXERCISE");
  await page.getByRole("button", { name: "Start now" }).click();
  await waitState(page, "EXERCISE");
  await playLeg(page, [[95, 95, 1500]], 0.2);
  await waitState(page, "TRACKING_LOST");
  await page.getByText("Can't see your movement; reposition camera.").first().waitFor();
  assert.ok((await page.evaluate(() => window.__utterances.join(" "))).includes("Can't see your movement; reposition camera."), "tracking loss is spoken");
  // Reload mid-workout: it comes back paused with progress kept.
  await page.reload();
  await waitState(page, "PAUSED");
  await page.getByRole("button", { name: "Resume" }).click();
  await waitState(page, "EXERCISE");
  await page.getByRole("button", { name: "I feel unwell" }).click();
  await page.getByRole("button", { name: "Chest pain or pressure" }).click();
  await page.getByRole("alert").filter({ hasText: "Get urgent medical help now" }).first().waitFor();
  await page.getByRole("link", { name: "Call 999" }).first().waitFor();
  const saved = await store(page);
  assert.equal(saved.lockout.kind, "emergency");
  assert.equal(saved.history.at(-1).endedBy, "safety_stop");
  assert.equal(saved.history.at(-1).exercises[0].reps, 2);
  assert.ok(!("calories" in saved.history.at(-1)));
  // No way back in: the wizard and the session are both paused.
  await page.goto(base + "/dashboard/patient/move/session");
  await page.getByText("Workouts are paused for your safety.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Start workout" }).count(), 0);
  await page.goto(base + "/dashboard/patient/move/start?category=lower_body");
  await page.getByText("Move is paused for your safety.").waitFor();
  await page.goto(base + "/dashboard/patient/move/safety");
  await page.getByText("Please get medical help first").waitFor();
  await context.close();
}

// ---------- 2. Face routine with neutral calibration to a saved summary; Bangla symptom text ----------
{
  const plan = { id: "face-1", name: "Face test", category: "face", userGoal: "expression", locale: "en", warmUpSeconds: 30, coolDownSeconds: 30, authoredBy: "user", version: "test", sequence: [{ exerciseId: "smile", sets: 1, targetReps: 1, holdSeconds: 1, restSeconds: 20 }] };
  const { context, page } = await setup({ plan, cameraConsent: true, voice: true, language: "en", history: [], schedule: [1, 3, 5], clinicianPrograms: [], conditions: {}, painAreas: [], rememberConditions: false, consentAudit: [] });
  await page.goto(base + "/dashboard/patient/move/session");
  await answerNo(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await waitState(page, "CAMERA_SETUP");
  await cameraOn(page);
  await playFace(page, [[0.05, 0.05, 1600]]);
  await page.getByRole("button", { name: /I can be seen. Start/ }).click();
  await page.getByRole("button", { name: "I'm warmed up" }).click();
  await waitState(page, "EXERCISE");
  await playFace(page, [[0.05, 0.05, 1700], [0.05, 0.6, 300], [0.6, 0.6, 1400], [0.6, 0.05, 300], [0.05, 0.05, 500]]);
  await waitState(page, "COOL_DOWN");
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByText("Workout complete").waitFor();
  await page.getByRole("radiogroup", { name: "Effort from 0 to 10" }).getByRole("button", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "Save how it felt" }).click();
  await page.getByRole("link", { name: "View progress" }).click();
  await page.getByText("Face test").first().waitFor();
  const saved = await store(page);
  assert.equal(saved.history.at(-1).endedBy, "completed");
  assert.equal(saved.history.at(-1).effort, 4);
  assert.deepEqual(saved.history.at(-1).exercises[0].countedBy, ["camera"]);
  // Bangla free-text symptom during a manual workout stops it.
  await page.goto(base + "/dashboard/patient/move/session");
  await page.getByRole("button", { name: "Back to start" }).click().catch(() => {});
  await page.goto(base + "/dashboard/patient/move/session");
  await answerNo(page);
  await page.getByRole("button", { name: /Manual: I tap to count/ }).click();
  await page.getByRole("button", { name: "Start workout" }).click();
  await waitState(page, "WARM_UP");
  await page.getByRole("button", { name: "I feel unwell" }).click();
  await page.getByPlaceholder(/Or describe it/).fill("মাথা ঘুরছে");
  await page.getByRole("button", { name: "Check" }).click();
  await page.getByText("Stop and rest.").first().waitFor();
  assert.equal((await store(page)).lockout.kind, "rest");
  await context.close();
}

// ---------- 3. Mobile layout: no page wider than the screen ----------
{
  const { context, page } = await setup(null, { width: 390, height: 844 });
  for (const path of ["", "/start?category=face", "/plan", "/session", "/progress", "/safety", "/clinician"]) {
    await page.goto(base + "/dashboard/patient/move" + path);
    await page.getByRole("heading", { level: 1 }).first().waitFor().catch(() => {});
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `${path || "/"} overflows by ${overflow}px`);
  }
  await page.goto(base + "/dashboard/patient/move/safety");
  await page.getByRole("button", { name: "বাংলা" }).click();
  await page.goto(base + "/dashboard/patient/move");
  await page.getByRole("heading", { name: "মুভ" }).waitFor();
  await context.close();
}

await browser.close();
assert.deepEqual(errors, [], "no page errors");
console.log("Move browser: wizard, camera reps, tracking loss, reload, emergency lockout, face routine, Bangla symptom and mobile layout passed");
