"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type Credential } from "@/lib/api";
import type { SessionData } from "./types";

/** Polls a care circle with the given credential. */
export function useSessionData(cred: Credential | null | undefined, intervalMs = 5000) {
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!cred);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!cred || busy.current) return;
    busy.current = true;
    try {
      const d = await api<SessionData>("session", { cred });
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "This private link has expired or is no longer valid." : (e as Error).message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cred]);

  useEffect(() => {
    if (!cred) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
    const id = setInterval(() => {
      if (!document.hidden) void refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [cred, intervalMs, refresh]);

  return { data, error, loading, refresh };
}
