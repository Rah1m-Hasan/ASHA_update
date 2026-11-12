"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Wordmark } from "@/components/ui/Wordmark";
import { nav, site } from "@/content/landing";
import { cn } from "@/lib/cn";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-surface/85 backdrop-blur-xl transition-shadow",
        scrolled && "shadow-[0_1px_0_var(--asha-line)]",
      )}
    >
      <div className="mx-auto flex h-[68px] max-w-[1300px] items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="Asha home" className="flex items-center">
          <Wordmark height={26} priority />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="h-9 rounded-lg px-2.5 text-sm leading-9 font-medium text-ink hover:bg-wash">
              {item.label}
            </a>
          ))}
          <ThemeToggle className="size-9" />
          <ButtonLink href={site.appUrl} size="sm">
            Try Asha
          </ButtonLink>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle className="size-9" />
          <ButtonLink href={site.appUrl} size="sm">
            Try Asha
          </ButtonLink>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-ink hover:bg-wash"
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
        <nav id="mobile-menu" aria-label="Mobile" className="border-t border-line bg-surface px-4 pb-6 md:hidden">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block border-b border-line/70 py-4 text-lg font-semibold text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
