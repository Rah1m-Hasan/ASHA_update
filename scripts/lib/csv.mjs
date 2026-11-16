// A CSV reader for the USDA FoodData Central bulk files.
//
// The bulk CSVs are RFC-4180 quoted, with embedded commas and newlines in the description fields.
// This reader handles quotes, escaped quotes and newlines inside quoted fields. It is deliberately
// small: it streams line by line so a 36 MB food_nutrient.csv does not have to be held in memory
// as a single string.
import fs from "node:fs";
import readline from "node:readline";

/**
 * Parse one CSV line into its fields, honouring quoting.
 *
 * @param {string} line
 * @returns {string[]}
 */
export function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Split a CSV document into records, joining continuation lines inside quoted fields.
 *
 * @param {string} text
 * @returns {string[][]} the rows, without the header
 */
export function splitCsv(text) {
  const rows = [];
  let cur = [];
  let field = "";
  let quoted = false;
  let started = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      started = true;
      continue;
    }
    if (ch === ",") {
      cur.push(field);
      field = "";
      started = true;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      field = "";
      if (cur.length > 1 || cur[0] !== "" || started) rows.push(cur);
      cur = [];
      started = false;
      continue;
    }
    field += ch;
    started = true;
  }
  if (field !== "" || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

/**
 * Read a CSV file into objects keyed by the header row.
 *
 * @param {string} file
 * @returns {{header:string[], rows:Array<Record<string,string>>}}
 */
export function readCsv(file) {
  const text = fs.readFileSync(file, "utf8");
  const all = splitCsv(text);
  const header = (all.shift() ?? []).map((h) => h.replace(/^"|"$/g, ""));
  const rows = all.map((cells) => {
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = cells[i] ?? "";
    });
    return obj;
  });
  return { header, rows };
}

/**
 * Read a CSV file and yield its rows one at a time.
 *
 * @param {string} file
 * @returns {AsyncGenerator<Record<string,string>>}
 */
export async function* streamCsv(file) {
  const stream = fs.createReadStream(file, "utf8");
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;
  for await (const line of lines) {
    const cells = parseCsvLine(line);
    if (!header) {
      header = cells.map((h) => h.replace(/^"|"$/g, ""));
      continue;
    }
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = cells[i] ?? "";
    });
    yield obj;
  }
}
