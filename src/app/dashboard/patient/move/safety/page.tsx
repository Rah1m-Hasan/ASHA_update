"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Switch } from "@/components/dashboard/Switch";
import { Button } from "@/components/ui/Button";
import { CATALOG_VERSION } from "@/features/move/catalog.js";
import { DETECTOR_VERSION } from "@/features/move/detectors.js";
import { attestAssessment, attestAvailableAt, clearanceValid, lockoutActive, MOVE_SAFETY_VERSION, recordClearance, SESSION_SYMPTOMS } from "@/features/move/safety.js";
import { moveStore, useMove, type Lockout } from "@/features/move/store";
import { Choice, tx, useNow } from "@/features/move/ui";

// Measured from the pinned files in public/ (bytes), not estimated.
const MODELS = [
  { name: "Pose Landmarker Lite (body)", file: "/models/pose_landmarker_lite.task", bytes: 5777746 },
  { name: "Face Landmarker (face, blendshapes)", file: "/neuroface/models/face_landmarker.task", bytes: 3758596 },
];

const field = "mt-1 h-11 w-full rounded-xl bg-white px-3 text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand";

export default function MoveSafety() {
  const s = useMove((x) => x);
  const lang = s.language;
  const now = useNow(15000);
  const [clear, setClear] = useState({ clinicianName: "", date: "", limits: "" });
  const [attest, setAttest] = useState({ clinicianName: "", confirmed: false });
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const locked = lockoutActive(s.lockout, now);

  function saveClearance(e: React.FormEvent) {
    e.preventDefault();
    try {
      moveStore.set({ clearance: recordClearance({ ...clear, scope: "general" }) });
      setMessage("Clearance recorded. It is labelled as self-reported.");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  function submitAttestation(e: React.FormEvent) {
    e.preventDefault();
    try {
      moveStore.set({ lockout: attestAssessment(s.lockout, attest) as Lockout });
      setMessage("Recorded. Move is available again. Stop at once if any warning sign returns.");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  function download() {
    const blob = new Blob([moveStore.export()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `asha-move-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeader title={tx(lang, "Settings & safety", "সেটিংস ও নিরাপত্তা")} description="How Move works, what it keeps, and the rules that stop a workout." />
      {message && (
        <p role="status" className="mb-4 rounded-xl bg-brand-soft p-3 text-sm text-ink">
          {message}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={tx(lang, "Language and voice", "ভাষা ও কণ্ঠ")}>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Language">
            <Choice selected={lang === "en"} onClick={() => moveStore.set({ language: "en" })} className="text-center">
              English
            </Choice>
            <Choice selected={lang === "bn"} onClick={() => moveStore.set({ language: "bn" })} className="text-center">
              বাংলা
            </Choice>
          </div>
          <Switch checked={s.voice} onChange={(v) => moveStore.set({ voice: v })} label="Spoken prompts" description="Counts, rest timers and warnings are read aloud. On-screen text always shows them too." />
        </Panel>

        <Panel title="Camera" description="Video is processed on this device. It is never uploaded or recorded. Only counts are kept.">
          <Switch
            checked={s.cameraConsent}
            onChange={(v) =>
              moveStore.set((x) => ({ cameraConsent: v, consentAudit: [...x.consentAudit, { at: new Date().toISOString(), event: v ? "camera_on_device_granted" : "camera_revoked" }] }))
            }
            label="Use the camera to count exercises"
            description="Off means workouts start in manual mode. You can still choose per workout."
          />
          <p className="mt-2 text-sm text-muted">During Move, body tracking runs about 20 times a second. On older phones, manual mode saves battery.</p>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {MODELS.map((m) => (
              <li key={m.file}>
                {m.name}: {(m.bytes / 1048576).toFixed(1)} MB, on-device
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Catalog {CATALOG_VERSION} · {DETECTOR_VERSION} · {MOVE_SAFETY_VERSION}. Detectors are demo-level: tested on synthetic movements, not yet against reference video or clinically validated.
          </p>
        </Panel>

        <Panel title={tx(lang, "When to stop", "কখন থামবেন")} description="These rules run on this device and decide on their own. No AI answer can override them.">
          <ul className="space-y-2">
            {SESSION_SYMPTOMS.map((x: { id: string; en: string; bn: string; action: string }) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink">{tx(lang, x.en, x.bn)}</span>
                <StatusPill tone={x.action === "emergency" ? "alert" : x.action === "end" ? "neutral" : "warn"}>
                  {x.action === "emergency" ? "Stop, urgent help, 12-hour pause" : x.action === "stop_rest" ? "Stop and rest, 15-minute pause" : x.action === "stop_exercise" ? "Stop that exercise" : "End gently"}
                </StatusPill>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">Having a heart condition doesn't mean you can't exercise. It means your plan should come from your clinician, and warning signs always mean stop.</p>
        </Panel>

        <Panel title="Clinician clearance" description="Needed if you have a heart condition, were told to limit exercise, or recently had surgery, a fall, an injury or a birth." className="scroll-mt-24">
          <div id="clearance" />
          {s.clearance && clearanceValid(s.clearance) ? (
            <div className="space-y-2">
              <p className="text-ink">
                Cleared by <strong>{s.clearance.clinicianName}</strong> on {new Date(s.clearance.date).toLocaleDateString()}.
              </p>
              {s.clearance.limits && <p className="text-sm text-muted">Limits: {s.clearance.limits}</p>}
              <p className="text-xs text-muted">Self-reported. ASHA can't verify it. Heart-conscious workouts use longer warm-ups and beginner levels.</p>
              <Button size="sm" variant="ghost" onClick={() => moveStore.set({ clearance: null })}>
                Remove
              </Button>
            </div>
          ) : (
            <form onSubmit={saveClearance} className="space-y-3">
              <label className="block text-sm text-ink">
                Clinician's name
                <input className={field} value={clear.clinicianName} onChange={(e) => setClear({ ...clear, clinicianName: e.target.value })} required />
              </label>
              <label className="block text-sm text-ink">
                Date they cleared you
                <input type="date" className={field} value={clear.date} onChange={(e) => setClear({ ...clear, date: e.target.value })} required />
              </label>
              <label className="block text-sm text-ink">
                Any limits they gave (optional)
                <input className={field} value={clear.limits} onChange={(e) => setClear({ ...clear, limits: e.target.value })} placeholder="e.g. walking and light strength only" />
              </label>
              <Button type="submit" size="sm">
                Record clearance
              </Button>
            </form>
          )}
        </Panel>

        <Panel title="Safety pause" className="scroll-mt-24">
          <div id="lockout" />
          {locked && s.lockout ? (
            <div className="space-y-3">
              <p className="text-ink">
                {s.lockout.kind === "emergency" ? "Move is paused after warning symptoms" : "Move is paused so you can rest"} until {new Date(s.lockout.until).toLocaleString()}.
              </p>
              {s.lockout.kind === "emergency" &&
                (now < attestAvailableAt(s.lockout) ? (
                  <p className="text-sm text-muted">Please get medical help first. If a clinician assesses you, you can record that here from {new Date(attestAvailableAt(s.lockout)).toLocaleTimeString()}.</p>
                ) : (
                  <form onSubmit={submitAttestation} className="space-y-3">
                    <label className="block text-sm text-ink">
                      Clinician who assessed you
                      <input className={field} value={attest.clinicianName} onChange={(e) => setAttest({ ...attest, clinicianName: e.target.value })} required />
                    </label>
                    <label className="flex items-start gap-3 text-sm text-ink">
                      <input type="checkbox" className="mt-1 size-4" checked={attest.confirmed} onChange={(e) => setAttest({ ...attest, confirmed: e.target.checked })} />
                      <span>A clinician assessed me after these symptoms and said I can exercise.</span>
                    </label>
                    <Button type="submit" size="sm">
                      Record assessment
                    </Button>
                  </form>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No pause is active.</p>
          )}
          {s.lockout?.audit?.length ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-ink">Safety record</summary>
              <ul className="mt-2 space-y-1 text-muted">
                {s.lockout.audit.map((a, i) => (
                  <li key={i}>
                    {new Date(String(a.at)).toLocaleString()}: {String(a.event).replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Panel>

        <Panel title="Privacy and your data" description="Move keeps plans, workouts and safety answers on this device only. Nothing is shared unless you share it with a clinician through ASHA Clinic.">
          <Switch
            checked={s.rememberConditions}
            onChange={(v) => moveStore.set({ rememberConditions: v })}
            label="Remember my safety answers"
            description="Off: you answer the full safety check before every workout. “Right now” symptoms are always asked."
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={download}>
              Export my Move data
            </Button>
            {confirmDelete ? (
              <>
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    const keep = s.lockout && lockoutActive(s.lockout, Date.now()) ? s.lockout : null;
                    moveStore.clear();
                    // An active safety pause outlives deletion, so deleting data can't restart a workout.
                    if (keep) moveStore.set({ lockout: keep });
                    setConfirmDelete(false);
                    setMessage("Move data deleted from this device.");
                  }}
                >
                  Yes, delete everything
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="text-red-700" onClick={() => setConfirmDelete(true)}>
                Delete all Move data
              </Button>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
