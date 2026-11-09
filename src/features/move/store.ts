"use client";

import { useSyncExternalStore } from "react";
import { readLocal, removeLocal, saveLocal } from "@/lib/storage";

// Everything ASHA Move keeps lives on this device under one key, so it can be exported or deleted at once.
const KEY = "move_v2";

export type Lang = "en" | "bn";
export type Answer = "yes" | "no" | "unsure";
export type Step = {
  exerciseId: string;
  sets: number;
  targetReps?: number;
  holdSeconds?: number;
  durationSeconds?: number;
  restSeconds: number;
  optional?: boolean;
  clinicianLocked?: boolean;
  limits?: { start: number; target: number; return: number };
  holdMs?: number;
  side?: "left" | "right";
};
export type Program = {
  id: string;
  name: string;
  category: string;
  userGoal: string;
  locale: Lang;
  warmUpSeconds: number;
  coolDownSeconds: number;
  sequence: Step[];
  authoredBy: "content_team" | "user" | "clinician";
  clinicianName?: string;
  approvedAt?: string;
  version: string;
  why?: string;
  notes?: string;
};
export type Clearance = { clinicianName: string; date: string; scope: string; limits: string; recordedAt: string; source: string };
export type Lockout = { kind: "emergency" | "rest"; since: number; until: number; reasons: string[]; cleared?: boolean; audit: Record<string, unknown>[] };
export type Summary = {
  programId: string;
  programName: string;
  authoredBy: string;
  clinicianName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
  activeMinutes: number;
  mode: "camera" | "manual";
  exercises: { exerciseId: string; title: string; plannedSets: number; setsDone: number; reps: number; seconds: number; partials: number; countedBy: string[]; skipped: boolean; skipReason: string; excludedBySafetyCheck?: boolean }[];
  setsDone: number;
  setsPlanned: number;
  safety: { action: string; reasons: string[] } | null;
  note: string;
  effort?: number | null;
  feltAfter?: string;
};
export type MoveState = {
  language: Lang;
  voice: boolean;
  cameraConsent: boolean;
  /** Conditions from the safety screen, kept only with permission; "right now" symptoms are asked every time. */
  conditions: Record<string, Answer>;
  painAreas: string[];
  rememberConditions: boolean;
  plan: Program | null;
  schedule: number[];
  clinicianPrograms: Program[];
  clearance: Clearance | null;
  lockout: Lockout | null;
  history: Summary[];
  activeSession: string | null;
  /** The wizard's answers, handed to the first workout for 15 minutes so they aren't asked twice. */
  recentScreen: { answers: Record<string, Answer>; painAreas: string[]; at: number } | null;
  consentAudit: { at: string; event: string }[];
};

const initial: MoveState = {
  language: "en",
  voice: true,
  cameraConsent: false,
  conditions: {},
  painAreas: [],
  rememberConditions: false,
  plan: null,
  schedule: [1, 3, 5],
  clinicianPrograms: [],
  clearance: null,
  lockout: null,
  history: [],
  activeSession: null,
  recentScreen: null,
  consentAudit: [],
};

let state: MoveState | null = null;
const listeners = new Set<() => void>();
const load = (): MoveState => ({ ...initial, ...readLocal<Partial<MoveState>>(KEY, {}) });

export const moveStore = {
  get(): MoveState {
    return (state ??= load());
  },
  set(patch: Partial<MoveState> | ((s: MoveState) => Partial<MoveState>)) {
    const current = moveStore.get();
    const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
    if (!next.rememberConditions) {
      next.conditions = {};
      next.painAreas = [];
    }
    next.history = next.history.slice(-200);
    state = next;
    saveLocal(KEY, next);
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Delete everything Move stored on this device. */
  clear() {
    state = { ...initial };
    removeLocal(KEY);
    listeners.forEach((l) => l());
  },
  export(): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), module: "asha-move", ...moveStore.get(), activeSession: undefined }, null, 2);
  },
};

const server = () => initial;
export function useMove<T>(select: (s: MoveState) => T): T {
  return useSyncExternalStore(moveStore.subscribe, () => select(moveStore.get()), () => select(server()));
}
