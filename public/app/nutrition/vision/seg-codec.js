// Decoder for the pinned YOLOv8 food-segmentation export (public/models/yolov8_foodseg103.onnx).
//
// This is plain JavaScript with no DOM and no ONNX dependency, exactly like public/engine/yolo-codec.js,
// so the decode can be unit-tested on synthetic tensors in Node without a GPU.
//
// Every convention below was MEASURED against the real model in headless Chromium on a real
// photograph, not assumed from the Ultralytics documentation. The measurements are recorded in
// docs/NUTRITION_AI_ACCURACY_REPORT.md and pinned by tests/nutrition-seg-codec.test.mjs.
//
//   - The output tensor is CHANNEL-MAJOR: element (channel, anchor) is at data[channel * anchors + anchor].
//     Reading it anchor-major produces plausible-looking garbage (observed scores of 915 and 772
//     where the true maximum was 0.662), so the indexing is pinned by a unit test.
//   - Class scores are ALREADY probabilities. The maximum observed on a real plate was 0.662, so
//     no sigmoid is applied to them.
//   - The mask prototypes are RAW LOGITS (observed range -0.278 to 4.156, with 34% negative values),
//     so the mask logit is the plain sum of coefficient * prototype and the mask is where that sum
//     is greater than zero. Applying a sigmoid to the prototypes instead collapses the mask to
//     nothing (0% of the box), which is how the alternative was ruled out.
//   - The image is LETTERBOXED, not stretched, and the padded band is excluded from mask areas.
//
// This decoder produces proposals. It never produces a nutrition value, and it never decides what a
// person ate - see public/app/nutrition/vision/contract.js for the validated output shape.

/** The pinned model's shape and conventions. */
export const SEG = Object.freeze({
  inputSize: 768,
  anchors: 12096,
  numClasses: 104,
  numMasks: 32,
  boxChannels: 4,
  /** The prototype grid is the input grid divided by this. */
  protoScale: 4,
  /** Ultralytics' letterbox pad colour, as a normalised 0-1 triple. */
  padValue: 114 / 255,
  /** Class 0 of FoodSeg103 is "background": it is never a food and is never shown. */
  backgroundClass: 0,
});

/**
 * Letterbox geometry for the export's input size.
 *
 * The picture is scaled to fit the square and padded with the Ultralytics grey, centred, so the
 * geometry the mask depends on is preserved. Measured on a 640x480 photograph: scale 1.2, resized
 * 768x576, top pad 96, left pad 0.
 *
 * @param {number} width original width in pixels
 * @param {number} height original height in pixels
 * @param {number} [size] the model's input size
 * @returns {{scale:number, resizedWidth:number, resizedHeight:number, left:number, top:number, right:number, bottom:number, size:number, originalWidth:number, originalHeight:number}}
 */
export function letterbox(width, height, size = SEG.inputSize) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new RangeError("Letterbox needs a positive width and height.");
  const scale = Math.min(size / width, size / height);
  const resizedWidth = Math.round(width * scale);
  const resizedHeight = Math.round(height * scale);
  // Ultralytics rounds the padding with a -0.1 bias so a centred image lands exactly.
  // The + 0 turns Math.round's -0 into 0, so an exactly centred picture has a plain zero pad.
  const left = Math.round((size - resizedWidth) / 2 - 0.1) + 0;
  const top = Math.round((size - resizedHeight) / 2 - 0.1) + 0;
  return {
    scale,
    resizedWidth,
    resizedHeight,
    left,
    top,
    right: left + resizedWidth,
    bottom: top + resizedHeight,
    size,
    originalWidth: width,
    originalHeight: height,
  };
}

/**
 * How many anchor columns a decoded tensor holds.
 *
 * The class and mask counts are derived from the tensor shape rather than hard-coded, so an export
 * with a different number of classes still decodes instead of silently reading the wrong columns.
 *
 * @param {number[]} dims the output tensor dimensions
 * @returns {{channels:number, anchors:number, numClasses:number}}
 */
export function tensorLayout(dims) {
  if (!Array.isArray(dims) || dims.length !== 3)
    throw new RangeError(`Unsupported segmentation output shape ${JSON.stringify(dims)}.`);
  const [batch, channels, anchors] = dims;
  if (batch !== 1) throw new RangeError(`Expected a batch of 1, got ${batch}.`);
  if (!Number.isInteger(anchors) || anchors <= 0) throw new RangeError("Anchor count must be positive.");
  if (!Number.isInteger(channels) || channels <= SEG.boxChannels + SEG.numMasks)
    throw new RangeError(`Expected more than ${SEG.boxChannels + SEG.numMasks} channels, got ${channels}.`);
  // The mask coefficient count is fixed by the export; the rest are class scores.
  const numClasses = channels - SEG.boxChannels - SEG.numMasks;
  return { channels, anchors, numClasses };
}

/**
 * The boxes and scores of every candidate, before suppression.
 *
 * @param {Float32Array} data the raw output0 tensor
 * @param {number[]} dims its dimensions, [1, channels, anchors]
 * @param {{confThreshold?:number}} [opts]
 * @returns {{anchor:number, classId:number, score:number, box:{x:number,y:number,w:number,h:number}, coeffs:Float32Array}[]}
 */
export function decodeCandidates(data, dims, opts = {}) {
  const { anchors, numClasses } = tensorLayout(dims);
  const confThreshold = opts.confThreshold ?? 0.25;
  const out = [];
  for (let anchor = 0; anchor < anchors; anchor++) {
    let score = -1;
    let classId = -1;
    for (let c = 0; c < numClasses; c++) {
      const v = data[(SEG.boxChannels + c) * anchors + anchor];
      if (v > score) {
        score = v;
        classId = c;
      }
    }
    // The background class is not a food.
    if (classId === SEG.backgroundClass) continue;
    if (!Number.isFinite(score) || score < confThreshold) continue;
    const cx = data[0 * anchors + anchor];
    const cy = data[1 * anchors + anchor];
    const w = data[2 * anchors + anchor];
    const h = data[3 * anchors + anchor];
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(w) || !Number.isFinite(h)) continue;
    if (w <= 0 || h <= 0) continue;
    const coeffs = new Float32Array(SEG.numMasks);
    for (let k = 0; k < SEG.numMasks; k++) coeffs[k] = data[(SEG.boxChannels + numClasses + k) * anchors + anchor];
    out.push({
      anchor,
      classId,
      score,
      box: { x: cx - w / 2, y: cy - h / 2, w, h },
      coeffs,
    });
  }
  return out;
}

/**
 * The overlap of two boxes, as a fraction of the smaller box's area.
 *
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 * @returns {number}
 */
export function boxIou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const iw = x2 - x1;
  const ih = y2 - y1;
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  return smaller > 0 ? inter / smaller : 0;
}

/**
 * Per-class greedy suppression.
 *
 * Two different foods may sit on top of each other, so suppression never removes a box just because
 * another class overlaps it - only the same class competes.
 *
 * @param {{classId:number, score:number, box:any}[]} candidates
 * @param {number} [iouThreshold]
 * @returns {typeof candidates}
 */
export function suppress(candidates, iouThreshold = 0.45) {
  const kept = [];
  for (const cand of [...candidates].sort((a, b) => b.score - a.score)) {
    const blocked = kept.some(
      (k) => k.classId === cand.classId && boxIou(k.box, cand.box) > iouThreshold,
    );
    if (!blocked) kept.push(cand);
  }
  return kept;
}

/**
 * The mask of one instance, as the prototype grid.
 *
 * The mask logit at a prototype pixel is the plain sum of coefficient * prototype across the 32
 * channels; the pixel is inside the mask when that sum is greater than zero. The result is cropped
 * to the instance's box, as Ultralytics does.
 *
 * @param {Float32Array} coeffs the 32 mask coefficients for one instance
 * @param {Float32Array} protoData the raw output1 tensor
 * @param {number[]} protoDims its dimensions, [1, 32, height, width]
 * @param {{x:number,y:number,w:number,h:number}} box the instance box in INPUT pixels
 * @returns {{data:Uint8Array, width:number, height:number, x:number, y:number}} 1 means inside
 */
export function buildMask(coeffs, protoData, protoDims, box) {
  if (!Array.isArray(protoDims) || protoDims.length !== 4) throw new RangeError("Unexpected prototype shape.");
  const [, channels, height, width] = protoDims;
  if (channels !== SEG.numMasks) throw new RangeError(`Expected ${SEG.numMasks} prototype channels, got ${channels}.`);
  const x0 = Math.max(0, Math.floor(box.x / SEG.protoScale));
  const y0 = Math.max(0, Math.floor(box.y / SEG.protoScale));
  const x1 = Math.min(width, Math.ceil((box.x + box.w) / SEG.protoScale));
  const y1 = Math.min(height, Math.ceil((box.y + box.h) / SEG.protoScale));
  const outW = Math.max(0, x1 - x0);
  const outH = Math.max(0, y1 - y0);
  const data = new Uint8Array(outW * outH);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      let logit = 0;
      for (let k = 0; k < SEG.numMasks; k++) {
        const coefficient = coeffs[k];
        // A non-finite coefficient would make the whole logit NaN, and every comparison against
        // NaN is false, so the mask would come back silently empty. Skip it instead.
        if (!Number.isFinite(coefficient)) continue;
        logit += coefficient * protoData[(k * height + py) * width + px];
      }
      data[(py - y0) * outW + (px - x0)] = logit > 0 ? 1 : 0;
    }
  }
  return { data, width: outW, height: outH, x: x0, y: y0 };
}

/**
 * The area of a mask in the ORIGINAL picture's pixels.
 *
 * Each prototype pixel covers a 4x4 block of input pixels. A block that lies in the letterbox pad
 * band is clipped away, so a mask sitting entirely in the padding has an area of exactly zero -
 * the single most common way to get a wildly wrong portion estimate.
 *
 * @param {{data:Uint8Array,width:number,height:number,x:number,y:number}} mask
 * @param {ReturnType<typeof letterbox>} lb
 * @returns {{areaPx:number, areaRatio:number}} areaPx is in original-image pixels
 */
export function maskArea(mask, lb) {
  let areaInputPx = 0;
  const block = SEG.protoScale;
  for (let py = 0; py < mask.height; py++) {
    for (let px = 0; px < mask.width; px++) {
      if (!mask.data[py * mask.width + px]) continue;
      const ix0 = (mask.x + px) * block;
      const iy0 = (mask.y + py) * block;
      // Clip against the picture itself and against the letterboxed content.
      const cx0 = Math.max(ix0, 0);
      const cx1 = Math.min(ix0 + block, lb.size);
      const cy0 = Math.max(iy0, 0);
      const cy1 = Math.min(iy0 + block, lb.size);
      const kx0 = Math.max(cx0, lb.left);
      const kx1 = Math.min(cx1, lb.right);
      const ky0 = Math.max(cy0, lb.top);
      const ky1 = Math.min(cy1, lb.bottom);
      if (kx1 > kx0 && ky1 > ky0) areaInputPx += (kx1 - kx0) * (ky1 - ky0);
    }
  }
  const areaPx = areaInputPx / (lb.scale * lb.scale);
  const picture = lb.originalWidth * lb.originalHeight;
  return { areaPx, areaRatio: picture > 0 ? areaPx / picture : 0 };
}

/**
 * Project a box from the model's input pixels back onto the original picture.
 *
 * @param {{x:number,y:number,w:number,h:number}} box in input pixels
 * @param {ReturnType<typeof letterbox>} lb
 * @returns {{x:number,y:number,w:number,h:number}} in original pixels
 */
export function unprojectBox(box, lb) {
  return {
    x: (box.x - lb.left) / lb.scale,
    y: (box.y - lb.top) / lb.scale,
    w: box.w / lb.scale,
    h: box.h / lb.scale,
  };
}

/**
 * The whole decode: candidates, suppression, masks and areas.
 *
 * @param {Float32Array} data output0
 * @param {number[]} dims output0's dimensions
 * @param {Float32Array} protoData output1
 * @param {number[]} protoDims output1's dimensions
 * @param {{confThreshold?:number, iouThreshold?:number, width:number, height:number}} opts
 * @returns {{classId:number, score:number, box:any, areaPx:number, areaRatio:number, mask:any}[]}
 */
export function decodeSegments(data, dims, protoData, protoDims, opts) {
  const lb = letterbox(opts.width, opts.height);
  const candidates = decodeCandidates(data, dims, { confThreshold: opts.confThreshold });
  const kept = suppress(candidates, opts.iouThreshold ?? 0.45);
  return kept.map((cand) => {
    const mask = buildMask(cand.coeffs, protoData, protoDims, cand.box);
    const { areaPx, areaRatio } = maskArea(mask, lb);
    return {
      classId: cand.classId,
      score: cand.score,
      box: unprojectBox(cand.box, lb),
      areaPx,
      areaRatio,
      mask,
    };
  });
}
