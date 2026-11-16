#!/usr/bin/env node
// The Asha design tokens live here and nowhere else.
//
// One palette, three surfaces: the React app (Tailwind), the assistive app and
// the Everyday companion (plain CSS).
//
// This script writes, from the single palette below:
//   src/app/globals.css       the @theme block and the runtime colour values
//   src/app/asha-fonts.css    @font-face rules for the self-hosted families
//   public/app/asha-tokens.css the same colour values plus the legacy aliases
//   public/app/asha-fonts.css  the same font rules for the two legacy apps
//
// Run it after changing the palette:  node scripts/tokens.mjs
// Check it before a commit:         node scripts/tokens.mjs --check
//
// The palette is checked for contrast as it is written, so a colour that would
// be hard to read fails here rather than on someone's phone.
//
// How the runtime theme works
// ----------------------------
// Tailwind's @theme only declares *names*; the values live in CSS variables
// under :root and :root[data-theme="dark"]. A colour utility therefore reads
// var(--color-brand) -> var(--asha-brand), and an opacity modifier such as
// bg-brand/20 resolves through color-mix() at run time, so it follows the
// theme too. That is why @theme points at var(--asha-*) instead of a literal
// hex: a literal would be baked into the colour-mix and would not flip.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GLOBALS_CSS = path.join(ROOT, "src/app/globals.css");
const APP_FONTS_CSS = path.join(ROOT, "src/app/asha-fonts.css");
const TOKENS_CSS = path.join(ROOT, "public/app/asha-tokens.css");
const LEGACY_FONTS_CSS = path.join(ROOT, "public/app/asha-fonts.css");
const FONT_DIR = path.join(ROOT, "public/fonts");

const THEME_START = "/* --- asha-tokens:start --- */";
const THEME_END = "/* --- asha-tokens:end --- */";

// ---------------------------------------------------------------------------
// The palette
// ---------------------------------------------------------------------------
// Signal & Wave: a paper-white surface, one ink-navy text colour, one
// saturated blue for what is live, and a navy-to-teal spectrum that appears
// only in gradients. Status colours carry meaning on their own.

const LIGHT = {
  canvas: "#ffffff", // the page itself
  surface: "#ffffff", // cards and panels
  sunken: "#e9eef5", // inset wells, tracks, disabled fills
  wash: "#f2f5f9", // a quiet band of page background
  heading: "#0b1728", // headings: near-black with a blue cast
  ink: "#0e1c2f", // body text
  muted: "#5a6b80", // secondary text
  subtle: "#8494a6", // captions and decorative marks, never body copy
  line: "#dde4ed", // hairlines
  "line-strong": "#c3cedd", // emphasised borders
  brand: "#1b57c9", // the one accent: live, active, yours
  "brand-hover": "#1647a8",
  "brand-soft": "#eff5fe", // a brand-tinted wash
  "brand-mint": "#dce9fb", // a stronger brand tint
  "on-brand": "#ffffff", // text on a brand fill
  good: "#0f7a4f",
  "good-soft": "#e7f5ee",
  "good-line": "#b9e0cd",
  "good-strong": "#0f7a4f", // a solid fill that carries white text
  "on-good": "#ffffff", // text on a good fill
  warn: "#9a5b06",
  "warn-soft": "#fdf3e3",
  "warn-line": "#f0d9ae",
  "warn-strong": "#b26a00", // a solid amber fill: bars and dots, never body text
  danger: "#a63c32", // unchanged: this value is referenced in docs
  "danger-soft": "#fbedeb",
  "danger-line": "#edc4be",
  "danger-strong": "#a63c32", // a solid fill that carries white text
  "danger-hover": "#8f332b",
  "on-danger": "#ffffff", // text on a danger fill
  // The veil sits over photographs and camera feeds. It stays dark in both
  // themes: a light scrim would wash out what is behind it.
  veil: "#0b1728",
  "on-veil": "#ffffff", // text on the veil
  // A deep navy panel. It stays the same in both themes: these panels are
  // deliberately dark, like a stage light on the page.
  deep: "#15345b",
  "on-deep": "#f1f5f9",
  "deep-accent": "#93c5fd",
  "deep-muted": "#cbd9ed",
};

const DARK = {
  canvas: "#0b1424",
  surface: "#16263d",
  sunken: "#1d3049",
  wash: "#0e1b2d",
  heading: "#f4f8fc",
  ink: "#e8eff7",
  muted: "#a3b4c8",
  subtle: "#7c8fa6",
  line: "#263850",
  "line-strong": "#354c68",
  brand: "#6fa8ff",
  "brand-hover": "#8fbdff",
  "brand-soft": "#16273f",
  "brand-mint": "#1e3a5c",
  "on-brand": "#08111f",
  "on-veil": "#ffffff",
  good: "#5fd3a0",
  "good-soft": "#12281d",
  "good-line": "#1f5b44",
  "good-strong": "#14795a",
  "on-good": "#ffffff",
  warn: "#f0b95c",
  "warn-soft": "#2b2113",
  "warn-line": "#5c4718",
  "warn-strong": "#f7cd8b",
  danger: "#f28b7f",
  "danger-soft": "#2b1613",
  "danger-line": "#5e2b23",
  "danger-strong": "#c0392f",
  "danger-hover": "#cf4438",
  "on-danger": "#ffffff",
  veil: "#0b1728",
  deep: "#15345b",
  "on-deep": "#f1f5f9",
  "deep-accent": "#93c5fd",
  "deep-muted": "#cbd9ed",
};

// The spectrum, used only in gradients and the wave motif.
const SPECTRUM = ["#0b2e6f", "#1b57c9", "#2f74e8", "#38d6c4"];

// Type. Fraunces for display, Figtree for everything else, Anek Bangla for
// Bangla. Declared in the generated font stylesheet and wired here as Tailwind
// font utilities.
const FONTS = {
  sans: '"Figtree", "Anek Bangla", system-ui, -apple-system, "Segoe UI", sans-serif',
  display: '"Fraunces", "Figtree", "Anek Bangla", Georgia, serif',
};

// A type scale, so a heading is never an arbitrary pixel value. The "-sm"
// steps are the small-screen sizes; a heading pair is `text-display-sm
// sm:text-display-lg`, so a 4.25rem line never lands on a phone.
//
// The two large steps are fluid, so the jump at the `sm` breakpoint is a ramp
// rather than a step: at 640px a display heading is still 2.5rem, exactly the
// small-screen size, and it grows with the window from there.
const TYPE = {
  display: ["3.5rem", { "line-height": "1.02", "letter-spacing": "-0.03em" }],
  "display-lg": ["clamp(2.5rem, 5.5vw, 4.25rem)", { "line-height": "0.98", "letter-spacing": "-0.035em" }],
  "display-sm": ["2.5rem", { "line-height": "1.06", "letter-spacing": "-0.025em" }],
  title: ["2rem", { "line-height": "1.15", "letter-spacing": "-0.02em" }],
  "title-lg": ["clamp(2.125rem, 3.4vw, 2.5rem)", { "line-height": "1.1", "letter-spacing": "-0.025em" }],
  "title-sm": ["2.125rem", { "line-height": "1.18", "letter-spacing": "-0.02em" }],
  lead: ["1.125rem", { "line-height": "1.65" }],
  label: ["0.875rem", { "line-height": "1.45" }],
  caption: ["0.75rem", { "line-height": "1.4" }],
};

// Radii. One set, used everywhere.
const RADII = {
  xs: "0.375rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.125rem",
  "2xl": "1.25rem",
  "3xl": "1.75rem",
};

// Shadows. Restrained: a hairline border does most of the work, and a shadow
// only says "this floats".
const SHADOWS = {
  xs: "0 1px 2px #0e1c2f0a",
  sm: "0 1px 3px #0e1c2f12, 0 1px 2px #0e1c2f0a",
  md: "0 6px 16px -4px #0e1c2f1a, 0 2px 6px -2px #0e1c2f0f",
  lg: "0 18px 48px -12px #0e1c2f26, 0 4px 10px -4px #0e1c2f12",
  // Legacy names kept so old stylesheets keep working.
  card: "0 6px 16px -4px #0e1c2f1a, 0 2px 6px -2px #0e1c2f0f",
  float: "0 18px 48px -12px #0e1c2f26, 0 4px 10px -4px #0e1c2f12",
};

const SHADOWS_DARK = {
  xs: "0 1px 2px #00000040",
  sm: "0 1px 3px #00000059, 0 1px 2px #00000040",
  md: "0 6px 16px -4px #00000066, 0 2px 6px -2px #0000004d",
  lg: "0 18px 48px -12px #00000080, 0 4px 10px -4px #00000059",
  card: "0 6px 16px -4px #00000066, 0 2px 6px -2px #0000004d",
  float: "0 18px 48px -12px #00000080, 0 4px 10px -4px #00000059",
};

const MOTION = {
  ease: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  fast: "120ms",
  base: "180ms",
  slow: "260ms",
};

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

function luminance(hex) {
  const v = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Every pair a person might actually read, and the ratio each must clear. */
const READS = [
  ["body text on the page", "ink", "canvas", 4.5],
  ["body text on a card", "ink", "surface", 4.5],
  ["headings on a card", "heading", "surface", 4.5],
  ["headings on the page", "heading", "canvas", 4.5],
  ["secondary text on a card", "muted", "surface", 4.5],
  ["secondary text on the page", "muted", "canvas", 4.5],
  ["secondary text on a quiet band", "muted", "wash", 4.5],
  ["the accent on a card", "brand", "surface", 4.5],
  ["the accent on the page", "brand", "canvas", 4.5],
  ["the accent on its own pale wash", "brand", "brand-soft", 4.5],
  ["text on a filled accent button", "on-brand", "brand", 4.5],
  ["text on the veil", "on-veil", "veil", 4.5],
  ["text on a deep panel", "on-deep", "deep", 4.5],
  ["accent on a deep panel", "deep-accent", "deep", 4.5],
  ["muted text on a deep panel", "deep-muted", "deep", 4.5],
  ["good on its own pale wash", "good", "good-soft", 4.5],
  ["warn on its own pale wash", "warn", "warn-soft", 4.5],
  ["danger on its own pale wash", "danger", "danger-soft", 4.5],
  ["danger text on the page", "danger", "canvas", 4.5],
  ["good text on the page", "good", "canvas", 4.5],
  ["warn text on the page", "warn", "canvas", 4.5],
  ["the accent on the quiet band", "brand", "wash", 4.5],
  ["text on a solid danger button", "on-danger", "danger-strong", 4.5],
  ["text on a hovered danger button", "on-danger", "danger-hover", 4.5],
  ["text on a solid good button", "on-good", "good-strong", 4.5],
  ["danger text on the quiet band", "danger", "wash", 4.5],
  ["good text on the quiet band", "good", "wash", 4.5],
];

/** A colour is either a token name in the palette or a literal hex. */
function resolve(palette, name) {
  if (name.startsWith("#")) return name;
  const value = palette[name];
  if (!value) throw new Error(`Unknown colour token "${name}"`);
  return value;
}

function checkContrast(palette, label) {
  const failures = [];
  for (const [what, fg, bg, need] of READS) {
    const ratio = contrast(resolve(palette, fg), resolve(palette, bg));
    if (ratio < need) failures.push(`  ${label}: ${what} is ${ratio.toFixed(2)}:1, needs ${need}:1`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

const cssVars = (obj, indent = "  ") =>
  Object.entries(obj)
    .map(([k, v]) => `${indent}--asha-${k}: ${v};`)
    .join("\n");

/**
 * The plain-CSS token file for the legacy apps.
 *
 * It defines the canonical `--asha-*` names and then aliases the names the two
 * legacy stylesheets already use (--bg, --card, --ink, --accent and so on) to
 * them. The aliases are var() references, so they follow the dark theme
 * without a second set of rules.
 */
function tokensCss() {
  const legacyAliases = [
    // public/app/style.css
    ["bg", "wash"],
    ["card", "surface"],
    ["soft", "brand-soft"],
    ["ink", "ink"],
    ["muted", "muted"],
    ["line", "line"],
    ["accent", "brand"],
    ["accent-hover", "brand-hover"],
    ["accent-ink", "on-brand"],
    ["mint", "brand-mint"],
    ["lavender", "brand-soft"],
    ["danger", "danger"],
    ["shadow", "shadow-md"],
    // The deep navy panels that stay dark in both themes.
    ["deep", "deep"],
    ["on-deep", "on-deep"],
    ["deep-accent", "deep-accent"],
    ["deep-muted", "deep-muted"],
    // public/app/everyday/style.css
    ["surface", "surface"],
    ["radius", "radius-2xl"],
    // public/app/style.css icon colours
    ["icon-primary", "brand"],
    ["icon-secondary", "muted"],
    ["icon-ink", "ink"],
    ["icon-soft", "brand-soft"],
    // The names the phone mockup in public/app/style.css uses.
    ["canvas", "canvas"],
    ["heading", "heading"],
    ["good", "good"],
    ["good-soft", "good-soft"],
    ["brand-mint", "brand-mint"],
  ];

  const aliasBlock = legacyAliases
    .map(([legacy, canonical]) => `  --${legacy}: var(--asha-${canonical});`)
    .join("\n");

  return `/* Generated by scripts/tokens.mjs — do not edit by hand.
   The one palette for Asha: the React app, the assistive app and Everyday.
   Run "node scripts/tokens.mjs" after changing it. */

:root {
  color-scheme: light;

${cssVars(LIGHT)}


  /* Geometry */
  --asha-radius-xs: ${RADII.xs};
  --asha-radius-sm: ${RADII.sm};
  --asha-radius-md: ${RADII.md};
  --asha-radius-lg: ${RADII.lg};
  --asha-radius-xl: ${RADII.xl};
  --asha-radius-2xl: ${RADII["2xl"]};
  --asha-radius-3xl: ${RADII["3xl"]};

  /* Shadows */
  --asha-shadow-xs: ${SHADOWS.xs};
  --asha-shadow-sm: ${SHADOWS.sm};
  --asha-shadow-md: ${SHADOWS.md};
  --asha-shadow-lg: ${SHADOWS.lg};
  --asha-shadow-card: ${SHADOWS.card};
  --asha-shadow-float: ${SHADOWS.float};

  /* Type */
  --asha-font-sans: ${FONTS.sans};
  --asha-font-display: ${FONTS.display};

  /* Motion */
  --asha-ease: ${MOTION.ease};
  --asha-duration-fast: ${MOTION.fast};
  --asha-duration: ${MOTION.base};
  --asha-duration-slow: ${MOTION.slow};

  /* The spectrum. Gradients and the wave only, never a competing accent. */
  --asha-spectrum: ${SPECTRUM.join(", ")};

  /* The names the two legacy stylesheets already use. */
${aliasBlock}
}

:root[data-theme="dark"] {
  color-scheme: dark;

${cssVars(DARK)}

  --asha-shadow-xs: ${SHADOWS_DARK.xs};
  --asha-shadow-sm: ${SHADOWS_DARK.sm};
  --asha-shadow-md: ${SHADOWS_DARK.md};
  --asha-shadow-lg: ${SHADOWS_DARK.lg};
  --asha-shadow-card: ${SHADOWS_DARK.card};
  --asha-shadow-float: ${SHADOWS_DARK.float};
}
`;
}

/**
 * The @font-face rules for the self-hosted families.
 *
 * The families are variable fonts, split into unicode-range subsets by the
 * fetch script. Every subset of a family shares the family name, so the
 * browser downloads only the ranges a page actually uses.
 */
function fontsCss() {
  const faces = fs
    .readdirSync(FONT_DIR)
    .filter((f) => f.endsWith(".meta"))
    .map((file) => {
      const meta = Object.fromEntries(
        fs
          .readFileSync(path.join(FONT_DIR, file), "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const i = line.indexOf("=");
            return [line.slice(0, i), line.slice(i + 1)];
          }),
      );
      const woff2 = file.replace(/\.meta$/, "");
      return { family: meta.family, weight: meta.weight, style: meta.style, range: meta["unicode-range"], woff2 };
    })
    .sort((a, b) => a.family.localeCompare(b.family) || a.woff2.localeCompare(b.woff2));

  if (!faces.length) throw new Error(`No font metadata found in ${FONT_DIR}. Run "node scripts/fetch-fonts.mjs".`);

  const blocks = faces.map(
    (f) => `@font-face {
  font-family: "${f.family}";
  src: url("/fonts/${f.woff2}") format("woff2");
  font-weight: ${f.weight};
  font-style: ${f.style};
  font-display: swap;
  unicode-range: ${f.range};
}`,
  );

  return `/* Generated by scripts/tokens.mjs — do not edit by hand.
   Self-hosted variable fonts. The files live in public/fonts; the fetch script
   (scripts/fetch-fonts.mjs) records where each one came from. */

${blocks.join("\n\n")}
`;
}

/**
 * Tailwind's copy of the palette.
 *
 * The colour and shadow utilities point at var(--asha-*) rather than at a
 * literal hex, so that an opacity modifier (bg-brand/20) resolves through
 * color-mix() at run time and follows the theme. The values themselves live
 * in :root, below.
 */
function themeBlock() {
  const colorVars = Object.keys(LIGHT)
    .map((k) => `  --color-${k}: var(--asha-${k});`)
    .join("\n");

  const typeVars = Object.entries(TYPE)
    .map(([k, [size, opts]]) => {
      const extra = Object.entries(opts)
        .map(([o, v]) => `    --text-${k}--${o}: ${v};`)
        .join("\n");
      return `  --text-${k}: ${size};\n${extra}`;
    })
    .join("\n");

  const radiusVars = Object.entries(RADII)
    .map(([k, v]) => `  --radius-${k}: ${v};`)
    .join("\n");

  const shadowVars = Object.keys(SHADOWS)
    .map((k) => `  --shadow-${k}: var(--asha-shadow-${k});`)
    .join("\n");

  return `${THEME_START}
@theme {
  --font-sans: ${FONTS.sans};
  --font-display: ${FONTS.display};

${colorVars}

${typeVars}

${radiusVars}

${shadowVars}

  --ease-out-quart: ${MOTION.ease};
}

/* The colour values. These are the ones the theme switches: the dark block
   below redefines them, and every utility above reads through var(). */
:root {
${cssVars(LIGHT)}

  --asha-shadow-xs: ${SHADOWS.xs};
  --asha-shadow-sm: ${SHADOWS.sm};
  --asha-shadow-md: ${SHADOWS.md};
  --asha-shadow-lg: ${SHADOWS.lg};
  --asha-shadow-card: ${SHADOWS.card};
  --asha-shadow-float: ${SHADOWS.float};
}

:root[data-theme="dark"] {
${cssVars(DARK)}

  --asha-shadow-xs: ${SHADOWS_DARK.xs};
  --asha-shadow-sm: ${SHADOWS_DARK.sm};
  --asha-shadow-md: ${SHADOWS_DARK.md};
  --asha-shadow-lg: ${SHADOWS_DARK.lg};
  --asha-shadow-card: ${SHADOWS_DARK.card};
  --asha-shadow-float: ${SHADOWS_DARK.float};
}
${THEME_END}`;
}

function replaceThemeBlock(existing) {
  const start = existing.indexOf(THEME_START);
  const end = existing.indexOf(THEME_END);
  if (start === -1 || end === -1) {
    throw new Error(
      `src/app/globals.css has no token block. Expected the markers\n  ${THEME_START}\n  ${THEME_END}`,
    );
  }
  return existing.slice(0, start) + themeBlock() + existing.slice(end + THEME_END.length);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const check = process.argv.includes("--check");
const failures = [...checkContrast(LIGHT, "light"), ...checkContrast(DARK, "dark")];

if (failures.length) {
  console.error("Contrast is too low for these pairs:\n" + failures.join("\n"));
  process.exit(1);
}

const tokens = tokensCss();
const fonts = fontsCss();

let globals = fs.readFileSync(GLOBALS_CSS, "utf8");
globals = replaceThemeBlock(globals);

const outputs = [
  [TOKENS_CSS, tokens],
  [GLOBALS_CSS, globals],
  [APP_FONTS_CSS, fonts],
  [LEGACY_FONTS_CSS, fonts],
];

if (check) {
  const stale = outputs.filter(([file, next]) => {
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    return current !== next;
  });
  if (stale.length) {
    console.error(
      "These files are out of date with scripts/tokens.mjs:\n" +
        stale.map(([f]) => `  ${path.relative(ROOT, f)}`).join("\n") +
        "\nRun: node scripts/tokens.mjs",
    );
    process.exit(1);
  }
  console.log("Tokens are up to date, and every colour pair clears its contrast ratio.");
} else {
  for (const [file, next] of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, next);
    console.log(`wrote ${path.relative(ROOT, file)}`);
  }
  console.log("Tokens written, and every colour pair clears its contrast ratio.");
}
