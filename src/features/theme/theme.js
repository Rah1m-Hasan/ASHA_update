// The colour theme: one preference, three states, one resolved theme.
// Plain JS on purpose — `node --test` imports this the same way it imports
// `src/features/enquiry/enquiry.js`.

/** Storage key. The `asha_live_` prefix is the house convention (see src/lib/storage.ts). */
export const THEME_KEY = "asha_live_theme";

/** What a person can choose. "system" means "follow the device". */
export const PREFERENCES = ["light", "dark", "system"];

/** The two themes that actually paint the page. */
export const THEMES = ["light", "dark"];

/**
 * @typedef {"light" | "dark" | "system"} Preference
 * @typedef {"light" | "dark"} Theme
 */

/** Falls back to "system" for anything we do not recognise. */
export function normalisePreference(value) {
  return PREFERENCES.includes(value) ? value : "system";
}

/**
 * The theme that paints the page, given a preference and whether the device
 * asks for dark. A fixed preference always wins; "system" follows the device.
 */
export function resolveTheme(preference, systemDark) {
  const pref = normalisePreference(preference);
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

/**
 * The stored preference. `src/lib/storage.ts` writes JSON, so the raw value is
 * `"dark"` with quotes — parse it rather than comparing it as a bare string.
 */
export function readPreference(storage) {
  try {
    const raw = storage.getItem(THEME_KEY);
    if (raw === null) return "system";
    const parsed = JSON.parse(raw);
    return normalisePreference(parsed);
  } catch {
    return "system";
  }
}

/** Stores the preference in the same JSON shape `src/lib/storage.ts` uses. */
export function writePreference(storage, preference) {
  try {
    storage.setItem(THEME_KEY, JSON.stringify(normalisePreference(preference)));
  } catch {
    /* storage unavailable — the theme still works for this visit */
  }
}

/**
 * Paints the document: `data-theme` is the resolved theme (the CSS matches on
 * it) and `data-theme-pref` is the preference.
 */
export function applyTheme(root, theme, preference) {
  if (!root) return;
  root.dataset.theme = theme;
  root.dataset.themePref = normalisePreference(preference);
}

/** Whether the device asks for a dark page. */
export function systemPrefersDark() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * The inline script that runs before the first paint.
 *
 * It has to be a plain string because it is inlined into the HTML: it cannot
 * import anything, so it repeats the storage key and the JSON shape that
 * `readPreference` above uses. Keep the two in step.
 *
 * It sets attributes on <html>. The body background is a token like every
 * other surface, so CSS paints the rest.
 *
 * It also answers a click on the theme button that lands before React has
 * hydrated — on a slow connection the button is on screen with no handler
 * attached, and a dead-looking control is worse than a late one. The script
 * flips the theme itself and stops the event, then `ThemeProvider` marks
 * <html> as hydrated and React takes the button over from there.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var r=document.documentElement;var k="${THEME_KEY}";function read(){try{var s=localStorage.getItem(k);if(!s)return "system";var v=JSON.parse(s);return (v==="light"||v==="dark"||v==="system")?v:"system"}catch(e){return "system"}}function apply(p){var d=false;if(window.matchMedia){d=window.matchMedia("(prefers-color-scheme: dark)").matches}r.dataset.themePref=p;r.dataset.theme=(p==="light")?"light":(p==="dark")?"dark":(d?"dark":"light")}apply(read());document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest||!t.closest("[data-theme-toggle]"))return;if(r.dataset.themeHydrated)return;e.preventDefault();e.stopPropagation();var next=(r.dataset.theme==="dark")?"light":"dark";try{localStorage.setItem(k,JSON.stringify(next))}catch(err){}apply(next)},true)}catch(e){}})();`;
