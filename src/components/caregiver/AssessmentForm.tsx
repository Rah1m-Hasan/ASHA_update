"use client";

import { ABILITY_FIELDS, LEVELS, recommend, SUPPORT_GOALS, SUPPORT_OPTIONS } from "@/features/caregiver/assessment";
import type { SupportContext } from "@/features/session/types";
import type { Assessment } from "@/lib/engine/types";
import { cn } from "@/lib/cn";

const groups = ["Face", "Hands", "Voice"] as const;

/** Capability assessment. Guides suggestions only — every module stays open. */
export function AssessmentFields({ value, onChange }: { value: Assessment; onChange: (a: Assessment) => void }) {
  const rec = recommend(value);
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <fieldset key={g}>
          <legend className="mb-2 font-semibold text-ink">{g}</legend>
          <div className="space-y-2">
            {ABILITY_FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-wash px-3 py-2">
                <span id={`lbl-${f.key}`} className="text-ink">
                  {f.label}
                </span>
                <div role="radiogroup" aria-labelledby={`lbl-${f.key}`} className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-line">
                  {LEVELS.map((l) => (
                    <button
                      type="button"
                      key={l.value}
                      role="radio"
                      aria-checked={value[f.key] === l.value}
                      onClick={() => onChange({ ...value, [f.key]: l.value })}
                      className={cn(
                        "h-8 rounded-md px-3 text-sm font-medium",
                        value[f.key] === l.value ? "bg-brand text-white" : "text-muted hover:text-ink",
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset>
        <legend className="mb-2 font-semibold text-ink">Seeing and hearing</legend>
        <div className="flex flex-wrap gap-4">
          {(["canSee", "canHear"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-ink">
              <input type="checkbox" checked={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} className="size-4 accent-brand" />
              {k === "canSee" ? "Can see the screen" : "Can hear Asha"}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="rounded-xl bg-brand-soft p-3 text-sm text-ink">
        Suggested start: <strong>{rec.length ? rec.join(", ") : "Asha companion with caregiver support"}</strong>. Every module stays available.
      </p>
    </div>
  );
}

export function SupportFields({ value, onChange }: { value: SupportContext; onChange: (v: SupportContext) => void }) {
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 font-semibold text-ink">Reason for support (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_OPTIONS.map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={value.categories.includes(id)}
              onClick={() => onChange({ ...value, categories: toggle(value.categories, id) })}
              className={cn("rounded-full px-3 py-1.5 text-sm ring-1", value.categories.includes(id) ? "bg-brand text-white ring-brand" : "text-ink ring-line hover:bg-wash")}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-semibold text-ink">Goals</legend>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_GOALS.map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={value.goals.includes(id)}
              onClick={() => onChange({ ...value, goals: toggle(value.goals, id) })}
              className={cn("rounded-full px-3 py-1.5 text-sm ring-1", value.goals.includes(id) ? "bg-brand text-white ring-brand" : "text-ink ring-line hover:bg-wash")}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium text-ink">
        Anything Asha should know (optional)
        <input
          value={value.note}
          maxLength={160}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="For example: please speak slowly and give me time to respond"
          className="mt-1 h-11 w-full rounded-xl border border-line px-3 focus:border-brand focus:outline-none"
        />
      </label>
      <p className="text-xs text-muted">This context is self-described, editable, and never used to limit what the patient can use.</p>
    </div>
  );
}
