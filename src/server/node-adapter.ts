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

export function toRouteHandler(handler: NodeHandler) {
  return async function route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let body: unknown = undefined;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const text = await request.text();
      if (text.length > 20000)
        return Response.json({ error: "Request too large" }, { status: 413 });
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
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
        done();
      },
      end(text) {
        payload = text ?? null;
        done();
      },
    };

    await Promise.race([Promise.resolve(handler(req, res)).then(() => done()), finished]);
    await finished;
    return new Response(statusCode === 204 ? null : payload, { status: statusCode, headers });
  };
}
