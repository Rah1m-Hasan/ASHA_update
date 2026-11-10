"use client";

import { useSyncExternalStore } from "react";
import { readLocal, removeLocal, saveLocal } from "@/lib/storage";
import type { GazeModel } from "./gaze";

// The calibration lives in memory for this visit. It is kept on the device only if the person
// chooses "Remember": numbers derived from eye positions plus the screen size, never video.
// A remembered calibration must pass the 3-point check again before it can select anything.

const KEY = "eyespeak_v1";

export type Saved = { model: GazeModel; screen: { w: number; h: number }; savedAt: string };
export type EyeSpeakState = {
  model: GazeModel | null;
  screen: { w: number; h: number } | null;
  /** True once this visit's target check has run for the current model. */
  checked: boolean;
  remember: boolean;
  dwellMs: number;
  showDot: boolean;
  /** The look-to-choose board is on screen; it answers its own confirmations by gaze. */
  boardOpen: boolean;
};

const initial: EyeSpeakState = { model: null, screen: null, checked: false, remember: false, dwellMs: 1200, showDot: true, boardOpen: false };
let state = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const saved = readLocal<Partial<Saved> & { dwellMs?: number; showDot?: boolean } | null>(KEY, null);
  if (!saved) return;
  state = {
    ...state,
    model: saved.model ?? null,
    screen: saved.screen ?? null,
    checked: false,
    remember: !!saved.model,
    dwellMs: clampDwell(saved.dwellMs ?? state.dwellMs),
    showDot: saved.showDot ?? true,
  };
}

const clampDwell = (ms: number) => Math.max(800, Math.min(1500, Math.round(ms / 100) * 100));

function persist() {
  const prefs = { dwellMs: state.dwellMs, showDot: state.showDot };
  if (state.remember && state.model && state.screen) saveLocal(KEY, { ...prefs, model: state.model, screen: state.screen, savedAt: new Date().toISOString() });
  else saveLocal(KEY, prefs);
}

function set(patch: Partial<EyeSpeakState>) {
  load();
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export const eyeSpeakStore = {
  get: () => (load(), state),
  set,
  setModel: (model: GazeModel, screen: { w: number; h: number }) => set({ model, screen, checked: true }),
  setDwell: (ms: number) => set({ dwellMs: clampDwell(ms) }),
  forget: () => {
    removeLocal(KEY);
    state = { ...initial, dwellMs: state.dwellMs, showDot: state.showDot };
    persist();
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useEyeSpeak() {
  return useSyncExternalStore(eyeSpeakStore.subscribe, eyeSpeakStore.get, () => initial);
}
