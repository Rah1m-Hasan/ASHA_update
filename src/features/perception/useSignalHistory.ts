"use client";

import { useEffect, useRef, useState } from "react";
import type { FrameSnapshot } from "@/lib/engine/types";
import { usePerception } from "./PerceptionProvider";

/** Keeps the last `size` values of a reading from the (throttled) live snapshot. */
export function useSignalHistory(pick: (s: FrameSnapshot) => number | null | undefined, size = 90) {
  const { snapshot } = usePerception();
  const buf = useRef<number[]>([]);
  const [values, setValues] = useState<number[]>([]);
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    if (snapshot.t === undefined) return;
    const v = pickRef.current(snapshot);
    if (v == null || !Number.isFinite(v)) return;
    buf.current = [...buf.current, v].slice(-size);
    setValues(buf.current);
  }, [snapshot, size]);
  return values;
}
