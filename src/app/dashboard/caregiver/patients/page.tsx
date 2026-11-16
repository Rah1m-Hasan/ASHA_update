"use client";

import Link from "next/link";
import { NoPatient } from "@/components/caregiver/NoPatient";
import { LinkConnect } from "@/components/dashboard/LinkConnect";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { ChevronIcon } from "@/components/ui/icons";
import { useCare } from "@/features/caregiver/CareProvider";

export default function PatientsPage() {
  const { care, active, select } = useCare();
  if (!care.length) return <NoPatient />;
  return (
    <>
      <PageHeader title="Patients" description="Everyone in your care circles on this device." actions={<ButtonLink href="/dashboard/caregiver/patients/new" size="sm">Add patient</ButtonLink>} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_minmax(0,1fr)]">
        <Panel bodyClassName="p-2">
          <ul>
            {care.map((c) => (
              <li key={c.patientId}>
                <Link
                  href={`/dashboard/caregiver/patients/${c.patientId}`}
                  onClick={() => select(c.patientId)}
                  className="flex items-center gap-4 rounded-xl p-3 hover:bg-wash"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-brand-soft font-semibold text-brand">{c.label.slice(0, 1).toUpperCase()}</span>
                  <span className="flex-1">
                    <span className="block font-medium text-ink">{c.label}</span>
                    <span className="text-sm text-muted">ID ···{c.patientId.slice(-8)}</span>
                  </span>
                  {c.patientId === active?.patientId && <StatusPill tone="brand">Viewing</StatusPill>}
                  <ChevronIcon size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Join with a link" description="Paste a caregiver link someone shared with you.">
          <LinkConnect />
        </Panel>
      </div>
    </>
  );
}
