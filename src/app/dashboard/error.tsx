"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ShieldIcon } from "@/components/ui/icons";

/**
 * The boundary for a screen that failed to render. It says what happened in
 * plain words, keeps the app's voice, and offers the one action that helps:
 * trying again. Nothing clinical is claimed and nothing is sent anywhere.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The error is already on the server side in production; this is the only
    // place it is surfaced in the browser.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-wash px-4 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
        <ShieldIcon />
      </div>
      <h1 className="mt-5 font-display text-title-sm font-medium text-ink text-balance sm:text-title">
        This screen did not open.
      </h1>
      <p className="mt-3 max-w-md text-lg leading-7 text-muted">
        Nothing has been sent anywhere and nothing has been changed. Trying again usually works.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => location.assign("/dashboard")}>
          Back to my space
        </Button>
      </div>
    </div>
  );
}
