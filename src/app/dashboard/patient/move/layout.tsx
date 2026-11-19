"use client";

import { LockoutBanner, MoveTabs } from "@/features/move/ui";
import { useMove } from "@/features/move/store";
import { useDocumentLanguage } from "@/lib/document-lang";

export default function MoveLayout({ children }: { children: React.ReactNode }) {
  const lang = useMove((s) => s.language);
  // The whole Move area speaks one language at a time, so the document says so
  // while the area is open, and English again once it is left.
  useDocumentLanguage(lang);
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
