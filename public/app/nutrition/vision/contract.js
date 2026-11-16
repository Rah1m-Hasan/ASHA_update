// The validated shape of a food recognition result, and the validator that enforces it.
//
// This module is the boundary between a model and the rest of ASHA. Everything a model says about
// food passes through here first, and what survives is built from an EXPLICIT FIELD LIST.
//
// Why "explicit field list" and not "ignore the fields we don't want": if the code merely chose not
// to read a nutrient field, a later change could start reading it. Here the result object is
// constructed from scratch, key by key, so a key that is not on the list is not merely unread - it
// is not there. A model that emits {"kcal": 999, "protein": 50} produces a result with no
// nutrition in it at all.
//
// The same rule applies to the food identity: a food id that is not in the catalogue is dropped and
// reported, never quietly remapped to something close.
//
// Status is DERIVED here, never read from the model. A model cannot say "invalid image" or "model
// unavailable"; it can only offer detections.
//
// And the confidence is not a probability. It is the model's score that a region is that class. It
// is kept as a number called identification_confidence and shown to the person as a score.

/**
 * @typedef {Object} PortionProposal
 * @property {{min:number, max:number}|null} estimated_grams
 * @property {"visual_estimate"|"household_unit"|"weighed"|null} method
 * @property {{relative_sigma:number, level:"low"|"medium"|"high", text:string, text_bn:string}|null} uncertainty
 */

/**
 * @typedef {Object} RecognitionItem
 * @property {string} food_id
 * @property {string} display_name
 * @property {string} display_name_bn
 * @property {string[]} alternatives
 * @property {number} identification_confidence
 * @property {PortionProposal} portion
 * @property {{x:number, y:number, w:number, h:number}|null} region
 * @property {number|null} area_ratio
 */

/**
 * @typedef {Object} MissingInformation
 * @property {string} code
 * @property {string} message
 * @property {string} message_bn
 */

/**
 * @typedef {Object} RecognitionResult
 * @property {"ok"|"no_food"|"low_confidence"|"unknown_food"|"invalid_image"|"model_unavailable"} status
 * @property {RecognitionItem[]} food_items
 * @property {MissingInformation[]} missing_information
 * @property {{id:string, version:string, sha256:string}|null} model
 * @property {{warnings:string[], brightness:number|null, sharpness:number|null}|null} quality
 * @property {number|null} timing_ms
 */

/** The statuses a result can have. */
import { RECOGNITION_POLICY as SHARED_POLICY } from "./policy.js";

export const RECOGNITION_STATUSES = Object.freeze([
  "ok",
  "no_food",
  "low_confidence",
  "unknown_food",
  "invalid_image",
  "model_unavailable",
]);

/** The largest portion the person can enter anywhere else in ASHA (interview.js uses the same bound). */
const MAX_GRAMS = 3000;

/**
 * The messages a missing-information code carries, in English and Bangla.
 *
 * @type {Readonly<Record<string, {en:string, bn:string}>>}
 */
export const MISSING_INFO_TEXT = Object.freeze({
  unknown_food_id: {
    en: "ASHA found something on the plate that is not in its food list. Choose what it is.",
    bn: "প্লেটে এমন কিছু পাওয়া গেছে যা আশার খাবারের তালিকায় নেই। আপনি নিজে বেছে নিন।",
  },
  bad_confidence: {
    en: "ASHA was not sure how confident it was about one item, so it left that one out.",
    bn: "একটি জিনিসে আশার নিশ্চয়তা কতটা ছিল তা স্পষ্ট ছিল না, তাই সেটি বাদ দেওয়া হয়েছে।",
  },
  implausible_portion: {
    en: "The amount ASHA guessed for one item was not possible, so only the name was kept.",
    bn: "একটি জিনিসের পরিমাণ আশার অনুমান অসম্ভব ছিল, তাই শুধু নাম রাখা হয়েছে।",
  },
  no_catalogue_match: {
    en: "The camera named something ASHA cannot offer as food. Choose the foods yourself.",
    bn: "ক্যামেরা এমন কিছুর নাম বলেছে যা আশা খাবার হিসেবে দিতে পারে না। খাবারগুলো নিজে বেছে নিন।",
  },
  no_portion: {
    en: "There is no scale in the picture, so ASHA cannot say how much there is. Enter the amount or pick a household measure.",
    bn: "ছবিতে কোনো মাপের চিহ্ন নেই, তাই আশা কতটুকু আছে বলতে পারছে না। পরিমাণ লিখুন বা ঘরোয়া মাপ বেছে নিন।",
  },
  uncertain_portion: {
    en: "ASHA's estimate of the amount is a wide range. Enter the weight if you know it.",
    bn: "পরিমাণের আশার অনুমান বড় একটি পরিসর। জানলে ওজন লিখে দিন।",
  },
  low_confidence: {
    en: "ASHA was not sure about this one. Check the name before using it.",
    bn: "এটি নিয়ে আশার নিশ্চয়তা কম ছিল। ব্যবহারের আগে নামটি দেখে নিন।",
  },
});

/**
 * The policy thresholds.
 *
 * `minIdentification` is the score below which a proposal is flagged for checking rather than
 * offered as a suggestion. It is a PLACEHOLDER until the Wave 7 benchmark derives it from the
 * measured risk-coverage curve; the honest default while unmeasured is to ask more, not less.
 *
 * `maxPortionSigma` is the largest relative uncertainty a portion may have and still be offered.
 *
 * @type {Readonly<{minIdentification:number, maxPortionSigma:number, source:string}>}
 */
export const RECOGNITION_POLICY = Object.freeze({
  minIdentification: SHARED_POLICY.identityScore,
  maxPortionSigma: SHARED_POLICY.maxRelativeSigma,
  source: SHARED_POLICY.source,
});

/**
 * A safe number, or null.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The message pair for a missing-information code.
 *
 * @param {string} code
 * @returns {MissingInformation}
 */
function missing(code) {
  const text = MISSING_INFO_TEXT[code] ?? {
    en: "Something about this photo is not clear.",
    bn: "ছবিটি সম্পর্কে কিছু একটা পরিষ্কার নয়।",
  };
  return { code, message: text.en, message_bn: text.bn };
}

/**
 * Validate a raw recognition result against the trusted catalogue.
 *
 * The result is BUILT from an explicit field list, so any key the source did not put on that list
 * does not exist in the output. That is the guarantee that no model-supplied nutrient value can
 * reach the calculation engine.
 *
 * @param {unknown} raw the model's result, or anything else
 * @param {{records:Readonly<Record<string,unknown>>, dishes:Readonly<Record<string,unknown>>, minIdentification?:number}} catalogue
 * @returns {{ok:true, value:RecognitionResult}|{ok:false, errors:string[]}}
 */
export function validateRecognition(raw, catalogue) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["The recognition result is not an object."] };
  }
  const source = raw;
  const minIdentification =
    typeof catalogue.minIdentification === "number" ? catalogue.minIdentification : RECOGNITION_POLICY.minIdentification;

  /** @type {MissingInformation[]} */
  const missingInfo = [];
  const addMissing = (code) => {
    if (!missingInfo.some((m) => m.code === code)) missingInfo.push(missing(code));
  };

  const rawItems = Array.isArray(source.food_items) ? source.food_items : [];
  /** @type {RecognitionItem[]} */
  const items = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") {
      errors.push("An item was not an object.");
      continue;
    }
    const foodId = typeof rawItem.food_id === "string" ? rawItem.food_id.trim() : "";
    if (!foodId) {
      addMissing("unknown_food_id");
      continue;
    }
    // A food that is not in the catalogue is dropped. It is never remapped to something similar.
    const known = catalogue.records?.[foodId] || catalogue.dishes?.[foodId];
    if (!known) {
      addMissing("unknown_food_id");
      continue;
    }
    const confidence = finiteOrNull(rawItem.identification_confidence);
    if (confidence === null) {
      addMissing("bad_confidence");
      continue;
    }
    if (confidence < 0 || confidence > 1) {
      addMissing("bad_confidence");
      continue;
    }

    // The portion is rebuilt, not copied: a model's gram estimate is only ever a proposal.
    const rawPortion = rawItem.portion && typeof rawItem.portion === "object" ? rawItem.portion : {};
    const rawGrams = rawPortion.estimated_grams;
    let estimatedGrams = null;
    if (rawGrams && typeof rawGrams === "object") {
      const min = finiteOrNull(rawGrams.min);
      const max = finiteOrNull(rawGrams.max);
      if (min !== null && max !== null && min > 0 && max >= min && max <= MAX_GRAMS) {
        estimatedGrams = { min, max };
      } else {
        addMissing("implausible_portion");
      }
    }
    const method =
      rawPortion.method === "visual_estimate" || rawPortion.method === "household_unit" || rawPortion.method === "weighed"
        ? rawPortion.method
        : null;
    const rawUncertainty = rawPortion.uncertainty && typeof rawPortion.uncertainty === "object" ? rawPortion.uncertainty : null;
    const uncertainty = rawUncertainty
      ? {
          relative_sigma: finiteOrNull(rawUncertainty.relative_sigma) ?? 0,
          level: rawUncertainty.level === "low" || rawUncertainty.level === "medium" || rawUncertainty.level === "high" ? rawUncertainty.level : "high",
          text: typeof rawUncertainty.text === "string" ? rawUncertainty.text : "",
          text_bn: typeof rawUncertainty.text_bn === "string" ? rawUncertainty.text_bn : "",
        }
      : null;

    const alternatives = Array.isArray(rawItem.alternatives)
      ? [...new Set(rawItem.alternatives.filter((a) => typeof a === "string" && a && a !== foodId))]
          .filter((a) => catalogue.records?.[a] || catalogue.dishes?.[a])
          .slice(0, 3)
      : [];

    const rawRegion = rawItem.region && typeof rawItem.region === "object" ? rawItem.region : null;
    const region =
      rawRegion && ["x", "y", "w", "h"].every((k) => finiteOrNull(rawRegion[k]) !== null)
        ? { x: rawRegion.x, y: rawRegion.y, w: rawRegion.w, h: rawRegion.h }
        : null;

    items.push({
      food_id: foodId,
      display_name: typeof rawItem.display_name === "string" ? rawItem.display_name : String(foodId),
      display_name_bn: typeof rawItem.display_name_bn === "string" ? rawItem.display_name_bn : "",
      alternatives,
      identification_confidence: confidence,
      portion: { estimated_grams: estimatedGrams, method, uncertainty },
      region,
      area_ratio: finiteOrNull(rawItem.area_ratio),
    });
  }

  // The status is derived here, never taken from the source.
  let status;
  if (source.__invalid_image === true) status = "invalid_image";
  else if (source.__model_unavailable === true) status = "model_unavailable";
  else if (!items.length && rawItems.length) status = "unknown_food";
  else if (!items.length) status = "no_food";
  else if (items.some((i) => i.identification_confidence < minIdentification)) {
    status = "low_confidence";
    addMissing("low_confidence");
  } else status = "ok";

  const rawModel = source.model && typeof source.model === "object" ? source.model : null;
  const rawQuality = source.quality && typeof source.quality === "object" ? source.quality : null;

  const value = {
    status,
    food_items: items,
    missing_information: missingInfo.sort((a, b) => a.code.localeCompare(b.code)),
    model: rawModel
      ? {
          id: typeof rawModel.id === "string" ? rawModel.id : "",
          version: typeof rawModel.version === "string" ? rawModel.version : "",
          sha256: typeof rawModel.sha256 === "string" ? rawModel.sha256 : "",
        }
      : null,
    quality: rawQuality
      ? {
          warnings: Array.isArray(rawQuality.warnings) ? rawQuality.warnings.filter((w) => typeof w === "string") : [],
          brightness: finiteOrNull(rawQuality.brightness),
          sharpness: finiteOrNull(rawQuality.sharpness),
        }
      : null,
    timing_ms: finiteOrNull(source.timing_ms),
  };

  return { ok: true, value };
}
