"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { Stat } from "@/components/dashboard/Stat";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Switch } from "@/components/dashboard/Switch";
import { CameraView } from "@/features/perception/CameraView";
import { useActiveModule, usePerception } from "@/features/perception/PerceptionProvider";
import { useSignalHistory } from "@/features/perception/useSignalHistory";

export default function PosturePage() {
  useActiveModule("posture");
  const { snapshot: s, state, instance } = usePerception();
  const [yolo, setYolo] = useState(false);
  const p = s.posture;
  const lean = useSignalHistory((x) => x.posture?.lean ?? x.posture?.tilt);
  const motion = useSignalHistory((x) => x.posture?.motion);

  return (
    <>
      <PageHeader title="Posture" description="Camera-based position and movement. A sustained change leads to a gentle question, never an automatic alert." />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          <CameraView />
          <StatusPill tone={p?.valid ? "good" : state === "on" ? "warn" : "neutral"}>{p?.valid ? "Upper body tracked" : p?.label ?? "Camera off"}</StatusPill>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Position" value={p?.label ?? "—"} className="col-span-2 bg-brand-soft" />
            <Stat label="Lean" value={p?.lean != null ? `${Math.round(p.lean)}°` : "—"} />
            <Stat label="Activity" value={s.activity ?? "—"} />
          </div>
          <Panel title="Cross-check">
            <Switch
              checked={yolo}
              onChange={async (v) => {
                setYolo(v);
                if (v) await instance()?.enableYolo?.();
              }}
              label="YOLO pose cross-check"
              description="Runs a second pose model in its own worker. Uses more battery."
            />
          </Panel>
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel title="Lean over time">
          <Sparkline values={lean} />
        </Panel>
        <Panel title="Movement">
          <Sparkline values={motion} />
        </Panel>
      </div>
    </>
  );
}
