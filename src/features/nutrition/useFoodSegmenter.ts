"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { candidatesFor } from "../../../public/app/nutrition/vision/map.js";
import { getEntry, allEntries } from "../../../public/app/nutrition/catalogue/index.js";
import type { ReviewFood } from "./Review";

export type SegmenterStatus = "idle" | "loading" | "ready" | "error";

/** What the worker sends back for one detected region. */
type DetectedItem = {
  classId: number;
  className: string;
  score: number;
  box: { x: number; y: number; w: number; h: number };
  maskAreaPx: number;
  areaRatio: number;
};

type WorkerMessage =
  | { type: "ready"; loadMs?: number; inputSize?: number; classes?: number }
  | { type: "error"; message: string }
  | { type: "result"; id: number; items: DetectedItem[]; ms?: number; width?: number; height?: number };

/**
 * The on-device food segmenter.
 *
 * This is the model that finds WHERE each food is on the plate, not just whether a plate of food
 * is in the picture. It runs once per still photograph, never in the live loop: a 768x768
 * inference takes around 600 ms on a desktop browser and considerably longer on a phone, so
 * running it 2.5 times a second would make the app unusable.
 *
 * The model is 14.7 MB and the ONNX Runtime is 11.2 MB. Both are fetched from the app's own
 * origin the first time they are needed and are then cached by the service worker, so they never
 * come from a third party at run time.
 *
 * Nothing here decides anything. The worker returns regions; the map turns a region into a
 * candidate; the person decides. A region ASHA has no food for is reported as unrecognised
 * rather than guessed at.
 */
export function useFoodSegmenter() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, (m: WorkerMessage) => void>());
  const seq = useRef(0);
  const [status, setStatus] = useState<SegmenterStatus>("idle");
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (worker.current) return;
    setStatus("loading");
    setError(null);
    try {
      const w = new Worker("/engine/food-segmenter-worker.js", { type: "module" });
      w.onmessage = ({ data }: { data: WorkerMessage }) => {
        if (data.type === "ready") {
          setStatus("ready");
          setLoadMs(data.loadMs ?? null);
        } else if (data.type === "error") {
          setStatus("error");
          setError(data.message);
        } else if (data.type === "result") {
          pending.current.get(data.id)?.(data);
          pending.current.delete(data.id);
        }
      };
      w.onerror = () => {
        setStatus("error");
        setError("The food detector could not be loaded.");
      };
      w.postMessage({ type: "init" });
      worker.current = w;
    } catch (err) {
      setStatus("error");
      setError((err as Error).message);
    }
  }, []);

  /**
   * Find the foods in a still picture.
   *
   * A slow phone resolves as a timeout rather than hanging, and the caller then falls back to
   * the person choosing the foods themselves.
   */
  const detect = useCallback(
    async (canvas: HTMLCanvasElement, timeoutMs = 20000): Promise<{ items: DetectedItem[]; ms: number | null; timedOut: boolean }> => {
      const wk = worker.current;
      if (!wk) return { items: [], ms: null, timedOut: false };
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(canvas);
      } catch {
        return { items: [], ms: null, timedOut: false };
      }
      const id = ++seq.current;
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.current.delete(id);
          resolve({ items: [], ms: null, timedOut: true });
        }, timeoutMs);
        pending.current.set(id, (message) => {
          clearTimeout(timer);
          if (message.type !== "result") return resolve({ items: [], ms: null, timedOut: false });
          resolve({ items: message.items ?? [], ms: message.ms ?? null, timedOut: false });
        });
        wk.postMessage({ type: "detect", id, bitmap }, [bitmap]);
      });
    },
    [],
  );

  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
    },
    [],
  );

  return { status, loadMs, error, load, detect };
}

/**
 * The catalogue, in the small shape the review screen needs.
 */
export const CATALOGUE_LITE = allEntries().map((entry) => ({
  foodId: entry.id,
  name: entry.en,
  nameBn: entry.bn,
  category: entry.category,
}));

/**
 * Turn the model's regions into rows the person can correct.
 *
 * The rules here are the ones the map already set: a region with a catalogue food becomes a
 * proposal with its alternatives, and a region without one is marked unrecognised and offered
 * no name at all.
 *
 * The score is carried through as a number. It is NOT a probability and the review screen says
 * so next to it.
 */
export function toReviewFoods(
  items: DetectedItem[],
  width: number,
  height: number,
): ReviewFood[] {
  return items.map((item, index) => {
    const candidates = candidatesFor(item.className);
    const entry = candidates ? getEntry(candidates.foodId) : null;
    const alternatives = (candidates?.alternatives ?? [])
      .map((id) => getEntry(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .map((e) => ({ foodId: e.id, name: e.en, nameBn: e.bn }));

    return {
      uid: `${item.classId}-${index}`,
      foodId: candidates ? candidates.foodId : null,
      proposedName: entry?.en ?? item.className,
      proposedNameBn: entry?.bn ?? item.className,
      score: item.score,
      modelLabel: item.className,
      alternatives,
      grams: null,
      method: null,
      uncertainty: null,
      areaRatio: item.areaRatio ?? null,
      region:
        width > 0 && height > 0
          ? {
              x: item.box.x / width,
              y: item.box.y / height,
              w: item.box.w / width,
              h: item.box.h / height,
            }
          : null,
      unidentified: !candidates,
      corrected: false,
    } satisfies ReviewFood;
  });
}
