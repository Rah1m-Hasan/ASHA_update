import test from "node:test";
import assert from "node:assert/strict";

import {
  scaleFromReference,
  arealDensity,
  portionUncertainty,
  estimatePortion,
  reconcilePortion,
  REFERENCES,
  VESSEL_FOOTPRINT_CM2,
  SHAPE_FACTOR,
} from "../public/app/nutrition/portion.js";
import { getRecord, areaDefiningPortion } from "../public/app/nutrition/catalogue/index.js";

test("a reference object gives a scale, and an unknown one is refused", () => {
  const scale = scaleFromReference({ reference: "plate_8in", pixels: 400 });
  assert.ok(Math.abs(scale.cmPerPx - 20.32 / 400) < 1e-12, "the scale must be the reference's real size over its pixels");
  assert.equal(scale.reference, "plate_8in");
  assert.throws(() => scaleFromReference({ reference: "a-bowl-that-is-not-there", pixels: 400 }), RangeError);
});

test("a marked width of zero or less is refused rather than producing an infinite scale", () => {
  assert.throws(() => scaleFromReference({ reference: "plate_8in", pixels: 0 }), RangeError);
  assert.throws(() => scaleFromReference({ reference: "plate_8in", pixels: -10 }), RangeError);
  assert.throws(() => scaleFromReference({ reference: "plate_8in", pixels: Number.NaN }), RangeError);
});

test("the marker's own error is in the scale's error", () => {
  const tight = scaleFromReference({ reference: "plate_8in", pixels: 800, markerPxError: 2 });
  const loose = scaleFromReference({ reference: "plate_8in", pixels: 200, markerPxError: 2 });
  assert.ok(loose.relativeError > tight.relativeError, "a small mark must carry more error");
});

test("the areal density of cooked rice is its cup weight over the cup's footprint", () => {
  const density = arealDensity({ portions: [{ id: "cup", grams: 158, vessel: "cup" }], sourceRecordId: "fdc:168878" });
  const expected = 158 / VESSEL_FOOTPRINT_CM2.cup;
  assert.ok(Math.abs(density.gPerCm2 - expected) < 1e-12, "the density must be the gram weight over the footprint");
  assert.ok(Math.abs(density.gPerCm2 - 3.1432) < 0.001, "cooked rice is about 3.14 g per cm² of plate");
  assert.equal(density.sourceRecordId, "fdc:168878");
  assert.ok(density.derivation.includes("158"), "the derivation must show the numbers it used");
});

test("a food with no area-defining portion has no areal density", () => {
  assert.equal(arealDensity({ portions: [{ id: "tbsp", grams: 13.6, vessel: null }] }), null);
  assert.equal(arealDensity({ portions: [] }), null);
  assert.equal(arealDensity(null), null);
});

test("a food's density comes from that food's own portion table, not a shared number", () => {
  const rice = arealDensity({ portions: [{ id: "cup", grams: 158, vessel: "cup" }] });
  const lentils = arealDensity({ portions: [{ id: "cup", grams: 198, vessel: "cup" }] });
  assert.ok(Math.abs(rice.gPerCm2 - lentils.gPerCm2) > 0.5, "rice and lentils must not share one density");
});

test("with no scale there is NO gram estimate at all", () => {
  const density = arealDensity({ portions: [{ id: "cup", grams: 158, vessel: "cup" }] });
  const result = estimatePortion({ areaPx: 10000 }, { foodId: "rice-cooked", scale: null, density });
  assert.equal(result.estimatedGrams, null, "without a scale there is no weight to offer");
  assert.equal(result.method, null);
  assert.equal(result.uncertainty, null);
  assert.equal(result.basis.areaCm2, null);
});

test("with no density for the food there is NO gram estimate either", () => {
  const scale = scaleFromReference({ reference: "plate_8in", pixels: 400 });
  const result = estimatePortion({ areaPx: 10000 }, { foodId: "salt", scale, density: null });
  assert.equal(result.estimatedGrams, null, "a food with no density cannot be weighed from a picture");
});

test("with both a scale and a density the estimate is an area times a density", () => {
  const scale = scaleFromReference({ reference: "plate_8in", pixels: 400, markerPxError: 0 });
  const density = arealDensity({ portions: [{ id: "cup", grams: 158, vessel: "cup" }] });
  const areaPx = 10000;
  const result = estimatePortion({ areaPx }, { foodId: "rice-cooked", scale, density });
  const cmPerPx = 20.32 / 400;
  const areaCm2 = areaPx * cmPerPx * cmPerPx;
  assert.ok(Math.abs(result.basis.areaCm2 - areaCm2) < 1e-9, "the area must be the pixels turned into cm²");
  assert.equal(result.method, "visual_estimate");
  assert.ok(result.estimatedGrams.min <= density.gPerCm2 * areaCm2, "the estimate must sit around the density times the area");
});

test("a bigger plate area gives a bigger weight", () => {
  const density = arealDensity({ portions: [{ id: "cup", grams: 158, vessel: "cup" }] });
  const scale = scaleFromReference({ reference: "plate_8in", pixels: 400, markerPxError: 0 });
  const small = estimatePortion({ areaPx: 5000 }, { foodId: "rice-cooked", scale, density });
  const large = estimatePortion({ areaPx: 20000 }, { foodId: "rice-cooked", scale, density });
  assert.ok(large.estimatedGrams.min > small.estimatedGrams.min, "four times the area must give more weight");
});

test("the uncertainty grows as the estimate gets less certain, and is never confused with confidence", () => {
  const density = arealDensity({ portions: [{ id: "cup", grams: 158, vessel: "cup" }] });
  const good = scaleFromReference({ reference: "plate_8in", pixels: 800, markerPxError: 1 });
  const poor = scaleFromReference({ reference: "plate_8in", pixels: 150, markerPxError: 8 });
  const tight = estimatePortion({ areaPx: 5000 }, { foodId: "rice-cooked", scale: good, density }).uncertainty;
  const loose = estimatePortion({ areaPx: 5000 }, { foodId: "rice-cooked", scale: poor, density }).uncertainty;
  assert.ok(loose.relativeSigma > tight.relativeSigma, "a worse scale must widen the range");
  assert.ok(["low", "medium", "high"].includes(tight.level));
  assert.ok(tight.text && tight.text_bn, "the uncertainty must be explained in both languages");
});

test("the shape of the food dominates the uncertainty, so an image weight is never precise", () => {
  const density = arealDensity({ portions: [{ id: "cup", grams: 158, vessel: "cup" }] });
  // A scale marked as carefully as it can be marked.
  const perfect = scaleFromReference({ reference: "plate_8in", pixels: 2000, markerPxError: 0.5 });
  const result = estimatePortion({ areaPx: 5000 }, { foodId: "rice-cooked", scale: perfect, density });
  assert.ok(result.uncertainty.relativeSigma > 0.2, "even a perfectly marked reference leaves the heaped-vs-flat question open");
  assert.notEqual(result.uncertainty.level, "low", "an image-derived weight must never be called low uncertainty");
});

test("a hopeless scale pushes the uncertainty into the high band", () => {
  const density = arealDensity({ portions: [{ id: "cup", grams: 158, vessel: "cup" }] });
  const awful = scaleFromReference({ reference: "plate_8in", pixels: 40, markerPxError: 12 });
  const result = estimatePortion({ areaPx: 5000 }, { foodId: "rice-cooked", scale: awful, density });
  assert.equal(result.uncertainty.level, "high");
});

test("the uncertainty says plainly that it is not a measurement", () => {
  const density = arealDensity({ portions: [{ id: "cup", grams: 158, vessel: "cup" }] });
  const scale = scaleFromReference({ reference: "plate_8in", pixels: 400 });
  const uncertainty = estimatePortion({ areaPx: 5000 }, { foodId: "rice-cooked", scale, density }).uncertainty;
  assert.ok(/not a measurement/i.test(uncertainty.text), "the wording must say it is not a measurement");
});

test("the shape factor allows a flat layer through to a mound", () => {
  assert.ok(SHAPE_FACTOR.min >= 1, "a flat layer is the floor");
  assert.ok(SHAPE_FACTOR.max > 1, "a mound must be allowed for");
  assert.ok(SHAPE_FACTOR.max < 3, "and not unbounded");
});

test("a typed weight beats everything else", () => {
  const result = reconcilePortion({
    manualGrams: 120,
    household: { grams: 158 },
    imageEstimate: { min: 90, max: 140 },
    imageAccepted: true,
  });
  assert.deepEqual(result.grams, { min: 120, max: 120 });
  assert.equal(result.source, "weighed");
});

test("a household measure is used when there is no typed weight", () => {
  const result = reconcilePortion({ household: { grams: 158, count: 2 }, imageEstimate: { min: 90, max: 140 }, imageAccepted: true });
  assert.deepEqual(result.grams, { min: 316, max: 316 }, "two cups is twice a cup");
  assert.equal(result.source, "household_unit");
});

test("an image estimate is NOT applied until the person accepts it", () => {
  const withoutAcceptance = reconcilePortion({ imageEstimate: { min: 90, max: 140 } });
  assert.equal(withoutAcceptance.grams, null, "an unaccepted estimate must not become the weight");
  assert.equal(withoutAcceptance.source, null);

  const accepted = reconcilePortion({ imageEstimate: { min: 90, max: 140 }, imageAccepted: true });
  assert.deepEqual(accepted.grams, { min: 90, max: 140 });
  assert.equal(accepted.source, "visual_estimate_confirmed");
});

test("with nothing at all there is no weight", () => {
  const result = reconcilePortion({});
  assert.equal(result.grams, null);
  assert.equal(result.source, null);
});

test("a household measure of zero grams is not a weight", () => {
  assert.equal(reconcilePortion({ household: { grams: 0 } }).grams, null);
  assert.equal(reconcilePortion({ manualGrams: 0 }).grams, null);
});

test("the catalogue's own rice portion gives the density the portion code needs", () => {
  const portion = areaDefiningPortion("rice-cooked");
  assert.ok(portion, "cooked rice must have a cup portion");
  const density = arealDensity({ portions: [{ id: portion.vessel, grams: portion.grams, vessel: portion.vessel }] });
  assert.ok(density.gPerCm2 > 0);
  assert.ok(density.derivation.includes("cm²"), "the derivation must show the footprint");
});

test("every reference object has a real size", () => {
  for (const reference of Object.values(REFERENCES)) {
    assert.ok(reference.cm > 5 && reference.cm < 30, `${reference.id} must be a plausible size`);
    assert.ok(reference.en && reference.bn, `${reference.id} must be named in both languages`);
  }
});
