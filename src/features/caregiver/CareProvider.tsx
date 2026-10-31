"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { sessionStore, useSession } from "@/features/session/store";
import type { CareEntry, CareEvent, SessionData } from "@/features/session/types";
import { useSessionData } from "@/features/session/useSessionData";

type Ctx = {
  care: CareEntry[];
  active: CareEntry | null;
  data: SessionData | null;
  error: string | null;
  loading: boolean;
  /** Confirmed requests the caregiver hasn't acknowledged yet. */
  open: CareEvent[];
  online: boolean;
  refresh: () => Promise<void>;
  acknowledge: (eventId: string) => Promise<void>;
  select: (patientId: string) => void;
};

const CareContext = createContext<Ctx | null>(null);

/** Live view of the selected patient's care circle for the caregiver dashboard. */
export function CareProvider({ children }: { children: React.ReactNode }) {
  const care = useSession((s) => s.care);
  const activeId = useSession((s) => s.activeCareId);
  const active = care.find((c) => c.patientId === activeId) ?? care[0] ?? null;
  const { data, error, loading, refresh } = useSessionData(active, 4000);
  const received = useRef(new Set<string>());

  // Mark newly seen requests as received so the patient sees delivery progress.
  useEffect(() => {
    if (!active || !data) return;
    for (const e of data.events) {
      if (!e.confirmed || e.receipt?.receivedAt || received.current.has(e.id)) continue;
      received.current.add(e.id);
      void api("session", { cred: active, body: { action: "receive", id: e.id } }).catch(() => received.current.delete(e.id));
    }
  }, [active, data]);

  const acknowledge = useCallback(
    async (id: string) => {
      if (!active) return;
      await api("session", { cred: active, body: { action: "ack", id } });
      await refresh();
    },
    [active, refresh],
  );

  const open = useMemo(() => (data?.events ?? []).filter((e) => e.confirmed && e.kind !== "test" && !e.receipt?.acknowledgedAt), [data]);
  const online = !!data?.status && Date.now() - Date.parse(data.status.at) < 35000;

  return (
    <CareContext.Provider
      value={{ care, active, data, error, loading, open, online, refresh, acknowledge, select: sessionStore.setActiveCare }}
    >
      {children}
    </CareContext.Provider>
  );
}

export function useCare() {
  const ctx = useContext(CareContext);
  if (!ctx) throw new Error("useCare must be used inside CareProvider");
  return ctx;
}
