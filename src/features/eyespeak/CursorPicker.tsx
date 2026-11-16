"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { usePerceptionEvent } from "@/features/perception/PerceptionProvider";
import type { FrameLandmarks } from "@/lib/engine/types";
import { eyeOpenness, placeOf, tileBefore } from "./cursor-logic.js";
import { DwellSelector, TileTracker, extractGazeFeatures, inside, measureRects, steadyRadius } from "./gaze";
import type { Features, GazeModel, Rect } from "./gaze";
import { GazeSession } from "./gaze-session";
import type { Target } from "./targets";

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
  onPick,
}: {
  choices: Target[];
  /** Where the eyes were when the picker opened: that tile waits until they move. */
  from: { x: number; y: number } | null;
  model: GazeModel;
  dwellMs: number;
  byBlink: boolean;
  byDwell: boolean;
  onPick: (target: Target | null) => void;
}) {
  const tiles = useMemo(() => [...choices.map((c) => ({ id: c.id, label: c.label ?? "Button", place: placeOf(c), target: c as Target | null })), { id: "cancel", label: "Cancel", place: "Nothing", target: null }], [choices]);
  const cols = tiles.length > 4 ? 3 : 2;
  const nodes = useRef(new Map<string, HTMLElement>());
  const rects = useRef<Rect[]>([]);
  const dot = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  const sessionRef = useRef<GazeSession | null>(null);
  const session = (sessionRef.current ??= new GazeSession());
  /** The selection state, rebuilt when the layout or the model changes. */
  const state = useRef<{ tracker: TileTracker; dwell: DwellSelector; steady: number } | null>(null);
  useEffect(() => {
    pick.current = onPick;
  });

  const paint = (id: string | null, progress: number) => {
    for (const [key, el] of nodes.current) el.style.setProperty("--dwell", key === id ? String(progress) : "0");
  };

  useLayoutEffect(() => {
    const measure = () => {
      rects.current = measureRects(nodes.current);
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [tiles]);

  useEffect(() => {
    const tracker = new TileTracker();
    const dwell = new DwellSelector({ dwellMs, maxGapMs: 900 });
    // The tile the eyes were on when the picker opened waits until they move off it.
    dwell.hold(from ? (rects.current.find((r) => inside(from, r))?.id ?? null) : null);
    state.current = { tracker, dwell, steady: steadyRadius(model.validation?.p90Error ?? 0.1) };
  }, [tiles, model, dwellMs, from]);

  usePerceptionEvent<FrameLandmarks>("landmarks", (f) => {
    const { tracker, dwell, steady } = state.current ?? {};
    if (!tracker || !dwell) return;
    const t = f.faceAt ?? f.timestampMs;
    const features = extractGazeFeatures(f.face, f.videoSize.width, f.videoSize.height) as Features;
    const step = session.step({ features, t, open: eyeOpenness(f.face, f.videoSize.width, f.videoSize.height) }, model);
    const b = step.blink;
    if (byBlink && b?.kind === "click") {
      const id = tileBefore(session.history, rects.current, b.closedAt, { radius: steady });
      if (id) {
        const tile = tiles.find((t2) => t2.id === id);
        if (tile) pick.current(tile.target);
        return;
      }
    }
    if (!step.point) {
      if (step.lost) {
        tracker.reset();
        dwell.update(null, t, false);
        paint(null, 0);
        if (dot.current) dot.current.style.opacity = "0";
      }
      return;
    }
    if (dot.current) {
      dot.current.style.opacity = "1";
      dot.current.style.transform = `translate(${step.point.x * innerWidth}px, ${step.point.y * innerHeight}px)`;
    }
    const over = tracker.update(step.point, rects.current, t);
    if (!byDwell) {
      // Show which tile a blink would choose.
      for (const [key, el] of nodes.current) el.dataset.over = String(key === over);
      return;
    }
    const chosen = dwell.update(over, t, true);
    paint((dwell.target as string | null) ?? null, dwell.progress ?? 0);
    if (chosen) {
      const tile = tiles.find((t2) => t2.id === chosen);
      if (tile) pick.current(tile.target);
    }
  });

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
      <div className="grid grid-cols-1 flex-1 gap-[3vmin] p-[3vmin]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {tiles.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              if (el) nodes.current.set(t.id, el);
              else nodes.current.delete(t.id);
            }}
            data-pick={t.id === "cancel" ? "cancel" : t.label}
            onClick={() => pick.current(t.target)}
            className={`relative grid place-items-center overflow-hidden rounded-3xl text-center ring-1 data-[over=true]:ring-4 data-[over=true]:ring-brand ${t.id === "cancel" ? "bg-wash text-muted ring-line" : "bg-surface text-ink ring-line"}`}
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
      <div ref={dot} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-[67] -mt-4 -ml-4 size-8 rounded-full border-4 border-brand/70 bg-brand/15 opacity-0 ring-2 ring-surface" />
    </div>
  );
}
