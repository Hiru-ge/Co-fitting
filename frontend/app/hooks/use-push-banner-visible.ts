import { useState } from "react";
import { isStandalone } from "~/lib/pwa";

const PUSH_BANNER_DISMISSED_KEY = "push-banner-dismissed";

export function usePushBannerVisible() {
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem(PUSH_BANNER_DISMISSED_KEY),
  );

  const visible =
    isStandalone() &&
    !!globalThis.Notification &&
    Notification.permission === "default" &&
    !dismissed;

  function dismiss() {
    localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return { visible, dismiss };
}
