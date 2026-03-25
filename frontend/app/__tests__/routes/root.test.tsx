import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("~/lib/beta-access", () => ({
  isBetaUnlocked: vi.fn().mockReturnValue(true),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((url: string) => ({ url, _isRedirect: true })),
    Scripts: () => null,
    Links: () => null,
  };
});

vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("~/components/toast", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useToast: () => ({ showToast: vi.fn() }),
}));

import { HydrateFallback } from "~/root";

describe("HydrateFallback", () => {
  test("ロゴ画像とスピナーが表示される", () => {
    render(<HydrateFallback />);

    const logo = screen.getByAltText("Roamble");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/icons/icon-192x192.png");

    const spinner = document.querySelector(".splash-spinner");
    expect(spinner).toBeInTheDocument();
  });

  test("背景色スタイルが含まれている", () => {
    render(<HydrateFallback />);

    const style = document.querySelector("style");
    expect(style?.textContent).toContain("#102222");
  });
});

describe("root clientLoader", () => {
  test("ベータ解錠済みなら null を返す", async () => {
    const { isBetaUnlocked } = await import("~/lib/beta-access");
    vi.mocked(isBetaUnlocked).mockReturnValue(true);
    const { clientLoader } = await import("~/root");

    const result = await clientLoader({
      request: new Request("https://roamble.app/"),
    });
    expect(result).toBeNull();
  });

  test("/beta-gate は未解錠でもリダイレクトしない", async () => {
    const { isBetaUnlocked } = await import("~/lib/beta-access");
    vi.mocked(isBetaUnlocked).mockReturnValue(false);
    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/root");

    const result = await clientLoader({
      request: new Request("https://roamble.app/beta-gate"),
    });
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test("未解錠でベータ対象外ページなら /beta-gate にリダイレクトする", async () => {
    const { isBetaUnlocked } = await import("~/lib/beta-access");
    vi.mocked(isBetaUnlocked).mockReturnValueOnce(false);
    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/root");

    try {
      await clientLoader({ request: new Request("https://roamble.app/home") });
    } catch {
      // throw redirect を使う
    }

    expect(redirect).toHaveBeenCalledWith("/beta-gate");
  });
});
