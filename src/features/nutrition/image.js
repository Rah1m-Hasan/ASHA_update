// Checks for an uploaded photo before anything else touches it. The file's own bytes decide its
// type (not its name or the browser's guess), then size and dimensions are checked. The photo is
// redrawn onto a canvas at most 1280 px across, which applies the EXIF rotation and leaves all
// metadata (location, camera, time) behind; only that copy is used, and it stays on this device.
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_PIXELS = 40e6;
export const MIN_SIDE = 160;
export const WORK_SIDE = 1280;

const t = (en, bn) => ({ en, bn });
export const IMAGE_ERRORS = Object.freeze({
  empty: t("This file is empty. Choose another photo.", "ফাইলটি খালি। অন্য ছবি বাছুন।"),
  too_big: t("This photo is larger than 15 MB. Choose a smaller one, or take a screenshot of it.", "ছবিটি ১৫ MB-র বেশি। ছোট ছবি বাছুন, বা ছবিটির স্ক্রিনশট নিন।"),
  not_image: t("This isn't a photo ASHA can read. Use a JPEG, PNG, WebP or HEIC photo.", "এটি আশার পড়ার মতো ছবি নয়। JPEG, PNG, WebP বা HEIC ছবি দিন।"),
  gif: t("Moving images (GIF) aren't supported. Choose a still photo.", "চলমান ছবি (GIF) চলে না। স্থির ছবি বাছুন।"),
  heic_unsupported: t("This browser can't open HEIC photos. On an iPhone, choose Settings › Camera › Formats › Most Compatible, or take a screenshot of the photo and upload that.", "এই ব্রাউজার HEIC ছবি খুলতে পারে না। iPhone-এ Settings › Camera › Formats › Most Compatible বাছুন, বা ছবিটির স্ক্রিনশট আপলোড করুন।"),
  decode_failed: t("The photo couldn't be opened. It may be damaged. Try another one.", "ছবিটি খোলা যায়নি। হয়তো নষ্ট। অন্য ছবি চেষ্টা করুন।"),
  too_small: t("This photo is too small to show the food clearly (under 160 px). Choose a larger one.", "ছবিটি খুব ছোট (১৬০ পিক্সেলের কম), খাবার পরিষ্কার দেখা যায় না। বড় ছবি দিন।"),
  too_many_pixels: t("This photo has too many pixels to open safely on a phone (over 40 megapixels).", "ছবিটিতে খুব বেশি পিক্সেল (৪০ মেগাপিক্সেলের বেশি), ফোনে নিরাপদে খোলা যায় না।"),
});

/** The real file type from its first bytes. */
export function sniffImageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  const ascii = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a) return "image/png";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (b.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return "image/gif";
  if (b.length >= 12 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

/** First check, from the bytes and size alone. */
export function checkFile({ bytes, size }) {
  if (!size) return { ok: false, code: "empty" };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, code: "too_big" };
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, code: "not_image" };
  if (type === "image/gif") return { ok: false, code: "gif", type };
  return { ok: true, type };
}

/** Second check, once decoded. */
export function checkDimensions(width, height) {
  if (!(width > 0 && height > 0)) return { ok: false, code: "decode_failed" };
  if (width * height > MAX_PIXELS) return { ok: false, code: "too_many_pixels" };
  if (Math.min(width, height) < MIN_SIDE) return { ok: false, code: "too_small" };
  return { ok: true };
}

/** Size of the working copy: the longest side at most 1280 px. */
export function fitWithin(width, height, max = WORK_SIDE) {
  const s = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)) };
}

export const errorText = (code, lang = "en") => (IMAGE_ERRORS[code] ?? IMAGE_ERRORS.decode_failed)[lang === "bn" ? "bn" : "en"];
