"use client";

import { useState } from "react";
import { NoPatient } from "@/components/caregiver/NoPatient";
import { RequestCard } from "@/components/caregiver/RequestCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { InboxIcon } from "@/components/ui/icons";
import { useCare } from "@/features/caregiver/CareProvider";
import { cn } from "@/lib/cn";

const FILTERS = [
  { id: "open", label: "Needs response" },
  { id: "all", label: "All" },
  { id: "observations", label: "Observations" },
] as const;

export default function RequestsPage() {
  const { active, data, open, acknowledge } = useCare();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  if (!active) return <NoPatient />;
  const all = (data?.events ?? []).filter((e) => e.kind !== "test");
  const list = filter === "open" ? open : filter === "observations" ? all.filter((e) => !e.confirmed) : all;

  return (
    <>
      <PageHeader title="Requests" description={`From ${data?.profile.label ?? active.label}. Acknowledging lets them know you’re coming.`} />
      <div role="tablist" aria-label="Filter requests" className="mb-5 inline-flex rounded-xl bg-white p-1 ring-1 ring-line">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn("h-9 rounded-lg px-4 text-sm font-medium", filter === f.id ? "bg-brand text-white" : "text-ink hover:bg-wash")}
          >
            {f.label}
            {f.id === "open" && open.length > 0 && ` (${open.length})`}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="space-y-3">
          {list.map((e) => (
            <RequestCard key={e.id} event={e} onAcknowledge={acknowledge} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-line">
          <EmptyState icon={<InboxIcon />} title={filter === "open" ? "Nothing waiting" : "No requests yet"} />
        </div>
      )}
    </>
  );
}
