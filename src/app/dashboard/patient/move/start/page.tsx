"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Panel } from "@/components/dashboard/Panel";
import { Button } from "@/components/ui/Button";
import { CATEGORIES, EXERCISES, GOALS, recommendProgram, title, validateProgram } from "@/features/move/catalog.js";
import { PlanEditor } from "@/features/move/PlanEditor";
import { createLockout, exerciseAllowed, lockoutActive, PAIN_AREAS, SCREEN_QUESTIONS, screen } from "@/features/move/safety.js";
import { moveStore, useMove, type Answer, type Program } from "@/features/move/store";
import { BASE, Choice, tx, UrgentCard } from "@/features/move/ui";

type Answers = {
  category?: string;
  goal?: string;
  clarified?: boolean;
  level?: string;
  seatedOnly?: boolean;
  needSupport?: boolean;
  noChair?: boolean;
  minutes?: number;
  mode?: "camera" | "manual";
};

const LEVELS = [
  { id: "inactive", en: "Currently inactive", bn: "এখন সক্রিয় নই" },
  { id: "beginner", en: "Beginner", bn: "নতুন" },
  { id: "intermediate", en: "Intermediate", bn: "মাঝারি" },
  { id: "advanced", en: "Advanced", bn: "অভিজ্ঞ" },
];

/** Only long-term conditions are remembered; "right now" symptoms are never stored as an answer. */
function lasting(conditions: Record<string, Answer>) {
  const kept = { ...conditions };
  delete kept.emergency_now;
  return kept;
}

function Wizard() {
  const params = useSearchParams();
  const router = useRouter();
  const lang = useMove((s) => s.language);
  const clearance = useMove((s) => s.clearance);
  const lockout = useMove((s) => s.lockout);
  const remembered = useMove((s) => s.conditions);
  const rememberedPain = useMove((s) => s.painAreas);
  const clinicianPrograms = useMove((s) => s.clinicianPrograms);
  const preset = CATEGORIES.some((c) => c.id === params.get("category")) ? params.get("category")! : undefined;
  const [a, setA] = useState<Answers>({ category: preset });
  const [answered, setConditions] = useState<Record<string, Answer>>({});
  const conditions: Record<string, Answer> = { ...remembered, ...answered };
  // Remembered values load after hydration; local state only overrides them once the person changes them.
  const [painChoice, setPainChoice] = useState<string[] | null>(null);
  const painAreas = painChoice ?? rememberedPain;
  const setPainAreas = (f: (x: string[]) => string[]) => setPainChoice(f(painAreas));
  const [rememberChoice, setRemember] = useState<boolean | null>(null);
  const remember = rememberChoice ?? Object.keys(remembered).length > 0;
  // A category chosen on Explore skips straight to the goal question.
  const [index, setIndex] = useState(preset ? 1 : 0);
  const [draft, setDraft] = useState<Program | null>(null);
  const [error, setError] = useState("");

  // "Right now" symptoms are always asked fresh; remembered answers cover only longer-term conditions.
  const questions = SCREEN_QUESTIONS.filter((q: { id: string }) => q.id === "emergency_now" || !(q.id in remembered));
  const category = CATEGORIES.find((c) => c.id === a.category);
  const goal = GOALS[a.category as keyof typeof GOALS]?.find((g) => g.id === a.goal) as { id: string; label: string; clarify?: string } | undefined;
  const screening = screen(conditions, { painAreas, clearance, lockout });
  const special = a.category === "rehab" || a.category === "heart";

  const steps: string[] = ["category"];
  if (a.category && !special) steps.push("goal", "level", "access", "equipment", "time", ...questions.map((q: { id: string }) => `q:${q.id}`));
  if (!special && (conditions.pain === "yes" || conditions.pain === "unsure")) steps.splice(steps.indexOf("q:pain") + 1 || steps.length, 0, "pain_area");
  if (a.category && !special) steps.push("camera", "plan");
  if (special) steps.push("special");
  const step = steps[Math.min(index, steps.length - 1)];
  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));
  const set = (patch: Answers) => setA((x) => ({ ...x, ...patch }));

  function answer(id: string, value: Answer) {
    setConditions((x) => ({ ...x, [id]: value }));
    if (id === "emergency_now" && value !== "no") {
      // Lock immediately; going back and answering "no" can't restart a workout.
      moveStore.set({ lockout: createLockout("emergency", [value === "unsure" ? "Unsure warning symptoms" : "Warning symptoms reported before exercise"], Date.now()) });
      setIndex(steps.length + 100);
      return;
    }
    next();
  }

  function buildPlan() {
    const program = recommendProgram({ category: a.category, goal: a.goal, level: screening.heartConscious ? "beginner" : a.level, seatedOnly: a.seatedOnly, noChair: a.noChair, minutes: a.minutes, language: lang });
    if (!program) return;
    program.sequence = program.sequence.filter((s: { exerciseId: string }) => exerciseAllowed(EXERCISES[s.exerciseId], screening).allowed);
    setDraft(program as Program);
  }

  function save(start: boolean) {
    if (!draft) return;
    try {
      validateProgram({ ...draft, authoredBy: "user" });
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    moveStore.set((s) => ({
      plan: { ...draft, authoredBy: "user" },
      cameraConsent: a.mode === "camera",
      rememberConditions: remember,
      conditions: remember ? lasting(conditions) : {},
      painAreas: remember ? painAreas : [],
      recentScreen: { answers: conditions, painAreas, at: Date.now() },
      consentAudit: [...s.consentAudit, { at: new Date().toISOString(), event: a.mode === "camera" ? "camera_on_device_granted" : "manual_mode_chosen" }],
    }));
    router.push(start ? `${BASE}/session` : `${BASE}/plan`);
  }

  // The layout already shows the urgent guidance while a lockout runs; nothing here can start a workout.
  if (lockoutActive(lockout, Date.now())) return <p className="text-muted">{tx(lang, "Move is paused for your safety.", "নিরাপত্তার জন্য মুভ বন্ধ আছে।")}</p>;
  if (screening.status === "emergency_stop") return <UrgentCard reasons={screening.reasons} />;

  const card = (heading: string, body: React.ReactNode, help?: string) => (
    <Panel className="mx-auto max-w-2xl" title={<span className="text-lg">{heading}</span>} description={help}>
      <div aria-live="polite">{body}</div>
      <div className="mt-6 flex justify-between">
        {index > 0 ? (
          <Button variant="ghost" onClick={back}>
            {tx(lang, "Back", "পেছনে")}
          </Button>
        ) : (
          <span />
        )}
        <p className="text-sm text-muted">
          {Math.min(index, steps.length - 1) + 1} / {steps.length}
        </p>
      </div>
    </Panel>
  );

  if (step === "category")
    return card(
      tx(lang, "What do you want to work on?", "কী নিয়ে কাজ করতে চান?"),
      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <Choice key={c.id} selected={a.category === c.id} onClick={() => (set({ category: c.id, goal: undefined }), next())}>
            <span className="block font-medium text-ink">{lang === "bn" ? c.titleBn : c.title}</span>
            <span className="block text-sm text-muted">{c.blurb}</span>
          </Choice>
        ))}
      </div>,
    );

  if (step === "special")
    return card(
      a.category === "rehab" ? tx(lang, "Recovery plans come from your clinician", "রিকভারি প্ল্যান চিকিৎসক দেন") : tx(lang, "Heart-conscious movement", "হৃদয়-সচেতন চলাচল"),
      <div className="space-y-3 text-ink">
        {a.category === "heart" ? (
          <>
            <p>Many people with heart conditions can exercise, and regular activity is often part of their care. The right type and amount depends on your condition, so it should come from your clinician.</p>
            <p>ASHA won't build a heart exercise routine by itself. You can record your clinician's clearance and then choose a gentle beginner plan, or follow a plan your clinician assigns.</p>
            <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger-text">Chest pain or pressure, fainting, unusual breathlessness or a racing heartbeat that doesn't settle mean stop and get urgent help (call 999).</p>
          </>
        ) : (
          <p>Medical rehabilitation needs a clinician's assessment. General fitness plans aren't used as recovery prescriptions. If your clinician uses ASHA Clinic, their plan appears under Clinician programs once you've shared Move with them.</p>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={`${BASE}/clinician`} className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-on-brand">
            {clinicianPrograms.length ? "Open my clinician plans" : "Clinician programs"}
          </Link>
          {a.category === "heart" && (
            <Link href={`${BASE}/safety#clearance`} className="inline-flex h-11 items-center rounded-full bg-brand-soft px-5 font-medium text-brand">
              Record clearance
            </Link>
          )}
        </div>
      </div>,
    );

  if (step === "goal")
    return card(
      tx(lang, "What best describes your goal?", "আপনার লক্ষ্য কোনটি?"),
      <div className="space-y-3">
        <div className="grid gap-3">
          {(GOALS[a.category as keyof typeof GOALS] ?? []).map((g: { id: string; label: string; clarify?: string }) => (
            <Choice key={g.id} selected={a.goal === g.id} onClick={() => (set({ goal: g.id, clarified: !g.clarify }), g.clarify ? undefined : next())}>
              <span className="font-medium text-ink">{g.label}</span>
            </Choice>
          ))}
        </div>
        {goal?.clarify && (
          <div className="rounded-2xl bg-warn-soft p-4 text-warn-text ring-1 ring-warn-line" role="note">
            <p className="font-medium">An honest note</p>
            <p className="mt-1 text-sm">{goal.clarify}</p>
            <Button className="mt-3" size="sm" onClick={() => (set({ clarified: true }), next())}>
              {a.category === "face" ? "Continue with expression practice" : "Continue with a whole-body plan"}
            </Button>
          </div>
        )}
      </div>,
      category?.safety,
    );

  if (step === "level")
    return card(
      tx(lang, "How active are you now?", "এখন আপনি কতটা সক্রিয়?"),
      <div className="grid gap-3 sm:grid-cols-2">
        {LEVELS.map((l) => (
          <Choice key={l.id} selected={a.level === l.id} onClick={() => (set({ level: l.id }), next())}>
            <span className="font-medium text-ink">{tx(lang, l.en, l.bn)}</span>
          </Choice>
        ))}
      </div>,
    );

  if (step === "access")
    return card(
      tx(lang, "Any movement needs?", "চলাচলে কোনো প্রয়োজন?"),
      <div className="grid gap-3">
        <Choice selected={a.seatedOnly === false && !a.needSupport} onClick={() => (set({ seatedOnly: false, needSupport: false }), next())}>
          <span className="font-medium text-ink">I can stand and move freely</span>
        </Choice>
        <Choice selected={a.needSupport} onClick={() => (set({ seatedOnly: false, needSupport: true }), next())}>
          <span className="font-medium text-ink">I can stand, but I need support nearby</span>
        </Choice>
        <Choice selected={a.seatedOnly} onClick={() => (set({ seatedOnly: true, needSupport: true }), next())}>
          <span className="font-medium text-ink">Seated exercises only</span>
        </Choice>
      </div>,
    );

  if (step === "equipment")
    return card(
      tx(lang, "Do you have a stable chair?", "স্থির চেয়ার আছে?"),
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice selected={a.noChair === false} onClick={() => (set({ noChair: false }), next())}>
          <span className="font-medium text-ink">Yes, a stable chair without wheels</span>
        </Choice>
        <Choice selected={a.noChair === true} onClick={() => (set({ noChair: true }), next())}>
          <span className="font-medium text-ink">No chair</span>
        </Choice>
      </div>,
      "A wall or sturdy table also helps for push-ups and balance.",
    );

  if (step === "time")
    return card(
      tx(lang, "How much time do you have?", "কতটা সময় আছে?"),
      <div className="grid grid-cols-3 gap-3">
        {[5, 10, 15].map((m) => (
          <Choice key={m} selected={a.minutes === m} onClick={() => (set({ minutes: m }), next())} className="text-center">
            <span className="text-lg font-semibold text-ink">{m} min</span>
          </Choice>
        ))}
      </div>,
    );

  if (step.startsWith("q:")) {
    const q = SCREEN_QUESTIONS.find((x: { id: string }) => `q:${x.id}` === step)!;
    return card(
      tx(lang, "Safety check", "নিরাপত্তা যাচাই"),
      <div>
        <p className="text-lg text-ink">{lang === "bn" ? q.bn : q.en}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {(["no", "yes", "unsure"] as Answer[]).map((v) => (
            <Choice key={v} selected={conditions[q.id] === v} onClick={() => answer(q.id, v)} className="text-center">
              <span className="font-medium text-ink">{v === "no" ? tx(lang, "No", "না") : v === "yes" ? tx(lang, "Yes", "হ্যাঁ") : tx(lang, "Not sure", "নিশ্চিত নই")}</span>
            </Choice>
          ))}
        </div>
      </div>,
      "We ask so we can leave out what isn't right for you today. ASHA doesn't diagnose, and these answers stay on this device.",
    );
  }

  if (step === "pain_area")
    return card(
      tx(lang, "Where is the pain?", "কোথায় ব্যথা?"),
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {PAIN_AREAS.map((p: { id: string; en: string; bn: string }) => (
            <Choice key={p.id} selected={painAreas.includes(p.id)} onClick={() => setPainAreas((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))}>
              <span className="font-medium text-ink">{tx(lang, p.en, p.bn)}</span>
            </Choice>
          ))}
        </div>
        <p className="text-sm text-muted">Movements that load these areas are left out. If pain is severe, new after an injury, or your jaw clicks painfully or locks, please see a clinician.</p>
        <Button onClick={next} disabled={!painAreas.length}>
          {tx(lang, "Continue", "চালিয়ে যান")}
        </Button>
      </div>,
    );

  if (step === "camera")
    return card(
      tx(lang, "Camera or manual?", "ক্যামেরা নাকি নিজে গোনা?"),
      <div className="grid gap-3">
        <Choice selected={a.mode === "camera"} onClick={() => (set({ mode: "camera" }), buildPlan(), next())}>
          <span className="block font-medium text-ink">Use my camera to count</span>
          <span className="block text-sm text-muted">Video is processed on this device and is never uploaded or saved. Only your counts are kept, here on this device.</span>
        </Choice>
        <Choice selected={a.mode === "manual"} onClick={() => (set({ mode: "manual" }), buildPlan(), next())}>
          <span className="block font-medium text-ink">Manual: I'll tap to count</span>
          <span className="block text-sm text-muted">No camera. Works offline. Timers and guidance still run.</span>
        </Choice>
      </div>,
    );

  // step === "plan"
  if (screening.status === "review_required")
    return card(
      tx(lang, "Let's check with your clinician first", "আগে চিকিৎসকের সঙ্গে কথা বলুন"),
      <div className="space-y-3 text-ink">
        <ul className="list-disc space-y-1 pl-5">
          {screening.reasons.map((r: string) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p>You can record that a clinician has cleared you for general activity, or follow a plan they assign. ASHA can't give medical clearance itself.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`${BASE}/safety#clearance`} className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-on-brand">
            Record clearance
          </Link>
          <Link href={`${BASE}/clinician`} className="inline-flex h-11 items-center rounded-full bg-brand-soft px-5 font-medium text-brand">
            Clinician programs
          </Link>
        </div>
      </div>,
    );
  if (!draft) return card("No plan", <p className="text-muted">Everything in this category was left out by today's safety check. Try another category.</p>);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel title={<span className="text-lg">{tx(lang, "Your recommended starter plan", "আপনার প্রস্তাবিত শুরুর প্ল্যান")}</span>} description={draft.why}>
        <p className="text-sm text-muted">
          {category?.title}
          {goal ? ` · ${goal.label}` : ""} · {a.mode === "camera" ? "Camera counting" : "Manual counting"}
          {screening.heartConscious ? " · Heart-conscious: longer warm-up and cool-down" : ""}
          {a.needSupport ? " · Keep support nearby" : ""}
        </p>
        <div className="mt-4">
          <PlanEditor program={draft} onChange={setDraft} screening={screening} />
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" className="mt-1 size-4" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Remember my safety answers on this device so I'm not asked every time. (“Right now” symptoms are always asked.)</span>
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger-text">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => save(true)}>{tx(lang, "Save and start", "সেভ করে শুরু")}</Button>
          <Button variant="secondary" onClick={() => save(false)}>
            {tx(lang, "Save as my plan", "প্ল্যান হিসেবে সেভ")}
          </Button>
          <Button variant="ghost" onClick={back}>
            {tx(lang, "Back", "পেছনে")}
          </Button>
        </div>
      </Panel>
      <p className="text-center text-xs text-muted">
        {draft.sequence.map((s) => title(EXERCISES[s.exerciseId], lang)).join(" → ")}
      </p>
    </div>
  );
}

export default function MoveStart() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
