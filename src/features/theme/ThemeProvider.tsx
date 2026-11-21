"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  applyTheme,
  normalisePreference,
  readPreference,
  resolveTheme,
  systemPrefersDark,
  writePreference,
  type Preference,
  type Theme,
} from "./theme.js";

type ThemeContextValue = {
  /** What the person chose: "light", "dark" or "system". */
  preference: Preference;
  /** The theme that is painting right now: "light" or "dark". */
  theme: Theme;
  /** True once the browser has told us which theme applies. */
  ready: boolean;
  setPreference: (preference: Preference) => void;
  /** Flips between light and dark, remembering the choice. */
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * One source of truth for the theme.
 *
 * The inline script in the root layout has already set the attributes on
 * <html> before this mounts, so the first paint is right. This provider keeps
 * them in step afterwards and follows the device while the preference is
 * "system".
 *
 * It deliberately does not read the DOM during render: `suppressHydrationWarning`
 * covers <html> only, so a descendant reading the theme mid-render would produce
 * a hydration mismatch that React cannot silence.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<Preference>("system");
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  // Read what is already on <html> — the init script put it there before paint.
  useEffect(() => {
    const root = document.documentElement;
    const stored = readPreference(window.localStorage);
    const current = root.dataset.theme === "dark" ? "dark" : "light";
    setPreferenceState(stored);
    setTheme(current);
    setReady(true);
    // React owns the theme button from here on: the init script's fallback
    // click handler stands down once it sees this flag.
    root.dataset.themeHydrated = "1";
  }, []);

  // Follow the device, but only while the person has not chosen a theme.
  useEffect(() => {
    if (!ready || preference !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolveTheme("system", query.matches);
      setTheme(next);
      applyTheme(document.documentElement, next, "system");
    };
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [ready, preference]);

  const setPreference = useCallback((next: Preference) => {
    const pref = normalisePreference(next);
    const resolved = resolveTheme(pref, systemPrefersDark());
    writePreference(window.localStorage, pref);
    setPreferenceState(pref);
    setTheme(resolved);
    applyTheme(document.documentElement, resolved, pref);
  }, []);

  const toggle = useCallback(() => {
    // Read what is on the page right now, not what this closure remembers.
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setPreference(current === "dark" ? "light" : "dark");
  }, [setPreference]);

  return (
    <ThemeContext.Provider value={{ preference, theme, ready, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** The current theme. Safe to call outside the provider — it just reports "light". */
export function useTheme() {
  return (
    useContext(ThemeContext) ?? {
      preference: "system" as Preference,
      theme: "light" as Theme,
      ready: false,
      setPreference: () => {},
      toggle: () => {},
    }
  );
}
