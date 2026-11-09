"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  usePerception,
  usePerceptionEvent,
} from "@/features/perception/PerceptionProvider";
import { useSession } from "@/features/session/store";
import { speak, stopSpeaking } from "@/features/speech/speak";
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

export type CalibrationView = {
  index: number;
  total: number;
  label: string;
  message: string;
  progress: number;
};

/** Runs the engine's guided calibration from live movement samples. */
export function useGuidedCalibration() {
  const patientId = useSession((s) => s.patient?.patientId ?? "local-demo");
  const {
    instance,
    state,
    start: startCamera,
    setCalibrating,
  } = usePerception();
  const run = useRef<Guided | null>(null);
  const attempt = useRef(0);
  const [view, setView] = useState<CalibrationView | null>(null);
  const [finished, setFinished] = useState<string[] | null>(null);

  const announce = useCallback((g: Guided) => {
    if (!g.step) return;
    setView({
      index: g.index,
      total: g.steps.length,
      label: g.step.label,
      message: "",
      progress: 0,
    });
    speak(g.step.label);
  }, []);

  const finish = useCallback(
    (g: Guided) => {
      const trained = {
        baseline: g.baseline,
        enabled: g.enabled,
        savedAt: new Date().toISOString(),
      };
      saveCalibration(patientId, trained);
      instance()?.setCalibration(trained.baseline, trained.enabled);
      run.current = null;
      setCalibrating(false);
      setView(null);
      setFinished(trained.enabled);
      speak("Calibration saved.");
    },
    [instance, patientId, setCalibrating],
  );

  const begin = useCallback(
    async (assessment: Assessment) => {
      const current = ++attempt.current;
      if (state !== "on") await startCamera();
      if (!instance()?.running || current !== attempt.current) return;
      const { GuidedCalibration } = await engineModule<{
        GuidedCalibration: new (a: Assessment) => Guided;
      }>("calibration");
      if (current !== attempt.current) return;
      instance()?.resetFaceReference();
      const g = new GuidedCalibration(assessment);
      run.current = g;
      setCalibrating(true);
      setFinished(null);
      announce(g);
    },
    [instance, startCamera, state, setCalibrating, announce],
  );

  usePerceptionEvent<FrameSnapshot>(
    "frame",
    (s) => {
      const g = run.current;
      if (!g || !s.raw || document.hidden) return;
      const old = g.index;
      const r = g.update(s.raw);
      if (r.done) return finish(g);
      if (g.index !== old) announce(g);
      else
        setView((v) =>
          v
            ? {
                ...v,
                message: r.message || "Movement captured",
                progress: r.progress || 0,
              }
            : v,
        );
    },
    !!view,
  );

  const skip = useCallback(() => {
    const g = run.current;
    if (!g) return;
    g.skip();
    if (!g.step) finish(g);
    else announce(g);
  }, [finish, announce]);

  const cancel = useCallback(() => {
    attempt.current++;
    run.current = null;
    setView(null);
    setCalibrating(false);
    stopSpeaking();
  }, [setCalibrating]);

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      attempt.current++;
      if (run.current) {
        run.current = null;
        setCalibrating(false);
        stopSpeaking();
      }
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [cancel, patientId, setCalibrating]);

  return { view, finished, begin, skip, cancel };
}
