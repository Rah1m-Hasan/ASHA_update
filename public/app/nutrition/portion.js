// Portion estimation from a photograph.
//
// WHAT A TOP-DOWN PHOTO CAN AND CANNOT TELL YOU
//
// A photograph of a plate gives AREA. It does not give volume, and it does not give thickness.
// A food's thickness and its density cannot be told apart from one image - only their product can.
// So this module does not pretend to measure a height and multiply by a density. It works in AREAL
// DENSITY: grams per square centimetre of plate.
//
//   grams  =  area_cm2  x  areal_density_g_per_cm2  x  shape_factor
//
// The areal density comes from a USDA household portion: a portion has a gram weight AND a vessel,
// and the vessel has a footprint. "One cup of cooked rice is 158 g" and a US cup is a circle of
// diameter 8.0 cm, so the footprint is 50.27 cm2 and the areal density is 158 / 50.27 = 3.143 g/cm2.
// The derivation is kept next to the number so a reader can check it.
//
// A portion defined by VOLUME (a tablespoon, a teaspoon, a fluid ounce) has no footprint, so it
// cannot give an areal density. Oil, sugar and salt therefore stay on the spoon path and never
// enter the area path.
//
// THE MOST IMPORTANT RULE
//
// With no scale, there is NO gram estimate. Not an assumed plate, not a guess, no number at all.
// The item falls back to the person's own answer (a household measure or a typed weight) and the
// status is "uncertain" with the reason recorded. Two taps and a plate diameter is the whole cost
// of an honest number; if that is too much for a particular person, that person gets the food
// identity without a weight, which is still useful and still honest.
//
// UNCERTAINTY IS NOT CONFIDENCE
//
// The two are separate and are never mixed. Identification confidence answers "is this the right
// food?". Portion uncertainty answers "how wrong could this weight be?". A food can be named
// confidently and still have a wide weight range, and the other way round.
//
// The gram range is a rough range, not a confidence interval. It does not carry a 68% or 95%
// meaning and the wording says so.

// The footprint of the vessels USDA defines its portions in.
//
// A US cup is 8.0 cm across at the rim, which is the measure the USDA portion tables use. These
// are stated here so the areal densities below can be checked by hand.
//
export const VESSEL_FOOTPRINT_CM2 = Object.freeze({
  cup: Math.PI * 4 * 4, // 50.27 cm2 - a US cup, 8.0 cm across
  bowl: Math.PI * 6 * 6, // 113.10 cm2 - a 12 cm bowl
  plate: Math.PI * 11 * 11, // 380.13 cm2 - a 22 cm dinner plate
});

/**
 * @typedef {Object} ArealDensity
 * @property {number} gPerCm2
 * @property {number} min the lowest areal density from the food's household portions
 * @property {number} max the highest
 * @property {string} sourceRecordId the USDA portion row the derivation came from
 * @property {string} derivation a readable form of the calculation
 */

/**
 * @typedef {Object} Scale
 * @property {number} cmPerPx
 * @property {number} relativeError the relative error of the scale itself
 * @property {string} reference what the scale was set with
 */

/**
 * The shape factor range: a flat single layer through to a modest mound.
 *
 * The upper bound may still be too low for a tall heap. That is the direction of the bias and it
 * is stated rather than hidden.
 */
export const SHAPE_FACTOR = Object.freeze({ min: 1.0, max: 1.6 });

/**
 * The relative spread attributed to the shape factor.
 */
const SHAPE_SIGMA = 0.23;

/**
 * The reference objects a person can set the scale with.
 *
 * The plate is the default because a plate is already in the picture; a card is offered as well
 * because a credit-card-sized card is the thing a household is most likely to have.
 *
 * @type {Readonly<Record<string, {id:string, en:string, bn:string, cm:number}>>}
 */
export const REFERENCES = Object.freeze({
  plate_6in: { id: "plate_6in", en: "6 inch plate (15 cm)", bn: "৬ ইঞ্চির থালা (১৫ সেমি)", cm: 15.24 },
  plate_7in: { id: "plate_7in", en: "7 inch plate (18 cm)", bn: "৭ ইঞ্চির থালা (১৮ সেমি)", cm: 17.78 },
  plate_8in: { id: "plate_8in", en: "8 inch plate (20 cm)", bn: "৮ ইঞ্চির থালা (২০ সেমি)", cm: 20.32 },
  plate_9in: { id: "plate_9in", en: "9 inch plate (23 cm)", bn: "৯ ইঞ্চির থালা (২৩ সেমি)", cm: 22.86 },
  plate_10in: { id: "plate_10in", en: "10 inch plate (25 cm)", bn: "১০ ইঞ্চির থালা (২৫ সেমি)", cm: 25.4 },
  card_bank: { id: "card_bank", en: "Bank card (8.6 cm wide)", bn: "ব্যাংক কার্ড (৮.৬ সেমি চওড়া)", cm: 8.56 },
  card_a5: { id: "card_a5", en: "A5 card (21 cm wide)", bn: "এ৫ কার্ড (২১ সেমি চওড়া)", cm: 21.0 },
});

/**
 * The scale from a reference object the person marked on the picture.
 *
 * The person marks two edges, so the marker error is applied to both: the width is measured
 * between two taps, so its error is the root of the sum of the squares of the two edge errors.
 *
 * @param {{reference:string, pixels:number, markerPxError?:number}} marks
 * @returns {Scale}
 */
export function scaleFromReference(marks) {
  const reference = REFERENCES?.[marks?.reference];
  if (!reference) throw new RangeError("Unknown reference object.");
  const pixels = Number(marks?.pixels);
  if (!Number.isFinite(pixels) || pixels <= 0) throw new RangeError("The marked width must be more than zero.");
  const markerPxError = Number.isFinite(marks?.markerPxError) ? marks.markerPxError : 3;
  if (markerPxError < 0) throw new RangeError("The marker error cannot be negative.");
  const cmPerPx = reference.cm / pixels;
  // Two edges, so the errors add in quadrature.
  const relativeError = (markerPxError * Math.SQRT2) / pixels;
  return { cmPerPx, relativeError, reference: reference.id };
}

/**
 * The areal density of a food, from its household portions.
 *
 * @param {{portions:ReadonlyArray<{id:string, grams:number, vessel?:string}>, sourceRecordId?:string}} food
 * @returns {ArealDensity|null} null when the food has no area-defining portion
 */
export function arealDensity(food) {
  const portions = Array.isArray(food?.portions) ? food.portions : [];
  const usable = portions.filter((p) => p.vessel && VESSEL_FOOTPRINT_CM2[p.vessel] && Number.isFinite(p.grams) && p.grams > 0);
  if (!usable.length) return null;
  const densities = usable.map((p) => p.grams / VESSEL_FOOTPRINT_CM2[p.vessel]);
  const min = Math.min(...densities);
  const max = Math.max(...densities);
  const best = usable[0];
  return {
    gPerCm2: best.grams / VESSEL_FOOTPRINT_CM2[best.vessel],
    min,
    max,
    sourceRecordId: food.sourceRecordId ?? "",
    derivation: `${best.grams} g per 1 ${best.vessel} / ${VESSEL_FOOTPRINT_CM2[best.vessel].toFixed(2)} cm²`,
  };
}

/**
 * The uncertainty of a portion, kept separate from the confidence of the food's identity.
 *
 * The three sources of spread multiply, because they are independent: a 10% error in the scale
 * and a 10% error in the density give a 20% error in the product, not 10%.
 *
 * The SHAPE of the food dominates all of them. A person marking a plate edge carefully is
 * accurate to a couple of percent, but nobody can tell from a photograph whether the rice is
 * spread flat or heaped into a mound, and that choice alone moves the weight by about a third.
 * So an image-derived weight is never precise, however carefully the reference was marked, and
 * the levels below are set to say so.
 *
 * @param {{scaleRelativeError:number, density:{min:number,max:number}, shapeFactor?:{min:number,max:number}}} parts
 * @returns {{relativeSigma:number, level:"low"|"medium"|"high", text:string, text_bn:string}}
 */
export function portionUncertainty(parts) {
  const scaleSigma = Number.isFinite(parts.scaleRelativeError) ? parts.scaleRelativeError : 0;
  const density = parts.density;
  const mid = (density.min + density.max) / 2;
  const densitySigma = mid > 0 ? (density.max - density.min) / (2 * mid) : 1;
  const shape = parts.shapeFactor ?? SHAPE_FACTOR;
  const shapeSigma = (shape.max - shape.min) / (2 * ((shape.max + shape.min) / 2));
  const relativeSigma = Math.sqrt(scaleSigma ** 2 + densitySigma ** 2 + Math.max(shapeSigma, SHAPE_SIGMA) ** 2);
  const level = relativeSigma <= 0.2 ? "low" : relativeSigma <= 0.4 ? "medium" : "high";
  return {
    relativeSigma,
    level,
    text: `A rough range from the spread of household portion sizes for this food, and from how much the food is heaped up. A heap taller than this range assumes would weigh more. It is not a measurement.`,
    text_bn: `এই খাবারের ঘরোয়া পরিবেশনের আকারের বিভিন্নতা এবং খাবারটি কতটা ঢেলে রাখা হয়েছে তা থেকে একটি আনুমানিক পরিসর। এই পরিসরের চেয়ে বেশি ঢিলে রাখলে ওজন বেশি হবে। এটি মাপা মান নয়।`,
  };
}

/**
 * Turn a mask's area into a gram range.
 *
 * With no scale, or no areal density for the food, this returns no grams at all.
 *
 * @param {{areaPx:number, areaRatio?:number}} mask
 * @param {{foodId:string, scale:Scale|null, density:ArealDensity|null, shapeFactor?:{min:number,max:number}}} opts
 * @returns {{estimatedGrams:{min:number,max:number}|null, method:string|null, uncertainty:object|null, basis:object}}
 */
export function estimatePortion(mask, opts) {
  const density = opts?.density ?? null;
  const scale = opts?.scale ?? null;
  const basis = {
    areaPx: Number.isFinite(mask?.areaPx) ? mask.areaPx : null,
    areaCm2: null,
    arealDensityGPerCm2: density?.gPerCm2 ?? null,
    mmPerPx: null,
    reference: scale?.reference ?? null,
    sourceRecordIds: density?.sourceRecordId ? [density.sourceRecordId] : [],
  };
  if (!scale || !density || !Number.isFinite(mask?.areaPx) || mask.areaPx <= 0) {
    return { estimatedGrams: null, method: null, uncertainty: null, basis };
  }
  const cmPerPx = scale.cmPerPx;
  const areaCm2 = mask.areaPx * cmPerPx * cmPerPx;
  basis.areaCm2 = areaCm2;
  basis.cmPerPx = cmPerPx;

  const shape = opts?.shapeFactor ?? SHAPE_FACTOR;
  const min = areaCm2 * density.min * shape.min;
  const max = areaCm2 * density.max * shape.max;
  const uncertainty = portionUncertainty({
    scaleRelativeError: scale.relativeError,
    density,
    shapeFactor: shape,
  });
  // The uncertainty widens the interval.
  const k = uncertainty.relativeSigma;
  return {
    estimatedGrams: {
      min: Math.max(0, min * (1 - k)),
      max: max * (1 + k),
    },
    method: "visual_estimate",
    uncertainty,
    basis,
  };
}

/**
 * Choose the portion to use, in the order the person prefers.
 *
 * A typed weight wins, then a household measure, then an image estimate the person accepted. An
 * image estimate is never applied on its own: without the person's acceptance it is not an answer.
 *
 * @param {{manualGrams?:number|null, household?:{grams:number, count?:number}|null, imageEstimate?:{min:number,max:number}|null, imageAccepted?:boolean}} opts
 * @returns {{grams:{min:number,max:number}|null, source:string|null, method:string|null, uncertainty:object|null}}
 */
export function reconcilePortion(opts) {
  const manual = Number(opts?.manualGrams);
  if (Number.isFinite(manual) && manual > 0) {
    return { grams: { min: manual, max: manual }, source: "weighed", method: "weighed", uncertainty: null };
  }
  const household = opts?.household;
  if (household && Number.isFinite(household.grams) && household.grams > 0) {
    const count = Number.isFinite(household.count) ? household.count : 1;
    const grams = household.grams * count;
    return { grams: { min: grams, max: grams }, source: "household_unit", method: "household_unit", uncertainty: null };
  }
  if (opts?.imageAccepted && opts?.imageEstimate) {
    return {
      grams: { min: opts.imageEstimate.min, max: opts.imageEstimate.max },
      source: "visual_estimate_confirmed",
      method: "visual_estimate",
      uncertainty: opts.imageEstimateUncertainty ?? null,
    };
  }
  return { grams: null, source: null, method: null, uncertainty: null };
}
