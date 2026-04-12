import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("~/lib/pwa", () => ({
  isStandalone: vi.fn(),
  isPWAPromptDismissed: vi.fn(),
  reviewPWAPrompt: vi.fn(),
  detectPlatform: vi.fn(),
  getInstallPrompt: vi.fn(),
  triggerInstallPrompt: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((to: string) => ({ to })),
    useNavigate: vi.fn(() => mockNavigate),
  };
});

import PWAPrompt, { clientLoader } from "~/routes/pwa-prompt";
import {
  isStandalone,
  isPWAPromptDismissed,
  reviewPWAPrompt,
  detectPlatform,
  getInstallPrompt,
  triggerInstallPrompt,
} from "~/lib/pwa";

describe("pwa-prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isStandalone).mockReturnValue(false);
    vi.mocked(isPWAPromptDismissed).mockReturnValue(false);
    vi.mocked(detectPlatform).mockReturnValue("android");
    vi.mocked(getInstallPrompt).mockReturnValue({} as never);
    vi.mocked(triggerInstallPrompt).mockResolvedValue(true);
  });

  test("clientLoader: standaloneかdismiss済みなら/にリダイレクト", async () => {
    const { redirect } = await import("react-router");

    vi.mocked(isStandalone).mockReturnValue(true);
    try {
      await clientLoader();
    } catch {
      // throw redirect
    }
    expect(redirect).toHaveBeenCalledWith("/");

    vi.clearAllMocks();
    vi.mocked(isStandalone).mockReturnValue(false);
    vi.mocked(isPWAPromptDismissed).mockReturnValue(true);
    try {
      await clientLoader();
    } catch {
      // throw redirect
    }
    expect(redirect).toHaveBeenCalledWith("/");
  });

  test("Androidでインストール成功時にreview+ホーム遷移", async () => {
    render(<PWAPrompt />);

    await userEvent.click(
      screen.getByRole("button", { name: "インストールする" }),
    );

    await waitFor(() => {
      expect(triggerInstallPrompt).toHaveBeenCalled();
      expect(reviewPWAPrompt).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  test("スキップ時にreview+ホーム遷移", async () => {
    render(<PWAPrompt />);

    await userEvent.click(
      screen.getByRole("button", { name: "ブラウザで続ける →" }),
    );

    expect(reviewPWAPrompt).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
