import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import NotificationTab from "~/components/NotificationTab";

vi.mock("~/api/notifications", () => ({
  getNotificationSettings: vi.fn(),
  updateNotificationSettings: vi.fn(),
}));

vi.mock("~/lib/push", () => ({
  getPushPermissionState: vi.fn(),
  subscribePush: vi.fn(),
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

import {
  getNotificationSettings,
  updateNotificationSettings,
} from "~/api/notifications";
import { getPushPermissionState } from "~/lib/push";

const defaultSettings = {
  push_enabled: true,
  email_enabled: true,
  daily_suggestion: true,
  weekly_summary: true,
  monthly_summary: true,
  streak_reminder: true,
};

describe("Settings - 通知タブ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNotificationSettings).mockResolvedValue(defaultSettings);
    vi.mocked(updateNotificationSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getPushPermissionState).mockResolvedValue("granted");
    // ServiceWorker API スタブ（NotificationTab の自動再購読ロジックで使用）
    Object.defineProperty(navigator, "serviceWorker", {
      writable: true,
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
          },
        }),
        register: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  test("通知タブが表示される（Push通知とメール通知セクション）", async () => {
    render(<NotificationTab token="test-token" />);

    expect(
      await screen.findByRole("heading", { name: /Push通知/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /メール通知/ }),
    ).toBeInTheDocument();
  });

  test("Push許可済み時: 許可ステータスが表示される", async () => {
    vi.mocked(getPushPermissionState).mockResolvedValue("granted");

    render(<NotificationTab token="test-token" />);

    expect(
      await screen.findByText("通知が許可されています"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "通知を許可する" }),
    ).not.toBeInTheDocument();
  });

  test("Push未許可(default)時: 「通知を許可する」ボタンが表示される", async () => {
    vi.mocked(getPushPermissionState).mockResolvedValue("default");

    render(<NotificationTab token="test-token" />);

    expect(
      await screen.findByRole("button", { name: "通知を許可する" }),
    ).toBeInTheDocument();
  });

  test("Push拒否(denied)時: 拒否メッセージが表示される", async () => {
    vi.mocked(getPushPermissionState).mockResolvedValue("denied");

    render(<NotificationTab token="test-token" />);

    expect(
      await screen.findByText("通知が拒否されています"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "通知を許可する" }),
    ).not.toBeInTheDocument();
  });

  test("Push全体ONトグルをOFFにすると個別トグルがdisabledになる", async () => {
    render(<NotificationTab token="test-token" />);

    // 設定ロード完了まで待機
    const masterToggle = await screen.findByRole("switch", {
      name: "Push通知",
    });
    expect(masterToggle).toBeChecked();

    // マスタートグルをOFF
    fireEvent.click(masterToggle);

    // Push個別トグルがdisabledになること
    expect(
      screen.getByRole("switch", { name: "デイリーリフレッシュ" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("switch", { name: "ストリークリマインダー" }),
    ).toBeDisabled();
    expect(screen.getByRole("switch", { name: "週次サマリー" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "月次サマリー" })).toBeDisabled();
  });

  test("トグル変更で PUT /api/notifications/settings が呼ばれる", async () => {
    render(<NotificationTab token="test-token" />);

    const streakToggle = await screen.findByRole("switch", {
      name: "ストリークリマインダー",
    });
    fireEvent.click(streakToggle);

    await waitFor(() => {
      expect(updateNotificationSettings).toHaveBeenCalledWith(
        "test-token",
        expect.objectContaining({ streak_reminder: false }),
      );
    });
  });
});
