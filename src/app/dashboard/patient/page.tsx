"use client";

import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/components/dashboard/Panel";
import { DeliveryBanner } from "@/components/patient/DeliveryBanner";
import { NeedButtons } from "@/components/patient/NeedButtons";
import { RequestList } from "@/components/patient/RequestTimeline";
import { Button } from "@/components/ui/Button";
import { EyeIcon, HandIcon, HeartIcon, MicIcon, PostureIcon } from "@/components/ui/icons";
import { useCalibrationData } from "@/features/calibration/useCalibrationData";
import { usePerception } from "@/features/perception/PerceptionProvider";
import { usePatientProfile } from "@/features/session/usePatientProfile";

const MODULES = {
  facespeak: { label: "FaceSpeak", text: "Blinks, smiles and head movements", icon: EyeIcon },
  fingerspeak: { label: "FingerSpeak", text: "Hand and finger gestures", icon: HandIcon },
  senseassist: { label: "SenseAssist", text: "Clearer speech with Asha", icon: MicIcon },
  vitalsense: { label: "VitalSense", text: "Pulse and breathing estimate", icon: HeartIcon },
  posture: { label: "Posture", text: "Position and comfort", icon: PostureIcon },
} as const;

export default function PatientHome() {
  const { profile, data, isLocalDemo } = usePatientProfile();
  const { state, start } = usePerception();
  const trained = useCalibrationData();
  const suggested = (profile?.recommendation.suggested ?? []).filter((m): m is keyof typeof MODULES => m in MODULES);
  const others = (Object.keys(MODULES) as (keyof typeof MODULES)[]).filter((m) => !suggested.includes(m));

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Image src="/assets/assets/images/asha-avatar.png" alt="" width={64} height={64} className="size-14 rounded-full ring-4 ring-brand-soft" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">Hello{profile && !isLocalDemo ? `, ${profile.label}` : ""}. I’m here with you.</h1>
          <p className="text-muted">Choose what you need, or use a movement you have practised.</p>
        </div>
      </div>

      <DeliveryBanner />

      <section aria-labelledby="needs-title" className="mb-8">
        <h2 id="needs-title" className="sr-only">
          Quick requests
        </h2>
        <NeedButtons />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Recent requests" description="Delivery status from your caregiver" action={<Link href="/dashboard/patient/communicate" className="text-sm font-medium text-brand">See all</Link>}>
          {isLocalDemo ? (
            <p className="py-6 text-center text-sm text-muted">This device isn’t linked to a caregiver yet. Requests stay on this device until you link one in Settings.</p>
          ) : (
            <RequestList events={data?.events ?? []} limit={5} />
          )}
        </Panel>

        <div className="space-y-6">
          {state !== "on" && (
            <Panel title="Start sensing" description="Turn on the camera so Asha can follow your practised movements.">
              <Button onClick={start} disabled={state === "starting"}>
                {state === "starting" ? "Starting…" : "Start camera"}
              </Button>
            </Panel>
          )}
          {!trained && (
            <Panel title="Practise your signals" description="A short guided session learns how you blink, smile or move your head.">
              <Link href="/dashboard/patient/calibration" className="font-medium text-brand">
                Start calibration
              </Link>
            </Panel>
          )}
          <Panel title="Your ways to communicate">
            <ul className="space-y-2">
              {[...suggested, ...others].map((m) => {
                const { label, text, icon: Icon } = MODULES[m];
                return (
                  <li key={m}>
                    <Link href={`/dashboard/patient/${m}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-wash">
                      <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                        <Icon size={18} />
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium text-ink">{label}</span>
                        <span className="text-sm text-muted">{text}</span>
                      </span>
                      {suggested.includes(m) && <span className="text-xs font-medium text-brand">Suggested</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
