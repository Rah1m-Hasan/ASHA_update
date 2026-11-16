# NeuroBridge ASHA — remaining issues

**Date:** 2026-11-14

Everything here is either a **P3 finding** (documented rather than changed, by the
decision taken at the start of the audit), a **candidate that could not be
reproduced** and was therefore left alone, or a **check that could not be run in
this environment**. Nothing here is a known crash, and nothing here is a broken
safety boundary.

For what was fixed, see [`FULL_AUDIT_REPORT.md`](FULL_AUDIT_REPORT.md); for what was
run, see [`TEST_RESULTS.md`](TEST_RESULTS.md).

---

## 1. Deliberately not changed

### 1.1 A hand pose or a spoken "Yes" confirms any pending request (P2, by design)

**Where:** `public/engine/main.js` (the hand and speech confirmation paths) and the
React equivalents.

**What happens.** A trained hand pose, and a FingerSpeak phrase whose text is "Yes"
or "No", confirm *any* pending request without checking that it matches the need
asked. The blink path does check.

**Why it was left.** `docs/ACCURACY_REPORT.md` §Known limitations 2–3 records this
as a **deliberate** decision: tightening it would change an existing user
workflow, which this audit was instructed not to do. The request still passes
through the separate confirmation dialog, so nothing is sent without a second,
independent step.

**What it would take to change it.** A matching rule between the request's intent
and the confirmation's content, in both the legacy and the React path, plus a
re-decision about the existing workflow. That is a product decision, not a bug
fix.

### 1.2 The Move session page re-renders at 4 Hz (P3)

**Where:** `src/app/dashboard/patient/move/session/page.tsx` — the 250 ms interval
that ticks the session, calls `announce()`, `persist()` and `render()`.

**What happens.** The page re-renders four times a second for the whole workout, so
the countdown and the rep counter stay live. The localStorage write is **not**
written every tick: `persist()` throttles it to at most once every 2 s and only
forces it when the session state actually changed (`state|index|set|reps`). A
forced write does serialise the whole Move state, which can hold 200 history
entries.

**Why it was left.** The page derives almost everything from the live session
object, so the render is not a simple state update; slowing it needs the page
restructured. On the low-end phones this app targets, a 4 Hz re-render of one
page is acceptable, and the throttled write is already bounded.

**What it would take to change it.** Move the clock and the rep counter into their
own small components that subscribe to the tick, and keep the session object out
of the page's render path.

### 1.3 The model weights are verified at build time, not at run time (P3)

**Where:** `scripts/model-integrity.mjs`, `public/models/manifest.json`,
`public/neuroface/vendor/manifest.json`.

**What happens.** Every local inference asset is checked against its pinned size
and SHA-256 before the app is built (`npm run models:check`, and
`tests/model-integrity.test.mjs` on every `npm test`). The **browser** does not
hash the model it loads.

**Why.** Hashing the models in the page would mean fetching about 45 MB a second
time on a phone that is often on a slow connection, which is a much worse outcome
for the person using it than the threat it addresses — the assets are served by
the app itself, from its own origin. The one place where a model genuinely comes
from outside the app — the Everyday model pack registry — **is** verified at run
time, and `tests/model-integrity.test.mjs` checks that the registry and the files
on disk agree.

**What it would take to change it.** Verifying in the page on a cache miss only,
using the service worker's cached response.

### 1.4 The legacy assistive app's Settings has one entry point (P3)

**Where:** `public/assistive.html` — the settings section and the header button
`#landingMenuToggle` (labelled "Open Settings").

**What happens.** The legacy app's settings screen holds the Asha cloud consent,
the conversation language, the voice, the speech rate, the proactive check-ins and
the hands-free scanning. It is reachable from the header button in every view,
but there is no Settings item in the bottom navigation, so it is not where a
person would look for it.

**Why it was left.** Adding a bottom-nav item changes the navigation of a
retained surface, which is a design change rather than a repair.

### 1.5 The Everyday Move remembers its screening answers in plain localStorage (P3)

**Where:** `public/app/everyday/move-safety-state.js`.

**What happens.** When the person asks for it, the Move screening answers and the
pain areas are kept in `localStorage` under `asha_everyday_move_safety` — in
plain text, unlike the Everyday vault, which is encrypted with the person's
password.

**Why it was left.** The answers are health information, so this is worth
knowing. Encrypting them needs a password, which the Everyday Move does not have,
and the vault's key is derived from a password the person chooses separately.
Adding a password prompt to the Move would be a new workflow.

**Note.** "Right now" symptoms are never remembered, whatever this is set to.

---

## 2. Candidates that were checked and rejected

These were investigated and could **not** be reproduced. They were left alone on
purpose; none of them is a defect.

| Candidate | Why it is not a defect |
|---|---|
| The EyeSpeak board can be left open with no board when the calibration stops being accurate enough. | The board size comes from the calibration, which cannot change while the board is open — the model is only written by a calibration, and a calibration replaces the overlay. The page already explains why the board is unavailable ("Available after a calibration that is accurate enough."). Unreachable. |
| The landmark overlays use fixed colours, so they "break" in dark mode. | The overlays are drawn **over the camera picture**, not over the page. A fixed high-contrast palette is correct against a video image and is deliberate in both themes. The demo avatar's skin and mouth colours are deliberately not theme colours. |
| The Nutrition camera restore is fire-and-forget, so a failure silently leaves no camera. | The shared camera's `start()` catches its own failures and the camera dock shows the reason. Nutrition needs the back camera, so the second stream is the correct design. |
| The 8 fps `frame` throttle drops rapid triple-blinks. | Simulated with the real `BlinkIntent`: throttled (125 ms) and unthrottled give identical results at every blink spacing. |
| The rate-limit address is client-controlled on Vercel. | Vercel overwrites `x-forwarded-for` and does not forward external IPs. It was a real gap behind a custom proxy, and that gap is closed (see the audit report, finding 18). |

---

## 3. Could not be verified in this environment

| Check | Blocked by | How to verify it |
|---|---|---|
| The provider (Maira) end to end | No `MAIRA_API_KEY` | Set the key and the project key, then run `npm run test:browser:orchestration` without the stubbed route, or exercise the chat in the app. The routing, retrieval and reply validation are covered against a stub. |
| Supabase and Vercel Blob storage | No credentials | Set `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (or the blob token) and run the app; `npm run models:check` and the unit suites cover the adapters' contracts. |
| The live deployment | Not to be contacted, by instruction. **The production walk-through suite was run five times before that was noticed** — it hard-codes the deployed address rather than the local server. Every run created a temporary care circle and deleted it again in its `finally` block, so nothing was left behind. See [`TEST_RESULTS.md`](TEST_RESULTS.md) §4.3. | `npm run test:api:live` and `npm run test:browser:production` (both wired, both deliberately outside the aggregate). |
| The real camera models on real photographs | `artifacts/portrait-test.jpg`, `hands-test.jpg` and `pose-test.jpg` are not in the repository and are not on this machine | Put the photographs in `artifacts/` and run `npm run test:browser:shared-camera`, `npm run test:browser:face-hand`, `npm run test:browser:vision`, `npm run test:browser:demo`. |
| The real-model EyeSpeak path | the same missing photograph | `npm run test:browser:eyespeak-real-model`. |
| Real camera hardware, a real person, a phone on the LAN | No hardware here | `docs/LAN_SETUP.md`; `npm run serve:lan`, then open the HTTPS address on the phone. |
| Physical low-end phones | No phone here | `docs/VALIDATION_PLAN.md` — the participant and device work is still outstanding. |
| The provider's own answer quality | No credential, and no dataset | Needs credentials and a human study; no number is estimated for it anywhere in this repository. |

---

## 3.1 An open item found on the live deployment

**The production walk-through flaked once in three consecutive runs.** The
caregiver's acknowledgement reached the server, but the patient's timeline did
not show *Acknowledged* within 45 s. The same journey — two phones, one request,
one acknowledgement — passes locally (`tests/browser.mjs` reports
`twoContextRequestAck: true` against the local production build), so the cause
is on the deployment or on the network between the two devices, not in this
repair.

**What it would take to find it:** read the deployment's logs for the failing
run, and compare the patient's poll response with the acknowledgement write. The
local build is the same code, so the local path can be instrumented freely; what
cannot be reproduced locally is the deployment's own behaviour (its storage
backend is Supabase, not the in-memory store used here).

**Note.** The two-document receipt this audit introduced (`src/server/lib/receipts.js`)
is written to whatever store the deployment uses; on Supabase the two writes are
two separate rows, which is the case the change was made for.

---

## 4. Other known limitations (unchanged by this audit)

These were already recorded in the repository and remain true.

* ASHA is a **demonstration app, not a validated clinical device**.
* No clinical value is fabricated. Only a pulse (12 s of continuous observation)
  and breathing (30 s) are derived, and a gap, a frozen frame, poor light or
  motion clears the reading.
* A posture flag, a wake-like pattern or facial asymmetry is **not a diagnosis**
  and never triggers an automatic emergency call. The app places no telephone
  calls.
* The demo access mechanism (random capability credentials, hashed at rest) is
  **not identity verification** and not a clinical account system.
* Web push is best-effort and OS-dependent, not a dispatch service.
* The food-vision, offline-ASR, clinical-release and signed-release-pack
  capabilities are deliberately **Off** (`docs/FEATURE_FLAGS.md`).
* The gaze pointer still clicks the nearest button within the model's own p90
  radius (`docs/ACCURACY_REPORT.md` §Known limitations 4).
* The vital gate is tuned on synthetic noise, not on people
  (`docs/ACCURACY_REPORT.md` §Known limitations 9).

---

## 5. Housekeeping that was done but is worth knowing about

* The repository has **no ESLint configuration and no lint script**. Adding one
  was out of scope (it would introduce a dependency). `npx tsc --noEmit` is the
  static check and is clean.
* `npm run test:browser:all` runs 27 browser suites and takes roughly 20 minutes;
  the EyeSpeak suite alone takes about 4. It is meant for a full pass, not for
  every edit.
* `public/models/manifest.json` recorded the ONNX Runtime module at
  `app/ort.wasm.min.mjs`, a path that does not exist; the file is
  `engine/ort.wasm.min.mjs`. The path is corrected and the manifest is now
  checked by `npm run models:check`.
* The `public/app/` stylesheet is separate from the Tailwind build. It reads the
  same palette from `public/app/asha-tokens.css`, which `npm run tokens` writes,
  so the legacy surfaces follow the theme — but they are not part of the Tailwind
  utility system.
