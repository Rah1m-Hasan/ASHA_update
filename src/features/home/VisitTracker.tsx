"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { homeStore } from "./store";

/** Remembers the last modules opened so Home can offer "Continue" and put them first. */
export function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    homeStore.visit(pathname);
  }, [pathname]);
  return null;
}
