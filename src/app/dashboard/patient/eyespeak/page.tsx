"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Switch } from "@/components/dashboard/Switch";
import { Button } from "@/components/ui/Button";
import { ChevronIcon } from "@/components/ui/icons";
import { Board } from "@/features/eyespeak/Board";
import { Calibration } from "@/features/eyespeak/Calibration";
import type { CalibrationResult, Feed } from "@/features/eyespeak/Calibration";
import { eyeOpenness } from "@/features/eyespeak/cursor-logic.js";
import { EyeOverlay } from "@/features/eyespeak/EyeOverlay";
import { BOARD_LABEL, BOARD_LIMITS, boardFor, cursorOk, extractGazeFeatures, predictGaze } from "@/features/eyespeak/gaze";
import type { Features, Sample } from "@/features/eyespeak/gaze";
import { eyeSpeakStore, screenChanged, useEyeSpeak } from "@/features/eyespeak/store";
import type { CursorClick } from "@/features/eyespeak/store";
import { CameraView } from "@/features/perception/CameraView";
import { useActiveModule, usePerception, usePerceptionEvent } from "@/features/perception/PerceptionProvider";
import type { FrameLandmarks } from "@/lib/engine/types";

const pct = (v: number) => `${Math.round(v * 100)}%`;
// Buttons that wait for the camera or a calibration look unavailable until then.
const DIM = "disabled:cursor-not-allowed disabled:opacity-45";
const DWELL = [
  { ms: 800, label: "0.8 s" },
  { ms: 1200, label: "1.2 s" },
  { ms: 1500, label: "1.5 s" },
];
const CLICKS: { value: CursorClick; label: string }[] = [
  { value: "blink", label: "Slow blink" },
  { value: "dwell", label: "Hold your look" },
  { value: "both", label: "Either" },
];
const pill = (on: boolean) => `rounded-full px-3 py-1 text-sm font-medium ${on ? "bg-surface text-ink shadow-sm" : "text-muted"}`;

export default function EyeSpeakPage() {
  useActiveModule("eyespeak");
  const { state: camera, mirrored } = usePerception();
  const model = useEyeSpeak((s) => s.model);
  const screen = useEyeSpeak((s) => s.screen);
  const remember = useEyeSpeak((s) => s.remember);
  const dwellMs = useEyeSpeak((s) => s.dwellMs);
  const showDot = useEyeSpeak((s) => s.showDot);
  const cursor = useEyeSpeak((s) => s.cursor);
  const cursorClick = useEyeSpeak((s) => s.cursorClick);
  const overlay = useEyeSpeak((s) => s.mode);
  const consumer = useRef<((f: Features, t: number, open: number | null) => void) | null>(null);
  const feed: Feed = useCallback((c) => {
    consumer.current = c;
  }, []);
  const [live, setLive] = useState<{ valid: boolean; reason: string; x: number; y: number } | null>(null);
  const lastUi = useRef(0);
  // Face results per second, shown so a slow device is visible (gaze selection needs steady results).
  const rate = useRef({ last: 0, fps: 0 });
  const [fps, setFps] = useState(0);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => () => eyeSpeakStore.set({ mode: null }), []);

  usePerceptionEvent<FrameLandmarks>("landmarks", (f) => {
    const features = extractGazeFeatures(f.face, f.videoSize.width, f.videoSize.height) as Features;
    const t = f.faceAt ?? f.timestampMs;
    // How open the eyes are only matters to the calibration and the board.
    const c = consumer.current;
    if (c) c(features, t, eyeOpenness(f.face, f.videoSize.width, f.videoSize.height));
    const r = rate.current;
    if (r.last && t > r.last) r.fps = r.fps ? r.fps * 0.9 + (1000 / (t - r.last)) * 0.1 : 1000 / (t - r.last);
    r.last = t;
    const now = performance.now();
    if (now - lastUi.current < 100) return;
    lastUi.current = now;
    setFps(Math.round(r.fps));
    if (features.valid) {
      const [rx, ry, lx, ly] = features.values;
      // Looking toward the left of the screen moves both irises toward the image's right.
      setLive({ valid: true, reason: "", x: Math.max(0, Math.min(1, 0.5 - 2.5 * ((rx + lx) / 2))), y: Math.max(0, Math.min(1, 0.5 + 4 * ((ry + ly) / 2))) });
    } else setLive({ valid: false, reason: features.reason, x: 0.5, y: 0.5 });
  }, camera === "on");

  const tracking = camera === "on" && !!live?.valid;
  const validation = model?.validation ?? null;
  const size = boardFor(validation);
  const cursorReady = cursorOk(size);

  const finished = (r: CalibrationResult) => {
    eyeSpeakStore.set({ mode: null });
    setProblem("");
    setResult(r);
    eyeSpeakStore.setModel(r.model, { w: innerWidth, h: innerHeight });
  };
  const stopped = (reason?: string) => {
    eyeSpeakStore.set({ mode: null });
    if (reason) setProblem(reason);
  };
  const openBoard = (kind: "board" | "scan" = "board") => {
    eyeSpeakStore.set({ mode: kind });
  };
  const closeBoard = useCallback(() => {
    eyeSpeakStore.set({ mode: null });
  }, []);

  const predictions = useMemo(() => {
    if (!result) return [];
    return result.check
      .map((s: Sample) => ({ s, p: predictGaze(result.model, s.features, { requireValidation: false }) as { valid: boolean; x?: number; y?: number; confidence?: number } }))
      .filter((x) => x.p.valid);
  }, [result]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="EyeSpeak"
        description="Choose a word by looking at it. Asha shows what the camera sees, measures how accurate it is for you, and only lets your eyes choose tiles that are big enough for that accuracy. Touch always works."
      />

      <section aria-labelledby="eyes-title" className="mb-10">
        <h2 id="eyes-title" className="mb-3 text-base font-semibold text-ink">
          1. Your eyes on camera
        </h2>
        <CameraView offMessage="Start the camera to see your eyes tracked. Video never leaves this device.">
          <EyeOverlay mirrored={mirrored} />
        </CameraView>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="flex min-w-0 basis-full items-center gap-2 text-sm sm:basis-0 sm:flex-1" role="status" data-testid="eye-status">
            <span className={`size-2 shrink-0 rounded-full ${tracking ? "bg-good-strong" : camera === "on" ? "bg-warn-strong" : "bg-line"}`} />
            <span>
              {camera !== "on" ? "Camera off" : !live ? "Looking for your face…" : live.valid ? "Both eyes and irises tracked" : live.reason}
              {camera === "on" && live && fps > 0 && (
                <span className={fps < 5 ? "text-warn" : "text-muted"} data-testid="eye-rate" data-fps={fps}>
                  {" "}· {fps} per second{fps < 5 ? ". Slow: close other apps for steadier selection." : ""}
                </span>
              )}
            </span>
          </p>
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-24 rounded-lg bg-wash ring-1 ring-line" aria-hidden="true">
              {tracking && <span data-testid="raw-eye-dot" className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand transition-all duration-100" style={{ left: pct(live!.x), top: pct(live!.y) }} />}
            </div>
            <p className="max-w-40 text-xs text-muted">Raw eye position. Look left and right: the dot follows.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="cal-title" className="mb-10">
        <h2 id="cal-title" className="text-base font-semibold text-ink">
          2. Calibrate
        </h2>
        <p className="mt-0.5 mb-3 text-sm text-muted">Look at 12 dots, one at a time, for about 25 seconds. The last 3 dots measure how accurate gaze is for you, on this screen.</p>
        {problem && (
          <p className="mb-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn ring-1 ring-warn-line" role="alert">
            Calibration stopped: {problem}
          </p>
        )}
        {model && !model.validation && (
          <p className="mb-3 text-sm text-ink">A calibration from an earlier visit is saved on this device. Run the 3-dot check before using it.</p>
        )}
        {screenChanged(screen) && <p className="mb-3 text-sm text-warn">The window size changed since calibrating. Calibrate again for accurate selection.</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => eyeSpeakStore.set({ mode: "calibrate" })} disabled={!tracking} className={DIM}>
            {model ? "Calibrate again" : "Start calibration"}
          </Button>
          {model && (
            <Button variant="secondary" onClick={() => eyeSpeakStore.set({ mode: "check" })} disabled={!tracking} className={DIM}>
              Quick 3-dot check
            </Button>
          )}
        </div>
        {!tracking && <p className="mt-2 text-xs text-muted">Available once both eyes are tracked.</p>}

        {validation && (
          <div className="mt-5 rounded-2xl bg-surface p-5 ring-1 ring-line" data-testid="accuracy">
            <div className="flex flex-wrap items-start gap-6">
              <dl className="grid min-w-0 flex-1 grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted">Average error</dt>
                  <dd className="text-2xl font-semibold text-ink" data-testid="mean-error">
                    {pct(validation.meanError)}
                  </dd>
                  <dd className="text-xs text-muted">of the screen</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">9 in 10 looks within</dt>
                  <dd className="text-2xl font-semibold text-ink" data-testid="p90-error">
                    {pct(validation.p90Error)}
                  </dd>
                  <dd className="text-xs text-muted">measured on {validation.samples} eye frames at 3 dots</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm text-muted">Your board</dt>
                  <dd className="font-medium text-ink" data-testid="board-size">
                    {BOARD_LABEL[size]}
                  </dd>
                </div>
              </dl>
              {result && (
                <svg viewBox="0 0 160 100" className="w-44 shrink-0 rounded-lg bg-wash ring-1 ring-line" role="img" aria-label="Where your looks landed around the three check dots">
                  {predictions.map(({ p }, i) => (
                    <circle key={i} cx={p.x! * 160} cy={p.y! * 100} r="1.6" className="fill-brand/50" />
                  ))}
                  {[...new Set(result.check.map((s) => `${s.x},${s.y}`))].map((k) => {
                    const [x, y] = k.split(",").map(Number);
                    return <circle key={k} cx={x * 160} cy={y * 100} r="4" className="fill-none stroke-ink" strokeWidth="1.2" />;
                  })}
                </svg>
              )}
            </div>
            {size === 0 ? (
              <p className="mt-4 text-sm text-ink">
                Gaze isn’t accurate enough yet to choose even half the screen safely, so it stays off. It usually helps to light your face from the front, put the camera at eye level, sit 40–70 cm away and keep your head still. Blink scanning below works without it, and touch and a switch work too.
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Boards need 9 in 10 looks within {BOARD_LIMITS.map((l) => `${pct(l.p90)} for ${l.size === 2 ? "2 halves" : `${l.size} tiles`}`).join(", ")}. Recalibrate after moving the camera or if selection drifts.
              </p>
            )}
          </div>
        )}
        {model && (
          <div className="mt-3 divide-y divide-line">
            <Switch
              checked={remember}
              onChange={(keep) => eyeSpeakStore.set({ remember: keep })}
              label="Remember this calibration on this device"
              description="Saves numbers about your eye positions and the screen size, never video. It must pass the 3-dot check again next time."
            />
          </div>
        )}
      </section>

      <section aria-labelledby="look-title" className="mb-10">
        <h2 id="look-title" className="text-base font-semibold text-ink">
          3. Look to choose
        </h2>
        <p className="mt-0.5 mb-3 text-sm text-muted">
          Hold your gaze on a tile until it fills, or blink slowly while looking at it. Asha says it aloud. Requests like Water ask “Send to your caregiver?” and you answer by looking at Yes or No.
          {size === 2 && " Your accuracy fits two halves of the screen, so you choose in steps: each half opens two more until you reach your word. Water is three looks: More words, then Water, food or toilet, then Water. Close your eyes for 2 seconds to go back. To choose the same side twice, glance away and back, or blink slowly."}
        </p>
        <Button onClick={() => openBoard()} disabled={!size || camera !== "on"} className={DIM} data-testid="open-board">
          {size ? `Open the board (${BOARD_LABEL[size]})` : "Open the board"}
        </Button>
        {!size && <p className="mt-2 text-xs text-muted">Available after a calibration that is accurate enough.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-surface px-5 py-4 ring-1 ring-line">
          <span className="min-w-0 flex-1 basis-60">
            <span className="block font-medium text-ink">Blink scanning</span>
            <span className="block text-sm text-muted">No calibration needed. A light moves over all 9 words, one at a time, and a slow blink chooses the lit word. Slower than looking, but it works at any accuracy.</span>
          </span>
          <Button variant="secondary" onClick={() => openBoard("scan")} disabled={!tracking} className={DIM} data-testid="open-scan">
            Start blink scanning
          </Button>
        </div>
        <div className="mt-4 divide-y divide-line rounded-2xl bg-surface px-5 ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              <span className="block font-medium text-ink">Selection time</span>
              <span className="block text-xs text-muted">Blink scanning lights each word for {((dwellMs + 600) / 1000).toFixed(1)} s.</span>
            </span>
            <div className="flex gap-1 rounded-full bg-wash p-1" role="group" aria-label="Selection time">
              {DWELL.map((d) => (
                <button key={d.ms} aria-pressed={dwellMs === d.ms} onClick={() => eyeSpeakStore.setDwell(d.ms)} className={pill(dwellMs === d.ms)}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <Switch checked={showDot} onChange={(showDot) => eyeSpeakStore.set({ showDot })} label="Show where Asha thinks you’re looking" description="A ring follows your gaze on the board." />
        </div>
      </section>

      <section aria-labelledby="cursor-title" className="mb-10">
        <h2 id="cursor-title" className="text-base font-semibold text-ink">
          4. Use your eyes as a mouse
        </h2>
        <p className="mt-0.5 mb-3 text-sm text-muted">
          A ring follows your gaze on every Asha page. Look at a button and blink slowly, with your eyes closed for about half a second, to click it. Normal blinks don’t click. When buttons are too close together for your accuracy, Asha shows them as big tiles to choose from.
        </p>
        <Button
          onClick={() => eyeSpeakStore.set({ cursor: !cursor, cursorPaused: false })}
          disabled={!cursor && (!cursorReady || camera !== "on")}
          variant={cursor ? "secondary" : "primary"}
          className={DIM}
          data-testid="cursor-toggle"
        >
          {cursor ? "Turn off eye cursor" : "Turn on eye cursor"}
        </Button>
        {!cursorReady && <p className="mt-2 text-xs text-muted">Available after a calibration accurate enough for 6 or 9 tiles. Ordinary buttons are smaller than board tiles.</p>}
        <div className="mt-4 divide-y divide-line rounded-2xl bg-surface px-5 ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="font-medium text-ink">Click with</span>
            <div className="flex flex-wrap gap-1 rounded-full bg-wash p-1" role="group" aria-label="Click with">
              {CLICKS.map((c) => (
                <button key={c.value} aria-pressed={cursorClick === c.value} onClick={() => eyeSpeakStore.set({ cursorClick: c.value })} className={pill(cursorClick === c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <p className="py-3 text-sm text-muted">
            “Hold your look” clicks after the selection time above, so resting your eyes on a button clicks it. While the eye cursor is on, Asha reads only your face on most pages so the ring stays steady: hand signs pause, and with blink clicks the blink requests pause too.
          </p>
        </div>
      </section>

      <section aria-labelledby="spell-title" className="mb-6">
        <h2 id="spell-title" className="mb-3 text-base font-semibold text-ink">
          Spell a message
        </h2>
        <Link href="/dashboard/patient/eyespeak/keyboard" className="group flex items-center gap-4 rounded-2xl bg-surface px-5 py-4 ring-1 ring-line hover:bg-wash">
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">Letters and phrases</span>
            <span className="block text-sm text-muted">English and Bangla letters, word suggestions and switch scanning. Letter keys are small, so use touch or a switch there.</span>
          </span>
          <ChevronIcon size={18} className="shrink-0 text-muted" />
        </Link>
      </section>

      {(overlay === "calibrate" || overlay === "check") && <Calibration mode={overlay} model={model} feed={feed} onDone={finished} onCancel={stopped} />}
      {overlay === "board" && size !== 0 && model && <Board size={size} model={model} dwellMs={dwellMs} showDot={showDot} feed={feed} onExit={closeBoard} />}
      {overlay === "scan" && <Board size={9} mode="scan" model={model} dwellMs={dwellMs} showDot={false} feed={feed} onExit={closeBoard} />}
    </div>
  );
}
