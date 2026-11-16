// The local inference assets are pinned by size and SHA-256 in the manifests
// that ship with them. Nothing used to compare the files with those pins, so
// a truncated download or a swapped weight would only have been noticed when
// the model behaved badly on a patient's device.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { verifyModels } = await import("../scripts/model-integrity.mjs");
const { MODEL_REGISTRY } = await import("../public/app/everyday/model-registry.js");

test("every pinned inference asset matches its recorded hash", async () => {
  const results = await verifyModels();
  assert.ok(results.length >= 10, "the manifests record the model files");
  for (const r of results) {
    assert.equal(
      r.ok,
      true,
      `${r.relative}: ${r.error ?? `size ${r.size} != ${r.bytes} or hash ${r.digest} != ${r.sha256}`}`,
    );
  }
});

test("the manifests cover every model the engine loads", async () => {
  const results = await verifyModels();
  const covered = results.map((r) => r.relative);
  for (const file of [
    "public/models/pose_landmarker_lite.task",
    "public/models/yolo26n-pose.onnx",
    "public/models/efficientnet_lite0_int8.tflite",
    "public/models/yolov8_foodseg103.onnx",
    "public/engine/ort-wasm-simd-threaded.wasm",
    "public/engine/ort-wasm-simd-threaded.mjs",
    "public/neuroface/models/face_landmarker.task",
    "public/neuroface/models/hand_landmarker.task",
  ]) {
    assert.ok(covered.includes(file), `${file} is not covered by a manifest`);
  }
});

test("the Everyday registry agrees with the files on disk", async () => {
  // The registry verifies a model when the app loads it. If the pinned hash
  // there and the file on disk ever drift apart, the app would reject its
  // own model.
  for (const entry of Object.values(MODEL_REGISTRY)) {
    const file = path.join(root, "public", entry.url.replace(/^\//, ""));
    const bytes = await readFile(file);
    assert.equal(bytes.byteLength, entry.bytes, `${entry.url} has the recorded size`);
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, entry.sha256, `${entry.url} has the recorded hash`);
  }
});
