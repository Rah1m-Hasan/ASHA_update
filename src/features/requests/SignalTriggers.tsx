"use client";

import { useEffect, useRef } from "react";
import { useCalibrationData } from "@/features/calibration/useCalibrationData";
import { usePerception, usePerceptionEvent } from "@/features/perception/PerceptionProvider";
import { usePatientProfile } from "@/features/session/usePatientProfile";
import { useSession } from "@/features/session/store";
import { api } from "@/lib/api";
import { engineModule } from "@/lib/engine/load";
import { readLocal } from "@/lib/storage";
import type { FrameSnapshot } from "@/lib/engine/types";
import { EVENT_TEXT } from "./needs";
import { useRequests } from "./RequestProvider";

type BlinkIntentCtor = new (profile?: unknown) => { update(eye: unknown, t?: number, valid?: boolean): string | null; reset(): void };
type BlinkModule = { BlinkIntent: BlinkIntentCtor; RAPID_BLINK: string; CONFIRM_BLINK: string };

/**
 * Background wiring for the patient side (renders nothing):
 * applies saved calibration, turns a practiced triple blink or sustained cues into proposals,
 * and sends a heartbeat so the caregiver sees live status.
 */
export function SignalTriggers() {
  const { instance, state, snapshot } = usePerception();
  const { propose, pending, confirm } = useRequests();
  const { profile } = usePatientProfile();
  const trained = useCalibrationData();
  const cred = useSession((s) => s.patient);
  const blink = useRef<{ intent: InstanceType<BlinkIntentCtor>; mod: BlinkModule } | null>(null);

  // Apply saved calibration whenever the engine is (re)started.
  useEffect(() => {
    const p = instance();
    if (p && trained && state === "on") p.setCalibration(trained.baseline, trained.enabled);
  }, [instance, state, trained]);

  useEffect(() => {
    void engineModule<BlinkModule>("blink-intent").then((mod) => {
      const b = trained?.baseline as { blinkIntent?: unknown } | undefined;
      blink.current = { mod, intent: new mod.BlinkIntent(b?.blinkIntent) };
    });
  }, [trained]);

  const blinkEnabled =
    !!profile && profile.assessment.eyes !== "none" && !!trained?.enabled.includes("RAPID_BLINK_REQUEST") && !!trained?.enabled.includes("BLINK_CONFIRM");

  usePerceptionEvent<FrameSnapshot>(
    "frame",
    (s) => {
      const b = blink.current;
      if (!b || document.hidden) return;
      const signal = b.intent.update(s.analysis?.eye, s.t, s.analysis?.valid);
      if (signal === b.mod.RAPID_BLINK && !pending) propose("help", EVENT_TEXT.help, "deliberate blink");
      else if (signal === b.mod.CONFIRM_BLINK && pending) void confirm();
    },
    blinkEnabled,
  );

  // Sustained changes lead to a gentle check-in, which still needs the patient's confirmation.
  const proactive = useSession((s) => s.settings.proactive);
  const lastCue = useRef(-Infinity);
  usePerceptionEvent<string>(
    "cue",
    (cue) => {
      if (pending || performance.now() - lastCue.current < 120000) return;
      if (cue !== "posture" && cue !== "face_change") return;
      lastCue.current = performance.now();
      propose(cue, EVENT_TEXT[cue], "monitor");
    },
    proactive,
  );

  // Practised hand poses (saved in FingerSpeak) propose their request, or confirm a pending one.
  usePerceptionEvent<{ pose: string }>("hand", (h) => {
    const maps = readLocal<Record<string, { kind: string; trained: boolean }>>("handmap_" + (cred?.patientId ?? "local-demo"), {});
    const m = maps[h.pose];
    if (!m?.trained) return;
    if (pending) void confirm();
    else propose(m.kind, EVENT_TEXT[m.kind] ?? m.kind, "hand");
  });

  // Heartbeat every 15 s while a patient credential exists.
  const latest = useRef(snapshot);
  latest.current = snapshot;
  useEffect(() => {
    if (!cred) return;
    const beat = () => {
      const s = latest.current;
      void api("session", {
        cred,
        body: {
          action: "heartbeat",
          status: {
            module: "companion",
            camera: state === "on",
            face: !!s.analysis?.valid,
            hands: s.hands?.length ?? 0,
            posture: s.posture?.label ?? "",
            activity: s.activity ?? "",
            bpm: s.pulse?.bpm ?? null,
            calibrated: !!trained,
          },
        },
      }).catch(() => {});
    };
    beat();
    const id = setInterval(beat, 15000);
    return () => clearInterval(id);
  }, [cred, state, trained]);

  return null;
}
