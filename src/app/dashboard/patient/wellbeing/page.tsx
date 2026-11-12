"use client";

import Link from "next/link";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ChevronIcon } from "@/components/ui/icons";
import { areaById } from "@/features/home/areas";

export default function WellbeingPage() {
  const area = areaById("wellbeing")!;
  return (
    <div className="max-w-3xl">
      <PageHeader title={area.label} description="Gentle checks and a private journal for your care. Camera checks are estimates for awareness, not medical measurements." />
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {area.modules.map((m) => (
          <li key={m.id}>
            <Link href={m.href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-wash focus-visible:bg-wash focus-visible:outline-none">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <m.icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{m.label}</span>
                <span className="block text-sm text-muted">{m.text}</span>
              </span>
              <ChevronIcon size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        Looking for exercise or meals?{" "}
        <Link href="/dashboard/patient/move" className="font-medium text-brand hover:underline">
          Exercise
        </Link>{" "}
        and{" "}
        <Link href="/dashboard/patient/nutrition" className="font-medium text-brand hover:underline">
          Nutrition
        </Link>{" "}
        have their own places.
      </p>
    </div>
  );
}
