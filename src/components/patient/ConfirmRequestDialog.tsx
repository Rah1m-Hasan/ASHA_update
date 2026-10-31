"use client";

import { Dialog } from "@/components/dashboard/Dialog";
import { Button } from "@/components/ui/Button";
import { useCalibrationData } from "@/features/calibration/useCalibrationData";
import { useRequests } from "@/features/requests/RequestProvider";
import { usePatientProfile } from "@/features/session/usePatientProfile";
import { speak } from "@/features/speech/speak";

function hint(enabled: string[] = [], head: boolean) {
  if (head && enabled.includes("NOD_COMPLETED")) return "Nod to say yes, or tap a button.";
  if (enabled.includes("SMILE_COMPLETED")) return "Smile to say yes, or tap a button.";
  if (enabled.includes("BLINK_CONFIRM")) return "Make your practised yes blink, or tap a button.";
  return "Tap Yes to send, or No to cancel.";
}

/** The separate confirmation step every request goes through before it is sent. */
export function ConfirmRequestDialog() {
  const { pending, confirm, cancel } = useRequests();
  const trained = useCalibrationData();
  const { profile } = usePatientProfile();
  return (
    <Dialog open={!!pending} onClose={cancel} title="Confirm request">
      {pending && (
        <div className="p-7 text-center">
          <p className="text-sm text-muted">Send this to your caregiver?</p>
          <p className="mt-3 text-[28px] leading-tight font-semibold text-ink">{pending.text}</p>
          <p className="mt-3 text-sm text-muted">{hint(trained?.enabled, profile?.assessment.head !== "none")}</p>
          <div className="mt-7 grid grid-cols-2 gap-3">
            <Button variant="secondary" className="h-14 text-lg" onClick={cancel}>
              No
            </Button>
            <Button className="h-14 text-lg" onClick={() => void confirm()}>
              Yes, send
            </Button>
          </div>
          <button onClick={() => speak(`${pending.text}. Shall I ask your caregiver?`)} className="mt-4 text-sm font-medium text-brand">
            Repeat the question
          </button>
        </div>
      )}
    </Dialog>
  );
}
