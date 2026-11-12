"use client";

import { useState } from "react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { ReceiptSteps } from "@/components/patient/RequestTimeline";
import { Button } from "@/components/ui/Button";
import { EVENT_TEXT } from "@/features/requests/needs";
import type { CareEvent } from "@/features/session/types";
import { cn } from "@/lib/cn";

const SOURCE: Record<string, string> = {
  touch: "Tapped",
  face: "Face signal",
  "deliberate blink": "Blink signal",
  hand: "Hand gesture",
  speech: "Speech",
  monitor: "Observed change",
  asha: "Via Asha chat",
};

function ago(iso: string) {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function RequestCard({ event, onAcknowledge }: { event: CareEvent; onAcknowledge?: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const done = !!event.receipt?.acknowledgedAt;
  return (
    <article className={cn("flex flex-wrap items-center gap-4 rounded-2xl p-4 ring-1", done ? "bg-surface ring-line" : "bg-surface ring-2 ring-brand")}>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-ink">{event.text || EVENT_TEXT[event.kind] || event.kind}</p>
        <p className="mt-0.5 text-sm text-muted">
          {SOURCE[event.source] ?? event.source} · {ago(event.at)}
        </p>
        <div className="mt-2">{event.confirmed ? <ReceiptSteps event={event} /> : <StatusPill>Observation only</StatusPill>}</div>
      </div>
      {event.confirmed &&
        (done ? (
          <StatusPill tone="good">Acknowledged</StatusPill>
        ) : (
          onAcknowledge && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onAcknowledge(event.id);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Sending…" : "I’m on my way"}
            </Button>
          )
        ))}
    </article>
  );
}
