"use client";

import { usePathname } from "next/navigation";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { CameraView } from "@/features/perception/CameraView";
import { usePerception } from "@/features/perception/PerceptionProvider";
import { cn } from "@/lib/cn";

// Pages that already show a large camera; the dock hides its preview there.
const BIG_CAMERA = ["facespeak", "vitalsense", "posture", "calibration", "fingerspeak"];

/** Persistent camera + live signal summary at the bottom of the patient sidebar. */
export function CameraDock() {
  const pathname = usePathname();
  const { state, snapshot, stop } = usePerception();
  const showPreview = !BIG_CAMERA.some((m) => pathname.endsWith("/" + m));
  const on = state === "on";
  const signals = [
    { label: "Face", ok: !!snapshot.analysis?.valid },
    { label: snapshot.hands?.length ? `Hands ${snapshot.hands.length}` : "Hands", ok: !!snapshot.hands?.length },
    { label: "Body", ok: !!snapshot.posture?.valid },
    { label: "Pulse", ok: snapshot.pulse?.status === "good" || snapshot.pulse?.status === "fair" },
  ];

  return (
    <div className="rounded-2xl bg-wash p-3">
      {showPreview && <CameraView compact className="mb-3" />}
      <div className="flex items-center justify-between">
        <StatusPill tone={on ? "good" : state === "error" ? "alert" : "neutral"} pulse={on}>
          {on ? "Sensing live" : state === "starting" ? "Starting" : "Camera off"}
        </StatusPill>
        {on && (
          <button onClick={stop} className="text-sm font-medium text-muted hover:text-ink">
            Stop
          </button>
        )}
      </div>
      {on && (
        <ul className="mt-3 grid grid-cols-2 gap-1.5" aria-label="Signals being tracked">
          {signals.map((s) => (
            <li key={s.label} className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs", s.ok ? "bg-white text-ink" : "text-muted")}>
              <span className={cn("size-1.5 rounded-full", s.ok ? "bg-emerald-500" : "bg-line")} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Video stays on this device.</p>
    </div>
  );
}
