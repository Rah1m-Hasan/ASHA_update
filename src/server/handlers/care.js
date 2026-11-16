import { begin, body, authenticate, authFail } from "../lib/common.js";
import { clean } from "../lib/logic.js";
import { evaluateSafety, safetyMessage } from "../../../public/app/everyday/safety.js";
import { createMairaProvider } from "../lib/maira-provider.js";
import { createCareService } from "../lib/care-service.js";
import { claimUsage } from "../lib/usage.js";

const care = createCareService(createMairaProvider());
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!begin(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const input = body(req);
    if (JSON.stringify(input).length > 20000)
      return res
        .status(413)
        .json({ error: "Send a shorter message and fewer context records." });
    const decision = evaluateSafety(String(input.text || ""), {
      region: input.region,
      redFlags: input.redFlags,
    });
    if (!decision.allowLLM)
      return res.json({
        reply: safetyMessage(decision, input.language),
        safety: decision,
      });
    const text = clean(input.text, 600);
    const auth = await authenticate(req, input.patientId);
    if (!auth) return authFail(res);
    if (input.consent !== true)
      return res
        .status(400)
        .json({ error: "Cloud assistance needs your consent." });
    const records = Array.isArray(input.context)
      ? input.context
          .slice(0, 5)
          .filter((r) => r?.consent_scope === "care" && r?.module === "care")
      : [];
    // The same quota the /api/asha path uses. Both endpoints share one
    // allowance, and the claim is taken atomically, so a burst of requests
    // cannot pass the check a hundred times over.
    const claim = await claimUsage(input.patientId);
    if (!claim.allowed)
      return res.status(429).json({
        error:
          claim.reason === "daily"
            ? "Daily cloud assistance limit reached. It resets tomorrow."
            : "Please wait before asking again.",
      });
    const result = await care.explain({
      patientId: input.patientId,
      text,
      context: records,
      region: input.region,
      redFlags: input.redFlags,
      language: ["en", "bn"].includes(input.language) ? input.language : "en",
      consent: true,
    });
    return res.json(result);
  } catch (error) {
    // A failure here used to disappear without a trace, so there was no way
    // to tell a provider fault from a fault in this handler.
    console.error("care request failure", error?.name);
    return res
      .status(503)
      .json({
        error:
          "Cloud assistance is unavailable. Your journal and local urgent guidance remain available.",
      });
  }
}
