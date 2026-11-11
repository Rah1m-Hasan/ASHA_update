// ASHA Nutrition classifier worker. Runs off the main thread, one image at a time.
//
// It answers three things about a still image (a sampled live frame, the frozen frame, or an
// uploaded photo, all through the same message):
//   - the general ImageNet classifier's top labels for the centre square (EfficientNet-Lite0 int8,
//     MediaPipe; NOT a food-trained model, so ASHA only turns a few whole-fruit labels into an
//     experimental suggestion),
//   - whether a face is in the picture (MediaPipe face landmarker, already shipped), so ASHA can
//     ask for a photo without people in it,
//   - basic picture quality (light, blur) of the centre square.
// Nothing is sent anywhere. Images arrive as ImageBitmaps and are closed after use.
let classifier = null;
let faces = null;
let quality = null;
let ready = null;

async function init(base) {
  const V = await import(new URL("../neuroface/vendor/vision_bundle.mjs", self.location.href).href);
  const { checkPhotoQuality } = await import(new URL("../app/everyday/foods.js", self.location.href).href);
  quality = checkPhotoQuality;
  const files = await V.FilesetResolver.forVisionTasks(new URL("../neuroface/vendor/wasm/", self.location.href).href);
  const t0 = performance.now();
  const opts = (path, extra) => ({ runningMode: "IMAGE", canvas: new OffscreenCanvas(1, 1), baseOptions: { delegate: "CPU", modelAssetPath: new URL(path, base || self.location.href).href }, ...extra });
  classifier = await V.ImageClassifier.createFromOptions(files, opts("../models/efficientnet_lite0_int8.tflite", { maxResults: 5 }));
  try {
    faces = await V.FaceLandmarker.createFromOptions(files, opts("../neuroface/models/face_landmarker.task", { numFaces: 3, minFaceDetectionConfidence: 0.5 }));
  } catch {
    faces = null; // The face check is a courtesy; classification still works without it.
  }
  return { loadMs: Math.round(performance.now() - t0), faceCheck: !!faces };
}

function pixels(bitmap) {
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
}

self.onmessage = async ({ data: d }) => {
  if (d.type === "init") {
    ready ??= init(d.base);
    try {
      self.postMessage({ type: "ready", ...(await ready) });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err?.message || err).slice(0, 200) });
    }
    return;
  }
  if (d.type !== "classify") return;
  const { id, crop, frame } = d;
  try {
    await ready;
    const t0 = performance.now();
    const result = classifier.classify(crop);
    const categories = (result.classifications?.[0]?.categories ?? []).map((c) => ({ label: c.categoryName || c.displayName, score: c.score }));
    const q = quality(pixels(crop), crop.width, crop.height);
    let faceCount = null;
    if (faces && frame) faceCount = faces.detect(frame).faceLandmarks?.length ?? 0;
    self.postMessage({ type: "result", id, categories, quality: { warnings: q.warnings, brightness: Math.round(q.brightness), sharpness: Math.round(q.laplacianVariance) }, faceCount, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    self.postMessage({ type: "result", id, error: String(err?.message || err).slice(0, 200) });
  } finally {
    crop?.close?.();
    frame?.close?.();
  }
};
