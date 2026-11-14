import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Perception } from "../public/engine/perception.js";

/** Swap a browser global for the duration of one test. */
function stub(t, key, value) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => {
    if (saved) Object.defineProperty(globalThis, key, saved);
    else delete globalThis[key];
  });
}

/** A camera that hands back a stream and counts how often it was released. */
function fakeStream() {
  const track = {
    stops: 0,
    stop() {
      this.stops++;
    },
    getSettings: () => ({ facingMode: "user" }),
  };
  return {
    track,
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
}

/**
 * A Perception with the vision models stubbed out, so the camera lifecycle can
 * be exercised without MediaPipe. The real prototype methods are used.
 */
function fakePerception(overrides = {}) {
  return Object.assign(Object.create(Perception.prototype), {
    running: false,
    starting: null,
    generation: 0,
    cycles: {},
    snapshot: {},
    video: { srcObject: null, paused: false, play: async () => {} },
    emit() {},
    setActiveModule() {},
    initWorker: async () => {},
    initMain: async () => {},
    loop: async () => {},
    rest: { reset() {} },
    analysis: { reset() {} },
    vitals: { invalidate: () => null },
    ...overrides,
  });
}

test("start explains an http address instead of failing with a JavaScript error", async (t) => {
  // The reported bug: on an insecure origin the browser exposes no camera API,
  // so the old code read "getUserMedia" off undefined.
  stub(t, "isSecureContext", false);
  stub(t, "navigator", {});
  const perception = fakePerception();
  const error = await perception.start().then(
    () => null,
    (e) => e,
  );
  assert.ok(error, "the start must fail");
  assert.equal(error.name, "CameraError");
  assert.notEqual(error.name, "TypeError");
  assert.equal(error.code, "insecure-context");
  assert.match(error.message, /https/);
  assert.doesNotMatch(error.message, /getUserMedia|Cannot read|undefined/);
});

test("each browser refusal gets its own sentence", async (t) => {
  stub(t, "isSecureContext", true);
  const cases = [
    ["NotAllowedError", /permission/i],
    ["NotFoundError", /no camera was found/i],
    ["NotReadableError", /already in use/i],
  ];
  for (const [name, expected] of cases) {
    stub(
      t,
      "navigator",
      {
        mediaDevices: {
          getUserMedia: async () => {
            throw Object.assign(new Error("raw browser text"), { name });
          },
        },
      },
    );
    const perception = fakePerception();
    const error = await perception.start().then(
      () => null,
      (e) => e,
    );
    assert.ok(error, `${name} must fail`);
    assert.equal(error.name, "CameraError");
    assert.match(error.message, expected);
    assert.doesNotMatch(error.message, /raw browser text/);
  }
});

test("two taps on Start camera open one camera", async (t) => {
  stub(t, "isSecureContext", true);
  let calls = 0;
  let release;
  stub(t, "navigator", {
    mediaDevices: {
      getUserMedia: () => {
        calls++;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    },
  });
  const perception = fakePerception();
  const first = perception.start();
  const second = perception.start();
  assert.equal(calls, 1, "the camera is opened once");
  release(fakeStream());
  await first;
  await second;
  assert.equal(calls, 1, "the camera is still opened once");
});

test("stopping while the permission prompt is open leaves no camera running", async (t) => {
  stub(t, "isSecureContext", true);
  stub(t, "cancelAnimationFrame", () => {});
  let release;
  stub(t, "navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
  });
  const perception = fakePerception();
  const starting = perception.start();
  perception.stop();
  const stream = fakeStream();
  release(stream);
  const error = await starting.then(
    () => null,
    (e) => e,
  );
  assert.ok(error, "a start cancelled by a stop must not succeed");
  assert.equal(error.code, "cancelled");
  assert.equal(stream.track.stops, 1, "the late camera is released");
  assert.equal(perception.stream, null);
  assert.equal(perception.running, false);
});

test("stopping releases the camera and forgets the stream", async (t) => {
  stub(t, "isSecureContext", true);
  stub(t, "cancelAnimationFrame", () => {});
  const stream = fakeStream();
  stub(t, "navigator", {
    mediaDevices: { getUserMedia: async () => stream },
  });
  const perception = fakePerception();
  await perception.start();
  assert.equal(perception.stream, stream);
  perception.stop();
  assert.equal(stream.track.stops, 1);
  assert.equal(perception.stream, null, "a stopped camera is not kept alive");
});

test("a failed camera switch keeps the camera that was already working", async (t) => {
  stub(t, "isSecureContext", true);
  const old = fakeStream();
  stub(t, "navigator", {
    mediaDevices: {
      getUserMedia: async () => {
        throw Object.assign(new Error("declined"), { name: "NotAllowedError" });
      },
    },
  });
  const perception = fakePerception({
    running: true,
    facingMode: "user",
    stream: old,
  });
  const error = await perception.setFacingMode("environment").then(
    () => null,
    (e) => e,
  );
  assert.ok(error, "the switch must fail");
  assert.equal(error.name, "CameraError");
  assert.match(error.message, /permission/i);
  assert.equal(perception.facingMode, "user", "the engine and the UI still agree");
  assert.equal(old.track.stops, 0, "the working camera stays open");
  assert.equal(perception.stream, old);
});

test("a rejected frame loop is a status, not an unhandled rejection", async (t) => {
  stub(t, "isSecureContext", true);
  stub(t, "cancelAnimationFrame", () => {});
  const stream = fakeStream();
  stub(t, "navigator", {
    mediaDevices: { getUserMedia: async () => stream },
  });
  const statuses = [];
  const perception = fakePerception({
    loop: async () => {
      throw Error("the frame blew up");
    },
    emit(type, detail) {
      statuses.push([type, detail]);
    },
  });
  await perception.start();
  await new Promise((r) => setImmediate(r));
  assert.ok(
    statuses.some(
      ([type, detail]) => type === "status" && /frame unavailable/i.test(detail),
    ),
    "the patient is told the frame failed",
  );
});

test("the engine opens the camera in exactly one guarded place", async () => {
  const source = await fs.readFile(
    new URL("../public/engine/perception.js", import.meta.url),
    "utf8",
  );
  const calls = source.match(/navigator\.mediaDevices\.getUserMedia/g) ?? [];
  assert.equal(calls.length, 1, "one call site, so one place to get wrong");
  // That call sits in openStream, which checks the browser before asking.
  const openStream = source.slice(
    source.indexOf("async openStream("),
    source.indexOf("async start("),
  );
  assert.match(openStream, /cameraSupport\(\)/);
});
