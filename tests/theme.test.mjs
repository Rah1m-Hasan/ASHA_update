import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTheme,
  normalisePreference,
  readPreference,
  resolveTheme,
  systemPrefersDark,
  writePreference,
  THEME_INIT_SCRIPT,
  THEME_KEY,
} from "../src/features/theme/theme.js";

/** A stand-in for `window.localStorage`. `fail` makes every call throw. */
function fakeStorage(initial = {}, { fail = false } = {}) {
  const map = { ...initial };
  return {
    getItem: (k) => {
      if (fail) throw new Error("storage unavailable");
      return k in map ? map[k] : null;
    },
    setItem: (k, v) => {
      if (fail) throw new Error("storage unavailable");
      map[k] = String(v);
    },
    map,
  };
}

/** A stand-in for `document.documentElement`. */
function fakeRoot() {
  return { dataset: {} };
}

/**
 * Runs the inline init script against a fake document, window and storage.
 * The script is a plain string because it is inlined into the HTML, so it
 * cannot import anything — these tests are what keeps it in step with the
 * module above.
 */
function runInit({ stored = null, systemDark = false, matchMedia = true } = {}) {
  const root = fakeRoot();
  const document = { documentElement: root };
  const window = matchMedia ? { matchMedia: () => ({ matches: systemDark }) } : {};
  const localStorage = {
    getItem: () => stored,
  };
  const script = new Function("document", "window", "localStorage", THEME_INIT_SCRIPT);
  script(document, window, localStorage);
  return root.dataset;
}

test("an unrecognised preference falls back to following the device", () => {
  assert.equal(normalisePreference("light"), "light");
  assert.equal(normalisePreference("dark"), "dark");
  assert.equal(normalisePreference("system"), "system");
  for (const value of ["", "Dark", "auto", null, undefined, 42, {}]) {
    assert.equal(normalisePreference(value), "system");
  }
});

test("a fixed preference always wins and system follows the device", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("nonsense", true), "dark");
});

test("the stored preference is read as JSON, like the shared storage helper writes it", () => {
  assert.equal(readPreference(fakeStorage()), "system");
  assert.equal(readPreference(fakeStorage({ [THEME_KEY]: '"dark"' })), "dark");
  assert.equal(readPreference(fakeStorage({ [THEME_KEY]: '"light"' })), "light");
  assert.equal(readPreference(fakeStorage({ [THEME_KEY]: '"system"' })), "system");
  // A bare word, a broken value or an unknown one all fall back safely.
  assert.equal(readPreference(fakeStorage({ [THEME_KEY]: "dark" })), "system");
  assert.equal(readPreference(fakeStorage({ [THEME_KEY]: "{" })), "system");
  assert.equal(readPreference(fakeStorage({ [THEME_KEY]: '"sepia"' })), "system");
  // Storage that throws is not a reason to break the page.
  assert.equal(readPreference(fakeStorage({}, { fail: true })), "system");
});

test("the preference is stored as JSON under the shared house key", () => {
  const storage = fakeStorage();
  writePreference(storage, "dark");
  assert.equal(storage.map[THEME_KEY], '"dark"');
  assert.equal(readPreference(storage), "dark");

  writePreference(storage, "nonsense");
  assert.equal(storage.map[THEME_KEY], '"system"');

  // Storage that throws is swallowed — the theme still works for this visit.
  writePreference(fakeStorage({}, { fail: true }), "dark");
});

test("the theme key matches the shared house prefix used by src/lib/storage.ts", () => {
  assert.equal(THEME_KEY, "asha_live_theme");
});

test("applying a theme paints the resolved theme and records the preference", () => {
  const root = fakeRoot();
  applyTheme(root, "dark", "system");
  assert.equal(root.dataset.theme, "dark");
  assert.equal(root.dataset.themePref, "system");

  applyTheme(root, "light", "light");
  assert.equal(root.dataset.theme, "light");
  assert.equal(root.dataset.themePref, "light");

  // A missing element is not a crash.
  applyTheme(null, "dark", "dark");
});

test("the inline init script resolves the same theme as the module", () => {
  assert.deepEqual(runInit({ systemDark: false }), { themePref: "system", theme: "light" });
  assert.deepEqual(runInit({ systemDark: true }), { themePref: "system", theme: "dark" });
  assert.deepEqual(runInit({ stored: '"dark"', systemDark: false }), {
    themePref: "dark",
    theme: "dark",
  });
  assert.deepEqual(runInit({ stored: '"light"', systemDark: true }), {
    themePref: "light",
    theme: "light",
  });
  assert.deepEqual(runInit({ stored: '"system"', systemDark: true }), {
    themePref: "system",
    theme: "dark",
  });
  // A broken stored value falls back to the device, and a browser without
  // matchMedia falls back to light.
  assert.deepEqual(runInit({ stored: "dark", systemDark: true }), {
    themePref: "system",
    theme: "dark",
  });
  assert.deepEqual(runInit({ stored: '"sepia"', systemDark: false }), {
    themePref: "system",
    theme: "light",
  });
  assert.deepEqual(runInit({ matchMedia: false }), { themePref: "system", theme: "light" });
});

test("the inline init script reads the same storage key as the module", () => {
  assert.ok(
    THEME_INIT_SCRIPT.includes(THEME_KEY),
    "the inlined script repeats the storage key and must stay in step with THEME_KEY",
  );
});

test("a click on the theme button works before React hydrates, and hands over after", () => {
  const root = fakeRoot();
  const listeners = {};
  const document = {
    documentElement: root,
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
  };
  const window = { matchMedia: () => ({ matches: false }) };
  const store = { value: null };
  const localStorage = {
    getItem: () => store.value,
    setItem: (_k, v) => {
      store.value = v;
    },
  };
  const script = new Function("document", "window", "localStorage", THEME_INIT_SCRIPT);
  script(document, window, localStorage);

  // The button is on screen with no React handler attached yet.
  const button = { closest: (sel) => (sel === "[data-theme-toggle]" ? button : null) };
  const event = { target: button, preventDefault() {}, stopPropagation() {} };
  listeners.click(event);
  assert.equal(root.dataset.theme, "dark");
  assert.equal(store.value, '"dark"');

  // A click somewhere else is none of the script's business.
  listeners.click({ target: { closest: () => null }, preventDefault() {}, stopPropagation() {} });
  assert.equal(root.dataset.theme, "dark");

  // Once React is live the script stands down and leaves the button to it.
  root.dataset.themeHydrated = "1";
  listeners.click(event);
  assert.equal(root.dataset.theme, "dark");
});

test("the device's preference is only consulted where it exists", () => {
  assert.equal(systemPrefersDark(), false);
});
