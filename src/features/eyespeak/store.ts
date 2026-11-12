"use client";

import { useSyncExternalStore } from "react";
import { readLocal, saveLocal } from "@/lib/storage";
import type { GazeModel } from "./gaze";

// The calibration lives in memory for this visit. It is kept on the device only if the person
// chooses "Remember": numbers derived from eye positions plus the screen size, never video.
// A remembered calibration must pass the 3-point check again before it can select anything.

const KEY = "eyespeak_v1";

export type Saved = { model: GazeModel; screen: { w: number; h: number }; savedAt: string };
/** How the eye cursor clicks: a slow blink, holding the look still, or either. */
export type CursorClick = "blink" | "dwell" | "both";
/** What the eyes are doing on screen: nothing, a calibration, or the board. */
export type Mode = null | "calibrate" | "check" | "board" | "scan";

export type EyeSpeakState = {
  model: GazeModel | null;
  screen: { w: number; h: number } | null;
  remember: boolean;
  dwellMs: number;
  showDot: boolean;
  /** The eyes move a pointer on every patient page (for this visit only). */
  cursor: boolean;
  cursorPaused: boolean;
  cursorClick: CursorClick;
  /** The eye cursor is asking which of several close buttons was meant, full screen. */
  picking: boolean;
  /** Calibration, the check or the board fills the screen; Asha's questions wait for the eyes. */
  mode: Mode;
};

const initial: EyeSpeakState = {
  model: null,
  screen: null,
  remember: false,
  dwellMs: 1200,
  showDot: true,
  cursor: false,
  cursorPaused: false,
  cursorClick: "blink",
  picking: false,
  mode: null,
};
const CLICKS: CursorClick[] = ["blink", "dwell", "both"];
let state = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const saved = readLocal<Partial<Saved> & { dwellMs?: number; showDot?: boolean; cursorClick?: CursorClick } | null>(KEY, null);
  if (!saved) return;
  state = {
    ...state,
    // A remembered calibration keeps its numbers but not its result: it must pass the check again.
    model: saved.model ? { ...saved.model, validation: null } : null,
    screen: saved.screen ?? null,
    remember: !!saved.model,
    dwellMs: clampDwell(saved.dwellMs ?? state.dwellMs),
    showDot: saved.showDot ?? true,
    cursorClick: CLICKS.includes(saved.cursorClick as CursorClick) ? (saved.cursorClick as CursorClick) : "blink",
  };
}

const clampDwell = (ms: number) => Math.max(800, Math.min(1500, Math.round(ms / 100) * 100));

function persist() {
  const prefs = { dwellMs: state.dwellMs, showDot: state.showDot, cursorClick: state.cursorClick };
  if (state.remember && state.model && state.screen) saveLocal(KEY, { ...prefs, model: state.model, screen: state.screen, savedAt: new Date().toISOString() });
  else saveLocal(KEY, prefs);
}

/** Only the settings worth keeping between visits are written to the device. */
const durable = (a: EyeSpeakState, b: EyeSpeakState) =>
  a.dwellMs !== b.dwellMs ||
  a.showDot !== b.showDot ||
  a.cursorClick !== b.cursorClick ||
  a.remember !== b.remember ||
  a.model !== b.model ||
  a.screen !== b.screen;

function set(patch: Partial<EyeSpeakState>) {
  load();
  const before = state;
  state = { ...state, ...patch };
  if (durable(before, state)) persist();
  listeners.forEach((l) => l());
}

export const eyeSpeakStore = {
  get: () => (load(), state),
  set,
  setModel: (model: GazeModel, screen: { w: number; h: number }) => set({ model, screen }),
  setDwell: (ms: number) => set({ dwellMs: clampDwell(ms) }),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** True when the window is a different size from the one the calibration was measured on. */
export function screenChanged(screen: { w: number; h: number } | null): boolean {
  if (!screen || typeof innerWidth === "undefined") return false;
  return Math.abs(screen.w - innerWidth) > innerWidth * 0.1 || Math.abs(screen.h - innerHeight) > innerHeight * 0.1;
}

export function useEyeSpeak<T>(select: (s: EyeSpeakState) => T): T {
  return useSyncExternalStore(eyeSpeakStore.subscribe, () => select(eyeSpeakStore.get()), () => select(initial));
}
