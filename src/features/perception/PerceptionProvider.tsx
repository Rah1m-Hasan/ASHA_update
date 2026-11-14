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
  CameraSupportModule,
  FrameSnapshot,
  PerceptionInstance,
  PulseValue,
} from "@/lib/engine/types";

type CameraState = "off" | "starting" | "on" | "error";

type PerceptionContextValue = {
  state: CameraState;
  status: string;
  /**
   * Why the camera could not be used, in plain words. Kept apart from `status`,
   * which is the engine's live channel and is overwritten by every model
   * message. Null when the camera is fine.
   */
  cameraError: string | null;
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
  /** Whether the preview is shown mirrored (selfie view). Display only; models see the raw frame. */
  mirrored: boolean;
  setMirrored: (value: boolean) => void;
  /** Which camera is in use, and a switch between front and back where the device has both. */
  facing: "user" | "environment";
  switchCamera: () => Promise<void>;
};

const PerceptionContext = createContext<PerceptionContextValue | null>(null);

/**
 * The shared camera-support probe, loaded once from /engine at runtime.
 *
 * It is loaded defensively: if the module cannot be fetched the camera still
 * works, because the engine carries the same guard. Only the explanation of a
 * failure falls back to a generic sentence.
 */
let supportModule: Promise<CameraSupportModule | null> | null = null;
function loadCameraSupport(): Promise<CameraSupportModule | null> {
  supportModule ??= engineModule<CameraSupportModule>("camera-support").catch(
    (err) => {
      console.warn("Camera support probe unavailable", err);
      return null;
    },
  );
  return supportModule;
}

const GENERIC_CAMERA_ERROR = "The camera could not start. Please try again.";

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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FrameSnapshot>({});
  const [pulse, setPulse] = useState<PulseValue | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [exercising, setExercising] = useState(false);
  const [mirrored, setMirroredState] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const instance = useCallback(() => engine.current, []);
  const starting = useRef<Promise<void> | null>(null);
  const generation = useRef(0);

  // Build the shared stage once on the client.
  const stage = useCallback(() => {
    if (!stageEl.current && typeof document !== "undefined") {
      const wrap = document.createElement("div");
      wrap.className = "relative size-full overflow-hidden bg-veil";
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
        // Fail before the models are downloaded: a browser with no camera API
        // (an http:// address on the LAN) can never open one, and the patient
        // should read why rather than watch a spinner.
        const support = await loadCameraSupport();
        const probe = support?.cameraSupport();
        if (probe && !probe.ok) throw support!.cameraFailure(probe.code);
        const p = await ensureEngine();
        place();
        await p.start();
        if (current !== generation.current) {
          p.stop();
          return;
        }
        setCameraError(null);
        setState("on");
      } catch (err) {
        engine.current?.stop();
        if (current !== generation.current) return;
        const support = await loadCameraSupport();
        const message =
          support?.cameraMessage(err) ?? GENERIC_CAMERA_ERROR;
        console.warn("Camera start failed", err);
        setState("error");
        setCameraError(message);
        setStatus(message);
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
    setCameraError(null);
    setSnapshot({});
    setPulse(null);
    setCalibrating(false);
  }, []);

  const setMirrored = useCallback(
    (value: boolean) => {
      setMirroredState(value);
      const el = stage();
      for (const node of el?.querySelectorAll("video, canvas") ?? []) node.classList.toggle("-scale-x-100", value);
    },
    [stage],
  );

  const switchCamera = useCallback(async () => {
    const p = engine.current;
    const next = facing === "user" ? "environment" : "user";
    if (!p?.setFacingMode) return;
    try {
      const actual = await p.setFacingMode(next);
      const now = actual === "environment" ? "environment" : "user";
      setFacing(now);
      setCameraError(null);
      // Selfie view for the front camera; a true (unmirrored) view for the back camera.
      setMirrored(now === "user");
    } catch (err) {
      // The old camera is still running, so the camera state stays "on" and the
      // reason is reported on its own. Flipping the state would blank the
      // preview of a camera that is still working.
      const support = await loadCameraSupport();
      const message = support?.cameraMessage(err) ?? GENERIC_CAMERA_ERROR;
      console.warn("Camera switch failed", err);
      setCameraError(message);
      setStatus(message);
    }
  }, [facing, setMirrored]);

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
      const perception = engine.current;
      if (perception?.destroy) perception.destroy();
      else perception?.stop();
      engine.current = null;
      stageEl.current?.remove();
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [stop]);

  const value = useMemo(
    () => ({
      state,
      status,
      cameraError,
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
      mirrored,
      setMirrored,
      facing,
      switchCamera,
    }),
    [
      state,
      status,
      cameraError,
      snapshot,
      pulse,
      calibrating,
      exercising,
      start,
      stop,
      setModule,
      instance,
      attach,
      mirrored,
      setMirrored,
      facing,
      switchCamera,
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
