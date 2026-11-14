import { api, type Credential } from "@/lib/api";
import { readLocal, removeLocal, saveLocal } from "@/lib/storage";
import { requestId } from "@/lib/uuid";

export type OutgoingEvent = { id: string; action: "event"; kind: string; source: string; text: string; confirmed: boolean };

/** Sends a confirmed request. Undelivered requests are kept on the device for retry. */
export async function sendRequest(cred: Credential, kind: string, source: string, text: string, confirmed = true) {
  const event: OutgoingEvent = { id: requestId(), action: "event", kind, source, text, confirmed };
  try {
    const res = await api<{ push: string }>("session", { cred, body: event });
    removeLocal("unsent_" + cred.patientId);
    return res;
  } catch (e) {
    saveLocal("unsent_" + cred.patientId, event);
    throw e;
  }
}

export function unsentRequest(patientId: string) {
  return readLocal<OutgoingEvent | null>("unsent_" + patientId, null);
}

export async function retryUnsent(cred: Credential) {
  const ev = unsentRequest(cred.patientId);
  if (!ev) return;
  await api("session", { cred, body: { ...ev } });
  removeLocal("unsent_" + cred.patientId);
}
