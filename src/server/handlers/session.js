import { randomBytes } from "node:crypto";
import webpush from "web-push";
import { normalizeSupport } from "../../../public/engine/support-profile.js";
import {
  begin,
  body,
  authenticate,
  clientIp,
  publicProfile,
  store,
  path,
  base,
  events,
  authFail,
} from "../lib/common.js";
import {
  hash,
  assessment,
  recommend,
  voice,
  clean,
  eventValue,
  requestKinds,
  safeStatus,
  pushEndpoint,
} from "../lib/logic.js";
import { mergeReceipt, listAcks, writeReceipt } from "../lib/receipts.js";
export default async function handler(req, res) {
  if (!begin(req, res)) return;
  try {
    const b = req.method === "POST" ? body(req) : {};
    if (b.action === "create") {
      // Durable, per-day creation budget. No patient data in the rate key.
      //
      // The budget lives under its own name, not under the shared limits
      // directory. It used to share that directory with the meal log, so on a
      // shared address — a family's router, a clinic's network — setting up
      // care circles spent the person's meal-logging allowance, and vice
      // versa. Two budgets, two directories.
      const ip = hash(clientIp(req));
      const today = new Date().toISOString().slice(0, 10);
      const bucket = `asha-live/limits/${today}/sessions/${ip}/`;
      const quota = await store.list(bucket, 15);
      if (quota.length >= 12)
        return res.status(429).json({
          error: "Daily setup limit reached. Reopen an existing private link.",
        });
      const id = randomBytes(12).toString("hex"),
        patientToken = randomBytes(32).toString("base64url"),
        caregiverToken = randomBytes(32).toString("base64url");
      const a = assessment(b.assessment);
      const p = {
        patientId: id,
        label: clean(b.label, 40) || "Patient",
        assessment: a,
        supportContext: normalizeSupport(b.supportContext),
        voice: voice(b.voice),
        recommendation: recommend(a),
        patientHash: hash(patientToken),
        caregiverHash: hash(caregiverToken),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      await store.write(path(id, "profile"), p);
      await store.write(`${bucket}${id}.json`, {
        at: p.createdAt,
      });
      return res.json({ ...publicProfile(p), patientToken, caregiverToken });
    }
    const id = b.patientId || req.query.patientId;
    const auth = await authenticate(req, id);
    if (!auth) return authFail(res);
    const { profile: p, role } = auth;
    if (req.method === "GET") {
      const e = await events(id);
      const acks = await Promise.all(
        e.map((e) => store.read(path(id, "receipts/" + e.id))),
      );
      // The receipt and the acknowledgement live in separate documents, so
      // the dashboard's automatic "received" write and the caregiver's
      // "acknowledged" write cannot overwrite each other. See
      // src/server/lib/receipts.js.
      const byEvent = await listAcks(
        id,
        e.map((x) => x.id),
      );
      return res.json({
        profile: publicProfile(p),
        role,
        status: await store.read(path(id, "status")),
        events: e.map((x, i) => ({
          ...x,
          receipt: mergeReceipt(acks[i], byEvent.get(x.id)),
        })),
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
      });
    }
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
    if (b.action === "update" && role === "caregiver") {
      p.assessment = assessment(b.assessment);
      if (Object.hasOwn(b, "supportContext"))
        p.supportContext = normalizeSupport(b.supportContext);
      p.recommendation = recommend(p.assessment);
      p.voice = voice(b.voice);
      p.label = clean(b.label, 40) || p.label;
      await store.write(path(id, "profile"), p, true);
      return res.json({ profile: publicProfile(p) });
    }
    if (b.action === "heartbeat" && role === "patient") {
      await store.write(
        path(id, "status"),
        { ...safeStatus(b.status), at: new Date().toISOString() },
        true,
      );
      return res.json({ ok: true });
    }
    if (b.action === "event" && role === "patient") {
      if (!/^[a-f0-9-]{36}$/.test(b.id || ""))
        return res.status(400).json({ error: "Invalid request ID" });
      const file = path(id, "events/" + b.id);
      const prior = await store.read(file);
      if (prior) return res.json({ event: prior, duplicate: true });
      // An unsupported kind is a bad request, not a server failure. It used
      // to be reported as a 503, which told the patient their request had
      // not been delivered and asked them to retry something that could
      // never succeed.
      if (!requestKinds.includes(b.kind))
        return res.status(400).json({ error: "Unsupported request kind" });
      const ev = eventValue(b);
      if (
        !ev.confirmed &&
        !["test", "posture", "face_change"].includes(ev.kind)
      )
        return res
          .status(400)
          .json({ error: "Please confirm this request first." });
      const recent = await events(id);
      if (
        recent.filter((x) => Date.now() - Date.parse(x.at) < 60000).length >= 12
      )
        return res
          .status(429)
          .json({ error: "Too many requests. Please wait a moment." });
      const event = { ...ev, id: b.id, at: new Date().toISOString() };
      try {
        await store.write(file, event);
      } catch (e) {
        // Two sends of the same request can reach the server together. The
        // store refuses the second write; that is a duplicate, not a
        // failure, so the stored event is returned instead of a 503.
        const stored = await store.read(file);
        if (!stored) throw e;
        return res.json({ event: stored, duplicate: true });
      }
      let push = "not_enabled";
      const subscription = await store.read(path(id, "push"));
      if (subscription && process.env.VAPID_PRIVATE_KEY) {
        try {
          webpush.setVapidDetails(
            process.env.VAPID_SUBJECT,
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY,
          );
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: "Asha · new request",
              body: "Open your caregiver dashboard to see the request.",
              tag: id,
              url: "/care",
            }),
            { TTL: 300 },
          );
          push = "sent";
        } catch (e) {
          push = "unavailable";
          if ([404, 410].includes(e.statusCode))
            await store.remove([path(id, "push")]);
        }
      }
      return res.json({ event, push });
    }
    if (["receive", "ack"].includes(b.action) && role === "caregiver") {
      if (!/^[a-f0-9-]{36}$/.test(b.id || ""))
        return res.status(400).json({ error: "Invalid request ID" });
      if (!(await store.read(path(id, "events/" + b.id))))
        return res.status(404).json({ error: "Request not found" });
      const receipt = await writeReceipt(id, b.action, b.id);
      return res.json({ receipt });
    }
    if (b.action === "subscribe" && role === "caregiver") {
      const sub = b.subscription;
      if (
        !pushEndpoint(sub?.endpoint) ||
        !sub?.keys?.p256dh ||
        !sub?.keys?.auth ||
        JSON.stringify(sub).length > 3000
      )
        return res.status(400).json({ error: "Unsupported push subscription" });
      await store.write(path(id, "push"), sub, true);
      return res.json({ ok: true });
    }
    if (
      b.action === "delete" &&
      role === "caregiver" &&
      b.confirm === "DELETE"
    ) {
      // A listing is capped, so a large care circle holds more keys than one
      // listing returns. Removing one batch and reporting success left the
      // rest of the circle behind while telling the caregiver it was gone.
      // The batches are removed until the listing comes back empty.
      let removed = 0;
      for (let round = 0; round < 20; round++) {
        const keys = await store.list(base(id) + "/", 500);
        if (!keys.length) break;
        await store.remove(keys);
        removed += keys.length;
        if (keys.length < 500) break;
      }
      const left = await store.list(base(id) + "/", 1);
      if (left.length)
        return res.status(409).json({
          error:
            "Part of this care circle could not be removed. Try again in a moment.",
        });
      return res.json({ deleted: true, removed });
    }
    return res
      .status(403)
      .json({ error: "This action is not available for your role." });
  } catch (e) {
    console.error("session failure", e?.name);
    res.status(503).json({
      error:
        "Connection unavailable. Your request has not been confirmed as delivered. Please retry.",
    });
  }
}
