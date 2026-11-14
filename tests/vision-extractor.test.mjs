import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// The classic MediaPipe extractor (public/neuroface/src/vision.js) had no test
// coverage at all: it is a browser script that assigns to window.NF_vision, so
// it needs a DOM, a canvas and a video before it can be exercised. This harness
// stubs exactly that much and no more.

const SOURCE = fs.readFileSync(
  new URL("../public/neuroface/src/vision.js", import.meta.url),
  "utf8",
);

/** 478 landmarks in a plausible face box, plus the indices the extractor reads. */
function landmarks() {
  const lm = [];
  for (let i = 0; i < 478; i++) {
    const col = i % 20;
    const row = Math.floor(i / 20);
    lm.push({
      x: 0.12 + (col / 20) * 0.4,
      y: 0.16 + (row / 24) * 0.5,
      z: 0,
    });
  }
  return lm;
}

function mediaPipeResult() {
  const names = [
    "eyeBlinkLeft",
    "eyeBlinkRight",
    "mouthSmileLeft",
    "mouthSmileRight",
    "cheekSquintLeft",
    "cheekSquintRight",
    "mouthClose",
    "jawOpen",
    "mouthPucker",
  ];
  return {
    faceLandmarks: [landmarks()],
    faceBlendshapes: [{ categories: names.map((categoryName) => ({ categoryName, score: 0 })) }],
    facialTransformationMatrixes: [{ rows: 4, columns: 4, data: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }],
  };
}

/**
 * Load the classic script with a stubbed browser around it.
 * `pixels` is the 48x48 RGBA crop the extractor will "see".
 */
function loadVision(pixels) {
  const saved = new Map(
    ["window", "document"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const window = {
    NF_metrics: {
      earPx: () => 0.3,
      mar: () => 0.1,
      mouthWidth: () => 0.15,
      lipDeviation: () => 0,
      cornerDepression: () => 0,
      gaze: () => ({ x: 0, y: 0 }),
    },
    NF_LM: { eyeR: 33, eyeL: 263 },
  };
  globalThis.window = window;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: pixels }),
      }),
    }),
  };
  vm.runInThisContext(SOURCE);
  const restore = () => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
  return { vision: window.NF_vision, restore };
}

/** A crop whose rows alternate between two values: a sharp image. */
function sharpCrop(a = 120, b = 200) {
  const data = new Uint8ClampedArray(48 * 48 * 4);
  for (let y = 0; y < 48; y++) {
    const v = y % 2 ? b : a;
    for (let x = 0; x < 48; x++) {
      const i = (y * 48 + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

/** A crop with no vertical structure at all: out of focus. */
function flatCrop(v = 120) {
  const data = new Uint8ClampedArray(48 * 48 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  return data;
}

/** A crop with a controlled vertical gradient magnitude. */
function gradientCrop(step) {
  const data = new Uint8ClampedArray(48 * 48 * 4);
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const i = (y * 48 + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = (y * step) % 255;
      data[i + 3] = 255;
    }
  }
  return data;
}

const VIDEO = { videoWidth: 640, videoHeight: 480, readyState: 2 };

test("a sharp face crop is not penalised for blur", (t) => {
  const { vision, restore } = loadVision(sharpCrop());
  t.after(restore);
  const features = new vision.Extractor().extract(mediaPipeResult(), VIDEO, 1000);
  assert.ok(features.sharpness > 6, `sharpness ${features.sharpness}`);
  assert.equal(features.faceQuality, 1);
  assert.ok(features.brightness > 28 && features.brightness < 245);
});

test("an out-of-focus face crop loses a bounded amount of quality and stays accepted", (t) => {
  const { vision, restore } = loadVision(flatCrop());
  t.after(restore);
  const features = new vision.Extractor().extract(mediaPipeResult(), VIDEO, 1000);
  assert.equal(features.sharpness, 0);
  assert.ok(
    features.faceQuality >= 0.65,
    `a blurred frame must still be usable: ${features.faceQuality}`,
  );
  assert.ok(
    features.faceQuality <= 0.85,
    `a blurred frame must not be good enough to calibrate a neutral reference: ${features.faceQuality}`,
  );
  assert.equal(features.faceQuality, 1 - 0.15);
});

test("a moderately soft face crop loses only part of its quality", (t) => {
  const { vision, restore } = loadVision(gradientCrop(4));
  t.after(restore);
  const features = new vision.Extractor().extract(mediaPipeResult(), VIDEO, 1000);
  assert.equal(features.sharpness, 4);
  assert.equal(features.faceQuality, 0.95, "a partly blurred frame is only partly penalised");
  assert.ok(features.faceQuality > 0.85, "and is still good enough to calibrate a neutral reference");
});

test("the blur penalty never exceeds its bound", () => {
  const { vision, restore } = loadVision(flatCrop());
  try {
    assert.equal(vision.blurPenalty(null), 0, "no measurement means no penalty");
    assert.equal(vision.blurPenalty(undefined), 0);
    assert.equal(vision.blurPenalty(6), 0);
    assert.equal(vision.blurPenalty(100), 0);
    assert.equal(vision.blurPenalty(0), 0.15);
    assert.ok(vision.blurPenalty(3) > 0 && vision.blurPenalty(3) < 0.15);
    assert.ok(vision.blurPenalty(-5) <= 0.15);
  } finally {
    restore();
  }
});
