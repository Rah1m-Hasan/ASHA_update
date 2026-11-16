"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CopyIcon } from "@/components/ui/icons";
import { privateLink } from "@/features/session/actions";

export function CopyLink({ role, patientId, token, label }: { role: "patient" | "caregiver"; patientId: string; token: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The clipboard is only available in a secure context. The app is also
  // served over plain HTTP on the LAN address, where it is not available at
  // all - so the link is shown for copying by hand when it cannot be copied.
  const link = privateLink(role, patientId, token);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          setFailed(false);
          try {
            if (!navigator.clipboard?.writeText)
              throw new Error("Clipboard not available");
            await navigator.clipboard.writeText(link);
            setCopied(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
            setFailed(true);
          }
        }}
      >
        <CopyIcon size={15} />
        {copied ? "Copied" : label}
      </Button>
      {failed && (
        <span className="w-full text-xs text-danger">
          Couldn’t copy automatically. Copy this link by hand:{" "}
          <span className="break-all">{link}</span>
        </span>
      )}
    </>
  );
}
