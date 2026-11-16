// The daily provider quota.
//
// The quota used to be one document that two endpoints read, changed and
// wrote back. A burst of requests arriving together all read the same count,
// all passed the check and all wrote count+1, so a hundred provider calls
// were made for one request's worth of allowance. The claim is now taken
// with a slot that only one request in the cooldown window can create.

import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.ASHA_MEMORY_STORE = "1";

const { claimUsage, usagePrefix, DAILY_LIMIT, COOLDOWN_MS } = await import(
  "../src/server/lib/usage.js"
);
const { store } = await import("../src/server/lib/common.js");

const NOW = Date.parse("2026-11-14T09:00:00Z");
const patient = (name) => name.repeat(24).slice(0, 24);

test("the first request of a window is allowed", async () => {
  const id = patient("a");
  const claim = await claimUsage(id, { now: NOW });
  assert.equal(claim.allowed, true);
});

test("a second request inside the same window is turned away", async () => {
  const id = patient("b");
  assert.equal((await claimUsage(id, { now: NOW })).allowed, true);
  const second = await claimUsage(id, { now: NOW + 100 });
  assert.equal(second.allowed, false);
  assert.equal(second.reason, "cooldown");
});

test("a request after the window is allowed again", async () => {
  const id = patient("c");
  assert.equal((await claimUsage(id, { now: NOW })).allowed, true);
  const later = await claimUsage(id, { now: NOW + COOLDOWN_MS + 1 });
  assert.equal(later.allowed, true);
});

test("a burst of requests at once is allowed once", async () => {
  const id = patient("d");
  const results = await Promise.all(
    Array.from({ length: 25 }, () => claimUsage(id, { now: NOW })),
  );
  assert.equal(
    results.filter((r) => r.allowed).length,
    1,
    "one request in the window may reach the provider",
  );
  assert.equal(
    results.filter((r) => !r.allowed && r.reason === "cooldown").length,
    24,
  );
});

test("the daily limit stops the day's requests", async () => {
  const id = patient("e");
  let allowed = 0;
  for (let window = 0; window < 5; window++) {
    const claim = await claimUsage(id, {
      now: NOW + window * COOLDOWN_MS,
      limit: 3,
    });
    if (claim.allowed) allowed++;
    else assert.equal(claim.reason, "daily");
  }
  assert.equal(allowed, 3, "the limit is the number of requests allowed");
});

test("the day's slots are counted from the files, not from a counter", async () => {
  const id = patient("f");
  const date = new Date(NOW).toISOString().slice(0, 10);
  await claimUsage(id, { now: NOW });
  await claimUsage(id, { now: NOW + COOLDOWN_MS });
  const files = await store.list(usagePrefix(id, date), 100);
  assert.equal(files.length, 2);
});

test("two patients do not share an allowance", async () => {
  const one = patient("g");
  const two = patient("h");
  assert.equal((await claimUsage(one, { now: NOW })).allowed, true);
  assert.equal((await claimUsage(two, { now: NOW })).allowed, true);
});

test("the default allowance is the documented one", () => {
  assert.equal(DAILY_LIMIT, 160);
  assert.equal(COOLDOWN_MS, 1500);
});
