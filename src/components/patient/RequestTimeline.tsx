import { StatusPill } from "@/components/dashboard/StatusPill";
import { EVENT_TEXT } from "@/features/requests/needs";
import type { CareEvent } from "@/features/session/types";
import { cn } from "@/lib/cn";

const steps = ["Sent", "Received", "Acknowledged"] as const;

export function receiptStage(e: CareEvent) {
  return e.receipt?.acknowledgedAt ? 2 : e.receipt?.receivedAt ? 1 : 0;
}

/** Sent → Received → Acknowledged progress for one request. */
export function ReceiptSteps({ event }: { event: CareEvent }) {
  const stage = receiptStage(event);
  return (
    <ol className="flex items-center gap-1.5" aria-label="Delivery progress">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          {i > 0 && <span className={cn("h-px w-4", i <= stage ? "bg-brand" : "bg-line")} />}
          <span className={cn("text-xs font-medium", i <= stage ? "text-brand" : "text-muted")} aria-current={i === stage ? "step" : undefined}>
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function RequestList({ events, limit = 6 }: { events: CareEvent[]; limit?: number }) {
  const list = events.filter((e) => e.kind !== "test").slice(0, limit);
  if (!list.length) return <p className="py-6 text-center text-sm text-muted">No requests yet. Anything you send appears here with its delivery status.</p>;
  return (
    <ul className="divide-y divide-line">
      {list.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="font-medium text-ink">{e.text || EVENT_TEXT[e.kind] || e.kind}</p>
            <p className="text-xs text-muted">{new Date(e.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          {e.confirmed ? <ReceiptSteps event={e} /> : <StatusPill>Observation</StatusPill>}
        </li>
      ))}
    </ul>
  );
}
