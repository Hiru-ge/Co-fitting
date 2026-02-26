import { describe, test, expect, beforeEach, vi } from "vitest";
import { ApiError } from "~/utils/error";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = value; },
  removeItem: (key: string) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); },
};
vi.stubGlobal("localStorage", localStorageMock);

const mockShowToast = vi.fn();
vi.mock("~/components/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const mockPlaces = [
  {
    place_id: "place_1",
    name: "テストカフェ",
    vicinity: "渋谷区1-1",
    lat: 35.66,
    lng: 139.7,
    rating: 4.2,
    types: ["cafe"],
  },
  {
    place_id: "place_2",
    name: "テスト公園",
    vicinity: "渋谷区2-2",
    lat: 35.661,
    lng: 139.701,
    rating: 4.0,
    types: ["park"],
  },
  {
    place_id: "place_3",
    name: "テストバー",
    vicinity: "渋谷区3-3",
    lat: 35.662,
    lng: 139.702,
    rating: 3.8,
    types: ["bar"],
  },
];

vi.mock("~/utils/geolocation", () => ({
  getPositionWithFallback: vi.fn().mockResolvedValue({ lat: 35.658, lng: 139.7016 }),
  calcDistance: vi.fn().mockReturnValue(500),
}));

let callCount = 0;
vi.mock("~/api/suggestions", () => ({
  getSuggestions: vi.fn().mockImplementation(() => {
    callCount++;
    return Promise.resolve([...mockPlaces]);
  }),
}));

vi.mock("~/api/visits", () => ({
  createVisit: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(),
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...props}>{children}</a>
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
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  }),
}));

vi.mock("~/api/genres", () => ({
  getInterests: vi.fn().mockResolvedValue([
    { genre_tag_id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
    { genre_tag_id: 2, name: "ラーメン", category: "食べる・飲む", icon: "🍜" },
    { genre_tag_id: 3, name: "公園", category: "自然・観光", icon: "🌳" },
  ]),
}));

import Home from "~/routes/home";

function renderHome() {
  const loaderData = {
    user: {
      id: 1,
      email: "test@example.com",
      display_name: "テストユーザー",
      avatar_url: null,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
    token: "test-token",
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<Home loaderData={loaderData as any} params={{} as any} matches={[] as any} />);
}

describe("Home clientLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  test("interests < 3 かつ onboarding_skipped フラグなしなら /onboarding にリダイレクトする", async () => {
    const { getInterests } = await import("~/api/genres");
    vi.mocked(getInterests).mockResolvedValueOnce([
      { genre_tag_id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
    ]);
    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/routes/home");

    try {
      await clientLoader({} as Parameters<typeof clientLoader>[0]);
    } catch {
      // clientLoaderはthrow redirectを使う
    }

    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  test("interests < 3 でも onboarding_skipped フラグがあれば /onboarding にリダイレクトしない", async () => {
    localStorage.setItem("onboarding_skipped", "true");
    const { getInterests } = await import("~/api/genres");
    vi.mocked(getInterests).mockResolvedValueOnce([
      { genre_tag_id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
    ]);
    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/routes/home");

    const result = await clientLoader({} as Parameters<typeof clientLoader>[0]);

    expect(redirect).not.toHaveBeenCalledWith("/onboarding");
    expect(result).toHaveProperty("token", "test-token");
  });
});

describe("Home画面", () => {
  beforeEach(() => {
    callCount = 0;
    vi.clearAllMocks();
  });

  test("提案カード1枚目が表示される", async () => {
    renderHome();
    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });
  });

  test("スキップ → 2枚目のカードが表示される", async () => {
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const skipButton = screen.getByRole("button", { name: /スキップ/ });
    await user.click(skipButton);

    expect(screen.getByText("テスト公園")).toBeInTheDocument();
  });

  test("3枚目でスキップ → 1枚目に戻る（循環）", async () => {
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const skipButton = screen.getByRole("button", { name: /スキップ/ });
    await user.click(skipButton); // → 2枚目
    await user.click(skipButton); // → 3枚目
    expect(screen.getByText("テストバー")).toBeInTheDocument();

    await user.click(skipButton); // → 1枚目に戻る
    expect(screen.getByText("テストカフェ")).toBeInTheDocument();
  });

  test("「行ってきた！」→ createVisit実行 → カードが消えて次のカードが表示される", async () => {
    const { createVisit } = await import("~/api/visits");
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const checkInButton = screen.getByRole("button", { name: /行ってきた/ });
    await user.click(checkInButton);

    await waitFor(() => {
      expect(createVisit).toHaveBeenCalled();
    });

    // 訪問済みカードが消えて、次のカードが先頭になる
    await waitFor(() => {
      expect(screen.queryByText("テストカフェ")).not.toBeInTheDocument();
      expect(screen.getByText("テスト公園")).toBeInTheDocument();
    });
  });

  test("DAILY_LIMIT_REACHEDエラー時にコンプリートカードが表示される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockRejectedValueOnce(
      new ApiError(404, "all nearby places have been visited", "DAILY_LIMIT_REACHED")
    );

    renderHome();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
    });
  });

  test("DAILY_LIMIT_REACHEDエラー時にエラーメッセージはトーストに表示されない", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockRejectedValueOnce(
      new ApiError(404, "all nearby places have been visited", "DAILY_LIMIT_REACHED")
    );

    renderHome();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
    });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test("INTERNAL_ERRORエラー時にエラーメッセージが表示されトーストが出る", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockRejectedValueOnce(
      new ApiError(500, "failed to search nearby places", "INTERNAL_ERROR")
    );

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("スポットの取得に失敗しました")).toBeInTheDocument();
    });
    expect(mockShowToast).toHaveBeenCalled();
  });

  test("チェックイン時バッジがある場合、XPモーダルを閉じるとバッジモーダルが表示される", async () => {
    const { createVisit } = await import("~/api/visits");
    vi.mocked(createVisit).mockResolvedValueOnce({
      id: 1,
      xp_earned: 50,
      total_xp: 150,
      level_up: false,
      new_level: 2,
      new_badges: [{ id: 1, name: "最初の一歩", description: "初めての訪問！", icon_url: "" }],
    } as any);

    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const checkInButton = screen.getByRole("button", { name: /行ってきた/ });
    await user.click(checkInButton);

    // XPモーダルが表示される
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "XP獲得" })).toBeInTheDocument();
    });

    // XPモーダルを閉じる
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // バッジモーダルが表示される
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "バッジ獲得" })).toBeInTheDocument();
      expect(screen.getByText("最初の一歩")).toBeInTheDocument();
    });
  });

  test("バッジがない場合、XPモーダルを閉じてもバッジモーダルは表示されない", async () => {
    const { createVisit } = await import("~/api/visits");
    vi.mocked(createVisit).mockResolvedValueOnce({
      id: 1,
      xp_earned: 50,
      total_xp: 150,
      level_up: false,
      new_level: 2,
      new_badges: [],
    } as any);

    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const checkInButton = screen.getByRole("button", { name: /行ってきた/ });
    await user.click(checkInButton);

    // XPモーダルが表示される
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "XP獲得" })).toBeInTheDocument();
    });

    // XPモーダルを閉じる
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // バッジモーダルは表示されない
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "バッジ獲得" })).not.toBeInTheDocument();
    });
  });

  // === Issue #164: 3件目完了時にXP獲得モーダルが表示されない問題 ===
  test("3件目チェックイン完了時にXPモーダルが表示される", async () => {
    const { createVisit } = await import("~/api/visits");
    vi.mocked(createVisit).mockResolvedValue({
      id: 1,
      xp_earned: 50,
      total_xp: 150,
      level_up: false,
      new_level: 2,
      new_badges: [],
    } as any);

    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // 1件目チェックイン → XPモーダル → 閉じる
    await user.click(screen.getByRole("button", { name: /行ってきた/ }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "XP獲得" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // 2件目チェックイン → XPモーダル → 閉じる
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /行ってきた/ })).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: /行ってきた/ }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "XP獲得" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // 3件目チェックイン (最後の1件) → XPモーダルが表示されること
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /行ってきた/ })).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: /行ってきた/ }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "XP獲得" })).toBeInTheDocument();
    });
  });

  // === Issue #165: 3件完了時にコンプリートカードを表示する ===
  test("全カードを訪問するとコンプリートカードが表示される", async () => {
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // 3枚全て訪問
    for (let i = 0; i < 3; i++) {
      const checkInButton = screen.getByRole("button", { name: /行ってきた/ });
      await user.click(checkInButton);
      await waitFor(() => {
        expect(checkInButton).not.toBeDisabled();
      }, { timeout: 500 }).catch(() => {});
    }

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
    });
  });

  test("バッジモーダルを閉じると次のバッジが表示される", async () => {
    const { createVisit } = await import("~/api/visits");
    vi.mocked(createVisit).mockResolvedValueOnce({
      id: 1,
      xp_earned: 100,
      total_xp: 200,
      level_up: false,
      new_level: 2,
      new_badges: [
        { id: 1, name: "最初の一歩", description: "初めての訪問！", icon_url: "" },
        { id: 2, name: "コンフォートゾーン・ブレイカー", description: "脱却訪問を達成！", icon_url: "" },
      ],
    } as any);

    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const checkInButton = screen.getByRole("button", { name: /行ってきた/ });
    await user.click(checkInButton);

    // XPモーダルを閉じる
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "XP獲得" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // 1枚目バッジモーダル
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "バッジ獲得" })).toBeInTheDocument();
      expect(screen.getByText("最初の一歩")).toBeInTheDocument();
    });

    // 1枚目を閉じる
    await user.click(screen.getByRole("button", { name: /バッジを獲得/ }));

    // 2枚目バッジモーダル
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "バッジ獲得" })).toBeInTheDocument();
      expect(screen.getByText("コンフォートゾーン・ブレイカー")).toBeInTheDocument();
    });
  });
});

// === Issue #158: レイアウト・スクロール制御 ===
describe("ホームページ レイアウト・スクロール制御", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  test("ローディング中のルートコンテナにmin-h-maxクラスがない", () => {
    const { container } = renderHome();
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).not.toHaveClass("min-h-max");
  });

  test("エラー時のルートコンテナにmin-h-maxクラスがない", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockRejectedValueOnce(new Error("network error"));

    const { container } = renderHome();

    await waitFor(() => {
      expect(screen.getByText("スポットの取得に失敗しました")).toBeInTheDocument();
    });

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).not.toHaveClass("min-h-max");
  });

  test("スポット表示中のルートコンテナにmin-h-maxクラスがない", async () => {
    const { container } = renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).not.toHaveClass("min-h-max");
  });
});
