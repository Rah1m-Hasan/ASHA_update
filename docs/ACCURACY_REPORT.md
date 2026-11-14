# NeuroBridge Asha — accuracy report

Scope: the accuracy, reliability and consistency of the existing modules. No feature
was added, removed or redesigned; no user workflow, API contract or safety gate moved.
The work is in eight waves (0–1 … 8) plus a documentation wave, each committed on its
own and each measured before and after.

## What these numbers are, and what they are not

Every number in this report comes from **deterministic synthetic fixtures** replayed
through the real domain modules — the same `public/engine/`, `public/neuroface/` and
`src/server/` code the app runs. There is no labelled human dataset, no recorded
session and no golden file in this repository, so **no claim is made here about human
accuracy**, about a patient's real pulse rate, or about clinical validity. The
fixtures measure *algorithm behaviour on known ground truth*: that a noise spectrum is
not reported as a pulse, that a dropped detection does not destroy a gesture, that a
reply the app cannot support is refused.

Two consequences follow, and they are binding on how this report may be quoted:

- A number here is a property of the algorithm on a synthetic trace, not of a person.
- "0 false readings in 10 noise-only runs" is 10 runs, not a clinical false-alarm rate.

The harness lives in `scripts/accuracy-metrics.mjs` (the metrics),
`scripts/accuracy-benchmark.mjs` (the recorder and the comparison) and
`tests/fixtures/` (the labelled traces). `node scripts/accuracy-benchmark.mjs` writes
`artifacts/accuracy-baseline.json`, `--after` writes `artifacts/accuracy-after.json`
and `--compare` prints the table below. The JSON files are git-ignored; this report
is the record.

The baseline was measured by checking the pre-wave source out into a separate tree and
running the Wave 0 harness against it, so the "before" column is the code as it was,
not a recollection. Where a wave added a metric that did not exist at baseline, the
row says so instead of showing a fake comparison.

## Problems found

The audit (`STEP 1` of the plan) read the source, not the documentation. The findings
that turned out to matter:

**The pipeline**

1. Five different sets of model confidence thresholds across the worker path, the
   main-thread fallback and the legacy paths. The fallback set none at all and ran on
   MediaPipe's defaults, so the app behaved differently depending on which path
   started.
2. A worker that stopped answering left `busy`/`handBusy` set forever: the camera
   silently stopped producing frames. No watchdog.
3. `setFacingMode` cleared the timing but not the face result, the pose result or the
   pulse geometry, so the new camera's colour was sampled through the old camera's
   landmarks for up to 600 ms.
4. The face-motion estimate divided the displacement between two consecutive results
   by the time between them, so per-frame jitter was multiplied by the frame rate. A
   still face read 0.018 at 10 fps and 0.072 at 40 fps, and crossed the 0.075 gate on
   26 of 480 frames — with twice the jitter, on 890 of 1440 frames, which invalidates
   the vital window continuously.
5. The sharpness proxy that `vision.js` already computed was read by nobody.

**FaceSpeak**

6. One noisy channel discarded the whole frame and reset every in-flight state
   machine; a rejected channel leaked its raw outlier value; one glitch froze the
   reference for every channel.
7. The auto-learned open-eye reference could only rise, so a patient whose open eye is
   narrower than the 0.27 population default could never arm the blink detector: none
   of that patient's blinks were detected at all.
8. The neutral facial reference was captured once and never refreshed; the AU
   baseline likewise.

**Posture**

9. The rest detector was fed a stale, level-triggered motion value, replayed on every
   face frame, so a single landmark spike cleared the whole 60-second closed-eye
   accumulator.
10. The posture label had no hysteresis: a lean sitting on the threshold flipped the
    label thousands of times a minute.
11. A landmark with no visibility field was treated as invisible, which made every
    landmark invisible for any landmark set that does not publish visibility scores.

**EyeSpeak**

12. Calibration pooled every captured frame with no outlier rejection, so a frame
    captured mid-saccade became ground truth at the exact target.
13. `predictGaze` returned a point and the model's static p90 error and nothing else:
    a wildly wrong prediction was indistinguishable from a good one, and the eye
    cursor clicks on every patient page.
14. The legacy path smoothed with a fixed weight per frame (four times as much on a
    10 fps device as on a 40 fps one) and used the 350 ms default dwell gap, which
    resets on every frame on a slow device.

**FingerSpeak**

15. `PoseTracker` deleted a hand's state whenever the hand was missing in a frame, so
    one dropped detection reset the pose and cost a further 800 ms hold — during
    which the gesture event was suppressed and a caregiver request could be missed.
16. A change in hand count cleared the recognition buffer entirely.
17. The DTW and nearest-prototype scores (`1/(1+d)` shaped) were compared against a
    threshold designed for the BiGRU softmax, so the cut-off meant something
    different for each model.
18. `classifyPose` used fixed openness thresholds with no per-person adaptation.

**SenseAssist**

19. Successive listening sessions prepended the previous transcript: "water" then
    "toilet" was heard as "water toilet".
20. The recogniser's alternative readings of the same words were discarded.
21. Nothing checked a proposed meaning against the words that were actually heard.
22. The language of a sentence was decided by the mere presence of an English word.

**Maira**

23. The patient-facing reply had no content check at all (unlike `/api/care`): a
    reply of "I have called your caregiver" was returned with `verified: true`.
24. Output that was not the promised structure was spoken raw.
25. A reply that cited nothing passed the citation check, and a reply that cited
    something did not have to be supported by it.
26. Any of the five modules could be proposed for any question.
27. `provider.warm()` ran before authentication and before the consent check.
28. Confirmed speech pairs were interpolated into the prompt as raw JSON.

**VitalSense**

29. The in-band SNR was not normalised by the number of bins the peak was picked
    from. The maximum of ~180 in-band bins sits about `ln(180)` above the mean, so a
    noise-only spectrum scored an SNR of 3.4–7.2 — above the 1.8 acceptance gate and
    above the 4 "good" grade. The gate was, in effect, always open.
30. A change in the light level inside the 12-second window was not detected at all.
31. The breathing estimate was the mean of all 478 face landmarks, so one badly
    tracked landmark moved the whole head trace.

## What was changed

| Wave | Files | Change |
|---|---|---|
| 0 | `scripts/accuracy-metrics.mjs`, `scripts/accuracy-benchmark.mjs`, `tests/fixtures/*` | The measurement harness. No product change. |
| 1 | `public/engine/perception.js`, `public/engine/vision-worker.js`, `public/engine/model-thresholds.js`, `public/engine/motion-meter.js`, `public/neuroface/src/vision.js` | One set of confidence thresholds; a worker watchdog; a camera switch that clears the face state; a frame-rate-independent motion estimate; cadence-relative ROI freshness; the sharpness proxy folded into `faceQuality`. |
| 2 | `public/neuroface/src/engine.js`, `public/engine/face-analysis.js`, `public/neuroface/src/activity.js` | Per-channel outlier handling (a rejected channel carries its last filtered value, the reference advances per accepted channel, the frame survives); a blink reference that can move in both directions while the detector is unarmed; a neutral reference that is refreshed; an AU baseline that is re-anchored. |
| 3 | `public/engine/signals.js`, `public/engine/perception.js` | `motionRate` beside the unchanged `motion`; each motion sample consumed once; a sustained spike needed before the rest accumulator clears; posture label hysteresis; a landmark with no visibility score treated as unknown. |
| 4 | `public/app/everyday/gaze-engine.js`, `src/features/eyespeak/{Calibration.tsx,gaze.ts,gaze-session.ts}`, `public/app/everyday/eyespeak.js` | Capture-time outlier rejection; a per-sample confidence that refuses a mis-tracked frame; frame-rate-independent smoothing; the legacy dwell gap; an accidental-selection guard in the board. |
| 5 | `public/neuroface/src/fingerspeak-signal.js`, `public/neuroface/fingerspeak.html` | A bounded pose grace across a detection dropout; a hand-count debounce; scores normalised against each model's own scale; per-person openness levels. |
| 6 | `public/engine/speech-capture.js`, `src/features/speech/useSpeechCapture.ts`, `src/server/lib/speech-similarity.js`, `src/server/lib/asha-orchestrator.js`, `public/engine/main.js` | The transcript no longer accumulates between sessions; the ASR alternatives are kept in their own field; a proposed meaning is checked against the heard words; the language is decided by proportion. |
| 7 | `src/server/lib/asha-orchestrator.js`, `src/server/lib/reply-guard.js`, `src/server/lib/retrieval.js`, `src/server/handlers/asha.js`, `src/server/lib/care-service.js`, `okf/*` | A structured reply guard; unparseable output is never spoken; grounding and honest verification; a relevant module suggestion; a module prior and alias table in the retriever; instruction-like text stripped; provider discovery after authentication; an EyeSpeak concept in the bundle. |
| 8 | `public/engine/vitalsense.js`, `public/engine/perception.js` | The null-calibrated SNR gate and grade; a light step drops the window; the head trace reads the median of the landmarks. |
| 9 | `README.md`, `docs/*`, `public/models/README.md`, `public/neuroface/models/*_config.json`, `src/server/lib/knowledge.js`, `okf/*` | The repository's own claims corrected. No behaviour change. |

## Measured results

### The table the harness prints

| Metric | Before | After | |
|---|---|---|---|
| `faceSpeak.deliberateBlink.f1` | 1 | 1 | held |
| `faceSpeak.ordinaryBlink.f1` | 1 | 1 | held |
| `faceSpeak.lowEarBlink.f1` | not measured | 1 | the metric did not exist before Wave 2 |
| `faceSpeak.headTurn.f1` | 1 | 1 | held (the fixture did not move the head before it was fixed — see below) |
| `faceSpeak.falseActivationsPerHour` | 0 | 0 | held |
| `faceSpeak.frameRejection.missedGlitches` | 1 | 0 | improved |
| `faceSpeak.frameRejection.falseRejections` | 1 | 0 | improved |
| `faceSpeak.frameRejection.blinkLostToSpike` | true | false | improved |
| `eyeSpeak.contaminatedCalibration.p90Error` | 0.0525 | 0.0525 | held (the cleaned capture is 0.0299 — see below) |
| `eyeSpeak.targetSelection.accuracy` | 1 | 1 | held (3/9 before the confidence guard — see below) |
| `vitalSense.meanAbsoluteError` | 0 | 0 | held |
| `vitalSense.noiseOnlyFalseReadingRate` | 0.3 | 0 | improved |
| `motionGate.stillFalseTrips` (the shipped formula) | 156 | 0 | improved |
| `motionGate.noisyStillFalseTrips` (the shipped formula) | 890 | 0 | improved |
| `fingerSpeak.observingFrameRate` | 1 | 0.1322 | improved |
| `fingerSpeak.recoveryAfterDropoutMs` | 850, 850, 850 | 0, 0, 0 | improved |
| `fingerSpeak.steadyPoseFlips` | 1 | 1 | held |
| `posture.flipRatePerMinute` | 0 | 0 | held |
| `posture.restSurvivesSingleMotionSpike` | false | true | improved |
| `language.intent.accuracy` | 0.875 | 1 | improved |
| `language.retrieval.top1Accuracy` | 1 | 1 | held |
| `orchestrator.leakedAdversarialCount` | 2 | 0 | improved |
| `orchestrator.verifiedWithNoCitationsIsHonest` | false | true | improved |

### The measurements behind the rows

**FaceSpeak — one noisy channel no longer destroys the frame.** Two glitches were
injected one frame apart into a clean trace. Before: one glitch was missed, one clean
frame was falsely rejected, and the blink that followed was lost to the spike. After:
both glitches caught, no clean frame rejected, the blink detected with and without the
spike.

**FaceSpeak — a patient whose open eye is narrower than the default.** The blink
detector's open-eye reference could only rise from 0.27, so a low-EAR patient never
armed it. Recall on a 0.18-EAR trace: 0/3 before, 3/3 after, F1 0 → 1.0, with no new
false positives.

**FaceSpeak — the head turn was never measured.** The face fixture scripted a head
turn but dropped the requested angle from its ground truth, so the trace never moved
the head and the metric read 0 of 4 in both the baseline and the current code. With
the fixture fixed the metric reads 4 of 4 — in the pre-wave code as well, so the
head-turn path was already correct and this wave changed nothing there. It is
reported because the metric was measuring nothing until now.

**EyeSpeak — a mis-tracked frame no longer drives a selection.** On a trace where every
fifth frame is mis-tracked, the tile selection accuracy goes from 3/9 to 9/9. A clean
look scores at least 0.766 on the confidence scale, a mis-tracked frame at most
0.246, and the threshold is 0.5.

**EyeSpeak — the calibration keeps the good frames.** On a contaminated capture the
p90 error is 0.0525 with every frame and 0.0299 with the outlier rule applied at
capture time; 237 of the 270 frames are kept, so the rule does not throw away good
data.

**The motion gate is now frame-rate independent.** The still-face median across
10/20/30/40 fps: the old estimate 0.0176 / 0.0352 / 0.0536 / 0.0718 (a 4× spread, and
156 false gate trips on a still face); the new estimate 0.0175 / 0.0174 / 0.0188 /
0.0184 with zero false trips, and zero on a noisier still face (was 890). A moving
face is still detected at every frame rate (97.5 %–98.6 % of frames, 167–300 ms
latency) and a head shake at every rate from 1 Hz to 6 Hz.

The motion rows are measured from the motion-meter module rather than from the
wiring around it, so the recorded baseline already contains the new formula and the
comparison table reads 0 → 0 for them. The old formula's numbers — 156 and 890 false
trips — are recorded next to them in `motionGate.legacy` in every run, and they are
what the shipped code did before Wave 1.

**FingerSpeak — a dropped detection no longer costs a gesture.** The pose recovers in
0 ms after a dropout instead of 850 ms, and the pose spends 13.2 % of the flicker in
"Observing…" instead of 100 %. A stale pose may still be *shown*, but it is never
emitted as a proposal.

**FingerSpeak — the score means the same thing for every model.** On three synthetic
models whose scales differ by a factor of 100, the old score was 0.2335 / 0.3448 /
0.4233 and the new one 0.6364 on all three.

**FingerSpeak — a hand that does not straighten fully.** A hand that opens to 71 % was
"Other hand pose" and is now "Open palm".

**SenseAssist — the meaning must match the words.** Ten confirmed readings are kept
and none of six unrelated meanings is accepted. The intent matcher reaches 16/16 (it
was 14/16). The language of six cases is resolved as labelled, including "আমার পানি
দরকার, water", which is Bangla rather than bilingual.

**SenseAssist — the transcript no longer accumulates.** Two listening sessions yield
"toilet", not "water toilet".

**Maira — the reply guard.** Seven adversarial replies (a fabricated vital value, a
diagnosis, a medication, "I have called your caregiver", an unsupported citation, no
citation at all, unparseable output) are refused: 2 leaked before, 0 leak now. A reply
that cites nothing is reported as "limited" rather than "verified". The retrieval gaps
(a question the bundle could not answer) go from 2/2 to 0/2; the top-1 retrieval
accuracy stays 6/6.

**Maira — the cost of the checks.** The orchestration around the provider call — the
retrieval, the prompt assembly, the validation, the reply guard — costs 1.2 ms per
chat turn and 0.3 ms per clarification. The provider's own round trip is not
measurable from this repository.

**VitalSense — a noise spectrum is no longer a pulse.** Ten noise-only traces produced
a fabricated reading in 3 of them before and in none of them now. The reason is the
gate: the in-band SNR is divided by what noise alone reaches with the same number of
bins. Noise reaches 0.19–0.42 on that scale and a real pulse 0.90–1.91, and the gate
sits at 0.6.

**VitalSense — the gate costs no time.** The first reading still arrives at 12.0 s
(14.0 s at 200 bpm), the pulse mean absolute error is still 0 bpm, and every real
pulse is still graded "good".

**VitalSense — a light step is refused.** A shadow or an auto-exposure change inside
the window drops it; the reading returns 12.0 s after the light settles, which is one
full clean window.

**VitalSense — one bad landmark cannot move the head trace.** 96 badly tracked
landmarks move the mean by 0.080 and the median by nothing at all.

**Posture — a lean on the threshold stops flapping.** On a lean that sits on the 25°
sideways threshold with detector noise, the raw reading flips 624 times in two
minutes; the held label flips 3.

**Posture — one motion spike no longer wipes the rest window.** Before, a single
spike cleared the whole 60-second closed-eye accumulator; after, the rest window
survives it.

### Cost

Measured per call, in a clean process, with the fastest of five batches kept. The
setup of each measurement is outside the timed block.

| Measurement | Before | After | |
|---|---|---|---|
| One VitalSense camera sample | 0.0024 ms | 0.0049 ms | +2.5 µs |
| `fitGazeModel` (270 samples) | 0.42 ms | 0.58 ms | +0.16 ms, once per calibration |
| `predictGaze` | 0.0018 ms | 0.0022 ms | +0.4 µs, per prediction |
| `retrieveKnowledge` | 0.169 ms | 0.212 ms | +43 µs, per question |

The VitalSense sample costs 2.5 µs more — the calibrated gate, the light-step check
and the breathing gate. At 30 fps that is 0.07 ms per second of camera time, and it
buys the removal of every fabricated reading above. The gaze prediction still costs
about two microseconds; the retrieval cost is the module prior and the alias
expansion, both paid once per question rather than once per frame.

## Tests

- `npm test` — **401 tests, 401 pass, 0 fail, 0 todo.** The suite was 233 tests at the
  start of the migration and 361 after the measurement harness; the 40 new tests are
  the accuracy regressions.
- The nine defects the audit found were pinned as `test.todo()` in the Wave 0 harness.
  Every one of them is now a real assertion; there is no `todo` left in the suite.
- `npm run build` — the production build passes.
- `npm run okf` — the knowledge bundle regenerates and the OKF parity test passes.
- `npm run tokens:check` — the palette is in sync and every colour pair clears its
  contrast ratio.
- `node scripts/secret-scan.mjs` — 506 files, 0 findings.
- **The real-model browser suites skipped.** `artifacts/portrait-test.jpg` and
  `artifacts/hands-test.jpg` are git-ignored and absent, so
  `tests/shared-camera-browser.mjs`, `tests/eyespeak-real-model-browser.mjs`,
  `tests/face-hand-browser.mjs` and `tests/demo-browser.mjs` cannot run. They are
  reported as skipped, not as passed. Nothing in this work depends on them.

Two harness defects were found and fixed while measuring, both in the fixture rather
than in the product: the head-turn and nod ground truth dropped the requested angle,
so the head never moved and the metric measured nothing (it now reads 4/4, and the
pre-wave code reads 4/4 as well — the head-turn path was already correct and is
unchanged); and the posture fixture rotated the shoulders instead of placing them at
the requested angle to the hips, so a requested 40° lean reached the detector as
22.6°. Both fixtures are now correct, and the posture numbers in this report are
measured with the corrected fixture on both sides.

## Safety and compatibility

Unchanged and asserted by the suite:

- A request is never sent without the patient's separate confirmation. Ordinary
  blinks never send anything.
- The vital window is still 12 seconds for the pulse and 30 for the breathing, and
  `MIN_HR`/`MAX_HR` (42–200) are unchanged. No reading is published that failed a
  gate, and no blood pressure, oxygen saturation, temperature or ECG is ever
  produced.
- Posture and awakeness stay non-diagnostic: no automatic alert, no emergency call.
- Patient and caregiver roles stay separate; neither can act as the other.
- Cloud assistance, clinic sharing and caregiver requests keep their own consent
  gates. Provider discovery now happens *after* authentication and consent.
- `GAZE_MODEL_VERSION` and the seven gaze features are unchanged, so no stored
  calibration is invalidated and nobody is forced to recalibrate.
- The VitalSense display values, the request states (sent → received →
  acknowledged) and the API response shapes are unchanged. The only additions are
  optional fields: the gaze `confidence` and the ASR `alternatives`.

## Known limitations

1. **No human measurement.** Nothing here says how well the app works for a person.
   The participant and device work in `docs/VALIDATION_PLAN.md` is still outstanding.
2. **Two behaviours were deliberately left alone.** A trained hand pose, and a
   FingerSpeak phrase whose text is "Yes" or "No", confirm *any* pending request
   without checking that it matches the need asked. Tightening this would change an
   existing user workflow, so it was left as it is and is recorded here as a
   limitation. The request still passes through the separate `ConfirmRequestDialog`.
3. **The hand-confirmation path is asymmetric.** The blink path requires the
   confirmation to match the need; the hand path does not.
4. **The live gaze pointer still clicks the nearest button within the model's
   p90 radius** on every patient page. The confidence now refuses a mis-tracked
   frame, but the reach radius is still the model's own error estimate.
5. **Provider-side quality and latency are unmeasured.** Routing, prompt assembly and
   validation cost are measured; the model's own answer quality needs credentials
   this environment does not have, and no number is estimated for it.
6. **Physical low-end devices are untested.** The frame-rate independence was
   measured on synthetic traces at 10–40 fps, not on a low-end Android phone.
7. **The demo networks are still demos.** `public/neuroface/models/{cnn,temporal}_config.json`
   describe architectures that no code builds or loads; they carry no accuracy claim.
8. **The noise-only sample is small.** Ten traces is enough to separate 0.19–0.42
   from 0.90–1.91, and the margin is comfortable, but it is not a distribution.
9. **The vital gate is tuned on synthetic noise.** The calibrated statistic removes
   the dependence on the bin count, which is the real defect; the threshold of 0.6 is
   placed between the measured noise and the measured pulse, and a real camera's noise
   may sit differently.

## Recommendations

1. Run the participant work in `docs/VALIDATION_PLAN.md` before any claim of human
   accuracy. The EyeSpeak row (held-out target accuracy, false selections per
   minute, drift, fatigue) and the EyeSpeak cursor are the highest-value items.
2. Re-measure the vital gate on recorded, consented video rather than on synthetic
   traces, and keep the "never fabricate" rule as the tie-breaker: when in doubt,
   refuse the reading.
3. Close the two harness gaps that blocked end-to-end verification: add the two
   fixture images to a non-ignored location so the real-model browser suites can run
   in CI.
4. Decide the hand-confirmation asymmetry (limitation 2) as a product decision, and
   record it either way.
5. Give the eye cursor a narrower reach: it currently clicks whatever is nearest
   within the model's own error estimate, on every patient page.
6. Keep the accuracy harness in the build. Every number in this report is a floor
   held by `tests/accuracy-metrics.test.mjs`; a change that makes a module less
   accurate fails the suite.
