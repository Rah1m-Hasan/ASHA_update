# Local inference assets

Face and hand models plus MediaPipe runtime are preserved under `neuroface/` from the supplied unified-web repository. Its `vendor/manifest.json` records versions and SHA-256 hashes.

The new pose model is Google's MediaPipe Pose Landmarker Lite, float16, version 1:
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

The YOLO model is the ONNX Community export of Ultralytics YOLO26n-pose (FP32), downloaded 2026-09-27:
https://huggingface.co/onnx-community/yolo26n-pose-ONNX/blob/main/onnx/model.onnx

YOLO licensing: AGPL-3.0, see YOLO-LICENSE.txt and Ultralytics' licensing terms. An enterprise license may be needed for a proprietary commercial distribution. ONNX Runtime 1.22.0 is MIT licensed (app/ORT-LICENSE.txt).

This export returns `[1,300,57]`: normalized boxes, detection score, class, then 17 triplets. It normalizes all three keypoint components by 640. The decoder restores the confidence component by multiplying by 640; x/y are already normalized. The decoder has a regression test and a real-image inference test.

All inference stays in the browser. No raw camera images are sent to the cloud. Models are loaded on demand and cached by the service worker. YOLO is an optional worker-based cross-check because of its CPU cost on phones; MediaPipe pose stays active in all patient interfaces.

## Nutrition: general image classifier (experimental suggestions only)

`efficientnet_lite0_int8.tflite` is Google's MediaPipe Image Classifier EfficientNet-Lite0, int8, 5,434,517 bytes, SHA-256 `bc2ffe19c1118de0c0c2a9088992da5589722656e0fba81421385300a4a34b16`, published 2023-04-26 and downloaded 2026-11-10 from:
https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/int8/latest/efficientnet_lite0.tflite

Its embedded TFLite metadata states the Apache License 2.0. It was trained on ImageNet's 1,000 general classes, so it is **not a food model** and does not recognise Bangladeshi meals. ASHA Nutrition uses only three of its classes (banana, Granny Smith apple, strawberry) to *suggest* a whole fruit, labelled experimental, which the person must confirm. Every other food is chosen by the person. It runs in a Web Worker on frames sampled about three times a second; no image leaves the device.
