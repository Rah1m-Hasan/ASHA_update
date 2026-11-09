"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { engineModule, loadClassicScripts } from "@/lib/engine/load";
import type {
  FrameSnapshot,
  PerceptionInstance,
  PulseValue,
} from "@/lib/engine/types";

type CameraState = "off" | "starting" | "on" | "error";

type PerceptionContextValue = {
  state: CameraState;
  status: string;
  snapshot: FrameSnapshot;
  pulse: PulseValue | null;
  calibrating: boolean;
  setCalibrating: (value: boolean) => void;
  /** True while a Move workout is running: exercise movements must not be read as requests. */
  exercising: boolean;
  setExercising: (value: boolean) => void;
  start: () => Promise<void>;
  stop: () => void;
  setModule: (name: string) => void;
  /** Access the engine instance (null until the camera has been started once). */
  instance: () => PerceptionInstance | null;
  /** Show the shared camera inside `host`. The most recently attached host wins; returns a detach function. */
  attach: (host: HTMLElement) => () => void;
};

const PerceptionContext = createContext<PerceptionContextValue | null>(null);

// Off-screen holder that keeps the video element in the document (moving it out would pause it).
function parking() {
  let el = document.getElementById("camera-parking");
  if (!el) {
    el = document.createElement("div");
    el.id = "camera-parking";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px";
    document.body.append(el);
  }
  return el;
}

/** One camera, one engine for every patient page. Survives client-side navigation. */
export function PerceptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const engine = useRef<PerceptionInstance | null>(null);
  const stageEl = useRef<HTMLDivElement | null>(null);
  const moduleName = useRef("companion");
  const hosts = useRef<HTMLElement[]>([]);
  const [state, setState] = useState<CameraState>("off");
  const [status, setStatus] = useState("Camera is off");
  const [snapshot, setSnapshot] = useState<FrameSnapshot>({});
  const [pulse, setPulse] = useState<PulseValue | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [exercising, setExercising] = useState(false);
  const instance = useCallback(() => engine.current, []);
  const starting = useRef<Promise<void> | null>(null);
  const generation = useRef(0);

  // Build the shared stage once on the client.
  const stage = useCallback(() => {
    if (!stageEl.current && typeof document !== "undefined") {
      const wrap = document.createElement("div");
      wrap.className = "relative size-full overflow-hidden bg-heading";
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.className = "absolute inset-0 size-full -scale-x-100 object-cover";
      const canvas = document.createElement("canvas");
      canvas.className = "absolute inset-0 size-full -scale-x-100 object-cover";
      wrap.append(video, canvas);
      stageEl.current = wrap;
    }
    return stageEl.current;
  }, []);

  const place = useCallback(() => {
    const el = stage();
    if (!el) return;
    const target = hosts.current.at(-1) ?? parking();
    if (el.parentElement !== target) target.append(el);
    const video = el.querySelector("video");
    if (video?.srcObject && video.paused) void video.play().catch(() => {});
  }, [stage]);

  const attach = useCallback(
    (host: HTMLElement) => {
      hosts.current.push(host);
      place();
      return () => {
        hosts.current = hosts.current.filter((h) => h !== host);
        place();
      };
    },
    [place],
  );

  const ensureEngine = useCallback(async () => {
    if (engine.current) return engine.current;
    await loadClassicScripts();
    const { Perception } = await engineModule<{
      Perception: new (
        v: HTMLVideoElement,
        c: HTMLCanvasElement,
      ) => PerceptionInstance;
    }>("perception");
    const el = stage()!;
    const p = new Perception(
      el.querySelector("video")!,
      el.querySelector("canvas")!,
    );
    p.setActiveModule(moduleName.current);
    // Throttle UI updates to ~8 fps; the engine itself runs at camera rate.
    let last = 0;
    p.addEventListener("frame", (e) => {
      const now = performance.now();
      if (now - last < 120) return;
      last = now;
      setSnapshot({ ...(e as CustomEvent<FrameSnapshot>).detail });
    });
    p.addEventListener("vitals", (e) =>
      setPulse({ ...(e as CustomEvent<PulseValue>).detail }),
    );
    p.addEventListener("status", (e) =>
      setStatus(String((e as CustomEvent).detail)),
    );
    engine.current = p;
    return p;
  }, [stage]);

  const start = useCallback(async () => {
    if (starting.current) return starting.current;
    if (engine.current?.running) return;
    const current = ++generation.current;
    setState("starting");
    const task = (async () => {
      try {
        const p = await ensureEngine();
        place();
        await p.start();
        if (current !== generation.current) {
          p.stop();
          return;
        }
        setState("on");
      } catch (err) {
        engine.current?.stop();
        if (current !== generation.current) return;
        setState("error");
        setStatus(
          (err as Error).name === "NotAllowedError"
            ? "Camera permission was blocked. Allow camera access in your browser settings."
            : `Camera could not start: ${(err as Error).message}`,
        );
      }
    })();
    starting.current = task;
    try {
      await task;
    } finally {
      if (starting.current === task) starting.current = null;
    }
  }, [ensureEngine, place]);

  const stop = useCallback(() => {
    generation.current++;
    engine.current?.stop();
    setState("off");
    setStatus("Camera is off");
    setSnapshot({});
    setPulse(null);
    setCalibrating(false);
  }, []);

  const setModule = useCallback((name: string) => {
    moduleName.current = name;
    engine.current?.setActiveModule(name);
  }, []);

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) setCalibrating(false);
    };
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      generation.current++;
      engine.current?.stop();
      stageEl.current?.remove();
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [stop]);

  const value = useMemo(
    () => ({
      state,
      status,
      snapshot,
      pulse,
      calibrating,
      setCalibrating,
      exercising,
      setExercising,
      start,
      stop,
      setModule,
      instance,
      attach,
    }),
    [
      state,
      status,
      snapshot,
      pulse,
      calibrating,
      exercising,
      start,
      stop,
      setModule,
      instance,
      attach,
    ],
  );
  return (
    <PerceptionContext.Provider value={value}>
      {children}
    </PerceptionContext.Provider>
  );
}

export function usePerception() {
  const ctx = useContext(PerceptionContext);
  if (!ctx)
    throw new Error("usePerception must be used inside PerceptionProvider");
  return ctx;
}

/** Subscribe to a raw engine event (gesture, facecommand, hand, cue). */
export function usePerceptionEvent<T>(
  type: string,
  handler: (detail: T) => void,
  enabled = true,
) {
  const { instance, state } = usePerception();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const p = instance();
    if (!p || !enabled) return;
    const fn = (e: Event) => ref.current((e as CustomEvent<T>).detail);
    p.addEventListener(type, fn);
    return () => p.removeEventListener(type, fn);
  }, [instance, state, type, enabled]);
}

/** Tell the engine which module is in focus while a page is mounted. */
export function useActiveModule(name: string) {
  const { setModule } = usePerception();
  useEffect(() => {
    setModule(name);
  }, [name, setModule]);
}
