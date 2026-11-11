# Move tracking benchmark: pose only, the model router, all three models and Holistic

Measured on 2026-11-10 with `scripts/move-tracking-benchmark.mjs`, which runs the real MediaPipe models in headless Chromium against the dev server. Raw results are written to `artifacts/move-tracking-benchmark*.json` (not committed).

```
node scripts/move-tracking-benchmark.mjs <person-image.jpg> [holistic_landmarker.task]
```

## Setup

| Item | Value |
| --- | --- |
| Machine | Cloud container, Intel Xeon 2.10 GHz, 4 cores, no GPU. **Not a phone**: phone numbers will differ and still have to be measured. |
| Browser | Headless Chromium 153, MediaPipe Tasks Vision (the bundle ASHA ships), CPU (WASM) delegate for every model so the modes are comparable |
| Frames | 640×480, the image letterboxed into it as a webcam would deliver it; `VIDEO` running mode; 10 warm-up frames, then 60 measured |
| Inputs | Full-height person with open hands (`male_full_height_hands.jpg`, sha256 `8a7fe5be8b90d607…`), a head-and-shoulders portrait (`portrait.jpg`, sha256 `a6f11efaa834706d…`), both from the public MediaPipe test assets, and an empty frame |
| Timing | Wall time of each `detectForVideo` call, run one after another on one thread. The app runs the hand model in its own worker, so the router rows are an upper bound for what blocks the face and pose worker. |

Model files: pose lite 5.78 MB, face 3.76 MB, hands 7.82 MB (all already shipped, 17.36 MB together). The Holistic model is 13.68 MB and is **not shipped**; it was downloaded only for this comparison. Loading the three shipped models took about 1.8–1.9 s; Holistic took about 1.0 s.

## Modes

| Mode | What runs per camera frame | Used in ASHA for |
| --- | --- | --- |
| `pose_only` | Pose | (reference) |
| `face_only` | Face | (reference) |
| `hands_only` | Hands | (reference) |
| `router_body` | Face + pose every frame, hands every 8th frame | Body exercises (the default) |
| `router_face` | Face every frame, pose every 15th, hands every 8th | Face exercises |
| `composite_all` | Face + pose + hands every frame | "Show all detected landmarks" (off by default) |
| `holistic_model` | MediaPipe Holistic Landmarker | Not used; compared here |

## Results (milliseconds per frame, p50 / p95, and landmarks returned)

Full-height person:

| Mode | p50 | p95 | Landmarks (pose + face + hands) |
| --- | --- | --- | --- |
| pose_only | 39.0 | 61.4 | 33 (33 + 0 + 0) |
| face_only | 9.8 | 14.0 | 0: the face is too small at full-body distance |
| hands_only | 73.7 | 109.3 | 42 (0 + 0 + 42) |
| router_body | 47.7 | 118.6 | 33 (33 + 0 + 0) on the last frame; hands arrive every 8th frame |
| router_face | 9.9 | 86.1 | 0 |
| composite_all | 118.9 | 143.3 | 75 (33 + 0 + 42) |
| holistic_model | 127.9 | 152.2 | 553 (33 + 478 + 42) |

Portrait:

| Mode | p50 | p95 | Landmarks (pose + face + hands) |
| --- | --- | --- | --- |
| pose_only | 38.7 | 53.0 | 33 |
| face_only | 27.1 | 37.1 | 478 |
| hands_only | 79.8 | 117.7 | 21 |
| router_body | 63.6 | 140.9 | 511 (33 + 478 + 0) |
| router_face | 27.0 | 104.7 | 478 |
| composite_all | 146.6 | 198.5 | 532 (33 + 478 + 21) |
| holistic_model | 127.9 | 152.2 | 532 (33 + 478 + 21) |

Empty frame (nobody in view): pose 46.5 / 72.4, face 9.5 / 11.7, hands 41.0 / 57.5, router_body 60.9 / 109.9, router_face 10.4 / 72.2, composite_all 93.9 / 106.9, Holistic 46.6 / 61.1. No landmarks were returned by any mode.

What ASHA's own checks made of these outputs:

- Squat status was READY on the full-height frame and PARTIAL_VIEW on the portrait (legs out of view), as it should be. Arm raise was READY on both.
- Smile was READY whenever a face mesh was present and NO_PERSON otherwise.
- Finger openness on the two real open hands was 1.82 and 1.85 (the counting target is 1.6), so open hands read as open. Their palms were 3.3–3.6% of the frame, so the set-up check asks the person to bring the hand closer. Holistic's hand points matched the hand model's to about four decimal places.

## What this decided

1. **The router stays.** For body exercises, face and pose at camera rate cost about half as much per frame as running all three models (p50 48–64 ms against 119–147 ms here). "Show all detected landmarks" runs all three and is off by default.
2. **Holistic is not shipped now.** It costs about the same as all three models together. On a full-body frame it does find the face where the separate face model does not, because it crops the face from the pose. But it would add 13.7 MB to download, and it would have to replace the face model that also runs ASHA's blink-to-request feature in its own worker. It is a candidate for "show all" once it has been measured on phones.
3. **Face exercises need a close camera.** The face model returns nothing at full-body distance. The face lesson already asks for the face in view and in good light, and the set-up check will not let counting start without it.

## Not measured yet

- Phones (low-end Android especially), GPU delegate, battery and heat.
- Accuracy against labelled video: repetition counts, hold timing, finger opening and face expressions.
- The full app under load: camera capture, the workers, the overlay drawing and React together. The benchmark measures the models alone.
