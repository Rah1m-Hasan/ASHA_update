"use client";

// The review screen: what ASHA thinks is on the plate, and what the person says is.
//
// This is the screen that decides whether a camera proposal becomes a record. Three rules hold
// here, and they are why the screen looks the way it does:
//
//   1. NOTHING IS SAVED WITHOUT THE PERSON CONFIRMING IT. The button at the bottom says what
//      will happen ("Save this meal"), and everything above it is a proposal.
//
//   2. THE SCORE IS NOT A PERCENTAGE. The camera's number is shown as a number, in a sentence
//      that says it is a score and not a probability. On a real photograph of kidney beans the
//      model said "chocolate" with a score of 0.66, and over 200 labelled photographs the
//      highest-scoring wrong answer was "cabbage" at 0.99. A percentage would be a lie.
//
//   3. A CORRECTION OVERRIDES THE CAMERA. Choosing a different name, a different amount or
//      removing a food is not "editing a suggestion" - it is replacing it, and the corrected
//      value is what gets calculated.
//
// Nothing here is drag-only, nothing needs a precise gesture, and nothing needs speech. Every
// control is a button or a text field with a label a screen reader can read.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type ReviewFood = {
  /** Stable id for this row, so React and the correction list can tell them apart. */
  uid: string;
  /** The catalogue id. null while the person has not chosen one. */
  foodId: string | null;
  /** The name ASHA proposes. */
  proposedName: string;
  proposedNameBn: string;
  /** The camera's score for this region. This is not a probability. */
  score: number | null;
  /** The class the model actually said, shown so a person can judge it. */
  modelLabel: string | null;
  /** Other foods this region might be. */
  alternatives: { foodId: string; name: string; nameBn: string }[];
  /** The weight the person chose, in grams. */
  grams: number | null;
  /** How the weight was arrived at. */
  method: "weighed" | "household_unit" | "visual_estimate_confirmed" | null;
  /** The uncertainty of the weight, if it came from the picture. */
  uncertainty: { relativeSigma: number; level: "low" | "medium" | "high"; text: string; textBn: string } | null;
  /** The area of the region, as a fraction of the picture. */
  areaRatio: number | null;
  /** The region in the picture, in fractions of its width and height. */
  region: { x: number; y: number; w: number; h: number } | null;
  /** True when ASHA has no catalogue food for this region. */
  unidentified: boolean;
  /** True when the person changed what ASHA proposed. */
  corrected: boolean;
};

export type CatalogueEntryLite = { foodId: string; name: string; nameBn: string; category: string };

type Props = {
  lang: string;
  foods: ReviewFood[];
  photoUrl: string | null;
  /** The catalogue, for the search box. */
  catalogue: CatalogueEntryLite[];
  /** What ASHA could not work out. */
  missing: { code: string; message: string; messageBn: string }[];
  busy: boolean;
  onChange: (uid: string, patch: Partial<ReviewFood>) => void;
  onRemove: (uid: string) => void;
  onAdd: (foodId: string) => void;
  onConfirm: () => void;
  onDiscard: () => void;
};

const tx = (lang: string, en: string, bn: string) => (lang === "bn" ? bn : en);

/**
 * The camera's score, in words.
 *
 * The wording matters more than the number. "66% sure" would be a false claim about a model
 * score; "camera score 0.66 - not a probability" is exactly what it is.
 */
function scoreText(lang: string, score: number | null) {
  if (score === null) return tx(lang, "no score", "কোনো স্কোর নেই");
  return tx(
    lang,
    `camera score ${score.toFixed(2)} - this is not a probability`,
    `ক্যামেরার স্কোর ${score.toFixed(2)} - এটি সম্ভাবনা নয়`,
  );
}

function uncertaintyText(lang: string, level: "low" | "medium" | "high") {
  if (level === "low") return tx(lang, "narrow range", "সরু পরিসর");
  if (level === "medium") return tx(lang, "rough range", "আনুমানিক পরিসর");
  return tx(lang, "wide range - type the weight if you know it", "বড় পরিসর - জানলে ওজন লিখে দিন");
}

/**
 * The review screen.
 */
export function Review({
  lang,
  foods,
  photoUrl,
  catalogue,
  missing,
  busy,
  onChange,
  onRemove,
  onAdd,
  onConfirm,
  onDiscard,
}: Props) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalogue
      .filter((c) => `${c.name} ${c.nameBn} ${c.foodId}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, catalogue]);

  const identified = foods.filter((f) => !f.unidentified);
  const unidentified = foods.filter((f) => f.unidentified);
  const ready = identified.length > 0 && identified.every((f) => f.foodId && f.grams && f.grams > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="nutrition-vision-review">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-heading">{tx(lang, "Check what is on your plate", "আপনার প্লেটে কী আছে দেখুন")}</h2>
        <p className="text-muted">
          {tx(
            lang,
            "ASHA is guessing from the picture. Change anything that is wrong. Nothing is saved until you say so.",
            "আশা ছবি দেখে অনুমান করছে। যা ভুল মনে হচ্ছে বদলে নিন। আপনি না বলা পর্যন্ত কিছুই সংরক্ষিত হবে না।",
          )}
        </p>
      </header>

      {photoUrl ? (
        <div className="overflow-hidden rounded-2xl bg-sunken ring-1 ring-line">
          <img
            src={photoUrl}
            alt={tx(lang, "The photo of your plate", "আপনার প্লেটের ছবি")}
            className="mx-auto max-h-72 w-auto"
          />
        </div>
      ) : null}

      {missing.length > 0 && (
        <section className="rounded-2xl bg-warn-soft p-4 ring-1 ring-warn-line" aria-labelledby="missing-heading">
          <h3 id="missing-heading" className="font-semibold text-heading">
            {tx(lang, "What ASHA could not work out", "আশা যা বুঝতে পারেনি")}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
            {missing.map((m) => (
              <li key={m.code} data-testid={`missing-${m.code}`}>
                {lang === "bn" ? m.messageBn : m.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {identified.length > 0 && (
        <section className="space-y-3" aria-labelledby="found-heading">
          <h3 id="found-heading" className="font-semibold text-heading">
            {tx(lang, "Foods ASHA found", "আশা যা পেয়েছে")}
          </h3>
          {identified.map((food) => (
            <FoodCard key={food.uid} lang={lang} food={food} onChange={onChange} onRemove={onRemove} />
          ))}
        </section>
      )}

      {unidentified.length > 0 && (
        <section className="space-y-3" aria-labelledby="unknown-heading">
          <h3 id="unknown-heading" className="font-semibold text-heading">
            {tx(lang, "ASHA found something it does not know", "আশা এমন কিছু পেয়েছে যা সে চেনে না")}
          </h3>
          <p className="text-sm text-muted">
            {tx(
              lang,
              "These regions are not in ASHA's food list. Add what they are, or leave them out.",
              "এই অংশগুলো আশার খাবারের তালিকায় নেই। কী আছে তা যোগ করুন, অথবা বাদ দিন।",
            )}
          </p>
          {unidentified.map((food) => (
            <div key={food.uid} className="rounded-2xl bg-surface p-4 ring-1 ring-line" data-testid="unidentified-food">
              <p className="text-sm text-muted">
                {food.modelLabel
                  ? tx(lang, `The camera called this "${food.modelLabel}"`, `ক্যামেরা এটিকে "${food.modelLabel}" বলেছে`)
                  : tx(lang, "An unidentified region", "চেনা অপরিচিত একটি অংশ")}
              </p>
              <Button variant="ghost" onClick={() => onRemove(food.uid)} className="mt-2">
                {tx(lang, "Leave it out", "বাদ দিন")}
              </Button>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl bg-surface p-4 ring-1 ring-line" aria-labelledby="add-heading">
        <h3 id="add-heading" className="font-semibold text-heading">
          {tx(lang, "Add a food ASHA did not see", "আশা যা দেখেনি তা যোগ করুন")}
        </h3>
        {searchOpen ? (
          <div className="mt-2 space-y-2">
            <label className="block text-sm text-ink" htmlFor="vision-catalogue-search">
              {tx(lang, "Search the food list", "খাবারের তালিকায় খুঁজুন")}
            </label>
            <input
              id="vision-catalogue-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx(lang, "rice, ভাত, khichuri", "rice, ভাত, khichuri")}
              className="w-full rounded-xl border border-line bg-canvas px-3 py-3 text-base text-ink"
              autoComplete="off"
            />
            {results.length > 0 && (
              <ul className="space-y-1">
                {results.map((entry) => (
                  <li key={entry.foodId}>
                    <button
                      type="button"
                      onClick={() => {
                        onAdd(entry.foodId);
                        setQuery("");
                        setSearchOpen(false);
                      }}
                      className="w-full rounded-xl px-3 py-3 text-left text-base text-ink ring-1 ring-line hover:bg-wash"
                    >
                      {lang === "bn" ? entry.nameBn : entry.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && results.length === 0 && (
              <p className="text-sm text-muted">
                {tx(lang, "No food with that name. Try another word.", "এই নামে কোনো খাবার নেই। অন্য শব্দ চেষ্টা করুন।")}
              </p>
            )}
            <Button variant="ghost" onClick={() => setSearchOpen(false)}>
              {tx(lang, "Close", "বন্ধ করুন")}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setSearchOpen(true)} className="mt-2">
            {tx(lang, "Add a food", "একটি খাবার যোগ করুন")}
          </Button>
        )}
      </section>

      <div className="sticky bottom-0 flex flex-wrap gap-2 bg-canvas/95 py-3">
        <Button onClick={onConfirm} disabled={!ready || busy} data-testid="confirm-vision-meal">
          {tx(lang, "Save this meal", "এই খাবারটি সংরক্ষণ করুন")}
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={busy}>
          {tx(lang, "Discard", "বাতিল করুন")}
        </Button>
        {!ready && identified.length > 0 && (
          <p className="w-full text-sm text-muted" role="status">
            {tx(
              lang,
              "Choose a name and an amount for each food before saving.",
              "সংরক্ষণের আগে প্রতিটি খাবারের নাম ও পরিমাণ বেছে নিন।",
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * One food's card: what ASHA proposed, and the controls to change it.
 */
function FoodCard({
  lang,
  food,
  onChange,
  onRemove,
}: {
  lang: string;
  food: ReviewFood;
  onChange: (uid: string, patch: Partial<ReviewFood>) => void;
  onRemove: (uid: string) => void;
}) {
  const [altOpen, setAltOpen] = useState(false);
  const name = food.corrected && food.foodId ? food.proposedName : food.proposedName;

  return (
    <article className="rounded-2xl bg-surface p-4 ring-1 ring-line" data-testid="review-food" data-food={food.foodId ?? ""}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-lg font-semibold text-heading">{name}</h4>
          {food.corrected && (
            <p className="text-xs text-muted">
              {tx(lang, "You changed this. ASHA's guess was replaced.", "আপনি এটি বদলেছেন। আশার অনুমান বদলে গেছে।")}
            </p>
          )}
          {food.modelLabel && (
            <p className="text-xs text-subtle">
              {tx(lang, "The camera saw", "ক্যামেরা দেখেছে")}: {food.modelLabel}
            </p>
          )}
        </div>
        {food.score !== null && (
          <p className="rounded-full bg-wash px-3 py-1 text-xs text-muted" data-testid="review-score">
            {scoreText(lang, food.score)}
          </p>
        )}
      </div>

      {food.alternatives.length > 0 && (
        <div className="mt-2">
          <Button variant="ghost" onClick={() => setAltOpen((v) => !v)} aria-expanded={altOpen}>
            {altOpen
              ? tx(lang, "Hide the other possibilities", "অন্য সম্ভাবনাগুলো লুকান")
              : tx(lang, "This might be something else", "এটি অন্য কিছু হতে পারে")}
          </Button>
          {altOpen && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {food.alternatives.map((alt) => (
                <li key={alt.foodId}>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(food.uid, {
                        foodId: alt.foodId,
                        proposedName: alt.name,
                        proposedNameBn: alt.nameBn,
                        corrected: true,
                      })
                    }
                    className="rounded-full bg-wash px-4 py-2 text-sm text-ink ring-1 ring-line hover:bg-brand-soft"
                  >
                    {lang === "bn" ? alt.nameBn : alt.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <div>
          <label className="block text-sm text-ink" htmlFor={`grams-${food.uid}`}>
            {tx(lang, "How much?", "কতটুকু?")}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`grams-${food.uid}`}
              type="number"
              inputMode="decimal"
              min={1}
              max={3000}
              step={1}
              value={food.grams ?? ""}
              onChange={(e) =>
                onChange(food.uid, {
                  grams: e.target.value === "" ? null : Number(e.target.value),
                  method: "weighed",
                })
              }
              placeholder={tx(lang, "grams", "গ্রাম")}
              className="w-32 rounded-xl border border-line bg-canvas px-3 py-3 text-base text-ink"
            />
            <span className="text-sm text-muted">{tx(lang, "grams", "গ্রাম")}</span>
          </div>
        </div>

        {food.uncertainty && (
          <p className="text-xs text-muted" data-testid="review-uncertainty">
            {uncertaintyText(lang, food.uncertainty.level)} - {lang === "bn" ? food.uncertainty.textBn : food.uncertainty.text}
          </p>
        )}
        {food.method === "visual_estimate_confirmed" && (
          <p className="text-xs text-muted">
            {tx(lang, "From the picture, and you accepted it.", "ছবি থেকে, এবং আপনি সম্মতি দিয়েছেন।")}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => onRemove(food.uid)}>
          {tx(lang, "Not on my plate", "আমার প্লেটে নেই")}
        </Button>
      </div>
    </article>
  );
}
