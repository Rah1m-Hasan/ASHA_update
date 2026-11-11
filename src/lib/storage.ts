// Local storage helpers, shared key prefix with the legacy engine so data carries over.
const PREFIX = "asha_live_";

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : ((JSON.parse(raw) as T) ?? fallback);
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep working in memory */
  }
}

export function removeLocal(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}
