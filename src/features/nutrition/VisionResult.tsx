"use client";

// The result of a meal the person confirmed, shown before it is saved.
//
// The wording is the point. A number that came out of a composition table and a picture is an
// ESTIMATE, and it says so. Nothing here says "calories" on its own, and nothing here presents
// the estimate as a measurement of what was eaten.

import { Button } from "@/components/ui/Button";

export type VisionMealItem = {
  foodId: string;
  name: string;
  nameBn: string;
  grams: number;
  method: string;
  nutrients: Record<string, number | null>;
  databaseRecordId: string | null;
  assumptions: { en: string; bn: string }[];
};

export type VisionMeal = {
  status: string;
  total: Record<string, number | null>;
  items: VisionMealItem[];
  excluded: string[];
};

const tx = (lang: string, en: string, bn: string) => (lang === "bn" ? bn : en);

const NUTRIENT_LABEL: Record<string, { en: string; bn: string; unit: string; unitBn: string }> = {
  kcal: { en: "Energy", bn: "শক্তি", unit: "kcal", unitBn: "কিলোক্যালরি" },
  protein: { en: "Protein", bn: "প্রোটিন", unit: "g", unitBn: "গ্রাম" },
  fat: { en: "Fat", bn: "চর্বি", unit: "g", unitBn: "গ্রাম" },
  carbohydrate: { en: "Carbohydrate", bn: "কার্বোহাইড্রেট", unit: "g", unitBn: "গ্রাম" },
  fiber: { en: "Fibre", bn: "ফাইবার", unit: "g", unitBn: "গ্রাম" },
  sodium: { en: "Sodium", bn: "সোডিয়াম", unit: "mg", unitBn: "মিগ্রা" },
};

/**
 * The rounded number ASHA shows.
 *
 * Energy is rounded to the nearest 5 above 50, because a number that looks precise is a claim
 * about precision the estimate does not have.
 */
export function approx(value: number | null, key: string) {
  if (value === null || !Number.isFinite(value)) return null;
  if (key === "kcal") return value >= 50 ? Math.round(value / 5) * 5 : Math.round(value);
  if (key === "sodium") return value >= 20 ? Math.round(value / 5) * 5 : Math.round(value);
  return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
}

/** The Bangla digits, so a number reads the same way as the rest of the Bangla interface. */
const BN_DIGITS: Record<string, string> = {
  "0": "০",
  "1": "১",
  "2": "২",
  "3": "৩",
  "4": "৪",
  "5": "৫",
  "6": "৬",
  "7": "৭",
  "8": "৮",
  "9": "৯",
};

function digits(value: number | null, lang: string) {
  if (value === null) return lang === "bn" ? "অজানা" : "unknown";
  const text = String(value);
  return lang === "bn" ? text.replace(/\d/g, (d) => BN_DIGITS[d] ?? d) : text;
}

/**
 * The result screen.
 */
export function VisionMealResult({
  lang,
  meal,
  busy,
  onSave,
  onEdit,
  onDiscard,
}: {
  lang: string;
  meal: VisionMeal;
  busy: boolean;
  onSave: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}) {
  const assumptions = [...new Map(meal.items.flatMap((i) => i.assumptions).map((a) => [a.en, a])).values()];

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="nutrition-vision-result">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-heading">{tx(lang, "Your meal", "আপনার খাবার")}</h2>
        <p className="text-muted">
          {tx(
            lang,
            "This is ASHA's estimate from food composition tables, not a laboratory measurement.",
            "এটি খাদ্য গঠন সারণি থেকে আশার অনুমান, কোনো গবেষণাগারের মাপ নয়।",
          )}
        </p>
      </header>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line" aria-labelledby="vision-total">
        <h3 id="vision-total" className="text-sm font-medium text-muted">
          {tx(lang, "Estimated total", "আনুমানিক মোট")}
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Object.entries(NUTRIENT_LABEL).map(([key, label]) => {
            const value = approx(meal.total[key] ?? null, key);
            return (
              <div key={key}>
                <dt className="text-sm text-muted">{lang === "bn" ? label.bn : label.en}</dt>
                <dd className="text-2xl font-semibold text-heading" data-testid={`total-${key}`}>
                  {digits(value, lang)}
                  <span className="ml-1 text-sm font-normal text-muted">
                    {lang === "bn" ? label.unitBn : label.unit}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
        {meal.excluded.length > 0 && (
          <p className="mt-3 text-sm text-warn-strong" role="status">
            {tx(
              lang,
              "One or more foods could not be worked out, so this total does not include them.",
              "এক বা একাধিক খাবারের হিসাব করা যায়নি, তাই এই মোটে সেগুলো নেই।",
            )}
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line" aria-labelledby="vision-items">
        <h3 id="vision-items" className="font-semibold text-heading">
          {tx(lang, "What is in it", "এতে কী আছে")}
        </h3>
        <ul className="mt-2 divide-y divide-line">
          {meal.items.map((item) => (
            <li key={item.foodId} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span className="font-medium text-ink">{lang === "bn" ? item.nameBn : item.name}</span>
              <span className="text-sm text-muted">
                {digits(Math.round(item.grams), lang)} {tx(lang, "g", "গ্রাম")} ·{" "}
                {digits(approx(item.nutrients.kcal ?? null, "kcal"), lang)}{" "}
                {tx(lang, "kcal", "কিলোক্যালরি")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {assumptions.length > 0 && (
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line" aria-labelledby="vision-assumed">
          <h3 id="vision-assumed" className="font-semibold text-heading">
            {tx(lang, "What ASHA assumed", "আশা যা ধরে নিয়েছে")}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {assumptions.map((a) => (
              <li key={a.en}>{lang === "bn" ? a.bn : a.en}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Opaque, so a row of food scrolling behind it is never half-visible. */}
      <div className="sticky bottom-0 flex flex-wrap gap-2 bg-canvas py-3">
        <Button onClick={onSave} disabled={busy} data-testid="save-vision-meal">
          {tx(lang, "Save this meal", "এই খাবারটি সংরক্ষণ করুন")}
        </Button>
        <Button variant="secondary" onClick={onEdit} disabled={busy}>
          {tx(lang, "Change something", "কিছু বদলান")}
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={busy}>
          {tx(lang, "Discard", "বাতিল করুন")}
        </Button>
      </div>
    </div>
  );
}
