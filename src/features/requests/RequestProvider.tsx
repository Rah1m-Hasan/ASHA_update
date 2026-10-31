"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useCalibrationData } from "@/features/calibration/useCalibrationData";
import { usePerceptionEvent } from "@/features/perception/PerceptionProvider";
import { usePatientProfile } from "@/features/session/usePatientProfile";
import { useSession } from "@/features/session/store";
import { speak } from "@/features/speech/speak";
import { engineModule } from "@/lib/engine/load";
import { sendRequest } from "./send";

export type Pending = { kind: string; text: string; source: string; at: number };
export type Delivery = { state: "idle" | "sending" | "sent" | "failed" | "local"; text?: string; error?: string };

type Ctx = {
  pending: Pending | null;
  delivery: Delivery;
  propose: (kind: string, text: string, source?: string) => void;
  confirm: () => Promise<void>;
  cancel: () => void;
};

const RequestContext = createContext<Ctx | null>(null);

type Guide = { confirmationMatches: (type: string, assessment: unknown, enabled?: string[]) => boolean };

/**
 * Two-step request flow: a signal or tap proposes a request, a separate confirmation sends it.
 * Mirrors the engine's RequestGate rules (cool-down, 650 ms minimum, 30 s expiry).
 */
export function RequestProvider({ children }: { children: React.ReactNode }) {
  const cred = useSession((s) => s.patient);
  const { profile } = usePatientProfile();
  const trained = useCalibrationData();
  const [pending, setPending] = useState<Pending | null>(null);
  const [delivery, setDelivery] = useState<Delivery>({ state: "idle" });
  const last = useRef(-Infinity);
  const guide = useRef<Guide | null>(null);
  const expiry = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void engineModule<Guide>("companion-guide").then((m) => (guide.current = m));
  }, []);

  const cancel = useCallback(() => {
    clearTimeout(expiry.current);
    setPending(null);
  }, []);

  const propose = useCallback(
    (kind: string, text: string, source = "touch") => {
      const t = performance.now();
      if (pending || t - last.current < 2500) return;
      const p = { kind, text, source, at: t };
      setPending(p);
      speak(`${text}. Shall I ask your caregiver?`);
      clearTimeout(expiry.current);
      expiry.current = setTimeout(() => setPending(null), 30000);
    },
    [pending],
  );

  const confirm = useCallback(async () => {
    const p = pending;
    if (!p || performance.now() - p.at < 650) return;
    clearTimeout(expiry.current);
    setPending(null);
    last.current = performance.now();
    if (!cred) {
      setDelivery({ state: "local", text: p.text });
      speak("I recognised your request on this device. Connect a caregiver to deliver it.");
      return;
    }
    setDelivery({ state: "sending", text: p.text });
    try {
      await sendRequest(cred, p.kind, p.source, p.text, true);
      setDelivery({ state: "sent", text: p.text });
      speak("Your request was sent. I’ll let you know when your caregiver acknowledges it.");
    } catch (e) {
      setDelivery({ state: "failed", text: p.text, error: (e as Error).message });
    }
  }, [pending, cred]);

  // A calibrated "yes" gesture confirms the pending request.
  usePerceptionEvent<{ type: string }>(
    "gesture",
    (e) => {
      if (guide.current?.confirmationMatches(e.type, profile?.assessment, trained?.enabled)) void confirm();
    },
    !!pending,
  );

  return <RequestContext.Provider value={{ pending, delivery, propose, confirm, cancel }}>{children}</RequestContext.Provider>;
}

export function useRequests() {
  const ctx = useContext(RequestContext);
  if (!ctx) throw new Error("useRequests must be used inside RequestProvider");
  return ctx;
}
