"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { EXERCISES, title } from "@/features/move/catalog.js";
import { parseInvitation, readClinic, rememberAccess, savedAccess, toProgram, type ClinicAccess, type ClinicRead } from "@/features/move/clinic";
import { moveStore, useMove } from "@/features/move/store";
import { tx } from "@/features/move/ui";

export default function ClinicianPrograms() {
  const lang = useMove((s) => s.language);
  const imported = useMove((s) => s.clinicianPrograms);
  const current = useMove((s) => s.plan);
  const [access, setAccess] = useState<ClinicAccess | null>(null);
  const [invite, setInvite] = useState("");
  const [data, setData] = useState<ClinicRead | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (a: ClinicAccess) => {
    setBusy(true);
    setError("");
    try {
      setData(await readClinic(a));
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const a = savedAccess();
    if (a) {
      setAccess(a);
      void load(a);
    }
  }, [load]);

  function connect(e: React.FormEvent) {
    e.preventDefault();
    try {
      const a = parseInvitation(invite);
      rememberAccess(a);
      setAccess(a);
      setInvite("");
      void load(a);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function disconnect() {
    rememberAccess(null);
    setAccess(null);
    setData(null);
  }

  const me = data?.role === "patient" ? data.patients[0] : null;
  const moveShared = !!me?.grant?.modules.includes("move") && Date.parse(me.grant.expiresAt) > Date.now();

  return (
    <>
      <PageHeader
        title={tx(lang, "Clinician programs", "চিকিৎসকের প্রোগ্রাম")}
        description="Recovery and heart-conscious plans set by your own clinician through ASHA Clinic. The clinic server checks your invitation and your sharing consent every time."
        actions={access ? <Button variant="ghost" onClick={disconnect}>Disconnect</Button> : undefined}
      />
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {!access ? (
        <Panel className="max-w-2xl" title="Connect to your clinic" description="Paste the private invitation link your clinic gave you. It stays in this browser tab only.">
          <form onSubmit={connect} className="space-y-3">
            <label className="block text-sm text-ink">
              Private invitation link
              <input value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" spellCheck={false} className="mt-1 h-11 w-full rounded-xl bg-white px-3 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand" />
            </label>
            <Button type="submit" disabled={!invite.trim()}>
              Connect
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted">No clinic? General Move plans are for wellness only. Medical rehabilitation needs a clinician.</p>
        </Panel>
      ) : busy && !data ? (
        <p className="text-muted">Checking with your clinic…</p>
      ) : data && data.role !== "patient" ? (
        <Panel className="max-w-2xl" title={`Signed in as ${data.role} · ${data.name ?? "clinic"}`}>
          <p className="text-ink">Clinicians set Move plans in the Clinic workspace, for patients who have shared Move with them. This patient dashboard never shows other patients' data.</p>
          <a href="/everyday.html#clinic" className="mt-4 inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-white">
            Open Clinic workspace
          </a>
        </Panel>
      ) : data && me ? (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Panel title={data.name ?? "Your clinic"} action={moveShared ? <StatusPill tone="good">Move shared</StatusPill> : <StatusPill tone="warn">Move not shared</StatusPill>}>
            {!moveShared ? (
              <div className="space-y-3 text-ink">
                <p>Your clinician can only assign Move plans after you share Move with them. You can stop sharing at any time, and access ends after 30 days unless you renew it.</p>
                <a href="/everyday.html#clinic" className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-white">
                  Manage sharing in Clinic
                </a>
              </div>
            ) : me.plans.length ? (
              <ul className="space-y-4">
                {me.plans.map((p) => {
                  let program = null;
                  try {
                    program = toProgram(p, access.tenant);
                  } catch {
                    program = null;
                  }
                  const have = imported.some((x) => x.id === p.id);
                  return (
                    <li key={p.id} className="rounded-2xl bg-wash/60 p-4 ring-1 ring-line">
                      {program ? (
                        <>
                          <p className="font-medium text-ink">{program.sequence.map((s) => title(EXERCISES[s.exerciseId], lang)).join(", ")}</p>
                          <p className="text-sm text-muted">
                            {program.clinicianName} · {new Date(program.approvedAt!).toLocaleDateString()} · {program.sequence[0].targetReps} reps
                            {program.sequence[0].limits ? ` · range ${program.sequence[0].limits.start}°–${program.sequence[0].limits.target}°` : ""}
                            {program.sequence[0].side ? ` · ${program.sequence[0].side} side` : ""}
                          </p>
                          {program.notes && <p className="mt-1 text-sm text-ink">“{program.notes}”</p>}
                          <p className="mt-1 text-xs text-muted">The clinician's professional identity isn't verified by ASHA.</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {current?.id === program.id ? (
                              <StatusPill tone="good">Current plan</StatusPill>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => moveStore.set((s) => ({ plan: program, clinicianPrograms: [...s.clinicianPrograms.filter((x) => x.id !== program!.id), program!] }))}
                              >
                                Use this plan
                              </Button>
                            )}
                            {!have && current?.id !== program.id && (
                              <Button size="sm" variant="secondary" onClick={() => moveStore.set((s) => ({ clinicianPrograms: [...s.clinicianPrograms, program!] }))}>
                                Keep in My plan
                              </Button>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted">A plan here uses an exercise Move can't show yet. Ask your clinician.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted">No plans from your clinician yet.</p>
            )}
          </Panel>
          <Panel title="How clinician plans work">
            <ul className="list-disc space-y-2 pl-5 text-sm text-ink">
              <li>Only your clinician can change sets, reps or movement range.</li>
              <li>The camera uses the range your clinician set. You can always count manually.</li>
              <li>The safety check and stop rules still apply to every workout.</li>
              <li>Sharing results back to your clinician happens in the Clinic workspace, only with your consent.</li>
            </ul>
          </Panel>
        </div>
      ) : (
        <p className="text-muted">{busy ? "Checking…" : "Couldn't read your clinic. Try connecting again."}</p>
      )}
    </>
  );
}
