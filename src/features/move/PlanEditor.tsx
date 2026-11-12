"use client";

import { EXERCISES, title } from "./catalog.js";
import { exerciseAllowed } from "./safety.js";
import { useMove, type Program, type Step } from "./store";
import { TrackingBadge, describeStep } from "./ui";

function NumberField({ label, value, min, max, onChange, disabled }: { label: string; value: number | undefined; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => {
          const v = Math.round(Number(e.target.value));
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="mt-1 h-10 w-20 rounded-lg bg-surface px-2 text-base text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-wash"
      />
    </label>
  );
}

/** Edit sets, reps, holds and rest within safe bounds. Clinician-locked steps are shown read-only. */
export function PlanEditor({ program, onChange, screening, readOnly }: { program: Program; onChange?: (p: Program) => void; screening?: unknown; readOnly?: boolean }) {
  const lang = useMove((s) => s.language);
  const update = (i: number, patch: Partial<Step>) => onChange?.({ ...program, sequence: program.sequence.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const remove = (i: number) => onChange?.({ ...program, sequence: program.sequence.filter((_, j) => j !== i) });
  const swap = (i: number, id: string) => update(i, { exerciseId: id, ...EXERCISES[id].defaults });
  return (
    <ol className="space-y-3">
      {program.sequence.map((s, i) => {
        const e = EXERCISES[s.exerciseId];
        const locked = readOnly || s.clinicianLocked;
        const alternatives = e.alternatives.filter((id: string) => EXERCISES[id].intendedUse === "wellness" && (!screening || exerciseAllowed(EXERCISES[id], screening).allowed));
        return (
          <li key={`${s.exerciseId}-${i}`} className="rounded-2xl bg-wash/60 p-4 ring-1 ring-line">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-ink">
                  {i + 1}. {title(e, lang)}
                  {s.optional && <span className="ml-2 text-xs text-muted">optional</span>}
                </p>
                <p className="text-sm text-muted">
                  {e.area} · {describeStep(s, e.kind)}
                  {s.clinicianLocked && " · set by your clinician"}
                </p>
              </div>
              <TrackingBadge id={s.exerciseId} />
            </div>
            {!locked && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <NumberField label="Sets" value={s.sets} min={1} max={10} onChange={(v) => update(i, { sets: v })} />
                {e.kind === "reps" && <NumberField label="Reps" value={s.targetReps} min={1} max={50} onChange={(v) => update(i, { targetReps: v })} />}
                {e.kind === "timed_hold" && <NumberField label="Hold (s)" value={s.holdSeconds} min={5} max={120} onChange={(v) => update(i, { holdSeconds: v })} />}
                {e.kind === "duration" && <NumberField label="Minutes" value={Math.round((s.durationSeconds ?? 0) / 60)} min={1} max={60} onChange={(v) => update(i, { durationSeconds: v * 60 })} />}
                <NumberField label="Rest (s)" value={s.restSeconds} min={0} max={300} onChange={(v) => update(i, { restSeconds: v })} />
                {alternatives.length > 0 && (
                  <label className="block text-xs text-muted">
                    Swap for
                    <select className="mt-1 h-10 rounded-lg bg-surface px-2 text-sm text-ink ring-1 ring-line" value="" onChange={(ev) => ev.target.value && swap(i, ev.target.value)}>
                      <option value="">Easier or different…</option>
                      {alternatives.map((id: string) => (
                        <option key={id} value={id}>
                          {title(EXERCISES[id], lang)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {program.sequence.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="h-10 rounded-lg px-3 text-sm font-medium text-danger hover:bg-danger-soft">
                    Remove
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
