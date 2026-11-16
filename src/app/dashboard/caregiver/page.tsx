"use client";

import Link from "next/link";
import { LiveStatus } from "@/components/caregiver/LiveStatus";
import { NoPatient } from "@/components/caregiver/NoPatient";
import { RequestCard } from "@/components/caregiver/RequestCard";
import { CopyLink } from "@/components/caregiver/CopyLink";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { CheckIcon } from "@/components/ui/icons";
import { useCare } from "@/features/caregiver/CareProvider";

export default function CaregiverOverview() {
  const { active, data, error, open, online, acknowledge } = useCare();
  if (!active) return <NoPatient />;
  const recent = (data?.events ?? []).filter((e) => e.kind !== "test").slice(0, 6);

  return (
    <>
      <PageHeader
        title={data?.profile.label ?? active.label}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={online ? "good" : "neutral"} pulse={online}>
              {online ? "Online now" : "Not active"}
            </StatusPill>
            {error && <span className="text-danger">{error}</span>}
          </span>
        }
        actions={
          <>
            {active.patientToken && <CopyLink role="patient" patientId={active.patientId} token={active.patientToken} label="Copy patient link" />}
            <Link href={`/dashboard/caregiver/patients/${active.patientId}`} className="inline-flex h-9 items-center rounded-full bg-brand-soft px-3 text-sm font-medium text-brand hover:bg-brand-mint">
              Patient profile
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_minmax(0,1fr)]">
        <Panel title="Needs your response" description={open.length ? `${open.length} waiting` : undefined}>
          {open.length ? (
            <div className="space-y-3">
              {open.map((e) => (
                <RequestCard key={e.id} event={e} onAcknowledge={acknowledge} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CheckIcon />} title="All caught up">
              New requests appear here and, if notifications are on, on your phone.
            </EmptyState>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Live status">
            <LiveStatus status={data?.status ?? null} online={online} />
          </Panel>
          <Panel title="Recent activity" action={<Link href="/dashboard/caregiver/requests" className="text-sm font-medium text-brand">All requests</Link>}>
            {recent.length ? (
              <ul className="divide-y divide-line">
                {recent.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-ink">{e.text}</span>
                    <span className="shrink-0 text-muted">{new Date(e.at).toLocaleTimeString([], { timeStyle: "short" })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
