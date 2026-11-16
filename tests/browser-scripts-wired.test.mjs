// Every browser test in tests/ has to be reachable from package.json.
//
// Twenty-four browser scripts had no npm script, so they were never run by
// anyone: the repository's browser coverage was far smaller than it looked.

import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};
const files = (await readdir(path.join(root, "tests"))).filter((f) => f.endsWith(".mjs"));

// The unit tests run through "npm test"; the browser scripts need a server.
const unit = files.filter((f) => f.endsWith(".test.mjs"));
const browser = files.filter((f) => !f.endsWith(".test.mjs"));

test("the unit tests run through npm test", () => {
  assert.match(scripts.test ?? "", /tests\/\*\.test\.mjs/);
  assert.ok(unit.length > 30, "the unit tests are there");
});

test("every browser test has an npm script that runs it", () => {
  const missing = [];
  for (const file of browser) {
    const run = Object.values(scripts).some((command) => command.includes(`tests/${file}`));
    if (!run) missing.push(file);
  }
  assert.deepEqual(missing, [], "these browser tests are wired to no npm script");
});

test("each browser script can be run on its own", () => {
  for (const file of browser) {
    const own = Object.values(scripts).some(
      (command) => command === `node tests/${file}`,
    );
    assert.ok(own, `tests/${file} has no script of its own`);
  }
});

test("the live suites are wired but kept out of the aggregate", () => {
  // The live deployment must not be probed by a run that touches everything.
  // Two suites talk to it: the API check and the production walk-through.
  const aggregate = scripts["test:browser:all"] ?? "";
  for (const live of ["api-live", "production"]) {
    assert.ok(
      !aggregate.includes(live),
      `the aggregate browser run does not include ${live}`,
    );
    assert.ok(
      Object.values(scripts).some((command) => command.includes(`tests/${live}`)),
      `${live} still has a script of its own`,
    );
  }
});
