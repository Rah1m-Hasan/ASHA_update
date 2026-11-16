// Runs the existing Node-style (req, res) API handlers inside Next.js route handlers,
// so the tested server logic in src/server/handlers stays unchanged.

type NodeHandler = (req: NodeLikeRequest, res: NodeLikeResponse) => unknown;

interface NodeLikeRequest {
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

interface NodeLikeResponse {
  status(code: number): NodeLikeResponse;
  setHeader(name: string, value: string): void;
  json(value: unknown): void;
  end(text?: string): void;
}

/** How long a handler may take before the request is given up on. */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Read a request body, refusing to buffer more than the limit allows.
 *
 * The length used to be checked after the whole body had been read, so the
 * bound was applied to memory that had already been used. The body is now
 * read in chunks and abandoned as soon as it is too large.
 *
 * The limit is counted in characters, as it always was, so a body of Bangla
 * text is measured the same way it was before. The read stops at the largest
 * number of bytes that many characters can take, so nothing unbounded is
 * ever held in memory.
 */
async function readBounded(
  request: Request,
  limit: number,
): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const byteLimit = limit * 4 + 1024;
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytes += value.byteLength;
      if (bytes > byteLimit) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock?.();
  }
  return text + decoder.decode();
}

export function toRouteHandler(
  handler: NodeHandler,
  {
    maxBodyLength = 20000,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: { maxBodyLength?: number; timeoutMs?: number } = {},
) {
  return async function route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let body: unknown = undefined;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const declared = Number(request.headers.get("content-length") || 0);
      if (Number.isFinite(declared) && declared > maxBodyLength * 4 + 1024)
        return Response.json(
          { error: "Request too large" },
          { status: 413, headers: { "Cache-Control": "no-store" } },
        );
      const text = await readBounded(request, maxBodyLength);
      if (text === null)
        return Response.json(
          { error: "Request too large" },
          { status: 413, headers: { "Cache-Control": "no-store" } },
        );
      if (text.length > maxBodyLength)
        return Response.json(
          { error: "Request too large" },
          { status: 413, headers: { "Cache-Control": "no-store" } },
        );
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        return Response.json(
          { error: "Invalid JSON" },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    const req: NodeLikeRequest = {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    };

    let statusCode = 200;
    let payload: string | null = null;
    const headers = new Headers();
    let done!: () => void;
    let answered = false;
    const finished = new Promise<void>((resolve) => (done = resolve));

    const res: NodeLikeResponse = {
      status(code) {
        statusCode = code;
        return res;
      },
      setHeader(name, value) {
        headers.set(name, value);
      },
      json(value) {
        headers.set("content-type", "application/json");
        payload = JSON.stringify(value);
        answered = true;
        done();
      },
      end(text) {
        payload = text ?? null;
        answered = true;
        done();
      },
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    try {
      const outcome = await Promise.race([
        // A handler that throws is a server fault, not a crash: the client
        // gets a JSON error it can act on instead of an empty response.
        Promise.resolve()
          .then(() => handler(req, res))
          .then(
            () => "handled" as const,
            (error: unknown) => ({ error } as const),
          ),
        finished.then(() => "handled" as const),
        expiry,
      ]);
      if (outcome === "timeout") {
        if (!answered) {
          statusCode = 503;
          headers.set("content-type", "application/json");
          payload = JSON.stringify({
            error: "The server took too long to answer. Please try again.",
          });
        }
      } else if (typeof outcome === "object" && outcome !== null) {
        console.error(
          "api handler failure",
          (outcome as { error?: unknown }).error,
        );
        if (!answered) {
          statusCode = 500;
          headers.set("content-type", "application/json");
          payload = JSON.stringify({ error: "Server error. Please try again." });
        }
      } else if (!answered) {
        // The handler returned without answering. An empty 200 would tell the
        // patient their request was accepted when nothing was stored.
        statusCode = 500;
        headers.set("content-type", "application/json");
        payload = JSON.stringify({ error: "Server error. Please try again." });
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
    return new Response(statusCode === 204 ? null : payload, {
      status: statusCode,
      headers,
    });
  };
}
