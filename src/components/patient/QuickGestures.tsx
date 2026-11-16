"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/dashboard/Panel";
import { Button } from "@/components/ui/Button";
import {
  usePerception,
  usePerceptionEvent,
} from "@/features/perception/PerceptionProvider";
import { NEEDS } from "@/features/requests/needs";
import { useSession } from "@/features/session/store";
import { readLocal, saveLocal } from "@/lib/storage";

const POSES = [
  "Open palm",
  "Closed fingers",
  "Index extended",
  "Two fingers extended",
  "Three fingers extended",
];
type Maps = Record<string, { kind: string; trained: boolean }>;

/** Map a familiar hand pose to a request with three practised holds. */
export function QuickGestures() {
  const id = useSession((s) => s.patient?.patientId ?? "local-demo");
  const { state, setCalibrating } = usePerception();
  const [maps, setMaps] = useState<Maps>(() =>
    readLocal<Maps>("handmap_" + id, {}),
  );
  const [pose, setPose] = useState(POSES[2]);
  const [kind, setKind] = useState("water");
  const [training, setTraining] = useState<{
    pose: string;
    kind: string;
    count: number;
  } | null>(null);

  useEffect(() => {
    setCalibrating(!!training && state === "on");
    return () => setCalibrating(false);
  }, [training, state, setCalibrating]);
  useEffect(() => {
    setMaps(readLocal<Maps>("handmap_" + id, {}));
    setTraining(null);
  }, [id]);

  usePerceptionEvent<{ pose: string }>(
    "hand",
    (h) => {
      if (!training || h.pose !== training.pose) return;
      const count = training.count + 1;
      if (count < 3) return setTraining({ ...training, count });
      const next = {
        ...maps,
        [training.pose]: { kind: training.kind, trained: true },
      };
      saveLocal("handmap_" + id, next);
      setMaps(next);
      setTraining(null);
    },
    !!training,
  );

  const remove = (p: string) => {
    const next = { ...maps };
    delete next[p];
    saveLocal("handmap_" + id, next);
    setMaps(next);
  };

  return (
    <Panel
      title="Quick gestures"
      description="A practised pose proposes its request. You still confirm before anything is sent."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-sm font-medium text-ink">
          Pose
          <select
            value={pose}
            onChange={(e) => setPose(e.target.value)}
            className="mt-1 block h-11 w-full rounded-xl border border-line bg-surface px-3"
          >
            {POSES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-ink">
          Means
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="mt-1 block h-11 w-full rounded-xl border border-line bg-surface px-3"
          >
            {NEEDS.map((n) => (
              <option key={n.kind} value={n.kind}>
                {n.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => setTraining({ pose, kind, count: 0 })}
          disabled={state !== "on" || !!training}
        >
          Practise
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted" role="status">
        {state !== "on"
          ? "Start the camera to practise."
          : training
            ? `Hold “${training.pose}”, then relax. ${training.count}/3 holds captured.`
            : "Choose a pose and what it should ask for."}
      </p>
      {Object.keys(maps).length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {Object.entries(maps).map(([p, m]) => (
            <li key={p} className="flex items-center justify-between py-2.5">
              <span className="text-ink">
                {p} <span className="text-muted">asks for</span>{" "}
                {NEEDS.find((n) => n.kind === m.kind)?.label ?? m.kind}
              </span>
              <button
                onClick={() => remove(p)}
                className="text-sm font-medium text-muted hover:text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
