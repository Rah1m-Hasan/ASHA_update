"use client";

import Link from "next/link";
import { useCare } from "@/features/caregiver/CareProvider";
import { cn } from "@/lib/cn";

/** Sidebar footer: which patient the caregiver is looking at. */
export function PatientSwitcher() {
  const { care, active, select, online } = useCare();
  if (!care.length)
    return (
      <Link href="/dashboard/caregiver/patients/new" className="block rounded-xl bg-brand-soft p-3 text-sm font-medium text-brand">
        Add your first patient
      </Link>
    );
  return (
    <div className="rounded-2xl bg-wash p-3">
      <label htmlFor="patient-switch" className="text-xs font-medium text-muted">
        Viewing
      </label>
      <div className="mt-1 flex items-center gap-2">
        <span className={cn("size-2 shrink-0 rounded-full", online ? "bg-good-strong" : "bg-line")} aria-label={online ? "Online" : "Not active"} />
        <select
          id="patient-switch"
          value={active?.patientId}
          onChange={(e) => select(e.target.value)}
          className="w-full truncate bg-transparent font-semibold text-ink focus:outline-none"
        >
          {care.map((c) => (
            <option key={c.patientId} value={c.patientId}>
              {c.label} · ···{c.patientId.slice(-4)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
