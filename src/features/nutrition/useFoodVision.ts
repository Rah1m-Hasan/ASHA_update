"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { centreSquare } from "./scan.js";
import type { VisionResult } from "./types";

export type VisionStatus = "idle" | "loading" | "ready" | "error";

/**
 * The on-device food classifier, in its own worker. One image at a time; a call that takes longer
 * than `timeoutMs` resolves as {timeout: true} so a slow phone never blocks the flow.
 */
export function useFoodVision() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, (r: VisionResult) => void>());
  const seq = useRef(0);
  const [status, setStatus] = useState<VisionStatus>("idle");
  const [loadMs, setLoadMs] = useState<number | null>(null);

  const load = useCallback(() => {
    if (worker.current) return;
    setStatus("loading");
    try {
      const w = new Worker("/engine/food-classifier-worker.js");
      w.onmessage = ({ data: d }) => {
        if (d.type === "ready") {
          setStatus("ready");
          setLoadMs(d.loadMs ?? null);
        } else if (d.type === "error") setStatus("error");
        else if (d.type === "result") {
          pending.current.get(d.id)?.(d);
          pending.current.delete(d.id);
        }
      };
      w.onerror = () => setStatus("error");
      w.postMessage({ type: "init" });
      worker.current = w;
    } catch {
      setStatus("error");
    }
  }, []);

  /** Classify the centre square of `source` (a video, canvas or image of size w × h). */
  const classify = useCallback(async (source: CanvasImageSource, w: number, h: number, timeoutMs = 8000): Promise<VisionResult> => {
    const wk = worker.current;
    if (!wk || !w || !h) return { categories: [], faceCount: null, unavailable: true };
    const sq = centreSquare(w, h);
    const s = Math.min(1, 640 / Math.max(w, h));
    let crop: ImageBitmap, frame: ImageBitmap;
    try {
      crop = await createImageBitmap(source as ImageBitmapSource, sq.x, sq.y, sq.side, sq.side, { resizeWidth: 224, resizeHeight: 224, resizeQuality: "medium" });
      frame = await createImageBitmap(source as ImageBitmapSource, { resizeWidth: Math.round(w * s), resizeHeight: Math.round(h * s) });
    } catch (err) {
      return { categories: [], faceCount: null, error: (err as Error).message };
    }
    const id = ++seq.current;
    return new Promise<VisionResult>((resolve) => {
      const timer = setTimeout(() => {
        pending.current.delete(id);
        resolve({ categories: [], faceCount: null, timeout: true });
      }, timeoutMs);
      pending.current.set(id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      wk.postMessage({ type: "classify", id, crop, frame }, [crop, frame]);
    });
  }, []);

  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
    },
    [],
  );

  return { status, loadMs, load, classify };
}
