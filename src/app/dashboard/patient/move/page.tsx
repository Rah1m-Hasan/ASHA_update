"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { ChevronIcon, EyeIcon, HandIcon, HeartIcon, MoveIcon, PostureIcon, ShieldIcon, TargetIcon, UsersIcon } from "@/components/ui/icons";
import { CATEGORIES, EXERCISES, title } from "@/features/move/catalog.js";
import { useMove } from "@/features/move/store";
import { BASE, TrackingBadge, tx } from "@/features/move/ui";

const ICONS: Record<string, typeof EyeIcon> = {
  face: EyeIcon,
  upper_body: HandIcon,
  lower_body: MoveIcon,
  core: TargetIcon,
  full_body: PostureIcon,
  mobility: UsersIcon,
  rehab: ShieldIcon,
  heart: HeartIcon,
};

type Category = (typeof CATEGORIES)[number];
const CLINICIAN_LED = new Set(["rehab", "heart"]);

function ProgramRow({ c, lang }: { c: Category; lang: "en" | "bn" }) {
  const Icon = ICONS[c.id] ?? MoveIcon;
  const clinician = CLINICIAN_LED.has(c.id);
  const meta = clinician ? tx(lang, "Plan set by your clinician", "চিকিৎসকের দেওয়া প্ল্যান") : [`${c.minutes} min`, c.difficulty, c.equipment === "None" ? "No equipment" : c.equipment].join(" · ");
  return (
    <li>
      <Link
        href={c.id === "rehab" ? `${BASE}/clinician` : `${BASE}/start?category=${c.id}`}
        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-wash focus-visible:bg-wash focus-visible:outline-none"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">{lang === "bn" ? c.titleBn : c.title}</span>
          <span className="block text-sm text-muted">{c.blurb}</span>
          <span className="mt-1 block text-xs text-muted">{meta}</span>
        </span>
        <ChevronIcon size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export default function MoveExplore() {
  const lang = useMove((s) => s.language);
  const plan = useMove((s) => s.plan);
  const [query, setQuery] = useState("");
  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(EXERCISES).filter((e) => !q || [e.title, e.titleBn, e.area, e.category].some((v) => v.toLowerCase().includes(q)));
  }, [query]);
  const selfGuided = CATEGORIES.filter((c) => !CLINICIAN_LED.has(c.id));
  const clinicianLed = CATEGORIES.filter((c) => CLINICIAN_LED.has(c.id));

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={tx(lang, "Move", "মুভ")}
        description={tx(lang, "Gentle, guided exercise at home. Choose an area and ASHA builds a short plan around how you feel today.", "ঘরে বসে সহজ, নির্দেশিত ব্যায়াম। একটি বিষয় বেছে নিন, আজ আপনি কেমন বোধ করছেন সেই অনুযায়ী ASHA ছোট একটি প্ল্যান বানাবে।")}
        actions={plan ? <ButtonLink href={`${BASE}/session`}>{tx(lang, "Continue my plan", "আমার প্ল্যান চালিয়ে যান")}</ButtonLink> : undefined}
      />

      <p className="mb-8 flex items-start gap-2 text-sm text-muted">
        <ShieldIcon size={16} className="mt-0.5 shrink-0 text-brand" />
        <span>
          {tx(lang, "Stop right away and call 999 if you feel chest pain, faintness or severe breathlessness.", "বুকে ব্যথা, মাথা ঘোরা বা খুব শ্বাসকষ্ট হলে সঙ্গে সঙ্গে থামুন এবং ৯৯৯ নম্বরে কল করুন।")}{" "}
          <Link href={`${BASE}/safety`} className="inline-block py-1 font-medium text-brand hover:underline">
            {tx(lang, "Safety settings", "নিরাপত্তা সেটিংস")}
          </Link>
        </span>
      </p>

      <section aria-labelledby="move-self">
        <h2 id="move-self" className="mb-3 text-sm font-semibold text-ink">
          {tx(lang, "Start on your own", "নিজে শুরু করুন")}
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {selfGuided.map((c) => (
            <ProgramRow key={c.id} c={c} lang={lang} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="move-clinician" className="mt-8">
        <h2 id="move-clinician" className="text-sm font-semibold text-ink">
          {tx(lang, "With your clinician", "চিকিৎসকের সাথে")}
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-muted">{tx(lang, "For recovery or a heart condition, follow the plan your clinician gives you.", "রিকভারি বা হৃদরোগের জন্য চিকিৎসকের দেওয়া প্ল্যান মেনে চলুন।")}</p>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {clinicianLed.map((c) => (
            <ProgramRow key={c.id} c={c} lang={lang} />
          ))}
        </ul>
      </section>

      <details className="group mt-8 rounded-2xl bg-surface ring-1 ring-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-ink">
          <span>
            {tx(lang, "Browse all exercises", "সব ব্যায়াম দেখুন")} <span className="font-normal text-muted">({Object.keys(EXERCISES).length})</span>
          </span>
          <ChevronIcon size={18} className="text-muted transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-line px-5 pb-5 pt-4">
          <label className="block">
            <span className="sr-only">{tx(lang, "Search exercises", "ব্যায়াম খুঁজুন")}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx(lang, "Search, e.g. squat or shoulder", "খুঁজুন, যেমন স্কোয়াট")}
              className="h-11 w-full rounded-xl bg-surface px-3 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <p className="mt-2 text-xs text-muted">{tx(lang, "“Manual” exercises are guided and timed; you count them yourself.", "“Manual” ব্যায়াম সময় ধরে দেখানো হয়, আপনি নিজে গুনবেন।")}</p>
          <ul className="mt-3 divide-y divide-line">
            {library.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{title(e, lang)}</p>
                  <p className="text-sm capitalize text-muted">
                    {e.area} · {e.difficulty}
                  </p>
                </div>
                <TrackingBadge id={e.id} />
              </li>
            ))}
            {!library.length && <li className="py-6 text-center text-sm text-muted">{tx(lang, `No exercise matches “${query}”.`, `“${query}” মেলে এমন ব্যায়াম নেই।`)}</li>}
          </ul>
        </div>
      </details>
    </div>
  );
}
