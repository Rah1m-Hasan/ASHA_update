"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon, SwapIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { titleFor } from "@/features/dashboard/nav";
import { sessionStore } from "@/features/session/store";
import type { Role } from "@/features/session/types";
import { Sidebar } from "./Sidebar";

/** Sidebar + top bar frame shared by patient and caregiver dashboards. */
export function DashboardShell({
  role,
  badges,
  sidebarFooter,
  topbarExtra,
  children,
}: {
  role: Role;
  badges?: Partial<Record<"requests", number>>;
  sidebarFooter?: React.ReactNode;
  topbarExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    sessionStore.setRole(role);
  }, [role]);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const other: Role = role === "patient" ? "caregiver" : "patient";
  const switchRole = () => {
    sessionStore.setRole(other);
    router.push(`/dashboard/${other}`);
  };

  return (
    <div className="min-h-dvh bg-wash lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <a href="#dashboard-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">
        <Sidebar role={role} badges={badges} footer={sidebarFooter} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-veil/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] bg-surface shadow-float">
            <Sidebar role={role} badges={badges} footer={sidebarFooter} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          <button className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-wash lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
          {/* The title gives way first on a narrow phone: it truncates rather
              than pushing the controls in the top bar off the screen. */}
          <p className="min-w-0 flex-1 truncate font-semibold text-ink lg:hidden">{titleFor(role, pathname)}</p>
          <p className="hidden text-sm text-muted lg:block">{role === "patient" ? "Patient space" : "Caregiver space"}</p>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {topbarExtra}
            <ThemeToggle className="size-10" />
            <button
              onClick={switchRole}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium text-ink ring-1 ring-line hover:bg-wash"
              title={`Switch to the ${other} view`}
            >
              <SwapIcon size={16} className="text-muted" />
              <span className="hidden sm:inline">{other === "caregiver" ? "Caregiver view" : "Patient view"}</span>
            </button>
          </div>
        </header>
        <main id="dashboard-main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
