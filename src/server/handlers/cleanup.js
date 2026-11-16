import { begin, store, base } from "../lib/common.js";
import { hash, equal } from "../lib/logic.js";
import { cleanupEveryday } from "../lib/everyday-retention.js";
export default async function handler(req, res) {
  // The same headers and preflight handling as every other route, so a
  // browser or a monitoring service gets a 204 for an OPTIONS request
  // instead of an unauthorised JSON body.
  if (!begin(req, res)) return;
  if (
    !process.env.CRON_SECRET ||
    !equal(
      hash(String(req.headers.authorization || "")),
      hash("Bearer " + process.env.CRON_SECRET),
    )
  )
    return res.status(401).json({ error: "Unauthorized" });
  try {
    const keys = await store.list("asha-live/v1/", 5000),
      profiles = keys.filter((k) => k.endsWith("/profile.json"));
    let removed = 0;
    for (const key of profiles) {
      const p = await store.read(key);
      if (p && Date.parse(p.expiresAt) < Date.now()) {
        const group = keys.filter((k) => k.startsWith(base(p.patientId) + "/"));
        await store.remove(group);
        removed++;
      }
    }
    const limits = await store.list("asha-live/limits/", 5000),
      today = new Date().toISOString().slice(0, 10);
    const old = limits.filter((k) => k.split("/")[2] < today);
    await store.remove(old);
    // The provider quota slots of earlier days are of no use to anyone.
    const slots = await store.list("asha-live/usage/", 5000);
    const oldSlots = slots.filter((k) => k.split("/")[2] < today);
    await store.remove(oldSlots);
    res.json({
      expiredSessionsRemoved: removed,
      ...(await cleanupEveryday(store)),
    });
  } catch (error) {
    console.error("cleanup failure", error?.name);
    res.status(503).json({ error: "Cleanup unavailable" });
  }
}
