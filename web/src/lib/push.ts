// Web Push subscribe/unsubscribe — requires a signed-in profile (subscriptions are stored
// server-side per user, same as everything else under /api).
import { api, getPushKey } from "./api.js";

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const urlBase64ToUint8Array = (b64: string) => {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4))
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.codePointAt(0) ?? 0);
};

export async function enablePush() {
  if (!pushSupported()) throw new Error("Push notifications are not supported in this browser");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications permission was not granted");
  const [reg, { key }] = await Promise.all([navigator.serviceWorker.ready, getPushKey()]);
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  await api("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await sub.unsubscribe();
  await api("/api/push/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
}

export const sendTestPush = () => api("/api/push/test", { method: "POST", body: "{}" });
