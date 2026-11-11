"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CopyIcon } from "@/components/ui/icons";
import { privateLink } from "@/features/session/actions";

export function CopyLink({ role, patientId, token, label }: { role: "patient" | "caregiver"; patientId: string; token: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(privateLink(role, patientId, token));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <CopyIcon size={15} />
      {copied ? "Copied" : label}
    </Button>
  );
}
