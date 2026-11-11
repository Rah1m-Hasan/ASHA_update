"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { acceptLink } from "./actions";

/** Accepts private links that arrive via redirects from old /app URLs (credentials live in the #hash). */
export function LinkCatcher() {
  const router = useRouter();
  useEffect(() => {
    if (!location.hash.includes("token=")) return;
    try {
      const role = acceptLink(location.href);
      history.replaceState(null, "", location.pathname);
      router.replace(`/dashboard/${role}`);
    } catch {
      /* invalid link: leave the page as is */
    }
  }, [router]);
  return null;
}
