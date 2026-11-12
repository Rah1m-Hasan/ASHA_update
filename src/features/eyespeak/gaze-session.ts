// The gaze pipeline every surface uses: one frame in, one smoothed point out.
//
// The board, the "which one?" picker and the eye cursor all do the same four things with each
// camera frame — notice a blink, turn the face points into a gaze point, smooth it, and notice
// when the eyes are lost. They used to each carry their own copy of that, with their own
// constants; this is the one copy.

import { LongBlink } from "./cursor-logic.js";
import { predictGaze, smoothPoint } from "./gaze";
import type { Features, GazeModel } from "./gaze";

/** Eyes lost for longer than this (not a blink) clear the fill. */
export const LOSS_MS = 600;
/** How long the gaze trail is kept, so a blink can be matched to where the eyes were. */
const TRAIL_MS = 2500;

export type Blink = { kind: "click" | "short" | "long"; ms: number; closedAt: number };
export type GazeFrame = { features: Features; t: number; open: number | null };

export type GazeStep = {
  /** Where the eyes are looking, smoothed. Null while the eyes are lost. */
  point: { x: number; y: number } | null;
  /** What just ended, if a blink just ended. */
  blink: Blink | null;
  /** True only on the frame where the eyes are given up on, so the caller can clear once. */
  lost: boolean;
  /** Why the eyes were lost, if they were. */
  reason: string;
};

export class GazeSession {
  private blink = new LongBlink();
  private smooth: { x: number; y: number; t: number } | null = null;
  private trail: { x: number; y: number; t: number }[] = [];
  private lostSince: number | null = null;
  private lostReported = false;

  /** The gaze points of the last few seconds, so a blink can be matched to where the eyes were. */
  get history(): { x: number; y: number; t: number }[] {
    return this.trail;
  }

  /** True while the eyes are closed in what may become a click. */
  get closing(): boolean {
    return this.blink.closing;
  }

  /** Forgets the point and the trail, but keeps what the blink detector has learned. */
  reset() {
    this.smooth = null;
    this.trail = [];
    this.lostSince = null;
    this.lostReported = false;
  }

  step(frame: GazeFrame, model: GazeModel | null): GazeStep {
    const { features, t } = frame;
    const blink = this.blink.update(frame.open, t) as Blink | null;
    if (!features.valid) return this.lost(t, features.reason, blink);
    if (!model) return { point: null, blink, lost: false, reason: "" };
    const p = predictGaze(model, features.values, { requireValidation: false }) as { valid: boolean; x?: number; y?: number; reason?: string };
    if (!p.valid || p.x === undefined || p.y === undefined) return this.lost(t, p.reason ?? "", blink);
    this.lostSince = null;
    this.lostReported = false;
    const point = (this.smooth = smoothPoint(this.smooth, { x: p.x, y: p.y }, t));
    this.trail.push(point);
    while (this.trail.length && this.trail[0].t < t - TRAIL_MS) this.trail.shift();
    return { point, blink, lost: false, reason: "" };
  }

  /**
   * The eyes are lost. A blink or a frame or two without irises only pauses; a longer loss is
   * given up on, and the caller hears about it once.
   */
  private lost(t: number, reason: string, blink: Blink | null): GazeStep {
    this.lostSince ??= t;
    if (t - this.lostSince < LOSS_MS || this.blink.closing) return { point: null, blink, lost: false, reason };
    const first = !this.lostReported;
    this.lostReported = true;
    this.smooth = null;
    this.trail = [];
    return { point: null, blink, lost: first, reason };
  }
}
