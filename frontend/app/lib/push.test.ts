import { describe, test, expect, beforeEach, vi } from "vitest";
import { subscribePush, unsubscribePush, getPushPermissionState } from "~/lib/push";

vi.mock("~/api/notifications", () => ({
  getVapidPublicKey: vi.fn().mockResolvedValue("BTestVapidKey"),
  subscribePushToBackend: vi.fn().mockResolvedValue(undefined),
  unsubscribePushFromBackend: vi.fn().mockResolvedValue(undefined),
}));

import { subscribePushToBackend, unsubscribePushFromBackend } from "~/api/notifications";

describe("push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPushPermissionState", () => {
    test("Notification.permission の値を返す", async () => {
      Object.defineProperty(globalThis, "Notification", {
        value: { permission: "default" },
        writable: true,
        configurable: true,
      });

      const result = await getPushPermissionState();
      expect(result).toBe("default");
    });

    test("Notification APIが未対応の場合は 'denied' を返す", async () => {
      const originalNotification = globalThis.Notification;
      Object.defineProperty(globalThis, "Notification", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = await getPushPermissionState();
      expect(result).toBe("denied");

      Object.defineProperty(globalThis, "Notification", {
        value: originalNotification,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("subscribePush", () => {
    test("ServiceWorkerとPushManagerをモックして subscribePushToBackend が呼ばれる", async () => {
      const mockSubscriptionJSON = {
        endpoint: "https://example.com/push",
        keys: { p256dh: "p256dhkey", auth: "authkey" },
      };
      const mockSubscription = {
        toJSON: () => mockSubscriptionJSON,
      };
      const mockPushManager = {
        subscribe: vi.fn().mockResolvedValue(mockSubscription),
      };
      const mockRegistration = {
        pushManager: mockPushManager,
      };

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
          userAgent: "test-agent",
        },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "Notification", {
        value: {
          permission: "granted",
          requestPermission: vi.fn().mockResolvedValue("granted"),
        },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "atob", {
        value: (str: string) => Buffer.from(str, "base64").toString("binary"),
        writable: true,
        configurable: true,
      });

      const result = await subscribePush("test-token");
      expect(result).toBe(true);
      expect(subscribePushToBackend).toHaveBeenCalledWith(
        "test-token",
        mockSubscriptionJSON
      );
    });

    test("通知許可が拒否された場合は false を返す", async () => {
      Object.defineProperty(globalThis, "Notification", {
        value: {
          permission: "default",
          requestPermission: vi.fn().mockResolvedValue("denied"),
        },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {},
          userAgent: "test-agent",
        },
        writable: true,
        configurable: true,
      });

      const result = await subscribePush("test-token");
      expect(result).toBe(false);
      expect(subscribePushToBackend).not.toHaveBeenCalled();
    });

    test("ServiceWorker未対応の場合は false を返す", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: "test-agent" },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "Notification", {
        value: { permission: "granted" },
        writable: true,
        configurable: true,
      });

      const result = await subscribePush("test-token");
      expect(result).toBe(false);
    });
  });

  describe("unsubscribePush", () => {
    test("購読済みの場合は unsubscribePushFromBackend が呼ばれる", async () => {
      const mockSubscription = {
        endpoint: "https://example.com/push",
        unsubscribe: vi.fn().mockResolvedValue(true),
      };
      const mockPushManager = {
        getSubscription: vi.fn().mockResolvedValue(mockSubscription),
      };
      const mockRegistration = {
        pushManager: mockPushManager,
      };

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
          userAgent: "test-agent",
        },
        writable: true,
        configurable: true,
      });

      await unsubscribePush("test-token");
      expect(unsubscribePushFromBackend).toHaveBeenCalledWith(
        "test-token",
        "https://example.com/push"
      );
    });

    test("購読がない場合は unsubscribePushFromBackend が呼ばれない", async () => {
      const mockPushManager = {
        getSubscription: vi.fn().mockResolvedValue(null),
      };
      const mockRegistration = {
        pushManager: mockPushManager,
      };

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
          userAgent: "test-agent",
        },
        writable: true,
        configurable: true,
      });

      await unsubscribePush("test-token");
      expect(unsubscribePushFromBackend).not.toHaveBeenCalled();
    });

    test("ServiceWorker未対応の場合は何もしない", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: "test-agent" },
        writable: true,
        configurable: true,
      });

      await unsubscribePush("test-token");
      expect(unsubscribePushFromBackend).not.toHaveBeenCalled();
    });
  });
});
