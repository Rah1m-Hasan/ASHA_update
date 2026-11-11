# Validation and evidence

The approved static Everyday release `6f11e60` is deployed and verified. The Next.js merge is currently local; its release evidence must be recorded separately from that earlier production verification.

Automated and local engineering checks:

1. `npm test` — the pre-migration baseline contains 233 passing tests, covering blink observations/intent confirmation, facial baseline, head returns, hand profiles/two-hand geometry, caregiver rules, RAG/tool verification, speech echo blocking, private Blob consistency and VitalSense signal windows. Migration adds four `tests/next-api.test.mjs` regressions: adapter request bounds/JSON errors, urgent Asha/Care before storage/auth/cloud, valid Clinic sharing beyond the standard 20k cap with accurate local-memory labeling, and authenticated Everyday retention. `tests/clinic-storage-mode.test.mjs` checks that production ignores the preview flag and does not claim local storage. Final compatibility additions and aggregate count are pending the completed integration report.
2. `node tests/everyday-browser.mjs` — passed before migration: real local Clinic API journeys in separate admin/patient/clinician browser contexts; independent modules; Nutrition save/versioned correction/delete; vault create/reload/wrong-password/unlock/lock/export payload/delete and ciphertext inspection; EyeSpeak touch/Bangla/English letters/undo/switch/focus; permission denial; offline urgent UI with zero AI requests; dark/light mobile layout; no page errors. Rerun against the Next dev server at `http://127.0.0.1:4180` with development memory storage enabled.
3. `node tests/everyday-offline.mjs` — passed before migration: service-worker install, offline shell reload, local chest-symptom guidance and independent Nutrition navigation without server connectivity. Rerun with the relocated `public/app/everyday` shell and `/engine/speech-capture.js` dependency.
4. `node scripts/everyday-benchmark.mjs --browser` — verified installed face/pose SHA and byte counts and ran real CPU/WASM inference before migration. The script now reads from `public`; rerun inventory/browser checks against Next. See `MODEL_BENCHMARKS.md` for the historical workload and limits.
5. `npm run build` — a complete production build passed after the initial sandbox filesystem `EPERM` required a rerun outside that restriction. Use `npm run start` with the normal private store/provider configuration for production-mode checks; the development memory flag is intentionally ignored in production mode.
6. Verify the React chooser at `/`, `/dashboard`, `/everyday.html`, `/assistive.html`, old `/app` and module/role URLs, private-link fragments, request/receipt flow, mobile navigation and service-worker upgrades. Confirm APIs execute locally, private results remain uncached, and missing credentials produce bounded fallback states.

The managed Chrome cancelled file-system downloads. QA therefore verified the actual JSON export through the product's copyable export fallback, plus deletion, instead of claiming an OS file was saved. Screenshots and report JSON are local ignored `artifacts/` outputs. Browser camera-denial tests and synthetic feed benchmarks do not validate human pose/gaze accuracy. Physical-phone clinical/usability testing remains pending.

Production smoke evidence for `6f11e60`:

- Supabase-backed Clinic: create/invite, explicit scoped sharing, a self-attested clinician plan and revocation all completed.
- Asha and Care returned local urgent guidance without account credentials; no provider call was needed for urgent reports.
- Nonurgent Care generated a real MAIRA response using `gemini-flash-latest`; one observed response took 12.566 seconds. This is a smoke observation, not a distribution or performance guarantee.
- A patient water request appeared for the caregiver, acknowledgement was saved, and the patient received the receipt.
- Mobile checks covered the new Everyday routes and the retained assistive entry; a local greeting response was observed at 63 ms. These observations do not validate the new React dashboard or Next deployment.
- Anonymous test fixtures were deleted. No remote schema change or provider-profile mutation was needed.

The Next merge must repeat the relevant software flows locally and on its preview before release; prior production evidence does not substitute for migration compatibility checks.

Pending release evaluation:

| Area               | Dataset/reference and metrics required                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nutrition vision   | Licensed Bangladesh dishes; patient-independent held-out splits; top-1/top-3, macro-F1, ECE, per-dish breakdown; no activation without trained weights                                               |
| Portions/nutrition | Weighed meals, measured retained oil/salt, gram/kcal MAE, ingredient-bound interval coverage and correction rate                                                                                     |
| Move               | Independent goniometer/reference video, rep-count MAE, invalid-rep false accepts, camera angle/occlusion/lighting and limited-mobility cases                                                         |
| EyeSpeak           | Intended users and caregivers, 5/9/16 setup time, held-out target accuracy, false selections/minute, characters/minute, drift, fatigue, glasses and head/screen changes                              |
| Care safety        | Qualified clinicians author/review scenarios; Bangla/English/code switching/ASR errors/negation/contradictions; urgent recall and false-alert review, offline/no-network and model adversarial cases |
| Speech             | Consented Bangla/English/code-switch recordings; transcription/error and privacy comparison of OS ASR vs a specifically licensed optional offline pack                                               |
| Performance        | Low-end Android and supported iOS: cold/warm p50/p95, peak process RAM, sustained FPS, battery/thermal load and download failures                                                                    |
| Privacy/security   | External review of tenant isolation, capability exposure, backup/deletion behavior, provider terms, encryption, browser XSS protections and professional identity access                             |
| Accessibility      | Keyboard/screen reader, contrast, motor/fatigue needs, Bangla fonts/voices and intended-user usability; no camera-only dependency                                                                    |

Do not invent a numeric accuracy, clinical recovery score, reliable food identity, cornea precision, diagnosis or clinical clearance from these software tests. Clinical release remains gated off.
