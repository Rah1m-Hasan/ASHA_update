"use client";

import { useCallback, useRef, useState } from "react";
import { usePerception, usePerceptionEvent } from "@/features/perception/PerceptionProvider";
import { useSession } from "@/features/session/store";
import { speak } from "@/features/speech/speak";
import { engineModule } from "@/lib/engine/load";
import type { Assessment, FrameSnapshot } from "@/lib/engine/types";
import { saveCalibration } from "./useCalibrationData";

type Step = { id: string; label: string };
type Guided = {
  steps: Step[];
  index: number;
  step?: Step;
  baseline: unknown;
  enabled: string[];
  update(raw: unknown): { message?: string; progress?: number; done?: boolean };
  skip(): void;
};

export type CalibrationView = { index: number; total: number; label: string; message: string; progress: number };

/** Runs the engine's guided calibration from live movement samples. */
export function useGuidedCalibration() {
  const patientId = useSession((s) => s.patient?.patientId ?? "local-demo");
  const { instance, state, start: startCamera } = usePerception();
  const run = useRef<Guided | null>(null);
  const [view, setView] = useState<CalibrationView | null>(null);
  const [finished, setFinished] = useState<string[] | null>(null);

  const announce = (g: Guided) => {
    if (!g.step) return;
    setView({ index: g.index, total: g.steps.length, label: g.step.label, message: "", progress: 0 });
    speak(g.step.label);
  };

  const finish = useCallback(
    (g: Guided) => {
      const trained = { baseline: g.baseline, enabled: g.enabled, savedAt: new Date().toISOString() };
      saveCalibration(patientId, trained);
      instance()?.setCalibration(trained.baseline, trained.enabled);
      run.current = null;
      setView(null);
      setFinished(trained.enabled);
      speak("Calibration saved.");
    },
    [instance, patientId],
  );

  const begin = useCallback(
    async (assessment: Assessment) => {
      if (state !== "on") await startCamera();
      const { GuidedCalibration } = await engineModule<{ GuidedCalibration: new (a: Assessment) => Guided }>("calibration");
      instance()?.resetFaceReference();
      const g = new GuidedCalibration(assessment);
      run.current = g;
      setFinished(null);
      announce(g);
    },
    [instance, startCamera, state],
  );

  usePerceptionEvent<FrameSnapshot>(
    "frame",
    (s) => {
      const g = run.current;
      if (!g) return;
      const old = g.index;
      const r = g.update(s.raw);
      if (r.done) return finish(g);
      if (g.index !== old) announce(g);
      else setView((v) => (v ? { ...v, message: r.message || "Movement captured", progress: r.progress || 0 } : v));
    },
    !!view,
  );

  const skip = useCallback(() => {
    const g = run.current;
    if (!g) return;
    g.skip();
    if (!g.step) finish(g);
    else announce(g);
  }, [finish]);

  const cancel = useCallback(() => {
    run.current = null;
    setView(null);
  }, []);

  return { view, finished, begin, skip, cancel };
}
