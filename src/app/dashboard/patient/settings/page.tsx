"use client";

import { useEffect, useState } from "react";
import { LinkConnect } from "@/components/dashboard/LinkConnect";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Switch } from "@/components/dashboard/Switch";
import { Button } from "@/components/ui/Button";
import { sessionStore, useSession } from "@/features/session/store";
import type { Settings } from "@/features/session/types";
import { usePatientProfile } from "@/features/session/usePatientProfile";
import { speak } from "@/features/speech/speak";

const field = "mt-1 block h-11 w-full rounded-xl border border-line bg-white px-3";

export default function PatientSettings() {
  const settings = useSession((s) => s.settings);
  const cred = useSession((s) => s.patient);
  const { profile, isLocalDemo } = usePatientProfile();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const set = (p: Partial<Settings>) => sessionStore.updateSettings(p);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(speechSynthesis.getVoices().filter((v) => /^(en|bn)/i.test(v.lang)));
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Asha’s voice">
          <label className="text-sm font-medium text-ink">
            Voice
            <select className={field} value={settings.voice} onChange={(e) => set({ voice: e.target.value })}>
              <option value="">Default for the language</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-medium text-ink">
            Speaking speed <span className="font-normal text-muted">{settings.rate.toFixed(2)}×</span>
            <input type="range" min={0.65} max={1.3} step={0.05} value={settings.rate} onChange={(e) => set({ rate: Number(e.target.value) })} className="mt-2 w-full accent-brand" />
          </label>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => speak("Hello, I’m Asha. I’m here with you.")}>
            Test voice
          </Button>
          <label className="mt-5 block text-sm font-medium text-ink">
            Conversation language
            <select className={field} value={settings.language} onChange={(e) => set({ language: e.target.value as Settings["language"] })}>
              <option value="auto">Match how I write</option>
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
        </Panel>

        <Panel title="Privacy and check-ins">
          <div className="divide-y divide-line">
            <Switch
              checked={settings.cloud}
              onChange={(cloud) => set({ cloud })}
              label="Cloud assistance"
              description="Needed for chat and speech clarification. Your words are sent; camera video never is."
            />
            <Switch
              checked={settings.proactive}
              onChange={(proactive) => set({ proactive })}
              label="Gentle check-ins"
              description="Asha asks if you need help after a sustained change in posture or expression."
            />
          </div>
        </Panel>

        <Panel title="Caregiver connection" className="lg:col-span-2">
          {isLocalDemo ? (
            <>
              <p className="mb-3 text-sm text-muted">This device isn’t linked yet. Paste the patient link your caregiver shared, or set up a care circle from the caregiver view.</p>
              <LinkConnect />
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{profile?.label ?? "Linked"}</p>
                <p className="text-sm text-muted">
                  ID ···{cred?.patientId.slice(-8)}
                  {profile?.expiresAt && ` · link expires ${new Date(profile.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill tone="good">Linked</StatusPill>
                <Button variant="secondary" size="sm" onClick={() => sessionStore.setPatient(null)}>
                  Unlink this device
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
