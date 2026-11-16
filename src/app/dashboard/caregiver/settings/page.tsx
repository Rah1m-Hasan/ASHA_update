"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { useCare } from "@/features/caregiver/CareProvider";
import { enableNotifications } from "@/features/caregiver/notifications";

export default function CaregiverSettings() {
  const { active, data } = useCare();
  const [state, setState] = useState<"idle" | "busy" | "on" | string>("idle");
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Notifications" description="Get a phone notification when a request arrives. The dashboard also updates every few seconds while open.">
          {active ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={state === "busy"}
                onClick={async () => {
                  setState("busy");
                  try {
                    await enableNotifications(active, data?.vapidPublicKey ?? null);
                    setState("on");
                  } catch (e) {
                    setState((e as Error).message);
                  }
                }}
              >
                Turn on for {active.label}
              </Button>
              {state === "on" && <StatusPill tone="good">On</StatusPill>}
              {!["idle", "busy", "on"].includes(state) && <p className="w-full text-sm text-danger">{state}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">Add a patient first.</p>
          )}
        </Panel>
        <Panel title="Privacy">
          <p className="text-sm text-muted">
            Patient camera video never leaves their device. You see only the live status they share (camera on/off, posture label, pulse estimate) and the requests they confirm.
          </p>
        </Panel>
      </div>
    </>
  );
}
