// The daily setup allowance is spread by the address a request came from.
// The address is only hashed into the key - it is never stored and it does
// not identify a person - so a forged header must not buy a fresh
// allowance.

import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const { clientIp } = await import("../src/server/lib/common.js");

const request = (headers) => ({ headers });

test("a single forwarded address is used", () => {
  assert.equal(
    clientIp(request({ "x-forwarded-for": "203.0.113.7" })),
    "203.0.113.7",
  );
});

test("the address the closest proxy saw is the one used", () => {
  // A client can put entries in front, but the proxy appends the address it
  // actually saw.
  assert.equal(
    clientIp(
      request({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" }),
    ),
    "203.0.113.7",
  );
});

test("x-real-ip is used when it is there", () => {
  assert.equal(
    clientIp(request({ "x-real-ip": "198.51.100.9" })),
    "198.51.100.9",
  );
});

test("a port on the address is not part of it", () => {
  assert.equal(
    clientIp(request({ "x-forwarded-for": "203.0.113.7:51234" })),
    "203.0.113.7",
  );
});

test("an IPv6 address is used as it is", () => {
  assert.equal(
    clientIp(request({ "x-forwarded-for": "2001:db8::1" })),
    "2001:db8::1",
  );
});

test("a value that is not an address gets no bucket of its own", () => {
  assert.equal(
    clientIp(request({ "x-forwarded-for": "not-an-address" })),
    "local",
  );
  assert.equal(
    clientIp(request({ "x-forwarded-for": "<script>" })),
    "local",
  );
  assert.equal(clientIp(request({})), "local");
  assert.equal(clientIp(request()), "local");
});

test("a forged first entry does not replace the address the proxy saw", () => {
  const forged = clientIp(
    request({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }),
  );
  assert.equal(forged, "203.0.113.7");
});
