// The adapter is what turns the tested (req, res) handlers into Next route
// handlers. A fault in it is a fault in every API route at once, so the
// failure paths are pinned here: a handler that throws, one that never
// answers, and a body that is too large to accept.

import test from "node:test";
import assert from "node:assert/strict";

const { toRouteHandler } = await import("../src/server/node-adapter.ts");

const post = (body, headers = {}) =>
  new Request("http://127.0.0.1/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("a handler that answers is passed through unchanged", async () => {
  const route = toRouteHandler((req, res) => {
    res.setHeader("X-Test", "yes");
    res.status(201).json({ ok: true, seen: req.body.value });
  });
  const response = await route(post({ value: 7 }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-test"), "yes");
  assert.deepEqual(await response.json(), { ok: true, seen: 7 });
});

test("a handler that throws answers with an error, not an empty failure", async () => {
  const route = toRouteHandler(() => {
    throw new Error("handler exploded");
  });
  const response = await route(post({ value: 1 }));
  assert.equal(response.status, 500);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const body = await response.json();
  assert.ok(body.error, "the client is told what happened");
});

test("a handler that rejects answers with an error too", async () => {
  const route = toRouteHandler(async () => {
    throw new Error("rejected");
  });
  const response = await route(post({ value: 1 }));
  assert.equal(response.status, 500);
  assert.ok((await response.json()).error);
});

test("a handler that never answers does not hang the request", async () => {
  const route = toRouteHandler(
    () => new Promise(() => {}),
    { timeoutMs: 60 },
  );
  const started = Date.now();
  const response = await route(post({ value: 1 }));
  assert.equal(response.status, 503);
  assert.ok(
    Date.now() - started < 5000,
    "the request gave up rather than waiting for ever",
  );
  assert.ok((await response.json()).error);
});

test("a handler that answers after a delay still gets its answer", async () => {
  const route = toRouteHandler(async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    res.json({ ok: true });
  });
  const response = await route(post({ value: 1 }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("a body that is too large is refused", async () => {
  const route = toRouteHandler((req, res) => res.json({ seen: req.body }));
  const response = await route(post({ text: "x".repeat(30000) }));
  assert.equal(response.status, 413);
  assert.ok((await response.json()).error);
});

test("a body over the limit is refused before it is read whole", async () => {
  // The declared length is checked first, so an oversized upload is turned
  // away without the whole body being pulled into memory.
  const route = toRouteHandler((req, res) => res.json({ seen: req.body }));
  const request = new Request("http://127.0.0.1/api/x", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": "5000000",
    },
    body: "{}",
  });
  const response = await route(request);
  assert.equal(response.status, 413);
});

test("a body that is not JSON is refused", async () => {
  const route = toRouteHandler((req, res) => res.json({ seen: req.body }));
  const response = await route(post("{not json"));
  assert.equal(response.status, 400);
  assert.ok((await response.json()).error);
});

test("Bangla text is measured in characters, not bytes", async () => {
  const route = toRouteHandler((req, res) => res.json({ seen: req.body.text }));
  // Nineteen thousand Bangla characters are three times that in bytes. The
  // limit is on characters, so this has to be accepted.
  const response = await route(post({ text: "ক".repeat(19000) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).seen.length, 19000);
});

test("a handler that returns without answering is an error", async () => {
  const route = toRouteHandler(() => {});
  const response = await route(post({ value: 1 }));
  assert.equal(response.status, 500);
  assert.ok((await response.json()).error);
});
