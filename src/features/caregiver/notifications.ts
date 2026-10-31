import { api, type Credential } from "@/lib/api";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Subscribes this device to push notifications for a care circle. */
export async function enableNotifications(cred: Credential, vapidPublicKey: string | null) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser doesn’t support notifications. On iPhone, add Asha to your Home Screen first.");
  if (!vapidPublicKey) throw new Error("Notifications aren’t configured on the server yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
  await api("session", { cred, body: { action: "subscribe", subscription: sub.toJSON() } });
}
