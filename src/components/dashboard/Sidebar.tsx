"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, type NavGroup, type NavItem } from "@/features/dashboard/nav";
import type { Role } from "@/features/session/types";
import { cn } from "@/lib/cn";

export function Sidebar({
  role,
  badges,
  footer,
  onNavigate,
}: {
  role: Role;
  badges?: Partial<Record<"requests", number>>;
  footer?: React.ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups: NavGroup[] = NAV[role];
  // The entry whose own path (or one of its modules' paths) is the longest match wins.
  const score = (i: NavItem) =>
    Math.max(-1, ...[i.href, ...(i.match ?? [])].filter((h) => pathname === h || pathname.startsWith(h + "/")).map((h) => h.length));
  const best = groups.flatMap((g) => g.items).reduce<NavItem | null>((top, i) => (score(i) > (top ? score(top) : -1) ? i : top), null);
  const active = (href: string) => best?.href === href;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/" aria-label="Asha home">
          <span role="img" aria-label="Asha" className="wordmark h-6 w-[144px]" />
        </Link>
      </div>
      <nav
        aria-label={
          role === "patient" ? "Patient navigation" : "Caregiver navigation"
        }
        className="flex-1 overflow-y-auto px-3 pb-4"
      >
        {groups.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-5")}>
            {g.label && (
              <p className="mb-1.5 px-3 text-xs font-medium text-muted">
                {g.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon, badge }) => {
                const on = active(href);
                const count = badge ? badges?.[badge] : 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                        on
                          ? "bg-brand text-on-brand"
                          : "text-ink hover:bg-brand-soft",
                      )}
                    >
                      <Icon
                        size={19}
                        className={on ? "text-on-brand" : "text-muted"}
                      />
                      <span className="flex-1">{label}</span>
                      {!!count && (
                        <span
                          className={cn(
                            "min-w-6 rounded-full px-1.5 text-center text-xs leading-6 font-semibold",
                            on
                              ? "bg-on-brand text-brand"
                              : "bg-red-500 text-white",
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {footer && <div className="border-t border-line p-3">{footer}</div>}
    </div>
  );
}
