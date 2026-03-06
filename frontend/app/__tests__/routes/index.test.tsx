import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// auth モジュールのモック
vi.mock("~/lib/auth", () => ({
  getToken: vi.fn(),
}));

import { getToken } from "~/lib/auth";

describe("ランディングページ", () => {
  beforeEach(() => {
    vi.mocked(getToken).mockReturnValue(null);
  });

  test("Roamble のロゴ/タイトルが表示される", async () => {
    const { default: Index } = await import("~/routes/index");
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    expect(screen.getByText("Roamble")).toBeInTheDocument();
  });

  test("サブタイトル（価値提案）が表示される", async () => {
    const { default: Index } = await import("~/routes/index");
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/いつもと違う場所/)
    ).toBeInTheDocument();
  });

  test("利用フローのステップが表示される", async () => {
    const { default: Index } = await import("~/routes/index");
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    // 3ステップの利用フロー（見出しテキストで検証）
    expect(screen.getByText("提案")).toBeInTheDocument();
    expect(screen.getByText("訪問")).toBeInTheDocument();
    expect(screen.getByText("記録")).toBeInTheDocument();
  });

  test("「Roamble ってなに？」リンクが LP ページへ遷移する", async () => {
    const { default: Index } = await import("~/routes/index");
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    const aboutLink = screen.getByText(/Roamble ってなに/);
    const anchor = aboutLink.closest("a");
    expect(anchor).toHaveAttribute("href", "/lp");
  });

  test("「さっそく始める」ボタンが /login へのリンクである", async () => {
    const { default: Index } = await import("~/routes/index");
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    const startLink = screen.getByRole("link", { name: /さっそく始める/ });
    expect(startLink).toBeInTheDocument();
    expect(startLink).toHaveAttribute("href", "/login");
  });

  test("認証済みユーザーは /home へリダイレクトされる", async () => {
    vi.mocked(getToken).mockReturnValue("valid-token");

    const { clientLoader } = await import("~/routes/index");

    try {
      await clientLoader();
      expect.fail("redirect がスローされるべき");
    } catch (response) {
      expect(response).toBeInstanceOf(Response);
      const res = response as Response;
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/home");
    }
  });

  test("未認証ユーザーは null が返される（リダイレクトなし）", async () => {
    vi.mocked(getToken).mockReturnValue(null);

    const { clientLoader } = await import("~/routes/index");

    const result = await clientLoader();
    expect(result).toBeNull();
  });
});
