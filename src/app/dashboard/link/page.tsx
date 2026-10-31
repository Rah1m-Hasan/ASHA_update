"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { acceptLink } from "@/features/session/actions";

/** Opens a private patient/caregiver link and stores the credential on this device. */
export default function LinkPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const role = acceptLink(window.location.href);
      history.replaceState(null, "", "/dashboard/link");
      router.replace(`/dashboard/${role}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [router]);
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <p className={error ? "text-danger" : "text-muted"}>{error || "Connecting…"}</p>
    </main>
  );
}
