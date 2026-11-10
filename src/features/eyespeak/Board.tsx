"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRequests } from "@/features/requests/RequestProvider";
import { speak } from "@/features/speech/speak";
import { cn } from "@/lib/cn";
import { LongBlink, tileBefore } from "./cursor-logic.js";
import { BOARDS, CONFIRM_TILES, DwellSelector, TileTracker, predictGaze, smoothPoint } from "./gaze";
import type { BoardSize, GazeModel, Tile } from "./gaze";
import type { Feed } from "./Calibration";

type Rect = { id: string; x: number; y: number; w: number; h: number };
/** Eyes lost for longer than this (not a blink) clear the fill. */
const LOSS_MS = 600;
/** Below this many face results per second, say so on the board. */
const SLOW_FPS = 5;

/**
 * Full screen tiles chosen by looking. A tile is chosen after the smoothed gaze point stays on it for
 * the selection time (brief jitter, blinks and slow frames pause rather than restart it), or at once
 * with a slow blink (eyes closed for about half a second; natural blinks don't count); touch works
 * on every tile too. Needs (water, toilet…) go through the
 * same confirmation as everywhere in Asha, answered here with two halves of the screen.
 */
export function Board({ size, model, dwellMs, showDot, feed, onExit }: { size: Exclude<BoardSize, 0>; model: GazeModel; dwellMs: number; showDot: boolean; feed: Feed; onExit: () => void }) {
  const { pending, propose, confirm, cancel, delivery } = useRequests();
  const confirming = !!pending && pending.source === "eyespeak";
  const board = BOARDS[size];
  const tiles = useMemo(() => (confirming ? CONFIRM_TILES : board.tiles), [confirming, board]);
  const cols = confirming ? 2 : board.cols;
  const grid = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const rects = useRef<Rect[]>([]);
  const nodes = useRef(new Map<string, HTMLElement>());
  // Slow devices deliver a face result every few hundred milliseconds; a late one must not restart the fill.
  const dwell = useMemo(() => new DwellSelector({ dwellMs, maxGapMs: 900 }), [dwellMs]);
  const smooth = useRef<{ x: number; y: number; t: number } | null>(null);
  const [status, setStatus] = useState("");
  const [said, setSaid] = useState<string[]>([]);
  // The note shows whatever happened last: a word spoken after a request replaces its delivery note.
  const [saidOver, setSaidOver] = useState<typeof delivery | null>(null);

  const choose = useCallback(
    (tile: Tile) => {
      if (tile.id === "confirm-yes") return void confirm();
      if (tile.id === "confirm-no") return cancel();
      setSaid((s) => [tile.label, ...s].slice(0, 6));
      if (tile.need) propose(tile.need, tile.say, "eyespeak");
      else {
        setSaidOver(delivery);
        speak(tile.say);
      }
    },
    [confirm, cancel, propose, delivery],
  );
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });

  // Tile positions as fractions of the screen, the same frame the calibration used.
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
    dwell.reset();
    const tracker = new TileTracker();
    // A new layout appears under a still gaze (after "Water" the left half is "No"). The tile under
    // where the eyes were when it changed is ignored until they move off it, so nothing is chosen
    // without a deliberate look. (Tile positions are already measured: layout effects run first.)
    const was = smooth.current;
    dwell.hold(was ? (rects.current.find((r) => was.x >= r.x && was.x <= r.x + r.w && was.y >= r.y && was.y <= r.y + r.h)?.id ?? null) : null);
    let lostSince: number | null = null;
    let lastT: number | null = null;
    const blink = new LongBlink();
    // Where the eyes were, moment by moment, so a slow blink chooses the tile they had settled on.
    const trail: { t: number; x: number; y: number }[] = [];
    const steady = Math.min(0.14, Math.max(0.06, (model.validation?.p90Error ?? 0.1) * 0.8));
    let rate = 0;
    const paint = (id: string | null, progress: number) => {
      for (const [key, el] of nodes.current) el.style.setProperty("--dwell", key === id ? String(progress) : "0");
    };
    const lose = (t: number, reason: string) => {
      // A blink or a frame or two without irises pauses the fill; only a longer loss clears it.
      lostSince ??= t;
      if (t - lostSince < LOSS_MS || blink.closing) return;
      dwell.update(null, t, false);
      tracker.reset();
      smooth.current = null;
      paint(null, 0);
      if (dot.current) dot.current.style.opacity = "0";
      setStatus(reason);
    };
    // A short message that outlasts the per-frame status for a few seconds.
    let hint: { text: string; until: number } | null = null;
    const pick = (id: string, via: "blink" | "dwell") => {
      if (root.current) root.current.dataset.chosenBy = via;
      dwell.hold(id);
      paint(null, 0);
      const tile = tiles.find((x) => x.id === id);
      if (tile) chooseRef.current(tile);
    };
    feed((f, t, open) => {
      if (lastT !== null && t > lastT) rate = rate ? rate * 0.9 + (1000 / (t - lastT)) * 0.1 : 1000 / (t - lastT);
      lastT = t;
      if (document.querySelector("dialog[open]")) {
        setStatus("Answer the question on screen first.");
        return;
      }
      const b = blink.update(open, t);
      if (b?.kind === "click") {
        const id = tileBefore(trail, rects.current, b.closedAt, { radius: steady });
        if (id) return pick(id, "blink");
        hint = { text: "Your eyes were still moving. Rest them on a tile for a moment, then blink slowly.", until: t + 3000 };
      }
      if (!f.valid) return lose(t, f.reason);
      const p = predictGaze(model, f.values, { requireValidation: false }) as { valid: boolean; x?: number; y?: number; reason?: string };
      if (!p.valid || p.x === undefined || p.y === undefined) return lose(t, p.reason ?? "");
      lostSince = null;
      const s = (smooth.current = smoothPoint(smooth.current, { x: p.x, y: p.y }, t));
      if (dot.current) {
        dot.current.style.opacity = "1";
        dot.current.style.transform = `translate(${s.x * innerWidth}px, ${s.y * innerHeight}px)`;
      }
      setStatus(hint && t < hint.until ? hint.text : rate && rate < SLOW_FPS ? `Tracking is slow on this device (${Math.round(rate)} per second), so hold your gaze a little longer. Closing other apps helps.` : "");
      const over = tracker.update(s, rects.current, t);
      trail.push(s);
      while (trail.length && trail[0].t < t - 2500) trail.shift();
      const chosen = dwell.update(over, t, true);
      paint((dwell.target as string | null) ?? null, dwell.progress ?? 0);
      if (chosen) pick(chosen as string, "dwell");
    });
    return () => feed(null);
  }, [feed, model, dwell, tiles]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onExit]);

  const saidNote = said.length ? `Said: ${said.join(" · ")}` : "Look at a tile and hold your gaze until it fills, or blink slowly.";
  const deliveryNote: Partial<Record<typeof delivery.state, string>> = {
    sending: "Sending to your caregiver…",
    sent: "Sent to your caregiver.",
    local: "Recognised on this device. Connect a caregiver to deliver requests.",
    failed: "Not sent. Check the connection, or use touch.",
  };
  const note = confirming ? `Send to your caregiver: “${pending!.text}”?` : (delivery !== saidOver && deliveryNote[delivery.state]) || saidNote;

  return (
    <div ref={root} className="fixed inset-0 z-[60] flex flex-col bg-wash" role="dialog" aria-modal="true" aria-label="Look to choose" data-testid="gaze-board" data-size={confirming ? 2 : size}>
      <div className="flex min-h-12 items-center gap-3 px-4 pt-2 text-sm">
        <p role="status" aria-live="polite" className="min-w-0 flex-1 truncate text-ink" data-testid="board-note">
          {note}
        </p>
        <button onClick={onExit} className="shrink-0 rounded-full px-4 py-2 font-medium text-muted ring-1 ring-line hover:bg-white">
          Close
        </button>
      </div>
      {status && (
        <p className="px-4 pt-1 text-sm text-amber-800" data-testid="board-status">
          {status}
        </p>
      )}
      <div ref={grid} className="grid flex-1 gap-[3vmin] p-[3vmin]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {tiles.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              if (el) nodes.current.set(t.id, el);
              else nodes.current.delete(t.id);
            }}
            data-tile={t.id}
            onClick={() => choose(t)}
            className={cn(
              "relative grid place-items-center overflow-hidden rounded-3xl text-center ring-1",
              t.id === "confirm-yes" ? "bg-brand text-white ring-brand" : "bg-white text-ink ring-line",
            )}
            style={{ ["--dwell" as string]: "0" }}
          >
            <span aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 origin-bottom transition-transform duration-100", t.id === "confirm-yes" ? "bg-white/30" : "bg-brand/20")} style={{ height: "100%", transform: "scaleY(var(--dwell))" }} />
            <span className="relative">
              <span className="block text-[clamp(1.5rem,5vmin,3.5rem)] leading-tight font-semibold">{t.label}</span>
              <span className={cn("mt-1 block text-[clamp(1rem,3vmin,1.75rem)]", t.id === "confirm-yes" ? "text-white/80" : "text-muted")}>{t.bn}</span>
            </span>
          </button>
        ))}
      </div>
      {showDot && (
        <div ref={dot} data-testid="gaze-dot" aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-[61] -mt-4 -ml-4 size-8 rounded-full border-4 border-brand/70 bg-brand/15 opacity-0 ring-2 ring-white transition-opacity" />
      )}
    </div>
  );
}
