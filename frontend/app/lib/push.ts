import { getVapidPublicKey, subscribePushToBackend, unsubscribePushFromBackend } from "~/api/notifications";

let cachedVapidPublicKey: string | null = null;

async function getVapidKey(): Promise<string> {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;
  cachedVapidPublicKey = await getVapidPublicKey();
  return cachedVapidPublicKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribePush(token: string): Promise<boolean> {
  if (!globalThis.Notification || !navigator?.serviceWorker) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return false;
  }

  const vapidPublicKey = await getVapidKey();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  await subscribePushToBackend(token, subscription.toJSON() as PushSubscriptionJSON);
  return true;
}

export async function unsubscribePush(token: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await unsubscribePushFromBackend(token, endpoint);
}

export async function getPushPermissionState(): Promise<NotificationPermission> {
  if (!globalThis.Notification) return "denied";
  return Notification.permission;
}
