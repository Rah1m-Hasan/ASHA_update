"use client";

import { useState } from "react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button, ButtonLink } from "@/components/ui/Button";
import { validateProgram } from "@/features/move/catalog.js";
import { PlanEditor } from "@/features/move/PlanEditor";
import { moveStore, useMove, type Program } from "@/features/move/store";
import { BASE, tx } from "@/features/move/ui";
import { cn } from "@/lib/cn";

const DAYS = [
  ["Sun", "রবি"],
  ["Mon", "সোম"],
  ["Tue", "মঙ্গল"],
  ["Wed", "বুধ"],
  ["Thu", "বৃহঃ"],
  ["Fri", "শুক্র"],
  ["Sat", "শনি"],
];

function nextWorkout(schedule: number[], from = new Date()) {
  for (let i = 0; i < 7; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    if (schedule.includes(d.getDay())) return i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "long" });
  }
  return "Not scheduled";
}

export default function MyPlan() {
  const lang = useMove((s) => s.language);
  const plan = useMove((s) => s.plan);
  const schedule = useMove((s) => s.schedule);
  const clinician = useMove((s) => s.clinicianPrograms);
  const history = useMove((s) => s.history);
  const [draft, setDraft] = useState<Program | null>(null);
  const [error, setError] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const editing = draft ?? plan;

  const recent = plan ? history.filter((h) => h.programId === plan.id && h.endedBy === "completed").slice(-2) : [];
  const readyForMore = plan?.authoredBy !== "clinician" && recent.length === 2 && recent.every((h) => h.setsDone >= h.setsPlanned && (h.effort ?? 10) <= 6);

  function save(p: Program) {
    try {
      validateProgram(p);
      moveStore.set({ plan: p });
      setDraft(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function stepUp() {
    if (!plan) return;
    save({ ...plan, authoredBy: "user", sequence: plan.sequence.map((s) => (s.clinicianLocked ? s : { ...s, targetReps: s.targetReps ? Math.min(50, s.targetReps + 1) : s.targetReps, holdSeconds: s.holdSeconds ? Math.min(120, s.holdSeconds + 5) : s.holdSeconds })) });
    setConfirmStep(false);
  }

  return (
    <>
      <PageHeader
        title={tx(lang, "My plan", "আমার প্ল্যান")}
        description={tx(lang, "Your current routine, when you plan to do it, and anything your clinician assigned.", "আপনার রুটিন, কবে করবেন, এবং চিকিৎসকের দেওয়া কাজ।")}
        actions={
          <>
            {plan && <ButtonLink href={`${BASE}/session`}>{tx(lang, "Start workout", "ব্যায়াম শুরু")}</ButtonLink>}
            <ButtonLink href={`${BASE}/start`} variant="secondary">
              {plan ? tx(lang, "Choose a different plan", "অন্য প্ল্যান") : tx(lang, "Build a plan", "প্ল্যান তৈরি")}
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title={editing?.name ?? tx(lang, "No plan yet", "এখনো প্ল্যান নেই")}
          description={editing ? (editing.authoredBy === "clinician" ? `Assigned by ${editing.clinicianName}. Only your clinician can change it.` : editing.why) : undefined}
          action={editing?.authoredBy === "clinician" ? <StatusPill tone="brand">Clinician plan</StatusPill> : undefined}
        >
          {editing ? (
            <>
              <PlanEditor program={editing} onChange={setDraft} readOnly={editing.authoredBy === "clinician"} />
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              {draft && (
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => save({ ...draft, authoredBy: draft.authoredBy === "clinician" ? "clinician" : "user" })}>Save changes</Button>
                  <Button variant="ghost" onClick={() => setDraft(null)}>
                    Discard
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState title="Start with a goal">Answer a few questions, one at a time, and ASHA suggests a starter plan you can change.</EmptyState>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title={tx(lang, "Weekly schedule", "সাপ্তাহিক সময়সূচি")} description="Leave rest days between workouts.">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Workout days">
              {DAYS.map(([en, bn], day) => {
                const on = schedule.includes(day);
                return (
                  <button
                    key={en}
                    type="button"
                    aria-pressed={on}
                    onClick={() => moveStore.set({ schedule: on ? schedule.filter((d) => d !== day) : [...schedule, day].sort() })}
                    className={cn("h-11 min-w-12 rounded-full px-3 text-sm font-medium ring-1", on ? "bg-brand text-white ring-brand" : "bg-white text-ink ring-line")}
                  >
                    {tx(lang, en, bn)}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-ink">
              Next workout: <strong>{nextWorkout(schedule)}</strong>
            </p>
          </Panel>
          {readyForMore && (
            <Panel title="Ready for a little more?" description="You finished this plan twice in a row and rated it moderate or easier.">
              {confirmStep ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink">This adds one repetition (or 5 seconds of hold) to each exercise. Only do it if the last workouts felt comfortable and pain-free.</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={stepUp}>
                      Yes, add a little
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmStep(false)}>
                      Keep it as it is
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirmStep(true)}>
                  Consider a small step up
                </Button>
              )}
            </Panel>
          )}
          <Panel title={tx(lang, "From your clinician", "চিকিৎসকের দেওয়া")}>
            {clinician.length ? (
              <ul className="space-y-3">
                {clinician.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="text-xs text-muted">
                        {p.clinicianName} · approved {p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    {plan?.id === p.id ? (
                      <StatusPill tone="good">Current</StatusPill>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => moveStore.set({ plan: p })}>
                        Use this plan
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No clinician tasks. If your clinician uses ASHA Clinic, connect under Clinician programs.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
