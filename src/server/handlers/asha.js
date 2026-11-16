import { begin, body, authenticate, authFail } from "../lib/common.js";
import { clean } from "../lib/logic.js";
import { claimUsage } from "../lib/usage.js";
import {
  createMairaProvider,
  MairaProviderError,
} from "../lib/maira-provider.js";
import { createAshaOrchestrator } from "../lib/asha-orchestrator.js";
import { urgentCompanionResponse } from "../../../public/app/everyday/companion-safety.js";

const provider = createMairaProvider();
const orchestrator = createAshaOrchestrator({ provider });
export default async function handler(req, res) {
  if (!begin(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const started = Date.now();
  try {
    const b = body(req);
    // Public local template: no account, provider discovery, quota or cloud consent is needed.
    const urgent = urgentCompanionResponse(b.text, {
      language: b.language,
      mode: b.mode,
      region: b.region,
      redFlags: b.redFlags,
    });
    if (urgent) return res.json(urgent);
    const wellFormed = /^[a-f0-9]{24}$/.test(b.patientId || "");
    const auth = await authenticate(req, b.patientId);
    if (!auth) return authFail(res);
    if (b.consent !== true)
      return res
        .status(400)
        .json({ error: "Cloud assistance needs your consent." });
    // Profile discovery is an outbound provider call, so it starts only
    // after the request has been authenticated and the patient has agreed to
    // cloud assistance.
    if (wellFormed) provider.warm();
    if (!process.env.MAIRA_API_KEY || !process.env.MAIRA_PROJECT_KEY)
      return res
        .status(503)
        .json({ error: "Asha cloud connection is not configured." });
    const text = clean(b.text, 600);
    if (!text)
      return res.status(400).json({ error: "Say or type something first." });
    // The quota is claimed here, after the request has been authenticated
    // and the person has agreed to cloud assistance, so an unconfigured
    // provider does not spend anyone's daily allowance.
    const claim = await claimUsage(b.patientId);
    if (!claim.allowed)
      return res.status(429).json({
        error:
          claim.reason === "daily"
            ? "Daily cloud assistance limit reached. It resets tomorrow."
            : "Please wait a moment before asking again.",
      });
    const providerStarted = Date.now();
    const result = await orchestrator.run({
      patientId: b.patientId,
      profile: auth.profile,
      text,
      module: clean(b.module, 30),
      mode: b.mode === "interpret" ? "interpret" : "chat",
      language: ["auto", "en", "bn", "mixed"].includes(b.language)
        ? b.language
        : "auto",
      context: clean(b.context, 180),
      history: Array.isArray(b.history) ? b.history.slice(-6) : [],
      confirmedMemories: Array.isArray(b.confirmedMemories)
        ? b.confirmedMemories.slice(-20)
        : [],
      // The recogniser's other readings of the same words. They are evidence
      // for what was heard, not meanings: they stay in their own field.
      heardAlternatives: Array.isArray(b.heardAlternatives)
        ? b.heardAlternatives
            .slice(0, 2)
            .map((item) => clean(item, 200))
            .filter(Boolean)
        : [],
    });
    res.setHeader(
      "Server-Timing",
      `setup;dur=${providerStarted - started}, maira;dur=${Date.now() - providerStarted}, total;dur=${Date.now() - started}`,
    );
    console.info("asha orchestration", {
      task: result.orchestration.task,
      model: result.orchestration.model,
      verified: result.orchestration.verified,
      durationMs: Date.now() - started,
    });
    return res.json(result);
  } catch (error) {
    console.error("asha request failure", error?.name);
    if (error instanceof MairaProviderError)
      return res.status(error.status).json({ error: error.message });
    return res.status(503).json({
      error:
        "Asha could not connect. Your local communication controls remain available.",
    });
  }
}
