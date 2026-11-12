"use client";

import { useState } from "react";
import { AssessmentFields, SupportFields } from "@/components/caregiver/AssessmentForm";
import { CopyLink } from "@/components/caregiver/CopyLink";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EMPTY_ASSESSMENT } from "@/features/caregiver/assessment";
import { createCareCircle } from "@/features/session/actions";
import type { SupportContext } from "@/features/session/types";
import type { Assessment } from "@/lib/engine/types";
import { cn } from "@/lib/cn";

const STEPS = ["About", "Abilities", "Share"];

export default function NewPatientPage() {
  const [step, setStep] = useState(0);
  const [label, setLabel] = useState("");
  const [support, setSupport] = useState<SupportContext>({ categories: [], goals: [], note: "" });
  const [assessment, setAssessment] = useState<Assessment>(EMPTY_ASSESSMENT);
  const [thisDevice, setThisDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ patientId: string; patientToken: string; caregiverToken: string } | null>(null);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const d = await createCareCircle({ label: label.trim() || "Patient", assessment, supportContext: support, as: thisDevice ? "both" : "caregiver" });
      setCreated(d);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Add a patient" description="Creates a private care circle. Links expire after 7 days of setup and can be renewed." />
      <ol className="mb-6 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium", i === step ? "bg-brand text-on-brand" : i < step ? "bg-brand-soft text-brand" : "bg-surface text-muted ring-1 ring-line")}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div className="max-w-3xl">
        {step === 0 && (
          <Panel>
            <label className="block text-sm font-medium text-ink">
              Nickname
              <input
                value={label}
                maxLength={40}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="A nickname, not a full medical identity"
                className="mt-1 h-12 w-full rounded-xl border border-line px-4 text-lg focus:border-brand focus:outline-none"
              />
            </label>
            <div className="mt-6">
              <SupportFields value={support} onChange={setSupport} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setStep(1)}>Continue</Button>
            </div>
          </Panel>
        )}

        {step === 1 && (
          <Panel title="What can they comfortably do?" description="Choose what works today. You can change this later.">
            <AssessmentFields value={assessment} onChange={setAssessment} />
            <label className="mt-6 flex items-start gap-3 rounded-xl bg-wash p-3 text-ink">
              <input type="checkbox" checked={thisDevice} onChange={(e) => setThisDevice(e.target.checked)} className="mt-1 size-4 accent-brand" />
              <span>
                The patient will use this device too
                <span className="block text-sm text-muted">Links the patient side here, so no patient link is needed.</span>
              </span>
            </label>
            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={create} disabled={busy}>
                {busy ? "Creating…" : "Create care circle"}
              </Button>
            </div>
          </Panel>
        )}

        {step === 2 && created && (
          <Panel title="Care circle ready" description="Share the patient link with the patient’s device. Keep the caregiver link private.">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-wash p-4">
                <div>
                  <p className="font-medium text-ink">Patient link</p>
                  <p className="text-sm text-muted">{thisDevice ? "Already linked on this device." : "Open on the patient’s phone or tablet."}</p>
                </div>
                <CopyLink role="patient" patientId={created.patientId} token={created.patientToken} label="Copy patient link" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-wash p-4">
                <div>
                  <p className="font-medium text-ink">Caregiver link</p>
                  <p className="text-sm text-muted">For another caregiver’s device.</p>
                </div>
                <CopyLink role="caregiver" patientId={created.patientId} token={created.caregiverToken} label="Copy caregiver link" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <ButtonLink href="/dashboard/caregiver">Go to overview</ButtonLink>
              {thisDevice && (
                <ButtonLink href="/dashboard/patient" variant="secondary">
                  Open patient view
                </ButtonLink>
              )}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
