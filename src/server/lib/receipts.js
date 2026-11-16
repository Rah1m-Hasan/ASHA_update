/**
 * The delivery receipt for one request.
 *
 * The receipt has two independent facts in it: the caregiver dashboard
 * *received* the request, and the caregiver *acknowledged* it and acted.
 *
 * They used to live in one document, which made every write a read-modify-
 * write of the other fact. The dashboard posts "received" automatically the
 * moment it fetches a new request, and the caregiver posts "acknowledged"
 * by hand, so the two writes overlap in ordinary use. When they overlapped,
 * the "received" write could land last and carry `acknowledgedAt: null`,
 * and the patient's timeline went back from *Acknowledged* to *Received* -
 * the app telling the patient that nobody had acted on an act that had
 * already happened.
 *
 * So each fact now has its own document: `receipts/<id>.json` holds the
 * receipt, `acks/<id>.json` holds the acknowledgement. Neither writer can
 * overwrite the other's field, so the order the two land in stops mattering.
 *
 * Receipts written by earlier versions hold both fields in the receipt
 * document. The merge below still reads them, so nothing already stored is
 * lost and the shape the clients see - `receipt: { receivedAt,
 * acknowledgedAt }` - does not change.
 */

import { store, path, base } from "./common.js";

/** Where the receipt (the "received" fact) is stored. */
export const receiptPath = (id, eventId) => path(id, "receipts/" + eventId);

/** Where the acknowledgement (the "acted" fact) is stored. */
export const ackPath = (id, eventId) => path(id, "acks/" + eventId);

/**
 * The receipt the clients see, from the two stored documents.
 *
 * `receivedAt` is the earliest of the two timestamps: the moment the
 * caregiver first saw the request. `acknowledgedAt` prefers the
 * acknowledgement document and falls back to a receipt document written by
 * an earlier version.
 */
export function mergeReceipt(receipt, ack) {
  if (!receipt && !ack) return null;
  const received = [receipt?.receivedAt, ack?.receivedAt].filter(Boolean);
  const acknowledgedAt = ack?.acknowledgedAt ?? receipt?.acknowledgedAt ?? null;
  return {
    receivedAt: received.length ? received.sort()[0] : null,
    acknowledgedAt,
  };
}

/**
 * Record a delivery state and return the merged receipt.
 *
 * "receive" writes only the receipt document. "ack" writes only the
 * acknowledgement document. Neither reads the other's field to write it
 * back, so neither can clear it.
 */
export async function writeReceipt(id, action, eventId) {
  const now = new Date().toISOString();
  if (action === "ack") {
    const receipt = await store.read(receiptPath(id, eventId));
    const prev = await store.read(ackPath(id, eventId));
    const next = {
      // The acknowledgement is the later of the two, so two overlapping
      // acknowledgements cannot move the timestamp backwards.
      acknowledgedAt:
        prev?.acknowledgedAt && prev.acknowledgedAt > now
          ? prev.acknowledgedAt
          : now,
      receivedAt: receipt?.receivedAt || now,
    };
    await store.write(ackPath(id, eventId), next, true);
    return mergeReceipt(receipt, next);
  }
  const prev = await store.read(receiptPath(id, eventId));
  const next = { receivedAt: prev?.receivedAt || now };
  // A receipt written by an earlier version may hold the acknowledgement.
  // Keep it where it is rather than dropping it.
  if (prev?.acknowledgedAt) next.acknowledgedAt = prev.acknowledgedAt;
  await store.write(receiptPath(id, eventId), next, true);
  const ack = await store.read(ackPath(id, eventId));
  return mergeReceipt(next, ack);
}

/**
 * The acknowledgements stored for a circle of care, keyed by request id.
 *
 * The acknowledgements are read per request rather than by listing the
 * directory, because a listing is ordered by path - and the request ids
 * are random - so a circle with more acknowledgements than the listing
 * cap would silently lose the ones outside it.
 */
export async function listAcks(id, eventIds) {
  const docs = await Promise.all(
    eventIds.map((eventId) => store.read(ackPath(id, eventId))),
  );
  const acks = new Map();
  eventIds.forEach((eventId, i) => {
    if (docs[i]) acks.set(eventId, docs[i]);
  });
  return acks;
}
