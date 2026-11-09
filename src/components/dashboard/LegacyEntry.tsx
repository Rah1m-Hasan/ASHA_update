"use client";

import { useEffect } from "react";

/** Fragments never reach the server. Keep private links intact when they enter at /. */
export function LegacyEntry() {
  useEffect(() => {
    const openLegacyLink = () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      if (
        hash.has("token") ||
        hash.has("patientId") ||
        ["patient", "caregiver"].includes(query.get("role") ?? "") ||
        [
          "facespeak",
          "fingerspeak",
          "senseassist",
          "vitalsense",
          "posture",
        ].includes(query.get("module") ?? "")
      ) {
        window.location.replace(
          "/assistive.html" + window.location.search + window.location.hash,
        );
      }
    };
    openLegacyLink();
    window.addEventListener("hashchange", openLegacyLink);
    return () => window.removeEventListener("hashchange", openLegacyLink);
  }, []);
  return null;
}
