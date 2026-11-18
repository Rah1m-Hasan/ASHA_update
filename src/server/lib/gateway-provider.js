import { MairaProviderError } from "./maira-provider.js";

// Backup cloud route through Vercel AI Gateway (OpenAI-compatible endpoint).
// Used only when AI_GATEWAY_API_KEY is set and MAIRA could not answer. Same
// ask() contract and error type as the MAIRA provider; the prompt is the same
// app-built prompt, so retrieval, tool verification and safety are unchanged.
const ENDPOINT = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const MAX_MS = 15000;

export function createGatewayProvider({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  const model = env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
  async function ask({ task = "conversation", query, signal, timeoutMs = MAX_MS } = {}) {
    if (!env.AI_GATEWAY_API_KEY)
      throw new MairaProviderError("not_configured", "The backup AI route is not configured.", 503);
    if (typeof query !== "string" || !query.trim() || query.length > 20000)
      throw new MairaProviderError("invalid_request", "Asha needs a valid task, message, and session.", 400);
    const started = now();
    const controller = new AbortController();
    const stop = () => controller.abort();
    signal?.addEventListener("abort", stop, { once: true });
    const timer = setTimeout(stop, Math.max(1000, Math.min(MAX_MS, Number(timeoutMs) || MAX_MS)));
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.AI_GATEWAY_API_KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: query }],
          max_tokens: 400,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403)
        throw new MairaProviderError("credentials_rejected", "Asha's AI connection needs its server credentials checked.", 503);
      if (response.status === 429)
        throw new MairaProviderError("provider_busy", "Asha's AI service is busy. Please try again shortly.", 429);
      if (!response.ok)
        throw new MairaProviderError("provider_unavailable", "Asha's selected AI service is temporarily unavailable.");
      const data = await response.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim())
        throw new MairaProviderError("invalid_response", "Asha returned no usable reply. Please try again.");
      return { text: text.trim(), model, profileName: "ai-gateway", task, elapsedMs: Math.max(0, now() - started), fallback: true };
    } catch (error) {
      if (error instanceof MairaProviderError) throw error;
      if (signal?.aborted) throw new MairaProviderError("cancelled", "The Asha request was cancelled.", 499);
      if (controller.signal.aborted)
        throw new MairaProviderError("timeout", "Asha is taking longer than expected. Please try again.", 504);
      throw new MairaProviderError("connection_failed", "Asha's AI service could not be reached. Please try again.");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
    }
  }
  return { ask, warm() {}, configured: () => Boolean(env.AI_GATEWAY_API_KEY), kind: "ai-gateway" };
}
