"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { sessionStore } from "@/features/session/store";

/**
 * Sends people to the dashboard for their last-used role.
 *
 * The redirect is instant, but the page still has to say something while it
 * happens: an empty page has no heading, and a screen reader that lands here
 * hears nothing at all.
 */
export default function DashboardIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/${sessionStore.get().role}`);
  }, [router]);
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <h1 className="text-lg font-medium text-ink">Opening your workspace…</h1>
    </main>
  );
}
