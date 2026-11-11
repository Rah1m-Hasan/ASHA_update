"use client";

import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { retryUnsent } from "@/features/requests/send";
import { useRequests } from "@/features/requests/RequestProvider";
import { useSession } from "@/features/session/store";

/** Shows what happened to the last request the patient confirmed. */
export function DeliveryBanner() {
  const { delivery } = useRequests();
  const cred = useSession((s) => s.patient);
  if (delivery.state === "idle") return null;
  const map = {
    sending: { tone: "brand", text: "Sending…" },
    sent: { tone: "good", text: "Sent · waiting for your caregiver" },
    failed: { tone: "alert", text: "Not delivered" },
    local: { tone: "warn", text: "Recognised on this device only" },
  } as const;
  const m = map[delivery.state];
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-line" role="status">
      <StatusPill tone={m.tone}>{m.text}</StatusPill>
      <p className="font-medium text-ink">{delivery.text}</p>
      {delivery.state === "failed" && cred && (
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => void retryUnsent(cred)}>
          Retry
        </Button>
      )}
      {delivery.state === "local" && <p className="w-full text-sm text-muted">Link a caregiver in Settings so requests reach them.</p>}
    </div>
  );
}
