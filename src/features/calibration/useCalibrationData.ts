"use client";

import { useSyncExternalStore } from "react";
import { useSession } from "@/features/session/store";
import { readLocal, saveLocal } from "@/lib/storage";

export type Trained = { baseline: unknown; enabled: string[]; savedAt: string };

const listeners = new Set<() => void>();
const cache = new Map<string, Trained | null>();

export function saveCalibration(patientId: string, value: Trained | null) {
  saveLocal("calibration_" + patientId, value);
  cache.set(patientId, value);
  listeners.forEach((l) => l());
}

function readCalibration(patientId: string) {
  if (!cache.has(patientId)) cache.set(patientId, readLocal<Trained | null>("calibration_" + patientId, null));
  return cache.get(patientId) ?? null;
}

/** The saved calibration for the current patient (or the local demo). */
export function useCalibrationData() {
  const id = useSession((s) => s.patient?.patientId ?? "local-demo");
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => readCalibration(id),
    () => null,
  );
}
