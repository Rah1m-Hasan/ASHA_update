// Every screen the visual audit inspects, and the viewports it inspects them at.
//
// The route id is also the screenshot filename prefix, so it stays short and stable.
//
// Optional fields on a route:
//   ready    selector that must become visible before measuring
//   act      the app's own controls to click, in order, to reach the screen
//   bnSelect the app's own language control, for the Bangla variant
//   bnSeed   the feature's persisted store key, seeded with language "bn" before load
//   highRisk the screen is also rendered in Bangla and in dark theme

export const VIEWPORTS = {
  desktop: [
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1600, height: 900 },
    { width: 1920, height: 1080 },
  ],
  mobile: [
    { width: 320, height: 640 },
    { width: 360, height: 800 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 430, height: 932 },
  ],
  tablet: [
    { width: 768, height: 1024 },
    { width: 834, height: 1112 },
    { width: 1024, height: 1366 },
    // The same physical size as the smallest desktop viewport, but in the
    // tablet set it is a tablet. Without a distinct label the two renders
    // share a filename and a report key, so one silently overwrites the
    // other and the sweep measures nineteen sizes, not twenty.
    { width: 1024, height: 768, label: "1024x768-tablet" },
    { width: 844, height: 390 },
  ],
  // Browser zoom, emulated as the CSS viewport the page gets at that zoom.
  zoom: [
    { width: 1152, height: 720, label: "zoom-125" },
    { width: 960, height: 600, label: "zoom-150" },
    { width: 720, height: 450, label: "zoom-200" },
  ],
};

const P = "/dashboard/patient";
const C = "/dashboard/caregiver";
// The legacy app's demo opens the patient space; the header button opens
// Settings; the module tabs switch module.
const ASSIST = ["#exploreDemo"];

export const ROUTES = [
  // ---- Next.js: landing and auth ----
  { id: "landing", label: "Landing", surface: "next", path: "/", ready: "main h1", highRisk: true },
  { id: "login", label: "Login", surface: "next", path: "/login", ready: "form", highRisk: true },
  { id: "register", label: "Register", surface: "next", path: "/register", ready: "form", highRisk: true },
  { id: "dashboard-role", label: "Dashboard role router", surface: "next", path: "/dashboard" },
  { id: "dashboard-link", label: "Connect a care circle", surface: "next", path: "/dashboard/link", ready: "main", highRisk: true },
  // The not-found page. A screen that only appears when something has already
  // gone wrong is still a screen a person has to read, so it is measured like
  // any other.
  //
  // The dashboard's error boundary is deliberately *not* here: it renders only
  // when a child route throws, and the app has no route that throws on
  // purpose. Pointing a sweep entry at an ordinary patient page and calling it
  // the error boundary would measure the wrong screen.
  { id: "not-found", label: "Page not found", surface: "next", path: "/dashboard/this-route-does-not-exist", ready: "main", expectStatus: 404 },

  // ---- Next.js: patient workspace ----
  { id: "patient-home", label: "Patient home", surface: "next", path: P, ready: "main h1", highRisk: true },
  { id: "patient-assistant", label: "Talk to Asha", surface: "next", path: `${P}/assistant`, ready: "main", highRisk: true },
  { id: "patient-calibration", label: "Practise your signals", surface: "next", path: `${P}/calibration`, ready: "main" },
  { id: "patient-care", label: "Care journal", surface: "next", path: `${P}/care`, ready: "main", highRisk: true },
  { id: "patient-communicate", label: "Communicate", surface: "next", path: `${P}/communicate`, ready: "main", highRisk: true },
  { id: "patient-eyespeak", label: "EyeSpeak", surface: "next", path: `${P}/eyespeak`, ready: "main", highRisk: true },
  { id: "patient-eyespeak-keyboard", label: "Spell a message", surface: "next", path: `${P}/eyespeak/keyboard`, ready: "main", highRisk: true },
  { id: "patient-facespeak", label: "FaceSpeak", surface: "next", path: `${P}/facespeak`, ready: "main" },
  { id: "patient-fingerspeak", label: "FingerSpeak", surface: "next", path: `${P}/fingerspeak`, ready: "main" },
  // The full studio only exists as an embedded iframe; standalone it redirects
  // to the FingerSpeak page, so the frame is measured on its own.
  { id: "fingerspeak-studio", label: "FingerSpeak studio (embedded)", surface: "next", path: `${P}/fingerspeak`, ready: "main", frameSrc: "fingerspeak.html" },
  { id: "patient-move", label: "Move · Explore", surface: "next", path: `${P}/move`, ready: "main", bnSeed: { key: "asha_live_move_v2" } },
  { id: "patient-move-start", label: "Move · My plan", surface: "next", path: `${P}/move/start`, ready: "main", highRisk: true, bnSeed: { key: "asha_live_move_v2" } },
  { id: "patient-move-plan", label: "Move · Build a plan", surface: "next", path: `${P}/move/plan`, ready: "main", bnSeed: { key: "asha_live_move_v2" } },
  { id: "patient-move-session", label: "Move · Live workout", surface: "next", path: `${P}/move/session`, ready: "main", highRisk: true, bnSeed: { key: "asha_live_move_v2" } },
  { id: "patient-move-progress", label: "Move · Progress", surface: "next", path: `${P}/move/progress`, ready: "main", bnSeed: { key: "asha_live_move_v2" } },
  { id: "patient-move-safety", label: "Move · Safety", surface: "next", path: `${P}/move/safety`, ready: "main", bnSeed: { key: "asha_live_move_v2" } },
  { id: "patient-move-clinician", label: "Move · Clinician programs", surface: "next", path: `${P}/move/clinician`, ready: "main", bnSeed: { key: "asha_live_move_v2" } },
  { id: "patient-nutrition", label: "Nutrition", surface: "next", path: `${P}/nutrition`, ready: "main", highRisk: true, bnSeed: { key: "asha_live_nutrition_v5" } },
  { id: "patient-posture", label: "Posture", surface: "next", path: `${P}/posture`, ready: "main" },
  { id: "patient-senseassist", label: "SenseAssist", surface: "next", path: `${P}/senseassist`, ready: "main", highRisk: true },
  { id: "patient-settings", label: "Patient settings", surface: "next", path: `${P}/settings`, ready: "main", highRisk: true },
  { id: "patient-vitalsense", label: "VitalSense", surface: "next", path: `${P}/vitalsense`, ready: "main" },
  { id: "patient-wellbeing", label: "Wellbeing", surface: "next", path: `${P}/wellbeing`, ready: "main", highRisk: true },

  // ---- Next.js: caregiver workspace ----
  { id: "caregiver-home", label: "Caregiver overview", surface: "next", path: C, ready: "main", highRisk: true },
  { id: "caregiver-requests", label: "Caregiver requests", surface: "next", path: `${C}/requests`, ready: "main", highRisk: true },
  { id: "caregiver-patients", label: "Caregiver patients", surface: "next", path: `${C}/patients`, ready: "main" },
  { id: "caregiver-patient-new", label: "Add a patient", surface: "next", path: `${C}/patients/new`, ready: "main", highRisk: true },
  { id: "caregiver-patient-detail", label: "Patient profile", surface: "next", path: `${C}/patients/demo`, ready: "main" },
  { id: "caregiver-settings", label: "Caregiver settings", surface: "next", path: `${C}/settings`, ready: "main", highRisk: true },

  // ---- Legacy assistive app: /assistive.html ----
  // One page with hidden views. `act` clicks the app's own controls, in order,
  // so each view is reached the way a person reaches it: the demo opens the
  // sensing workspace, the bottom nav switches space, the module tabs switch
  // module, and the header button opens Settings.
  { id: "assistive-welcome", label: "Assistive · welcome", surface: "assistive", path: "/assistive.html", ready: "#welcome" },
  { id: "assistive-setup", label: "Assistive · setup wizard", surface: "assistive", path: "/assistive.html", ready: "#setup", act: ["#beginSetup"] },
  { id: "assistive-patient", label: "Assistive · patient space", surface: "assistive", path: "/assistive.html", ready: "#patient", act: [...ASSIST, '#bottomNav [data-view="patient"]'] },
  { id: "assistive-caregiver", label: "Assistive · caregiver space", surface: "assistive", path: "/assistive.html", ready: "#caregiver", act: [...ASSIST, '#bottomNav [data-view="caregiver"]'] },
  { id: "assistive-settings", label: "Assistive · settings", surface: "assistive", path: "/assistive.html", ready: "#settings", act: ["#landingMenuToggle"] },
  { id: "assistive-facespeak", label: "Assistive · FaceSpeak", surface: "assistive", path: "/assistive.html", ready: "#details", act: [...ASSIST, '#moduleTabs [data-module="facespeak"]'] },
  { id: "assistive-fingerspeak", label: "Assistive · FingerSpeak", surface: "assistive", path: "/assistive.html", ready: "#details", act: [...ASSIST, '#moduleTabs [data-module="fingerspeak"]'] },
  { id: "assistive-posture", label: "Assistive · Posture", surface: "assistive", path: "/assistive.html", ready: "#details", act: [...ASSIST, '#moduleTabs [data-module="posture"]'] },
  { id: "assistive-senseassist", label: "Assistive · SenseAssist", surface: "assistive", path: "/assistive.html", ready: "#details", act: [...ASSIST, '#moduleTabs [data-module="senseassist"]'] },
  { id: "assistive-vitalsense", label: "Assistive · VitalSense", surface: "assistive", path: "/assistive.html", ready: "#details", act: [...ASSIST, '#moduleTabs [data-module="vitalsense"]'] },
  { id: "assistive-fingerspeak-studio", label: "Assistive · FingerSpeak studio (embedded)", surface: "assistive", path: "/assistive.html", ready: "#details", act: [...ASSIST, '#moduleTabs [data-module="fingerspeak"]'], frameSrc: "fingerspeak.html" },

  // ---- The standalone FingerSpeak studio ----
  // The studio is also embedded in two places, but standalone it is its own
  // page with its own four tabs, so each tab is measured on its own.
  // The studio's own page sends a reader to the React screen when it is not
  // embedded, so the studio is measured inside the frame that hosts it: the
  // FingerSpeak screen, with the tab pressed in the frame's own document.
  { id: "studio-calibrate", label: "Studio · Calibrate", surface: "studio", path: `${P}/fingerspeak`, ready: "main", frameSrc: "fingerspeak.html", frameAct: { frameSrc: "fingerspeak.html", steps: ['.tab[data-tab="calibrate"]'] } },
  { id: "studio-speak", label: "Studio · Speak mode", surface: "studio", path: `${P}/fingerspeak`, ready: "main", frameSrc: "fingerspeak.html", frameAct: { frameSrc: "fingerspeak.html", steps: ['.tab[data-tab="speak"]'] } },
  { id: "studio-evaluate", label: "Studio · Evaluate", surface: "studio", path: `${P}/fingerspeak`, ready: "main", frameSrc: "fingerspeak.html", frameAct: { frameSrc: "fingerspeak.html", steps: ['.tab[data-tab="evaluate"]'] } },
  { id: "studio-log", label: "Studio · Log", surface: "studio", path: `${P}/fingerspeak`, ready: "main", frameSrc: "fingerspeak.html", frameAct: { frameSrc: "fingerspeak.html", steps: ['.tab[data-tab="log"]'] } },

  // ---- Legacy Everyday companion: /everyday.html ----
  // The Everyday companion is a hash router; `act` clicks its own nav links.
  { id: "everyday-home", label: "Everyday · overview", surface: "everyday", path: "/everyday.html", ready: '[data-route="home"]', act: ['[data-route="home"]'] },
  { id: "everyday-nutrition", label: "Everyday · Nutrition", surface: "everyday", path: "/everyday.html", ready: '[data-route="nutrition"]', act: ['[data-route="nutrition"]'], highRisk: true },
  { id: "everyday-move", label: "Everyday · Move", surface: "everyday", path: "/everyday.html", ready: '[data-route="move"]', act: ['[data-route="move"]'], highRisk: true },
  { id: "everyday-eyespeak", label: "Everyday · EyeSpeak", surface: "everyday", path: "/everyday.html", ready: '[data-route="eyespeak"]', act: ['[data-route="eyespeak"]'] },
  { id: "everyday-care", label: "Everyday · Care", surface: "everyday", path: "/everyday.html", ready: '[data-route="care"]', act: ['[data-route="care"]'] },
  { id: "everyday-clinic", label: "Everyday · Clinic", surface: "everyday", path: "/everyday.html", ready: '[data-route="clinic"]', act: ['[data-route="clinic"]'], highRisk: true },
  { id: "everyday-privacy", label: "Everyday · Privacy", surface: "everyday", path: "/everyday.html", ready: '[data-route="privacy"]', act: ['[data-route="privacy"]'] },
  // Embed mode: the iframe src EmbeddedTool builds is /everyday.html?embed=1<lang>#<route>.
  { id: "everyday-embed-care", label: "Everyday · Care (embedded)", surface: "everyday", path: "/everyday.html?embed=1#care", ready: "main", highRisk: true },
  { id: "everyday-embed-eyespeak", label: "Everyday · EyeSpeak (embedded)", surface: "everyday", path: "/everyday.html?embed=1#eyespeak", ready: "main", highRisk: true },
];

/** Screenshot sizes inspected by hand for every route. */
export const INSPECT_SIZES = ["320x640", "390x844", "768x1024", "1440x900"];

/**
 * The screens a variant sweep covers.
 *
 * The light sweep is the whole app: every screen, at every size. The dark and
 * Bangla sweeps cover the screens that carry the most risk in a theme or a
 * language change — the ones whose layout moves when a font changes, whose
 * colours are theme-specific, or whose text is longest in Bangla.
 *
 * This used to live in whoever's shell history, so the report's coverage
 * sentence could not be checked against anything. It lives here now, next to
 * the manifest it describes.
 *
 * - `dark`: the screens marked `highRisk`, plus every legacy surface (they
 *   carry their own stylesheets and their own theme handling) and the studio.
 * - `bn`: the screens that have a Bangla path at all — the ones with a
 *   `bnSeed` store or a language control of their own.
 */
const LEGACY_SURFACES = new Set(["assistive", "everyday", "studio"]);
// The legacy surfaces that have a Bangla *interface*.
//
// The Everyday companion has one: `asha_everyday_language` switches every
// heading, button and sentence on the page between English and Bangla, and
// the document's own `lang` follows.
//
// The legacy assistive app does **not**. Its `#ashaLanguage` control is the
// *conversation* language — the language Asha replies in — and its
// `#speechLanguage` is the *listening* language for the microphone. Neither
// translates the interface, which is English throughout. Sweeping those
// screens in the Bangla variant and recording them as Bangla would have been
// a false claim: the sweep would have measured an English screen and called it
// a Bangla one. They are swept in English and are not counted as Bangla
// coverage.
//
// The standalone studio has no language control at all, so it is swept in dark
// (it carries its own theme) but not in Bangla.
const LEGACY_WITH_LANGUAGE = new Set(["everyday"]);

/** The screens the dark sweep renders. */
export function routesForVariant(variant) {
  if (variant === "light") return ROUTES;
  if (variant === "dark")
    return ROUTES.filter((r) => r.highRisk || LEGACY_SURFACES.has(r.surface));
  if (variant === "bn")
    return ROUTES.filter(
      (r) => r.bnSeed || r.bnSelect || LEGACY_WITH_LANGUAGE.has(r.surface),
    );
  return ROUTES;
}

/**
 * Whether a route can be rendered in Bangla at all.
 *
 * A screen with no Bangla path would render in English and be recorded as if
 * it had been checked in Bangla, which is how a gap becomes a false claim.
 */
export function supportsBangla(route) {
  return Boolean(
    route.bnSeed || route.bnSelect || LEGACY_WITH_LANGUAGE.has(route.surface),
  );
}
