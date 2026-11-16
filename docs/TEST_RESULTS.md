# NeuroBridge ASHA — test results

**Date:** 2026-11-14
**Branch:** `rahim/neurobridge-asha-accuracy-improvements`
**Machine:** Fedora Linux 7.2, Node v22.23.1, Next.js 16.4.3 (Turbopack), Chromium
via Playwright 1.65.0.

Every command below was run in this repository and its real output is quoted. A
check that could not be run is marked **BLOCKED** with the exact reason and is
**never** reported as passed.

---

## 1. Unit tests

```sh
$ npm test
```

```
1..497
# tests 497
# suites 0
# pass 497
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3705.523024
```

**497 pass, 0 fail.** The baseline at the start of the audit was 424; the 73 new
tests are the regression tests for this repair:

| File | Tests | Covers |
|---|---|---|
| `tests/reply-guard.test.mjs` | 24 | the widened contact-claim patterns, English and Bangla, and the knowledge bundle's legitimate negatives |
| `tests/session-receipt.test.mjs` | 11 | the two-document receipt, interleaved `receive`/`ack`, the batched delete, the unsupported-kind 400, duplicate-event idempotency |
| `tests/node-adapter.test.mjs` | 10 | the bounded body, the timeout, a handler that throws, a handler that never answers, a Bangla body at the limit |
| `tests/usage-quota.test.mjs` | 8 | the atomic provider quota: the cooldown, the daily limit, a burst of 25 concurrent claims |
| `tests/cors-origin.test.mjs` | 8 | the origin allowlist, the echoed `Access-Control-Allow-Origin`, the preflight |
| `tests/rate-limit-key.test.mjs` | 7 | the client address derivation, including a forged forwarded header |
| `tests/move-safety-everyday.test.mjs` | 14 | the Everyday Move gate: the questions, the exclusions, the lockouts, the persisted pause |
| `tests/model-integrity.test.mjs` | 3 | every pinned inference asset matches its recorded size and hash |
| `tests/browser-scripts-wired.test.mjs` | 4 | every browser test is reachable from an npm script |
| `tests/security-headers.test.mjs` | 4 | the security headers the app answers with |

```sh
$ npx tsc --noEmit
```
No output — clean, no type errors.

---

## 2. Production build and generated assets

```sh
$ npm run build
```
```
▲ Next.js 16.4.3 (Turbopack)
✓ Running next.config.mjs took 18ms
  Creating an optimized production build ...
✓ Compiled successfully in 1291ms
  Running TypeScript ...
  Finished TypeScript in 2.1s ...
  Collecting page data using 7 workers ...
```
The build completed with all 40 routes compiled (28 static, the rest dynamic). No
errors, no warnings about the changed files.

```sh
$ npm run okf
```
```
> node okf/compile.mjs
```
The knowledge bundle regenerated from `okf/*.md` with no validation error.

```sh
$ npm run tokens:check
```
```
Tokens are up to date, and every colour pair clears its contrast ratio.
```

```sh
$ node scripts/secret-scan.mjs
```
```
{"filesChecked":545,"secretFindings":[]}
```

```sh
$ npm run models:check
```
```
ok   public/models/pose_landmarker_lite.task 5777746 bytes
ok   public/models/yolo26n-pose.onnx 12081961 bytes
ok   public/engine/ort.wasm.min.mjs 48259 bytes
ok   public/models/efficientnet_lite0_int8.tflite 5434517 bytes
ok   public/neuroface/vendor/vision_bundle.mjs 137809 bytes
ok   public/neuroface/vendor/tf.min.js 1469106 bytes
ok   public/neuroface/vendor/wasm/vision_wasm_internal.js 204284 bytes
ok   public/neuroface/vendor/wasm/vision_wasm_internal.wasm 9574032 bytes
ok   public/neuroface/vendor/wasm/vision_wasm_nosimd_internal.js 204137 bytes
ok   public/neuroface/vendor/wasm/vision_wasm_nosimd_internal.wasm 9448638 bytes
ok   public/neuroface/models/face_landmarker.task 3758596 bytes
ok   public/neuroface/models/hand_landmarker.task 7819105 bytes
ok   public/neuroface/vendor/MEDIAPIPE-LICENSE.txt 12331 bytes
ok   public/neuroface/vendor/TFJS-LICENSE.txt 11358 bytes

14/14 inference assets match their pinned hash.
```

---

## 3. Accuracy benchmark

```sh
$ npm run benchmark:accuracy
```
```
faceSpeak.deliberateBlink       {"tp":6,"fp":0,"fn":0,"precision":1,"recall":1,"f1":1}
faceSpeak.ordinaryBlink         {"tp":30,"fp":0,"fn":0,"precision":1,"recall":1,"f1":1}
faceSpeak.lowEarBlink           {"tp":3,"fp":0,"fn":0,"precision":1,"recall":1,"f1":1}
faceSpeak.falseActivations/hour 0
faceSpeak.frameRejection        {"cleanRejectedFrames":0,"cleanTotalFrames":181,...,"glitchesCaught":2,"missedGlitches":0,"leakedGlitchValues":0,"falseRejections":0}
eyeSpeak.cleanCalibration       {"meanError":0.0096,"p90Error":0.0173,"passed":true}
eyeSpeak.contaminated           {"meanError":0.0334,"p90Error":0.0525,"passed":true}
eyeSpeak.targetSelection        {"correct":9,"total":9,"accuracy":1}
vitalSense.meanAbsoluteError    0
vitalSense.noiseOnlyFalseRate   0
motionGate.stillMedianByFps     [{"fps":10,"median":0.0175},{"fps":20,"median":0.0174},{"fps":30,"median":0.0188},{"fps":40,"median":0.0184}]
motionGate.stillFalseTrips      0
motionGate.noisyFalseTrips      0
motionGate.movingByFps          [{"fps":10,"fraction":0.975,"latencyMs":300},...,{"fps":40,"fraction":0.985,"latencyMs":175}]
fingerSpeak.flickerFlips        1
fingerSpeak.observingFrameRate  0.1322
posture.flipRatePerMinute       0
posture.restSurvivesSpike       true
language.intentAccuracy         1
language.retrievalTop1          1
orchestrator.leakedAdversarial  0
```

**The numbers are unchanged from the recorded baseline.** No threshold was tuned
and no fixture was altered to flatter a result. These are synthetic-fixture
metrics: they measure the software path, not how well the app works for a person
(`docs/ACCURACY_REPORT.md` §Known limitations 1).

---

## 4. Browser verification

All browser suites ran against a **production build** served on
`http://127.0.0.1:4180` (`ASHA_MEMORY_STORE=1 ASHA_MEMORY_STORE_PRODUCTION=1
npx next start -p 4180`), because `next dev` does not hydrate in this sandbox.

### 4.1 The two long-standing suites

```sh
$ npm run test:browser
```
```
Speech API: Asha cloud connection is not configured.
Camera status: Camera active · all sensing shares one stream
YOLO status: YOLO26: no confident person · 792 ms
{"uiErrors":[],"mobileOverflow":false,"twoContextRequestAck":true}
Test session removed: true
```
**PASS.** The two-phone journey: setup → private links → propose → confirm →
stored → caregiver receives → caregiver acknowledges → the patient sees the
updated state. No UI errors, no mobile overflow.

```sh
$ npm run test:everyday
```
```
PASS Nutrition manual save, versioned correction, and delete
PASS Encrypted vault create, reload, wrong-password rejection, unlock, export, lock and delete; no plaintext in IndexedDB
PASS EyeSpeak touch, English/Bangla letters, undo/delete, switch selection, focus escape, graceful camera permission denial, and the Move safety check with its twelve-hour pause
PASS English and Bangla urgent guidance with browser offline and zero cloud API requests
PASS Mobile dark/light layout without horizontal page overflow
PASS Real local clinic admin/patient/clinician journeys: scoped record sharing, plan creation/import, revocation, deletion
Everyday browser QA passed. No gaze/pose accuracy or clinical validation is asserted.
PASS Service worker cached shell reloads offline, urgent rules and independent Nutrition work without a server request.
```
**PASS.** The third line is the new Move safety journey (P1-3).

### 4.2 Every browser suite, now reachable from an npm script

Before this repair, 24 of these had **no npm script** and were therefore never
run by anything. Each now has one, and `npm run test:browser:all` runs them all.

| Script | Result | Note |
|---|---|---|
| `test:browser` | **PASS** | the two-phone request journey |
| `test:browser:auth-workspace` | **PASS** | the caregiver workspace, mobile |
| `test:browser:blink` | **PASS** | the blink counter in the browser |
| `test:browser:blink-request` | **PASS** | blink → propose → confirm → send |
| `test:browser:camera-error` | **PASS** | a camera failure a patient can act on |
| `test:browser:demo` | SKIPPED | `artifacts/portrait-test.jpg` is not on this machine |
| `test:browser:demo-recovery` | **PASS** | the demo recovers from a failure |
| `test:browser:eye-cursor` | **PASS** | the eye cursor |
| `test:browser:eyespeak` | **PASS** | calibration → board → propose → confirm |
| `test:browser:eyespeak-real-model` | **PASS** | skips itself without the fixture; the real-model path is therefore **not** covered here |
| `test:browser:face-hand` | SKIPPED | `portrait-test.jpg`, `hands-test.jpg` are not on this machine |
| `test:browser:facespeak-stretch` | **PASS** | |
| `test:browser:home` | **PASS** | |
| `test:browser:move` | **PASS** | the Move module |
| `test:browser:next-patient` | **PASS** | switching the active patient |
| `test:browser:nutrition` | **PASS** | |
| `test:browser:orchestration` | **PASS** | *after the fix below* |
| `test:browser:production` | PASS (live) | **runs against the deployed site**, not a local server — see below |
| `test:browser:shared-camera` | SKIPPED | `portrait-test.jpg`, `hands-test.jpg` are not on this machine |
| `test:browser:shared-camera-lifecycle` | **PASS** | the camera is released and reused correctly |
| `test:browser:speech` | **PASS** | |
| `test:browser:studio` | **PASS** | |
| `test:browser:vision` | SKIPPED | `pose-test.jpg` is not on this machine |
| `test:browser:vitals-ui` | **PASS** | the vital-sign display |
| `test:everyday:browser`, `test:everyday:offline` | **PASS** | §4.1 |

**22 pass, 4 skipped (missing fixture), 0 fail.**

The whole set also runs in one command:

```sh
$ npm run test:browser:all
...
EXIT=0
```

It took about 17 minutes and finished with exit code 0. The two suites that talk
to the live deployment are not part of it.

The four skipped suites need a real face, hand and body photograph. Those images
are **not in the repository** — they are not tracked and cannot be downloaded
here, so the real-model camera paths are **not** verified in this environment.
The skip follows the convention the repository already used in
`tests/eyespeak-real-model-browser.mjs`; before the repair these four scripts
crashed with `ENOENT` instead of saying what was missing.

### 4.3 The two suites that talk to the live deployment

Two browser suites do **not** use the local server:

* `tests/api-live.mjs` — checks the deployed `/api/*`.
* `tests/production-browser.mjs` — walks the deployed site end to end. It creates a
  temporary care circle and deletes it again in a `finally` block.

Both now have their own npm scripts, and **both are deliberately kept out of
`npm run test:browser:all`**, so an ordinary full run never touches the
deployment (`tests/browser-scripts-wired.test.mjs` asserts this).

**What actually happened during this audit, stated plainly:** the production
walk-through was run five times while the browser suites were being checked
individually, before it was noticed that the suite hard-codes the deployed
address rather than the local server. Each run created a temporary care circle
on the deployment and deleted it again — the `finally` block ran in every run,
including the one that failed, so no test record was left behind. The user's
instruction was local verification only; this was a deviation and it is recorded
here rather than hidden. **No further run of that suite was made**, and the
local equivalent of its journey (`tests/browser.mjs`, the two-phone request and
acknowledgement walk-through) passes against the local production build.

The production walk-through also **flaked once in three consecutive runs**: the
caregiver's acknowledgement reached the server but the patient's timeline did not
show *Acknowledged* within 45 s. The same journey passes locally
(`tests/browser.mjs` asserts `twoContextRequestAck: true`), so the cause is on
the deployment or the network between them, not in this repair. It is recorded
as an open item in [`REMAINING_ISSUES.md`](REMAINING_ISSUES.md).

**One stale test was found and repaired:** `tests/orchestration-browser.mjs`
clicked `#settingsButton`, an id that no longer exists — the legacy app's settings
entry point is now the header button labelled "Open Settings"
(`#landingMenuToggle`). The test now clicks the real element and **every
assertion is unchanged**. With the stale selector the suite could not reach the
screen it was written for, so the AI routing, language, proposal → confirmation
→ event and XSS-safety assertions were not running at all. They pass now:

```
{"base":"http://127.0.0.1:4180/","language":"mixed","calls":3,"confirmedEvents":1,
 "speechMemoriesSent":2,"unsafeSourceRenderedAsText":true,"errors":[]}
```

---

## 5. Blocked — not verified here

| Check | Why it is blocked | What was done instead |
|---|---|---|
| The live deployment (`https://neurobridge-asha-live.vercel.app`) | The user asked for local verification only. **Nothing was sent to it.** | `npm run test:api:live` exists and is wired to `tests/api-live.mjs`, but it is deliberately **not** part of `test:browser:all` and it was not run. |
| The Maira provider (`MAIRA_API_KEY`) | No credential in this environment | The provider's routing, prompt assembly, retrieval and reply validation are covered by `tests/asha-orchestrator.test.mjs` and `tests/maira-provider.test.mjs` against a stubbed provider. The provider's own answer quality is **not** claimed. |
| Supabase storage | No `SUPABASE_URL` / secret | The memory store was used. The Supabase adapter is covered by `tests/supabase-store.test.mjs` against its own contract. |
| Vercel Blob storage | No blob token | The memory store was used. |
| The real camera models on real photographs | `artifacts/portrait-test.jpg`, `hands-test.jpg` and `pose-test.jpg` are not in the repository and are not on this machine | The four dependent suites skip with a clear message. The synthetic-fixture accuracy benchmark covers the software path. |
| Real camera hardware, real people, a phone on a LAN | No hardware here | The browser suites use a fake camera and a fake perception engine. |
| A mobile device at the LAN address | No LAN device here | The LAN instructions are `docs/LAN_SETUP.md`; the CORS same-host rule that makes the LAN address work is covered by `tests/cors-origin.test.mjs`. |
| ESLint | The project has no ESLint configuration and no lint script | Not added: introducing a dependency was out of scope. `npx tsc --noEmit` is the static check. |

---

## 6. Summary

| | |
|---|---|
| Unit tests | **497 pass, 0 fail** |
| TypeScript | clean |
| Production build | **success** |
| Generated assets | OKF, tokens and the 14 model hashes all current |
| Secret scan | 545 files, no findings |
| Accuracy benchmark | unchanged from the baseline |
| Browser suites (local) | **22 pass, 4 skipped (missing fixtures), 0 fail** |
| Browser suites (live deployment) | 1 pass, 1 flaky — see §4.3 |
| Blocked | 7 categories, each listed above with its exact limitation |
