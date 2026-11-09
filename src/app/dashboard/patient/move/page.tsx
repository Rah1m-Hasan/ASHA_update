"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { ButtonLink } from "@/components/ui/Button";
import { CATALOG_VERSION, CATEGORIES, EXERCISES, title } from "@/features/move/catalog.js";
import { useMove } from "@/features/move/store";
import { BASE, TrackingBadge, tx } from "@/features/move/ui";

export default function MoveExplore() {
  const lang = useMove((s) => s.language);
  const plan = useMove((s) => s.plan);
  const [query, setQuery] = useState("");
  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(EXERCISES).filter((e) => !q || [e.title, e.titleBn, e.area, e.category].some((v) => v.toLowerCase().includes(q)));
  }, [query]);

  return (
    <>
      <PageHeader
        title={tx(lang, "Move", "মুভ")}
        description={tx(lang, "Pick what you want to work on. ASHA guides one exercise at a time and only counts what the camera can actually see.", "কী নিয়ে কাজ করবেন বেছে নিন। ASHA একবারে একটি ব্যায়াম দেখায় এবং ক্যামেরা যা দেখে শুধু তা-ই গোনে।")}
        actions={plan ? <ButtonLink href={`${BASE}/session`}>{tx(lang, "Start my plan", "আমার প্ল্যান শুরু")}</ButtonLink> : undefined}
      />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CATEGORIES.map((c) => (
          <li key={c.id}>
            <Link
              href={c.id === "rehab" ? `${BASE}/clinician` : `${BASE}/start?category=${c.id}`}
              className="flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-line transition hover:ring-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <h2 className="text-base font-semibold text-ink">{lang === "bn" ? c.titleBn : c.title}</h2>
              <p className="mt-1 text-sm text-muted">{c.blurb}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Time</dt>
                  <dd className="font-medium text-ink">{c.minutes ? `${c.minutes} min` : "Set by clinician"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Level</dt>
                  <dd className="font-medium text-ink">{c.difficulty}</dd>
                </div>
                <div>
                  <dt className="text-muted">Equipment</dt>
                  <dd className="font-medium text-ink">{c.equipment}</dd>
                </div>
              </dl>
              <p className="mt-3 rounded-xl bg-wash p-3 text-xs text-ink">{c.safety}</p>
            </Link>
          </li>
        ))}
      </ul>

      <Panel
        className="mt-8"
        title={tx(lang, "Exercise library", "ব্যায়ামের তালিকা")}
        description={`Catalog ${CATALOG_VERSION}. Exercises marked Manual are guided and timed, and you count them yourself.`}
      >
        <label className="block">
          <span className="text-sm font-medium text-ink">{tx(lang, "Search", "খুঁজুন")}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="squat, shoulder, face…"
            className="mt-1 h-11 w-full rounded-xl bg-white px-3 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <ul className="mt-4 divide-y divide-line">
          {library.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="max-w-xl">
                <p className="font-medium text-ink">{title(e, lang)}</p>
                <p className="text-sm text-muted">
                  {e.area} · {e.difficulty}
                  {e.equipment.length ? ` · ${e.equipment.join(", ")}` : ""}
                  {e.cameraView ? ` · camera ${e.cameraView.replace("_", " ")}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted">{e.limitation}</p>
              </div>
              <TrackingBadge id={e.id} />
            </li>
          ))}
          {!library.length && <li className="py-6 text-center text-sm text-muted">No exercise matches “{query}”.</li>}
        </ul>
      </Panel>
    </>
  );
}
