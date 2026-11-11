"use client";

import { useSyncExternalStore } from "react";
import type { Credential } from "@/lib/api";
import { readLocal, saveLocal } from "@/lib/storage";
import type { CareEntry, Role, Settings } from "./types";

// Keys are shared with the legacy /app engine, so existing links and training carry over.
type State = {
  role: Role;
  patient: Credential | null;
  care: CareEntry[];
  activeCareId: string | null;
  settings: Settings;
};

const defaultSettings: Settings = {
  voice: "",
  rate: 0.9,
  language: "auto",
  speechLanguage: "en-US",
  cloud: false,
  proactive: true,
};

let state: State | null = null;
const listeners = new Set<() => void>();
const serverState: State = { role: "patient", patient: null, care: [], activeCareId: null, settings: defaultSettings };

function load(): State {
  const care = readLocal<CareEntry[]>("care", []);
  return {
    role: readLocal<Role>("dashboard_role", "patient"),
    patient: readLocal<Credential | null>("patient", null),
    care,
    activeCareId: readLocal<string | null>("dashboard_care_active", care[0]?.patientId ?? null),
    settings: { ...defaultSettings, ...readLocal<Partial<Settings>>("settings", {}) },
  };
}

function get() {
  state ??= load();
  return state;
}

function set(patch: Partial<State>) {
  state = { ...get(), ...patch };
  if ("role" in patch) saveLocal("dashboard_role", state.role);
  if ("patient" in patch) saveLocal("patient", state.patient);
  if ("care" in patch) saveLocal("care", state.care);
  if ("activeCareId" in patch) saveLocal("dashboard_care_active", state.activeCareId);
  if ("settings" in patch) saveLocal("settings", { ...readLocal("settings", {}), ...state.settings });
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const sessionStore = {
  get,
  set,
  setRole: (role: Role) => set({ role }),
  setPatient: (patient: Credential | null) => set({ patient }),
  upsertCare(entry: CareEntry) {
    const care = [...get().care.filter((c) => c.patientId !== entry.patientId), entry];
    set({ care, activeCareId: entry.patientId });
  },
  removeCare(patientId: string) {
    const care = get().care.filter((c) => c.patientId !== patientId);
    set({ care, activeCareId: care[0]?.patientId ?? null });
  },
  setActiveCare: (activeCareId: string) => set({ activeCareId }),
  updateSettings: (patch: Partial<Settings>) => set({ settings: { ...get().settings, ...patch } }),
};

export function useSession<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(get()),
    () => select(serverState),
  );
}
