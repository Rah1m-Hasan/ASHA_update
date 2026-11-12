"use client";

import { useEffect, useRef, useState } from "react";
import { CAPTURE, CHECK_CAPTURE, CHECK_TARGETS, calibrationTargets, fitGazeModel, validateGazeModel } from "./gaze";
import type { Features, GazeModel, Sample, Validation } from "./gaze";

/** Gaze features for each face result, with how open the eyes are (for slow-blink clicks). */
export type Feed = (consumer: ((f: Features, t: number, open: number | null) => void) | null) => void;
export type CalibrationResult = { model: GazeModel; validation: Validation; check: Sample[] };

type Step = { x: number; y: number; check: boolean };

/**
 * Full screen, one dot at a time. "calibrate" fits a new model from 9 dots and then measures it on 3
 * different dots; "check" only measures an existing model. Nothing is guessed: a dot that gets too
 * few usable eye frames is repeated, and after two repeats the calibration stops and says why.
 */
export function Calibration({ mode, model: existing, feed, onDone, onCancel }: { mode: "calibrate" | "check"; model?: GazeModel | null; feed: Feed; onDone: (r: CalibrationResult) => void; onCancel: (reason?: string) => void }) {
  const steps = useRef<Step[]>([
    ...(mode === "calibrate" ? (calibrationTargets(9) as [number, number][]).map(([x, y]) => ({ x, y, check: false })) : []),
    ...(CHECK_TARGETS as [number, number][]).map(([x, y]) => ({ x, y, check: true })),
  ]);
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState("");
  const [phase, setPhase] = useState<"settle" | "capture">("settle");
  const done = useRef(false);
  const fit = useRef<Sample[]>([]);
  const check = useRef<Sample[]>([]);
  const model = useRef<GazeModel | null>(existing ?? null);
  const cb = useRef({ onDone, onCancel });
  useEffect(() => {
    cb.current = { onDone, onCancel };
  });

  useEffect(() => {
    const step = steps.current[index];
    if (!step) return;
    const rule = step.check ? CHECK_CAPTURE : CAPTURE;
    let started = performance.now();
    let retries = 0;
    let frames: Sample[] = [];
    let first: number | null = null, last: number | null = null;
    let reason = "";
    setPhase("settle");
    setHint("");

    feed((f, t) => {
      if (performance.now() - started < rule.settleMs) return;
      if (!f.valid) {
        reason = f.reason;
        return;
      }
      frames.push({ features: f.values, x: step.x, y: step.y });
      first ??= t;
      last = t;
    });

    const finish = () => {
      if (done.current) return;
      if (step.check) check.current.push(...frames);
      else fit.current.push(...frames);
      const next = index + 1;
      try {
        if (!step.check && steps.current[next]?.check) model.current = fitGazeModel(fit.current) as unknown as GazeModel;
        if (next >= steps.current.length) {
          done.current = true;
          feed(null);
          const validation = validateGazeModel(model.current, check.current) as Validation;
          cb.current.onDone({ model: { ...model.current!, validation }, validation, check: check.current });
          return;
        }
      } catch (e) {
        done.current = true;
        feed(null);
        cb.current.onCancel((e as Error).message);
        return;
      }
      setIndex(next);
    };

    const timer = setInterval(() => {
      const now = performance.now();
      if (now - started >= rule.settleMs) setPhase("capture");
      const span = first !== null && last !== null ? last - first : 0;
      if (frames.length >= rule.minFrames && span >= rule.minMs) {
        clearInterval(timer);
        finish();
        return;
      }
      if (now - started > rule.maxMs) {
        if (retries >= rule.retries) {
          clearInterval(timer);
          done.current = true;
          feed(null);
          cb.current.onCancel(reason || "Asha could not see your eyes clearly enough at this dot.");
          return;
        }
        retries++;
        started = now;
        frames = [];
        first = last = null;
        setPhase("settle");
        setHint(reason ? `${reason} Trying this dot again.` : "Trying this dot again. Keep looking at the centre.");
      }
    }, 50);
    return () => {
      clearInterval(timer);
      feed(null);
    };
  }, [index, feed]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        done.current = true;
        feed(null);
        cb.current.onCancel();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [feed]);

  const step = steps.current[index];
  const total = steps.current.length;
  return (
    <div className="fixed inset-0 z-[60] bg-white" role="dialog" aria-modal="true" aria-label="Gaze calibration" data-testid="calibration">
      <p className="absolute inset-x-0 top-5 text-center text-sm text-muted">
        {step?.check ? "Checking accuracy" : "Calibrating"} · dot {index + 1} of {total}. Look at the centre of the dot.
      </p>
      {hint && (
        <p role="status" className="absolute inset-x-0 top-12 mx-auto w-fit max-w-[90vw] rounded-full bg-amber-50 px-4 py-1.5 text-center text-sm text-amber-800 ring-1 ring-amber-200">
          {hint}
        </p>
      )}
      {step && (
        <span
          key={`${index}-${hint}`}
          data-testid="gaze-target"
          data-x={step.x}
          data-y={step.y}
          data-phase={phase}
          className="absolute grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center"
          style={{ left: `${step.x * 100}%`, top: `${step.y * 100}%` }}
        >
          <span className={`absolute inset-0 rounded-full border-2 border-brand ${phase === "settle" ? "animate-ping" : ""}`} />
          <span className={`size-3 rounded-full ${phase === "capture" ? "bg-brand" : "bg-brand/50"}`} />
        </span>
      )}
      <button
        onClick={() => {
          done.current = true;
          feed(null);
          cb.current.onCancel();
        }}
        className="absolute right-4 bottom-4 rounded-full px-4 py-2 text-sm font-medium text-muted ring-1 ring-line hover:bg-wash"
      >
        Stop
      </button>
    </div>
  );
}
