"use client";

import { useSyncExternalStore } from "react";
import { readLocal, removeLocal, saveLocal } from "@/lib/storage";

// Everything ASHA Nutrition keeps lives on this device under one key, so it can be exported or
// deleted at once. Photos are never stored: a log keeps the numbers, their sources and the answers.
const KEY = "nutrition_v5";

export type Lang = "en" | "bn";
export type Range = { min: number; max: number | null } | null;
export type LoggedItem = {
  uid: string;
  dishId: string;
  label: { en: string; bn: string } | null;
  status: string;
  eaten: string | null;
  nutrients: Record<string, Range>;
  canonical: Record<string, unknown>;
  answers: Record<string, unknown>;
  sources: { databaseRecordId: string; databaseSource: string; dataVersion: string | null; verification: string }[];
};
export type MealLog = {
  id: string;
  loggedAt: string;
  captureMethod: "live_scan" | "upload" | "manual";
  status: string;
  total: Record<string, Range>;
  eaten: Record<string, Range> | null;
  excluded: string[];
  items: LoggedItem[];
  dataVersion: string;
  engineVersion: string;
  model: { id: string; version: string } | null;
  photoStored: false;
};
export type NutritionState = {
  language: Lang;
  /** Freeze automatically when the same food is seen steadily. Off = manual shutter only. */
  autoFreeze: boolean;
  log: MealLog[];
  audit: { at: string; event: string }[];
};

const initial: NutritionState = { language: "en", autoFreeze: true, log: [], audit: [] };

let state: NutritionState | null = null;
const listeners = new Set<() => void>();
const load = (): NutritionState => ({ ...initial, ...readLocal<Partial<NutritionState>>(KEY, {}) });

export const nutritionStore = {
  get(): NutritionState {
    return (state ??= load());
  },
  set(patch: Partial<NutritionState> | ((s: NutritionState) => Partial<NutritionState>)) {
    const current = nutritionStore.get();
    const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
    next.log = next.log.slice(-500);
    next.audit = next.audit.slice(-200);
    state = next;
    saveLocal(KEY, next);
    listeners.forEach((l) => l());
  },
  /** Adds a meal once. A second call with the same id changes nothing. */
  addLog(entry: MealLog) {
    if (nutritionStore.get().log.some((m) => m.id === entry.id)) return false;
    nutritionStore.set((s) => ({ log: [...s.log, entry], audit: [...s.audit, { at: entry.loggedAt, event: `logged ${entry.id}` }] }));
    return true;
  },
  removeLog(id: string) {
    nutritionStore.set((s) => ({ log: s.log.filter((m) => m.id !== id), audit: [...s.audit, { at: new Date().toISOString(), event: `deleted ${id}` }] }));
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Delete everything Nutrition stored on this device. */
  clear() {
    state = { ...initial };
    removeLocal(KEY);
    listeners.forEach((l) => l());
  },
  export(): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), module: "asha-nutrition", ...nutritionStore.get() }, null, 2);
  },
};

const server = () => initial;
export function useNutrition<T>(select: (s: NutritionState) => T): T {
  return useSyncExternalStore(nutritionStore.subscribe, () => select(nutritionStore.get()), () => select(server()));
}
