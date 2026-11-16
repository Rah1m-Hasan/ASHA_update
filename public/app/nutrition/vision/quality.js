// Image quality, and what to tell the person when the picture is not good enough.
//
// The rule this file exists to enforce: a picture that is too dark, too blurry, too small or
// half out of frame must NOT produce an authoritative calorie number. It should produce a
// sentence the person can act on.
//
// This is an extension of `public/app/everyday/foods.js`'s `checkPhotoQuality`, not a replacement.
// The older function answers "is this photo usable"; this one answers "why not, and what should
// the person do about it", and it separates the checks that are about the PHOTOGRAPH from the
// ones that would need a trained model to judge the FOOD.
//
// Every message is written to be read by the person who took the picture. "Move closer" is
// actionable. "Image quality is 0.42" is not.

/** The codes this module can report. The interface maps each to a sentence. */
export const QUALITY_CODES = Object.freeze([
  "low_light",
  "overexposed",
  "low_detail_or_blur",
  "low_resolution",
  "partial_plate",
  "occluded",
  "extreme_angle",
  "no_plate",
]);

/**
 * The sentences, in English and Bangla.
 *
 * The order matters: the first problem listed is the one worth fixing first. Too dark AND blurry
 * is usually one problem - not enough light - so the light comes first.
 */
export const QUALITY_TEXT = Object.freeze({
  low_light: {
    en: "The picture is too dark. Move somewhere with more light, or turn on a lamp.",
    bn: "ছবিটি খুব অন্ধকার। আরও আলোর জায়গায় যান, অথবা বাতি জ্বালান।",
  },
  overexposed: {
    en: "The picture is too bright. Move away from a strong light so the food is not washed out.",
    bn: "ছবিটি খুব উজ্জ্বল। কড়া আলো থেকে একটু দূরে যান, যাতে খাবারের রং মিলে যায় না।",
  },
  low_detail_or_blur: {
    en: "The picture is blurry. Hold the phone steady and take it again.",
    bn: "ছবিটি ঝাপসা। ফোন স্থির রেখে আবার তুলুন।",
  },
  low_resolution: {
    en: "The picture is too small to read the food. Move a little closer.",
    bn: "খাবার চেনার জন্য ছবিটি ছোট। একটু কাছে গিয়ে ছবি তুলুন।",
  },
  partial_plate: {
    en: "Only part of the plate is in the picture. Fit the whole plate in the frame.",
    bn: "প্লেটের অংশ বই ছবিতে আছে। পুরো প্লেটটি ছবির মধ্যে আনুন।",
  },
  occluded: {
    en: "Something is covering the food, so ASHA cannot see what is there. Move the cover away.",
    bn: "খাবারের উপরে কিছু ঢেকে আছে, তাই আশা কী আছে দেখতে পারছে না। ঢাকাটা সরিয়ে দিন।",
  },
  extreme_angle: {
    en: "The picture is taken from too low or too high. Take it from just above the plate.",
    bn: "ছবিটি খুব নিচু বা খুব উঁচু থেকে নেওয়া। প্লেটের ঠিক উপর থেকে ছবি তুলুন।",
  },
  no_plate: {
    en: "ASHA could not find a plate or a bowl in the picture.",
    bn: "ছবিতে কোনো প্লেট বা বাটি খুঁজে পাওয়া যায়নি।",
  },
});

/**
 * The message for a code, in the person's language.
 *
 * @param {string} code
 * @param {string} lang
 * @returns {string}
 */
export function qualityMessage(code, lang = "en") {
  const text = QUALITY_TEXT[code];
  if (!text) return lang === "bn" ? "ছবির সমস্যা।" : "There is a problem with the picture.";
  return lang === "bn" ? text.bn : text.en;
}

/**
 * The messages for several codes, in the order the codes are given.
 *
 * @param {string[]} codes
 * @param {string} lang
 * @returns {string[]}
 */
export function qualityMessages(codes, lang = "en") {
  return (codes ?? []).map((code) => qualityMessage(code, lang));
}

/**
 * The brightness of a picture, as the mean of the luminance.
 *
 * @param {Uint8ClampedArray} rgba
 * @returns {number} 0 to 255
 */
export function meanLuma(rgba) {
  if (!rgba || rgba.length < 4) return 0;
  let total = 0;
  let count = 0;
  // Every 16th pixel is enough for a mean and keeps the check quick on a phone.
  for (let i = 0; i < rgba.length; i += 64) {
    total += 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    count += 1;
  }
  return count ? total / count : 0;
}

/**
 * How much detail the picture has, as the variance of a Laplacian.
 *
 * A blurry picture has a low variance no matter how bright it is, which is why blur and light
 * are checked separately.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
export function laplacianVariance(rgba, width, height) {
  if (!rgba || width < 3 || height < 3) return 0;
  const at = (x, y) => {
    const i = (y * width + x) * 4;
    return 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  };
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const value = 4 * at(x, y) - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1);
      sum += value;
      sumSquares += value * value;
      count += 1;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

/**
 * How much of the frame is bright enough to be food.
 *
 * A picture where the food fills only a small part of the frame is harder to judge, and one
 * where a bright object covers the middle is a different problem from a dark one.
 *
 * @param {Uint8ClampedArray} rgba
 * @returns {{litRatio:number, brightRatio:number, darkRatio:number}}
 */
export function coverage(rgba) {
  if (!rgba || rgba.length < 4) return { litRatio: 0, brightRatio: 0, darkRatio: 0 };
  let lit = 0;
  let bright = 0;
  let dark = 0;
  let count = 0;
  for (let i = 0; i < rgba.length; i += 64) {
    const luma = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    if (luma > 28) lit += 1;
    if (luma > 240) bright += 1;
    if (luma < 28) dark += 1;
    count += 1;
  }
  return {
    litRatio: count ? lit / count : 0,
    brightRatio: count ? bright / count : 0,
    darkRatio: count ? dark / count : 0,
  };
}

/**
 * The thresholds.
 *
 * These are the same numbers the Everyday module has used, so the two surfaces do not disagree
 * about the same picture. They are heuristics for a phone camera, not a measurement.
 */
export const QUALITY_THRESHOLDS = Object.freeze({
  minWidth: 320,
  minHeight: 320,
  darkLuma: 58,
  brightLuma: 218,
  brightRatio: 0.35,
  minLaplacianVariance: 55,
  minLitRatio: 0.12,
});

/**
 * Look at a picture and say what is wrong with it.
 *
 * Only the checks a brightness and detail measurement can make are made here. `partial_plate`,
 * `occluded` and `extreme_angle` are in the code list, but a brightness histogram cannot tell
 * them apart: knowing that only part of a plate is in frame needs a plate detector, and knowing
 * that a bowl hides half the food needs a depth or a second view. Those codes are for a caller
 * that has one. Reporting them here would be a guess dressed as a measurement.
 *
 * The result is a list of codes, worst first. An empty list means the picture is usable for
 * recognition. It does NOT mean the food was recognised: only the model can say that.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @param {{minWidth?:number,minHeight?:number}} [limits] the size limits the caller enforces
 * @returns {{ok:boolean, codes:string[], luma:number, detail:number, litRatio:number}}
 */
export function assessImageQuality(rgba, width, height, limits = {}) {
  const minWidth = limits.minWidth ?? QUALITY_THRESHOLDS.minWidth;
  const minHeight = limits.minHeight ?? QUALITY_THRESHOLDS.minHeight;
  const codes = [];

  if (!rgba || !Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) {
    return { ok: false, codes: ["low_resolution"], luma: 0, detail: 0, litRatio: 0 };
  }

  const luma = meanLuma(rgba);
  const detail = laplacianVariance(rgba, width, height);
  const { litRatio, brightRatio } = coverage(rgba);

  if (width < minWidth || height < minHeight) codes.push("low_resolution");
  if (luma < QUALITY_THRESHOLDS.darkLuma) codes.push("low_light");
  if (brightRatio > QUALITY_THRESHOLDS.brightRatio || luma > QUALITY_THRESHOLDS.brightLuma) {
    codes.push("overexposed");
  }
  if (detail < QUALITY_THRESHOLDS.minLaplacianVariance) codes.push("low_detail_or_blur");
  // Almost nothing lit, or everything lit, both mean the frame is not a plate of food.
  if (litRatio < QUALITY_THRESHOLDS.minLitRatio) codes.push("no_plate");

  return { ok: codes.length === 0, codes, luma, detail, litRatio };
}
