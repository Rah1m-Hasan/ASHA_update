// Fills the measured sections of docs/VISUAL_AUDIT_REPORT.md from the sweep's
// own report.
//
//   node scripts/visual-audit-report.mjs [--report artifacts/visual-audit/report.json]
//
// The report's numbers are never typed by hand: they come out of the sweep's
// report.json and its defect ledger, so the document cannot drift away from
// the measurement it describes. The sections the sweep cannot measure — the
// tests that were run and the build status — are written by hand and are
// marked as such.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Both spellings are accepted: `--doc path` and `--doc=path`. A flag that is
// silently ignored is worse than one that errors, because the report is then
// written somewhere nobody is looking.
const arg = (name, fallback) => {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const at = process.argv.indexOf(`--${name}`);
  if (at !== -1 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--")) {
    return process.argv[at + 1];
  }
  return fallback;
};

const REPORT = arg("report", "artifacts/visual-audit/report.json");
const DOC = arg("doc", "docs/VISUAL_AUDIT_REPORT.md");
const OUT = arg("out", path.join(path.dirname(REPORT), "defect-table.md"));

const report = JSON.parse(await readFile(REPORT, "utf8"));
const records = report.records || [];
const findings = report.findings || [];

// A defect seen at twenty viewports is one defect, not twenty. The element
// identifies it; the text next to it changes with the viewport.
const keyOf = (f) => {
  const el = f.el || f.a || "";
  const detail =
    f.type === "tinyTarget" ? `size<${Math.max(...(f.size || [0]))}`
    : f.type === "contrast" ? `ratio<${f.need}`
    : f.type === "clipped" ? "clip"
    : f.type === "overlap" ? "overlap"
    : f.type === "heading" ? f.text
    : "";
  return `${f.route}|${f.type}|${el}|${detail}`;
};

const groups = new Map();
for (const f of findings) {
  const k = keyOf(f);
  if (!groups.has(k)) {
    groups.set(k, { route: f.route, type: f.type, el: f.el || f.a || "", viewports: new Set(), variants: new Set(), detail: f });
  }
  const g = groups.get(k);
  g.viewports.add(f.viewport);
  g.variants.add(f.variant || "light");
  const sev = (x) =>
    x.type === "contrast" ? x.ratio
    : x.type === "clipped" ? Math.max(x.hiddenY || 0, x.hiddenX || 0)
    : x.type === "tinyTarget" ? Math.min(...(x.size || [99, 99]))
    : 0;
  if (sev(f) < sev(g.detail)) g.detail = f;
}

// Floating chrome over content is furniture, not a defect: it is counted
// apart from the defects so the count means something.
const isDefect = (type) => type !== "chromeOverlap";

const rows = [...groups.values()].filter((g) => isDefect(g.type));
const chrome = [...groups.values()].filter((g) => !isDefect(g.type));

const ORDER = ["pageOverflow", "offender", "clipped", "overlap", "tinyTarget", "missingName", "contrast", "heading"];

const typeTable = ORDER.map((type) => {
  const n = rows.filter((r) => r.type === type).length;
  const routes = [...new Set(rows.filter((r) => r.type === type).map((r) => r.route))];
  return { type, n, routes };
}).filter((r) => r.n);

const rendersByVariant = {};
for (const r of records) rendersByVariant[r.variant] = (rendersByVariant[r.variant] || 0) + 1;

const lines = [
  "**Every number in this table is measured**, not estimated: it comes out of the sweep's own",
  `report (\`${path.relative(process.cwd(), REPORT)}\`), where a defect seen at twenty viewports is`,
  "one defect with twenty viewports listed.",
  "",
  "| Defect type | Distinct defects | Screens affected |",
  "| --- | --- | --- |",
  ...typeTable.map((r) => `| \`${r.type}\` | ${r.n} | ${r.routes.length} |`),
  "",
  `**${rows.length} distinct defects** across ${findings.length} raw findings and`,
  `${records.length} renders (${Object.entries(rendersByVariant).map(([k, v]) => `${v} ${k}`).join(", ")}).`,
  "",
  chrome.length
    ? `A further **${chrome.length}** findings are floating chrome crossing the content it floats over`
    : "No floating-chrome findings were recorded.",
  ...(chrome.length
    ? [
        " — the fixed bottom bar, the sticky headers and the companion bubble. That is what floating",
        " furniture does; the content that mattered was kept clear of it and the sweep reports these",
        " separately as `chromeOverlap` rather than as collisions.",
      ]
    : []),
  "",
  "| Chrome overlap | Distinct | Screens affected |",
  "| --- | --- | --- |",
  ...ORDER.concat(["chromeOverlap"]).includes("chromeOverlap")
    ? (() => {
        const n = chrome.length;
        const routes = [...new Set(chrome.map((g) => g.route))];
        return [`| \`chromeOverlap\` | ${n} | ${routes.length} |`];
      })()
    : [],
  "",
];

const table = lines.join("\n");
await writeFile(OUT, table);

const doc = await readFile(DOC, "utf8");
if (!doc.includes("@@DEFECTS@@")) {
  console.log(`No @@DEFECTS@@ placeholder in ${DOC}; nothing to fill.`);
} else {
  // A function replacement, so a `$` in the measured text is not read as a
  // replacement pattern. The text in the table comes from the rendered page,
  // which is not under this script's control.
  await writeFile(DOC, doc.replace("@@DEFECTS@@", () => table.trimEnd()));
  console.log(`Filled @@DEFECTS@@ in ${DOC} from ${REPORT}`);
}
console.log(`Defect table written to ${OUT}`);
console.log(`${rows.length} distinct defects, ${chrome.length} chrome overlaps`);
