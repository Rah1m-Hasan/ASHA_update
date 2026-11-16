"use client";

import { LockoutBanner, MoveTabs } from "@/features/move/ui";
import { useMove } from "@/features/move/store";

export default function MoveLayout({ children }: { children: React.ReactNode }) {
  const lang = useMove((s) => s.language);
  return (
    // The whole Move area speaks one language at a time, so the subtree says
    // which one: a screen reader is told Bangla for Bangla text.
    <div lang={lang === "bn" ? "bn" : "en"}>
      <MoveTabs />
      <LockoutBanner />
      {children}
    </div>
  );
}
