// ASHA Nutrition food segmenter worker. Runs off the main thread, one photograph at a time.
//
// It runs the pinned YOLOv8 food-segmentation export (public/models/yolov8_foodseg103.onnx) on a
// still picture and returns the food regions it finds: a class name, a score, a box and the area of
// the region's mask.
//
// The ONNX Runtime WASM binary is vendored (public/engine/ort-wasm-simd-threaded.wasm) and pinned
// in public/engine/manifest.json, so nothing is fetched from a third-party CDN at run time and the
// whole thing works offline once cached.
//
// Nothing is sent anywhere. Pictures arrive as ImageBitmaps and are closed after use.
//
// What this worker does NOT do: it never produces a nutrition value, it never decides what a person
// ate, and it never names a Bangladeshi dish. It proposes ingredient regions; the map layer turns
// them into candidates and the person confirms them.
//
// A note on the score: it is the model's confidence that a region is that class. It is NOT a
// probability that the person ate that food. On a real photograph of kidney beans this model said
// "chocolate" with a score of 0.66. The score is shown to the person as a score, never as a
// percentage, and every proposal needs confirming.
import * as ort from "./ort.wasm.min.mjs";
import { decodeSegments, letterbox, SEG } from "../app/nutrition/vision/seg-codec.js";
import { className } from "../app/nutrition/vision/seg-labels.js";

let session = null;
let ready = null;
let busy = false;

/**
 * Load the model.
 *
 * @returns {Promise<{loadMs:number, inputSize:number, classes:number}>}
 */
async function init() {
  ort.env.wasm.numThreads = 1;
  // Local, vendored runtime. See public/engine/manifest.json.
  ort.env.wasm.wasmPaths = new URL(".", import.meta.url).href;
  const t0 = performance.now();
  session = await ort.InferenceSession.create(
    new URL("../models/yolov8_foodseg103.onnx", import.meta.url).href,
    { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
  );
  return { loadMs: Math.round(performance.now() - t0), inputSize: SEG.inputSize, classes: SEG.numClasses };
}

/**
 * Turn an ImageBitmap into the model's input: letterboxed, RGB, NCHW, normalised to 0-1.
 *
 * @param {ImageBitmap} bitmap
 * @returns {{input:Float32Array, dims:number[], lb:ReturnType<typeof letterbox>}}
 */
function toInput(bitmap) {
  const size = SEG.inputSize;
  const lb = letterbox(bitmap.width, bitmap.height, size);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // Ultralytics' letterbox pad colour, so the padding matches training.
  const pad = Math.round(SEG.padValue * 255);
  ctx.fillStyle = `rgb(${pad},${pad},${pad})`;
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, lb.left, lb.top, lb.resizedWidth, lb.resizedHeight);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  const n = size * size;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    input[i] = pixels[i * 4] / 255;
    input[n + i] = pixels[i * 4 + 1] / 255;
    input[2 * n + i] = pixels[i * 4 + 2] / 255;
  }
  return { input, dims: [1, 3, size, size], lb };
}

self.onmessage = async ({ data: d }) => {
  if (d.type === "init") {
    ready ??= init();
    try {
      self.postMessage({ type: "ready", ...(await ready) });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err?.message || err).slice(0, 200) });
    }
    return;
  }
  if (d.type !== "detect") return;
  const { id, bitmap } = d;
  try {
    await ready;
    if (busy) {
      self.postMessage({ type: "result", id, error: "busy" });
      return;
    }
    busy = true;
    const t0 = performance.now();
    const { input, dims, lb } = toInput(bitmap);
    const output = await session.run({
      [session.inputNames[0]]: new ort.Tensor("float32", input, dims),
    });
    const boxes = output[session.outputNames[0]];
    const protos = output[session.outputNames[1]];
    const items = decodeSegments(
      boxes.data,
      boxes.dims,
      protos.data,
      protos.dims,
      {
        width: lb.originalWidth,
        height: lb.originalHeight,
        confThreshold: d.confThreshold ?? 0.25,
        iouThreshold: d.iouThreshold ?? 0.45,
      },
    ).map((item) => ({
      classId: item.classId,
      className: className(item.classId),
      score: item.score,
      box: item.box,
      maskAreaPx: item.areaPx,
      areaRatio: item.areaRatio,
    }));
    self.postMessage({
      type: "result",
      id,
      items,
      ms: Math.round(performance.now() - t0),
      width: lb.originalWidth,
      height: lb.originalHeight,
    });
  } catch (err) {
    self.postMessage({ type: "result", id, error: String(err?.message || err).slice(0, 200) });
  } finally {
    busy = false;
    bitmap?.close?.();
  }
};
