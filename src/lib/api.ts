export type Credential = { patientId: string; token: string };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Calls the Asha API with a patient or caregiver credential. */
export async function api<T = unknown>(
  endpoint: "session" | "asha" | "health" | "nutrition",
  { cred, body }: { cred?: Credential | null; body?: Record<string, unknown> } = {},
): Promise<T> {
  const url = new URL(`/api/${endpoint}`, window.location.origin);
  if (!body && cred) url.searchParams.set("patientId", cred.patientId);
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cred ? { authorization: `Bearer ${cred.token}` } : {}),
    },
    body: body ? JSON.stringify({ ...body, ...(cred ? { patientId: cred.patientId } : {}) }) : undefined,
    signal: AbortSignal.timeout(endpoint === "asha" ? 55000 : 28000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error || `Connection failed (${res.status})`, res.status);
  return data;
}
