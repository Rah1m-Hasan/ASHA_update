"use client";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { Stat } from "@/components/dashboard/Stat";
import { StatusPill, type Tone } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { CameraView } from "@/features/perception/CameraView";
import { useActiveModule, usePerception } from "@/features/perception/PerceptionProvider";

const tone = (s?: string): Tone => (s === "good" ? "good" : s === "fair" ? "warn" : s === "poor" ? "alert" : "neutral");

function exportCsv(trend: { t: number; bpm: number; quality: string }[]) {
  const rows = ["time_ms,bpm,quality", ...trend.map((r) => `${Math.round(r.t)},${r.bpm},${r.quality}`)];
  const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "asha-vitalsense.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

export default function VitalSensePage() {
  useActiveModule("vitalsense");
  const { pulse: p, state, instance } = usePerception();
  const b = p?.baseline;

  return (
    <>
      <PageHeader
        title="VitalSense"
        description="Experimental camera estimates for awareness only — not a medical measurement."
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={state !== "on"} onClick={() => instance()?.resetVitalsBaseline()}>
              Calibrate resting reference
            </Button>
            <Button variant="secondary" size="sm" disabled={!p?.trend.length} onClick={() => p && exportCsv(p.trend)}>
              Export readings
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <CameraView />
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={tone(p?.status)}>Signal {p?.status ?? "waiting"}</StatusPill>
            <p className="text-sm text-muted">{p?.reason ?? "Face the camera in steady light and keep still."}</p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Pulse" value={p?.bpm ?? "—"} unit="bpm" hint={p?.windowSeconds ? `${Math.round(p.windowSeconds)} s window` : "Needs 12 s"} className="bg-brand-soft" />
            <Stat label="Breathing" value={p?.breathingBpm ?? "—"} unit="/min" hint="Needs 30 s" />
            <Stat label="Signal quality" value={p ? Math.round(p.quality * 100) : "—"} unit="%" />
            <Stat label="HRV (RMSSD)" value={p?.hrv?.rmssd ?? "—"} unit="ms" hint="Provisional" />
          </div>
          <Panel title="Resting reference">
            {b?.bpm ? (
              <p className="text-ink">
                {b.bpm} bpm <span className="text-muted">(range {b.low}–{b.high})</span>
              </p>
            ) : (
              <>
                <p className="text-sm text-muted">{b?.calibrating ? "Hold still for 30 seconds to learn your resting pulse." : "Not set."}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-wash">
                  <div className="h-full bg-brand" style={{ width: `${Math.round((b?.progress ?? 0) * 100)}%` }} />
                </div>
              </>
            )}
          </Panel>
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel title="Pulse waveform">
          <Sparkline values={p?.signal ?? []} />
        </Panel>
        <Panel title="Session trend" description="Last 5 minutes">
          <Sparkline values={(p?.trend ?? []).map((r) => r.bpm)} />
        </Panel>
      </div>
    </>
  );
}
