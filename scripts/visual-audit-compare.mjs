#!/usr/bin/env node
// Compares two sweep reports — the pre-repair baseline and the current build —
// and writes the comparison table.
//
//   node scripts/visual-audit-compare.mjs \
//     --baseline artifacts/visual-audit/baseline/report.json \
//     --current  artifacts/visual-audit/current/report.json \
//     --out      artifacts/visual-audit/comparison.md
//
// The two reports are measured by the same probes and the same route manifest,
// against two different servers. That is the only thing that makes the
// comparison mean anything: the probes must be the same on both sides.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const BASELINE = arg("baseline", "artifacts/visual-audit/baseline/report.json");
const CURRENT = arg("current", "artifacts/visual-audit/current/report.json");
const OUT = arg("out", "artifacts/visual-audit/comparison.md");

// "chromeOverlap" is the floating chrome — the Asha bubble, the bottom bar,
// the sticky headers — crossing the content it floats over. It is counted
// apart from the defects, because it is what floating furniture does. Every
// other code the probe emits is a defect.
const FURNITURE = new Set(["chromeOverlap"]);

const load = async (file) => {
  const raw = JSON.parse(await readFile(file, "utf8"));
  return Array.isArray(raw) ? raw : raw.records || [];
};

const summarise = (records) => {
  const byType = {};
  const screens = new Set();
  const variants = new Set();
  let renders = 0;
  let furniture = 0;
  for (const rec of records) {
    renders += 1;
    variants.add(rec.variant);
    const findings = rec.findings || [];
    if (!findings.length) continue;
    screens.add(rec.route);
    for (const f of findings) {
      if (FURNITURE.has(f.type)) {
        furniture += 1;
        continue;
      }
      byType[f.type] = (byType[f.type] || 0) + 1;
    }
  }
  return { renders, variants: [...variants].sort(), byType, screens: screens.size, furniture };
};

const defectTotal = (s) =>
  Object.values(s.byType).reduce((a, b) => a + b, 0);

const baseline = summarise(await load(BASELINE));
const current = summarise(await load(CURRENT));

const codes = [
  ...new Set([...Object.keys(baseline.byType), ...Object.keys(current.byType)]),
].sort();

const lines = [];
lines.push("# Baseline versus current build");
lines.push("");
lines.push(
  "Both sides were measured by the same probes (`scripts/visual-audit.probes.mjs`)",
  "over the same route manifest (`scripts/visual-audit.routes.mjs`), so the numbers",
  "below compare like with like. The baseline is the pre-repair commit served on",
  "port 4181; the current build is this branch served on port 4180.",
);
lines.push("");
lines.push("| | Baseline | Current |");
lines.push("| --- | --- | --- |");
lines.push(`| Renders measured | ${baseline.renders} | ${current.renders} |`);
lines.push(
  `| Variants | ${baseline.variants.join(", ") || "—"} | ${current.variants.join(", ") || "—"} |`,
);
lines.push(
  `| Screens with a defect | ${baseline.screens} | ${current.screens} |`,
);
lines.push(
  `| **Defects (excluding floating chrome)** | **${defectTotal(baseline)}** | **${defectTotal(current)}** |`,
);
lines.push(`| Floating-chrome overlaps | ${baseline.furniture} | ${current.furniture} |`);
lines.push("");
lines.push("### By defect type");
lines.push("");
lines.push("| Defect | Baseline | Current |");
lines.push("| --- | ---: | ---: |");
if (codes.length === 0) {
  lines.push("| — | 0 | 0 |");
} else {
  for (const code of codes) {
    lines.push(
      `| \`${code}\` | ${baseline.byType[code] || 0} | ${current.byType[code] || 0} |`,
    );
  }
}
lines.push("");

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, lines.join("\n") + "\n");
console.log(lines.join("\n"));
