// The API answers for a browser. A browser will only hand the body to the
// page if the response says the origin it asked for is allowed. The header
// used to name one fixed origin while the allowlist admitted several, so
// every other allowed client - the live deployment, the LAN address - got a
// response the browser would not let it read.

import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const { originAllowed, begin, ALLOWED_ORIGINS, DEFAULT_ORIGIN } = await import(
  "../src/server/lib/common.js"
);

function fakeRes() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    json(value) {
      this.body = value;
    },
    end() {},
  };
}

const request = (origin, host = "neurobridge-asha-live.vercel.app") => ({
  method: "GET",
  headers: { host, ...(origin ? { origin } : {}) },
});

test("the allowed origins are allowed", () => {
  for (const origin of ALLOWED_ORIGINS)
    assert.equal(originAllowed(origin, "neurobridge-asha-live.vercel.app"), true);
  assert.equal(
    originAllowed("https://neurobridge-asha-live.vercel.app", "other.host"),
    true,
  );
});

test("the host that served the page is always allowed", () => {
  // This is what makes the LAN address work: the page is served by the same
  // host it talks to.
  assert.equal(originAllowed("http://192.168.0.11:3000", "192.168.0.11:3000"), true);
  assert.equal(originAllowed("http://127.0.0.1:4180", "127.0.0.1:4180"), true);
});

test("an unknown origin is not allowed", () => {
  assert.equal(originAllowed("https://evil.example", "app.host"), false);
  assert.equal(originAllowed("null", "app.host"), false);
});

test("the answer carries back the origin the browser asked for", () => {
  const res = fakeRes();
  begin(request("https://mysunatislam.github.io"), res);
  assert.equal(
    res.headers["access-control-allow-origin"],
    "https://mysunatislam.github.io",
  );
});

test("the live deployment can read its own answers", () => {
  const res = fakeRes();
  begin(request("https://neurobridge-asha-live.vercel.app"), res);
  assert.equal(
    res.headers["access-control-allow-origin"],
    "https://neurobridge-asha-live.vercel.app",
    "the browser is told the origin it asked for",
  );
});

test("a request with no origin still gets a header", () => {
  const res = fakeRes();
  begin(request(null), res);
  assert.equal(res.headers["access-control-allow-origin"], DEFAULT_ORIGIN);
});

test("an origin that is not allowed is turned away", () => {
  const res = fakeRes();
  const allowed = begin(request("https://evil.example"), res);
  assert.equal(allowed, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "Origin not allowed");
});

test("a preflight request is answered with no content", () => {
  const res = fakeRes();
  const allowed = begin(
    { method: "OPTIONS", headers: { host: "app.host", origin: "https://mysunatislam.github.io" } },
    res,
  );
  assert.equal(allowed, false);
  assert.equal(res.statusCode, 204);
});
