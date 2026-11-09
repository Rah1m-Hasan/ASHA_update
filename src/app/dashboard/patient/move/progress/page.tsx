"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { Stat } from "@/components/dashboard/Stat";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { EXERCISES, title } from "@/features/move/catalog.js";
import { useMove } from "@/features/move/store";
import { BASE, tx } from "@/features/move/ui";

const ENDED: Record<string, { label: string; tone: "good" | "warn" | "alert" | "neutral" }> = {
  completed: { label: "Completed", tone: "good" },
  stopped_tired: { label: "Ended early (tired)", tone: "neutral" },
  cancelled: { label: "Stopped", tone: "neutral" },
  safety_stop: { label: "Safety stop", tone: "alert" },
};

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export default function MoveProgress() {
  const lang = useMove((s) => s.language);
  const history = useMove((s) => s.history);
  const schedule = useMove((s) => s.schedule);

  const stats = useMemo(() => {
    const week = startOfWeek().getTime();
    const thisWeek = history.filter((h) => h.startedAt && Date.parse(h.startedAt) >= week && h.setsDone > 0);
    const days = new Set(thisWeek.map((h) => new Date(h.startedAt!).getDay()));
    const scheduledSoFar = schedule.filter((d) => d <= new Date().getDay()).length;
    const perExercise: Record<string, number[]> = {};
    for (const h of history)
      for (const e of h.exercises)
        if (e.setsDone) (perExercise[e.exerciseId] ??= []).push(e.seconds || e.reps);
    return {
      workouts: history.filter((h) => h.setsDone > 0).length,
      activeMinutes: Math.round(history.reduce((n, h) => n + (h.activeMinutes || 0), 0)),
      weekDays: days.size,
      scheduledSoFar,
      perExercise,
    };
  }, [history, schedule]);

  if (!history.length)
    return (
      <>
        <PageHeader title={tx(lang, "Progress", "অগ্রগতি")} />
        <EmptyState title="No workouts yet" action={<ButtonLink href={`${BASE}/session`}>Start a workout</ButtonLink>}>
          Your completed workouts, reps and hold times will show here. They stay on this device.
        </EmptyState>
      </>
    );

  return (
    <>
      <PageHeader title={tx(lang, "Progress", "অগ্রগতি")} description="What you actually did, counted by the camera or by you. No body-fat, calorie or medical-outcome estimates." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Workouts" value={stats.workouts} />
        <Stat label="Active minutes" value={stats.activeMinutes} />
        <Stat label="This week" value={`${stats.weekDays} day${stats.weekDays === 1 ? "" : "s"}`} hint={`${stats.scheduledSoFar} planned so far this week`} />
        <Stat label="Adherence" value={stats.scheduledSoFar ? `${Math.min(100, Math.round((stats.weekDays / stats.scheduledSoFar) * 100))}%` : "—"} hint="Workout days vs planned days this week" />
      </div>

      <Panel className="mt-6" title="Per exercise" description="Reps (or seconds held) in each workout, oldest to newest.">
        <ul className="grid gap-4 md:grid-cols-2">
          {Object.entries(stats.perExercise).map(([id, values]) => (
            <li key={id} className="rounded-2xl bg-wash/60 p-4 ring-1 ring-line">
              <div className="flex justify-between">
                <span className="font-medium text-ink">{title(EXERCISES[id], lang)}</span>
                <span className="text-sm tabular-nums text-muted">
                  last {values.at(-1)}
                  {EXERCISES[id].kind === "timed_hold" ? "s" : " reps"}
                </span>
              </div>
              <Sparkline values={values} height={48} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="mt-6" title="History">
        <ul className="divide-y divide-line">
          {[...history].reverse().map((h) => {
            const ended = ENDED[h.endedBy ?? ""] ?? { label: h.endedBy ?? "—", tone: "neutral" as const };
            return (
              <li key={h.startedAt ?? h.programId} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">
                    {h.programName}
                    {h.authoredBy === "clinician" && <span className="ml-2 text-xs text-muted">from {h.clinicianName}</span>}
                  </span>
                  <StatusPill tone={ended.tone}>{ended.label}</StatusPill>
                </div>
                <p className="text-sm text-muted">
                  {h.startedAt ? new Date(h.startedAt).toLocaleString() : ""} · {h.setsDone}/{h.setsPlanned} sets · {h.activeMinutes} min · {h.mode === "camera" ? "camera" : "manual"}
                  {h.effort != null ? ` · effort ${h.effort}/10` : ""}
                  {h.feltAfter ? ` · felt ${h.feltAfter.toLowerCase()}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {h.exercises
                    .filter((e) => e.setsDone)
                    .map((e) => `${title(EXERCISES[e.exerciseId], lang)} ${e.seconds ? `${e.seconds}s` : `${e.reps} reps`}`)
                    .join(" · ")}
                </p>
                {h.safety && <p className="mt-1 text-xs text-red-700">Stopped for: {h.safety.reasons.join(", ")}</p>}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
