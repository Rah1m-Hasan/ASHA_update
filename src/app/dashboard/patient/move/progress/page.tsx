"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { ButtonLink } from "@/components/ui/Button";
import { EXERCISES, title } from "@/features/move/catalog.js";
import { useMove } from "@/features/move/store";
import { BASE, tx } from "@/features/move/ui";
import { cn } from "@/lib/cn";

const ENDED: Record<string, { en: string; bn: string; alert?: boolean }> = {
  completed: { en: "Completed", bn: "সম্পন্ন" },
  stopped_tired: { en: "Ended early (tired)", bn: "আগে শেষ (ক্লান্ত)" },
  cancelled: { en: "Stopped", bn: "থামানো" },
  safety_stop: { en: "Safety stop", bn: "নিরাপত্তার জন্য থামানো", alert: true },
};

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

const when = (iso: string | null) =>
  iso ? `${new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, ${new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "";

const unitOf = (id: string) => (EXERCISES[id].kind === "timed_hold" ? "s" : " reps");

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
      <div className="max-w-3xl">
        <PageHeader title={tx(lang, "Progress", "অগ্রগতি")} />
        <div className="rounded-2xl bg-white ring-1 ring-line">
          <EmptyState title={tx(lang, "No workouts yet", "এখনো কোনো ব্যায়াম নেই")} action={<ButtonLink href={`${BASE}/session`}>{tx(lang, "Start a workout", "ব্যায়াম শুরু করুন")}</ButtonLink>}>
            {tx(lang, "Your completed workouts, reps and hold times will show here. They stay on this device.", "শেষ করা ব্যায়াম, কতবার ও কত সেকেন্ড ধরে রেখেছেন তা এখানে দেখা যাবে। এগুলো এই ডিভাইসেই থাকে।")}
          </EmptyState>
        </div>
      </div>
    );

  const summary = [
    { label: tx(lang, "Workouts", "ব্যায়াম"), value: String(stats.workouts) },
    { label: tx(lang, "Active minutes", "সক্রিয় মিনিট"), value: String(stats.activeMinutes) },
    {
      label: tx(lang, "This week", "এই সপ্তাহে"),
      value: stats.scheduledSoFar ? tx(lang, `${stats.weekDays} of ${stats.scheduledSoFar}`, `${stats.weekDays}/${stats.scheduledSoFar}`) : String(stats.weekDays),
      hint: stats.scheduledSoFar ? tx(lang, "planned days so far", "পরিকল্পিত দিনের মধ্যে") : tx(lang, "days", "দিন"),
    },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={tx(lang, "Progress", "অগ্রগতি")}
        description={tx(lang, "What you did, counted by the camera or by you. ASHA doesn't estimate calories, body fat or medical outcomes.", "আপনি যা করেছেন, ক্যামেরা বা আপনি যা গুনেছেন। ASHA ক্যালরি, চর্বি বা চিকিৎসার ফলাফল অনুমান করে না।")}
      />

      <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl bg-white ring-1 ring-line">
        {summary.map((s) => (
          <div key={s.label} className="px-4 py-4 sm:px-5">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-ink sm:text-2xl">{s.value}</dd>
            {s.hint && <dd className="text-xs text-muted">{s.hint}</dd>}
          </div>
        ))}
      </dl>

      <section aria-labelledby="progress-exercises" className="mt-10">
        <h2 id="progress-exercises" className="text-base font-semibold text-ink">
          {tx(lang, "By exercise", "ব্যায়াম অনুযায়ী")}
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-muted">{tx(lang, "Reps (or seconds held) in each workout, oldest to newest.", "প্রতি ব্যায়ামে কতবার (বা কত সেকেন্ড), পুরোনো থেকে নতুন।")}</p>
        <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
          {Object.entries(stats.perExercise).map(([id, values]) => (
            <li key={id} className="flex items-center gap-4 px-5 py-3">
              <span className="min-w-0 flex-1 font-medium text-ink">{title(EXERCISES[id], lang)}</span>
              <Sparkline values={values} height={28} className="hidden max-w-32 sm:block" />
              <span className="w-24 shrink-0 text-right text-sm tabular-nums text-muted">
                {tx(lang, "last", "শেষ")} {values.at(-1)}
                {unitOf(id)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="progress-history" className="mt-10">
        <h2 id="progress-history" className="mb-3 text-base font-semibold text-ink">
          {tx(lang, "History", "ইতিহাস")}
        </h2>
        <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
          {[...history].reverse().map((h) => {
            const ended = ENDED[h.endedBy ?? ""] ?? { en: h.endedBy ?? "—", bn: h.endedBy ?? "—" };
            return (
              <li key={h.startedAt ?? h.programId} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-ink">
                    {h.programName}
                    {h.authoredBy === "clinician" && <span className="ml-2 text-xs font-normal text-muted">from {h.clinicianName}</span>}
                  </span>
                  <span className="text-sm text-muted">{when(h.startedAt)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  <span className={cn(ended.alert ? "font-medium text-red-700" : "text-ink")}>{tx(lang, ended.en, ended.bn)}</span> · {h.setsDone}/{h.setsPlanned} sets · {h.activeMinutes} min ·{" "}
                  {h.mode === "camera" ? tx(lang, "camera", "ক্যামেরা") : tx(lang, "manual", "নিজে")}
                  {h.effort != null ? ` · effort ${h.effort}/10` : ""}
                  {h.feltAfter ? ` · felt ${h.feltAfter.toLowerCase()}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted">
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
      </section>
    </div>
  );
}
