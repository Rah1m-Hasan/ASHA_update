"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { speak } from "@/features/speech/speak";
import { cn } from "@/lib/cn";
import { demoAt, demoShapes, keyPoses, loopMs } from "./demo.js";
import { lessonFor } from "./lessons.js";
import type { Lang } from "./store";
import { tx } from "./ui";

const TONE: Record<string, string> = {
  body: "var(--color-heading)",
  far: "#94a3b8",
  joint: "var(--color-brand)",
  prop: "#b6c2d1",
  accent: "#0f766e",
  accentSoft: "#ccfbf1",
  skin: "#fde7d6",
  mouth: "#7f1d1d",
};

type Shape = { t: string; tone?: string; fill?: string; w?: number; [k: string]: unknown };

/** One frame of an original ASHA demonstration, drawn as SVG. */
export function DemoSvg({ shapes, label, className }: { shapes: Shape[]; label: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={label} className={cn("block size-full", className)}>
      {shapes.map((s, i) => {
        const common = { stroke: s.tone ? TONE[s.tone] : "none", strokeWidth: s.w ?? 0, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: s.fill ? TONE[s.fill] : "none" };
        if (s.t === "line") return <line key={i} x1={s.x1 as number} y1={s.y1 as number} x2={s.x2 as number} y2={s.y2 as number} {...common} />;
        if (s.t === "circle") return <circle key={i} cx={s.cx as number} cy={s.cy as number} r={s.r as number} {...common} />;
        if (s.t === "ellipse") return <ellipse key={i} cx={s.cx as number} cy={s.cy as number} rx={s.rx as number} ry={s.ry as number} {...common} />;
        return <path key={i} d={s.d as string} {...common} />;
      })}
    </svg>
  );
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/**
 * Looping demonstration with captions that follow the movement. Motion plays unless the person
 * prefers reduced motion (then key poses are shown still). Narration never starts by itself:
 * it begins only after the person taps "Play voice".
 */
export function DemoPlayer({ exerciseId, lang, className, compact = false }: { exerciseId: string; lang: Lang; className?: string; compact?: boolean }) {
  const lesson = lessonFor(exerciseId);
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState<boolean | null>(null);
  const isPlaying = playing ?? !reduced;
  const [t, setT] = useState(0);
  const [narrate, setNarrate] = useState(false);
  // Bumped by "Show me again" so a running loop restarts from the first frame.
  const [epoch, setEpoch] = useState(0);
  const started = useRef<number | null>(null);
  const spoken = useRef<number | null>(null);
  const frame = demoAt(exerciseId, t);
  const captions = lesson.captions[lang] ?? lesson.captions.en;
  const caption = captions[frame.cap];

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const base = performance.now() - t;
    started.current = base;
    const step = (now: number) => {
      setT(now - base);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // t is read once when playback (re)starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, exerciseId, epoch]);

  // Narrate each caption once as the demonstration reaches it, only after the person asked for voice.
  useEffect(() => {
    if (!narrate || spoken.current === frame.cap) return;
    spoken.current = frame.cap;
    speak(caption);
  }, [narrate, frame.cap, caption]);

  const replay = () => {
    spoken.current = null;
    setT(0);
    setPlaying(true);
    setEpoch((e) => e + 1);
  };
  const label = `${tx(lang, "Demonstration", "প্রদর্শন")}: ${captions.join(" ")}`;
  const still = keyPoses(exerciseId) as { figure: unknown; cap: number; view: string; props: unknown[] }[];

  return (
    <figure className={cn("overflow-hidden rounded-2xl bg-wash ring-1 ring-line", className)} data-testid="move-demo" data-exercise={exerciseId}>
      <div className={cn("relative", compact ? "h-44" : "h-56 sm:h-64")}>
        {isPlaying ? (
          <DemoSvg shapes={demoShapes(frame) as Shape[]} label={label} />
        ) : (
          <div className="grid h-full grid-cols-2 gap-2 p-2" role="img" aria-label={label}>
            {still.slice(0, 2).map((k, i) => (
              <div key={i} className="relative rounded-xl bg-surface ring-1 ring-line">
                <DemoSvg shapes={demoShapes(k) as Shape[]} label={captions[k.cap]} />
                <span className="absolute bottom-1 left-2 text-xs font-medium text-muted">{i === 0 ? tx(lang, "Start", "শুরু") : tx(lang, "Then", "তারপর")}</span>
              </div>
            ))}
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">{tx(lang, "Illustration", "চিত্র")}</span>
      </div>
      <figcaption className="border-t border-line bg-surface px-4 py-3">
        <p className="min-h-12 text-base font-medium text-ink" aria-live="polite" data-testid="demo-caption" lang={lang === "bn" ? "bn" : "en"}>
          {caption}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={replay} aria-label={tx(lang, "Show me again from the start", "শুরু থেকে আবার দেখান")}>
            {tx(lang, "Show me again", "আবার দেখান")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPlaying(!isPlaying)} aria-pressed={isPlaying}>
            {isPlaying ? tx(lang, "Pause animation", "অ্যানিমেশন থামান") : tx(lang, "Play animation", "অ্যানিমেশন চালান")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={narrate}
            onClick={() => {
              spoken.current = null;
              setNarrate(!narrate);
              if (!narrate && !isPlaying) speak(captions.join(" "));
            }}
          >
            {narrate ? tx(lang, "Voice on", "ভয়েস চালু") : tx(lang, "Play voice", "ভয়েস শুনুন")}
          </Button>
        </div>
        <span className="sr-only">{`${Math.round(loopMs(exerciseId) / 1000)} ${tx(lang, "second loop", "সেকেন্ডের লুপ")}`}</span>
      </figcaption>
    </figure>
  );
}
