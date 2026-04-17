import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockShowToast = vi.fn();
vi.mock("~/components/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
    useLocation: vi.fn().mockReturnValue({ state: null }),
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
  authRequiredLoader: vi.fn().mockResolvedValue({
    user: {
      id: 1,
      email: "test@example.com",
      display_name: "テストユーザー",
      avatar_url: null,
      created_at: "2025-06-15T10:00:00Z",
      updated_at: "2025-12-01T10:00:00Z",
    },
    token: "test-token",
  }),
  logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/api/badges", () => ({
  getAllBadges: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "最初の一歩",
      description: "初めての訪問を記録した",
      icon_url: "",
    },
    {
      id: 2,
      name: "ジャンル開拓者",
      description: "チャレンジ訪問を5件達成した",
      icon_url: "",
    },
    { id: 3, name: "探索者", description: "10回訪問した", icon_url: "" },
  ]),
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

vi.mock("~/api/users", () => ({
  getUser: vi.fn().mockResolvedValue({
    id: 1,
    email: "test@example.com",
    display_name: "テストユーザー",
    avatar_url: null,
    created_at: "2025-06-15T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z",
  }),
  getUserStats: vi.fn().mockResolvedValue({
    level: 5,
    total_xp: 850,
    streak_count: 3,
    streak_last: "2025-12-01T10:00:00Z",
    total_visits: 48,
    breakout_visits: 10,
    challenge_visits: 38,
  }),
  getUserBadges: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "最初の一歩",
      description: "初めての訪問を記録した",
      icon_url: "",
      earned_at: "2025-07-01T10:00:00Z",
    },
    {
      id: 2,
      name: "ジャンル開拓者",
      description: "チャレンジ訪問を5件達成した",
      icon_url: "",
      earned_at: "2025-08-01T10:00:00Z",
    },
  ]),
  getProficiency: vi.fn().mockResolvedValue([
    {
      genre_tag_id: 1,
      genre_name: "カフェ",
      category: "飲食",
      icon: "local_cafe",
      xp: 300,
      level: 3,
    },
    {
      genre_tag_id: 2,
      genre_name: "スポーツ施設",
      category: "スポーツ",
      icon: "directions_run",
      xp: 150,
      level: 2,
    },
  ]),
}));

import Profile from "~/routes/profile";
import { logout } from "~/lib/auth";
import { getLevelInfo, getLevelTitle } from "~/utils/level";

const mockUser = {
  id: 1,
  email: "test@example.com",
  display_name: "テストユーザー",
  avatar_url: null,
  created_at: "2025-06-15T10:00:00Z",
  updated_at: "2025-12-01T10:00:00Z",
};

const mockStats = {
  level: 5,
  total_xp: 850,
  streak_count: 3,
  streak_last: "2025-12-01T10:00:00Z",
  total_visits: 48,
  breakout_visits: 10,
  challenge_visits: 38,
};

const mockBadges = [
  {
    id: 1,
    name: "最初の一歩",
    description: "初めての訪問を記録した",
    icon_url: "",
    earned_at: "2025-07-01T10:00:00Z",
  },
  {
    id: 2,
    name: "ジャンル開拓者",
    description: "チャレンジ訪問を5件達成した",
    icon_url: "",
    earned_at: "2025-08-01T10:00:00Z",
  },
];

const mockProficiency = [
  {
    genre_tag_id: 1,
    genre_name: "カフェ",
    category: "飲食",
    icon: "local_cafe",
    xp: 300,
    level: 3,
  },
  {
    genre_tag_id: 2,
    genre_name: "スポーツ施設",
    category: "スポーツ",
    icon: "directions_run",
    xp: 150,
    level: 2,
  },
];

function renderProfile() {
  const loaderData = {
    user: mockUser,
    stats: mockStats,
    badges: mockBadges,
    proficiency: mockProficiency,
    totalBadgeCount: 3,
    levelInfo: getLevelInfo(mockStats.total_xp),
    levelTitle: getLevelTitle(mockStats.level),
  };
  return render(
    <Profile
      loaderData={loaderData as any}
      params={{} as any}
      matches={[] as any}
    />,
  );
}

const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageData[key] = value;
  },
  removeItem: (key: string) => {
    delete localStorageData[key];
  },
  clear: () => {
    Object.keys(localStorageData).forEach((k) => delete localStorageData[k]);
  },
};
vi.stubGlobal("localStorage", localStorageMock);

describe("プロフィール画面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  test("ユーザー情報が表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("テストユーザー")).toBeInTheDocument();
    });
  });

  test("ローディング完了後にXPが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      // getUserStats.total_xp: 850
      expect(screen.getByText(/850/)).toBeInTheDocument();
    });
  });

  test("ログアウトボタンが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /ログアウト/ }),
      ).toBeInTheDocument();
    });
  });

  test("ログアウトボタン → 確認モーダル表示", async () => {
    const user = userEvent.setup();
    renderProfile();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /ログアウト/ }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /ログアウト/ }));

    expect(screen.getByText("ログアウトしますか？")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ログアウトする" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "キャンセル" }),
    ).toBeInTheDocument();
  });

  test("モーダル「ログアウトする」→ 認証情報削除", async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    const { useNavigate } = await import("react-router");
    vi.mocked(useNavigate).mockReturnValue(mockNavigate as any);

    renderProfile();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /ログアウト/ }),
      ).toBeInTheDocument();
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
      expect(
        screen.getByRole("button", { name: /ログアウト/ }),
      ).toBeInTheDocument();
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
      expect(screen.getByText(/850/)).toBeInTheDocument();
    });
  });

  test("ヘッダーに設定ボタンと共有ボタンが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "設定" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "共有" })).toBeInTheDocument();
    });
  });

  test("共有ボタンはdisabled状態でグレーアウト表示される（未実装）", async () => {
    renderProfile();

    await waitFor(() => {
      const shareButton = screen.getByRole("button", { name: "共有" });
      expect(shareButton).toBeDisabled();
      expect(shareButton).toHaveClass("btn-unimplemented");
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

  test("レベルと称号が表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText(/LV\.5/)).toBeInTheDocument();
      expect(screen.getByText(/シティエクスプローラー/)).toBeInTheDocument();
    });
  });

  test("XPとプログレスバーが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText(/850/)).toBeInTheDocument();
      expect(screen.getByText(/1170\s*XP/)).toBeInTheDocument();
    });
  });

  test("次のレベルまでのXPが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      // total_xp: 850, level 5 → 次のレベル(1170XP)まで320XP
      expect(screen.getByText(/次のレベルまであと/)).toBeInTheDocument();
    });
  });

  test("獲得バッジが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("最初の一歩")).toBeInTheDocument();
      expect(screen.getByText("ジャンル開拓者")).toBeInTheDocument();
    });
  });

  test("獲得バッジセクションタイトルが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("獲得バッジ")).toBeInTheDocument();
    });
  });

  test("ジャンル熟練度トップが表示される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("カフェ")).toBeInTheDocument();
    });
  });

  test("統計情報（挑戦訪問数）が表示される", async () => {
    renderProfile();

    await waitFor(() => {
      // challenge_visits: 38
      expect(screen.getByText(/38/)).toBeInTheDocument();
    });
  });

  // === Issue #258: プロフィールツアーステップ3 ===
  test("onboarding_stage が profile_tour のとき ProfileTourStep が表示される", async () => {
    localStorage.setItem("onboarding_stage", "profile_tour");
    renderProfile();

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "使い方ツアー ステップ4" }),
      ).toBeInTheDocument();
      expect(screen.getByText("XPとバッジを集めよう")).toBeInTheDocument();
      expect(screen.getByText("4 / 4")).toBeInTheDocument();
    });
  });

  test("onboarding_stage がないとき ProfileTourStep は表示されない", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("テストユーザー")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("dialog", { name: "使い方ツアー ステップ4" }),
    ).not.toBeInTheDocument();
  });

  test("ProfileTourStep「はじめる」でフラグが書き込まれ /home に遷移する", async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    const { useNavigate } = await import("react-router");
    vi.mocked(useNavigate).mockReturnValue(mockNavigate as any);

    localStorage.setItem("onboarding_stage", "profile_tour");
    renderProfile();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "はじめる" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "はじめる" }));

    expect(localStorage.getItem("home_tour_seen")).toBe("true");
    expect(localStorage.getItem("onboarding_stage")).toBe("completed");
    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  test("ProfileTourStep「スキップ」でもフラグが書き込まれ /home に遷移する", async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    const { useNavigate } = await import("react-router");
    vi.mocked(useNavigate).mockReturnValue(mockNavigate as any);

    localStorage.setItem("onboarding_stage", "profile_tour");
    renderProfile();

    await waitFor(() => {
      // ツアーオーバーレイ内のスキップボタン
      const skipButtons = screen.getAllByRole("button", { name: "スキップ" });
      expect(skipButtons.length).toBeGreaterThan(0);
    });

    const skipButtons = screen.getAllByRole("button", { name: "スキップ" });
    // ツアーオーバーレイのスキップは最後のもの（dialog内）
    await user.click(skipButtons[skipButtons.length - 1]);

    expect(localStorage.getItem("home_tour_seen")).toBe("true");
    expect(localStorage.getItem("onboarding_stage")).toBe("completed");
    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  test("得意ジャンル一覧の各行にジャンル名とアイコンが別要素として正しく描画される", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("得意ジャンル")).toBeInTheDocument();
      expect(screen.getByText("カフェ")).toBeInTheDocument();
      expect(screen.getByText("スポーツ施設")).toBeInTheDocument();
    });

    // ジャンル名がtruncateクラスを持つspan要素であること
    const genreNameEl = screen.getByText("カフェ");
    expect(genreNameEl.tagName.toLowerCase()).toBe("span");
    expect(genreNameEl).toHaveClass("truncate");

    // アイコンがSVG要素として別途存在すること（Iconコンポーネントによるインラインsvg）
    const iconContainers = document.querySelectorAll(".overflow-hidden");
    const genreIconContainer = Array.from(iconContainers).find((el) =>
      el.querySelector("svg"),
    );
    expect(genreIconContainer).toBeTruthy();
    const iconSvg = genreIconContainer?.querySelector("svg");
    expect(iconSvg).toBeTruthy();

    // アイコンSVGとジャンル名spanが異なる要素であること
    expect(iconSvg).not.toBe(genreNameEl);

    // アイコンコンテナがoverflow-hiddenを持ち、はみ出しによる重なりを防止していること
    expect(genreIconContainer).toHaveClass("overflow-hidden");
  });
});
