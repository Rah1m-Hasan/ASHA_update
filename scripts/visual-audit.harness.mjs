// The shared harness for the visual sweep and the responsive gate.
//
// Both scripts render the app in a real browser with the camera stubbed out
// and the API answered from fixtures, so neither one depends on a camera, a
// network or a credential. The stubs live here so the sweep and the gate
// measure exactly the same page: a gate that stubs something differently
// from the sweep would pass a page the sweep never saw.

/**
 * A Perception that never opens a camera and never runs a model.
 *
 * The stub must export the same names the real module exports, because both
 * the React app and the legacy engine import { Perception } from it.
 */
export const fakePerception = `
export function medianHeadY() { return 0; }
const VITALS = {
  bpm: null, quality: 0, confidence: 0, status: "collecting",
  reason: "The camera is off in the visual audit.", signal: [], windowSeconds: 0,
  requiredSeconds: 12, breathingBpm: null, breathingReason: "", sampleFps: 0, roiCount: 0,
  snr: null, snrNull: null,
  hrv: { rmssd: null, meanIbi: null, beats: 0, provisional: true, reason: "" },
  baseline: { bpm: null, low: null, high: null, progress: 0, calibrating: true },
  trend: [], readings: [], at: null,
};
export class Perception extends EventTarget {
  constructor() {
    super();
    this.running = false;
    this.stream = null;
    // These three are objects in the real module, not null: the real
    // Perception always builds a FaceAnalysis and a RestTracker, and the app
    // calls reset() on the rest tracker when the page is backgrounded and
    // addLog() on the analysis when the patient space records a movement.
    // A stub that leaves them null makes the page throw a TypeError on every
    // assistive screen, which is an artefact of the stub and not a defect in
    // the app - but it hides real defects behind a fake one, and it puts an
    // error in the sweep's own report.
    this.analysis = { log: [], addLog(t, label, kind = "movement") {
      this.log.unshift({ t, label, kind });
      this.log = this.log.slice(0, 100);
    }, reset() { this.log = []; } };
    this.rest = { resting: false, closedSince: null, openSince: null, last: null,
      reset() { this.resting = false; this.closedSince = null; this.openSince = null; this.last = null; },
      update() { return null; } };
    this.vitals = { value: { ...VITALS }, reset() { return { ...VITALS }; },
      resetBaseline() { return { ...VITALS }; }, invalidate() { return { ...VITALS }; } };
    this.pulse = { ...VITALS };
    this.snapshot = { raw: {}, hands: [], posture: null, pulse: { ...VITALS }, ears: [] };
    this.neuralHandActive = false;
    this.yoloEnabled = false;
  }
  setActiveModule() {}
  setCalibration() {}
  enableYolo() {}
  invalidateVitals() {}
  resetFaceReference() {}
  resetVitalsBaseline() {}
  resetVitalsSession() {}
  async start() { this.running = true; }
  stop() { this.running = false; }
  destroy() { this.stop(); }
}`;

export const API_FIXTURES = [
  { pattern: "**/api/session**", body: { ok: true, events: [], status: null, profile: { id: "demo" } } },
  { pattern: "**/api/care**", body: { ok: true, events: [], status: null } },
  { pattern: "**/api/asha**", body: { ok: true, reply: "", sources: [] } },
  { pattern: "**/api/nutrition**", body: { ok: true } },
  { pattern: "**/api/clinic**", body: { ok: true, workspaces: [], invitations: [], plans: [] } },
];

/**
 * Prepares a browser context: the perception stub, the API fixtures, no
 * camera, and the theme and language the run is measuring.
 *
 * `variant` is "light", "dark" or "bn". Dark is the app's own persisted
 * choice, applied before the first paint; Bangla on the React screens lives
 * in the feature's own persisted store, so it is seeded before the page loads.
 */
export async function prepare(context, route, variant = "light") {
  await context.route("**/engine/perception.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: fakePerception }));
  // The legacy assistive app creates a real care-circle session to open its
  // demo, so its session calls are left alone; everything else is stubbed.
  const skip = route.surface === "assistive" ? "**/api/session**" : null;
  for (const f of API_FIXTURES) {
    if (f.pattern === skip) continue;
    await context.route(f.pattern, (r) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(f.body) }));
  }
  await context.addInitScript(() => {
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Camera unavailable", "NotAllowedError"));
  });
  if (variant === "dark") {
    await context.addInitScript(() => {
      try { localStorage.setItem("asha_theme", "dark"); } catch (e) {}
    });
  }
  if (variant === "bn" && route.bnSeed) {
    await context.addInitScript((seed) => {
      try {
        const raw = localStorage.getItem(seed.key);
        const value = raw ? JSON.parse(raw) : {};
        value.language = "bn";
        localStorage.setItem(seed.key, JSON.stringify(value));
      } catch (e) {}
    }, route.bnSeed);
  }
  // The Everyday companion reads its interface language from localStorage
  // before it draws anything. Seeding it means the page is measured as it is
  // born in Bangla, rather than as an English page that is switched after
  // the fact — and it works in the embed modes, where the header's language
  // select is not on screen.
  if (variant === "bn" && route.surface === "everyday") {
    await context.addInitScript(() => {
      try {
        localStorage.setItem("asha_everyday_language", "bn");
      } catch (e) {}
    });
  }
}

/**
 * Opens a route the way a person opens it, and returns what went wrong.
 *
 * `act` is a list of the app's own controls, clicked in order, so the legacy
 * surfaces are navigated the way a person navigates them. `ready` must become
 * visible, not merely attached: the legacy views are hidden sections, so
 * "attached" would happily match the wrong screen.
 */
export async function openRoute(page, base, route, variant = "light") {
  const errors = [];
  // The stack is kept because the message alone does not say *where* the error
  // came from: "Cannot read properties of null (reading 'reset')" names a
  // method, not a file. Without the stack this error took a long time to
  // localise.
  page.on("pageerror", (e) =>
    errors.push("pageerror: " + e.message + " @ " + String(e.stack || "").split("\n").slice(0, 3).join(" | ")),
  );
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // A screen that is *supposed* to answer 404 - the "page not found" screen
    // - makes the browser log its own status as a console error. That is the
    // browser reporting the document's status, not the page misbehaving, and
    // it is the one console error a route may be expected to raise. It is
    // recognised by the URL the message came from: the document's own URL.
    const url = m.location()?.url || "";
    const isDocument = url.replace(/[?#].*$/, "") === new URL(base + route.path).href.replace(/[?#].*$/, "");
    if (isDocument && route.expectStatus) return;
    errors.push("console: " + m.text());
  });
  await page.goto(base + route.path, { waitUntil: "domcontentloaded" });

  for (const step of route.act || []) {
    const target = page.locator(step).first();
    const attached = await target
      .waitFor({ state: "attached", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!attached) {
      errors.push(`navigation: "${step}" was never present`);
      continue;
    }
    await target.click({ timeout: 5000 }).catch(() => {
      errors.push(`navigation: "${step}" could not be clicked`);
    });
    await page.waitForTimeout(150);
  }

  let readyOk = true;
  if (route.ready) {
    readyOk = await page
      .locator(route.ready)
      .first()
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!readyOk) errors.push(`navigation: "${route.ready}" never became visible`);
  }

  // Bangla: the legacy apps own a language select.
  if (variant === "bn") {
    const select =
      route.surface === "everyday" ? "#language"
      : route.surface === "assistive" ? "#ashaLanguage"
      : route.bnSelect;
    if (select) {
      // `selectOption` waits for the element to be *visible* and retries for
      // thirty seconds when it is not. A select that lives in a panel the
      // route never opened is hidden, so every render of that route paid half
      // a minute for nothing and the sweep crawled. A hidden select is
      // skipped, and the one that is used is given a moment, not half a
      // minute.
      const control = page.locator(select).first();
      const visible = await control
        .isVisible()
        .catch(() => false);
      if (visible) {
        await control
          .selectOption({ value: "bn", timeout: 2000 })
          .catch(() => {
            errors.push(`language: "${select}" could not be set to Bangla`);
          });
      }
    }
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(250); // let fonts and the last layout settle
  return { errors, readyOk };
}

