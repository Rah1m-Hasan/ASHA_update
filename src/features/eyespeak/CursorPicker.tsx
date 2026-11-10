"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { FrameLandmarks } from "@/lib/engine/types";
import { LongBlink, eyeOpenness, placeOf, tileBefore } from "./cursor-logic.js";
import { DwellSelector, TileTracker, extractGazeFeatures, predictGaze, smoothPoint } from "./gaze";
import type { Features, GazeModel } from "./gaze";
import type { Target } from "./targets";

type Rect = { id: string; x: number; y: number; w: number; h: number };
const LOSS_MS = 600;
const inside = (p: { x: number; y: number }, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/**
 * Several buttons sit closer together than this person's gaze can tell apart, so the eye cursor
 * shows them as big tiles, the same size as the board they qualified for, plus Cancel. A tile is
 * chosen the way the cursor clicks (a slow blink, a held look, or either); touch works too.
 */
export function CursorPicker({
  choices,
  from,
  model,
  dwellMs,
  byBlink,
  byDwell,
  register,
  onPick,
}: {
  choices: Target[];
  /** Where the eyes were when the picker opened: that tile waits until they move. */
  from: { x: number; y: number } | null;
  model: GazeModel;
  dwellMs: number;
  byBlink: boolean;
  byDwell: boolean;
  register: (fn: ((f: FrameLandmarks) => void) | null) => void;
  onPick: (target: Target | null) => void;
}) {
  const tiles = useMemo(() => [...choices.map((c) => ({ id: c.id, label: c.label ?? "Button", place: placeOf(c), target: c as Target | null })), { id: "cancel", label: "Cancel", place: "Nothing", target: null }], [choices]);
  const cols = tiles.length > 4 ? 3 : 2;
  const nodes = useRef(new Map<string, HTMLElement>());
  const rects = useRef<Rect[]>([]);
  const dot = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  });

  useLayoutEffect(() => {
    const measure = () => {
      const W = innerWidth, H = innerHeight;
      rects.current = [...nodes.current.entries()].map(([id, el]) => {
        const r = el.getBoundingClientRect();
        return { id, x: r.left / W, y: r.top / H, w: r.width / W, h: r.height / H };
      });
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [tiles]);

  useEffect(() => {
    const choose = (id: string | null) => {
      const tile = tiles.find((t) => t.id === id);
      if (tile) pick.current(tile.target);
    };
    const tracker = new TileTracker();
    const dwell = new DwellSelector({ dwellMs, maxGapMs: 900 });
    dwell.hold(from ? (rects.current.find((r) => inside(from, r))?.id ?? null) : null);
    const blink = new LongBlink();
    let smooth: { x: number; y: number; t: number } | null = null;
    let lostSince: number | null = null;
    // Where the eyes were, moment by moment, so a slow blink chooses the tile they had settled on.
    const trail: { t: number; x: number; y: number }[] = [];
    const steady = Math.min(0.14, Math.max(0.06, (model.validation?.p90Error ?? 0.1) * 0.8));
    const paint = (id: string | null, progress: number) => {
      for (const [key, el] of nodes.current) el.style.setProperty("--dwell", key === id ? String(progress) : "0");
    };
    register((f) => {
      const t = f.faceAt ?? f.timestampMs;
      const b = blink.update(eyeOpenness(f.face, f.videoSize.width, f.videoSize.height), t);
      if (byBlink && b?.kind === "click") {
        const id = tileBefore(trail, rects.current, b.closedAt, { radius: steady });
        if (id) return choose(id);
      }
      const feat = extractGazeFeatures(f.face, f.videoSize.width, f.videoSize.height) as Features;
      const p = feat.valid ? (predictGaze(model, feat.values, { requireValidation: false }) as { valid: boolean; x?: number; y?: number }) : null;
      if (!p?.valid || p.x === undefined || p.y === undefined) {
        lostSince ??= t;
        if (t - lostSince >= LOSS_MS && !blink.closing) {
          tracker.reset();
          dwell.update(null, t, false);
          smooth = null;
          paint(null, 0);
          if (dot.current) dot.current.style.opacity = "0";
        }
        return;
      }
      lostSince = null;
      const s = (smooth = smoothPoint(smooth, { x: p.x, y: p.y }, t));
      if (dot.current) {
        dot.current.style.opacity = "1";
        dot.current.style.transform = `translate(${s.x * innerWidth}px, ${s.y * innerHeight}px)`;
      }
      const over = tracker.update(s, rects.current, t);
      trail.push(s);
      while (trail.length && trail[0].t < t - 2500) trail.shift();
      if (!byDwell) {
        // Show which tile a blink would choose.
        for (const [key, el] of nodes.current) el.dataset.over = String(key === over);
        return;
      }
      const chosen = dwell.update(over, t, true);
      paint((dwell.target as string | null) ?? null, dwell.progress ?? 0);
      if (chosen) choose(chosen as string);
    });
    return () => register(null);
  }, [tiles, model, dwellMs, byBlink, byDwell, register, from]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && pick.current(null);
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  const how = byBlink && byDwell ? "blink slowly or hold your look" : byBlink ? "blink slowly" : "hold your look until it fills";
  return (
    <div className="fixed inset-0 z-[66] flex flex-col bg-wash" role="dialog" aria-modal="true" aria-label="Which one?" data-testid="cursor-picker">
      <p className="px-4 pt-3 text-center text-sm text-ink" role="status">
        These are close together on the screen. Look at the one you meant and {how}.
      </p>
      <div className="grid flex-1 gap-[3vmin] p-[3vmin]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {tiles.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              if (el) nodes.current.set(t.id, el);
              else nodes.current.delete(t.id);
            }}
            data-pick={t.id === "cancel" ? "cancel" : t.label}
            onClick={() => pick.current(t.target)}
            className={`relative grid place-items-center overflow-hidden rounded-3xl text-center ring-1 data-[over=true]:ring-4 data-[over=true]:ring-brand ${t.id === "cancel" ? "bg-wash text-muted ring-line" : "bg-white text-ink ring-line"}`}
            style={{ ["--dwell" as string]: "0" }}
          >
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 origin-bottom bg-brand/20 transition-transform duration-100" style={{ height: "100%", transform: "scaleY(var(--dwell))" }} />
            <span className="relative px-3">
              <span className="block text-[clamp(1.25rem,4.5vmin,3rem)] leading-tight font-semibold">{t.label}</span>
              {t.id !== "cancel" && <span className="mt-1 block text-[clamp(0.9rem,2.5vmin,1.4rem)] text-muted">{t.place}</span>}
            </span>
          </button>
        ))}
      </div>
      <div ref={dot} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-[67] -mt-4 -ml-4 size-8 rounded-full border-4 border-brand/70 bg-brand/15 opacity-0 ring-2 ring-white" />
    </div>
  );
}
