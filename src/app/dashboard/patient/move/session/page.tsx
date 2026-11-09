"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Meter } from "@/components/dashboard/Meter";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EXERCISES, steps as stepText, title } from "@/features/move/catalog.js";
import { createDetector, detectorKind, faceFrame, isTracked } from "@/features/move/detectors.js";
import { lockoutActive, PAIN_AREAS, SCREEN_QUESTIONS, screen, SESSION_SYMPTOMS } from "@/features/move/safety.js";
import { WorkoutSession } from "@/features/move/session.js";
import { moveStore, useMove, type Answer, type Summary } from "@/features/move/store";
import { BASE, Choice, tx, UrgentCard } from "@/features/move/ui";
import { CameraView } from "@/features/perception/CameraView";
import { useActiveModule, usePerception, usePerceptionEvent } from "@/features/perception/PerceptionProvider";
import type { FrameSnapshot } from "@/lib/engine/types";
import { speak } from "@/features/speech/speak";
import { cn } from "@/lib/cn";

type Detector = { update(frame: unknown): DetectorResult; quality(): number };
type DetectorResult = { valid: boolean; reason: string; phase: string; progress: number; counted: boolean; confidence: number; t: number; event?: string | null };
type PoseFrame = { landmarks: unknown[] | null; personCount: number; timestamp: number; width: number; height: number };

const ACTIVE = new Set(["CAMERA_SETUP", "WARM_UP", "EXERCISE", "REST", "NEXT_EXERCISE", "COOL_DOWN", "TRACKING_LOST", "PAUSED"]);
const VIEW: Record<string, string> = {
  side: "Place the camera side-on, about hip height, 2–3 metres away, so your whole body is visible.",
  front: "Place the camera in front of you at chest height, with your head, shoulders and hips visible.",
  three_quarter: "Place the camera at an angle in front of you with your whole body visible.",
};
const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function LiveSession() {
  useActiveModule("move");
  const lang = useMove((s) => s.language);
  const plan = useMove((s) => s.plan);
  const voice = useMove((s) => s.voice);
  const cameraConsent = useMove((s) => s.cameraConsent);
  const conditions = useMove((s) => s.conditions);
  const painAreas = useMove((s) => s.painAreas);
  const clearance = useMove((s) => s.clearance);
  const lockout = useMove((s) => s.lockout);
  const saved = useMove((s) => s.activeSession);
  const recent = useMove((s) => s.recentScreen);
  const { state: camera, start: startCamera, setExercising, setModule } = usePerception();
  // Fast pose tracking is only for this page; hand the camera back to the companion when leaving.
  useEffect(() => () => setModule("companion"), [setModule]);

  const session = useRef<WorkoutSession | null>(null);
  const detector = useRef<{ key: string; value: Detector | null }>({ key: "", value: null });
  const lastResult = useRef<DetectorResult | null>(null);
  const [, render] = useState(0);
  const [live, setLive] = useState("");
  // Answers from the goal wizard a few minutes ago are pre-filled; the person can still change them.
  const fresh = recent && Date.now() - recent.at < 15 * 60 * 1000 ? recent : null;
  // Saved preferences arrive after hydration, so local choices only override them once the person acts.
  const [picked, setPrecheck] = useState<Record<string, Answer>>({});
  const precheck: Record<string, Answer> = { ...(fresh?.answers ?? {}), ...picked };
  const [modeChoice, setMode] = useState<"camera" | "manual" | null>(null);
  const mode = modeChoice ?? (cameraConsent ? "camera" : "manual");
  const [painChoice, setPainChoice] = useState<string[] | null>(null);
  const pain = painChoice ?? (fresh?.painAreas.length ? fresh.painAreas : painAreas);
  const setPain = (f: (x: string[]) => string[]) => setPainChoice(f(pain));
  const [unwell, setUnwell] = useState(false);
  const [symptomText, setSymptomText] = useState("");
  const [effort, setEffort] = useState<number | null>(null);
  const [felt, setFelt] = useState("");
  const lastSaved = useRef(0);
  const feedClock = useRef({ key: "", at: 0 });
  const recordedFor = useRef<string | null>(null);
  const [rated, setRated] = useState(false);
  const s = session.current;

  // What the remembered answers don't cover is asked here, before every workout.
  const ask = useMemo(() => SCREEN_QUESTIONS.filter((q: { id: string }) => q.id === "emergency_now" || !(q.id in conditions)), [conditions]);

  const persist = useCallback((force = false) => {
    const cur = session.current;
    if (!cur) return;
    const now = performance.now();
    if (!force && now - lastSaved.current < 2000) return;
    lastSaved.current = now;
    moveStore.set({ activeSession: ACTIVE.has(cur.state) ? cur.serialize() : null });
    // Whatever was done is kept as soon as the workout ends, even if the page is closed before rating it.
    const ended = ["SUMMARY", "CANCELLED", "SAFETY_STOP", "COMPLETED"].includes(cur.state);
    if (ended && cur.startedAt && recordedFor.current !== cur.startedAt + cur.state) {
      recordedFor.current = cur.startedAt + cur.state;
      const summary = cur.summary() as Summary;
      moveStore.set((st) => {
        const prior = st.history.find((h) => h.startedAt === summary.startedAt);
        return { history: [...st.history.filter((h) => h.startedAt !== summary.startedAt), { ...summary, effort: prior?.effort ?? null, feltAfter: prior?.feltAfter }] };
      });
    }
  }, []);

  const announce = useCallback(() => {
    const cur = session.current;
    if (!cur) return;
    const items = cur.drain();
    if (!items.length) return;
    const text = items.map((a: { text: string }) => a.text).join(" ");
    setLive(text);
    if (voice) speak(text);
  }, [voice]);

  // Resume a workout that was interrupted by a reload or navigation. It comes back paused.
  useEffect(() => {
    if (session.current || !saved) return;
    try {
      session.current = WorkoutSession.restore(saved, { wallClock: Date.now, tracked: isTracked });
      render((v) => v + 1);
    } catch {
      moveStore.set({ activeSession: null });
    }
  }, [saved]);

  // The workout clock. Monotonic, and it only advances while the page is visible.
  useEffect(() => {
    const id = setInterval(() => {
      const cur = session.current;
      if (!cur) return;
      const before = `${cur.state}|${cur.index}|${cur.set}|${cur.reps}`;
      const now = performance.now();
      cur.tick(now);
      // No frames at all (camera off, model missing, tab throttled) is the same as not seeing the person.
      if (cur.cameraCounting && cur.state === "EXERCISE") {
        const key = `${cur.detectorEpoch}:${cur.exercise.id}`;
        if (feedClock.current.key !== key) feedClock.current = { key, at: now };
        else if (now - feedClock.current.at > 1500) cur.observe({ valid: false, t: now, reason: "No camera frames" });
      }
      announce();
      const after = `${cur.state}|${cur.index}|${cur.set}|${cur.reps}`;
      persist(before !== after);
      render((v) => v + 1);
    }, 250);
    const hidden = () => {
      if (document.hidden && session.current && session.current.state !== "PAUSED") {
        session.current.pause();
        persist(true);
        render((v) => v + 1);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [announce, persist]);

  // While a workout runs, exercise movements must not be read as AAC requests.
  const exercisingNow = !!s && ["CAMERA_SETUP", "WARM_UP", "EXERCISE", "REST", "NEXT_EXERCISE", "COOL_DOWN", "TRACKING_LOST"].includes(s.state);
  useEffect(() => {
    setExercising(exercisingNow);
  }, [exercisingNow, setExercising]);
  useEffect(() => () => setExercising(false), [setExercising]);

  // Which exercise the camera should be looking for right now.
  const watching = useMemo(() => {
    if (!s || s.mode !== "camera") return null;
    if (s.state === "CAMERA_SETUP") return s.results.find((r: { skipped: boolean; exerciseId: string }) => !r.skipped && isTracked(r.exerciseId))?.exerciseId ?? null;
    if ((s.state === "EXERCISE" || s.state === "TRACKING_LOST") && s.cameraCounting) return s.exercise.id;
    return null;
  }, [s, s?.state, s?.index, s?.mode, s?.detectorEpoch]);
  const kind = watching ? detectorKind(watching) : null;

  const feed = useCallback((frame: unknown) => {
    const cur = session.current;
    if (!cur || !watching) return;
    const key = `${cur.detectorEpoch}:${watching}`;
    if (detector.current.key !== key) {
      const step = cur.state === "CAMERA_SETUP" ? cur.program.sequence.find((x: { exerciseId: string }) => x.exerciseId === watching) : cur.step;
      try {
        detector.current = {
          key,
          value: createDetector(watching, {
            limits: step?.limits ?? null,
            side: step?.side ?? null,
            holdMs: detectorKind(watching) === "face" ? (step?.holdSeconds ?? 2) * 1000 : (step?.holdMs ?? 150),
          }) as Detector,
        };
      } catch {
        detector.current = { key, value: null };
        cur.useManual();
        return;
      }
    }
    const result = detector.current.value?.update(frame);
    if (!result) return;
    feedClock.current = { key, at: performance.now() };
    lastResult.current = result;
    cur.observe(result);
    if (result.counted) announce();
  }, [watching, announce]);

  usePerceptionEvent<PoseFrame>("pose", (f) => feed(f), kind === "pose");
  usePerceptionEvent<FrameSnapshot>("frame", (f) => feed(faceFrame(f)), kind === "face");

  function begin() {
    if (!plan) return;
    const screening = screen({ ...conditions, ...precheck }, { painAreas: pain, clearance, lockout });
    const cur = new WorkoutSession({ program: plan, mode, screening, language: lang, wallClock: Date.now, tracked: isTracked });
    session.current = cur;
    cur.begin(performance.now());
    if (cur.lockout) moveStore.set({ lockout: cur.lockout });
    moveStore.set({ recentScreen: null });
    if (mode === "camera" && camera !== "on") void startCamera();
    moveStore.set((st) => ({ consentAudit: [...st.consentAudit, { at: new Date().toISOString(), event: mode === "camera" ? "session_camera_on_device" : "session_manual" }] }));
    announce();
    persist(true);
    render((v) => v + 1);
  }

  function report(input: string) {
    const cur = session.current;
    if (!cur) return;
    cur.reportSymptom(input);
    if (cur.lockout) moveStore.set({ lockout: cur.lockout });
    setUnwell(false);
    setSymptomText("");
    announce();
    persist(true);
    render((v) => v + 1);
  }

  function record(cur: WorkoutSession, extra: Partial<Summary> = {}) {
    const summary = { ...(cur.summary() as Summary), ...extra };
    moveStore.set((st) => ({ history: [...st.history.filter((h) => h.startedAt !== summary.startedAt), summary] }));
  }

  function act(fn: (cur: WorkoutSession) => void) {
    const cur = session.current;
    if (!cur) return;
    fn(cur);
    announce();
    persist(true);
    render((v) => v + 1);
  }

  if (!plan && !s)
    return (
      <EmptyState title={tx(lang, "No plan yet", "এখনো প্ল্যান নেই")} action={<ButtonLink href={`${BASE}/start`}>{tx(lang, "Build a plan", "প্ল্যান তৈরি")}</ButtonLink>}>
        Choose a goal and ASHA suggests a starter routine you can change.
      </EmptyState>
    );

  // ---------- Before starting ----------
  if (!s) {
    if (lockoutActive(lockout, Date.now())) return <p className="text-muted">{tx(lang, "Workouts are paused for your safety.", "নিরাপত্তার জন্য ব্যায়াম বন্ধ।")}</p>;
    const answered = ask.every((q: { id: string }) => precheck[q.id]) && (!(precheck.pain === "yes" || precheck.pain === "unsure") || pain.length > 0 || "pain" in conditions);
    return (
      <>
        <PageHeader title={plan!.name} description={tx(lang, "Before you start: a quick safety check.", "শুরুর আগে: দ্রুত নিরাপত্তা যাচাই।")} />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Panel title={tx(lang, "Safety check", "নিরাপত্তা যাচাই")} description="ASHA doesn't diagnose. These answers decide what is safe to offer today.">
            <ol className="space-y-5">
              {ask.map((q: { id: string; en: string; bn: string }) => (
                <li key={q.id}>
                  <p className="text-ink">{lang === "bn" ? q.bn : q.en}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={q.en}>
                    {(["no", "yes", "unsure"] as Answer[]).map((v) => (
                      <Choice key={v} selected={precheck[q.id] === v} onClick={() => setPrecheck((p) => ({ ...p, [q.id]: v }))} className="p-3 text-center">
                        <span className="font-medium text-ink">{v === "no" ? tx(lang, "No", "না") : v === "yes" ? tx(lang, "Yes", "হ্যাঁ") : tx(lang, "Not sure", "নিশ্চিত নই")}</span>
                      </Choice>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            {(precheck.pain === "yes" || precheck.pain === "unsure") && (
              <div className="mt-5">
                <p className="text-ink">{tx(lang, "Where is the pain?", "কোথায় ব্যথা?")}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {PAIN_AREAS.map((p: { id: string; en: string; bn: string }) => (
                    <Choice key={p.id} selected={pain.includes(p.id)} onClick={() => setPain((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))} className="p-3">
                      <span className="text-ink">{tx(lang, p.en, p.bn)}</span>
                    </Choice>
                  ))}
                </div>
              </div>
            )}
          </Panel>
          <Panel title={tx(lang, "How should ASHA count?", "কীভাবে গুনবে?")}>
            <div className="grid gap-3">
              <Choice selected={mode === "camera"} onClick={() => setMode("camera")}>
                <span className="block font-medium text-ink">Camera counts tracked exercises</span>
                <span className="block text-sm text-muted">On-device only. Video is never uploaded or saved. You can switch to manual at any time.</span>
              </Choice>
              <Choice selected={mode === "manual"} onClick={() => setMode("manual")}>
                <span className="block font-medium text-ink">Manual: I tap to count</span>
                <span className="block text-sm text-muted">No camera needed. Works offline.</span>
              </Choice>
            </div>
            <Button className="mt-5 w-full" disabled={!answered} onClick={begin}>
              {tx(lang, "Start workout", "ব্যায়াম শুরু")}
            </Button>
            {!answered && <p className="mt-2 text-center text-xs text-muted">Answer each question to continue.</p>}
          </Panel>
        </div>
      </>
    );
  }

  // ---------- Blocked by the safety check ----------
  if (s.state === "PRECHECK")
    return (
      <Panel className="mx-auto max-w-2xl" title={tx(lang, "Not today, or not without your clinician", "আজ নয়, বা চিকিৎসক ছাড়া নয়")}>
        <p className="text-ink">{s.blockReason}</p>
        <p className="mt-2 text-sm text-muted">ASHA can't give medical clearance. You can record a clinician's clearance, follow a plan they assign, or choose a different plan.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`${BASE}/safety#clearance`}>Record clearance</ButtonLink>
          <ButtonLink href={`${BASE}/clinician`} variant="secondary">
            Clinician programs
          </ButtonLink>
          <Button
            variant="ghost"
            onClick={() => {
              session.current = null;
              moveStore.set({ activeSession: null });
              render((v) => v + 1);
            }}
          >
            {tx(lang, "Back", "পেছনে")}
          </Button>
        </div>
      </Panel>
    );

  // ---------- Stopped for safety ----------
  if (s.state === "SAFETY_STOP")
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {!lockoutActive(lockout, Date.now()) && <UrgentCard reasons={s.safety?.reasons ?? []} kind={s.safety?.action === "stop_rest" ? "rest" : "emergency"} />}
        <p className="text-sm text-muted">This workout has ended. What you completed was saved to Progress.</p>
        <ButtonLink href={`${BASE}/progress`} variant="secondary">
          View progress
        </ButtonLink>
      </div>
    );

  // ---------- Summary ----------
  if (s.state === "SUMMARY" || s.state === "CANCELLED" || s.state === "COMPLETED") {
    const sum = s.summary() as Summary;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={s.state === "CANCELLED" ? tx(lang, "Workout stopped", "ব্যায়াম থামানো হয়েছে") : tx(lang, "Workout complete", "ব্যায়াম শেষ")} description={`${sum.programName} · ${sum.activeMinutes} active minutes · ${sum.setsDone} of ${sum.setsPlanned} sets`} />
        <Panel title="What you did">
          <ul className="divide-y divide-line">
            {sum.exercises.map((e) => (
              <li key={e.exerciseId} className="flex flex-wrap justify-between gap-2 py-3">
                <span className="font-medium text-ink">{title(EXERCISES[e.exerciseId], lang)}</span>
                <span className="text-sm text-muted">
                  {e.excludedBySafetyCheck ? "Left out by today's safety check" : e.skipped ? e.skipReason || "Skipped" : `${e.setsDone}/${e.plannedSets} sets · ${e.seconds ? `${e.seconds}s held` : `${e.reps} reps`}${e.countedBy.length ? ` · counted by ${e.countedBy.join(" and ")}` : ""}${e.partials ? ` · ${e.partials} partial not counted` : ""}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">{sum.note}</p>
        </Panel>
        {!rated && s.state !== "COMPLETED" ? (
          <Panel title="How hard did that feel?" description="0 is resting, 10 is the hardest you can imagine. Most workouts should feel 3–5. Your workout is already saved; this adds how it felt.">
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-11" role="radiogroup" aria-label="Effort from 0 to 10">
              {Array.from({ length: 11 }, (_, i) => (
                <Choice key={i} selected={effort === i} onClick={() => setEffort(i)} className="p-2 text-center">
                  <span className="font-semibold text-ink">{i}</span>
                </Choice>
              ))}
            </div>
            <p className="mt-4 text-sm font-medium text-ink">How do you feel now?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Good", "Tired but fine", "Sore"].map((f) => (
                <Choice key={f} selected={felt === f} onClick={() => setFelt(f)} className="p-3">
                  <span className="text-ink">{f}</span>
                </Choice>
              ))}
              <Choice selected={false} onClick={() => setUnwell(true)} className="p-3">
                <span className="text-red-700">Unwell</span>
              </Choice>
            </div>
            <Button
              className="mt-5"
              onClick={() => {
                record(s, { effort, feltAfter: felt });
                setRated(true);
                act((cur) => cur.finish());
              }}
            >
              Save how it felt
            </Button>
          </Panel>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`${BASE}/progress`}>View progress</ButtonLink>
            <Button
              variant="secondary"
              onClick={() => {
                session.current = null;
                setRated(false);
                setEffort(null);
                setFelt("");
                moveStore.set({ activeSession: null });
                render((v) => v + 1);
              }}
            >
              Back to start
            </Button>
          </div>
        )}
        {unwell && <SymptomPicker onPick={report} onClose={() => setUnwell(false)} text={symptomText} setText={setSymptomText} />}
      </div>
    );
  }

  // ---------- Live ----------
  const ex = s.exercise;
  const step = s.step;
  const r = lastResult.current;
  const paused = s.state === "PAUSED";
  const counting = s.state === "EXERCISE" && s.cameraCounting;
  const lost = s.state === "TRACKING_LOST" || (paused && s.resumeTo === "TRACKING_LOST");
  const setupId = watching && s.state === "CAMERA_SETUP" ? watching : null;
  const shown = setupId ? EXERCISES[setupId] : ex;
  const stage: Record<string, string> = {
    CAMERA_SETUP: tx(lang, "Camera setup", "ক্যামেরা সেটআপ"),
    WARM_UP: tx(lang, "Warm-up", "ওয়ার্ম-আপ"),
    EXERCISE: tx(lang, "Exercise", "ব্যায়াম"),
    TRACKING_LOST: tx(lang, "Can't see you", "দেখা যাচ্ছে না"),
    REST: tx(lang, "Rest", "বিশ্রাম"),
    NEXT_EXERCISE: tx(lang, "Up next", "এরপর"),
    COOL_DOWN: tx(lang, "Cool-down", "কুল-ডাউন"),
    PAUSED: tx(lang, "Paused", "বিরতি"),
  };
  const timed = !!s.holdTarget;

  return (
    <>
      <div aria-live="polite" className="sr-only" data-testid="move-live">
        {live}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {s.program.name} · {tx(lang, "exercise", "ব্যায়াম")} {s.index + 1} / {s.program.sequence.length}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink" data-testid="move-state" data-state={s.state}>
            {stage[s.state] ?? s.state}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {paused ? (
            <Button onClick={() => act((cur) => cur.resume(performance.now()))}>{tx(lang, "Resume", "আবার শুরু")}</Button>
          ) : (
            <Button variant="secondary" onClick={() => act((cur) => cur.pause())}>
              {tx(lang, "Pause", "বিরতি")}
            </Button>
          )}
          <Button variant="secondary" onClick={() => act((cur) => cur.skip())} disabled={!["EXERCISE", "TRACKING_LOST", "NEXT_EXERCISE"].includes(s.state)}>
            {tx(lang, "Skip", "বাদ দিন")}
          </Button>
          <Button variant="ghost" className="text-red-700" onClick={() => act((cur) => cur.stop())}>
            {tx(lang, "Stop", "থামুন")}
          </Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => setUnwell(true)}>
            {tx(lang, "I feel unwell", "অসুস্থ লাগছে")}
          </Button>
        </div>
      </div>

      {unwell && <SymptomPicker onPick={report} onClose={() => setUnwell(false)} text={symptomText} setText={setSymptomText} />}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          {s.mode === "camera" ? (
            <>
              <CameraView />
              <div className="flex flex-wrap items-center gap-2">
                {camera !== "on" ? (
                  <StatusPill tone="warn">Camera off: counting is paused</StatusPill>
                ) : lost ? (
                  <StatusPill tone="alert" pulse>
                    {tx(lang, "Can't see your movement; reposition camera.", "আপনার নড়াচড়া দেখা যাচ্ছে না; ক্যামেরা ঠিক করুন।")}
                  </StatusPill>
                ) : r && (counting || setupId) ? (
                  <StatusPill tone={r.valid ? (r.phase === "calibrating" ? "brand" : "good") : "warn"}>{r.reason}</StatusPill>
                ) : (
                  <StatusPill>{ex && !isTracked(ex.id) ? "This exercise is counted manually" : "Camera ready"}</StatusPill>
                )}
                <Button size="sm" variant="ghost" onClick={() => act((cur) => cur.useManual())}>
                  {tx(lang, "Switch to manual counting", "নিজে গুনব")}
                </Button>
              </div>
              {(counting || setupId) && r && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Meter label="Tracking confidence" value={r.valid ? r.confidence : 0} />
                  <Meter label="Movement toward target" value={r.valid ? r.progress : 0} />
                </div>
              )}
            </>
          ) : (
            <Panel title={tx(lang, "Manual mode", "ম্যানুয়াল মোড")} description="No camera. Tap once for each repetition you finish.">
              <p className="text-sm text-muted">Timers and guidance still run. Your counts are saved as manual.</p>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          {s.state === "CAMERA_SETUP" && shown && (
            <Panel title={tx(lang, "Set up your camera", "ক্যামেরা ঠিক করুন")} description={VIEW[shown.cameraView ?? "front"]}>
              <p className="text-sm text-ink">Counting starts only once ASHA has a clear view of you for a second.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={!s.framingOk || camera !== "on"} onClick={() => act((cur) => cur.confirmCamera())}>
                  {s.framingOk ? tx(lang, "I can be seen. Start", "দেখা যাচ্ছে। শুরু") : tx(lang, "Waiting for a clear view…", "পরিষ্কার দৃশ্যের অপেক্ষা…")}
                </Button>
                <Button variant="secondary" onClick={() => act((cur) => cur.useManual())}>
                  {tx(lang, "Use manual counting", "নিজে গুনব")}
                </Button>
              </div>
            </Panel>
          )}

          {(s.state === "WARM_UP" || s.state === "COOL_DOWN") && (
            <Panel title={s.state === "WARM_UP" ? tx(lang, "Warm up", "ওয়ার্ম-আপ") : tx(lang, "Cool down", "কুল-ডাউন")}>
              <p className="text-ink">{s.state === "WARM_UP" ? "March gently in place or seated, roll your shoulders and breathe normally." : "Walk or march slowly and let your breathing settle."}</p>
              {s.screening?.heartConscious && <p className="mt-2 text-sm text-muted">Heart-conscious: keep to a pace where you can talk comfortably.</p>}
              <p className="mt-4 text-4xl font-semibold tabular-nums text-ink" aria-label="Time left">
                {fmt(s.remainingMs)}
              </p>
              <Button className="mt-4" variant="secondary" onClick={() => act((cur) => cur.next())}>
                {s.state === "WARM_UP" ? tx(lang, "I'm warmed up", "ওয়ার্ম-আপ হয়েছে") : tx(lang, "Finish", "শেষ")}
              </Button>
            </Panel>
          )}

          {s.state === "REST" && (
            <Panel title={tx(lang, "Rest", "বিশ্রাম")}>
              <p className="text-5xl font-semibold tabular-nums text-ink" aria-label="Rest time left">
                {fmt(s.remainingMs)}
              </p>
              <p className="mt-2 text-sm text-muted">Breathe easily. Sip water if you need to.</p>
              <Button className="mt-4" variant="secondary" onClick={() => act((cur) => cur.next())}>
                {tx(lang, "Skip rest", "বিশ্রাম বাদ")}
              </Button>
            </Panel>
          )}

          {ex && ["EXERCISE", "TRACKING_LOST", "NEXT_EXERCISE", "PAUSED"].includes(s.state) && (
            <Panel
              title={title(ex, lang)}
              description={`${ex.area}${ex.cameraView && s.mode === "camera" && isTracked(ex.id) ? ` · camera ${ex.cameraView.replace("_", " ")}` : ""}`}
              action={step.clinicianLocked ? <StatusPill tone="brand">Clinician plan</StatusPill> : undefined}
            >
              <ol className="list-decimal space-y-1 pl-5 text-ink">
                {stepText(ex, lang).map((t: string) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
              {s.state === "NEXT_EXERCISE" ? (
                <div className="mt-4">
                  {s.mode === "camera" && isTracked(ex.id) && <p className="text-sm text-muted">{VIEW[ex.cameraView ?? "front"]}</p>}
                  <p className="mt-2 text-sm text-muted">Starting in {fmt(s.remainingMs)}</p>
                  <Button className="mt-3" onClick={() => act((cur) => cur.next())}>
                    {tx(lang, "Start now", "এখনই শুরু")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-brand-soft p-4">
                      <p className="text-sm text-muted">{tx(lang, "Set", "সেট")}</p>
                      <p className="text-3xl font-semibold tabular-nums text-ink">
                        {s.set} / {step.sets}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-brand-soft p-4">
                      <p className="text-sm text-muted">{timed ? tx(lang, "Hold", "ধরে রাখুন") : tx(lang, "Reps", "বার")}</p>
                      <p className="text-3xl font-semibold tabular-nums text-ink" data-testid="move-reps">
                        {timed ? `${Math.floor(s.holdMs / 1000)}s / ${Math.round(s.holdTarget / 1000)}s` : `${s.reps} / ${step.targetReps}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {timed ? (
                      <Button disabled={s.holdRunning || paused} onClick={() => act((cur) => cur.startHold())}>
                        {s.holdRunning ? tx(lang, "Holding…", "ধরে আছেন…") : tx(lang, "Start timer", "টাইমার শুরু")}
                      </Button>
                    ) : (
                      <Button size="md" className="min-w-32 text-lg" disabled={paused} onClick={() => act((cur) => cur.manualRep())}>
                        {s.cameraCounting ? tx(lang, "+1 (camera missed one)", "+১ (ক্যামেরা মিস করেছে)") : tx(lang, "+1 rep", "+১ বার")}
                      </Button>
                    )}
                    <Button variant="secondary" disabled={paused} onClick={() => act((cur) => cur.finishSet())}>
                      {tx(lang, "Done with this set", "এই সেট শেষ")}
                    </Button>
                  </div>
                  <details className="mt-4 text-sm">
                    <summary className="cursor-pointer font-medium text-ink">Stop signs and limits</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                      {ex.stopCues.map((c: string) => (
                        <li key={c}>{c}</li>
                      ))}
                      <li>{ex.limitation}</li>
                    </ul>
                  </details>
                  {ex.alternatives.length > 0 && <p className="mt-2 text-xs text-muted">Easier alternatives: {ex.alternatives.map((id: string) => title(EXERCISES[id], lang)).join(", ")}. Change them in My plan.</p>}
                </>
              )}
            </Panel>
          )}
          <Link href={`${BASE}/plan`} className={cn("block text-center text-sm text-muted underline")}>
            {tx(lang, "Leave this page (the workout pauses)", "পাতা ছাড়ুন (ব্যায়াম থামবে)")}
          </Link>
        </div>
      </div>
    </>
  );
}

function SymptomPicker({ onPick, onClose, text, setText }: { onPick: (v: string) => void; onClose: () => void; text: string; setText: (v: string) => void }) {
  const lang = useMove((s) => s.language);
  return (
    <Panel className="mb-6 ring-2 ring-red-300" title={tx(lang, "What are you feeling?", "কেমন লাগছে?")} description="Choose one. ASHA's safety rules decide what happens next.">
      <div className="grid gap-2 sm:grid-cols-2">
        {SESSION_SYMPTOMS.map((x: { id: string; en: string; bn: string; action: string }) => (
          <button
            key={x.id}
            type="button"
            onClick={() => onPick(x.id)}
            className={cn("min-h-12 rounded-2xl p-3 text-left font-medium ring-1", x.action === "emergency" ? "bg-red-50 text-red-900 ring-red-200 hover:bg-red-100" : "bg-white text-ink ring-line hover:bg-wash")}
          >
            {tx(lang, x.en, x.bn)}
          </button>
        ))}
      </div>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onPick(text);
        }}
      >
        <label className="sr-only" htmlFor="symptom-text">
          Describe it
        </label>
        <input id="symptom-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={tx(lang, "Or describe it (English or Bangla)", "অথবা লিখুন (বাংলা বা ইংরেজি)")} className="h-11 min-w-0 flex-1 rounded-xl px-3 ring-1 ring-line" />
        <Button type="submit" variant="secondary">
          {tx(lang, "Check", "যাচাই")}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {tx(lang, "Close", "বন্ধ")}
        </Button>
      </form>
    </Panel>
  );
}
