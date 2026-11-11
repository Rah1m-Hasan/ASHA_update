"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ChevronIcon } from "@/components/ui/icons";
import { EXERCISES, title, validateProgram } from "@/features/move/catalog.js";
import { PlanEditor } from "@/features/move/PlanEditor";
import { moveStore, useMove, type Program } from "@/features/move/store";
import { BASE, describeStep, trackingNote, tx } from "@/features/move/ui";
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

function Heading({ id, title, description, action }: { id: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export default function MyPlan() {
  const lang = useMove((s) => s.language);
  const plan = useMove((s) => s.plan);
  const schedule = useMove((s) => s.schedule);
  const clinician = useMove((s) => s.clinicianPrograms);
  const history = useMove((s) => s.history);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Program | null>(null);
  const [error, setError] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const fromClinician = plan?.authoredBy === "clinician";

  const recent = plan ? history.filter((h) => h.programId === plan.id && h.endedBy === "completed").slice(-2) : [];
  const readyForMore = !fromClinician && recent.length === 2 && recent.every((h) => h.setsDone >= h.setsPlanned && (h.effort ?? 10) <= 6);

  function save(p: Program) {
    try {
      validateProgram(p);
      moveStore.set({ plan: p });
      setDraft(null);
      setEditing(false);
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
    <div className="max-w-3xl">
      <PageHeader
        title={tx(lang, "My plan", "আমার প্ল্যান")}
        description={tx(lang, "Your routine, the days you plan to do it, and plans from your clinician.", "আপনার রুটিন, কোন দিন করবেন, এবং চিকিৎসকের দেওয়া প্ল্যান।")}
        actions={plan && !editing ? <ButtonLink href={`${BASE}/session`}>{tx(lang, "Start workout", "ব্যায়াম শুরু")}</ButtonLink> : undefined}
      />

      <div className="space-y-10">
        {plan ? (
          <section aria-labelledby="plan-name">
            <Heading
              id="plan-name"
              title={plan.name}
              description={fromClinician ? `Assigned by ${plan.clinicianName}. Only your clinician can change it.` : plan.why}
              action={
                !fromClinician && !editing ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                    {tx(lang, "Edit", "বদলান")}
                  </Button>
                ) : undefined
              }
            />
            {editing ? (
              <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
                <PlanEditor program={draft ?? plan} onChange={setDraft} />
                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => save({ ...(draft ?? plan), authoredBy: "user" })}>
                    {tx(lang, "Save changes", "সংরক্ষণ")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraft(null);
                      setEditing(false);
                      setError("");
                    }}
                  >
                    {tx(lang, "Cancel", "বাতিল")}
                  </Button>
                </div>
              </div>
            ) : (
              <ol className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
                {plan.sequence.map((s, i) => {
                  const e = EXERCISES[s.exerciseId];
                  return (
                    <li key={`${s.exerciseId}-${i}`} className="flex items-center gap-4 px-5 py-4">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-wash text-sm tabular-nums text-muted">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">
                          {title(e, lang)}
                          {s.optional && <span className="ml-2 text-xs font-normal text-muted">{tx(lang, "optional", "ঐচ্ছিক")}</span>}
                        </p>
                        <p className="text-sm text-muted">
                          {describeStep(s, e.kind)}
                          {s.clinicianLocked && " · set by your clinician"}
                        </p>
                      </div>
                      <span className="hidden shrink-0 text-xs text-muted sm:block">{trackingNote(s.exerciseId, lang)}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {readyForMore && !editing && (
              <div className="mt-3 rounded-2xl bg-wash p-4 text-sm ring-1 ring-line">
                <p className="text-ink">{tx(lang, "You finished this plan twice in a row and rated it moderate or easier.", "আপনি পরপর দুবার এই প্ল্যান শেষ করেছেন এবং মাঝারি বা সহজ বলেছেন।")}</p>
                {confirmStep ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-muted">This adds one repetition (or 5 seconds of hold) to each exercise. Only do it if the last workouts felt comfortable and pain-free.</p>
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
                  <button type="button" className="mt-2 font-medium text-brand hover:underline" onClick={() => setConfirmStep(true)}>
                    Consider a small step up
                  </button>
                )}
              </div>
            )}

            {!editing && (
              <Link href={`${BASE}/start`} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
                {tx(lang, "Choose a different plan", "অন্য প্ল্যান বেছে নিন")}
              </Link>
            )}
          </section>
        ) : (
          <div className="rounded-2xl bg-white ring-1 ring-line">
            <EmptyState title={tx(lang, "No plan yet", "এখনো প্ল্যান নেই")} action={<ButtonLink href={`${BASE}/start`}>{tx(lang, "Build a plan", "প্ল্যান তৈরি")}</ButtonLink>}>
              {tx(lang, "Answer a few questions, one at a time, and ASHA suggests a starter plan you can change.", "একটি একটি করে কয়েকটি প্রশ্নের উত্তর দিন, ASHA একটি শুরুর প্ল্যান দেবে যা আপনি বদলাতে পারবেন।")}
            </EmptyState>
          </div>
        )}

        {plan && (
          <section aria-labelledby="plan-days">
            <Heading id="plan-days" title={tx(lang, "Workout days", "ব্যায়ামের দিন")} description={tx(lang, "Leave rest days between workouts.", "দুই ব্যায়ামের মাঝে বিশ্রামের দিন রাখুন।")} />
            <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Workout days">
                {DAYS.map(([en, bn], day) => {
                  const on = schedule.includes(day);
                  return (
                    <button
                      key={en}
                      type="button"
                      aria-pressed={on}
                      onClick={() => moveStore.set({ schedule: on ? schedule.filter((d) => d !== day) : [...schedule, day].sort() })}
                      className={cn("h-10 min-w-12 rounded-full px-3 text-sm font-medium ring-1 transition-colors", on ? "bg-brand-soft text-brand ring-brand" : "bg-white text-muted ring-line hover:text-ink")}
                    >
                      {tx(lang, en, bn)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-sm text-muted">
                {tx(lang, "Next workout:", "পরের ব্যায়াম:")} <span className="font-medium text-ink">{nextWorkout(schedule)}</span>
              </p>
            </div>
          </section>
        )}

        <section aria-labelledby="plan-clinician">
          <Heading id="plan-clinician" title={tx(lang, "From your clinician", "চিকিৎসকের দেওয়া")} />
          {clinician.length ? (
            <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
              {clinician.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                  <div>
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-sm text-muted">
                      {p.clinicianName} · approved {p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  {plan?.id === p.id ? (
                    <span className="text-sm font-medium text-muted">{tx(lang, "Current plan", "বর্তমান প্ল্যান")}</span>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => moveStore.set({ plan: p })}>
                      Use this plan
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Link href={`${BASE}/clinician`} className="group flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-line transition-colors hover:bg-wash">
              <span>
                <span className="block font-medium text-ink">{tx(lang, "Connect to your clinic", "আপনার ক্লিনিকের সাথে যুক্ত হন")}</span>
                <span className="block text-sm text-muted">{tx(lang, "If your clinician uses ASHA Clinic, their recovery or heart plan appears here.", "আপনার চিকিৎসক ASHA Clinic ব্যবহার করলে তাঁর দেওয়া প্ল্যান এখানে দেখা যাবে।")}</span>
              </span>
              <ChevronIcon size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
