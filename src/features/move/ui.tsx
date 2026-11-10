"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { cn } from "@/lib/cn";
import { EXERCISES } from "./catalog.js";
import { isTracked, isExperimental } from "./detectors.js";
import { lockoutActive, urgentGuidance, restGuidance } from "./safety.js";
import { useMove, type Lang } from "./store";

export const BASE = "/dashboard/patient/move";
export const tx = (lang: Lang, en: string, bn: string) => (lang === "bn" ? bn : en);

const TABS = [
  { href: BASE, en: "Explore", bn: "খুঁজুন" },
  { href: `${BASE}/plan`, en: "My plan", bn: "আমার প্ল্যান" },
  { href: `${BASE}/session`, en: "Live session", bn: "সেশন" },
  { href: `${BASE}/progress`, en: "Progress", bn: "অগ্রগতি" },
  { href: `${BASE}/safety`, en: "Settings & safety", bn: "সেটিংস ও নিরাপত্তা" },
  { href: `${BASE}/clinician`, en: "Clinician programs", bn: "চিকিৎসকের প্রোগ্রাম" },
];

export function MoveTabs() {
  const pathname = usePathname();
  const lang = useMove((s) => s.language);
  return (
    <nav aria-label="Move sections" className="-mx-1 mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-1">
        {TABS.map((t) => {
          const active = t.href === BASE ? pathname === BASE || pathname === `${BASE}/start` : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn("inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors", active ? "bg-brand text-white" : "bg-white text-ink ring-1 ring-line hover:bg-wash")}
              >
                {tx(lang, t.en, t.bn)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Re-render every `ms` so countdowns and lockouts stay current. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Urgent guidance card. Shown for emergency stops; it has no "continue exercising" action. */
export function UrgentCard({ reasons = [], kind = "emergency" }: { reasons?: string[]; kind?: "emergency" | "rest" }) {
  const lang = useMove((s) => s.language);
  const lines = kind === "emergency" ? urgentGuidance(lang, "BD", reasons) : restGuidance(lang, "BD");
  return (
    <section role="alert" aria-live="assertive" className={cn("rounded-2xl p-5 ring-1", kind === "emergency" ? "bg-red-50 ring-red-200" : "bg-amber-50 ring-amber-200")}>
      <h2 className={cn("text-lg font-semibold", kind === "emergency" ? "text-red-800" : "text-amber-900")}>
        {kind === "emergency" ? tx(lang, "Stop. Get urgent help now.", "থামুন। এখনই জরুরি সহায়তা নিন।") : tx(lang, "Stop and rest.", "থামুন এবং বিশ্রাম নিন।")}
      </h2>
      <ul className={cn("mt-2 list-disc space-y-1 pl-5", kind === "emergency" ? "text-red-900" : "text-amber-900")}>
        {lines.map((l: string) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {kind === "emergency" && (
        <a href="tel:999" className="mt-4 inline-flex h-12 items-center rounded-full bg-red-600 px-6 text-base font-semibold text-white hover:bg-red-700">
          {tx(lang, "Call 999", "৯৯৯ নম্বরে কল করুন")}
        </a>
      )}
    </section>
  );
}

export function LockoutBanner() {
  const lockout = useMove((s) => s.lockout);
  const lang = useMove((s) => s.language);
  const now = useNow(30000);
  if (!lockoutActive(lockout, now) || !lockout) return null;
  const until = new Date(lockout.until).toLocaleString();
  return (
    <div className="mb-6 space-y-3">
      <UrgentCard reasons={lockout.reasons} kind={lockout.kind} />
      <p className="text-sm text-muted">
        {tx(lang, `Workouts are paused until ${until}.`, `${until} পর্যন্ত ব্যায়াম বন্ধ।`)}{" "}
        {lockout.kind === "emergency" && (
          <Link href={`${BASE}/safety#lockout`} className="font-medium text-brand">
            {tx(lang, "Assessed by a clinician?", "চিকিৎসক দেখেছেন?")}
          </Link>
        )}
      </p>
    </div>
  );
}

/** How an exercise is counted, said plainly. */
export function TrackingBadge({ id }: { id: string }) {
  const e = EXERCISES[id];
  if (e.intendedUse === "clinician_assigned") return <StatusPill tone="brand">Clinician plan only</StatusPill>;
  if (!isTracked(id)) return <StatusPill>Manual</StatusPill>;
  if (isExperimental(id)) return <StatusPill tone="warn">Camera · experimental</StatusPill>;
  return <StatusPill tone="good">Camera counts</StatusPill>;
}

export function Choice({ selected, onClick, children, className }: { selected?: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn("min-h-12 rounded-2xl p-4 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand", selected ? "bg-brand-soft ring-brand" : "bg-white ring-line hover:bg-wash", className)}
    >
      {children}
    </button>
  );
}

export const describeStep = (s: { targetReps?: number; holdSeconds?: number; durationSeconds?: number; sets: number; restSeconds: number }, kind: string) => {
  const what = kind === "timed_hold" ? `${s.holdSeconds}s hold` : kind === "duration" ? `${Math.round((s.durationSeconds ?? 0) / 60)} min` : `${s.targetReps} reps`;
  return `${s.sets} × ${what} · rest ${s.restSeconds}s`;
};
