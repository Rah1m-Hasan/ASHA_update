import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import config from "../next.config.mjs";

const redirects = await config.redirects();
const exists = (path) =>
  fs.access(new URL(`../public${path}`, import.meta.url)).then(
    () => true,
    () => false,
  );

function resolve(pathname, query = {}) {
  for (const rule of redirects) {
    if (rule.source !== pathname) continue;
    const params = {};
    const matches = (rule.has || []).every((condition) => {
      if (condition.type !== "query" || !(condition.key in query)) return false;
      const match = new RegExp(`^${condition.value}$`).exec(query[condition.key]);
      if (!match) return false;
      Object.assign(params, match.groups);
      return true;
    });
    if (!matches) continue;
    return rule.destination.replace(/:(\w+)/g, (_, key) => params[key]);
  }
  return null;
}

test("Legacy app, role and module links keep opening the assistive shell after the Next.js migration", () => {
  for (const path of ["/app", "/app.html", "/index.html", "/asha.html", "/modules"])
    assert.equal(resolve(path), "/assistive.html", path);
  for (const path of ["/care", "/caregiver", "/pair"])
    assert.equal(resolve(path), "/assistive.html?role=caregiver", path);
  assert.equal(resolve("/patient"), "/assistive.html?role=patient");
  for (const module of ["facespeak", "fingerspeak", "senseassist", "vitalsense", "posture"])
    assert.equal(resolve("/", { module }), `/assistive.html?module=${module}`, module);
  assert.equal(resolve("/", { role: "caregiver" }), "/assistive.html?role=caregiver");
  assert.equal(resolve("/", { module: "unknown" }), null, "Unknown modules stay on the landing page");
  assert.equal(resolve("/neuroface"), "/assistive.html?module=facespeak");
  assert.equal(resolve("/everyday"), "/everyday.html");
});

test("Redirect targets and the scripts the assistive shell loads exist in public/", async () => {
  for (const file of ["/assistive.html", "/everyday.html", "/sw.js", "/engine/main.js", "/app/everyday/main.js"])
    assert.ok(await exists(file), file);
  const html = await fs.readFile(new URL("../public/assistive.html", import.meta.url), "utf8");
  for (const [, src] of html.matchAll(/(?:src|href)="\.?(\/(?:engine|neuroface|app)\/[^"]+)"/g))
    assert.ok(await exists(src), `assistive.html references missing ${src}`);
});

test("The assistive shell's theme button is wired (not a dead control)", async () => {
  const html = await fs.readFile(new URL("../public/assistive.html", import.meta.url), "utf8");
  const main = await fs.readFile(new URL("../public/engine/main.js", import.meta.url), "utf8");
  const finger = await fs.readFile(new URL("../public/neuroface/fingerspeak.html", import.meta.url), "utf8");
  assert.match(html, /id="themeButton"/);
  assert.match(main, /\$\("themeButton"\)\?\.addEventListener\("click"/);
  assert.match(finger, /ashaSetTheme = \(theme\) =>/);
});
