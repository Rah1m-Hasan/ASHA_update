import { createMairaProvider } from "./maira-provider.js";
import { createOllamaProvider } from "./ollama-provider.js";

// Failures where the cloud never produced an answer; a local model may try.
// Invalid requests, cancellations and refusals are never retried elsewhere.
const RETRY_LOCALLY = new Set([
  "connection_failed",
  "timeout",
  "provider_unavailable",
  "provider_busy",
  "profiles_unavailable",
  "not_configured",
]);

/**
 * ASHA_LLM_PROVIDER selects who answers:
 *   maira (default)  Gigalogy MAIRA cloud routing (Gemini, Claude, GPT)
 *   ollama           local small models only; nothing leaves the computer
 *   maira-local      cloud first, local model when the cloud is unreachable
 */
export function createLlmProvider({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  const mode = String(env.ASHA_LLM_PROVIDER || "maira").toLowerCase();
  const cloud = createMairaProvider({ env, fetchImpl, now });
  if (mode === "maira") return cloud;
  const local = createOllamaProvider({ env, fetchImpl, now });
  if (mode === "ollama") return local;
  if (mode !== "maira-local") return cloud;
  return {
    kind: "maira-local",
    configured: () => true,
    warm: () => cloud.warm(),
    async ask(request) {
      if (!cloud.configured())
        return { ...(await local.ask(request)), fallback: true };
      try {
        return await cloud.ask(request);
      } catch (error) {
        if (!RETRY_LOCALLY.has(error?.code) || request?.signal?.aborted)
          throw error;
        return { ...(await local.ask(request)), fallback: true };
      }
    },
  };
}
