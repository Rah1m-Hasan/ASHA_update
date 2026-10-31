"use client";

import { PatientSwitcher } from "@/components/caregiver/PatientSwitcher";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { CareProvider, useCare } from "@/features/caregiver/CareProvider";

function Frame({ children }: { children: React.ReactNode }) {
  const { open, active, online } = useCare();
  return (
    <DashboardShell
      role="caregiver"
      badges={{ requests: open.length }}
      sidebarFooter={<PatientSwitcher />}
      topbarExtra={active ? <StatusPill tone={online ? "good" : "neutral"}>{online ? `${active.label} online` : `${active.label} not active`}</StatusPill> : null}
    >
      {children}
    </DashboardShell>
  );
}

export default function CaregiverLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareProvider>
      <Frame>{children}</Frame>
    </CareProvider>
  );
}
