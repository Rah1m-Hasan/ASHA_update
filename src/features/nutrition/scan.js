// Live scan steadiness check. The classifier looks at sampled frames (a few per second, in a worker);
// this decides when the same food has been seen clearly enough to freeze a still for the person to
// confirm. Starting rule from the V5 spec, to be tuned on real data: 4 matching good detections in
// the last 6 sampled frames, and the newest frame must itself be good. A classifier score is not a
// calibrated probability, so the threshold here only filters out obvious noise.
import { FOOD_VISION, suggestionFor } from "./catalog.js";

export const SCAN_RULE = Object.freeze({ window: 6, need: 4, minScore: 0.3, tentativeNeed: 2 });

/**
 * One sampled frame: {categories:[{label, score}], quality:{warnings:[]}, faceInView:boolean}.
 * Returns the frame's best ASHA food (or null) and whether the frame is good enough to count.
 */
export function readSample(sample, rule = SCAN_RULE) {
  const warnings = sample?.quality?.warnings ?? [];
  const usable = warnings.length === 0 && !sample?.faceInView;
  let best = null;
  for (const c of sample?.categories ?? []) {
    const dishId = suggestionFor(c.label);
    if (dishId && c.score >= rule.minScore && (!best || c.score > best.score)) best = { dishId, label: c.label, score: c.score };
  }
  return { usable, best, warnings, faceInView: !!sample?.faceInView };
}

export class StabilityTracker {
  constructor(rule = SCAN_RULE) {
    this.rule = rule;
    this.reset();
  }

  /** Start over (Retake / Continue scanning). The tracker can fire again after this. */
  reset() {
    this.recent = [];
    this.fired = false;
    this.samples = 0;
  }

  /**
   * Add a sampled frame. Returns:
   *   state: "QUALITY_WAIT" (frame not usable), "SCANNING" (usable, nothing steady yet),
   *          "CANDIDATE_STABLE" (freeze now; returned once), or "FROZEN" (already fired).
   *   tentative: the food seen in at least 2 of the last 6 frames, for a small "Possible: …" label.
   */
  push(sample) {
    if (this.fired) return { state: "FROZEN", candidate: null, tentative: null };
    this.samples += 1;
    const read = readSample(sample, this.rule);
    this.recent.push(read.usable ? read.best?.dishId ?? null : null);
    if (this.recent.length > this.rule.window) this.recent.shift();
    const counts = {};
    for (const id of this.recent) if (id) counts[id] = (counts[id] ?? 0) + 1;
    const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const tentative = n >= this.rule.tentativeNeed ? top : null;
    if (!read.usable) return { state: "QUALITY_WAIT", candidate: null, tentative, warnings: read.warnings, faceInView: read.faceInView };
    if (top && n >= this.rule.need && read.best?.dishId === top) {
      this.fired = true;
      return { state: "CANDIDATE_STABLE", candidate: { dishId: top, matches: n, of: this.recent.length, score: read.best.score, label: read.best.label }, tentative };
    }
    return { state: "SCANNING", candidate: null, tentative };
  }
}

/**
 * Suggestions from one still image (upload, manual shutter, or the frozen live frame: the same
 * function for all three). Only the few whole fruits the general classifier knows produce a
 * suggestion; everything else is left for the person to pick.
 */
export function suggestionsFrom(categories, rule = SCAN_RULE) {
  const out = [];
  for (const c of categories ?? []) {
    const dishId = suggestionFor(c.label);
    if (dishId && c.score >= rule.minScore && !out.some((s) => s.dishId === dishId)) out.push({ dishId, label: c.label, score: Math.round(c.score * 100) / 100, modelId: FOOD_VISION.modelId, modelVersion: FOOD_VISION.modelVersion, experimental: true });
  }
  return out;
}

/** Centre square of a frame (the viewfinder box). The classifier only ever sees this part. */
export function centreSquare(width, height, fraction = 0.8) {
  const side = Math.round(Math.min(width, height) * fraction);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side };
}
