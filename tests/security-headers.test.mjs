// The security headers the app answers with.
//
// The dashboard holds a live care circle and a private credential in the URL
// fragment. The fragment is never sent to a server, and the Referrer-Policy
// keeps the path out of other sites' logs; the remaining headers stop the page
// being framed by another site and keep the browser from guessing a content
// type.

import test from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../next.config.mjs";

const rules = await nextConfig.headers();
const headerFor = (source) =>
  new Map((rules.find((r) => r.source === source)?.headers ?? []).map((h) => [h.key, h.value]));

test("every page answers with the security headers", () => {
  const headers = headerFor("/(.*)");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(
    headers.get("Permissions-Policy"),
    "camera=(self), microphone=(self), geolocation=()",
  );
});

test("the dashboard cannot be framed by another site", () => {
  // Same-origin only: the FingerSpeak studio and the Everyday companion are
  // embedded from this same origin, and nothing else frames the app.
  assert.equal(headerFor("/(.*)").get("X-Frame-Options"), "SAMEORIGIN");
});

test("the API answers are never cached", () => {
  assert.equal(headerFor("/api/(.*)").get("Cache-Control"), "no-store");
});

test("the framework is not advertised", () => {
  assert.equal(nextConfig.poweredByHeader, false);
});
