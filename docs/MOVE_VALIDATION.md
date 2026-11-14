# ASHA Move implementation and validation

## Implemented behavior

`public/app/everyday/move.js` mounts the movement workspace through the shared Everyday camera service. It requests the existing MediaPipe Pose Landmarker Lite task and closes the camera when paused, when the page is hidden, or when the module unmounts. The module owns no second camera stream or inference loop.

Four movement counters are implemented.

| Movement              | Observed angle       | Camera placement and additional requirement                                                                 |
| --------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Seated knee extension | Hip–knee–ankle       | Side-on at knee height, seated on a stable chair                                                            |
| Elbow flexion         | Shoulder–elbow–wrist | Side-on to the working arm, upper arm held still                                                            |
| Shoulder flexion      | Hip–shoulder–elbow   | Side-on, upper arm visible, comfortably straight elbow                                                      |
| Sit to stand          | Hip–knee–ankle       | Side-on with shoulder, hip, knee and ankle visible, including a clear hip rise before the return to sitting |

Angles are camera-plane estimates with image aspect ratio restored. They are not calibrated clinical joint measurements. The default practice thresholds are software starting settings that the user can adjust to a comfortable movement. Rehabilitation requires a matching clinician-origin plan with clinician name, approval timestamp, movement and side. The module accepts explicit plan limits and repetitions from that plan. A clinician-origin field records where the plan came from. Qualification and clinical approval are controlled by the surrounding clinic workflow.

Task-specific landmark visibility and presence must reach 0.65, and required joints must lie inside the camera frame. A second person is rejected when the shared camera supplies `personCount > 1`. A confidence-aware One Euro filter resets after an invalid observation or a gap over 400 ms. The repetition state machine requires an observed start, target hold, and return. Holding a position, starting at the target, a short threshold crossing, tracking loss and an incomplete return cannot independently add a repetition.

Saved sessions include exercise, working side, observed repetitions, completed sets, practice limits, observed angle range, valid and invalid frame counts, observation time, camera-active duration, model version and clinician plan ID when available. They use `source: camera_estimate`, `units: session`, `correction_status: unconfirmed` and `consent_scope: move`. Raw video is not stored. History supports deletion and JSON export. Adjacent sessions show repetition counts and a reminder to use the same camera placement and limits when comparing.

## Reused model and source records

- Existing asset `models/pose_landmarker_lite.task`.
- Pinned source `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`.
- Existing recorded size 5,777,746 bytes.
- Existing recorded SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
- Official task documentation `https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker` describes 33 image and world landmarks, video input and monotonic timestamps.
- Runtime/model provenance is inherited from `models/manifest.json` and `neuroface/vendor/manifest.json`. No new model weights or inference runtime dependency were installed by this module.

## Checks completed

Run `node --test tests/everyday-move.test.mjs` from the repository root. Thirteen checks passed during implementation.

1. Aspect-correct angle geometry and degenerate-point rejection.
2. Required joint confidence, framing and supplied multi-person rejection.
3. Complete cycles for each of the four exercises.
4. Target-first startup and incomplete movement rejection.
5. A held target cannot create repeated counts.
6. Threshold jitter cannot satisfy the target hold.
7. Occlusion and camera gaps discard incomplete repetitions.
8. Sit-to-stand needs hip rise as well as knee extension.
9. Filter state resets after tracking loss.
10. Invalid practice and clinician thresholds are rejected.
11. Rehabilitation plans require a matching movement and clinician-origin metadata.
12. Generated landmark sequences produce provenance-bearing session records and exclude a paused interval from observed time.
13. Camera-frame duration and valid-observation time remain separate when joints are occluded.

These checks use generated angles and landmark trajectories to test geometry, state transitions and records. Browser integration and target-phone inference are separate checks. No joint-angle error, repetition-count error, battery drain, temperature rise or target-device FPS has been measured by this module.

## Required participant and reference evaluation

- Compare counted repetitions with independent video annotations. Report count MAE, incomplete-repetition sensitivity and false repetitions per observed minute.
- Compare angles and ranges with a goniometer or motion-capture reference under predefined camera placement. Report bias, absolute error and limits of agreement per exercise.
- Separate people and recording sessions between development and evaluation. Include comfortable movement ranges and intended mobility levels.
- Test front, side and partly turned cameras, occlusion, loose clothing, varied lighting, glasses where relevant to setup, and other people entering the view.
- Report the proportion of frames and complete attempts rejected for quality alongside accuracy on accepted observations.
- Measure cold/warm startup, p50/p95 frame latency, FPS, memory, battery and thermal behavior on physical low-cost Android phones, then supported iOS and desktop browsers.
- Have a qualified clinician define rehabilitation limits and review the intended workflow before rehabilitation use. Pose-derived movement does not establish pain, muscle force, bone health or recovery.

## Move V2 in the Next.js dashboard (`/dashboard/patient/move`)

Move V2 is a goal-based, sequential exercise module in the patient dashboard. The Everyday Move workspace above is unchanged.

**Structure.** Explore (8 categories and a searchable library), a one-question-at-a-time goal wizard, My plan (editable plan, weekly schedule, clinician tasks), Live session, Progress, Settings & safety, and Clinician programs. Code lives in `src/features/move/`:

| File | Role |
| --- | --- |
| `catalog.js` | Versioned exercise library (`CATALOG_VERSION`), categories, goals with honest clarifications (facial fat, jawline, belly fat, rapid weight loss), templates, `recommendProgram`, `validateProgram`, `importClinicianProgram` |
| `detectors.js` | Deterministic rep detectors. Pose: squat, chair squat, sit to stand, wall push-up, arm raise, plus clinician-angle knee extension, elbow flexion and shoulder flexion. Face: smile, eyebrow raise, cheek puff (experimental), each calibrated to the person's neutral face |
| `safety.js` | Rule-based safety screen, English/Bangla/Banglish symptom rules (chest, breathing, fainting, stroke signs, palpitations, dizziness, pain), lockouts, clinician clearance and attestation |
| `session.js` | Workout state machine: `NOT_STARTED → PRECHECK → WARM_UP → (LEARN → CAMERA_SETUP → PRACTICE → EXERCISE → REST)… → COOL_DOWN → SUMMARY → COMPLETED`, with `PAUSED`, `TRACKING_LOST`, `SAFETY_STOP`, `CANCELLED`. Set-up and practice are only for camera-counted exercises. A saved session from before this change (`NEXT_EXERCISE`) resumes at `LEARN` |
| `lessons.js`, `demo.js` | Bilingual lesson for every exercise and its original animated demonstration (see "Guided lessons and live tracking" below) |
| `tracking.js` | Landmark checks: per-exercise visibility, statuses, lighting, the model router, overlay projection |

**Counting rules.** A repetition is one observed start → target (held) → return cycle with dwell, hysteresis, a 20 s maximum and a 700 ms gap reset. Shallow movements are reported as partial and not counted. Squats need hip descent and sit to stand needs hip rise. Pose landmarks need visibility ≥ 0.6 and must be inside the frame; more than one person is rejected. Face counting pauses when the face is lost or head yaw/pitch exceeds 20°. Nothing is counted before a usable view has been seen for 1 s, nor during warm-up, rest or cool-down. After 1 s without a usable view the session enters `TRACKING_LOST` and announces "Can't see your movement; reposition camera." Clinician plans supply their own angles and side. Manual counting is always available and is recorded as manual.

**Shared camera.** On the Live session page the engine (module `move`) emits a `landmarks` event for every face-model frame, and the model router decides which models run at full rate (below). Leaving the page returns it to the companion cadence. While a workout runs, smiles, face commands, hand poses and cues are not read as AAC requests; the deliberate blink request and on-screen buttons still work.

**Safety.** Before every workout the "right now" symptom question is asked; other conditions are asked unless the person chose to remember them. Warning symptoms (or "not sure") stop the session with urgent guidance (call 999 in Bangladesh) and lock Move for 12 hours. The lock can be lifted early only by recording a named clinician assessment, no sooner than 30 minutes after the stop, and the record is kept. Dizziness or palpitations stop and rest with a 15-minute pause. Known heart conditions, clinician limits, recent surgery/injury/falls and pregnancy require a recorded (self-reported) clinician clearance; with clearance, workouts are beginner level with at least 2-minute warm-up and cool-down. No message says people with heart conditions should not exercise. Symptom rules ignore any other input, so no model output can override them.

**Clinician programs.** Plans are read from `/api/clinic` with the patient's private invitation. The server enforces role, tenant and the patient's `move` sharing consent on each read. Clinician plans are locked from patient editing. Local files are not accepted as clinician plans.

**Data.** Plans, schedule, history, clearance, lockout and consent audit are stored on the device under `asha_live_move_v2`, with JSON export and delete. A running workout is saved and comes back paused after a reload. Summaries contain counts, holds, sets, active minutes, effort (0–10) and how the person felt. No calories, body-fat or vital-sign values are produced.

**Checks run.** `node --test tests/move-*.test.mjs` (detectors, safety, catalog, session) and `node tests/move-browser.mjs` against `next dev` (wizard, honest goal note, camera setup gate, counted and shallow reps, tracking loss and announcement, reload resume, chest-pain stop and lockout, face routine to summary, Bangla dizziness text, 390 px layout). Detector inputs are generated landmark and blendshape sequences, not recorded video. Rep accuracy against reference video, hold timing error, facial-matching sensitivity/specificity and on-phone FPS/battery have not been measured. No licensed demonstration media is bundled yet.

## Guided lessons and live tracking (Move V4)

Every exercise now runs **Learn → Set up → Practice → Do → Rest**, then the summary. Exercises the camera can't count skip set-up and practice.

**Learn.** An original animated demonstration drawn in SVG (`demo.js`, `move-demo/1.0.0`) loops for 5–15 s with captions that change with the movement. Captions are in English and Bangla (`lessons.js`, `move-lessons/1.0.0`). Voice never starts by itself: narration begins only after "Play voice". With reduced motion, two still key poses are shown instead. The panel shows the goal, where the camera goes (icon and sentence), the first steps, what you need, an easier option, common mistakes and the safety stops. No lesson promises a body change.

**Set up.** The camera turns on here, at the person's tap, not at the start of the workout. A dashed outline (body, upper body, face oval or hand) turns green when the needed landmarks are seen. A list shows each needed point as seen, unclear or out of view, plus lighting (too dark below mean luma 0.12, too bright above 0.9). There is a switch-camera button when the device has more than one camera, and a mirror toggle. Practice can start only after a usable view has lasted 1 s. If the camera can't start (for example, permission refused), the page says "Camera unavailable. You can log the workout manually." and manual counting carries on.

**Practice.** One or two tries (two for arm raise) are praised out loud and shown as "Practice 1 / 1", and never counted. Holds count as practice after 2 s in position. "Start counting" stays disabled until the view is usable, including after a pause. Practice itself can be skipped.

**Do.** A large counter, a progress bar and one correction at a time on the video: tracking lost first, then the set-up hint if the view isn't ready, then the detector's cue (in Bangla when chosen). The overlay draws only the measured joints, aligned to the video's crop, mirroring and device pixel ratio. "Show me again" opens the demonstration and pauses counting while it plays. "+1 (camera missed one)" is recorded as the person's entry. Vibration on each count is optional and off by default. A toolbar with Pause, End and a red "Stop for symptoms" stays at the bottom of the screen.

**Rest.** A timer, the next exercise with its demonstration and key tip, "Rest 30 s longer", and "Next". Rest ends by itself only if "Go on automatically when rest ends" is ticked; otherwise it waits.

**Summary.** Each exercise shows camera estimates and the person's own entries separately (for example "6 camera estimate · 2 your entry"), partial movements not counted, whether practice was done, and the share of camera frames with a clear view and how often tracking was lost. These are about what the camera could see, not how well the exercise was done. If the workout is ended mid-set, the reps already done are kept, but the set isn't counted as finished. The camera is turned off when the workout ends, stops for safety or switches to manual, if Move was the one that turned it on.

**New camera exercises (experimental).** Calf raise (heel lift measured against the person's own flat-foot value learned in the first 0.8 s, side view), finger opening (fingertip reach from the wrist in palm lengths, one hand at a time, either hand) and supported plank (the timer runs only while a straight shoulder–hip–knee line is seen at an incline, from the camera's frame timestamps). They are labelled "experimental" in the session and summary.

### Pipeline

1. `public/engine/perception.js` runs the face model on every frame in one worker, with the pose model in the same worker at the router's period. Hands run in a second worker. Frames are never uploaded.
2. On the Move page the engine emits `landmarks`: up to 33 pose, 478 face and 2 × 21 hand points, each modality with the timestamp of the frame it came from, the person count, head yaw/pitch, blendshapes, handedness, model time and a 16×12 luma sample every 500 ms. Nothing is interpolated; a missing modality is null or empty.
3. `assessFrame` (`tracking.js`) decides the status for the current exercise and the one hint to show.
4. The exercise's detector reads only its own modality (`poseInput`, `faceInput` or `handInput`). Each model result is used once.
5. `WorkoutSession.observe` counts only in `EXERCISE`, praises in `PRACTICE`, gates framing in `CAMERA_SETUP`, and logs `SessionEvent`s with their source (camera, user, system), capped at 500 per workout.

### Statuses

| Status | Meaning | Label shown |
| --- | --- | --- |
| `READY` | Every needed landmark is visible (visibility ≥ 0.6) and inside the frame, one person, lighting OK | Live on-device tracking |
| `NO_PERSON` | The needed model returned nothing | Tracking uncertain |
| `PARTIAL_VIEW` | Some needed points are outside the frame (hint says which way to move) | Tracking uncertain |
| `LOW_CONFIDENCE` | Points unclear, more than one person, head turned more than 20°, hand too small, or too dark or bright | Tracking uncertain |
| `TRACKING_LOST` | Frames older than 1 s, or none | Tracking uncertain |
| `OFF` | Camera off | Camera off |
| (manual mode) | Counting by hand | Manual mode |

### Model router

ASHA keeps its three shipped models and runs only what the exercise needs at full rate. Face always runs, so the deliberate blink request for help keeps working during a workout.

| Exercise kind | Pose | Hands | Face |
| --- | --- | --- | --- |
| Body | every 50 ms | slow (250 ms) | every frame |
| Face | slow (500 ms) | slow (250 ms) | every frame |
| Hands (finger opening) | slow (500 ms) | fast (16 ms) | every frame |
| "Show all detected landmarks" | every 50 ms | fast | every frame |

"Holistic" in ASHA means these three together (at most 553 points). The MediaPipe Holistic model was measured and not shipped; see `docs/MOVE_TRACKING_BENCHMARK.md`.

**Mirroring** is display only. The detectors read the raw, unmirrored frame, so the mirror toggle never changes a count (`tests/move-tracking.test.mjs` checks this). MediaPipe's hand labels assume a mirrored image, so "left" and "right" may be swapped; finger opening therefore accepts either hand and stays with the one it picked.

### Privacy review

- Video frames, landmarks and blendshapes stay in the browser. Nothing from the camera is uploaded, saved or put in logs. The overlay canvas is drawn from landmarks in memory and is cleared every frame.
- Saved on the device only: plan, workout state, counts by source, practice done, clear-view share and tracking-loss counts. No images, no landmarks, no face data.
- The camera starts only when the person taps "Turn on camera" in set-up, and Move turns it off again when the workout ends, stops for safety or switches to manual (if Move started it). If the shared camera was already on for other features, Move leaves it on.
- The consent audit records only whether a workout used the camera on the device or manual counting.
- Narration and vibration are off until chosen. Speech uses the browser's own voices.

### Checks run

- `npm test`: 293 unit tests pass, including `tests/move-tracking.test.mjs` (projection, mirroring, statuses, router, the new detectors, every lesson and demo) and the rewritten `tests/move-session.test.mjs` (the guided flow, practice not counting, rest waiting or going on when chosen, camera-timed holds, tracking loss, reload, manual mode, emergency stops in every step, unfinished sets).
- `node tests/move-browser.mjs` against `next dev` passes four runs. (1) Wizard → warm-up → learn → set-up gate → practice → counted and shallow reps → tracking loss spoken → reload → chest-pain stop and lockout, with camera and manual counts kept apart. (2) A face routine: demo replay, voice only after "Play voice", the router asking for no body or hand model, demo pausing practice, show-all drawing all 478 face points, the mirror toggle, the summary by source, and the camera off at the end. (3) A Bangla phone run (390 px) with the camera permission refused: manual logging and End. (4) Every Move page at 390 px.
- `npx tsc --noEmit` and `npx next build` pass.
- Benchmark: `docs/MOVE_TRACKING_BENCHMARK.md`.

### Limitations and unfinished work

- All counting tests use generated landmark sequences, and the benchmark uses two still images. Nothing has been measured against labelled video of real people, on phones, or with people who have movement or facial difficulties.
- The new detectors (calf raise, finger opening, plank) and cheek puff are experimental and need real-world tuning.
- The demonstrations are original line drawings, not filmed or clinically reviewed. Bangla captions and spoken announcements need review by a native speaker with clinical wording.
- Announcements use the browser's speech voices; a Bangla voice isn't on every device.
- Camera switching depends on the browser exposing more than one camera. The back camera is shown unmirrored.
- Lighting is a coarse average of the whole frame, so a bright window behind a well-lit person can still read as "too bright".
- The Holistic model isn't shipped (see the benchmark). Phone FPS, battery and heat haven't been measured.
- No form scores, calories or medical judgements are produced, and none should be added without validation.

