// EyeSpeak in the app. The gaze maths is the tested Everyday engine (public/app/everyday/gaze-engine.js,
// tests/everyday-eyespeak.test.mjs): iris position inside each eye plus head position, mapped to the
// screen by a per-person ridge regression. This file adds what the app needs around it: how a person's
// measured accuracy decides which board they get, and the tile layouts.
import {
  CHECK_TARGETS,
  DwellSelector,
  calibrationTargets,
  extractGazeFeatures,
  fitGazeModel,
  predictGaze,
  validateGazeModel,
} from "../../../public/app/everyday/gaze-engine.js";

export { CHECK_TARGETS, DwellSelector, calibrationTargets, extractGazeFeatures, fitGazeModel, predictGaze, validateGazeModel };

export type Features = { valid: true; values: number[]; openness: number } | { valid: false; reason: string };
export type Sample = { features: number[]; x: number; y: number };
export type Validation = { passed: boolean; meanError: number; p90Error: number; targets: number; samples: number; checkedAt: string };
export type GazeModel = { version: string; validation: Validation | null; fitError?: number; samples: number; targets: number; createdAt: string; [k: string]: unknown };
export type Prediction = { valid: true; x: number; y: number; error: number | null } | { valid: false; reason: string };

/** Fractions of the screen. Each board needs the person's 90th-percentile error to stay inside its tiles. */
export type BoardSize = 9 | 6 | 2 | 0;

export const BOARD_LIMITS: { size: Exclude<BoardSize, 0>; p90: number; mean: number }[] = [
  { size: 9, p90: 0.09, mean: 0.06 }, // the original Everyday pass mark
  { size: 6, p90: 0.16, mean: 0.11 },
  { size: 2, p90: 0.26, mean: 0.18 },
];

export function boardFor(v: Pick<Validation, "meanError" | "p90Error"> | null | undefined): BoardSize {
  if (!v || !Number.isFinite(v.meanError) || !Number.isFinite(v.p90Error)) return 0;
  return BOARD_LIMITS.find((l) => v.p90Error <= l.p90 && v.meanError <= l.mean)?.size ?? 0;
}

export const BOARD_LABEL: Record<BoardSize, string> = {
  9: "9 tiles",
  6: "6 large tiles",
  2: "2 halves of the screen (Yes or No)",
  0: "Not reliable enough yet",
};

export type Tile = { id: string; label: string; bn: string; say: string; need?: "water" | "food" | "toilet" | "comfort" | "help" };

const YES: Tile = { id: "yes", label: "Yes", bn: "হ্যাঁ", say: "Yes" };
const NO: Tile = { id: "no", label: "No", bn: "না", say: "No" };
const WATER: Tile = { id: "water", label: "Water", bn: "পানি", say: "I need water", need: "water" };
const TOILET: Tile = { id: "toilet", label: "Toilet", bn: "টয়লেট", say: "I need to go to the toilet", need: "toilet" };
const PAIN: Tile = { id: "pain", label: "Pain", bn: "ব্যথা", say: "I’m in pain", need: "help" };
const HELP: Tile = { id: "help", label: "Come here", bn: "এখানে আসুন", say: "Please come here", need: "help" };
const FOOD: Tile = { id: "food", label: "Food", bn: "খাবার", say: "I need food", need: "food" };
const COMFORT: Tile = { id: "comfort", label: "Comfort", bn: "আরাম", say: "I need help getting comfortable", need: "comfort" };
const THANKS: Tile = { id: "thanks", label: "Thank you", bn: "ধন্যবাদ", say: "Thank you" };

export const BOARDS: Record<Exclude<BoardSize, 0>, { cols: number; rows: number; tiles: Tile[] }> = {
  9: { cols: 3, rows: 3, tiles: [YES, NO, THANKS, WATER, FOOD, TOILET, PAIN, COMFORT, HELP] },
  6: { cols: 3, rows: 2, tiles: [YES, NO, WATER, TOILET, PAIN, HELP] },
  2: { cols: 2, rows: 1, tiles: [YES, NO] },
};

/** Two halves for confirming a request by gaze. */
export const CONFIRM_TILES: Tile[] = [
  { id: "confirm-no", label: "No", bn: "না", say: "" },
  { id: "confirm-yes", label: "Yes, send", bn: "হ্যাঁ, পাঠান", say: "" },
];

/** Smoothed point inside a tile, away from its edges. Tile rects are viewport fractions. */
export function tileAt(point: { x: number; y: number } | null, rects: { id: string; x: number; y: number; w: number; h: number }[]) {
  if (!point) return null;
  for (const r of rects) {
    const ix = r.w * 0.12, iy = r.h * 0.12;
    if (point.x >= r.x + ix && point.x <= r.x + r.w - ix && point.y >= r.y + iy && point.y <= r.y + r.h - iy) return r.id;
  }
  return null;
}

/** Per-point capture rule from the engine docs: eight valid observations over at least 900 ms. */
export const CAPTURE = { settleMs: 700, minMs: 900, maxMs: 3200, minFrames: 8, retries: 2 };
export const CHECK_CAPTURE = { settleMs: 700, minMs: 900, maxMs: 3200, minFrames: 6, retries: 2 };
