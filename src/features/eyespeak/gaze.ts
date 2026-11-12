// EyeSpeak in the app. The gaze maths is the tested Everyday engine (public/app/everyday/gaze-engine.js,
// tests/everyday-eyespeak.test.mjs): iris position inside each eye plus head position, mapped to the
// screen by a per-person ridge regression. This file adds what the app needs around it: how a person's
// measured accuracy decides which board they get, and the tile layouts.
import { NEEDS } from "@/features/requests/needs";
import type { NeedKind } from "@/features/requests/needs";
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

/** The eye cursor clicks ordinary page buttons, which are smaller than board tiles. */
export const cursorOk = (size: BoardSize): boolean => size === 9 || size === 6;

/** How far from the gaze point a button can be and still count as under the eyes. */
export const reachRadius = (p90: number) => Math.max(0.035, p90);

/** How still the eyes must be for a blink to count as a deliberate choice. */
export const steadyRadius = (p90: number) => Math.min(0.14, Math.max(0.06, p90 * 0.8));

export const BOARD_LABEL: Record<BoardSize, string> = {
  9: "9 tiles",
  6: "6 large tiles",
  2: "2 halves of the screen, chosen in steps",
  0: "Not reliable enough yet",
};

export type Tile = { id: string; label: string; bn: string; say: string; need?: NeedKind };

const YES: Tile = { id: "yes", label: "Yes", bn: "হ্যাঁ", say: "Yes" };
const NO: Tile = { id: "no", label: "No", bn: "না", say: "No" };
/** The words for a need come from the one catalogue every request uses. */
const needTile = (kind: NeedKind): Tile => {
  const n = NEEDS.find((x) => x.kind === kind)!;
  return { id: n.kind, label: n.label, bn: n.bn, say: n.text, need: n.kind };
};
const WATER = needTile("water");
const TOILET = needTile("toilet");
const PAIN: Tile = { id: "pain", label: "Pain", bn: "ব্থা", say: "I’m in pain", need: "help" };
const HELP = needTile("help");
const FOOD = needTile("food");
const COMFORT = needTile("comfort");
const THANKS: Tile = { id: "thanks", label: "Thank you", bn: "ধন্যবাদ", say: "Thank you" };

export const BOARDS: Record<Exclude<BoardSize, 0>, { cols: number; rows: number; tiles: Tile[] }> = {
  9: { cols: 3, rows: 3, tiles: [YES, NO, THANKS, WATER, FOOD, TOILET, PAIN, COMFORT, HELP] },
  6: { cols: 3, rows: 2, tiles: [YES, NO, WATER, TOILET, PAIN, HELP] },
  2: { cols: 2, rows: 1, tiles: [YES, NO] },
};

/**
 * With accuracy for only two halves of the screen, every word is still reachable: each look picks a
 * half, and a half is either a word or two more halves. Water is three looks: More words, then
 * Water, food or toilet, then Water. Yes and No are two.
 */
export type Group = { id: string; label: string; bn: string; options: [Step, Step] };
export type Step = Tile | Group;
const group = (id: string, label: string, bn: string, a: Step, b: Step): Group => ({ id, label, bn, options: [a, b] });
export const isGroup = (s: Step): s is Group => "options" in s;
export const wordsIn = (s: Step): string[] => (isGroup(s) ? s.options.flatMap(wordsIn) : [s.label]);
export const HALF_STEPS: Group = group(
  "root",
  "",
  "",
  group("g-yesno", "Yes or No", "হ্যাঁ বা না", YES, NO),
  group(
    "g-more",
    "More words",
    "আরও শব্দ",
    group("g-wft", "Water, food or toilet", "পানি, খাবার বা টয়লেট", WATER, group("g-ft", "Food or toilet", "খাবার বা টয়লেট", FOOD, TOILET)),
    group("g-rest", "Pain and more", "ব্যথা ও আরও", group("g-ph", "Pain or come here", "ব্যথা বা এখানে আসুন", PAIN, HELP), group("g-ct", "Comfort or thank you", "আরাম বা ধন্যবাদ", COMFORT, THANKS)),
  ),
);
/** The group reached by following `path` (group ids) from the top, and the labels on the way. */
export function pathAt(path: string[]): { node: Group; labels: string[] } {
  let node = HALF_STEPS;
  const labels: string[] = [];
  for (const id of path) {
    const next = node.options.find((o) => o.id === id);
    if (!next || !isGroup(next)) break;
    node = next;
    labels.push(next.label);
  }
  return { node, labels };
}

/** The group reached by following `path` (group ids) from the top. */
export function stepAt(path: string[]): Group {
  return pathAt(path).node;
}

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

export type Rect = { id: string; x: number; y: number; w: number; h: number };
export const inside = (p: { x: number; y: number }, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** Tile positions as fractions of the screen, the same frame the calibration used. */
export function measureRects(nodes: Map<string, HTMLElement>): Rect[] {
  const W = innerWidth, H = innerHeight;
  return [...nodes.entries()].map(([id, el]) => {
    const r = el.getBoundingClientRect();
    return { id, x: r.left / W, y: r.top / H, w: r.width / W, h: r.height / H };
  });
}

/**
 * Which tile the person is looking at, steady through normal jitter. A tile is taken when the point
 * lands well inside it (tileAt), and kept while the point stays anywhere on it, crosses a gap, or
 * briefly lands elsewhere (graceMs). Another tile takes over only after the point has been well
 * inside it for switchMs. Without this, a webcam estimate that wobbles by a few percent keeps
 * restarting the selection timer and nothing is ever chosen.
 */
export class TileTracker {
  current: string | null = null;
  private candidate: string | null = null;
  private candidateSince = 0;
  private lastOn = 0;
  constructor(private readonly opts = { switchMs: 220, graceMs: 450 }) {}
  reset() {
    this.current = this.candidate = null;
  }
  update(point: { x: number; y: number }, rects: Rect[], t: number): string | null {
    const core = tileAt(point, rects);
    const mine = this.current ? rects.find((r) => r.id === this.current) : undefined;
    if (mine && inside(point, mine)) {
      this.lastOn = t;
      this.candidate = null;
      return this.current;
    }
    if (core) {
      if (this.candidate !== core) {
        this.candidate = core;
        this.candidateSince = t;
      }
      if (!this.current || t - this.candidateSince >= this.opts.switchMs) {
        this.current = core;
        this.lastOn = t;
        this.candidate = null;
        return core;
      }
    } else this.candidate = null;
    if (this.current && t - this.lastOn <= this.opts.graceMs) return this.current;
    this.current = null;
    return null;
  }
}

/** Smooths the gaze point over time (not per frame), so slow and fast cameras feel the same. */
export function smoothPoint(prev: { x: number; y: number; t: number } | null, p: { x: number; y: number }, t: number, tauMs = 150) {
  if (!prev || t - prev.t > 1000 || t < prev.t) return { x: p.x, y: p.y, t };
  const a = 1 - Math.exp(-(t - prev.t) / tauMs);
  return { x: prev.x + (p.x - prev.x) * a, y: prev.y + (p.y - prev.y) * a, t };
}

/** Per-point capture rule from the engine docs: eight valid observations over at least 900 ms. */
export const CAPTURE = { settleMs: 700, minMs: 900, maxMs: 3200, minFrames: 8, retries: 2 };
export const CHECK_CAPTURE = { settleMs: 700, minMs: 900, maxMs: 3200, minFrames: 6, retries: 2 };
