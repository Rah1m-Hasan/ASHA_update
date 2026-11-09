"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { QuickGestures } from "@/components/patient/QuickGestures";
import { CameraView } from "@/features/perception/CameraView";
import {
  useActiveModule,
  usePerception,
  usePerceptionEvent,
} from "@/features/perception/PerceptionProvider";
import { useRequests } from "@/features/requests/RequestProvider";
import { useSession } from "@/features/session/store";
import { speak } from "@/features/speech/speak";

type StudioWindow = Window & {
  ashaSharedFrame?: (
    result: unknown,
    stream: MediaStream | undefined,
    t: number,
  ) => void;
  ashaSetTheme?: (t: string) => void;
};

export default function FingerSpeakPage() {
  useActiveModule("fingerspeak");
  const router = useRouter();
  const { snapshot, instance, start, state } = usePerception();
  const { propose, pending, confirm, cancel } = useRequests();
  const id = useSession((s) => s.patient?.patientId ?? "local");
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(900);

  // Feed the shared camera's hand results into the full FingerSpeak studio.
  usePerceptionEvent<{ result: unknown; t: number }>("handframe", (d) => {
    (frame.current?.contentWindow as StudioWindow | null)?.ashaSharedFrame?.(
      d.result,
      instance()?.stream,
      d.t,
    );
  });

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (
        e.origin !== location.origin ||
        e.source !== frame.current?.contentWindow
      )
        return;
      const d = e.data || {};
      if (d.type === "asha-hand-ready") {
        (e.source as StudioWindow).ashaSetTheme?.("light");
        setReady(true);
      }
      if (d.type === "asha-hand-height" && Number.isFinite(d.height))
        setHeight(Math.min(12000, Math.max(700, d.height)));
      if (d.type === "asha-hand-start" && state !== "on") void start();
      if (d.type === "asha-hand-speak")
        speak(String(d.text || "").slice(0, 250));
      if (d.type === "asha-hand-live") {
        const p = instance();
        if (p) {
          p.neuralHandActive = !!d.enabled;
          p.setActiveModule("fingerspeak");
        }
      }
      if (d.type === "asha-hand-open-face")
        router.push("/dashboard/patient/facespeak");
      if (d.type === "asha-hand-phrase") {
        const phrase = String(d.text || "")
          .trim()
          .slice(0, 250);
        if (!phrase) return;
        if (pending && /^(yes|okay|ok)[.!\s]*$/i.test(phrase)) void confirm();
        else if (pending && /^no[.!\s]*$/i.test(phrase)) cancel();
        else propose("message", phrase, "hand");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [cancel, confirm, instance, pending, propose, router, start, state]);

  const hands = snapshot.hands ?? [];

  return (
    <>
      <PageHeader
        title="FingerSpeak"
        description="Record your own gestures, train a personal model and speak phrases with your hands."
        actions={
          <a
            href="/assistive.html?module=fingerspeak"
            className="inline-flex min-h-9 items-center rounded-full bg-brand-soft px-3 py-2 text-sm font-medium text-brand hover:bg-brand-mint"
          >
            Full FingerSpeak studio ↗
          </a>
        }
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3">
          <CameraView compact />
          <div className="flex flex-wrap gap-2" aria-live="polite">
            {hands.length ? (
              hands.map((h) => (
                <StatusPill key={h.id} tone="good">
                  {h.label}: {h.pose}
                </StatusPill>
              ))
            ) : (
              <StatusPill>
                {state === "on" ? "Show one or two hands" : "Camera off"}
              </StatusPill>
            )}
          </div>
        </div>
        <QuickGestures />
      </div>

      <Panel
        title="Gesture studio"
        description="Calibration, phrase training, evaluation and live speaking"
        bodyClassName="p-0"
      >
        {!ready && (
          <p className="p-5 text-sm text-muted">
            Loading the FingerSpeak studio…
          </p>
        )}
        <iframe
          ref={frame}
          title="FingerSpeak gesture studio"
          src={`/neuroface/fingerspeak.html?embedded=1&profile=${encodeURIComponent(id)}`}
          allow="camera 'none'; microphone 'none'"
          className="w-full rounded-b-2xl"
          style={{ height, visibility: ready ? "visible" : "hidden" }}
        />
      </Panel>
    </>
  );
}
