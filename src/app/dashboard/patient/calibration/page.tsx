"use client";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { saveCalibration, useCalibrationData } from "@/features/calibration/useCalibrationData";
import { useGuidedCalibration } from "@/features/calibration/useGuidedCalibration";
import { CameraView } from "@/features/perception/CameraView";
import { useActiveModule } from "@/features/perception/PerceptionProvider";
import { useSession } from "@/features/session/store";
import { usePatientProfile } from "@/features/session/usePatientProfile";

const SIGNAL_NAMES: Record<string, string> = {
  RAPID_BLINK_REQUEST: "Triple blink — ask for attention",
  BLINK_CONFIRM: "Long blink — yes",
  SMILE_COMPLETED: "Smile",
  PUCKER_COMPLETED: "Lip pucker",
  NOD_COMPLETED: "Nod",
  LEFT_TURN_COMPLETED: "Turn left",
  RIGHT_TURN_COMPLETED: "Turn right",
};

export default function CalibrationPage() {
  useActiveModule("facespeak");
  const { profile } = usePatientProfile();
  const trained = useCalibrationData();
  const id = useSession((s) => s.patient?.patientId ?? "local-demo");
  const { view, finished, begin, skip, cancel } = useGuidedCalibration();

  return (
    <>
      <PageHeader title="Calibration" description="Asha learns your own movements from real samples. Only movements you complete are turned on." />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <CameraView />
          {view ? (
            <Panel>
              <p className="text-sm font-medium text-brand">
                Step {view.index + 1} of {view.total}
              </p>
              <p className="mt-2 text-xl leading-snug font-medium text-ink">{view.label}</p>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-wash" role="progressbar" aria-valuenow={Math.round(view.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-brand transition-[width]" style={{ width: `${view.progress * 100}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted" aria-live="polite">
                {view.message || "Watching…"}
              </p>
              <div className="mt-4 flex gap-2">
                {view.index > 0 && (
                  <Button variant="secondary" size="sm" onClick={skip}>
                    Skip this movement
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={cancel}>
                  Stop
                </Button>
              </div>
            </Panel>
          ) : (
            <Panel>
              <p className="text-ink">Sit comfortably facing the camera in steady light. Asha will speak each step.</p>
              <Button className="mt-4" onClick={() => profile && void begin(profile.assessment)} disabled={!profile}>
                {trained ? "Calibrate again" : "Start calibration"}
              </Button>
              {finished && <p className="mt-3 text-sm text-good-text">Saved. {finished.length} signals turned on.</p>}
            </Panel>
          )}
        </div>

        <Panel
          title="Your signals"
          action={trained ? <StatusPill tone="good">Saved {new Date(trained.savedAt).toLocaleDateString()}</StatusPill> : <StatusPill tone="warn">Not set</StatusPill>}
        >
          {trained?.enabled.length ? (
            <ul className="space-y-2">
              {trained.enabled.map((e) => (
                <li key={e} className="flex items-center gap-2 text-ink">
                  <CheckIcon size={16} className="text-brand" />
                  {SIGNAL_NAMES[e] ?? e}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No signals yet. Until you calibrate, use the buttons on screen.</p>
          )}
          {trained && (
            <button onClick={() => saveCalibration(id, null)} className="mt-5 text-sm font-medium text-muted hover:text-danger-text">
              Clear calibration
            </button>
          )}
        </Panel>
      </div>
    </>
  );
}
