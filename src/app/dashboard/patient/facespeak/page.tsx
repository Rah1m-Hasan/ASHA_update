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
import {
  useActiveModule,
  usePerception,
} from "@/features/perception/PerceptionProvider";
import { useSignalHistory } from "@/features/perception/useSignalHistory";

const deg = (v?: number) => (v == null ? "—" : `${Math.round(v)}°`);
/** Seconds a one-sided stretch must last, on the same side, before it is logged (face-analysis.js, lip-watch.js). */
const HOLD_SECONDS = 60;
/** Frames of a relaxed face the engine collects as the resting reference. */
const NEUTRAL_FRAMES = 45;

type Analysis = NonNullable<ReturnType<typeof usePerception>["snapshot"]["analysis"]>;

/**
 * An abnormal stretch is the lips pulled to one side (or one mouth corner raised or dropped) beyond
 * the threshold, relative to the person's resting face. A moment of it means nothing: it counts only
 * while it lasts on the same side, and is logged for review after HOLD_SECONDS. Even smiles, a
 * turned or tilted head and tracking loss stop the timer.
 */
function AbnormalStretch({ a, on }: { a: Analysis | undefined; on: boolean }) {
  const lip = a?.lip;
  const dev = Math.abs(lip?.deviation ?? 0);
  const limit = lip?.threshold ?? 0.035;
  const measured = !!a?.valid && lip?.deviation != null;
  const over = measured && dev >= limit;
  const held = Math.min(HOLD_SECONDS, lip?.duration ?? 0);
  const side = lip?.side === "right" ? "right" : "left";
  const what = lip?.kind === "Corner asymmetry" ? "one mouth corner pulled" : "lips pulled";
  const status = !on
    ? "Start the camera to measure."
    : !a?.valid
      ? "Face not tracked, so nothing is counted."
      : lip?.latched
        ? `Held for ${HOLD_SECONDS} seconds on the ${side}. Logged for review. This is an observation, not a diagnosis.`
        : lip?.active
          ? `Counting: ${what} to the ${side}. It is logged only if it lasts ${HOLD_SECONDS} seconds.`
          : over
            ? "Not counted: an even smile, or the head is turned or tilted."
            : a.ready
              ? "Within your resting range."
              : `Learning your resting face (${Math.min(NEUTRAL_FRAMES, a.neutralProgress ?? 0)} of ${NEUTRAL_FRAMES} frames). Until then it is measured from the centre of the face.`;
  // The bar runs to 1.5 times the threshold, with a mark where the threshold is.
  const scale = limit * 1.5;
  return (
    <Panel title="Abnormal stretch" description={`A one-sided pull of the lips that lasts. Counted after ${(limit * 100).toFixed(1)}% of face width, logged after ${HOLD_SECONDS} seconds.`}>
      <div className="space-y-4" data-testid="abnormal-stretch" data-active={lip?.active ? "true" : "false"}>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-ink">Stretch</span>
            <span className="tabular-nums text-muted" data-testid="stretch-value">
              {measured ? `${dev >= 0.002 ? `${side === "left" ? "Left" : "Right"} · ` : ""}${(dev * 100).toFixed(1)}% of face width` : "—"}
            </span>
          </div>
          <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-wash ring-1 ring-line/70">
            <div className={`h-full rounded-full transition-[width] duration-150 ${over ? "bg-warn-strong" : "bg-brand"}`} style={{ width: `${Math.min(1, dev / scale) * 100}%` }} />
            <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: `${(limit / scale) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-ink">Time held</span>
            <span className="tabular-nums text-muted" data-testid="stretch-time">
              {Math.floor(held)} of {HOLD_SECONDS} s
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-wash ring-1 ring-line/70">
            <div className={`h-full rounded-full transition-[width] duration-300 ${lip?.latched ? "bg-warn-strong" : "bg-brand"}`} style={{ width: `${(held / HOLD_SECONDS) * 100}%` }} />
          </div>
        </div>
        <p className="text-sm text-muted" role="status" data-testid="stretch-status">
          {status}
        </p>
      </div>
    </Panel>
  );
}

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
            <a
              href="/assistive.html?module=facespeak"
              className="inline-flex min-h-9 items-center rounded-full bg-brand-soft px-3 py-2 text-sm font-medium text-brand hover:bg-brand-mint"
            >
              Full FaceSpeak studio ↗
            </a>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => instance()?.resetFaceReference()}
              disabled={state !== "on"}
            >
              Reset face reference
            </Button>
            <Link
              href="/dashboard/patient/calibration"
              className="inline-flex h-9 items-center rounded-full bg-brand px-3 text-sm font-medium text-on-brand hover:bg-brand-hover"
            >
              {trained ? "Recalibrate" : "Calibrate"}
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_minmax(0,1fr)]">
        <div className="space-y-4">
          <CameraView />
          <div className="flex flex-wrap gap-2">
            <StatusPill
              tone={a?.valid ? "good" : state === "on" ? "warn" : "neutral"}
            >
              {a?.valid
                ? "Face tracked"
                : state === "on"
                  ? "Looking for your face"
                  : "Camera off"}
            </StatusPill>
            <StatusPill tone={trained ? "good" : "warn"}>
              {trained
                ? `Calibrated · ${trained.enabled.length} signals`
                : "Not calibrated yet"}
            </StatusPill>
            {a?.reason && state === "on" && <StatusPill>{a.reason}</StatusPill>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Blinks seen"
              value={s.blinks ?? "—"}
              hint="Counted only"
            />
            <Stat
              label="Smile"
              value={
                a?.smile?.intensity == null
                  ? "—"
                  : Math.round(a.smile.intensity * 100)
              }
              unit="%"
            />
            <Stat label="Latency" value={s.latency ?? "—"} unit="ms" />
          </div>
          <Panel
            title="Head movement"
            description="Relative to your neutral position"
          >
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Turn" value={deg(a?.head?.yaw)} />
              <Stat label="Nod" value={deg(a?.head?.pitch)} />
              <Stat label="Tilt" value={deg(a?.head?.roll)} />
            </div>
          </Panel>
          <AbnormalStretch a={a} on={state === "on"} />
          <Panel
            title="Expression signals"
            description="Model signals, not a measure of ability"
          >
            <div className="space-y-3">
              <Meter
                label="Brow raise (AU1)"
                value={au.AU1 != null ? au.AU1 / 100 : null}
              />
              <Meter
                label="Brow lower (AU4)"
                value={au.AU4 != null ? au.AU4 / 100 : null}
              />
              <Meter
                label="Cheek raise (AU6)"
                value={au.AU6 != null ? au.AU6 / 100 : null}
              />
              <Meter
                label="Lip stretch (AU20)"
                value={au.AU20 != null ? au.AU20 / 100 : null}
              />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
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
