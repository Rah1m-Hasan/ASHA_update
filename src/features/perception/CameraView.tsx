"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { CameraIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { usePerception } from "./PerceptionProvider";

/** Shows the shared camera. If several are mounted, the most recent one gets the live video. */
export function CameraView({ className, compact = false, children, offMessage }: { className?: string; compact?: boolean; children?: React.ReactNode; offMessage?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const { attach, state, status, start } = usePerception();

  useEffect(() => (host.current ? attach(host.current) : undefined), [attach]);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-veil", compact ? "aspect-[16/9]" : "aspect-video", className)}>
      <div ref={host} className="absolute inset-0" />
      {state === "on" && children}
      {state !== "on" && (
        <div className="absolute inset-0 grid place-items-center bg-veil p-4 text-center text-on-veil">
          <div className="max-w-xs">
            <CameraIcon size={compact ? 20 : 28} className="mx-auto text-white/70" />
            {!compact && (
              <p className="mt-3 text-sm text-white/80">
                {state === "error" ? status : offMessage ?? "The camera stays off until you start it. Video never leaves this device."}
              </p>
            )}
            <Button size="sm" className="mt-3" onClick={start} disabled={state === "starting"}>
              {state === "starting" ? "Starting…" : "Start camera"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
