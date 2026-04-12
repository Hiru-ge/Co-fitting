import { API_BASE_URL } from "~/utils/constants";
import { apiCall } from "./client";
import type { NotificationSettings } from "~/types/notification";

export async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/notifications/push/vapid-key`);
  if (!res.ok) throw new Error("VAPID公開鍵の取得に失敗しました");
  const data = await res.json();
  return data.vapid_public_key as string;
}

export async function getNotificationSettings(
  authToken: string,
): Promise<NotificationSettings> {
  return apiCall("/api/notifications/settings", authToken);
}

export async function updateNotificationSettings(
  authToken: string,
  settings: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  return await apiCall("/api/notifications/settings", authToken, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function subscribePushToBackend(
  authToken: string,
  subscription: PushSubscriptionJSON,
): Promise<void> {
  const keys = subscription.keys as { p256dh?: string; auth?: string } | null;
  await apiCall("/api/notifications/push/subscribe", authToken, {
    method: "POST",
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: keys?.p256dh ?? "",
      auth: keys?.auth ?? "",
      user_agent: navigator.userAgent,
    }),
  });
}

export async function unsubscribePushFromBackend(
  authToken: string,
  endpoint: string,
): Promise<void> {
  await apiCall("/api/notifications/push/subscribe", authToken, {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}
