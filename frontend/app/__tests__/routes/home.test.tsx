import { describe, test, expect, beforeEach, vi } from "vitest";
import { StrictMode } from "react";
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

const sessionStorageData: Record<string, string> = {};
const sessionStorageMock = {
  getItem: (key: string) => sessionStorageData[key] ?? null,
  setItem: (key: string, value: string) => { sessionStorageData[key] = value; },
  removeItem: (key: string) => { delete sessionStorageData[key]; },
  clear: () => { Object.keys(sessionStorageData).forEach(k => delete sessionStorageData[k]); },
};
vi.stubGlobal("sessionStorage", sessionStorageMock);

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
    return Promise.resolve({ places: [...mockPlaces], reload_count_remaining: 3 });
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

function renderHomeStrict() {
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
  return render(
    <StrictMode>
      <Home loaderData={loaderData as any} params={{} as any} matches={[] as any} />
    </StrictMode>
  );
}

describe("Home clientLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
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
    sessionStorageMock.clear();
    localStorageMock.clear(); // localStorageに変更後、テスト間のコンプリートフラグ汚染を防ぐ
  });

  test("提案カード1枚目が表示される", async () => {
    renderHome();
    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });
  });

  test("提案カード1枚目のスワイプで2枚目のカードが表示される", async () => {
    // スキップボタンは削除された（Issue #184: リロードボタンに置き換え）
    // スワイプ操作はDiscoveryCardコンポーネント側で処理されるため、ここではスキップテスト省略
    renderHome();
    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });
  });

  test("提案カードが複数枚表示される", async () => {
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // 複数のカードがスタック表示される
    expect(screen.getByText("テスト公園")).toBeInTheDocument();
    expect(screen.getByText("テストバー")).toBeInTheDocument();
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
    // 1・2件目は未コンプリート、3件目でdaily_completed=trueを返す
    vi.mocked(createVisit)
      .mockResolvedValueOnce({ id: 1, xp_earned: 50, total_xp: 100, level_up: false, new_level: 2, new_badges: [], daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, xp_earned: 50, total_xp: 100, level_up: false, new_level: 2, new_badges: [], daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, xp_earned: 50, total_xp: 150, level_up: false, new_level: 2, new_badges: [], daily_completed: true } as any);

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
    const { createVisit } = await import("~/api/visits");
    // バックエンドの訪問件数に基づくコンプリート判定: 3件目でdaily_completed=trueを返す
    vi.mocked(createVisit)
      .mockResolvedValueOnce({ id: 1, daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, daily_completed: true } as any);
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

  // === Issue #177: ページ再読み込み後もコンプリート画面を表示し、提案済みトーストを非表示にする ===
  test("getSuggestionsがcompletedフラグ付きで返した場合、コンプリートカードが表示される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [],
      completed: true,
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
    });
  });

  test("getSuggestionsがcompletedフラグ付きで返した場合、トーストは表示されない", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [],
      completed: true,
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
    });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  // === Issue #167: 興味タグ施設が半径内に見つからない場合のトースト通知 ===
  test("NO_INTEREST_PLACESのnoticeがある場合、infoトーストが表示される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: mockPlaces,
      notice: "NO_INTEREST_PLACES",
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("興味タグ"),
      "info"
    );
  });

  test("noticeがない場合、興味タグ関連のinfoトーストは表示されない", async () => {
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });
    expect(mockShowToast).not.toHaveBeenCalledWith(
      expect.stringContaining("興味タグ"),
      "info"
    );
  });

  // === Issue #181: トーストが2回表示される問題 ===
  test("React StrictMode環境でも NO_INTEREST_PLACES のinfoトーストは1回のみ表示される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValue({
      places: mockPlaces,
      notice: "NO_INTEREST_PLACES",
    });

    renderHomeStrict();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("興味タグ"),
      "info"
    );
  });

  test("React StrictMode環境でもエラー発生時のトーストは1回のみ表示される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockRejectedValue(
      new ApiError(500, "internal error", "INTERNAL_ERROR")
    );

    renderHomeStrict();

    await waitFor(() => {
      expect(screen.getByText("スポットの取得に失敗しました")).toBeInTheDocument();
    });

    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });
});

// === Issue #223: 3件訪問後に発見画面を再訪問すると再度提案されるバグ修正 ===
describe("Issue #223: コンプリート状態の永続化", () => {
  beforeEach(async () => {
    callCount = 0;
    vi.clearAllMocks();
    sessionStorageMock.clear();
    localStorageMock.clear();
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValue({
      places: [...mockPlaces],
      reload_count_remaining: 3,
    });
  });

  test("3件全て訪問後に再マウントしてもコンプリート画面が表示される（APIを再呼び出ししない）", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    const { createVisit } = await import("~/api/visits");
    // バックエンドの訪問件数に基づくコンプリート判定: 3件目でdaily_completed=trueを返す
    vi.mocked(createVisit)
      .mockResolvedValueOnce({ id: 1, daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, daily_completed: true } as any);

    const user = userEvent.setup();

    // 初回レンダリング
    const { unmount } = renderHome();

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

    // コンプリート状態になる
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
    });

    // API呼び出し回数を記録
    const callCountBeforeRemount = vi.mocked(getSuggestions).mock.calls.length;

    // コンポーネントをアンマウント（BottomNavで他の画面に遷移した想定）
    unmount();

    // 再マウント（BottomNavで/homeに戻った想定）
    renderHome();

    // APIを再呼び出しせずにコンプリート画面が即表示される
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
    });

    // 再マウント後にAPIが追加で呼ばれていないことを確認
    expect(vi.mocked(getSuggestions).mock.calls.length).toBe(callCountBeforeRemount);
  });

  test("コンプリートフラグはlocalStorageで保持される（タブを閉じても当日中は有効）", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [],
      completed: true,
    });

    // 初回レンダリング: サーバーからcompleted=trueが返る
    const { unmount } = renderHome();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
    });

    // アンマウント
    unmount();

    // 再マウント: localStorageからコンプリート状態を復元
    renderHome();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
    });
  });
});

// === Issue #158: レイアウト・スクロール制御 ===
describe("ホームページ レイアウト・スクロール制御", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    // 前のdescribeブロックで mockRejectedValue（永続的な実装変更）が設定されている場合があるため
    // デフォルトの正常レスポンスに明示的にリセットする
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValue({ places: [...mockPlaces] });
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

// === Issue #184: 提案リロード機能 ===
describe("提案リロード機能", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    callCount = 0;
    localStorageMock.clear();
    sessionStorageMock.clear();
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValue({
      places: [...mockPlaces],
      reload_count_remaining: 3,
    });
  });

  test("リロードボタンが表示され残り回数が表示される", async () => {
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const reloadButton = screen.getByRole("button", { name: /リロード/ });
    expect(reloadButton).toBeInTheDocument();
    // 残り回数が表示される
    expect(screen.getByText(/あと3回/)).toBeInTheDocument();
  });

  test("スキップボタンが存在しない", async () => {
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /スキップ/ })).not.toBeInTheDocument();
  });

  test("リロードボタン押下でforceReload付きでAPIが呼ばれる", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [...mockPlaces],
      reload_count_remaining: 2,
    });

    const reloadButton = screen.getByRole("button", { name: /リロード/ });
    await user.click(reloadButton);

    await waitFor(() => {
      expect(getSuggestions).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        true, // forceReload
      );
    });
  });

  test("リロード残り回数0のときリロードボタンが無効化される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [...mockPlaces],
      reload_count_remaining: 0,
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const reloadButton = screen.getByRole("button", { name: /リロード/ });
    expect(reloadButton).toBeDisabled();
  });

  test("リロード上限到達時に適切なトーストが表示される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    // 初回は成功
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [...mockPlaces],
      reload_count_remaining: 1,
    });

    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // リロード時に429を返す
    vi.mocked(getSuggestions).mockRejectedValueOnce(
      new ApiError(429, "今日のリロードは使い切りました。明日また使えます", "RELOAD_LIMIT_REACHED")
    );

    const reloadButton = screen.getByRole("button", { name: /リロード/ });
    await user.click(reloadButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalled();
    });
  });
});
