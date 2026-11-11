"use client";

import { useSyncExternalStore } from "react";
import { readLocal, saveLocal } from "@/lib/storage";
import { AREAS, locate, type AreaId } from "./areas";

// What the home chooser remembers, on this device only: which modules were opened last and which
// areas the person chose to hide. No health data is stored here.
const KEY = "home_v1";

export type Visit = { area: AreaId; module: string | null; at: number };
export type HomeState = { recent: Visit[]; hidden: AreaId[] };

const initial: HomeState = { recent: [], hidden: [] };
const valid = (id: unknown): id is AreaId => AREAS.some((a) => a.id === id);

let state: HomeState | null = null;
const listeners = new Set<() => void>();
const load = (): HomeState => {
  const raw = readLocal<Partial<HomeState>>(KEY, {});
  return {
    recent: Array.isArray(raw.recent) ? raw.recent.filter((v) => v && valid(v.area) && Number.isFinite(v.at)).slice(0, 20) : [],
    hidden: Array.isArray(raw.hidden) ? raw.hidden.filter(valid) : [],
  };
};

export const homeStore = {
  get(): HomeState {
    return (state ??= load());
  },
  set(patch: Partial<HomeState>) {
    state = { ...homeStore.get(), ...patch };
    saveLocal(KEY, state);
    listeners.forEach((l) => l());
  },
  /** Called on every patient page; only module pages are remembered. */
  visit(pathname: string, now = Date.now()) {
    const hit = locate(pathname);
    if (!hit?.module) return;
    const current = homeStore.get();
    if (current.recent[0]?.module === hit.module.id) return;
    const recent = [{ area: hit.area.id, module: hit.module.id, at: now }, ...current.recent.filter((v) => v.module !== hit.module!.id)].slice(0, 20);
    // Opening an area you had hidden brings it back to your home.
    homeStore.set({ recent, hidden: current.hidden.filter((a) => a !== hit.area.id) });
  },
  toggleHidden(id: AreaId) {
    const { hidden } = homeStore.get();
    homeStore.set({ hidden: hidden.includes(id) ? hidden.filter((a) => a !== id) : [...hidden, id] });
  },
  reset() {
    homeStore.set({ ...initial });
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useHome(): HomeState {
  return useSyncExternalStore(homeStore.subscribe, homeStore.get, () => initial);
}

/**
 * Areas in the order the home shows them: the ones you used most recently, then any your
 * caregiver's setup suggests, then the rest in their usual order. Hidden areas are listed apart.
 */
export function orderAreas(home: HomeState, suggestedModules: string[] = []) {
  const used = [...new Set(home.recent.map((v) => v.area))];
  const suggested = AREAS.filter((a) => a.modules.some((m) => suggestedModules.includes(m.id))).map((a) => a.id);
  const rank = (id: AreaId) => {
    const u = used.indexOf(id);
    if (u >= 0) return u;
    const s = suggested.indexOf(id);
    if (s >= 0) return 100 + s;
    return 200 + AREAS.findIndex((a) => a.id === id);
  };
  const sorted = [...AREAS].sort((a, b) => rank(a.id) - rank(b.id));
  return { shown: sorted.filter((a) => !home.hidden.includes(a.id)), hidden: sorted.filter((a) => home.hidden.includes(a.id)), suggested };
}
