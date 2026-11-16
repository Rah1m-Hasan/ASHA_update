"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AssessmentFields, SupportFields } from "@/components/caregiver/AssessmentForm";
import { CopyLink } from "@/components/caregiver/CopyLink";
import { LiveStatus } from "@/components/caregiver/LiveStatus";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Button } from "@/components/ui/Button";
import { useCare } from "@/features/caregiver/CareProvider";
import { sessionStore } from "@/features/session/store";
import type { SupportContext } from "@/features/session/types";
import { api } from "@/lib/api";
import type { Assessment } from "@/lib/engine/types";

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { care, active, data, online, select, refresh } = useCare();
  const entry = care.find((c) => c.patientId === id);
  const [label, setLabel] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [support, setSupport] = useState<SupportContext | null>(null);
  const [saved, setSaved] = useState("");
  // A failed save used to be an unhandled rejection: nothing on screen
  // changed and the caregiver was left thinking it had worked.
  const [error, setError] = useState("");

  useEffect(() => {
    if (entry && active?.patientId !== id) select(id);
  }, [entry, active, id, select]);

  const profile = active?.patientId === id ? data?.profile : undefined;
  useEffect(() => {
    if (!profile) return;
    setLabel(profile.label);
    setAssessment(profile.assessment);
    setSupport(profile.supportContext);
  }, [profile]);

  if (!entry)
    return (
      <Panel titleLevel={1} title="Patient not found">
        <p className="text-muted">This patient isn’t linked on this device.</p>
      </Panel>
    );

  async function save() {
    if (!entry || !assessment || !support) return;
    setError("");
    try {
      await api("session", { cred: entry, body: { action: "update", label, assessment, supportContext: support, voice: profile?.voice ?? {} } });
      sessionStore.upsertCare({ ...entry, label });
      setSaved("Saved");
      await refresh();
    } catch {
      setError("Couldn't save. Check the connection and try again.");
    }
  }

  async function remove() {
    if (!entry || !confirm(`Delete ${entry.label}'s care circle for everyone? This can't be undone.`)) return;
    setError("");
    try {
      await api("session", { cred: entry, body: { action: "delete", confirm: "DELETE" } });
      sessionStore.removeCare(entry.patientId);
      router.push("/dashboard/caregiver/patients");
    } catch {
      setError("Couldn't delete the care circle. Nothing was deleted. Try again.");
    }
  }

  return (
    <>
      <PageHeader
        title={profile?.label ?? entry.label}
        description={profile?.expiresAt ? `Care circle active until ${new Date(profile.expiresAt).toLocaleDateString()}` : undefined}
        actions={
          <>
            {entry.patientToken && <CopyLink role="patient" patientId={entry.patientId} token={entry.patientToken} label="Copy patient link" />}
            <CopyLink role="caregiver" patientId={entry.patientId} token={entry.token} label="Copy caregiver link" />
          </>
        }
      />
      {error && (
        <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger ring-1 ring-danger-line" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_minmax(0,1fr)]">
        <Panel title="Abilities" description="Guides suggestions only">
          {assessment ? <AssessmentFields value={assessment} onChange={(a) => (setAssessment(a), setSaved(""))} /> : <p className="text-muted">Loading…</p>}
        </Panel>
        <div className="space-y-6">
          <Panel title="Live status">
            <LiveStatus status={data?.status ?? null} online={online} />
          </Panel>
          <Panel title="About">
            <label className="block text-sm font-medium text-ink">
              Nickname
              <input value={label} maxLength={40} onChange={(e) => (setLabel(e.target.value), setSaved(""))} className="mt-1 h-11 w-full rounded-xl border border-line px-3 focus:border-brand focus:outline-none" />
            </label>
            {support && (
              <div className="mt-5">
                <SupportFields value={support} onChange={(s) => (setSupport(s), setSaved(""))} />
              </div>
            )}
          </Panel>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={!assessment}>
              Save changes
            </Button>
            {saved && <span className="text-sm text-good">{saved}</span>}
          </div>
          <Panel title="Remove">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => (sessionStore.removeCare(entry.patientId), router.push("/dashboard/caregiver/patients"))}>
                Remove from this device
              </Button>
              <button onClick={remove} className="h-9 rounded-full px-3 text-sm font-medium text-danger hover:bg-danger-soft">
                Delete care circle
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
