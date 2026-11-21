"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { ThemeFollowDevice, ThemeToggle } from "@/components/ui/ThemeToggle";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { nav, site } from "@/content/landing";
import { cn } from "@/lib/cn";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Light up the link for the section currently in view.
  useEffect(() => {
    const ids = nav.map((n) => n.href.slice(1)).filter(Boolean);
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(`#${visible[0].target.id}`);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Escape closes the sheet and returns focus to the button that opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-transparent bg-navbar backdrop-blur-xl transition-colors",
        scrolled && "border-line",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:h-[72px] sm:px-8">
        <Link href="/" aria-label="Asha home" className="flex items-center">
          <span
            role="img"
            aria-label="Asha"
            className="wordmark h-6 w-[144px] sm:h-7 sm:w-[168px]"
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const isActive = active === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "group relative flex h-9 items-center rounded-lg px-3 text-[15px] transition-colors",
                  isActive ? "text-heading" : "text-body hover:text-heading",
                )}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-1 left-3 h-px origin-left bg-accent transition-transform duration-300",
                    "w-[calc(100%-1.5rem)]",
                    isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    "group-focus-visible:scale-x-100",
                  )}
                />
              </a>
            );
          })}
          <ThemeToggle className="ml-1" />
          <ButtonLink href={site.appUrl} size="sm" className="ml-3">
            Try Asha
          </ButtonLink>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ButtonLink href={site.appUrl} size="sm">
            Try Asha
          </ButtonLink>
          <ThemeToggle className="size-11" />
          <button
            ref={toggle}
            type="button"
            className="grid size-11 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-hover"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-surface px-5 pb-8 md:hidden"
        >
          <ul className="divide-y divide-line">
            {nav.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center py-3 text-[17px] font-medium text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <ButtonLink href={site.appUrl} size="md" className="mt-5 w-full" hardNavigation>
            Try Asha
          </ButtonLink>
          <div className="mt-6 border-t border-line pt-5">
            <ThemeFollowDevice />
          </div>
        </nav>
      )}
    </header>
  );
}
