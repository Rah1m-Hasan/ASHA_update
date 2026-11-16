// Turns the sweep's raw findings into a defect ledger.
//
//   node scripts/visual-audit-ledger.mjs [--report artifacts/visual-audit/report.json]
//
// One row per distinct defect — a defect seen at twenty viewports is one row
// with twenty viewports listed, not twenty rows. Every number comes from the
// report; nothing here is estimated.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const REPORT = arg("report", "artifacts/visual-audit/report.json");
const OUT = arg("out", path.join(path.dirname(REPORT), "ledger.md"));

const report = JSON.parse(await readFile(REPORT, "utf8"));
const findings = report.findings || [];

// The element is what identifies a defect; the text next to it is decoration
// that changes with the viewport, so it is not part of the key.
const keyOf = (f) => {
  const el = f.el || f.a || "";
  const detail =
    f.type === "tinyTarget"
      ? `size<${Math.max(...(f.size || [0]))}`
      : f.type === "contrast"
        ? `ratio<${f.need}`
        : f.type === "clipped"
          ? "clip"
          : f.type === "overlap"
            ? "overlap"
            : f.type === "heading"
              ? f.text
              : "";
  return `${f.route}|${f.type}|${el}|${detail}`;
};

const groups = new Map();
for (const f of findings) {
  const k = keyOf(f);
  if (!groups.has(k)) groups.set(k, { route: f.route, type: f.type, el: f.el || f.a || "", detail: f, viewports: new Set(), variants: new Set(), texts: new Set() });
  const g = groups.get(k);
  g.viewports.add(f.viewport);
  g.variants.add(f.variant || "light");
  if (f.text) g.texts.add(f.text);
  // Keep the most severe sample of the group.
  const sev = (x) => (x.type === "contrast" ? x.ratio : x.type === "clipped" ? Math.max(x.hiddenY || 0, x.hiddenX || 0) : x.type === "tinyTarget" ? Math.min(...(x.size || [99, 99])) : 0);
  if (sev(f) < sev(g.detail)) g.detail = f;
}

const ORDER = ["pageOverflow", "offender", "clipped", "overlap", "tinyTarget", "missingName", "contrast", "heading"];
const rows = [...groups.values()].sort((a, b) => {
  const t = ORDER.indexOf(a.type) - ORDER.indexOf(b.type);
  if (t) return t;
  const v = b.viewports.size - a.viewports.size;
  if (v) return v;
  return a.route.localeCompare(b.route);
});

const describe = (g) => {
  const d = g.detail;
  switch (g.type) {
    case "pageOverflow":
      return `the page scrolls sideways by ${d.amount}px`;
    case "offender":
      return `crosses the viewport edge (${d.left}..${d.right}px)`;
    case "clipped":
      return `content is clipped (${d.hiddenY}px below, ${d.hiddenX}px across)`;
    case "overlap":
      return `overlaps \`${d.b}\` by ${(d.overlap || []).join("x")}px`;
    case "tinyTarget":
      return `target is ${(d.size || []).join("x")}px`;
    case "missingName":
      return "has no accessible name";
    case "contrast":
      return `contrast ${d.ratio}:1 (needs ${d.need}:1)`;
    case "heading":
      return d.text;
    default:
      return "";
  }
};

const lines = [
  "# Defect ledger",
  "",
  `Generated from \`${path.relative(process.cwd(), REPORT)}\` by \`scripts/visual-audit-ledger.mjs\`.`,
  `Every row is a distinct defect; the viewports column lists every size it was seen at.`,
  "",
  `**${rows.length} distinct defects** from ${findings.length} raw findings across ${report.records?.length ?? 0} renders.`,
  "",
  "| # | Route | Type | Element | What the measurement says | Viewports | Variants |",
  "| --- | --- | --- | --- | --- | --- | --- |",
];
rows.forEach((g, i) => {
  lines.push(
    `| ${i + 1} | \`${g.route}\` | ${g.type} | \`${g.el.replace(/\|/g, "\\|")}\` | ${describe(g).replace(/\|/g, "\\|")} | ${g.viewports.size} | ${[...g.variants].join(", ")} |`,
  );
});

lines.push("", "## Counts by type", "", "| Type | Distinct defects |", "| --- | --- |");
for (const t of ORDER) {
  const n = rows.filter((r) => r.type === t).length;
  if (n) lines.push(`| ${t} | ${n} |`);
}

await writeFile(OUT, lines.join("\n"));
console.log(`${rows.length} distinct defects -> ${OUT}`);
for (const t of ORDER) {
  const n = rows.filter((r) => r.type === t).length;
  if (n) console.log(`  ${t}: ${n}`);
}
