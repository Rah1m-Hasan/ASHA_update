# Move rep counting: public-video validation (2026-11-19)

A "virtual" check of ASHA Move's camera rep counters on public exercise video, before real volunteers. It is **not clinical validation**: the clips are young people training at speed, filmed by anyone, while ASHA is built for slower, guided movement with a set-up step. Results: `docs/validation/move-public-video-results.json`; scripts: `scripts/public-data-validation/move/`.

## Method

- **Ground truth:** Countix (DeepMind, CC BY 4.0), human-counted repetitions for Kinetics-700 clips. Clips from the Kinetics-700-2020 mirror (10 s each, YouTube-sourced; used for evaluation only, not redistributed).
- **Exercises used:** squat (90 clips), push-up (145, as a stand-in for ASHA's wall push-up: same elbow-angle signal), front raise (161, for ASHA's arm raise), lunge (152, through the squat counter). 645 clips in total, including 66 jumping-jack and sit-up clips used only to look for false counts.
- **Pipeline = the app's own:** the same MediaPipe Pose Landmarker Lite model file and options as the app (1 person, detection and tracking confidence 0.6), run on every clip at 15 frames per second, then the landmarks go through the app's real `src/features/move/detectors.js` in Node.
- **Tuning without peeking:** thresholds were searched on Countix *train* clips only, then checked once on the held-out Countix *validation* clips. Error = |counted − true| per clip; 95% CIs by bootstrap over clips.
- **"Body in view" subset:** clips where the app's own visibility check accepted at least 90% of frames, which is what ASHA's camera set-up step asks the person to achieve.

## What was wrong

1. **Standing never counted as "start".** The squat counter needed a knee angle of 160° to start. In 2D video a standing knee usually reads 150–165°, so many people never "started" and nothing was counted.
2. **Camera movement hid the hip drop.** Squats must also lower the hips. That was measured as the hip's position in the picture, so a hand-held or zooming camera moved the reference. It is now the hip's height above the ankle, which a moving camera doesn't change.
3. **Arm raises to the front look shorter from the front.** A forward raise to shoulder height reads about 60–80° in a front view, below the 75° target.

## Changes (detectors 1.1.0 → 1.2.0)

| Exercise | Before | After |
| --- | --- | --- |
| Squat | start 160°, target 110°, return 155°, hip drop 15% of leg (picture position) | start 145°, target 125°, return 140°, hip drop 5% of leg, measured above the ankle |
| Wall push-up | start 150°, target 115°, return 145° | start 135°, target 115°, return 130° |
| Arm raise | start 40°, target 75°, return 45° | start 40°, target 60°, return 45° |

Timing rules (hold, settle, 20 s maximum, gap reset) and the visibility threshold were **kept**: faster timing found a little more but began adding false counts.

## Results on held-out clips

Mean absolute count error per clip (95% CI), share exactly right, share within ±1 rep:

| Exercise (clips) | Subset | Before | After |
| --- | --- | --- | --- |
| Squat (24) | every clip | 2.00 (1.67–2.38), exact 4%, ±1 17% | **1.58** (1.21–2.08), exact 17%, ±1 42% |
| Squat (11) | body in view | 1.64 (1.18–2.09), exact 9%, ±1 36% | **0.82** (0.36–1.27), exact 36%, ±1 82% |
| Push-up → wall push-up (32) | every clip | 2.75 (1.97–3.50), ±1 44% | **2.34** (1.59–3.09), ±1 53% |
| Push-up → wall push-up (21) | body in view | 2.43 (1.57–3.38), ±1 57% | **1.90** (1.14–2.81), ±1 71% |
| Front raise → arm raise (39) | every clip | 1.77 (1.23–2.44), ±1 56% | **1.62** (1.10–2.28), ±1 62% |
| Front raise → arm raise (20) | body in view | 1.60 (0.80–2.70), ±1 65% | **1.35** (0.65–2.40), ±1 70% |
| Lunge → squat counter (37) | every clip | 2.59 (2.03–3.16), ±1 22% | **2.19** (1.70–2.70), ±1 32% |

On all 90 squat clips with the body in view (43), the squat error fell from 2.14 to 1.53 and clips counted as zero fell from 51% to 19%.

**The counters still undercount** (they count about half to three quarters of true reps on these clips) and **almost never overcount** the right exercise (0–1% of clips). For ASHA that's the safer side: a missed rep can be added with the manual +1 button, a phantom rep can't be trusted.

**False counts on other exercises** (reps counted per minute of video of a *different* exercise; before → after): squat counter on front raises 0.22 → 0.30, on push-ups 0.08 → 0.29, on sit-ups 0.19 → 0.94, on jumping jacks 0.55 → 1.09; arm-raise counter on squats 1.8 → 2.5, on lunges 1.6 → 2.1; wall push-up counter on squats 0.8 → 1.1, on front raises 5.3 → 6.5. In ASHA the person picks the exercise first, so these matter less, but the looser thresholds do trade some specificity for sensitivity.

## Limits, said plainly

- Kinetics clips are 10 s cuts, often starting mid-rep, filmed from the back or side, with feet or heads out of frame. About half of squat clips fail the app's own "whole body in view" check; ASHA's set-up step would ask the person to fix the camera first.
- Floor push-ups, gym front raises and lunges stand in for wall push-ups, arm raises and supported lunges. Chair squats, sit-to-stand, heel raises, glute bridges and the face and hand exercises have no public rep-count video here and are **not** validated by this run.
- Thresholds are camera-plane angles, not goniometer angles. Volunteers filmed with ASHA's own set-up, plus clinician-set ranges, are still needed.
- All 52 Move unit tests pass with the new values. `tests/move-browser.mjs` times out on one click in the Bangla phone layout (the Next.js dev badge covers the button); this also happens on the code before this change.
