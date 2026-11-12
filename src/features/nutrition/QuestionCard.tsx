"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { speak } from "@/features/speech/speak";
import { cn } from "@/lib/cn";
import { searchFoods } from "./catalog.js";
import type { Answer, Question, Text } from "./types";

const L = (lang: string, x?: Text) => (x ? (lang === "bn" ? x.bn : x.en) : "");
const tx = (lang: string, en: string, bn: string) => (lang === "bn" ? bn : en);

export function NumberField({ id, label, value, onChange, min, max, step, onEnter }: { id: string; label: string; value: string; onChange: (v: string) => void; min: number; max: number; step: number; onEnter?: () => void }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
          }
        }}
        className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-lg text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      />
    </label>
  );
}

/**
 * One question, large tap targets, with "I don't know", "Skip" and "Back" (edit previous answer).
 * The heading takes focus when the question changes, so screen readers announce it.
 */
export function QuestionCard({
  question,
  lang,
  previous,
  onAnswer,
  onBack,
  canBack,
  heading,
  progress,
}: {
  question: Question;
  lang: string;
  previous?: Answer;
  onAnswer: (a: Answer) => void;
  onBack: () => void;
  canBack: boolean;
  heading: string;
  progress: { done: number; total: number };
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const [choice, setChoice] = useState<string | null>(previous?.choice ?? null);
  const [value, setValue] = useState(previous?.value !== undefined ? String(previous.value) : "");
  const [value2, setValue2] = useState(previous?.value2 !== undefined ? String(previous.value2) : "");
  const [text, setText] = useState(previous?.text ?? "");
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries((question.fields ?? []).map((f) => [f.id, previous?.[f.id] !== undefined ? String(previous[f.id]) : ""])));
  const [error, setError] = useState("");

  useEffect(() => {
    title.current?.focus();
  }, [question.id]);

  const opt = question.options?.find((o) => o.id === choice);
  const inRange = (v: string, f: { min: number; max: number }) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= f.min && Number(v) <= f.max;
  const rangeMsg = (f: { min: number; max: number }) => tx(lang, `Enter a number from ${f.min} to ${f.max}.`, `${f.min} থেকে ${f.max}-এর মধ্যে একটি সংখ্যা লিখুন।`);

  const submitInput = () => {
    if (!opt?.input) return;
    if (!inRange(value, opt.input)) return setError(rangeMsg(opt.input));
    onAnswer({ choice: opt.id, value: Number(value) });
  };
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section aria-labelledby={`q-${question.id}`} className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6" data-testid="nutrition-question" data-question={question.id}>
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <span>{heading}</span>
          <span>{tx(lang, `${progress.done} of ${progress.total} answered`, `${progress.total}টির ${progress.done}টি উত্তর`)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-wash" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={tx(lang, "Questions answered", "উত্তর দেওয়া প্রশ্ন")}>
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <h2 id={`q-${question.id}`} ref={title} tabIndex={-1} className="text-xl font-semibold text-ink focus:outline-none" lang={lang === "bn" ? "bn" : "en"}>
        {L(lang, question.text)}
      </h2>
      {question.help && <p className="mt-1 text-muted">{L(lang, question.help)}</p>}

      <div className="mt-5 space-y-3">
        {question.kind === "text" && (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return setError(tx(lang, "Type a name, or choose Skip.", "নাম লিখুন, বা বাদ দিন।"));
              onAnswer({ text: text.trim().slice(0, 80) });
            }}
          >
            <label className="block flex-1">
              <span className="sr-only">{L(lang, question.text)}</span>
              <input value={text} maxLength={80} onChange={(e) => setText(e.target.value)} placeholder={L(lang, question.placeholder)} className="h-12 w-full rounded-xl border border-line px-3 text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40" />
            </label>
            <Button type="submit">{tx(lang, "OK", "ঠিক আছে")}</Button>
          </form>
        )}

        {question.kind === "search" && <FoodSearch lang={lang} onPick={onAnswer} />}

        {question.kind === "share" && question.fields && (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const [f1, f2] = question.fields!;
              if (!inRange(value, f1)) return setError(rangeMsg(f1));
              if (!inRange(value2, f2)) return setError(rangeMsg(f2));
              if (Number(value2) > Number(value)) return setError(tx(lang, "Your servings can't be more than the pot made.", "আপনার পরিবেশন পাতিলের মোটের চেয়ে বেশি হতে পারে না।"));
              onAnswer({ value: Number(value), value2: Number(value2) });
            }}
          >
            <NumberField id="share-made" label={L(lang, question.fields[0])} value={value} onChange={setValue} min={question.fields[0].min} max={question.fields[0].max} step={question.fields[0].step} />
            <NumberField id="share-eaten" label={L(lang, question.fields[1])} value={value2} onChange={setValue2} min={question.fields[1].min} max={question.fields[1].max} step={question.fields[1].step} />
            <Button type="submit" className="sm:col-span-2 sm:justify-self-start">
              {tx(lang, "OK", "ঠিক আছে")}
            </Button>
          </form>
        )}

        {question.kind === "fields" && question.fields && (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const bad = question.fields!.find((f) => fields[f.id].trim() !== "" && !inRange(fields[f.id], f));
              if (bad) return setError(`${L(lang, bad)}: ${rangeMsg(bad)}`);
              const ans: Answer = {};
              for (const f of question.fields!) if (fields[f.id].trim() !== "") ans[f.id] = Number(fields[f.id]);
              onAnswer(Object.keys(ans).length ? ans : { skipped: true });
            }}
          >
            {question.fields.map((f) => (
              <NumberField key={f.id} id={`field-${f.id}`} label={L(lang, f)} value={fields[f.id]} onChange={(v) => setFields((s) => ({ ...s, [f.id]: v }))} min={f.min} max={f.max} step={f.step} />
            ))}
            <Button type="submit" className="sm:col-span-2 sm:justify-self-start">
              {tx(lang, "Add these", "যোগ করুন")}
            </Button>
          </form>
        )}

        {question.options && (
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={L(lang, question.text)}>
            {question.options.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={choice === o.id}
                onClick={() => {
                  setError("");
                  setChoice(o.id);
                  if (!o.input) onAnswer({ choice: o.id });
                }}
                className={cn(
                  "min-h-12 rounded-xl px-4 py-3 text-left text-base font-medium ring-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  choice === o.id ? "bg-brand-soft text-brand ring-brand" : "bg-surface text-ink ring-line hover:bg-wash",
                )}
              >
                {L(lang, o)}
              </button>
            ))}
          </div>
        )}
        {opt?.input && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <NumberField id={`in-${question.id}`} label={`${L(lang, opt)} (${L(lang, opt.input.unit)})`} value={value} onChange={setValue} onEnter={submitInput} {...opt.input} />
            </div>
            <Button onClick={submitInput}>{tx(lang, "OK", "ঠিক আছে")}</Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="secondary" size="sm" onClick={() => onAnswer({ dontKnow: true })}>
          {tx(lang, "I don't know", "জানি না")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAnswer({ skipped: true })}>
          {tx(lang, "Skip", "বাদ দিন")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onBack} disabled={!canBack}>
          {tx(lang, "Back: edit previous answer", "আগের উত্তর বদলান")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => speak([L(lang, question.text), L(lang, question.help), ...(question.options ?? []).map((o) => L(lang, o))].filter(Boolean).join(". "))}>
          {tx(lang, "Read aloud", "পড়ে শোনান")}
        </Button>
      </div>
    </section>
  );
}

/** "What food is this?": ASHA's checked foods and dishes, or a name only. */
export function FoodSearch({ lang, onPick }: { lang: string; onPick: (a: Answer) => void }) {
  const [q, setQ] = useState("");
  const results = searchFoods(q) as { kind: "dish" | "record"; id: string; en: string; bn: string }[];
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">{tx(lang, "Search foods", "খাবার খুঁজুন")}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx(lang, "rice, ভাত, chicken…", "ভাত, rice, মুরগি…")} className="h-12 w-full rounded-xl border border-line px-3 text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40" data-testid="food-search" />
      </label>
      <ul className="mt-3 space-y-2" aria-live="polite">
        {results.map((r) => (
          <li key={`${r.kind}:${r.id}`}>
            <button type="button" onClick={() => onPick(r.kind === "dish" ? { dishId: r.id } : { recordId: r.id })} className="flex min-h-12 w-full items-center justify-between rounded-xl bg-surface px-4 py-2 text-left ring-1 ring-line hover:bg-wash focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <span className="font-medium text-ink">{lang === "bn" ? r.bn : r.en}</span>
              <span className="text-xs text-muted">{r.kind === "dish" ? tx(lang, "dish", "পদ") : "USDA"}</span>
            </button>
          </li>
        ))}
        {q.trim() && (
          <li>
            <button type="button" onClick={() => onPick({ text: q.trim().slice(0, 80) })} className="min-h-12 w-full rounded-xl border border-dashed border-line px-4 py-2 text-left text-ink hover:bg-wash focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              {tx(lang, `Not in the list: log “${q.trim()}” by name only (no numbers)`, `তালিকায় নেই: “${q.trim()}” শুধু নামে লিখুন (সংখ্যা ছাড়া)`)}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
