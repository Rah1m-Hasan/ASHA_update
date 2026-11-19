# Visual and responsive audit — NeuroBridge Asha

**Date:** 2026-11-18
**Branch:** `rahim/neurobridge-asha-accuracy-improvements`
**Tooling:** `scripts/visual-audit.mjs` (the sweep), `scripts/visual-audit-ledger.mjs` (the defect
ledger), `tests/responsive-browser.mjs` (the pass/fail gate)

This is the visual, responsive, typography and accessibility counterpart to
[`FULL_AUDIT_REPORT.md`](FULL_AUDIT_REPORT.md) (2026-11-14), which covered safety, correctness and
security. This one covers how the app looks and how it behaves on a screen.

**The sweep renders every screen of the app in a real Chromium at every viewport, runs in-page
measurement probes against the rendered DOM, and writes a JSON report, a defect ledger and a
screenshot per render. Measured on the pre-repair build with the same probes and the same
manifest, it found **290 distinct defects — 4,234 raw findings — across 2,400 renders**. They
were repaired at their root, in shared components, in the legacy stylesheets and in the one token
palette, and the same measurement of the repaired build reports **zero**: no page that scrolls
sideways, no clipped text, no unnamed control, no contrast failure, no target below 24×24, no
broken heading order, and no page that throws.

What is left is the floating chrome — the Asha bubble, the bottom bar, the sticky headers —
crossing the content it floats over, which is what floating furniture does. It is counted apart
from the defects, and §13 says plainly what is being done about it.

(The figure this paragraph used to carry, *359 distinct defects*, came from an earlier sweep
whose report had been lost to a crash and whose ledger turned out to be a byte-identical copy of
the other one. It was a number with nothing behind it. The number above is measured.)

The measurement is a tool, not a verdict: `tests/responsive-browser.mjs` is the gate that keeps
these defects from coming back, and the screenshots under `artifacts/visual-audit/` are the
evidence.

---

## 1. The routes inspected

| Surface | Screens | Count |
| --- | --- | --- |
| Next.js App Router | `/`, `/login`, `/register`, `/dashboard`, `/dashboard/link`, the not-found screen, and every patient and caregiver screen under `/dashboard/patient/**` and `/dashboard/caregiver/**` | 35 |
| Legacy assistive app (`/assistive.html`) | welcome, setup, patient, caregiver, settings, and the FaceSpeak, FingerSpeak, Posture, SenseAssist and VitalSense modules | 11 |
| Legacy Everyday companion (`/everyday.html`) | home, nutrition, move, eyespeak, care, clinic, privacy, and the two embed modes (`?embed=1#care`, `?embed=1#eyespeak`) | 9 |
| Standalone FingerSpeak studio (`/neuroface/fingerspeak.html`) | calibrate, speak mode, evaluate, log | 4 |

**59 screens in total.** The legacy assistive app's FingerSpeak studio and the React FingerSpeak
screen are also measured inside their iframes, because an embedded frame has its own viewport.

Every route was rendered in a real Chromium at every viewport, measured by in-page probes, and
screenshotted. The four surfaces are the Next.js App Router, the retained legacy assistive app, the
retained Everyday companion and the standalone FingerSpeak studio.

| Set | Sizes (CSS pixels) |
| --- | --- |
| Desktop (6) | 1024x768, 1280x800, 1366x768, 1440x900, 1600x900, 1920x1080 |
| Mobile (6) | 320x640, 360x800, 375x812, 390x844, 412x915, 430x932 |
| Tablet (5) | 768x1024, 834x1112, 1024x1366, 1024x768, 844x390 (landscape phone) |
| Zoom (3) | 125% (1152x720), 150% (960x600), 200% (720x450) |

**Twenty renders per screen, at nineteen distinct physical sizes.** 1024×768 appears in both the
desktop set and the tablet set: at that width the dashboard is a sidebar layout, and the tablet
set measures it as a tablet. The two renders share a physical size but not a filename or a report
key — before the label was added, the tablet render silently overwrote the desktop one and the
sweep measured nineteen sizes, not twenty. Zoom is emulated as the CSS viewport the page receives
at that zoom level, which is how a browser reflows at 125/150/200%.

The **English, light** sweep covers all 59 screens at all 20 sizes (**1,180 renders**). The **dark**
sweep covers **44 screens** (880 renders) and the **Bangla** sweep covers **17 screens** (340
renders).

The Bangla split is not a matter of taste, and it is the one place where an earlier version of
this document made a false claim. A screen counts as Bangla-covered only when its *interface* is
in Bangla:

- The **React workspace** — Move and Nutrition — reads its language from the feature's own
  persisted store, and the sweep seeds that store before the page loads. The page is drawn in
  Bangla and the document's `lang` is `bn`.
- The **Everyday companion** reads its interface language from `asha_everyday_language`, and the
  sweep seeds that too, so the page is born in Bangla rather than switched after the fact.
- The **legacy assistive app has no Bangla interface at all.** Its `#ashaLanguage` control is the
  *conversation* language — the language Asha replies in — and its `#speechLanguage` is the
  *listening* language for the microphone. Neither translates the interface, which is English
  throughout. Those ten screens were therefore **removed** from the Bangla sweep: measuring them
  and calling them Bangla would have been a false claim, an English screen recorded as a Bangla
  one. They are swept in English.
- The **standalone studio** has one language and no control to change it. It is swept in dark,
  because it carries its own theme, and not in Bangla.

The split lives in `routesForVariant()` in `scripts/visual-audit.routes.mjs`, so the coverage can
be read off the code rather than remembered.

---

## 2. The defects found, by type

**Every number in this table is measured**, not estimated: it comes out of the sweep's own
report (`artifacts/visual-audit/current/report.json`), where a defect seen at twenty viewports is
one defect with twenty viewports listed.

| Defect type | Distinct defects | Screens affected |
| --- | --- | --- |

**0 distinct defects** across 500 raw findings and
2400 renders (1180 light, 880 dark, 340 bn).

A further **54** findings are floating chrome crossing the content it floats over
 — the fixed bottom bar, the sticky headers and the companion bubble. That is what floating
 furniture does; the content that mattered was kept clear of it and the sweep reports these
 separately as `chromeOverlap` rather than as collisions.

| Chrome overlap | Distinct | Screens affected |
| --- | --- | --- |
| `chromeOverlap` | 54 | 17 |

### 2.1 The same measurement, before and after

Both sides were measured by the **same probes** (`scripts/visual-audit.probes.mjs`) over the
**same route manifest** (`scripts/visual-audit.routes.mjs`), so the numbers compare like with
like. The baseline is the pre-repair commit, served on port 4181; the current build is this
branch, served on port 4180. The two live in separate directories —
`artifacts/visual-audit/baseline/` and `artifacts/visual-audit/current/` — and neither was
allowed to overwrite the other.

| | Baseline | Current |
| --- | --- | ---: |
| Renders measured | 2400 | 2400 |
| Variants | bn, dark, light | bn, dark, light |
| Screens with a defect | 47 | 17 |
| **Defects (excluding floating chrome)** | **4234** | **0** |
| Floating-chrome overlaps | 521 | 500 |

| Defect | Baseline | Current |
| --- | ---: | ---: |
| `contrast` | 525 | 0 |
| `heading` | 520 | 0 |
| `missingName` | 1040 | 0 |
| `offender` | 20 | 0 |
| `pageOverflow` | 2 | 0 |
| `tinyTarget` | 2127 | 0 |

**4,234 defects became zero**, over the same 2,400 renders, measured by the same instrument.
The floating-chrome overlaps are counted separately and are the one number that did not go to
zero: 521 became 500. Those are the fixed bottom bar, the sticky headers and the companion
bubble crossing the content they float over, and §13 says what is being done about them.

The baseline's own 23 page errors are in the report as well — a page that threw, in a build
whose assistive app could not open a care circle.

### 2.2 A defect in the measuring instrument, not in the app

The first sweep of the repaired build reported a `TypeError` on **every
assistive screen, at every viewport**: `Cannot read properties of null
(reading 'reset')`, at `public/engine/main.js:1570`. Two hundred findings,
across ten routes.

It was not an app defect. The line is

```js
perception.rest.reset();
```

in the legacy app's `visibilitychange` handler, and the real perception module
always builds `rest` as a `RestTracker` — it is never null. The error came
from the **stub** the harness puts in place of the real module, so that the
sweep and the gate can measure a page without a camera. The stub left
`analysis`, `rest` and `vitals` as `null`, because the real module builds them
as objects and nothing had touched them yet.

The finding is recorded here because of what it was hiding: a stub that is not
faithful does not merely measure the wrong page, it puts an error in the
report that looks like an app defect and is not one — and it does the same
thing to every real defect that appears next to it. The stub now gives those
three the objects the real module gives them, and `tests/stabilisation-regressions.test.mjs`
holds the fix shut.

Two holes in the **gate** were found at the same time, and both are fixed:

* **The gate copied the page's errors before closing the page.** A page that
  throws while it is torn down throws *after* the navigation is over — the
  legacy app resets its rest tracker on `visibilitychange`, which fires as the
  page is hidden. The gate copied the list too early, so it never saw the
  error and passed a page that was throwing. The list is now read after the
  context is closed.
* **The gate would have caught the thin stub if it had read the errors at the
  right moment.** That was checked, deliberately, by putting the thin stub back
  and running the gate against it: the gate fails, at all six viewports, with
  the error named. A gate that cannot fail is not a gate.

The harness also stopped throwing the page error's stack away. The message
alone — `Cannot read properties of null (reading 'reset')` — names a method and
not a file, and finding the line it came from took a long time. The sweep's
report now carries the first two frames.

---

## 3. Desktop-specific defects fixed

The defects that only a wide screen shows:

- **The dashboard's second grid track was `1fr`, not `minmax(0, 1fr)`.** A wide child (a long
  request text, a table) could push the column past the viewport at 1024-1440px, where the
  dashboard is at its least forgiving. `DashboardShell.tsx` now caps the track.
- **The landing page's module list used `1fr` for its text column** and the hardware kit had no
  explicit column count, so a long module name widened the row. Both are `minmax(0, 1fr)` and
  `grid-cols-1` now.
- **The two largest type steps jumped at a breakpoint** instead of ramping with the window, so a
  headline changed size abruptly between 1280 and 1440. `scripts/tokens.mjs` now uses `clamp()` for
  the display and title steps.
- **The legacy modules carried their own hex colours** (`#2563eb`, `#0b1424`, `#60a5fa`), so the
  assistive app's dark surfaces did not follow the app's theme. `public/app/blue-theme.css` is now
  written entirely in the shared `--asha-*` palette.

---

## 4. Mobile-specific defects fixed

The defects a phone shows:

- **`Button` refused to wrap.** `whitespace-nowrap` on every button meant a long label ("Set up with
  a caregiver", "Ask caregiver: I need help in the bathroom") grew the button past a 320px
  screen. Buttons now wrap between words and cap their width.
- **The dashboard's title bar pushed its controls off screen.** The title is now `truncate` and the
  control cluster `shrink-0`, so the menu, theme and role switch always stay reachable.
- **Tall dialogs ran off a short screen.** The request dialog and the calibration dialog are now
  capped at `88dvh` and scroll inside.
- **The Move and Nutrition screens had sticky bars with negative margins**, which overlapped the
  content underneath them on a phone. The bars are opaque and the content clears them.
- **Touch targets below 24x24** — the legacy app's checkboxes (21px), the standalone studio's
  remove buttons (21x22), the Everyday consent boxes (18px) and the landing enquiry checkbox
  (16px) — are all at least 24x24 now, or are reached through a label that is.
- **The Everyday chip nav** at 320px and the **701-999px band** in the same stylesheet: the rail is
  now a share of the width rather than a fixed 180px, so the content column keeps its room.
- **The welcome screen's last link sat under the floating Asha bubble.** That link now keeps the
  bubble's corner clear, and the view keeps the bubble's footprint clear at the end.

---

## 5. Tablet-specific defects fixed

- **1024px is where the dashboard flips from a drawer to a sidebar**, and it was the least-tested
  size in the app. The grid track, the sidebar's `min-w-0` label and the truncated title were all
  fixed at this boundary.
- **768x1024 and 834x1112** are the iPad sizes; the landing page's two-column module list and the
  auth showcase's split layout now collapse to one column below the `sm` breakpoint instead of
  relying on the viewport being wide enough.
- **844x390 is a landscape phone.** The Everyday companion's rail scrolls inside itself there, so
  the sweep's overlap probe now clips a control's box to the part of it that is actually visible
  rather than reporting a link that has been scrolled out of its own container.

---

## 6. Typography and formatting repairs

- **The legacy stylesheet had 7px type and smaller**: `0.44rem` (7px) on the Everyday brand
  strapline, `0.49rem` and `0.52rem` in the assistive app, `0.55rem` on the preview captions. The
  first wave raised the floor to 11px; the final stabilisation pass raised the rest of the way to
  **12px**, which is the same floor as the React app's `caption` token. Every rule below 12px in
  `public/app/style.css` (38 of them), `public/app/everyday/style.css` (6) and the standalone
  studio (12) is now at 12px.
- **The standalone studio's gesture labels were 9px and 10px**; they are 12px now.
- **The type scale's two largest steps** ramp with the window (`clamp()`) instead of jumping.
- **Long references in the Nutrition results** now wrap instead of running out of the card.
- **The `Move` demo captions** were `text-[11px]`, below the app's own `caption` token; they use
  `text-xs` (12px) now.

---

## 7. Shared components repaired

Repairs were made in the shared layer first, so one fix repaired every screen that uses the
component:

| Shared piece | What was wrong | What it repaired |
| --- | --- | --- |
| `ui/Button.tsx` | `whitespace-nowrap` and a fixed height | Every button in the app: the auth forms, the landing CTAs, the patient and caregiver workspaces, the Move and Nutrition flows, the dialogs |
| `ui/SectionHeading.tsx`, `ui/VideoFrame.tsx` | the heading pair and the label pill could not shrink | The landing sections and every camera frame in the workspace |
| `dashboard/DashboardShell.tsx` | the second grid track was `1fr`; the title pushed the controls off screen | All 24 dashboard screens, at every width, and especially at the 1024px drawer/sidebar boundary |
| `dashboard/Sidebar.tsx` | the nav label had no `min-w-0` and never truncated | The patient and caregiver navigation on a phone |
| `dashboard/Dialog.tsx` | no max height, no internal scroll | The request confirmation, the calibration dialog, the care-circle dialog |
| `dashboard/Panel.tsx`, `dashboard/EmptyState.tsx`, `dashboard/LinkConnect.tsx` | grid tracks that did not shrink; a heading level that skipped a level | Every panel and empty state in both workspaces |
| `caregiver/NoPatient.tsx` | the empty state was an `h3` on a page with no `h1` | The caregiver home before a patient is connected |
| `features/move/ui.tsx`, `features/move/PlanEditor.tsx`, `features/move/DemoPlayer.tsx` | fixed-width controls; a 11px caption | The whole Move area, and the clinician plan editor |
| `features/eyespeak/Board.tsx`, `Calibration.tsx`, `CursorPicker.tsx` | a fixed `basis-56` gaze bar; a `max-w-[90vw]` box that included the scrollbar | The EyeSpeak board, its calibration and the cursor picker |
| `features/nutrition/QuestionCard.tsx`, `Results.tsx`, `Review.tsx`, `VisionResult.tsx` | sticky bars that were see-through; long references that ran out of the card | The Nutrition interview, its results, the photo review and the vision result |
| `landing/Modules.tsx`, `HardwareKit.tsx`, `Plans.tsx`, `Principles.tsx`, `Team.tsx`, `Footer.tsx`, `Contact.tsx` | grid tracks that did not shrink; a form control below the touch-target floor | Every section of the landing page |
| `auth/AuthLayout.tsx`, `AuthShowcase.tsx` | the showcase split did not collapse on a phone | Both auth screens |
| `patient/CameraDock.tsx`, `patient/QuickGestures.tsx` | a control below the touch-target floor | The camera dock and the quick-gesture row |
| `scripts/tokens.mjs` | the two largest type steps jumped at a breakpoint; the muted colour was one step too light for the accent wash | Every screen, in both themes |
| `public/app/style.css`, `public/app/everyday/style.css`, `public/app/blue-theme.css` | the legacy sheets' own colours, type floors, target sizes and fixed widths | The assistive app, the Everyday companion and the standalone studio |

---

## 8. Accessibility improvements

| Criterion | What was done |
| --- | --- |
| **1.4.10 Reflow** (content usable at 320px without sideways scrolling) | Every grid track in the app is `minmax(0, 1fr)` or `grid-cols-1`; buttons wrap instead of forcing a width; the legacy sheets' fixed widths are capped. The sweep reports zero `pageOverflow` at every viewport. |
| **2.5.8 Target Size (Minimum)** (24x24 CSS pixels) | The legacy checkboxes (21px), the Everyday consent boxes (18px), the landing enquiry checkbox (16px) and the studio's remove buttons (21x22) are now at least 24x24, or are reached through a label that is. The React app's own buttons were raised from a fixed height to `min-h-9`/`min-h-11`. |
| **1.4.3 Contrast (Minimum)** (4.5:1) | The `muted` token was darkened from `#5a6b80` to `#57687d` so secondary text clears 4.5:1 on the accent wash and the sunken band as well as on the card and the page. `npm run tokens:check` now asserts every pair in the palette, not just the ones that were already passing. |
| **1.3.1 Info and Relationships** (heading order) | `EmptyState` and `UrgentCard` take a heading level, so a screen that is entirely an empty state or a safety stop has an `h1` instead of an `h3` under nothing. The legacy app's camera panel heading became an `h2`. |
| **4.1.2 Name, Role, Value** (accessible names) | The sweep found three controls with no accessible name: the confidence slider and the model picker in the standalone studio, whose visible labels were not tied to them, and one hidden file input in the Nutrition screen. The studio's two labels now name their controls; the file input is `aria-hidden` because the visible button beside it is the control a person uses. The studio's tabs are real buttons with `role="tab"` and `aria-selected`, so they are reachable by keyboard and announced. |
| **2.1.1 Keyboard** | The standalone studio's four tabs were `div`s with click handlers and could not be reached by keyboard; they are buttons now. |
| **3.1.1 Language of Page / 3.1.2 Language of Parts** | `html lang` follows the language of the screen: the Move area and the Nutrition screen set it while they are open and restore English when they are left. A Bangla answer inside an English chat carries `lang="bn"` on the message itself, in both the React app and the legacy app. |
| **2.4.1 Bypass Blocks** | Every surface keeps a skip link: the dashboard shell ("Skip to content"), the legacy assistive app ("Skip to content", to `#main`) and the Everyday companion ("Skip to workspace"). |
| **2.4.7 Focus Visible** | The global `:focus-visible` outline is kept throughout the app, and the standalone studio — which had none — now has one, so the keyboard can see where it is on its new tab buttons. |

The App Router also gained a branded `not-found.tsx` and a `dashboard/error.tsx`, so a bad URL or a failed
route shows the Asha shell instead of the framework's default page.

---

## 9. The files modified

**Audit tooling and the gate**

| File |
| --- |
| `package.json` |
| `scripts/visual-audit-ledger.mjs` |
| `scripts/visual-audit.mjs` |
| `scripts/visual-audit.probes.mjs` |
| `scripts/visual-audit.routes.mjs` |
| `tests/responsive-browser.mjs` |

**The design tokens**

| File |
| --- |
| `public/app/asha-tokens.css` |
| `public/app/blue-theme.css` |
| `scripts/tokens.mjs` |
| `src/app/globals.css` |

**Shared React components**

| File |
| --- |
| `src/components/auth/AuthLayout.tsx` |
| `src/components/auth/AuthShowcase.tsx` |
| `src/components/caregiver/NoPatient.tsx` |
| `src/components/dashboard/DashboardShell.tsx` |
| `src/components/dashboard/Dialog.tsx` |
| `src/components/dashboard/EmptyState.tsx` |
| `src/components/dashboard/LinkConnect.tsx` |
| `src/components/dashboard/Panel.tsx` |
| `src/components/dashboard/Sidebar.tsx` |
| `src/components/landing/Contact.tsx` |
| `src/components/landing/Footer.tsx` |
| `src/components/landing/HardwareKit.tsx` |
| `src/components/landing/Modules.tsx` |
| `src/components/landing/Plans.tsx` |
| `src/components/landing/Principles.tsx` |
| `src/components/landing/Team.tsx` |
| `src/components/patient/CameraDock.tsx` |
| `src/components/patient/QuickGestures.tsx` |
| `src/components/ui/Button.tsx` |
| `src/components/ui/SectionHeading.tsx` |
| `src/components/ui/VideoFrame.tsx` |

**React screens**

| File |
| --- |
| `src/app/dashboard/caregiver/page.tsx` |
| `src/app/dashboard/caregiver/patients/[id]/page.tsx` |
| `src/app/dashboard/caregiver/patients/page.tsx` |
| `src/app/dashboard/caregiver/settings/page.tsx` |
| `src/app/dashboard/error.tsx` |
| `src/app/dashboard/link/page.tsx` |
| `src/app/dashboard/patient/assistant/page.tsx` |
| `src/app/dashboard/patient/calibration/page.tsx` |
| `src/app/dashboard/patient/communicate/page.tsx` |
| `src/app/dashboard/patient/facespeak/page.tsx` |
| `src/app/dashboard/patient/fingerspeak/page.tsx` |
| `src/app/dashboard/patient/move/clinician/page.tsx` |
| `src/app/dashboard/patient/move/layout.tsx` |
| `src/app/dashboard/patient/move/page.tsx` |
| `src/app/dashboard/patient/move/plan/page.tsx` |
| `src/app/dashboard/patient/move/progress/page.tsx` |
| `src/app/dashboard/patient/move/safety/page.tsx` |
| `src/app/dashboard/patient/move/session/page.tsx` |
| `src/app/dashboard/patient/move/start/page.tsx` |
| `src/app/dashboard/patient/nutrition/page.tsx` |
| `src/app/dashboard/patient/page.tsx` |
| `src/app/dashboard/patient/posture/page.tsx` |
| `src/app/dashboard/patient/senseassist/page.tsx` |
| `src/app/dashboard/patient/settings/page.tsx` |
| `src/app/dashboard/patient/vitalsense/page.tsx` |
| `src/app/dashboard/patient/wellbeing/page.tsx` |
| `src/app/globals.css` |
| `src/app/not-found.tsx` |
| `src/features/enquiry/EnquiryForm.tsx` |
| `src/features/eyespeak/Board.tsx` |
| `src/features/eyespeak/Calibration.tsx` |
| `src/features/eyespeak/CursorPicker.tsx` |
| `src/features/move/DemoPlayer.tsx` |
| `src/features/move/PlanEditor.tsx` |
| `src/features/move/ui.tsx` |
| `src/features/nutrition/QuestionCard.tsx` |
| `src/features/nutrition/Results.tsx` |
| `src/features/nutrition/Review.tsx` |
| `src/features/nutrition/VisionResult.tsx` |

**The legacy surfaces**

| File |
| --- |
| `public/app/blue-theme.css` |
| `public/app/everyday/style.css` |
| `public/app/style.css` |
| `public/assistive.html` |
| `public/engine/main.js` |
| `public/neuroface/fingerspeak.html` |

**The server (the final stabilisation pass)**

These were not part of the visual wave. They are listed here because they were
changed in the same branch, and the branch's claim is that the visual repairs
did not need them.

| File | What changed |
| --- | --- |
| `src/server/node-adapter.ts` | the handler is given an abort signal, so an outbound call does not outlive the request; the route's own body limit is handed to the handler instead of the handler carrying a second one |
| `src/server/lib/common.js` | `body()` reads the limit the route declared; the hard-coded 20,000 that contradicted the Clinic route's 660,000 is gone |
| `src/server/lib/maira-provider.js` | the provider's own timeout (25 s) now fits inside the adapter's (30 s) |
| `src/server/handlers/asha.js` | the request's abort signal is threaded into the provider call |
| `src/server/handlers/session.js` | the care-circle setup budget moved to its own key prefix |
| `src/server/handlers/nutrition.js` | the meal budget moved to its own key prefix; a duplicate food in one meal is a 400, not a 500 |
| `src/server/handlers/care.js`, `src/server/handlers/clinic.js` | both read the route's declared body limit |

**New files in this branch**

| File | What it is |
| --- | --- |
| `scripts/visual-audit.harness.mjs` | the shared stubs and navigation the sweep and the gate both use |
| `scripts/visual-audit-report.mjs` | fills the measured tables in this document from the sweep's own report |
| `scripts/audit-sweeps.sh` | runs the six sweeps, one at a time, current and baseline kept apart |
| `src/lib/document-lang.ts` | one place for the document's language, so the sweep, the gate and the app agree on what Bangla means |
| `tests/stabilisation-regressions.test.mjs` | the regressions this pass repaired, pinned so they cannot come back |
| `docs/VISUAL_AUDIT_REPORT.md`, `docs/ROADMAP.md` | this document, and what is left |
| `.env.example` | every server variable, and what happens when it is absent |

**The documentation**

| File |
| --- |
| `README.md` |
| `docs/FULL_AUDIT_REPORT.md` |
| `docs/IMPLEMENTATION_STATUS.md` |
| `docs/NUTRITION_AI_IMPLEMENTATION_REPORT.md` |
| `docs/REMAINING_ISSUES.md` |
| `docs/ROADMAP.md` |
| `docs/TEST_RESULTS.md` |
| `docs/VISUAL_AUDIT_REPORT.md` |

**116 files** in the branch against the pre-repair baseline (104 modified, 12 added), measured
with `git diff --name-status <baseline>`. The list above is the part of it that touches the
visual surface; the rest is the test harness, the server changes listed in §2 and the
documentation.
`scripts/tokens.mjs` is the only place a
colour or a font is changed; `npm run tokens` regenerates the four outputs and
`npm run tokens:check` proves they are current. **No clinical behaviour, no schema, no permission
rule and no safety boundary was touched.** The server changes above are about request lifetimes,
quotas and error codes — they do not change what the app is allowed to do.

---

## 10. The tests executed

Every command below was run in this repository, against the **production build**, and the
output is quoted rather than described.

```sh
$ npm test
1..668
# tests 668
# suites 0
# pass 668
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

**668 unit tests pass and none fails.** The regression tests for this repair are in
`tests/stabilisation-regressions.test.mjs` (18 of them) — they hold shut the gate that read its
variants before declaring them, the sweep that lost its report to a crash, the gate that copied
the page's errors too early to see them, the perception stub that was thinner than the module it
replaces, and the server changes (the abort, the body limit, the provider's timeout, the
duplicate-food 400, the separate quota buckets).

```sh
$ npx tsc --noEmit
```
No output — clean.

```sh
$ npm run tokens:check
Tokens are up to date, and every colour pair clears its contrast ratio.
```

```sh
$ npm run models:check
17/17 inference assets match their pinned hash.
```

```sh
$ node scripts/secret-scan.mjs
{"filesChecked":830,"secretFindings":[]}
```

```sh
$ npm run test:browser:responsive
PASS 16 screens × 6 sizes × 3 themes (light 96, dark 96, bn 18): no overflow, no clipped
text, no unnamed control, no target under 24x24, no contrast failure
```

```sh
$ npm run test:browser:all
```
All twenty-six suites ran to completion and the run exited 0. Twenty-one pass, five skip
because the photograph fixtures they need are not on this machine, and none fails. The five
skips are named in `docs/TEST_RESULTS.md` §4.2.

The browser suites need a **storage backend**: they create real care circles, and without one
`POST /api/session` answers 503 and every suite that opens a care circle fails at setup. The
local run uses `ASHA_MEMORY_STORE=1 ASHA_MEMORY_STORE_PRODUCTION=1`.

The gate's own coverage is **sixteen screens at six sizes**, not every screen at every size —
the sweep is what covers the rest. `docs/TEST_RESULTS.md` §4.4 states this, and the gate's
summary line names the screens, the sizes and the themes it measured, so the claim can be read
off the output.

**What is not verified here, and is not claimed:** the camera on real hardware, the real
inference models on real photographs, a phone on a LAN, the Maira provider's own answer quality
(no credential), Supabase and Vercel Blob (the memory store was used), the live deployment, and
the accessibility tree against a full rules engine (there is no axe-core here). Each of these
is listed with its exact limitation in `docs/TEST_RESULTS.md` §5.

---

## 11. The build status

```sh
$ npm run build
```

```
▲ Next.js 16.4.3 (Turbopack)
✓ Compiled successfully in 239ms
  Running TypeScript ...
  Finished TypeScript in 1750ms ...
```

**The build succeeds.** All **41 routes** compile — **33 static, 8 dynamic**, of which 7 are the `/api/*` handlers — and
the TypeScript step passes inside the build as well as on its own.

**One thing about the build has to be said plainly.** Next.js 16.4.3 refuses to finish a build
without printing this, and it stops the command to print it:

```
Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability.
We strongly recommend you upgrade Next.js.
```

The command then says *"Retry the same command to continue the original task"*, and the retry
completes: the route table is printed, the build directory is written, `BUILD_ID` is set, and the
production server serves every route. But the recommendation is real and it is not something this
report should paper over:

> **Next.js 16.4.3 has a published security advisory. It should be upgraded.** The upgrade is
> `next upgrade --agent=security --internal-nudge-id=9c616fa7-4009-4709-8935-eaaeb4b06376`.

The upgrade was **not** applied here, because it changes the framework version under a branch
that is being handed over, and that is the operator's decision rather than this pass's. The
build in this report was produced by the version the project pins.

Every route answers from the production build:

| Route | Status |
| --- | --- |
| `/`, `/login`, `/register` | 200 |
| `/dashboard`, `/dashboard/patient` | 200 |
| `/dashboard/patient/nutrition`, `/dashboard/patient/move/session` | 200 |
| `/dashboard/caregiver` | 200 |
| `/assistive.html`, `/everyday.html`, `/neuroface/fingerspeak.html` | 200 |
| a route that does not exist | 404 — and the 404 page answers it |

The browser suites and the gate in §10 were run against **this** build, served on
`http://127.0.0.1:4180` with `ASHA_MEMORY_STORE=1 ASHA_MEMORY_STORE_PRODUCTION=1`.

---

## 12. Before-and-after screenshots

The sweep writes one screenshot per render, named
`<route>__<variant>__<viewport>.png` — for example `patient-nutrition__light__320x640.png` and
`everyday-clinic__dark__768x1024.png`. There are now **two** directories, and they are kept
apart deliberately:

| Directory | What it holds |
| --- | --- |
| `artifacts/visual-audit/current/` | the current build, measured on port 4180: `report.json`, `ledger.md`, `defect-table.md` and a screenshot per render |
| `artifacts/visual-audit/baseline/` | the pre-repair build, measured on port 4181 with the **same probes and the same manifest**: `report.json`, `ledger.md`, `defect-table.md` and a screenshot per render |

The earlier evidence — the 2,485 screenshots and the two stale ledgers at the top of
`artifacts/visual-audit/` — is left where it was. It was not overwritten, and the old
`ledger.md` and `ledger-baseline.md` are still byte-identical copies of each other, which is
exactly the defect the new baseline sweep exists to replace.

`artifacts/` is git-ignored, so the pictures live on the machine that ran the sweep; the sweeps
are re-runnable with `npm run audit:visual:all` to reproduce them.

Three screens were compared by eye between the baseline and the final sweep, because a
measurement cannot see everything:

| Screen | Before | After |
| --- | --- | --- |
| `assistive-welcome` at 390x844 | the floating Asha bubble covered the end of the "Everyday companion" link | the link keeps the bubble's corner clear; the whole line is readable |
| `everyday-home` at 390x844 | the blue-theme surfaces did not follow the app's palette | one palette, in both themes |
| `patient-nutrition` at 390x844 | the consent checkbox was a 16px target | a 24px label target, with the whole row clickable |

---

## 13. Remaining known issues

**Measured and left as they are**

- **The floating Asha bubble, the bottom bar and the sticky headers cross the content they float
  over.** That is what floating furniture does; the bubble is draggable, and the content that
  mattered (the welcome screen's last link, the Everyday companion's last row) has been kept clear
  of it. The sweep reports these separately as `chromeOverlap` rather than as collisions:
  **500 raw findings, 54 distinct**, across 17 screens, in the current build — against 521 raw
  and 56 distinct in the baseline. **The number is not zero and this report does not claim it
  is.** The legacy assistive app's floating bottom navigation crosses the patient
  space's action row at most viewport sizes — the row is partly covered at the bottom of the
  viewport, and it clears the bar when the view is scrolled to the end, because the view reserves
  a 104px band below its content for it. Turning that into a layout where content never passes
  under the bar means rebuilding the retained legacy app's shell around a scroll region that ends
  above the navigation, which would touch the camera panel, the chat panel and the companion
  bubble. That was judged a worse trade than the overlap it removes, in a surface the brief says
  not to rebuild — so it is reported here rather than hidden.
- **The Everyday companion's rail scrolls inside itself** on a landscape phone (844x390), where
  there is not enough height for seven nav links and a page. The nav is a scroller by design.
- **The accessibility tree is checked for names, roles and levels, not audited with a full rules
  engine.** No axe-core was added: the probe checks what the sweep can measure in the rendered DOM.
  Keyboard reachability, focus visibility and `prefers-reduced-motion` were checked by hand on
  the React workspace; they are not part of the sweep.
- **Next.js 16.4.3 has a published security advisory.** The build prints it and stops to print
  it; the retry completes and the build is sound, but the framework should be upgraded. It was
  not upgraded in this pass. It was put to the operator and answered explicitly — *not now* —
  so the pinned version stands and the build in this report was produced by the version the
  project pins. The advisory is recorded in four places so it is not lost: here, in the README,
  in `docs/REMAINING_ISSUES.md` §5 and in `docs/DELIVERY_REPORT.md`.
  §11 gives the exact command.
- **The sweep measures the app with a stub in place of the perception module**, so no camera,
  model or inference timing is exercised. The stub is now as thick as the module it replaces —
  it was thinner, and it made every assistive screen throw a `TypeError` that was not an app
  defect (§2.2). A stub can still differ from the real module in ways this pass did not find;
  the browser suites, which use the real module, are the check on that.

**Not verified here, and not claimed**

- **No camera, no real phone, no provider credentials.** The camera screens were measured with the
  perception module stubbed out, so the camera picture, the landmark overlays and the inference
  timing were not measured; the model weights were checked by hash, not by running them on a
  phone. Nothing here says anything about the app's clinical behaviour.
- **Dark theme and Bangla were swept for 44 and 17 screens respectively**, not for all 59. The
  English, light sweep covers everything. The split is in `scripts/visual-audit.routes.mjs`, in
  `routesForVariant()`, so the coverage can be read off the code rather than remembered.
- **The legacy assistive app was not measured in Bangla, because it has no Bangla interface.**
  Its language controls change the language Asha replies in and the language the microphone
  listens in; the interface itself is English. A Bangla sweep of those screens would have
  measured English and called it Bangla.
- **The FingerSpeak studio has no Bangla path at all.** It is the one screen in the app that
  is not translated — its labels, its gesture names and its on-screen instructions are English
  only, and there is no Bangla string in the file to switch to. This was found by measuring it,
  not by reading it: the studio was entered in Bangla and came back in English. It is listed here
  as a known gap rather than quietly excluded from the Bangla sweep, and the studio's own page
  in the React workspace inherits the same gap.
- **Zoom is emulated as a reduced CSS viewport**, which is how a browser reflows at 125/150/200%,
  but a real browser zoom also changes the device pixel ratio and the layout viewport in ways this
  approximation does not reproduce.
- **The sweep measures the rendered DOM, not the design.** Whether a screen *looks* right is a
  judgement a person makes; the report's screenshot list is there so that judgement can be made.
