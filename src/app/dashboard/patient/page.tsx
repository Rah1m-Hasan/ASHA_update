"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { DeliveryBanner } from "@/components/patient/DeliveryBanner";
import { NeedButtons } from "@/components/patient/NeedButtons";
import { ChevronIcon } from "@/components/ui/icons";
import { MODULES, type Area } from "@/features/home/areas";
import { homeStore, orderAreas, useHome } from "@/features/home/store";
import { usePatientProfile } from "@/features/session/usePatientProfile";
import { cn } from "@/lib/cn";

function AreaCard({ area, suggested }: { area: Area; suggested: boolean }) {
  const Icon = area.icon;
  const many = area.modules.length > 1;
  return (
    <li>
      <Link
        href={area.href}
        className="group flex h-full items-start gap-4 rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="text-lg font-semibold text-ink">{area.label}</span>
            {suggested && <span className="text-xs font-medium text-brand">Suggested for you</span>}
          </span>
          <span className="mt-0.5 block text-muted">{area.text}</span>
          {many && <span className="mt-2 block text-sm text-muted">{area.modules.map((m) => m.label).join(" · ")}</span>}
        </span>
        <ChevronIcon size={20} className="mt-3 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export default function PatientHome() {
  const { profile, isLocalDemo } = usePatientProfile();
  const home = useHome();
  const [customising, setCustomising] = useState(false);
  const { shown, hidden, suggested } = orderAreas(home, profile?.recommendation.suggested ?? []);
  const last = home.recent[0] ? MODULES[home.recent[0].module ?? ""] : undefined;
  const showHelp = !home.hidden.includes("communicate");

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-center gap-4">
        <Image src="/assets/assets/images/asha-avatar.png" alt="" width={64} height={64} className="size-14 rounded-full ring-4 ring-brand-soft" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            Hello{profile && !isLocalDemo ? `, ${profile.label}` : ""}. What would you like to do?
          </h1>
          <p className="text-muted">Choose an area. Asha remembers what you use and keeps it close.</p>
        </div>
      </div>

      <DeliveryBanner />

      {last && (
        <Link href={last.href} className="group mb-8 flex items-center gap-4 rounded-2xl bg-brand-soft p-4 ring-1 ring-brand-mint transition hover:ring-brand" data-testid="home-continue">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-brand">
            <last.icon size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-muted">Continue where you left off</span>
            <span className="block font-semibold text-ink">{last.label}</span>
          </span>
          <ChevronIcon size={20} className="shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {showHelp && (
        <section aria-labelledby="needs-title" className="mb-10">
          <h2 id="needs-title" className="mb-3 text-base font-semibold text-ink">
            Need something now?
          </h2>
          <NeedButtons size="md" />
        </section>
      )}

      <section aria-labelledby="areas-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 id="areas-title" className="text-base font-semibold text-ink">
            {home.recent.length ? "Your areas" : "What Asha can help with"}
          </h2>
          <button type="button" onClick={() => setCustomising((v) => !v)} aria-expanded={customising} className="text-sm font-medium text-brand hover:underline">
            {customising ? "Done" : "Personalise"}
          </button>
        </div>

        {customising && (
          <fieldset className="mb-4 rounded-2xl bg-surface p-5 ring-1 ring-line">
            <legend className="sr-only">Areas on your home</legend>
            <p className="mb-3 text-sm text-muted">Choose what appears on your home. Everything stays in the menu, and nothing is deleted.</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[...shown, ...hidden].map((a) => (
                <li key={a.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-wash">
                    <input type="checkbox" className="size-5 accent-[var(--color-brand)]" checked={!home.hidden.includes(a.id)} onChange={() => homeStore.toggleHidden(a.id)} />
                    <span className="text-ink">{a.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            {(home.recent.length > 0 || home.hidden.length > 0) && (
              <button type="button" onClick={() => homeStore.reset()} className="mt-3 text-sm font-medium text-muted hover:text-ink">
                Reset order and choices
              </button>
            )}
          </fieldset>
        )}

        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shown.map((a) => (
            <AreaCard key={a.id} area={a} suggested={suggested.includes(a.id) && !home.recent.some((v) => v.area === a.id)} />
          ))}
        </ul>

        {hidden.length > 0 && !customising && (
          <details className="group mt-6">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted hover:text-ink">
              <ChevronIcon size={16} className="transition-transform group-open:rotate-90" />
              More in Asha ({hidden.length})
            </summary>
            <ul className={cn("mt-3 grid gap-3 md:grid-cols-2")}>
              {hidden.map((a) => (
                <AreaCard key={a.id} area={a} suggested={false} />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
