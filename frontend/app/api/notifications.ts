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
  token: string,
): Promise<NotificationSettings> {
  return apiCall("/api/notifications/settings", token);
}

export async function updateNotificationSettings(
  token: string,
  settings: Partial<NotificationSettings>,
): Promise<void> {
  await apiCall("/api/notifications/settings", token, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function subscribePushToBackend(
  token: string,
  subscription: PushSubscriptionJSON,
): Promise<void> {
  const keys = subscription.keys as { p256dh?: string; auth?: string } | null;
  await apiCall("/api/notifications/push/subscribe", token, {
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
  token: string,
  endpoint: string,
): Promise<void> {
  await apiCall("/api/notifications/push/subscribe", token, {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}
