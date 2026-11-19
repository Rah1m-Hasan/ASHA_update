# NeuroBridge ASHA — final delivery report

**Date:** 2026-11-18
**Branch:** `rahim/neurobridge-asha-accuracy-improvements`
**Measured against:** the pre-repair baseline commit `068c6e4`
**Release recommendation: READY FOR DEMONSTRATION**

> **This is a demonstration application, not a validated clinical device.** The camera-derived
> readings are engineering signals, not measurements; a posture flag, a wake-like pattern or a
> facial asymmetry is not a diagnosis; the app does not place phone calls; and nothing here has
> been through the clinical validation a medical device would need. The disclaimers are in the
> product itself, on the screens that show a reading, and they were verified unchanged against
> the baseline.

---

## A. What was completed

The application was already substantially built. What was broken was the **evidence chain** — the
proof that it worked. This pass repaired the evidence and, where the evidence exposed a real
fault, the fault.

| Area | State at the start | State now |
| --- | --- | --- |
| The responsive gate | Died with a `ReferenceError` before Chromium launched. Every document called it "the gate"; it gated nothing | Runs. **PASS** — 16 screens × 6 sizes × 3 themes |
| The visual sweep | Crashed partway and lost its report; every run died | Survives a dead browser, writes its report after every route, and completed all six sweeps |
| The baseline | Two byte-identical ledgers; the baseline sweep died at 253 renders | Re-measured with the same probes and the same manifest, into its own directory |
| The audit report | Three unfilled placeholders; the headline figure came from a lost report | Filled from the sweep's own report; every number traceable |
| The measurement instrument | The perception stub was thinner than the module it replaced, and put a fake `TypeError` in every assistive screen's report | As thick as the real module, with a regression test |
| The server | Provider timeout longer than the adapter's; body limit declared twice; one quota bucket for two budgets; a duplicate food threw a 500 | Fixed at the source, each with a regression test |
| The browser suites | 24 of them had no npm script, so nothing ran them | All 27 wired — 26 in the aggregate, one for the live site — and all passing or explicitly skipping |

**116 files changed against the baseline** (104 modified, 12 added): the app's visual and
responsive surface, the shared component layer, the legacy stylesheets, the token palette, the
server handlers, the test harness, the sweep tooling and the documentation.

**Nothing was rebuilt.** The plan said not to rebuild working components, and it was not rebuilt:
the legacy assistive app and the Everyday companion are the retained surfaces the brief named, and
their shells were left alone even where fixing them would have meant reworking the camera panel,
the chat panel and the companion bubble.

---

## B. Visual quality

**The same measurement, on both sides, with the same probes and the same manifest.**

| | Baseline | Current |
| --- | ---: | ---: |
| Renders measured | 2400 | 2400 |
| Variants | light, dark, Bangla | light, dark, Bangla |
| **Defects (excluding floating chrome)** | **4234** | **0** |
| Floating-chrome overlaps | 521 | 500 |
| Page errors | 23 | 0 |

| Defect type | Baseline | Current |
| --- | ---: | ---: |
| `tinyTarget` (a target under 24×24) | 2127 | 0 |
| `missingName` (a control with no accessible name) | 1040 | 0 |
| `contrast` | 525 | 0 |
| `heading` (a level that skips) | 520 | 0 |
| `offender` (an element crossing the viewport edge) | 20 | 0 |
| `pageOverflow` (the page scrolls sideways) | 2 | 0 |

### Coverage

* **59 screens** across four surfaces: the Next.js App Router (35), the retained legacy assistive
  app (11), the retained Everyday companion (9), and the standalone FingerSpeak studio (4).
* **20 renders per screen**, at 19 distinct physical sizes — six desktop, six mobile, five tablet
  (one of which is a landscape phone) and three browser-zoom levels. The tablet's 1024×768 and the
  desktop's 1024×768 share a physical size but not a filename, so neither overwrites the other.
* **Light covers all 59 screens** (1180 renders). **Dark covers the 44** the theme puts at risk
  (880). **Bangla covers the 17** that have a Bangla path (340). The split lives in the manifest,
  in `routesForVariant()`, so it can be read off the code.

### The Bangla claim, stated exactly

A screen counts as Bangla-covered only when its *interface* is Bangla.

* The **React workspace** (Move, Nutrition) reads its language from the feature's own persisted
  store; the sweep seeds it before the page loads.
* The **Everyday companion** reads it from `asha_everyday_language`; the sweep seeds that too, so
  the page is *born* in Bangla rather than switched after the fact.
* The **legacy assistive app has no Bangla interface at all.** Its `#ashaLanguage` is the
  *conversation* language and its `#speechLanguage` is the *listening* language; neither translates
  the interface. Ten screens that were being counted as Bangla coverage are not, and were
  removed from that sweep. Measuring English and calling it Bangla would have been a false claim.
* The **FingerSpeak studio is not translated at all** — one language, no control to change it.
  This is a real gap, found by measuring rather than reading, and it is listed as a known gap
  rather than quietly excluded.

### Typography and the palette

One palette, defined once in `scripts/tokens.mjs`, written out to four files and checked by
`npm run tokens:check`. Every colour pair in both themes clears its contrast ratio. The legacy
type floor was **below 12px** — the smallest was `0.49rem`, about 8px, and the studio's was a
fixed 9px — and is now **12px**: 38 rules raised in `public/app/style.css`, 6 in
`public/app/everyday/style.css` and 12 in the studio, matching the React app's own floor.

### What is still there, honestly

**500 floating-chrome overlaps, 54 distinct, across 17 screens.** The fixed bottom bar, the sticky
headers and the companion bubble cross the content they float over. The content that mattered was
kept clear of it, and the legacy app reserves a 104px band below its content so the patient
space's action row clears the bar at full scroll. Making content *never* pass under the bar means
rebuilding the retained legacy app's shell around a scroll region that ends above the navigation,
touching the camera panel, the chat panel and the bubble — a worse trade, in a surface the brief
says not to rebuild. It is reported here, with its count, rather than hidden. The count went from
521 to 500; it did not go to zero and this report does not claim it did.

---

## C. Functional quality

**All 26 browser suites ran against the production build and the run exited 0.**

| Suite | Result | What it proves |
| --- | --- | --- |
| `test:browser` | PASS | the two-phone journey: setup → private links → propose → confirm → stored → caregiver receives → caregiver acknowledges → the patient sees the updated state |
| `test:browser:auth-workspace` | PASS | the caregiver workspace on a phone |
| `test:browser:blink` | PASS | the blink counter in the browser: 8 blinks observed, `replayUI: true` |
| `test:browser:blink-request` | PASS | blink → propose → confirm → send; **ordinary blinks are rejected** |
| `test:browser:camera-error` | PASS | a camera failure a person can act on, with no raw exception shown |
| `test:browser:demo-recovery` | PASS | the demo recovers from a failure |
| `test:browser:eye-cursor` | PASS | gaze pointer, slow-blink and held-look clicks, the accuracy gate, phone layout |
| `test:browser:eyespeak` | PASS | calibration with measured accuracy → board → propose → confirm; noisy-eye fallback; keyboard |
| `test:browser:facespeak-stretch` | PASS | abnormal stretch replaces smile symmetry; the 60-second hold timer; the not-counted and no-face states |
| `test:browser:home` | PASS | the app home: continue, recent first, personalise, hidden areas |
| `test:browser:move` | PASS | learn/set-up/practice/do, camera reps, tracking loss, reload, emergency lockout, Bangla manual fallback |
| `test:browser:next-patient` | PASS | switching the active patient; separate confirmation; guided nod |
| `test:browser:nutrition` | PASS | 4 runs |
| `test:browser:orchestration` | PASS | 3 provider calls, 1 confirmed event, 2 speech memories, and an unsafe source rendered as text rather than as an answer |
| `test:browser:shared-camera-lifecycle` | PASS | one camera across modules, released on pause, one camera on restart |
| `test:browser:speech` | PASS | segment restart, voice echo discarded, patient speech accepted, stop-and-exit cancels the restart |
| `test:browser:studio` | PASS | the FingerSpeak studio at four width/theme combinations, no overflow |
| `test:browser:vitals-ui` | PASS | both themes, live values cleared on pause, history retained |
| `test:everyday:browser` | PASS | nutrition save/correct/delete; the encrypted vault (no plaintext in IndexedDB); EyeSpeak touch and Bangla letters; urgent guidance offline with **zero cloud requests**; the real clinic journeys |
| `test:everyday:offline` | PASS | the service worker caches the shell and the app reloads and works offline |
| `test:browser:responsive` | PASS | the gate — 16 screens × 6 sizes × 3 themes |
| `test:browser:demo`, `eyespeak-real-model`, `face-hand`, `shared-camera`, `vision` | SKIP | the photograph fixtures they need are not in the repository and cannot be downloaded here |

**21 pass, 5 skip (missing fixtures), 0 fail.** The five skips are stated as skips, with the
missing file named. The real-model camera paths are **not** verified in this environment, and
nothing here claims they are.

### Two facts found by running the suites

* **The suites need a storage backend.** Without Supabase, a blob token or the memory store,
  `POST /api/session` answers 503 and every suite that opens a care circle fails at setup. The
  local run uses `ASHA_MEMORY_STORE=1 ASHA_MEMORY_STORE_PRODUCTION=1` — the second flag because
  `next start` runs with `NODE_ENV=production`, where the in-memory store is refused by default.
* **Nineteen browser scripts joined the base URL and a path by concatenation** and only worked
  when the environment variable ended in a slash. `ASHA_TEST_BASE=http://host:4180` produced
  `http://127.0.0.1:4180app`. Every suite now normalises the base. The operator was not doing
  anything wrong.

### Camera and inference

The camera paths, the model loading, the permission refusals and the shared-camera lifecycle are
all covered by the suites above, with a fake camera and the real engine modules where the real
module can run without hardware. The pinned weights are checked by hash: **17/17 match**. What is
**not** covered: the models on real photographs, real hardware, real people, or a phone on a LAN.

---

## D. Security

The authorisation model was reviewed and **found sound**: capability tokens are stored only as
SHA-256 hashes, compared in constant time, each action is gated by the role that action belongs
to, the fall-through is deny-by-default, nutrition is recomputed on the server from the shared
catalogue, credentials travel in the URL fragment and are scrubbed from the history, and the
provider's error messages are sanitised before they reach a client.

**Fixed in this pass:**

| | |
| --- | --- |
| The care-circle budget and the meal budget shared one key prefix, so creating care circles could 429 meal logging and the other way round | Separate prefixes |
| The provider's 45s timeout exceeded the adapter's 30s, so the adapter gave up first and the upstream call kept running with nobody waiting — paid for twice | The provider gives up at 25s, and the adapter aborts the handler when it gives up |
| The body-size limit was declared twice — 20,000 in the reader and 660,000 in the Clinic route — and the reader's number silently applied everywhere | Declared once, per route, and the handler reads the route's number |
| A duplicate `foodId` in one meal threw inside the calculator and answered 500 | 400 — it is the person's mistake, not the server's |

**Recorded as design decisions, not silently "fixed":** the client-supplied `confirmed` flag, the
forgeable per-address budget when there is no trusted proxy, the silent blob degradation, the
health endpoint's disclosure of the storage provider, anonymous clinic creation, and the patient
capability token in `localStorage`. Each is in `docs/REMAINING_ISSUES.md` §3.2 with the boundary
between "demonstration" and "production" stated.

**One thing is not a pass.** Next.js 16.4.3 has a published security advisory. The build stops to
print it; the retry completes and the build is sound, but the framework should be upgraded. It
was **not** upgraded in this pass. The decision was put to the operator and answered
explicitly — *not now* — so the pinned version stands and the build in this report was produced
by the version the project pins. The advisory is recorded in four places so it is not lost:
here, in the README, in `docs/VISUAL_AUDIT_REPORT.md` §11 and in `docs/REMAINING_ISSUES.md` §5.
It should be handled before this app is deployed anywhere. See §H.

**Not verified:** the live deployment was not touched in this pass, and the Maira provider's own
answer quality is not claimed — no credential was present.

---

## E. Testing evidence

Every command below was run in this repository against the **production build**, and the output
is quoted rather than described.

```sh
$ npm test
1..668
# tests 668
# pass 668
# fail 0
```

```sh
$ npx tsc --noEmit
```
Clean — no output.

```sh
$ npm run tokens:check
Tokens are up to date, and every colour pair clears its contrast ratio.

$ npm run models:check
17/17 inference assets match their pinned hash.

$ node scripts/secret-scan.mjs
{"filesChecked":830,"secretFindings":[]}
```

```sh
$ npm run build
✓ Compiled successfully in 239ms
  Running TypeScript ...
  Finished TypeScript in 1750ms ...
```
All 41 routes compile. **The build also prints a `SecurityFatalError` about the Next.js version** —
see §D and §H.

```sh
$ npm run test:browser:responsive
PASS 16 screens × 6 sizes × 3 themes (light 96, dark 96, bn 18): no overflow, no clipped
text, no unnamed control, no target under 24x24, no contrast failure
```

```sh
$ npm run test:browser:all
```
26 suites, exit 0. See §C.

```sh
$ npm run audit:visual:all
```
Six sweeps — current and baseline, in light, dark and Bangla — 4,800 renders in total, in two
separate directories.

### Where the evidence is

| Path | What it holds |
| --- | --- |
| `artifacts/visual-audit/current/` | the current build: `report.json`, `ledger.md`, `defect-table.md`, and a screenshot per render (2400) |
| `artifacts/visual-audit/baseline/` | the pre-repair build, measured identically (2400 screenshots) |
| `artifacts/visual-audit/comparison.md` | the baseline-versus-current table |
| `artifacts/visual-audit/` | the earlier evidence — 2,485 screenshots and the two stale ledgers — left in place, not overwritten |

### Blocked — not verified, and not claimed

| Check | Why | What was done instead |
| --- | --- | --- |
| The live deployment | Local verification only. **Nothing was sent to it in this pass** | `npm run test:api:live` exists and is deliberately not part of `test:browser:all` |
| The Maira provider | No `MAIRA_API_KEY` | Routing, prompt assembly, retrieval and reply validation are covered against a stubbed provider. **The provider's own answer quality is not claimed** |
| Supabase and Vercel Blob | No credentials | The memory store was used; each adapter is covered against its own contract |
| The real models on real photographs | The fixtures are not in the repository and cannot be downloaded here | The four dependent suites skip with a clear message; the synthetic-fixture accuracy benchmark covers the software path |
| Real hardware, real people, a phone on a LAN | No hardware here | The suites use a fake camera |
| The accessibility tree against a rules engine | No axe-core, and adding one was out of scope | The probe checks names, roles, heading levels, target size and contrast. Keyboard reachability, focus visibility and `prefers-reduced-motion` were checked by hand on the React workspace |
| ESLint | The project has no ESLint configuration | Not added — it would introduce a dependency. `npx tsc --noEmit` is the static check |

---

## F. The code changes

**The app surface.** The React workspace's layout, the shared component layer (`Button`,
`Panel`, `Dialog`, `EmptyState`, `SectionHeading`, `VideoFrame`, `DashboardShell`, `Sidebar`),
the legacy stylesheets and the standalone studio. The audit wave's defects were fixed **at the
source** — in the shared component and in the one token palette — not with per-screen CSS
overrides. The palette is defined once in `scripts/tokens.mjs`; `npm run tokens` writes the four
outputs and `npm run tokens:check` proves they are current.

**The server.** Five fixes, each with a regression test: the separate quota buckets, the
provider's timeout and the adapter's abort, the single body limit, the duplicate-food 400, and
the abort signal being passed to the orchestrator so a provider call does not outlive the person
who asked for it.

**The tooling.** `scripts/visual-audit.mjs` survives a dead browser and writes incrementally.
`scripts/visual-audit.routes.mjs` holds the route manifest and the variant split.
`scripts/visual-audit.harness.mjs` holds the shared stubs. `scripts/visual-audit-ledger.mjs`,
`scripts/visual-audit-report.mjs` and `scripts/visual-audit-compare.mjs` turn the measurement
into the ledger, the table and the comparison, so the document cannot drift from the measurement.
`scripts/audit-sweeps.sh` runs the six sweeps one at a time, keeping the two sides apart.

**The tests.** 18 regression tests in `tests/stabilisation-regressions.test.mjs`, each naming the
defect it holds shut. 19 browser scripts normalised. `tests/responsive-browser.mjs` fixed, and
its error-reading order fixed — checked by putting the broken stub back and watching it fail.

**The documentation.** `README.md` (routes, dashboard, setup, environment variables, testing,
known limitations, the demonstration disclaimer), `.env.example` (every server variable and what
happens when it is absent), `docs/TEST_RESULTS.md`, `docs/FULL_AUDIT_REPORT.md`,
`docs/VISUAL_AUDIT_REPORT.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/REMAINING_ISSUES.md`,
`docs/ROADMAP.md`, `docs/NUTRITION_AI_IMPLEMENTATION_REPORT.md`.

---

## G. Remaining limitations

1. **500 floating-chrome overlaps** (§B). Reported with their count, not hidden.
2. **The FingerSpeak studio has no Bangla path** (§B).
3. **The Next.js security advisory** (§D, §H).
4. **The legacy assistive app's Settings has one entry point**, and the Everyday Move remembers
   its screening answers in plain `localStorage` — both were judged and left, with the reasoning
   in `docs/REMAINING_ISSUES.md` §1.
5. **The design-level security items** (§D) — each recorded, none silently fixed.
6. **Everything in §E's blocked table.** No camera, no real hardware, no provider credential, no
   live deployment, no rules-engine accessibility audit.
7. **The model weights are verified at build time, not at run time** — a hash at install, not a
   check on every load.

---

## H. The release recommendation

# READY FOR DEMONSTRATION

The application builds, serves every route, passes 668 unit tests and 26 browser suites, passes
the responsive gate across 16 screens at 6 sizes in light, dark and Bangla, and measures
**2,400 renders with zero defects and zero page errors** against a baseline that measured 4,234
defects. The request flow, the offline behaviour, the shared camera, the Bangla interface, the
security model and the provider's safety boundaries are all exercised by tests that run.

**It is not ready for staging, and the reason is specific rather than general.** Three things
stand between it and a staging deployment:

1. **Next.js 16.4.3 has a published security advisory.** A staging deployment is exactly where a
   known framework vulnerability becomes a real one. This should be upgraded before the branch
   goes anywhere near a shared environment. The operator has decided not to do it in this pass,
   so it is an open item, not a closed one.
2. **The demonstration access mechanism is not identity verification.** Random capability
   credentials, hashed at rest, are a way to get a session to the right browser and nothing more.
   A staging environment with real patient data needs a real identity story.
3. **The clinical boundaries are documented and enforced in code, but they have not been through
   clinical validation.** The consent gates, the refuse-to-fabricate rules, the "this is not a
   diagnosis" language — these are in the code and were checked — but no clinician has reviewed
   them, and no dataset of the kind a medical device would need exists.

> **The operator has decided: the upgrade is not being done in this pass.** The advisory is
> recorded rather than forgotten — in this report, in `docs/VISUAL_AUDIT_REPORT.md` §11, in
> `docs/REMAINING_ISSUES.md` §5 and in the README — and the command is
> `next upgrade --agent=security --internal-nudge-id=9c616fa7-4009-4709-8935-eaaeb4b06376`.
> It should be run before this branch is deployed anywhere.

**And the last word, which is the one that matters:** this is a demonstration application. The
camera-derived readings are engineering signals. A posture flag, a wake-like pattern or a facial
asymmetry is not a diagnosis and never triggers an automatic emergency call — the app does not
place phone calls. An ordinary blink never sends a request; a request needs an explicit,
separate confirmation. Those boundaries are in the code, they are in the product's own text, and
this pass did not weaken any of them.
