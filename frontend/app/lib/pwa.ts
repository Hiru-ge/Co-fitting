interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PWA_DISMISSED_KEY = "pwa-install-dismissed";

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function isPWAPromptDismissed(): boolean {
  return localStorage.getItem(PWA_DISMISSED_KEY) === "true";
}

export function dismissPWAPrompt(): void {
  localStorage.setItem(PWA_DISMISSED_KEY, "true");
}

export type Platform = "ios" | "android" | "other";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return (
    (window as { __installPrompt?: BeforeInstallPromptEvent })
      .__installPrompt ?? null
  );
}

export async function triggerInstallPrompt(): Promise<boolean> {
  const prompt = getInstallPrompt();
  if (!prompt) return false;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  (
    window as { __installPrompt?: BeforeInstallPromptEvent | null }
  ).__installPrompt = null;
  return outcome === "accepted";
}
