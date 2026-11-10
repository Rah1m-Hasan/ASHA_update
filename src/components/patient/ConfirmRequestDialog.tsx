"use client";

import { Dialog } from "@/components/dashboard/Dialog";
import { Button } from "@/components/ui/Button";
import { useEyeSpeak } from "@/features/eyespeak/store";
import { useRequests } from "@/features/requests/RequestProvider";

/** The separate confirmation step every request goes through before it is sent. */
export function ConfirmRequestDialog() {
  const { pending, confirm, cancel, repeat, confirmationHint } = useRequests();
  // The EyeSpeak board asks the same question itself, with two halves of the screen chosen by gaze.
  const { boardOpen } = useEyeSpeak();
  const byGaze = boardOpen && pending?.source === "eyespeak";
  return (
    <Dialog open={!!pending && !byGaze} onClose={cancel} title="Confirm request">
      {pending && (
        <div className="p-7 text-center">
          <p className="text-sm text-muted">Send this to your caregiver?</p>
          <p className="mt-3 text-[28px] leading-tight font-semibold text-ink">
            {pending.text}
          </p>
          <p className="mt-3 text-sm text-muted">{confirmationHint}</p>
          <div className="mt-7 grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              className="h-14 text-lg"
              onClick={cancel}
            >
              No
            </Button>
            <Button className="h-14 text-lg" onClick={() => void confirm()}>
              Yes, send
            </Button>
          </div>
          <button
            onClick={repeat}
            className="mt-4 text-sm font-medium text-brand"
          >
            Repeat the question
          </button>
        </div>
      )}
    </Dialog>
  );
}
