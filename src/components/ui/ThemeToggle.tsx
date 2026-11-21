"use client";

import { DeviceIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { useTheme } from "@/features/theme/ThemeProvider";
import { cn } from "@/lib/cn";

/**
 * The theme switcher.
 *
 * Both glyphs are rendered; CSS picks the one that matches the current theme
 * (`.theme-icon--sun` / `.theme-icon--moon` in globals.css). That way the
 * server-rendered markup and the first client render are identical — no
 * hydration mismatch, and no flash of the wrong icon before React boots.
 *
 * The accessible name, on the other hand, comes from the provider's state,
 * which only settles after mount. Until then it reads "Colour theme".
 *
 * `data-theme-toggle` is how the pre-paint script recognises the button if a
 * click lands before React has hydrated.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, ready, toggle } = useTheme();
  const label = !ready ? "Colour theme" : theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggle}
      data-theme-toggle=""
      aria-label={label}
      title={label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg text-body transition-colors",
        "hover:bg-surface-hover hover:text-heading",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        className,
      )}
    >
      <SunIcon size={19} className="theme-icon theme-icon--sun" />
      <MoonIcon size={19} className="theme-icon theme-icon--moon" />
    </button>
  );
}

/**
 * Puts the theme back under the device's control. It sits in the mobile sheet
 * and beside the legal line in the footer, so "follow the device" is always
 * one tap away without crowding the navbar.
 */
export function ThemeFollowDevice({ className }: { className?: string }) {
  const { setPreference } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setPreference("system")}
      aria-label="Use the device's colour theme"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg text-[14px] text-body transition-colors",
        "hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        className,
      )}
    >
      <DeviceIcon size={17} />
      Use the device&apos;s theme
    </button>
  );
}
