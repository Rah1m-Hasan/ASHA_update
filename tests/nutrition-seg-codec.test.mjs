import test from "node:test";
import assert from "node:assert/strict";
import {
  SEG,
  boxIou,
  buildMask,
  decodeCandidates,
  decodeSegments,
  letterbox,
  maskArea,
  suppress,
  tensorLayout,
  unprojectBox,
} from "../public/app/nutrition/vision/seg-codec.js";

// Model scores live in a Float32Array, so they come back with the precision of a 32-bit float.
// Comparing them exactly would fail for reasons that have nothing to do with the decode.
const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, message ?? `${actual} != ${expected}`);

// The channel-major layout is the single most dangerous convention in this file: read it the
// other way round and the decoder returns confident nonsense. These tests pin it.

/**
 * A synthetic output0 tensor.
 *
 * @param {number} anchors how many anchor columns
 * @param {number} numClasses how many class score channels
 * @param {Array<{anchor:number, classId:number, score:number, box?:{cx:number,cy:number,w:number,h:number}, coeffs?:number[]}>} items
 */
function makeTensor(anchors, numClasses, items) {
  const channels = 4 + numClasses + SEG.numMasks;
  const data = new Float32Array(channels * anchors);
  // Give every class a small non-zero score so an unset channel never looks like a winner.
  for (let c = 0; c < numClasses; c++) {
    for (let a = 0; a < anchors; a++) data[(4 + c) * anchors + a] = 0.01;
  }
  for (const item of items) {
    const a = item.anchor;
    const box = item.box ?? { cx: 384, cy: 384, w: 100, h: 100 };
    data[0 * anchors + a] = box.cx;
    data[1 * anchors + a] = box.cy;
    data[2 * anchors + a] = box.w;
    data[3 * anchors + a] = box.h;
    for (let c = 0; c < numClasses; c++) data[(4 + c) * anchors + a] = 0.01;
    data[(4 + item.classId) * anchors + a] = item.score;
    const coeffs = item.coeffs ?? [];
    for (let k = 0; k < SEG.numMasks; k++)
      data[(4 + numClasses + k) * anchors + a] = coeffs[k] ?? 0;
  }
  return { data, dims: [1, channels, anchors] };
}

test("the segmentation tensor is read channel-major, so a class score lands in the right column", () => {
  // Class 5, anchor 0, score 0.9. Read anchor-major this would land somewhere else entirely.
  const { data, dims } = makeTensor(3, 8, [{ anchor: 0, classId: 5, score: 0.9 }]);
  const found = decodeCandidates(data, dims, { confThreshold: 0.25 });
  assert.equal(found.length, 1);
  assert.equal(found[0].classId, 5);
  close(found[0].score, 0.9);
  assert.equal(found[0].anchor, 0);
  // The box lives in the first four channels, at channel * anchors + anchor.
  assert.equal(found[0].box.x, 334);
  assert.equal(found[0].box.y, 334);
  assert.equal(found[0].box.w, 100);
  assert.equal(found[0].box.h, 100);
});

test("a box is read from the four box channels at the anchor's column", () => {
  const { data, dims } = makeTensor(3, 8, [
    { anchor: 1, classId: 2, score: 0.7, box: { cx: 384, cy: 384, w: 200, h: 100 } },
  ]);
  const found = decodeCandidates(data, dims, { confThreshold: 0.25 });
  assert.equal(found.length, 1);
  assert.equal(found[0].box.x, 284);
  assert.equal(found[0].box.y, 334);
  assert.equal(found[0].box.w, 200);
  assert.equal(found[0].box.h, 100);
});

test("the background class is never proposed as food", () => {
  const { data, dims } = makeTensor(3, 8, [{ anchor: 0, classId: 0, score: 0.95 }]);
  assert.deepEqual(decodeCandidates(data, dims, { confThreshold: 0.25 }), []);
});

test("candidates below the confidence threshold are dropped", () => {
  const { data, dims } = makeTensor(3, 8, [{ anchor: 0, classId: 3, score: 0.2 }]);
  assert.deepEqual(decodeCandidates(data, dims, { confThreshold: 0.25 }), []);
  const kept = decodeCandidates(data, dims, { confThreshold: 0.1 });
  assert.equal(kept.length, 1);
  close(kept[0].score, 0.2);
});

test("suppression keeps the stronger of two overlapping boxes of the same class", () => {
  const a = { classId: 4, score: 0.8, box: { x: 0, y: 0, w: 100, h: 100 } };
  const b = { classId: 4, score: 0.5, box: { x: 5, y: 5, w: 100, h: 100 } };
  assert.ok(boxIou(a.box, b.box) > 0.7);
  const kept = suppress([b, a]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].score, 0.8);
});

test("suppression keeps two boxes of the same class that barely overlap", () => {
  const a = { classId: 4, score: 0.8, box: { x: 0, y: 0, w: 100, h: 100 } };
  const b = { classId: 4, score: 0.5, box: { x: 200, y: 200, w: 100, h: 100 } };
  assert.equal(suppress([b, a]).length, 2);
});

test("suppression never removes a different class that happens to overlap", () => {
  const a = { classId: 4, score: 0.8, box: { x: 0, y: 0, w: 100, h: 100 } };
  const b = { classId: 9, score: 0.6, box: { x: 0, y: 0, w: 100, h: 100 } };
  assert.equal(suppress([b, a]).length, 2);
});

test("the letterbox geometry matches the export's own scaling", () => {
  const wide = letterbox(1280, 960, 768);
  assert.equal(wide.scale, 0.6);
  assert.equal(wide.resizedWidth, 768);
  assert.equal(wide.resizedHeight, 576);
  assert.equal(wide.top, 96);
  assert.equal(wide.left, 0);
  assert.equal(wide.right, 768);
  assert.equal(wide.bottom, 672);

  const square = letterbox(1000, 1000, 768);
  assert.equal(square.scale, 0.768);
  assert.equal(square.left, 0);
  assert.equal(square.top, 0);

  const tall = letterbox(4000, 3000, 768);
  assert.equal(tall.scale, 0.192);
  assert.equal(tall.top, 96);
  assert.equal(tall.resizedWidth, 768);
});

test("the letterbox refuses a picture with no size", () => {
  for (const bad of [
    [0, 100],
    [100, 0],
    [-10, 10],
    [NaN, 10],
    [10, Infinity],
  ])
    assert.throws(() => letterbox(bad[0], bad[1]), /width and height/);
});

test("a mask is the set of prototype pixels where the summed logit is positive", () => {
  // One prototype channel, one coefficient, so the logit is exactly that prototype value.
  const height = 4;
  const width = 4;
  const proto = new Float32Array(height * width);
  proto[0] = 1; // top-left pixel
  const protoDims = [1, 1, height, width];
  // The codec reads 32 channels, so pad the prototype out to 32.
  const proto32 = new Float32Array(SEG.numMasks * height * width);
  proto32[0] = 1;

  // A coefficient of +1 on channel 0 makes the logit positive where the prototype is 1.
  const coeffs = new Float32Array(SEG.numMasks);
  coeffs[0] = 1;
  const mask = buildMask(coeffs, proto32, [1, SEG.numMasks, height, width], {
    x: 0,
    y: 0,
    w: 4 * SEG.protoScale,
    h: 4 * SEG.protoScale,
  });
  assert.equal(mask.width, 4);
  assert.equal(mask.height, 4);
  let set = 0;
  for (const v of mask.data) set += v;
  assert.equal(set, 1);
  assert.equal(mask.data[0], 1);

  // A coefficient of -1 flips the sign, so the same prototype pixel is now outside.
  const negative = new Float32Array(SEG.numMasks);
  negative[0] = -1;
  const flipped = buildMask(negative, proto32, [1, SEG.numMasks, height, width], {
    x: 0,
    y: 0,
    w: 4 * SEG.protoScale,
    h: 4 * SEG.protoScale,
  });
  let setFlipped = 0;
  for (const v of flipped.data) setFlipped += v;
  assert.equal(setFlipped, 0);
  assert.ok(proto.length === height * width);
});

test("a mask is cropped to the instance's box", () => {
  const height = 8;
  const width = 8;
  const proto32 = new Float32Array(SEG.numMasks * height * width);
  for (let i = 0; i < height * width; i++) proto32[i] = 1;
  const coeffs = new Float32Array(SEG.numMasks);
  coeffs[0] = 1;
  // A box covering exactly one prototype cell.
  const mask = buildMask(coeffs, proto32, [1, SEG.numMasks, height, width], {
    x: 0,
    y: 0,
    w: SEG.protoScale,
    h: SEG.protoScale,
  });
  assert.equal(mask.width, 1);
  assert.equal(mask.height, 1);
  assert.equal(mask.data[0], 1);
});

test("a mask lying entirely in the letterbox padding has an area of exactly zero", () => {
  // The measured geometry of a 640x480 photograph: the padded band is the top 96 rows.
  const lb = letterbox(640, 480, 768);
  assert.equal(lb.top, 96);
  const proto32 = new Float32Array(SEG.numMasks * 192 * 192);
  for (let i = 0; i < 192 * 192; i++) proto32[i] = 1;
  const coeffs = new Float32Array(SEG.numMasks);
  coeffs[0] = 1;
  // A box entirely inside the pad band (input rows 0..96).
  const mask = buildMask(coeffs, proto32, [1, SEG.numMasks, 192, 192], {
    x: 0,
    y: 0,
    w: 100,
    h: 96,
  });
  const { areaPx } = maskArea(mask, lb);
  assert.equal(areaPx, 0);
});

test("a mask covering the whole picture has the picture's area", () => {
  const lb = letterbox(640, 480, 768);
  const proto32 = new Float32Array(SEG.numMasks * 192 * 192);
  for (let i = 0; i < 192 * 192; i++) proto32[i] = 1;
  const coeffs = new Float32Array(SEG.numMasks);
  coeffs[0] = 1;
  // A box covering the whole input, so every prototype pixel is set.
  const mask = buildMask(coeffs, proto32, [1, SEG.numMasks, 192, 192], {
    x: 0,
    y: 0,
    w: 768,
    h: 768,
  });
  const { areaPx, areaRatio } = maskArea(mask, lb);
  // The content is 768 x 576 at scale 1.2, so in original pixels it is 640 x 480.
  assert.ok(Math.abs(areaPx - 640 * 480) < 2, `area was ${areaPx}`);
  assert.ok(Math.abs(areaRatio - 1) < 0.01, `ratio was ${areaRatio}`);
});

test("a mask is projected back to the original picture's pixels", () => {
  const lb = letterbox(640, 480, 768);
  // One prototype pixel set, so 4x4 input pixels, scaled back by 1.2.
  // The pixel is placed inside the picture's content (below the 96-row pad band), so it counts.
  const proto32 = new Float32Array(SEG.numMasks * 192 * 192);
  const protoY = 24; // input row 96, the first row of the content
  proto32[(0 * 192 + protoY) * 192 + 0] = 1;
  const coeffs = new Float32Array(SEG.numMasks);
  coeffs[0] = 1;
  const mask = buildMask(coeffs, proto32, [1, SEG.numMasks, 192, 192], {
    x: 0,
    y: protoY * SEG.protoScale,
    w: SEG.protoScale,
    h: SEG.protoScale,
  });
  const { areaPx } = maskArea(mask, lb);
  assert.ok(Math.abs(areaPx - 16 / (1.2 * 1.2)) < 0.01, `area was ${areaPx}`);
});

test("a box is projected back onto the original picture", () => {
  const lb = letterbox(640, 480, 768);
  // The whole picture in input pixels becomes the whole picture again.
  const back = unprojectBox({ x: 0, y: 96, w: 768, h: 576 }, lb);
  assert.ok(Math.abs(back.x - 0) < 1e-6);
  assert.ok(Math.abs(back.y - 0) < 1e-6);
  assert.ok(Math.abs(back.w - 640) < 1e-6);
  assert.ok(Math.abs(back.h - 480) < 1e-6);
});

test("the tensor layout is derived from the shape, not assumed", () => {
  const layout = tensorLayout([1, 140, 12096]);
  assert.equal(layout.anchors, 12096);
  assert.equal(layout.numClasses, 104);
  // A different export with fewer classes still decodes.
  assert.equal(tensorLayout([1, 40, 100]).numClasses, 4);
});

test("an unusable tensor shape is refused rather than decoded as nonsense", () => {
  for (const dims of [
    [1, 140],
    [2, 140, 12096],
    [1, 10, 12096],
    [1, 140, 0],
    "not a shape",
  ])
    assert.throws(() => tensorLayout(dims));
});

test("the whole decode turns raw tensors into proposals with an area", () => {
  const anchors = 2;
  const numClasses = 8;
  const { data, dims } = makeTensor(anchors, numClasses, [
    { anchor: 0, classId: 3, score: 0.6, box: { cx: 384, cy: 384, w: 200, h: 200 }, coeffs: [1] },
  ]);
  const proto32 = new Float32Array(SEG.numMasks * 192 * 192);
  for (let i = 0; i < 192 * 192; i++) proto32[i] = 1;
  const items = decodeSegments(data, dims, proto32, [1, SEG.numMasks, 192, 192], {
    width: 640,
    height: 480,
    confThreshold: 0.25,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].classId, 3);
  close(items[0].score, 0.6);
  assert.ok(items[0].areaPx > 0, "a full mask should have an area");
  assert.ok(items[0].areaRatio > 0 && items[0].areaRatio <= 1);
});

test("the same tensors always decode to the same proposals", () => {
  const anchors = 4;
  const numClasses = 8;
  const { data, dims } = makeTensor(anchors, numClasses, [
    { anchor: 0, classId: 3, score: 0.6, coeffs: [1] },
    { anchor: 1, classId: 6, score: 0.4, coeffs: [1] },
  ]);
  const proto32 = new Float32Array(SEG.numMasks * 192 * 192);
  for (let i = 0; i < 192 * 192; i++) proto32[i] = 1;
  const opts = { width: 640, height: 480, confThreshold: 0.25 };
  const a = decodeSegments(data, dims, proto32, [1, SEG.numMasks, 192, 192], opts);
  const b = decodeSegments(data, dims, proto32, [1, SEG.numMasks, 192, 192], opts);
  assert.deepEqual(
    a.map((x) => [x.classId, x.score, x.areaPx]),
    b.map((x) => [x.classId, x.score, x.areaPx]),
  );
});
