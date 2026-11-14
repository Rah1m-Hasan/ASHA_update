import { blobStore } from "./store.js";
import { supabaseStore } from "./supabase-store.js";
import { memoryStore } from "./memory-store.js";
import { hash, equal } from "./logic.js";
// In-memory storage is development-only by default. ASHA_MEMORY_STORE_PRODUCTION=1
// is an explicit opt-in for LAN/demo runs of the production build, where no
// Supabase or Blob credentials exist. Data is lost on restart.
const memoryAllowed =
  process.env.ASHA_MEMORY_STORE === "1" &&
  (process.env.NODE_ENV !== "production" ||
    process.env.ASHA_MEMORY_STORE_PRODUCTION === "1");
export const store = memoryAllowed
    ? memoryStore
    : process.env.SUPABASE_URL &&
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? supabaseStore
    : blobStore;
export const base = (id) => `asha-live/v1/${id}`;
export const path = (id, file) => `${base(id)}/${file}.json`;
/**
 * True when an Origin header points at the same host that served the request
 * (ignoring scheme). Used to accept same-origin traffic on any address the
 * app is reached by, including a LAN IP.
 */
export function sameHost(origin, host) {
  if (!origin || !host) return false;
  try {
    const o = new URL(origin);
    const h = new URL(`http://${host}`);
    return o.hostname === h.hostname && o.port === h.port;
  } catch {
    return false;
  }
}
export function begin(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://mysunatislam.github.io",
  );
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "content-type,authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
  const host = String(req.headers.host || "");
  // A same-origin request (the browser talking to the host that served the
  // page) is always allowed, whatever address that host is reached by.
  const origin = sameHost(req.headers.origin, host)
    ? null
    : req.headers.origin;
  if (
    origin &&
    ![
      "https://mysunatislam.github.io",
      "https://neurobridge-asha-live.vercel.app",
      `https://${process.env.VERCEL_URL}`,
    ].includes(origin) &&
    !(process.env.LOCAL_DEV === "1" && /^http:\/\/127.0.0.1:\d+$/.test(origin))
  ) {
    res.status(403).json({ error: "Origin not allowed" });
    return false;
  }
  return true;
}
export function body(req) {
  let b = req.body;
  if (typeof b === "string") {
    if (b.length > 20000) throw Error("Request too large");
    b = JSON.parse(b);
  }
  return b && typeof b === "object" ? b : {};
}
export async function authenticate(req, id) {
  if (!/^[a-f0-9]{24}$/.test(id || "")) return null;
  const p = await store.read(path(id, "profile"));
  if (!p || Date.parse(p.expiresAt) < Date.now()) return null;
  const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
  const h = hash(token);
  const role = equal(h, p.patientHash)
    ? "patient"
    : equal(h, p.caregiverHash)
      ? "caregiver"
      : null;
  return role ? { profile: p, role } : null;
}
export const publicProfile = (p) => ({
  patientId: p.patientId,
  label: p.label,
  assessment: p.assessment,
  supportContext: p.supportContext || { categories: [], goals: [], note: "" },
  voice: p.voice,
  recommendation: p.recommendation,
  createdAt: p.createdAt,
  expiresAt: p.expiresAt,
});
export async function events(id) {
  const keys = await store.list(base(id) + "/events/", 300);
  const out = await Promise.all(keys.map((k) => store.read(k)));
  return out
    .filter(Boolean)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 60);
}
export const authFail = (res) =>
  res
    .status(401)
    .json({ error: "Open your private patient or caregiver link again." });
