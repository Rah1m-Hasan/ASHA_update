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
/**
 * Which store is actually in use.
 *
 * The health check used to work this out from the environment on its own,
 * so it reported "blob" while the app was running on the in-memory store.
 */
export const storageProvider = memoryAllowed
  ? "memory"
  : process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? "supabase"
    : "blob";
export const base = (id) => `asha-live/v1/${id}`;
export const path = (id, file) => `${base(id)}/${file}.json`;
/** The origin used when the request carries none, or carries one that is not allowed. */
export const DEFAULT_ORIGIN = "https://mysunatislam.github.io";
/** The origins the API answers for. */
export const ALLOWED_ORIGINS = [
  "https://mysunatislam.github.io",
  "https://neurobridge-asha-live.vercel.app",
];
/**
 * Whether a request from this origin may be answered.
 *
 * A same-origin request - the browser talking to the host that served the
 * page - is always allowed, whatever address that host is reached by, which
 * is what makes the LAN address work.
 */
export function originAllowed(origin, host) {
  if (!origin) return true;
  if (sameHost(origin, host)) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`)
    return true;
  if (
    process.env.LOCAL_DEV === "1" &&
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
  )
    return true;
  return false;
}
/** Whether a string is an IPv4 or IPv6 address. */
function isIpAddress(value) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value))
    return value.split(".").every((part) => Number(part) <= 255);
  if (value.includes(":") && /^[0-9a-f:.]+$/i.test(value))
    return value.split(":").length >= 3;
  return false;
}
/**
 * The address a request came from, used to spread the daily setup allowance.
 *
 * The address is only ever hashed into a rate-limit key: it is not stored
 * and it does not identify a person.
 *
 * The last address in the forwarded chain is the one the closest proxy
 * actually saw. A client that forges the header can put entries in front of
 * it, but not remove the entry the proxy appends - so a forged header buys
 * no fresh allowance. An address that is not an address at all is ignored,
 * and a request with no usable address shares one bucket rather than getting
 * a bucket of its own.
 */
export function clientIp(req) {
  const headers = req?.headers || {};
  const forwarded = String(headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const real = String(headers["x-real-ip"] || "").trim();
  const candidates = [...forwarded, ...(real ? [real] : [])].reverse();
  for (const candidate of candidates) {
    const bare = candidate.replace(/^\[/, "").replace(/\]$/, "");
    // An IPv4 address may carry a port. An IPv6 address is used as it is.
    const address = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(bare)
      ? bare.replace(/:\d+$/, "")
      : bare;
    if (isIpAddress(address)) return address;
  }
  return "local";
}
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
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "content-type,authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  const host = String(req.headers.host || "");
  const requestOrigin = req.headers.origin || "";
  const allowed = originAllowed(requestOrigin, host);
  // The origin the browser asked for has to be the one it is given back.
  // A fixed origin made every other allowed client - the live deployment,
  // the LAN address - receive a response the browser would not let it read.
  res.setHeader(
    "Access-Control-Allow-Origin",
    allowed && requestOrigin ? requestOrigin : DEFAULT_ORIGIN,
  );
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
  if (!allowed) {
    res.status(403).json({ error: "Origin not allowed" });
    return false;
  }
  return true;
}
/**
 * The request body, parsed.
 *
 * The size limit lives in one place. It used to be hard-coded here at 20,000
 * characters, which contradicted the Clinic route's own limit of 660,000:
 * a Clinic share large enough to be worth sending was refused by this
 * function while the route beside it said it was allowed.
 *
 * The limit travels on the request, so a handler is bounded by whatever bound
 * its route declared.
 */
export const DEFAULT_BODY_LIMIT = 20000;

export function body(req) {
  let b = req.body;
  if (typeof b === "string") {
    const limit = Number(req.bodyLimit) || DEFAULT_BODY_LIMIT;
    if (b.length > limit) throw Error("Request too large");
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
