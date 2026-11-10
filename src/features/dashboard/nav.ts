import { HomeIcon, InboxIcon, SettingsIcon, UserPlusIcon, UsersIcon } from "@/components/ui/icons";
import { AREAS, locate } from "@/features/home/areas";
import type { Role } from "@/features/session/types";

export type NavItem = { href: string; label: string; icon: (p: { size?: number; className?: string }) => React.ReactElement; badge?: "requests"; match?: string[] };
export type NavGroup = { label?: string; items: NavItem[] };

const P = "/dashboard/patient";
const C = "/dashboard/caregiver";

export const NAV: Record<Role, NavGroup[]> = {
  // Home, then one entry per area. Modules inside an area light up their area.
  patient: [
    {
      items: [
        { href: P, label: "Home", icon: HomeIcon },
        ...AREAS.map((a) => ({ href: a.href, label: a.label, icon: a.icon, match: a.modules.map((m) => m.href) })),
      ],
    },
    { items: [{ href: `${P}/settings`, label: "Settings", icon: SettingsIcon }] },
  ],
  caregiver: [
    {
      items: [
        { href: C, label: "Overview", icon: HomeIcon },
        { href: `${C}/requests`, label: "Requests", icon: InboxIcon, badge: "requests" },
        { href: `${C}/patients`, label: "Patients", icon: UsersIcon },
        { href: `${C}/patients/new`, label: "Add patient", icon: UserPlusIcon },
      ],
    },
    { label: "Account", items: [{ href: `${C}/settings`, label: "Settings", icon: SettingsIcon }] },
  ],
};

/** Finds the title for the current path (used for the mobile top bar): the module, else the nav label. */
export function titleFor(role: Role, pathname: string) {
  if (role === "patient") {
    const hit = locate(pathname);
    if (hit) return hit.module?.label ?? hit.area.label;
  }
  const items = NAV[role].flatMap((g) => g.items);
  return [...items].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))?.label ?? "Asha";
}
