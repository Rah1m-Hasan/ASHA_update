// The delivery receipt has two independent facts in it - the caregiver
// received the request, and the caregiver acted on it. The dashboard posts
// "received" automatically and the caregiver posts "acknowledged" by hand,
// so the two writes overlap in ordinary use. When they overlapped, the
// "received" write could land last and clear the acknowledgement, and the
// patient's timeline went back from *Acknowledged* to *Received*.

import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.ASHA_MEMORY_STORE = "1";
process.env.CRON_SECRET = "offline-cron-test";

const { toRouteHandler } = await import("../src/server/node-adapter.ts");
const { default: sessionHandler } = await import(
  "../src/server/handlers/session.js"
);
const { store } = await import("../src/server/lib/common.js");

const route = toRouteHandler(sessionHandler);

const call = (body, token, patientId) =>
  route(
    new Request("http://127.0.0.1/api/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify({ ...body, ...(patientId ? { patientId } : {}) }),
    }),
  );

const get = (patientId, token) =>
  route(
    new Request(
      `http://127.0.0.1/api/session?patientId=${patientId}`,
      { headers: { authorization: "Bearer " + token } },
    ),
  );

async function newCircle() {
  const created = await (
    await call({ action: "create", label: "Receipt test" })
  ).json();
  return created;
}

const eventId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) =>
    c === "x" ? "0123456789abcdef"[Math.floor(Math.random() * 16)] : "4",
  );

test("an acknowledgement survives a receipt write that lands after it", async () => {
  const circle = await newCircle();
  const id = eventId();
  await call(
    {
      action: "event",
      id,
      kind: "water",
      source: "touch",
      confirmed: true,
      text: "Water please",
    },
    circle.patientToken,
    circle.patientId,
  );

  // The dashboard's automatic "received" and the caregiver's hand-made
  // "acknowledged", overlapping the way they overlap in the browser.
  await Promise.all([
    call(
      { action: "ack", id },
      circle.caregiverToken,
      circle.patientId,
    ),
    call(
      { action: "receive", id },
      circle.caregiverToken,
      circle.patientId,
    ),
  ]);

  const view = await (
    await get(circle.patientId, circle.patientToken)
  ).json();
  const event = view.events.find((e) => e.id === id);
  assert.ok(event, "the request is still in the timeline");
  assert.ok(
    event.receipt?.acknowledgedAt,
    "the acknowledgement must survive the receipt write",
  );
  assert.ok(event.receipt?.receivedAt, "the receipt is recorded");
});

test("the acknowledgement is the fact the patient is shown", async () => {
  const circle = await newCircle();
  const id = eventId();
  await call(
    {
      action: "event",
      id,
      kind: "food",
      source: "touch",
      confirmed: true,
      text: "Food please",
    },
    circle.patientToken,
    circle.patientId,
  );
  await call(
    { action: "ack", id },
    circle.caregiverToken,
    circle.patientId,
  );
  // A later receipt write - the dashboard refreshing - must not undo it.
  await call(
    { action: "receive", id },
    circle.caregiverToken,
    circle.patientId,
  );
  const view = await (
    await get(circle.patientId, circle.patientToken)
  ).json();
  const event = view.events.find((e) => e.id === id);
  assert.ok(event.receipt?.acknowledgedAt);
});

test("a receipt written by an earlier version still reads back", async () => {
  const circle = await newCircle();
  const id = eventId();
  await call(
    {
      action: "event",
      id,
      kind: "help",
      source: "touch",
      confirmed: true,
      text: "Help",
    },
    circle.patientToken,
    circle.patientId,
  );
  // The shape earlier versions wrote: both facts in one document.
  await store.write(
    `asha-live/v1/${circle.patientId}/receipts/${id}.json`,
    {
      receivedAt: "2026-01-01T00:00:00.000Z",
      acknowledgedAt: "2026-01-01T00:05:00.000Z",
    },
    true,
  );
  const view = await (
    await get(circle.patientId, circle.patientToken)
  ).json();
  const event = view.events.find((e) => e.id === id);
  assert.equal(event.receipt.receivedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(event.receipt.acknowledgedAt, "2026-01-01T00:05:00.000Z");
});

test("an unsupported request kind is a bad request, not a server failure", async () => {
  const circle = await newCircle();
  const response = await call(
    {
      action: "event",
      id: eventId(),
      kind: "not-a-need",
      source: "touch",
      confirmed: true,
    },
    circle.patientToken,
    circle.patientId,
  );
  assert.equal(response.status, 400);
  assert.ok((await response.json()).error);
});

test("the same request sent twice is stored once", async () => {
  const circle = await newCircle();
  const id = eventId();
  const body = {
    action: "event",
    id,
    kind: "comfort",
    source: "touch",
    confirmed: true,
    text: "Comfort",
  };
  const first = await (
    await call(body, circle.patientToken, circle.patientId)
  ).json();
  const second = await (
    await call(body, circle.patientToken, circle.patientId)
  ).json();
  assert.equal(first.duplicate, undefined);
  assert.equal(second.duplicate, true);
  assert.equal(second.event.id, first.event.id);
});

test("the same request sent twice at once is stored once", async () => {
  const circle = await newCircle();
  const id = eventId();
  const body = {
    action: "event",
    id,
    kind: "message",
    source: "touch",
    confirmed: true,
    text: "Message",
  };
  const results = await Promise.all([
    call(body, circle.patientToken, circle.patientId),
    call(body, circle.patientToken, circle.patientId),
  ]);
  const statuses = results.map((r) => r.status);
  assert.ok(
    statuses.every((s) => s === 200),
    "both sends are accepted, not a server failure",
  );
  const bodies = await Promise.all(results.map((r) => r.json()));
  assert.equal(
    bodies.filter((b) => b.duplicate).length,
    1,
    "one of the two is reported as the duplicate",
  );
  const view = await (
    await get(circle.patientId, circle.patientToken)
  ).json();
  assert.equal(
    view.events.filter((e) => e.id === id).length,
    1,
    "the request is stored once",
  );
});

test("two requests sent at once are both stored", async () => {
  const circle = await newCircle();
  const ids = [eventId(), eventId()];
  const responses = await Promise.all(
    ids.map((id) =>
      call(
        {
          action: "event",
          id,
          kind: "water",
          source: "touch",
          confirmed: true,
        },
        circle.patientToken,
        circle.patientId,
      ).then((r) => r.json()),
    ),
  );
  const view = await (
    await get(circle.patientId, circle.patientToken)
  ).json();
  for (const id of ids)
    assert.ok(
      view.events.some((e) => e.id === id),
      "both requests are in the timeline",
    );
  assert.equal(responses.length, 2);
});

test("deleting a care circle removes every key it holds", async () => {
  const circle = await newCircle();
  const id = eventId();
  await call(
    {
      action: "event",
      id,
      kind: "water",
      source: "touch",
      confirmed: true,
    },
    circle.patientToken,
    circle.patientId,
  );
  await call(
    { action: "ack", id },
    circle.caregiverToken,
    circle.patientId,
  );
  // More keys than a single capped listing returns, so a delete that
  // removes one batch and reports success would leave the rest behind.
  for (let i = 0; i < 1100; i++)
    await store.write(
      `asha-live/v1/${circle.patientId}/events/${eventId()}.json`,
      { id: eventId(), at: new Date().toISOString(), kind: "test" },
      true,
    );
  const response = await call(
    { action: "delete", confirm: "DELETE" },
    circle.caregiverToken,
    circle.patientId,
  );
  assert.equal(response.status, 200);
  const left = await store.list(`asha-live/v1/${circle.patientId}/`, 10);
  assert.deepEqual(left, [], "nothing of the circle is left behind");
});
