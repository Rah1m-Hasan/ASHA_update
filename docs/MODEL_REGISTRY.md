# Model and dependency registry

Machine-readable weight metadata: `public/app/everyday/model-registry.js`, served at `/app/everyday/model-registry.js`. Actual hashes and bytes are checked by `node scripts/everyday-benchmark.mjs`, which reads assets from `public`. Neither checkpoint was downloaded or newly trained in this implementation; existing repo assets were reused. The Next.js migration changes source locations while preserving model URLs and integrity pins.

| Installed asset                | Pin / source                                                                                                                                                   | Precision and input                                                |               Disk bytes | Licence / data boundary                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -----------------------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| Face Landmarker                | `float16/1`, [Google model artifact](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task)           | FP16 artifact; task-managed detector/landmark graph, browser video |                3,758,596 | Existing MediaPipe Apache-2.0 distribution; training datasets are not redistributed here                                              |
| Pose Landmarker Lite           | `float16/1`, [Google model artifact](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) | FP16 artifact; task-managed graph, browser video                   |                5,777,746 | Existing MediaPipe Apache-2.0 distribution; not clinically validated by ASHA                                                          |
| MediaPipe Tasks Vision runtime | `0.10.22-rc.20250304`, existing `public/neuroface/vendor/manifest.json` | WASM SIMD / no-SIMD and MediaPipe delegates | See benchmark inventory | Existing `MEDIAPIPE-LICENSE.txt`; vendor JS line endings differ from historic manifest byte counts, so benchmark records actual files |
| EyeSpeak personal ridge head   | `asha-gaze-ridge` code version in `gaze-engine.js`                                                                                                             | User calibration features, no pretrained gaze head                 |               JS in base | Original project code; optional personal calibration is encrypted evidence                                                            |
| Move temporal algorithms       | Version in `move-engine.js`                                                                                                                                    | Joint geometry, One Euro, full-cycle FSM                           |               JS in base | Original project code; no learned form model or clinical score                                                                        |
| Food reference subset          | Version in `foods.js`; 11 attributed USDA ingredients                                                                                                          | Deterministic gram arithmetic, not an image model                  |               JS in base | USDA public-domain/CC0 data; see `NUTRITION_SOURCES.md`                                                                               |
| Image Classifier EfficientNet-Lite0 int8 | `latest` (published 2023-04-26), [Google model artifact](https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/int8/latest/efficientnet_lite0.tflite), SHA-256 `bc2ffe19c1118de0c0c2a9088992da5589722656e0fba81421385300a4a34b16` | INT8, 224 px centre square, image mode in a worker | 5,434,517 | Apache-2.0 per embedded metadata; ImageNet-1k, **not food-trained**. Nutrition V5 maps only banana, Granny Smith and strawberry to experimental suggestions (`NUTRITION_V5.md`) |
| MAIRA                          | Existing server profile configuration                                                                                                                          | Task-routed conversation / bilingual / speech provider             | No LLM weights in client | Operator's provider contract, availability and privacy terms apply                                                                    |

Face SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.

Pose SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.

Candidate experiments, **not installed**: food-fine-tuned MobileNetV3/EfficientNet-Lite0; food segmentation DeepLab/U-Net; optional WebGazer alternative; tiny sequence form model; whisper.cpp tiny multilingual. Each needs a specific artifact revision, dataset/checkpoint licence, source, SHA, held-out quality and target-device measurements before activation. YOLO11n-seg is not added: commercial licence review is required. Existing optional assistive YOLO/TensorFlow/hand assets remain in their original module and keep their existing notices; their commercial release review is separate.

Weights now reside at `public/neuroface/models/face_landmarker.task` and `public/models/pose_landmarker_lite.task`, still served at `/neuroface/models/face_landmarker.task` and `/models/pose_landmarker_lite.task`. Shared browser inference and speech code is in `public/engine`; Everyday code remains in `public/app/everyday`. Provider/store code is server-only under `src/server/lib`, reached through `src/server/handlers` and Next API routes.

The migration adds the locked Next.js `16.4.3`, React/React DOM `19.3.1` runtime, plus Tailwind CSS/PostCSS `4.3.3`, TypeScript `5.9.3` and matching type/build tooling. Existing `@vercel/blob@2.8.0`, `web-push@3.6.7`, locked transitive packages and Prettier remain. Browser QA uses the already installed Playwright runtime. OS ASR/TTS availability and Bangla voices vary by device; no external font or speech pack is bundled.


## The food segmenter

| Installed asset | Pin / source | Precision and input | Disk bytes | Licence / data boundary |
| --- | --- | --- | ---: | --- |
| `public/models/yolov8_foodseg103.onnx` | YOLOv8n-seg, FoodSeg103, 768x768; pinned in `public/models/manifest.json` | Instance segmentation, 104 ingredient classes, 768x768 NCHW | 14,707,923 | **AGPL-3.0** weights over the **Apache-2.0** FoodSeg103 dataset; `public/models/FOODSEG-LICENSE.txt` |
| `public/engine/ort-wasm-simd-threaded.wasm` + `.mjs` | ONNX Runtime Web 1.22, vendored; pinned in `public/engine/manifest.json` | CPU/WASM, no GPU | 11,210,254 + 20,856 | MIT (onnxruntime); `public/engine/ORT-LICENSE.txt` |

The runtime was previously fetched unpinned from a CDN at run time. It is now served from this
app's own origin, pinned by SHA-256, and cached by the service worker, so the Nutrition module
works offline and nothing is fetched from a third party while the app is in use.

Measured on 200 labelled FoodSeg103 validation images through the shipping worker: region
precision 65.6 %, recall 58.5 %, F1 61.9 %; p50 612 ms, p95 658 ms on desktop Chromium; **0**
external requests. The split is **in-domain** for this model, so it measures the implementation
rather than generalisation.

`scripts/nutrition-model-acceptance.mjs` is the gate that keeps a broken model out: it runs the
model on labelled photographs and refuses one whose scores do not vary, that answers with the
same class every time, or whose top-1 accuracy is below the floor. It exists because a
published ONNX Food-101 model was found to have all-zero convolution weights and produced a
uniform softmax on every image while passing every size-and-hash check.
