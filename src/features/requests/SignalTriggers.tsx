"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCalibrationData } from "@/features/calibration/useCalibrationData";
import { useEyeSpeak } from "@/features/eyespeak/store";
import {
  usePerception,
  usePerceptionEvent,
} from "@/features/perception/PerceptionProvider";
import { usePatientProfile } from "@/features/session/usePatientProfile";
import { useSession } from "@/features/session/store";
import { isSpeaking, speak } from "@/features/speech/speak";
import { api } from "@/lib/api";
import { engineModule } from "@/lib/engine/load";
import { readLocal } from "@/lib/storage";
import type { FrameSnapshot } from "@/lib/engine/types";
import { EVENT_TEXT } from "./needs";
import { useRequests } from "./RequestProvider";

type BlinkIntent = {
  update(eye: unknown, t?: number, valid?: boolean): string | null;
  reset(): void;
  waitForQuestion(): void;
  questionFinished(t: number): void;
};
type BlinkModule = {
  BlinkIntent: new (profile?: unknown) => BlinkIntent;
  RAPID_BLINK: string;
  CONFIRM_BLINK: string;
};
type Guide = {
  pending: unknown;
  lastPrompt: number;
  clear(): void;
  due(t: number): boolean;
  ask(
    input: {
      assessment: unknown;
      enabled: string[];
      handMapped: boolean;
      reason: string;
    },
    t: number,
  ): string;
  accept(type: string, t: number): string | null;
};
type GuideModule = {
  CompanionGuide: new () => Guide;
  confirmationMatches(
    type: string,
    assessment: unknown,
    enabled?: string[],
  ): boolean;
};

export function SignalTriggers() {
  const { instance, state, snapshot, calibrating, exercising: workout } = usePerception();
  // EyeSpeak's calibration and board fill the screen and take answers by gaze. Check-ins and
  // face, blink or hand questions wait, so nothing talks over the board or covers it with a dialog.
  const eyes = useEyeSpeak();
  const gazeInUse = eyes.inUse || eyes.picking;
  // With the eye cursor clicking by blink, a slow blink is a click, not a request or a "yes".
  const blinkClicks = eyes.cursor && eyes.cursorClick !== "dwell";
  const exercising = workout || gazeInUse;
  const { propose, pending, confirm, confirmationReadyAt } = useRequests();
  const { profile } = usePatientProfile();
  const trained = useCalibrationData();
  const cred = useSession((s) => s.patient);
  const proactive = useSession((s) => s.settings.proactive);
  const blink = useRef<{ intent: BlinkIntent; mod: BlinkModule } | null>(null);
  const guide = useRef<{ value: Guide; mod: GuideModule } | null>(null);
  const [loaded, setLoaded] = useState(0);
  const lastCue = useRef(-Infinity);

  // Never reset the gesture engine on every frame; only on a real calibration/start change.
  useEffect(() => {
    const p = instance();
    if (p && state === "on" && !calibrating)
      p.setCalibration(trained?.baseline ?? undefined, trained?.enabled ?? []);
  }, [instance, state, trained, calibrating]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      engineModule<BlinkModule>("blink-intent"),
      engineModule<GuideModule>("companion-guide"),
    ])
      .then(([mod, guideMod]) => {
        if (!active) return;
        const b = trained?.baseline as { blinkIntent?: unknown } | undefined;
        blink.current = { mod, intent: new mod.BlinkIntent(b?.blinkIntent) };
        guide.current = { mod: guideMod, value: new guideMod.CompanionGuide() };
        setLoaded((v) => v + 1);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [trained, cred?.patientId]);

  const blinkEnabled =
    !!profile &&
    profile.assessment.eyes !== "none" &&
    !!trained?.enabled.includes("RAPID_BLINK_REQUEST") &&
    !!trained?.enabled.includes("BLINK_CONFIRM");

  // The long yes blink is armed only after this particular question has finished.
  useEffect(() => {
    const b = blink.current;
    if (!b) return;
    if (!pending || !blinkEnabled || calibrating || state !== "on")
      b.intent.reset();
    else {
      b.intent.waitForQuestion();
      if (confirmationReadyAt !== null)
        b.intent.questionFinished(confirmationReadyAt);
    }
  }, [pending, confirmationReadyAt, blinkEnabled, calibrating, state, loaded]);

  const checkIn = useCallback(
    (reason = "routine") => {
      const g = guide.current?.value;
      const now = performance.now();
      if (
        !g ||
        !profile ||
        !proactive ||
        state !== "on" ||
        calibrating ||
        exercising ||
        pending ||
        document.hidden ||
        isSpeaking()
      )
        return;
      if (!g.due(now)) return;
      const maps = readLocal<Record<string, { trained: boolean }>>(
        "handmap_" + (cred?.patientId ?? "local-demo"),
        {},
      );
      speak(
        g.ask(
          {
            assessment: profile.assessment,
            enabled: trained?.enabled ?? [],
            handMapped: Object.values(maps).some((m) => m?.trained),
            reason,
          },
          now,
        ),
      );
    },
    [profile, proactive, state, calibrating, exercising, pending, cred?.patientId, trained],
  );

  useEffect(() => {
    if (calibrating || exercising || state !== "on") {
      guide.current?.value.clear();
      if (guide.current) guide.current.value.lastPrompt = -Infinity;
      return;
    }
    checkIn("start");
    const timer = setInterval(() => checkIn(), 10000);
    return () => clearInterval(timer);
  }, [calibrating, exercising, state, checkIn, loaded]);

  usePerceptionEvent<FrameSnapshot>(
    "frame",
    (s) => {
      const b = blink.current;
      if (!b || document.hidden || calibrating || state !== "on") return;
      const signal = b.intent.update(s.analysis?.eye, s.t, s.analysis?.valid);
      if (signal === b.mod.RAPID_BLINK && !pending) {
        const selected =
          guide.current?.value.accept(signal, performance.now()) || "water";
        if (
          !propose(
            selected,
            EVENT_TEXT[selected] ?? selected,
            "deliberate blink",
          )
        )
          b.intent.reset();
      } else if (
        signal === b.mod.CONFIRM_BLINK &&
        pending &&
        (pending.source === "deliberate blink" ||
          guide.current?.mod.confirmationMatches(
            signal,
            profile?.assessment,
            trained?.enabled,
          ))
      ) {
        void confirm();
      }
    },
    blinkEnabled && !calibrating && !gazeInUse && !blinkClicks && state === "on",
  );

  // Face movements answer an offered question. Unprompted observations do not send requests.
  usePerceptionEvent<{ type: string }>(
    "gesture",
    (e) => {
      if (!trained || pending || document.hidden || isSpeaking()) return;
      const selected = guide.current?.value.accept(e.type, performance.now());
      if (selected)
        propose(selected, EVENT_TEXT[selected] ?? selected, "guided face");
      else if (e.type === "SMILE_COMPLETED") checkIn("smile");
    },
    // A smile or eyebrow raise during a Move workout is exercise, not an answer.
    !calibrating && !exercising && state === "on",
  );

  usePerceptionEvent<{ command: string }>(
    "facecommand",
    (c) => {
      if (
        c.command === "okay" &&
        !pending &&
        !guide.current?.value.pending &&
        !document.hidden &&
        !isSpeaking() &&
        trained?.enabled.includes("NOD_COMPLETED") &&
        trained.enabled.includes("SMILE_COMPLETED")
      )
        speak("I am okay, thank you.");
    },
    !calibrating && !exercising && state === "on",
  );

  // These cues are already sustained by the engine; they offer a check-in, never an automatic alert.
  usePerceptionEvent<string>(
    "cue",
    (cue) => {
      const now = performance.now();
      if (
        now - lastCue.current < 120000 ||
        !["posture", "face_change", "possible_wake"].includes(cue)
      )
        return;
      if (
        pending ||
        guide.current?.value.pending ||
        document.hidden ||
        isSpeaking()
      )
        return;
      lastCue.current = now;
      checkIn(cue === "possible_wake" ? "wake" : "change");
    },
    proactive && !calibrating && !exercising && state === "on",
  );

  usePerceptionEvent<{ pose: string }>(
    "hand",
    (h) => {
      if (document.hidden || instance()?.neuralHandActive) return;
      const maps = readLocal<
        Record<string, { kind: string; trained: boolean }>
      >("handmap_" + (cred?.patientId ?? "local-demo"), {});
      const m = maps[h.pose];
      if (!m?.trained) {
        if (h.pose === "Open palm") checkIn();
        return;
      }
      if (pending) {
        if (confirmationReadyAt !== null) void confirm();
      } else propose(m.kind, EVENT_TEXT[m.kind] ?? m.kind, "hand");
    },
    // Arm exercises show open palms; during a workout only the blink request and on-screen buttons ask for help.
    !calibrating && !exercising && state === "on",
  );

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
            camera: state === "on" && !document.hidden,
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
