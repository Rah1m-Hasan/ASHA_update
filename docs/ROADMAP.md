# Roadmap — what is left, and what each item needs

**Date:** 2026-11-18
**Branch:** `rahim/neurobridge-asha-accuracy-improvements`

This is the current plan for the unfinished work. It replaces the reading of
`docs/ASHA_IMPLEMENTATION_PLAN.md` (2026-11-10), which was written against the
pre-migration layout and is kept as the record of that work.

Every item is in exactly one of three tracks:

| Track | What it means |
| --- | --- |
| **A — code** | The work is inside this repository and can be done now. Each item names the file and the check that proves it. |
| **B — input** | The work needs something this environment does not have: a dataset, a credential, a phone, a clinician, a trust key. Nothing is claimed about it until the input exists. |
| **C — decided** | A deliberate decision, recorded rather than changed. Changing one is a product decision, not a repair. |

Nothing in track B is blocked by a defect, and nothing in track C is a known
crash. The safety boundaries in `CLAUDE.md` and
`docs/CLINICAL_SAFETY_BOUNDARIES.md` are not on this list: they are fixed
constraints, not tasks.

---

## Track A — code work, in this repository

### A1 · The visual audit wave (this branch)

The visual and responsive audit is finished, measured and gated:

- `scripts/visual-audit.mjs` sweeps every screen in the route manifest at
  twenty viewport sizes, and writes a screenshot and a measurement per render.
  It writes its report after every route, so a crash cannot lose a whole
  sweep, and it relaunches the browser when the browser dies. The three
  variants cover different route sets — **light covers all 59 screens, dark
  covers the 44 the theme puts at risk, and Bangla covers the 17 that have a
  Bangla path** — and the split lives in the manifest, in `routesForVariant()`,
  so the coverage can be read off the code rather than remembered.
- `scripts/audit-sweeps.sh` runs all six sweeps — current and baseline, in
  light, dark and Bangla — one at a time, and keeps the two sides in separate
  directories so a baseline is never confused with the build under test.
- `scripts/visual-audit-compare.mjs` puts the two sides side by side: defects
  by type, distinct defects, screens affected, baseline against current.
- `scripts/visual-audit-ledger.mjs` turns the sweep into a defect ledger, with
  the floating-chrome overlaps counted apart from the defects.
- `scripts/visual-audit-report.mjs` fills the measured tables in
  `docs/VISUAL_AUDIT_REPORT.md` from the sweep's own report, so the document
  cannot drift from the measurement.
- `tests/responsive-browser.mjs` is the gate: it runs the same probes over
  sixteen screens — one per layout family — at six viewport sizes, in the light
  and dark themes and in Bangla on the screens that have a Bangla path, and
  fails on sideways scrolling, clipped text, an unnamed control, a target under
  24×24, a failed contrast pair, a heading level that skips, or an error in the
  page.

**The gate had never run until the final stabilisation pass.** It read its
variant list before declaring it and died with a `ReferenceError` before
Chromium launched, so every document describing it as the gate described a
gate that gated nothing. It runs now, and it names the screens, sizes and
themes it covered in its PASS line.

**Proved by:** `npm run audit:visual:all` (the six sweeps),
`npm run audit:visual:ledger`, `npm run audit:visual:report`,
`npm run audit:visual:compare` and `npm run test:browser:responsive` against
a production build.

**The harness is part of the evidence, so it is held to the same standard.** The
stub the sweep and the gate put in place of the real perception module was
thinner than the module: it left three objects null, and the legacy assistive
app's `visibilitychange` handler then threw on every assistive screen at every
viewport. The error was in the sweep's report and it was not an app defect. The
stub is now as thick as the module it replaces, and the gate reads the page's
errors after the page is closed, because a page that throws while it is torn
down throws after the navigation is over — the gate used to copy the error list
too early to see it.

### A2 · The legacy stylesheets' type floor (done)

`public/app/style.css`, `public/app/everyday/style.css` and
`public/neuroface/fingerspeak.html` were written in 9–11px steps — the smallest
was 9px, in the studio's `.protected-tag`. Every rule below 12px in all three
files is now at 12px, which is the same floor as the React app's `caption`
token: 38 rules in `public/app/style.css`, 6 in
`public/app/everyday/style.css` and 12 in the studio.

**Proved by:** a sweep that finds no rendered text below 12px, and the same
before-and-after screenshots the audit already writes. The wave that first
measured this recorded the floor as 11px; the final stabilisation pass
corrected the figure and raised it the rest of the way.

### A3 · The Move session page re-renders at 4 Hz

`src/app/dashboard/patient/move/session/page.tsx` ticks every 250 ms for the
whole workout, and the page derives almost everything from the live session
object, so the whole page renders four times a second. The localStorage write
is already throttled to at most once every 2 s and only when the session state
changed. The fix is to move the clock and the rep counter into their own small
components that subscribe to the tick, and keep the session object out of the
page's render path.

**Proved by:** a render count in the browser during a session, and the existing
Move session unit tests.

### A4 · The Move screening answers sit in plain localStorage

`public/app/everyday/move-safety-state.js` keeps the screening answers and the
pain areas in `localStorage` under `asha_everyday_move_safety`, in plain text,
unlike the Everyday vault, which is encrypted with the person's password. The
answers are health information. Encrypting them needs a password the Everyday
Move does not have, so this is a workflow decision, not a one-line fix: either
a passphrase prompt for the Move, or an explicit, visible choice to keep them
unencrypted on this device only.

**Proved by:** a test that reads the stored value and asserts it is not
plain text, plus the privacy screen saying which it is.

### A5 · The legacy assistive app's Settings is not in the bottom navigation

`public/assistive.html` reaches its settings screen from the header button
("Open Settings") in every view, but there is no Settings item in the bottom
nav, so it is not where a person looks for it. Adding one changes a retained
surface's navigation.

**Proved by:** the assistive sweep reaching Settings from the bottom nav, and
the legacy app's own screen still reachable from the header button.

### A6 · A hand pose or a spoken "Yes" confirms any pending request

`public/engine/main.js` and the React equivalents confirm *any* pending request
from a trained hand pose, or from a FingerSpeak phrase whose text is "Yes" or
"No", without checking that it matches the need that was asked. The blink path
does check. `docs/ACCURACY_REPORT.md` §Known limitations 2–3 records this as a
deliberate decision, and the request still passes through a separate
confirmation dialog.

**What it needs:** a matching rule between the request's intent and the
confirmation's content, in both the legacy and the React path, and a
re-decision about the existing workflow, because it changes how a person
confirms a request today.

**Proved by:** a test per intent — a "Yes" that matches the request confirms
it, a "Yes" that does not match does not.

### A7 · Model weights are verified at build time, not at run time

`npm run models:check` and `tests/model-integrity.test.mjs` check every
inference asset against its pinned size and SHA-256 before the build, but the
browser does not hash the model it loads. Hashing in the page would cost about
45 MB of re-fetching on a phone on a slow connection, which is a worse outcome
for the person using the app than the threat it addresses. The one model that
genuinely arrives from outside the app — the Everyday model pack registry — is
verified at run time already.

**What it needs:** verifying on a cache miss only, using the service worker's
cached response, so a first load pays nothing.

---

## Track B — work that needs an input this repository does not have

Each row is honest about what is missing and what it would prove. None of
these is a defect in the code.

| # | Work | The input it needs | What it would prove | Where it is written up |
| --- | --- | --- | --- | --- |
| B1 | The Maira provider end to end | `MAIRA_API_KEY` + `MAIRA_PROJECT_KEY` | The real routing, retrieval and reply validation against the real provider. The provider's own answer quality still needs a human study and is not claimed anywhere. | `docs/REMAINING_ISSUES.md` §3 |
| B2 | Supabase and Vercel Blob storage | `SUPABASE_URL` + `SUPABASE_SECRET_KEY`, or the blob token | The production storage path. The adapters are covered against their own contracts. | `docs/TEST_RESULTS.md` §5 |
| B3 | The live deployment | Permission to contact it | `npm run test:api:live` and `npm run test:browser:production`, both wired and both deliberately outside the aggregate. | `docs/REMAINING_ISSUES.md` §3.1 |
| B4 | The real camera models on real photographs | `artifacts/portrait-test.jpg`, `hands-test.jpg`, `pose-test.jpg` | Face, hand, pose and EyeSpeak on photographs rather than synthetic fixtures. | `docs/REMAINING_ISSUES.md` §3 |
| B5 | Real phones on the LAN | A phone, and the LAN address | Camera, microphone, the push service worker and the touch targets on the hardware the app is for. `npm run serve:lan`; `docs/LAN_SETUP.md`. | `docs/LAN_SETUP.md` |
| B6 | A dish recogniser | A labelled Bangladeshi food dataset, patient-independent held-out splits | Top-1/top-3, macro-F1, ECE and a per-dish breakdown. Until it exists, the segmenter offers ingredient candidates only and says so. | `docs/NUTRITION_AI_ACCURACY_REPORT.md` |
| B7 | Portion estimates | A weighed-and-photographed plate dataset, with measured retained oil and salt | Gram and kcal MAE, and the interval coverage of the ingredient bounds. | `docs/VALIDATION_PLAN.md` |
| B8 | A Bangladesh food composition table | A redistributable composition table | Real per-ingredient nutrition for Bangladeshi dishes instead of the stated assembly and its assumptions. | `docs/NUTRITION_SOURCES.md` |
| B9 | Clinical release | Clinician-authored and clinician-reviewed symptom scenarios, in Bangla and English | The Care safety rules become a reviewed protocol rather than an unreviewed aid. The flag stays Off until then. | `docs/VALIDATION_PLAN.md` |
| B10 | Signed release packs | An operator-controlled signing key and a pinned public trust key | The download, verify, install, rollback and eviction path against a real signed manifest. | `docs/FEATURE_FLAGS.md` |
| B11 | Performance on real devices | Low-end Android and supported iOS | Cold and warm p50/p95, peak RAM, sustained FPS, battery and thermal load, and download failures. | `docs/VALIDATION_PLAN.md` |
| B12 | Independent accuracy studies | Reference video and goniometer for Move; intended users and caregivers for EyeSpeak | Rep-count MAE, invalid-rep false accepts, gaze setup time, false selections per minute, drift and fatigue. | `docs/MOVE_VALIDATION.md`, `docs/EYESPEAK_VALIDATION.md` |
| B13 | External privacy and security review | A reviewer who is not the author | Tenant isolation, capability exposure, backup and deletion behaviour, encryption, browser XSS protections and professional identity access. | `docs/DATA_PRIVACY.md` |
| B14 | Provider assessment | The provider's privacy, security and regulatory terms | Whether the MAIRA adapter may carry the data it is allowed to carry. | `docs/DATA_PRIVACY.md` |
| B15 | Production roles and staffing | A decision about identity verification and who is on call | The capability-credential model is **not** identity verification; the caregiver side of the demo cannot become a clinical account system without this. | `docs/REMAINING_ISSUES.md` §4 |

---

## Track C — decided, recorded, not to be "fixed"

These are in `docs/REMAINING_ISSUES.md` §1, with the reasoning. In short: a
hand pose or a spoken "Yes" confirming any pending request (A6 above), the Move
session's 4 Hz render (A3), build-time-only model hashing (A7), the legacy
Settings entry point (A5), and the plain-text Move screening answers (A4).
Each is a product or performance decision that was taken on purpose; A6, A5 and
A4 appear in track A as well because they can be re-decided if the product
wants them changed.

---

## The order the work happens in

1. **Finish and record the visual audit wave** — done in this branch: the
   sweep, the ledger, the report and the gate. The gate was repaired as well,
   because it had never run.
2. **Re-measure the pre-repair baseline** — done: the sweep is run against the
   pre-repair commit with today's probes, so the number of defects the audit
   found is a measurement rather than a claim. Both sides are written to their
   own directory, so the two never overwrite each other.
3. **A2, then A3** — A2 is done (the legacy floor is 12px). A3 is the Move
   session's 4 Hz render, each on its own, each with the sweep run afterwards.
4. **A4, A5, A6, A7** — the decisions. Each is written down as a decision
   before it is coded.
5. **Track B in the order the inputs arrive.** The inputs are the constraint,
   not the code: every row above is executable the day its input exists.

## What "done" means for each step

| Step | Check |
| --- | --- |
| A1 | `npm test` (668 passing), `npm run tokens:check`, `npm run models:check`, `node scripts/secret-scan.mjs`, `npx tsc --noEmit`, `npm run build`, and `npm run test:browser:responsive` against the production build. |
| A2 | The sweep reports no rendered text below 12px, in either theme. |
| A3 | A render count during a Move session, before and after. |
| A4–A7 | A test per item, and the affected screen re-swept. |
| Track B | The row's own measure, with the number recorded in the module's own accuracy or validation document. |

## What this plan does not claim

- No clinical accuracy number, recovery score, reliable food identity, gaze
  precision, diagnosis or clinical clearance is asserted anywhere in this
  repository, and nothing in this plan adds one.
- The app is a demonstration app, not a validated clinical device.
- A camera-derived observation is an engineering signal. A posture flag, a
  wake-like pattern or facial asymmetry is not a diagnosis, and nothing in this
  plan places a telephone call.
