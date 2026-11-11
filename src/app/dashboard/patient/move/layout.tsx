"use client";

import { LockoutBanner, MoveTabs } from "@/features/move/ui";

export default function MoveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MoveTabs />
      <LockoutBanner />
      {children}
    </>
  );
}
