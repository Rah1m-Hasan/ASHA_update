# EyeSpeak implementation and validation

## Implemented behavior

EyeSpeak provides English A–Z input, Bangla characters, phrase tiles, word suggestions,
space/delete/undo, message speech, focus view, and single-switch scanning using Space.
Touch and switch input are independently usable. The shared camera is requested only
after a user presses a camera or calibration control. Module cleanup and backgrounding
stop the camera and cancel selection/capture timers.

The experimental gaze estimator reuses the bundled MediaPipe Face Landmarker model
and extracts iris position within each rotated eye, normalized nose position, and head
roll. Ridge regression maps these features to viewport coordinates from captured
5/9/16-point samples. Each point needs eight valid observations over at least 900 ms.
Missing frames, closed eyes, insufficient iris movement, missing iris landmarks, and
invalid geometry prevent calibration. A model with only 468 face landmarks retains
the alternate inputs and reports gaze as unavailable.

Three additional targets, separate from the fitting targets, check calibration before
dwell selection can be enabled. The current engineering thresholds are mean normalized
screen-coordinate error at most 0.06 and 90th-percentile error at most 0.09. These are
prototype gates and require user/device evaluation. They do not represent degrees of
visual angle or a validated clinical accuracy bound.

The error-ellipse rule above belongs to the retained Everyday path. The React app in
`src/features/eyespeak/` uses a different rule: a point selects a tile when it lands
inside the tile with a flat 12% margin (`tileAt`), a tile keeps the selection while the
point stays anywhere on it or crosses a 450 ms gap (`TileTracker`), and a new tile takes
over only after the point has been inside it for 220 ms. The board is chosen from the
measured accuracy: nine tiles at p90 ≤ 0.09 and mean ≤ 0.06, six large tiles at
p90 ≤ 0.16 and mean ≤ 0.11, two halves of the screen at p90 ≤ 0.26 and mean ≤ 0.18, and
no board at all when the calibration is worse than that. A gaze point whose confidence
falls below the confidence floor is treated as a lost look, not as a look at something.
Small targets may still require touch or switch input.

Dwell is adjustable from 800 to 1500 ms. The same target cannot repeat until a valid
observed look-away period. Tracking loss cancels dwell progress and does not count as
look-away. A screen resize invalidates target-check approval. Restoring a saved model
requires another target check, and saving needs an explicit remember choice. Calibration
records contain derived numeric parameters, screen size and provenance, without video.

## Verification

`node --test tests/everyday-eyespeak.test.mjs` checks:

- A known synthetic mapping is learned and recovered on separate target coordinates.
- Unchecked or poorly validated calibration cannot drive selection.
- Missing iris points, closed eyes, invalid values and out-of-domain head changes fail closed.
- All three calibration grids have the requested size and coverage.
- Dwell emits exactly once per hold, needs release and resets across gaps/reordered frames.
- A prediction reports how well it fits the calibration, and that confidence never
  changes whether the prediction is valid.
- A frame captured far from the rest of its target is not used as a frame of that target.

`node --test tests/accuracy-metrics.test.mjs` adds the measured eye numbers: the
target-selection accuracy on synthetic gaze traces, the calibration error with and
without the capture-time outlier rule, the live p90 error of the fitted model, and the
confidence guard.

Synthetic tests establish software behavior. Live gaze accuracy, selection speed,
calibration duration and fatigue have not been measured on intended users.

## Required participant and device validation

Measure target-selection accuracy, incorrect selections per minute, successful message
completion, characters per minute, initial calibration time, drift after 5/15/30 minutes,
and the percentage of frames/targets rejected by quality gates. Test glasses, lighting,
head positions, screen rotation, camera distance and varied motor capabilities on actual
low-cost Android phones and supported desktop/iOS browsers. Compare against touch and
switch scanning for the same tasks. Obtain appropriate consent and record fatigue and
caregiver assistance required. A held-out session is needed to evaluate generalization.

## Upstream source and licensing

- Official Face Landmarker guide: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
- Existing pinned runtime and model hashes: `neuroface/vendor/manifest.json`.
- Existing MediaPipe license: `neuroface/vendor/MEDIAPIPE-LICENSE.txt` (Apache 2.0).
- Custom ridge regression and dwell logic add no runtime dependency or pretrained gaze checkpoint.

The bundled model is used for landmark extraction. The user's calibration supplies the
screen mapping. No depth-camera measurement, clinical gaze precision, or cornea-cursor
claim is made.
