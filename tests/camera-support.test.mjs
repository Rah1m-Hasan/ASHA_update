import test from "node:test";
import assert from "node:assert/strict";
import {
  cameraCode,
  cameraFailure,
  cameraMessage,
  cameraSupport,
  cameraUnavailable,
  microphoneMessage,
} from "../public/engine/camera-support.js";

/** Swap a browser global for the duration of one test. */
function stub(t, key, value) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => {
    if (saved) Object.defineProperty(globalThis, key, saved);
    else delete globalThis[key];
  });
}

/** A browser that can open a camera. */
function workingBrowser(t) {
  stub(t, "isSecureContext", true);
  stub(t, "navigator", { mediaDevices: { getUserMedia: () => {} } });
}

test("a browser that can open a camera reports it is ready", (t) => {
  workingBrowser(t);
  const support = cameraSupport();
  assert.equal(support.ok, true);
  assert.equal(support.code, "ok");
  assert.equal(support.secure, true);
});

test("an http address on the LAN is reported as a secure-context problem", (t) => {
  // This is the reported bug: the origin is not secure, so the browser never
  // exposes navigator.mediaDevices at all.
  stub(t, "isSecureContext", false);
  stub(t, "navigator", {});
  const support = cameraSupport();
  assert.equal(support.ok, false);
  assert.equal(support.code, "insecure-context");
  assert.equal(support.secure, false);
  assert.match(support.message, /https/);
});

test("a secure origin without mediaDevices is an unsupported browser", (t) => {
  stub(t, "isSecureContext", true);
  stub(t, "navigator", {});
  const support = cameraSupport();
  assert.equal(support.ok, false);
  assert.equal(support.code, "no-media-devices");
  assert.match(support.message, /browser/i);
});

test("mediaDevices without getUserMedia is not a camera", (t) => {
  stub(t, "isSecureContext", true);
  stub(t, "navigator", { mediaDevices: {} });
  const support = cameraSupport();
  assert.equal(support.ok, false);
  assert.equal(support.code, "no-get-user-media");
});

test("a missing navigator is reported without throwing", (t) => {
  stub(t, "isSecureContext", false);
  stub(t, "navigator", undefined);
  const support = cameraSupport();
  assert.equal(support.ok, false);
  assert.equal(support.code, "no-navigator");
  // The probe is safe to call again.
  assert.equal(cameraSupport().ok, false);
});

test("cameraUnavailable is null when the camera can be used and an error otherwise", (t) => {
  workingBrowser(t);
  assert.equal(cameraUnavailable(), null);
  stub(t, "isSecureContext", false);
  stub(t, "navigator", {});
  const error = cameraUnavailable();
  assert.ok(error);
  assert.equal(error.name, "CameraError");
  assert.equal(error.code, "insecure-context");
  assert.match(error.message, /https/);
});

test("a camera failure carries a ready-to-show sentence and never a raw exception", (t) => {
  const error = cameraFailure("not-allowed");
  assert.ok(error instanceof Error);
  assert.equal(error.name, "CameraError");
  assert.equal(error.code, "not-allowed");
  assert.match(error.message, /permission/i);
  assert.doesNotMatch(error.message, /getUserMedia|undefined|Cannot read/);
});

test("a camera failure can add what still works", () => {
  const error = cameraFailure("insecure-context", "Touch controls remain available.");
  assert.match(error.message, /Touch controls remain available/);
  assert.match(error.message, /https/);
});

test("every browser failure has its own sentence", () => {
  const names = [
    "NotAllowedError",
    "PermissionDeniedError",
    "NotFoundError",
    "DevicesNotFoundError",
    "NotReadableError",
    "TrackStartError",
    "OverconstrainedError",
    "AbortError",
    "SecurityError",
  ];
  const seen = new Set();
  for (const name of names) {
    const code = cameraCode({ name });
    const message = cameraMessage({ name });
    assert.ok(code && code !== "unknown", `${name} needs its own code`);
    assert.ok(message.length > 10, `${name} needs a sentence`);
    assert.doesNotMatch(message, /getUserMedia|Cannot read|undefined/);
    seen.add(message);
  }
  // The five distinct reasons do not collapse into one sentence.
  assert.ok(seen.size >= 5, `expected distinct sentences, got ${seen.size}`);
});

test("a permission refusal reads as permission, not as a broken browser", () => {
  const message = cameraMessage({ name: "NotAllowedError" });
  assert.match(message, /permission/i);
  assert.match(message, /browser settings/i);
});

test("no camera found and camera in use read differently", () => {
  assert.match(cameraMessage({ name: "NotFoundError" }), /no camera was found/i);
  assert.match(cameraMessage({ name: "NotReadableError" }), /already in use/i);
});

test("the reported exception never reaches the patient", () => {
  // The exact message from the bug report.
  const raw = new TypeError(
    "Cannot read properties of undefined (reading 'getUserMedia')",
  );
  const message = cameraMessage(raw);
  assert.doesNotMatch(message, /getUserMedia|Cannot read|undefined/);
  assert.match(message, /could not start/i);
});

test("an unknown failure never leaks the raw message", () => {
  const message = cameraMessage(new Error("boom: secret internal detail"));
  assert.doesNotMatch(message, /boom|secret internal detail/);
  assert.match(message, /could not start/i);
});

test("a CameraError keeps its own sentence", () => {
  const error = cameraFailure("not-found");
  assert.equal(cameraMessage(error), error.message);
});

test("the microphone sentence never leaks a raw exception", () => {
  const raw = new TypeError(
    "Cannot read properties of undefined (reading 'getUserMedia')",
  );
  const message = microphoneMessage(raw);
  assert.doesNotMatch(message, /getUserMedia|Cannot read|undefined/);
  assert.match(message, /microphone/i);
  assert.match(
    microphoneMessage({ name: "NotAllowedError" }),
    /microphone permission/i,
  );
});
