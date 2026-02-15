import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
    Link: ({
      to,
      children,
      ...props
    }: {
      to: string;
      children: React.ReactNode;
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("~/lib/auth", () => ({
  getToken: vi.fn().mockReturnValue("test-token"),
  getUser: vi.fn().mockResolvedValue({
    id: 1,
    email: "test@example.com",
    display_name: "テストユーザー",
    avatar_url: null,
    created_at: "2025-06-15T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z",
  }),
  logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/api/visits", () => ({
  listVisits: vi.fn().mockResolvedValue({
    visits: [
      {
        id: 1,
        place_id: "p1",
        place_name: "テスト場所",
        category: "cafe",
        visited_at: "2025-12-01",
      },
    ],
    total: 12,
  }),
}));

import Profile from "~/routes/profile";
import { logout } from "~/lib/auth";

const mockUser = {
  id: 1,
  email: "test@example.com",
  display_name: "テストユーザー",
  avatar_url: null,
  created_at: "2025-06-15T10:00:00Z",
  updated_at: "2025-12-01T10:00:00Z",
};

function renderProfile() {
  const loaderData = {
    user: mockUser,
    token: "test-token",
  };
  return render(
    <Profile
      loaderData={loaderData as any}
      params={{} as any}
      matches={[] as any}
    />
  );
}

describe("プロフィール画面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("ユーザー情報が表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("テストユーザー")).toBeInTheDocument();
    });
  });

  test("訪問スポット数が表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText(/12/)).toBeInTheDocument();
    });
    expect(screen.getByText("訪問スポット")).toBeInTheDocument();
  });

  test("訪問開始日が表示される", async () => {
    renderProfile();

    await waitFor(() => {
      // created_at: "2025-06-15T10:00:00Z" → 2025年6月
      expect(screen.getByText(/2025年6月/)).toBeInTheDocument();
    });
    expect(screen.getByText("利用開始")).toBeInTheDocument();
  });

  test("ログアウトボタンが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ログアウト/ })).toBeInTheDocument();
    });
  });

  test("ログアウトボタン → 確認モーダル表示", async () => {
    const user = userEvent.setup();
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ログアウト/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /ログアウト/ }));

    expect(screen.getByText("ログアウトしますか？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログアウトする" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
  });

  test("モーダル「ログアウトする」→ 認証情報削除", async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    const { useNavigate } = await import("react-router");
    vi.mocked(useNavigate).mockReturnValue(mockNavigate as any);

    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ログアウト/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /ログアウト/ }));
    await user.click(screen.getByRole("button", { name: "ログアウトする" }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  test("モーダル「キャンセル」→ モーダルが閉じる", async () => {
    const user = userEvent.setup();
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ログアウト/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /ログアウト/ }));
    expect(screen.getByText("ログアウトしますか？")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByText("ログアウトしますか？")).not.toBeInTheDocument();
  });

  test("ローディング中はスケルトンが表示される", async () => {
    renderProfile();
    // 初回レンダリング時はローディング状態
    expect(screen.getByText("マイページ")).toBeInTheDocument();

    // ローディング完了を待って act 警告を解消
    await waitFor(() => {
      expect(screen.getByText(/12/)).toBeInTheDocument();
    });
  });

  test("ヘッダーに設定ボタンと共有ボタンが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "設定" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "共有" })).toBeInTheDocument();
    });
  });

  test("探索履歴とランキングのメニューが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("探索履歴")).toBeInTheDocument();
      expect(screen.getByText("ランキング")).toBeInTheDocument();
    });
  });

  test("「探索を開始」ボタンが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("探索を開始")).toBeInTheDocument();
    });
  });
});
