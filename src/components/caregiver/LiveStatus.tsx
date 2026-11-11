import { Stat } from "@/components/dashboard/Stat";
import type { PatientStatus } from "@/features/session/types";

const MODULE: Record<string, string> = {
  companion: "Home",
  facespeak: "FaceSpeak",
  fingerspeak: "FingerSpeak",
  senseassist: "SenseAssist",
  vitalsense: "VitalSense",
  posture: "Posture",
};

export function LiveStatus({ status, online }: { status: PatientStatus | null; online: boolean }) {
  if (!status) return <p className="text-sm text-muted">Waiting for the patient’s device to connect.</p>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Camera" value={status.camera && online ? "On" : "Off"} />
        <Stat label="Face" value={status.face && online ? "Tracked" : "—"} />
        <Stat label="Posture" value={(online && status.posture) || "—"} />
        <Stat label="Pulse estimate" value={online && status.bpm ? status.bpm : "—"} unit={online && status.bpm ? "bpm" : undefined} hint="Camera estimate" />
      </div>
      <p className="mt-3 text-xs text-muted">
        Last update {new Date(status.at).toLocaleTimeString([], { timeStyle: "short" })} · {MODULE[status.module] ?? status.module} ·{" "}
        {status.calibrated ? "calibrated" : "not calibrated"}
      </p>
    </>
  );
}
