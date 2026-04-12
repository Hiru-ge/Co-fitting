import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("~/lib/beta-access", () => ({
  isBetaUnlocked: vi.fn(),
  unlockBeta: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((to: string) => ({ to })),
    useNavigate: vi.fn(() => mockNavigate),
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
      <a href={to}>{children}</a>
    ),
  };
});

import BetaGate, { clientLoader } from "~/routes/beta-gate";
import { isBetaUnlocked, unlockBeta } from "~/lib/beta-access";

describe("beta-gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("clientLoader: 解錠済みなら/にリダイレクト", async () => {
    vi.mocked(isBetaUnlocked).mockReturnValue(true);
    const { redirect } = await import("react-router");

    try {
      await clientLoader();
    } catch {
      // throw redirect
    }

    expect(redirect).toHaveBeenCalledWith("/");
  });

  test("合言葉成功で / に遷移", async () => {
    vi.mocked(unlockBeta).mockResolvedValue(true);

    render(<BetaGate />);
    await userEvent.type(
      screen.getByPlaceholderText("合言葉を入力..."),
      "EARLYROAMER",
    );
    await userEvent.click(screen.getByRole("button", { name: "入力する" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  test("合言葉失敗でエラー表示", async () => {
    vi.mocked(unlockBeta).mockResolvedValue(false);

    render(<BetaGate />);
    await userEvent.type(
      screen.getByPlaceholderText("合言葉を入力..."),
      "wrong",
    );
    await userEvent.click(screen.getByRole("button", { name: "入力する" }));

    await expect(
      screen.findByText("合言葉が違います。もう一度お試しください"),
    ).resolves.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
