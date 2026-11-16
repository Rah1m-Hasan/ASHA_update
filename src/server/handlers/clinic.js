import { randomBytes } from "node:crypto";
import { begin, body, clientIp, store } from "../lib/common.js";
import { hash } from "../lib/logic.js";
import { createClinicService, ClinicError } from "../lib/clinic.js";
import { memoryStore } from "../lib/memory-store.js";
const service = createClinicService(store);
const resultWithStorageMode = (result) =>
  store === memoryStore ? { ...result, storageMode: "local-memory" } : result;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!begin(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const input = body(req);
    if (JSON.stringify(input).length > 660000)
      return res.status(413).json({ error: "Share fewer records at once." });
    if (input.action === "create") {
      if (input.confirmed !== true)
        return res
          .status(400)
          .json({ error: "Confirm you want to create a clinic workspace." });
      const today = new Date().toISOString().slice(0, 10);
      const ip = hash(clientIp(req));
      const prefix = `asha-everyday/limits/${today}/${ip}/`;
      if ((await store.list(prefix, 10)).length >= 10)
        return res
          .status(429)
          .json({
            error:
              "Daily workspace setup limit reached. Reopen your private invitation.",
          });
      // The marker is written before the workspace exists. It used to be
      // written after, so a marker that failed left a live workspace with an
      // admin secret nobody was ever told about.
      await store.write(prefix + randomBytes(8).toString("hex") + ".json", {
        at: new Date().toISOString(),
      });
      const result = await service.create(input.name);
      return res.json(resultWithStorageMode(result));
    }
    const bearer = String(req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );
    return res.json(
      resultWithStorageMode(await service.run(input.tenant, bearer, input)),
    );
  } catch (error) {
    return res
      .status(error instanceof ClinicError ? error.status : 503)
      .json({
        error:
          error instanceof ClinicError
            ? error.message
            : "Clinic storage is unavailable. Try again later.",
      });
  }
}
