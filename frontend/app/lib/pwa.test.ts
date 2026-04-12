import { describe, test, expect, beforeEach } from "vitest";
import {
  isStandalone,
  isPWAPromptDismissed,
  reviewPWAPrompt,
  detectPlatform,
  getInstallPrompt,
  triggerInstallPrompt,
} from "~/lib/pwa";

const storageData: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => storageData[key] ?? null,
  setItem: (key: string, value: string) => {
    storageData[key] = value;
  },
  removeItem: (key: string) => {
    delete storageData[key];
  },
  clear: () => {
    Object.keys(storageData).forEach((k) => delete storageData[k]);
  },
};

describe("pwa lib", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    localStorageMock.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: () => ({ matches: false }),
    });
  });

  test("reviewPWAPromptとisPWAPromptDismissed", () => {
    expect(isPWAPromptDismissed()).toBe(false);
    reviewPWAPrompt();
    expect(isPWAPromptDismissed()).toBe(true);
  });

  test("detectPlatformがios/android/otherを判定", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "iPhone",
      configurable: true,
    });
    expect(detectPlatform()).toBe("ios");

    Object.defineProperty(navigator, "userAgent", {
      value: "Android",
      configurable: true,
    });
    expect(detectPlatform()).toBe("android");

    Object.defineProperty(navigator, "userAgent", {
      value: "Desktop",
      configurable: true,
    });
    expect(detectPlatform()).toBe("other");
  });

  test("getInstallPromptとtriggerInstallPrompt", async () => {
    const prompt = {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    };
    (window as Window & { __installPrompt?: unknown }).__installPrompt = prompt;

    expect(getInstallPrompt()).toBe(prompt as never);
    await expect(triggerInstallPrompt()).resolves.toBe(true);
    expect(getInstallPrompt()).toBeNull();
  });

  test("isStandaloneはdisplay-modeを参照", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: () => ({ matches: true }),
    });
    expect(isStandalone()).toBe(true);
  });
});
