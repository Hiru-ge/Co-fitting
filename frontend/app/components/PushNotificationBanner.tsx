import { useEffect, useState } from "react";
import { isStandalone } from "~/lib/pwa";
import { subscribePush } from "~/lib/push";
import {
  sendPushBannerShown,
  sendPushBannerDismissed,
  sendPushPermissionGranted,
  sendPushPermissionDenied,
} from "~/lib/gtag";

const PUSH_BANNER_DISMISSED_KEY = "push-banner-dismissed";

export default function PushNotificationBanner({
  authToken,
}: {
  authToken: string;
}) {
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem(PUSH_BANNER_DISMISSED_KEY),
  );

  const isBannerVisible =
    isStandalone() &&
    !!globalThis.Notification &&
    Notification.permission === "default" &&
    !dismissed;

  function dismiss() {
    localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, "1");
    setDismissed(true);
  }

  useEffect(() => {
    if (isBannerVisible) sendPushBannerShown();
  }, [isBannerVisible]);

  async function handleAllow() {
    const success = await subscribePush(authToken);
    if (success) {
      sendPushPermissionGranted("banner");
    } else {
      sendPushPermissionDenied("banner");
    }
    dismiss();
  }

  function handleDismiss() {
    sendPushBannerDismissed();
    dismiss();
  }

  if (!isBannerVisible) return null;

  return (
    <div className="fixed bottom-36 left-4 right-4 z-30 rounded-2xl bg-gray-900 border border-white/10 shadow-lg p-4 flex items-start gap-3">
      <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">
        notifications
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-100 mb-0.5">通知を受け取る</p>
        <p className="text-xs text-gray-400">
          新しい場所の提案をお知らせします
        </p>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleAllow}
          className="px-3 py-1 rounded-full bg-primary text-black text-xs font-bold"
        >
          許可する
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="px-3 py-1 rounded-full text-gray-400 text-xs"
        >
          後で
        </button>
      </div>
    </div>
  );
}
