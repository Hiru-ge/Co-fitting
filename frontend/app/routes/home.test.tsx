import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/pwa", () => ({
  isStandalone: vi.fn(),
}));

vi.mock("~/lib/push", () => ({
  subscribePush: vi.fn().mockResolvedValue(true),
}));

// window.matchMedia のモック（isStandalone 判定用）
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

// localStorage のモック
let localStorageStore: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => {
      localStorageStore[key] = value;
    },
    removeItem: (key: string) => {
      delete localStorageStore[key];
    },
    clear: () => {
      localStorageStore = {};
    },
  },
  configurable: true,
  writable: true,
});

import { isStandalone } from "~/lib/pwa";
import { subscribePush } from "~/lib/push";
import PushNotificationBanner from "~/components/PushNotificationBanner";

function setNotificationPermission(permission: NotificationPermission) {
  Object.defineProperty(globalThis, "Notification", {
    value: { permission },
    writable: true,
    configurable: true,
  });
}

describe("PushNotificationBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};
    setNotificationPermission("default");
  });

  test("isStandalone=true + permission=default + 未dismissed → バナーが表示される", () => {
    vi.mocked(isStandalone).mockReturnValue(true);

    render(<PushNotificationBanner authToken="test-token" />);

    expect(
      screen.getByRole("button", { name: "許可する" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "後で" })).toBeInTheDocument();
  });

  test("permission=granted → バナーが表示されない", () => {
    vi.mocked(isStandalone).mockReturnValue(true);
    setNotificationPermission("granted");

    render(<PushNotificationBanner authToken="test-token" />);

    expect(
      screen.queryByRole("button", { name: "許可する" }),
    ).not.toBeInTheDocument();
  });

  test("dismissed済み → バナーが表示されない", () => {
    vi.mocked(isStandalone).mockReturnValue(true);
    localStorage.setItem("push-banner-dismissed", "1");

    render(<PushNotificationBanner authToken="test-token" />);

    expect(
      screen.queryByRole("button", { name: "許可する" }),
    ).not.toBeInTheDocument();
  });

  test("「許可する」ボタン → subscribePush が呼ばれる", async () => {
    vi.mocked(isStandalone).mockReturnValue(true);

    render(<PushNotificationBanner authToken="test-token" />);
    fireEvent.click(screen.getByRole("button", { name: "許可する" }));

    await waitFor(() => {
      expect(subscribePush).toHaveBeenCalledWith("test-token");
    });
  });

  test("「後で」ボタン → localStorage に dismissed フラグが保存され非表示になる", () => {
    vi.mocked(isStandalone).mockReturnValue(true);

    render(<PushNotificationBanner authToken="test-token" />);
    fireEvent.click(screen.getByRole("button", { name: "後で" }));

    expect(localStorage.getItem("push-banner-dismissed")).toBe("1");
    expect(
      screen.queryByRole("button", { name: "許可する" }),
    ).not.toBeInTheDocument();
  });
});
