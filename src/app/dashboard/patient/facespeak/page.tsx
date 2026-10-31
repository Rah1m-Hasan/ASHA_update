"use client";

import Link from "next/link";
import { Meter } from "@/components/dashboard/Meter";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { Stat } from "@/components/dashboard/Stat";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { useCalibrationData } from "@/features/calibration/useCalibrationData";
import { CameraView } from "@/features/perception/CameraView";
import { useActiveModule, usePerception } from "@/features/perception/PerceptionProvider";
import { useSignalHistory } from "@/features/perception/useSignalHistory";

const deg = (v?: number) => (v == null ? "—" : `${Math.round(v)}°`);

export default function FaceSpeakPage() {
  useActiveModule("facespeak");
  const { snapshot: s, state, instance } = usePerception();
  const trained = useCalibrationData();
  const ear = useSignalHistory((x) => x.raw?.earMean);
  const smile = useSignalHistory((x) => x.analysis?.smile?.intensity);
  const a = s.analysis;
  const au = a?.au?.values ?? {};

  return (
    <>
      <PageHeader
        title="FaceSpeak"
        description="Deliberate blinks, smiles and head movements become messages. Ordinary blinks never send anything."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => instance()?.resetFaceReference()} disabled={state !== "on"}>
              Reset face reference
            </Button>
            <Link href="/dashboard/patient/calibration" className="inline-flex h-9 items-center rounded-full bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover">
              {trained ? "Recalibrate" : "Calibrate"}
            </Link>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <CameraView />
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={a?.valid ? "good" : state === "on" ? "warn" : "neutral"}>{a?.valid ? "Face tracked" : state === "on" ? "Looking for your face" : "Camera off"}</StatusPill>
            <StatusPill tone={trained ? "good" : "warn"}>{trained ? `Calibrated · ${trained.enabled.length} signals` : "Not calibrated yet"}</StatusPill>
            {a?.reason && state === "on" && <StatusPill>{a.reason}</StatusPill>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Blinks seen" value={s.blinks ?? "—"} hint="Counted only" />
            <Stat label="Smile" value={a?.smile?.intensity == null ? "—" : Math.round(a.smile.intensity * 100)} unit="%" />
            <Stat label="Latency" value={s.latency ?? "—"} unit="ms" />
          </div>
          <Panel title="Head movement" description="Relative to your neutral position">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Turn" value={deg(a?.head?.yaw)} />
              <Stat label="Nod" value={deg(a?.head?.pitch)} />
              <Stat label="Tilt" value={deg(a?.head?.roll)} />
            </div>
          </Panel>
          <Panel title="Expression signals" description="Model signals, not a measure of ability">
            <div className="space-y-3">
              <Meter label="Smile symmetry" value={a?.smile?.symmetry} />
              <Meter label="Brow raise (AU1)" value={au.AU1 != null ? au.AU1 / 100 : null} />
              <Meter label="Brow lower (AU4)" value={au.AU4 != null ? au.AU4 / 100 : null} />
              <Meter label="Cheek raise (AU6)" value={au.AU6 != null ? au.AU6 / 100 : null} />
              <Meter label="Lip stretch (AU20)" value={au.AU20 != null ? au.AU20 / 100 : null} />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel title="Eye openness" description="Dips are blinks">
          <Sparkline values={ear} />
        </Panel>
        <Panel title="Smile intensity">
          <Sparkline values={smile} />
        </Panel>
      </div>
    </>
  );
}
