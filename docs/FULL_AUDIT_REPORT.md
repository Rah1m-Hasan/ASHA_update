# NeuroBridge ASHA — full repository audit and repair

**Date:** 2026-11-14
**Branch:** `rahim/neurobridge-asha-accuracy-improvements` (base commit `e3a154f`)
**Scope:** the whole repository — 576 tracked files, ~59,000 lines — including the Next.js
App Router app, the two retained legacy browser apps, the browser inference engine,
the server handlers and libraries, the OKF knowledge bundle, the build and release
scripts, and the test suites.
**Outcome:** every defect found was reproduced, repaired and covered by a regression
test or a browser check. Nothing was left "probably fixed". The items that could not
be verified in this environment are listed in [`REMAINING_ISSUES.md`](REMAINING_ISSUES.md)
with the exact limitation.

ASHA is a **demonstration app, not a validated clinical device**. Nothing in this
repair changed a clinical safety boundary; the boundaries were treated as fixed
constraints and are re-verified in [Safety invariants](#safety-invariants) below.

---

## 1. Method

1. **Discovery** over all six areas: server/API, React app, legacy engine, Everyday
   app, scripts/config, tests/docs.
2. **Verification** of every candidate: a finding was only accepted when it had a
   concrete failure scenario (inputs → wrong behaviour). Three candidates were
   checked and **rejected** because they could not be reproduced — they are recorded
   in [`REMAINING_ISSUES.md`](REMAINING_ISSUES.md) rather than "fixed" on paper.
3. **Repair** in severity order P0 → P2, each fix minimal and targeted.
4. **Regression coverage** for every significant fix: a `node --test` file for the
   server and shared logic, a browser assertion for the client behaviour.
5. **Re-verification**: the whole suite, a production build, the generated-asset
   checks, the secret scan, the accuracy benchmark, and the browser suites against a
   production build.

Severity used here:

| Severity | Meaning |
|---|---|
| **P0** | A safety boundary is broken, or the app cannot be used at all. |
| **P1** | The app misleads the patient or the caregiver about something that matters. |
| **P2** | A real defect in reliability, correctness, security or error handling. |
| **P3** | Usability, performance and documentation issues. Documented, not coded. |

**Defects fixed: 27** (P0: 0, P1: 3, P2: 24). **Candidates checked and rejected: 5.**
**P3 findings documented: 5.**

---

## 2. The defect ledger

### P1 — safety and integrity

#### P1-1 · The reply guard let the model claim a caregiver had been contacted

* **File:** `src/server/lib/reply-guard.js` — `UNSAFE_REPLY_PATTERN` (line 83),
  `UNSAFE_REPLY_PATTERNS` (line 90), `replyIsSafe` (142), `replyIsAllowed` (171).
* **Root cause.** The pattern required `i`/`we` immediately before the verb, so
  passive, third-person and perfect constructions passed. **15 of 16** contact-claim
  phrasings were allowed through, including *"Your caregiver has been contacted."*,
  *"The caregiver was notified."*, *"Someone has let your caregiver know."* and
  *"The emergency service has been alerted."* — in English and Bangla. Both AI paths
  were affected: `asha-orchestrator.js` (`replyIsAllowed`) and `care-service.js`
  (`replyIsSafe`, which only had the pattern).
* **Why it matters.** The AI must never state that a caregiver or an emergency
  service was contacted — the app does not place calls, and a patient told
  "your caregiver has been alerted" may stop asking for help.
* **Fix.** The pattern was widened to passive, third-person and perfect
  constructions, to the caregiver/emergency-service object, and to the Bangla
  equivalents. It is still phrase-based, so the knowledge bundle's legitimate
  negative statements ("it cannot measure blood pressure") still pass.
* **Proved by:** `tests/reply-guard.test.mjs` — all 16 phrasings are refused and the
  legitimate negatives are allowed.

#### P1-2 · `receive` racing `ack` wiped the acknowledgement

* **File:** `src/server/handlers/session.js` (the `receive`/`ack` branch),
  `src/server/lib/receipts.js` (new).
* **Root cause.** The receipt was one document holding both facts, and every write
  was a read-modify-write of the other fact. The caregiver dashboard posts
  "received" automatically the moment it fetches a new request, and the caregiver
  posts "acknowledged" by hand, so the two writes overlap in ordinary use. When
  they overlapped, the "received" write could land last carrying
  `acknowledgedAt: null` and the patient's timeline went back from *Acknowledged* to
  *Received* — the app telling the patient nobody had acted on an act that had
  already happened.
* **Fix.** Each fact now has its own document (`receipts/<id>.json`,
  `acks/<id>.json`). Neither writer can clear the other's field, so the order the
  two land in no longer matters. `mergeReceipt()` reads both and returns the same
  shape the clients already use, so receipts written by earlier versions are still
  read and nothing stored is lost. `listAcks()` reads the acknowledgements per
  request rather than by listing a directory, because a listing is ordered by path
  and the request ids are random — a circle with more acknowledgements than the
  listing cap would silently lose the ones outside it.
* **Proved by:** `tests/session-receipt.test.mjs` — interleaved `receive`/`ack`
  writes, the merge, the backwards-listing case.

#### P1-3 · The Everyday Move had no safety gate at all

* **Files:** `public/app/everyday/move.js`, `public/app/everyday/move-engine.js`,
  `public/app/everyday/move-safety.js` (moved from `src/features/move/safety.js`),
  `public/app/everyday/move-safety-state.js` (new),
  `public/app/everyday/style.css`, `src/features/move/safety.js` (new re-export shim).
* **Root cause.** The React Move has a symptom screen, a 12-hour emergency lockout
  and a 15-minute rest lockout. The Everyday Move — a separately shipped,
  directly reachable surface (`/everyday.html`) — had **zero** safety code: a person
  exercising there got none of the protections of the React surface.
* **Fix.** The Everyday Move now runs the same rule-based English/Bangla policy:
  the same seven screening questions, the same painful-area exclusion of the
  movement that loads it, the same in-session symptom report, the same 12-hour
  emergency pause and the same 15-minute rest pause. The pause is persisted, so it
  survives a reload. "Right now" symptoms are never remembered; only the screening
  answers are, and only when the person asks for it.
* **Why the policy moved.** The Everyday app is a static browser app served from
  `public/`, and a browser ES module there cannot import from `src/`. Any policy
  both surfaces share must therefore live under `public/app/everyday/`. The policy
  was moved there and `src/features/move/safety.js` became a one-line re-export, so
  **all eight existing importers work unchanged** and there is still exactly one
  policy, not two.
* **Proved by:** `tests/move-safety-everyday.test.mjs` (14 tests) and the Everyday
  browser suite, which now walks the whole gate: Start without answers → the
  question is asked; "Yes" on the emergency question → urgent guidance; a reload →
  the pause is still in force.

### P2 — correctness, reliability, security hardening

| # | File | Defect | Fix | Proved by |
|---|---|---|---|---|
| 4 | `src/server/node-adapter.ts:74` | a handler that rejected after responding produced an unhandled rejection | the handler result is caught; a failure after a response is logged, not thrown | `tests/node-adapter.test.mjs` |
| 5 | `src/server/node-adapter.ts:74-76` | a handler that returned without answering left the request hanging | a 30 s expiry now answers 503; a handler that returns without answering answers 500 | `tests/node-adapter.test.mjs` |
| 6 | `src/server/node-adapter.ts:27-28` | the body was fully buffered *before* the size check | `readBounded()` streams the body and abandons it past the bound; the limit is still counted in characters, so Bangla is unaffected | `tests/node-adapter.test.mjs` |
| 7 | `src/server/lib/common.js:114-138` | `Access-Control-Allow-Origin` named one fixed origin while the allowlist admitted several, so every other allowed client (the live deployment, the LAN address) got HTTP 200 with an **unreadable body** | the origin the browser asked for is echoed back; the same-host rule keeps the LAN address working | `tests/cors-origin.test.mjs` |
| 8 | `src/server/handlers/session.js:114-121` | an unsupported request `kind` threw inside `eventValue` and was reported as **503** instead of 400 — the patient was told their request had not been delivered and invited to retry something that could never succeed | the kind is checked before the event is built and answered with 400 | `tests/session-receipt.test.mjs` |
| 9 | `src/server/handlers/session.js:199-224` | `delete` listed at most 1000 keys but answered `{deleted:true}` — a larger care circle reported success with data left behind | the listing is removed in batches until it comes back empty; a remainder is answered 409, not a false success | `tests/session-receipt.test.mjs` |
| 10 | `src/server/handlers/session.js:136-148` | two sends of the same request arriving together: the second write raised a duplicate error and was answered 503 | the duplicate is detected on write failure and the stored event is returned (`duplicate:true`) | `tests/session-receipt.test.mjs` |
| 11 | `src/server/handlers/asha.js`, `src/server/handlers/care.js`, `src/server/lib/usage.js` (new) | the daily provider counter was a non-atomic read-modify-write shared by two endpoints, so the 160/day cap could be exceeded — and in `asha.js` the read was deliberately deferred, so a burst of 100 concurrent requests passed the check 100 times | the allowance is now **claimed** with a slot whose name encodes the 1.5 s window; only one request in a window can create it, on all three storage backends (the memory store throws "Already exists", Supabase answers 409, Blob refuses the overwrite) | `tests/usage-quota.test.mjs` |
| 12 | `src/server/handlers/care.js` | a bare `catch {}` with no logging — three of six endpoints had no error telemetry | the failure is logged with the error name | — (telemetry) |
| 13 | `src/server/handlers/clinic.js` | the rate-limit marker was written **after** the clinic and its admin secret existed, so a marker failure answered 503 and orphaned a live workspace | the marker is written first | `tests/rate-limit-key.test.mjs` |
| 14 | `src/server/lib/clinic.js` | the rollback `store.remove(written)` could itself throw and mask the original error | the rollback has its own try/catch | — |
| 15 | `src/features/requests/send.ts`, `src/components/patient/DeliveryBanner.tsx` | `void retryUnsent(cred)` had no `.catch`: a failed retry was an unhandled rejection, nothing changed on screen, and the patient was left thinking it had been sent | the retry reports its failure in the banner | browser check (delivery banner) |
| 16 | `src/server/handlers/health.js` | `storageProvider` never reported `"memory"` — the health check misreported the store that was actually running | the real provider is reported | — |
| 17 | `src/server/handlers/cleanup.js` | did not call `begin()`, so `OPTIONS` answered 401 instead of 204 and no CORS headers were sent | `begin()` is called first | — |
| 18 | `src/server/handlers/session.js:22-25`, `src/server/handlers/clinic.js` | the rate-limit key used the **first** `x-forwarded-for` entry — correct on Vercel, which overwrites the header, but wrong behind any proxy that appends | `clientIp()` takes the last valid address in the chain, strips an IPv4 port and ignores anything that is not an address, so a forged header buys no fresh allowance | `tests/rate-limit-key.test.mjs` |
| 19 | `src/features/caregiver/CareProvider.tsx:31` | the set of already-marked requests was shared for the whole session: it grew for ever and a request seen for one patient stayed marked when another was selected | the set is reset when the active patient changes | browser check |
| 20 | `src/app/dashboard/caregiver/patients/[id]/page.tsx:44-66` | `save()` and `remove()` had no `try/catch`: an API failure was an unhandled rejection with no feedback, and the caregiver was left thinking the save had worked | both report the failure in an alert on the page | browser check |
| 21 | `src/components/caregiver/CopyLink.tsx` | `navigator.clipboard.writeText` was unguarded — it does not exist on the documented plain-HTTP LAN deployment, so the copy threw and nothing happened; the 2 s timer was also never cancelled | the clipboard is used when it exists, the link is shown for copying by hand when it does not, and the timer is cancelled on unmount | browser check |
| 22 | `src/lib/engine/load.ts:29-37` | a rejected script-loading promise was cached for the whole session: one dropped connection permanently broke the engine for that session | a failed load is not cached, so the next attempt can succeed | — |
| 23 | `scripts/model-integrity.mjs` (new), `public/models/manifest.json` | the manifests recorded the size and SHA-256 of every local inference asset, but **nothing compared them with the files**. The new check immediately found that `public/models/manifest.json` pointed at `app/ort.wasm.min.mjs` — a path that does not exist; the file is `engine/ort.wasm.min.mjs` | the manifest path is corrected and a check now verifies every pinned asset (size + hash) at build/CI time, plus that the Everyday registry agrees with the files on disk | `tests/model-integrity.test.mjs` |
| 24 | `package.json` | **24 browser test scripts were wired to no npm script** — the repository's browser coverage was far smaller than it looked, and nothing ran them | every browser test now has its own npm script and the aggregate `test:browser:all` runs them all, except the two that talk to the live deployment | `tests/browser-scripts-wired.test.mjs` |
| 25 | `tests/orchestration-browser.mjs` | the suite clicked `#settingsButton`, an id that no longer exists — the settings entry point is now the header button labelled "Open Settings". The AI routing, language, proposal → confirmation → event and XSS-safety assertions had **not been running at all** | the test clicks the real element; every assertion is unchanged | the suite itself |
| 26 | `tests/demo-browser.mjs`, `face-hand-browser.mjs`, `shared-camera-browser.mjs`, `vision-browser.mjs` | four suites crashed with `ENOENT` when their fixture photograph was absent, instead of saying what was missing | they skip with a clear message, following the convention already used by `tests/eyespeak-real-model-browser.mjs` | the suites themselves |
| 27 | `next.config.mjs` | the dashboard answered without `X-Frame-Options`, so it could be framed by another site — a framed page can be made to show one button where another is — and it advertised the framework in `X-Powered-By` | `X-Frame-Options: SAMEORIGIN` (same-origin only: the FingerSpeak studio and the Everyday companion are embedded from this origin) and `poweredByHeader: false` | `tests/security-headers.test.mjs` |

### Candidates checked and rejected

These were investigated, could not be reproduced, and were **not** changed. Each is
recorded in [`REMAINING_ISSUES.md`](REMAINING_ISSUES.md) with the reason.

| Candidate | Why it was rejected |
|---|---|
| The EyeSpeak board can be left in a half-open state when the calibration is no longer accurate enough | The board size comes from a calibration that cannot change while the board is open, and the page already explains why the board is unavailable. Unreachable. |
| The landmark overlays use fixed colours and "break" in dark mode | The overlays are drawn **over the camera picture**, not over the page. A fixed high-contrast palette is correct there and deliberate in both themes. |
| The Nutrition camera restore is fire-and-forget | The shared camera's `start()` handles its own failures and the camera dock shows the reason; the shared engine's `stop()` is what closes the models, and Nutrition needs the back camera, so a second stream is the correct design. |
| The 8 fps `frame` throttle drops rapid triple-blinks | Simulated with the real `BlinkIntent`: throttled and unthrottled give identical results at every blink spacing. |
| The rate-limit IP key is client-controlled on Vercel | Vercel overwrites `x-forwarded-for` and does not forward external IPs. A real gap only behind a custom proxy — which is what #18 above fixed. |

---

## 3. Files changed

**Server**

| File | Change |
|---|---|
| `src/server/node-adapter.ts` | bounded body reading, request timeout, JSON 500 on a handler failure or a handler that never answers |
| `src/server/lib/common.js` | `storageProvider`, `originAllowed`, `clientIp`, the echoed `Access-Control-Allow-Origin` |
| `src/server/lib/usage.js` *(new)* | the atomic provider quota (`claimUsage`) |
| `src/server/lib/receipts.js` *(new)* | the two-document delivery receipt |
| `src/server/lib/reply-guard.js` | the widened contact-claim patterns |
| `src/server/lib/clinic.js` | the rollback can no longer mask the original error |
| `src/server/handlers/session.js` | the 400 for an unsupported kind, the duplicate-event answer, the batched delete, the receipt merge, `clientIp` |
| `src/server/handlers/asha.js`, `care.js` | the provider quota; the logged failure |
| `src/server/handlers/clinic.js` | the rate-limit marker written before the workspace |
| `src/server/handlers/cleanup.js` | `begin()` first; the day's usage slots are cleaned up |
| `src/server/handlers/health.js` | the real storage provider |

**Client**

| File | Change |
|---|---|
| `src/components/patient/DeliveryBanner.tsx` | a failed retry is reported |
| `src/components/caregiver/CopyLink.tsx` | the clipboard is guarded; the link can be copied by hand; the timer is cancelled |
| `src/features/caregiver/CareProvider.tsx` | the received set is per patient |
| `src/app/dashboard/caregiver/patients/[id]/page.tsx` | the save and delete failures are reported |
| `src/lib/engine/load.ts` | a failed engine load is not cached |

**Everyday app**

| File | Change |
|---|---|
| `public/app/everyday/move-safety.js` | the shared policy (moved from `src/features/move/safety.js`), plus `startDecision` |
| `public/app/everyday/move-safety-state.js` *(new)* | the persisted pause and the remembered answers |
| `public/app/everyday/move.js` | the safety screen, the symptom report, the lockouts, the exercise exclusion |
| `public/app/everyday/move-engine.js` | the screening flags each exercise carries |
| `public/app/everyday/style.css` | the safety screen's styles |
| `src/features/move/safety.js` *(new)* | the re-export shim, so the eight existing importers are unchanged |

**Repository**

| File | Change |
|---|---|
| `package.json` | 25 npm scripts: 24 browser tests wired, the aggregate, the live-API script, `models:check` |
| `public/models/manifest.json` | the corrected path for `ort.wasm.min.mjs` |
| `scripts/model-integrity.mjs` *(new)* | the pinned-asset check |
| `tests/*.test.mjs` | 7 new test files, 493 tests in total |
| `tests/everyday-browser.mjs` | the Everyday Move safety journey |

---

## 4. Security findings

| Finding | Severity | Status |
|---|---|---|
| A handler that rejected after responding produced an unhandled rejection, hiding a real server fault | P2 | fixed (`node-adapter.ts`) |
| The API echoed a fixed `Access-Control-Allow-Origin` while admitting several origins — the admitted clients could not read the body | P2 | fixed (`common.js`) |
| The daily provider cap was a racy read-modify-write, shared by two endpoints | P2 | fixed (`usage.js`) |
| The rate-limit key trusted the first `x-forwarded-for` entry | P2 | fixed (`common.js`) |
| The clinic rate-limit marker was written after the workspace existed | P2 | fixed (`clinic.js`) |
| A rollback could mask the original error | P2 | fixed (`clinic.js`) |
| The health check misreported the store in use | P2 | fixed (`health.js`) |
| The local model weights were pinned but never verified | P2 | fixed (`scripts/model-integrity.mjs`) |
| The request body was buffered before the size check | P2 | fixed (`node-adapter.ts`) |
| The AI could claim a caregiver had been contacted | **P1** | fixed (`reply-guard.js`) |
| The 24 browser suites were never run by anything | P2 | fixed (`package.json`) |
| The dashboard could be framed by another site, and advertised the framework | P2 | fixed (`next.config.mjs`) |

**Checked and found sound:** credentials are random capability tokens stored only as
SHA-256 hashes; the role is derived server-side and the two roles never act for each
other; private links carry the token in the URL **fragment**, never the query string;
the clinic admin secret is required for every clinic write; the caregiver link
carries its own token; no secret is in client code, `NEXT_PUBLIC_*`, HTML or a log;
`node scripts/secret-scan.mjs` finds nothing in 545 tracked files; the daily setup
budget is keyed by a hash of the address, so no address is stored.

**Not verified here:** the live deployment was not contacted (the user asked for
local verification only), and there are no provider, Supabase or Blob credentials in
this environment — see [`TEST_RESULTS.md`](TEST_RESULTS.md).

---

## 5. Safety invariants

Every invariant below is enforced **in code** and covered by a named test. The
invariants themselves were not changed by this repair.

| Invariant | Enforced in | Proved by |
|---|---|---|
| No fabricated clinical values (no blood pressure, SpO₂, temperature or ECG) | `src/features/vitalsense/` — only pulse and breathing are derived, and only from the engine's own estimates | `tests/vitalsense.test.mjs`, `tests/vitals-render.test.mjs` |
| A pulse needs 12 s of continuous observation; breathing needs 30 s | the engine's own windows (`public/engine/perception.js`) | `tests/vitalsense-camera.test.mjs` |
| Gaps, frozen frames, poor light and motion clear the reading | the calibrated gate in the engine (`invalidateVitals`) | `tests/vitalsense.test.mjs` |
| A posture flag, a wake-like pattern or facial asymmetry is never a diagnosis and never triggers an automatic emergency call | no emergency call path exists in the app; the app places no calls at all | `tests/original-engine.test.mjs`, `tests/perception-camera.test.mjs` |
| An ordinary blink never sends a request | the blink counter requires a deliberate blink (`tests/blink-counter.test.mjs`), and a request needs a separate confirmation | `tests/blink-intent.test.mjs`, `tests/blink-request-browser.mjs` |
| A hand pose or a spoken "Yes" confirms any pending request | the asymmetry is **documented, not changed** — tightening it would change an existing workflow | `docs/ACCURACY_REPORT.md` §Known limitations 2–3 |
| Every caregiver request needs an explicit patient confirmation | `ConfirmRequestDialog` → `sendRequest` → `confirmed: true`; the server refuses an unconfirmed event | `tests/session-receipt.test.mjs`, `tests/reply-guard.test.mjs` |
| Clinic sharing needs its own explicit consent | the clinic handler requires the admin secret and an explicit patient action | `tests/clinic-storage-mode.test.mjs` |
| Cloud assistance needs its own consent | the Asha handler checks the consent before any provider call | `tests/asha-orchestrator.test.mjs` |
| An LLM can never override these rules | the orchestrator checks the format, the cited source ids and that any proposed action matches the patient's explicit request; a request still needs a separate patient confirmation | `tests/asha-orchestrator.test.mjs`, `tests/reply-guard.test.mjs` |
| A reply may never claim a caregiver or an emergency service was contacted | `src/server/lib/reply-guard.js` | `tests/reply-guard.test.mjs` |
| The Everyday Move applies the same exercise gate as the React Move | `public/app/everyday/move-safety.js` (one policy, shared) | `tests/move-safety-everyday.test.mjs` |

---

## 6. What was verified, and how

The commands, their real output and the counts are in
[`TEST_RESULTS.md`](TEST_RESULTS.md). In summary:

* `npm test` — **497 pass, 0 fail** (424 at the start of the audit).
* `npm run build` — a clean production build.
* `npm run okf` — the knowledge bundle regenerated from the markdown.
* `npm run tokens:check` — the generated palette is current and every colour pair
  clears its contrast ratio.
* `node scripts/secret-scan.mjs` — 545 files, no findings.
* `npm run models:check` — 14/14 inference assets match their pinned hash.
* `npm run benchmark:accuracy` — unchanged from the recorded baseline; no threshold
  was tuned.
* `npm run test:browser` and `npm run test:everyday` — pass against a production
  build on `127.0.0.1:4180`.
* `npm run test:browser:all` — every local browser suite in one run (the two
  suites that talk to the live deployment are deliberately outside it).

**Blocked by the environment** (never claimed as passed): the provider (no
`MAIRA_API_KEY`), Supabase and Vercel Blob (no credentials), the live deployment
(not contacted, by instruction), real camera hardware, real portrait/hand datasets
(`artifacts/portrait-test.jpg` is not on this machine), and physical low-end
devices.

---

## 7. Remaining limitations

See [`REMAINING_ISSUES.md`](REMAINING_ISSUES.md) for the full list, including every
P3 finding and every check that could not be run here.
