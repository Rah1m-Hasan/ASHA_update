#!/usr/bin/env node
// Download the self-hosted web fonts.
//
// The fonts are committed to the repository, so this script is not part of the
// build. It exists so the files can be rebuilt, and so their provenance
// (the exact Google Fonts URL, weight range and unicode range) is recorded
// next to them in a .meta file.
//
//   node scripts/fetch-fonts.mjs
//
// The script asks the Google Fonts CSS API for the woff2 files, using a
// browser user agent so the API returns the variable-font subsets. Each file
// lands in public/fonts/ with a .meta file describing where it came from.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/fonts");

// A modern Chrome user agent: the Google Fonts API serves variable woff2
// subsets, one @font-face per unicode range, only for browsers it knows.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// The three families Asha uses. Figtree is the text face, Fraunces the display
// face, Anek Bangla carries Bangla.
const FAMILIES = [
  { query: "Figtree:wght@300..900", family: "Figtree", slug: "figtree" },
  { query: "Fraunces:wght@300..700", family: "Fraunces", slug: "fraunces" },
  { query: "Anek+Bangla:wght@300..800", family: "Anek Bangla", slug: "anek-bangla" },
];

// Google names each subset by its unicode range. These are the ranges the
// families above are served with, mapped to a short label for the filename.
// A range is matched by what it contains, not by where it starts: the Bengali
// range begins with a narrower block than the Bengali letters it also covers.
const SUBSET_LABELS = [
  ["U+1EA0-1EF9", "vietnamese"],
  ["U+0980-09FE", "bangla"],
  ["U+0951-0952", "bangla-ext"],
  ["U+0100-02BA", "latin-ext"],
  ["U+0000-00FF", "latin"],
];

/** Which subset a unicode range belongs to. */
function labelFor(unicodeRange) {
  for (const [marker, label] of SUBSET_LABELS) {
    if (unicodeRange.includes(marker)) return label;
  }
  return "subset";
}

async function cssFor(query) {
  const url = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return res.text();
}

/** Every @font-face block in a Google Fonts stylesheet. */
function parseFaces(css) {
  const faces = [];
  for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
    const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    if (!url) continue;
    faces.push({
      url,
      weight: block.match(/font-weight:\s*([^;]+);/)?.[1]?.trim() ?? "400",
      range: block.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim() ?? "",
      style: block.match(/font-style:\s*([^;]+);/)?.[1]?.trim() ?? "normal",
    });
  }
  return faces;
}

async function download(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

fs.mkdirSync(OUT, { recursive: true });

for (const { query, family, slug } of FAMILIES) {
  const faces = parseFaces(await cssFor(query));
  if (!faces.length) throw new Error(`No woff2 faces found for ${family}`);

  for (const face of faces) {
    const label = labelFor(face.range);
    const name = `${slug}-${label}.woff2`;
    const bytes = await download(face.url);
    fs.writeFileSync(path.join(OUT, name), bytes);
    fs.writeFileSync(
      path.join(OUT, `${name}.meta`),
      [
        `url=${face.url}`,
        `family=${family}`,
        `weight=${face.weight}`,
        `style=${face.style}`,
        `unicode-range=${face.range}`,
        "",
      ].join("\n"),
    );
    console.log(`wrote public/fonts/${name} (${bytes.length} bytes)`);
  }
}

console.log("Fonts downloaded.");
