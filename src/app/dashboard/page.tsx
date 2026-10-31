"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { sessionStore } from "@/features/session/store";

/** Sends people to the dashboard for their last-used role. */
export default function DashboardIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/${sessionStore.get().role}`);
  }, [router]);
  return null;
}
