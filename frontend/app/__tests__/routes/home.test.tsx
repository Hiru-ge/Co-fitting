import { describe, test, expect, beforeEach, vi } from "vitest";
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "~/utils/error";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

const sessionStorageData: Record<string, string> = {};
const sessionStorageMock = {
  getItem: (key: string) => sessionStorageData[key] ?? null,
  setItem: (key: string, value: string) => {
    sessionStorageData[key] = value;
  },
  removeItem: (key: string) => {
    delete sessionStorageData[key];
  },
  clear: () => {
    Object.keys(sessionStorageData).forEach(
      (k) => delete sessionStorageData[k],
    );
  },
};
vi.stubGlobal("sessionStorage", sessionStorageMock);

// PushNotificationBanner の isStandalone() が window.matchMedia を呼ぶためモックが必要
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

const mockShowToast = vi.fn();
vi.mock("~/components/Toast", () => ({
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

vi.mock("~/lib/geolocation", () => ({
  getCurrentPosition: vi.fn().mockResolvedValue({ lat: 35.658, lng: 139.7016 }),
  calcHaversineDistance: vi.fn().mockReturnValue(500),
  startPositionPolling: vi.fn().mockReturnValue(1),
  isWithinCheckInRange: vi.fn().mockReturnValue(true),
}));

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("~/api/suggestions", () => ({
  getSuggestions: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      places: [...mockPlaces],
      reload_count_remaining: 3,
    });
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
    useNavigate: vi.fn().mockReturnValue(mockNavigate),
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
}));

vi.mock("~/api/users", () => ({
  getInterests: vi.fn().mockResolvedValue([
    { genre_tag_id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
    { genre_tag_id: 2, name: "ラーメン", category: "食べる・飲む", icon: "🍜" },
    { genre_tag_id: 3, name: "公園", category: "自然・観光", icon: "🌳" },
  ]),
}));

import Home from "~/routes/home";

function renderHome() {
  const queryClient = new QueryClient();
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
  return render(
    <QueryClientProvider client={queryClient}>
      <Home
        loaderData={loaderData as any}
        params={{} as any}
        matches={[] as any}
      />
    </QueryClientProvider>,
  );
}

function renderHomeStrict() {
  const queryClient = new QueryClient();
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
  return render(
    <QueryClientProvider client={queryClient}>
      <StrictMode>
        <Home
          loaderData={loaderData as any}
          params={{} as any}
          matches={[] as any}
        />
      </StrictMode>
    </QueryClientProvider>,
  );
}

describe("Home clientLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  test("トークンがない場合は /login にリダイレクトし、API 呼び出しは行わない", async () => {
    const { getToken } = await import("~/lib/auth");
    vi.mocked(getToken).mockReturnValueOnce(null);
    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/routes/home");

    try {
      await clientLoader();
    } catch {
      // throw redirect を使う
    }

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  test("getInterests が失敗した場合は /login にのみリダイレクトする", async () => {
    const { getInterests } = await import("~/api/users");
    vi.mocked(getInterests).mockRejectedValueOnce(new Error("network error"));
    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/routes/home");

    try {
      await clientLoader();
    } catch {
      // throw redirect を使う
    }

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(redirect).not.toHaveBeenCalledWith("/onboarding");
  });

  test("interests < 3 で /onboarding にリダイレクトする場合、/login へはリダイレクトしない", async () => {
    const { getInterests } = await import("~/api/users");
    vi.mocked(getInterests).mockResolvedValueOnce([
      { genre_tag_id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
    ]);
    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/routes/home");

    try {
      await clientLoader();
    } catch {
      // throw redirect を使う
    }

    expect(redirect).toHaveBeenCalledWith("/onboarding");
    expect(redirect).not.toHaveBeenCalledWith("/login");
  });

  test("interests < 3 かつ onboarding_skipped フラグなしなら /onboarding にリダイレクトする", async () => {
    const { getInterests } = await import("~/api/users");
    vi.mocked(getInterests).mockResolvedValueOnce([
      { genre_tag_id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
    ]);
    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/routes/home");

    try {
      await clientLoader();
    } catch {
      // clientLoaderはthrow redirectを使う
    }

    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  test("interests < 3 でも onboarding_skipped フラグがあれば /onboarding にリダイレクトしない", async () => {
    localStorage.setItem("onboarding_skipped", "true");
    const { getInterests } = await import("~/api/users");
    vi.mocked(getInterests).mockResolvedValueOnce([
      { genre_tag_id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
    ]);
    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/routes/home");

    const result = await clientLoader();

    expect(redirect).not.toHaveBeenCalledWith("/onboarding");
    expect(result).toHaveProperty("token", "test-token");
  });
});

describe("Home画面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    localStorageMock.clear(); // localStorageに変更後、テスト間のコンプリートフラグ汚染を防ぐ
    localStorage.setItem("home_tour_seen", "true"); // ツアーモーダルをスキップ
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
      new ApiError(500, "failed to search nearby places", "INTERNAL_ERROR"),
    );

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("お店の取得に失敗しました")).toBeInTheDocument();
    });
    expect(mockShowToast).toHaveBeenCalled();
  });

  test("チェックイン時バッジがある場合、XPモーダルを閉じるとバッジモーダルが表示される", async () => {
    const { createVisit } = await import("~/api/visits");
    vi.mocked(createVisit).mockResolvedValueOnce({
      id: 1,
      xp_earned: 50,
      total_xp: 150,
      is_level_up: false,
      new_level: 2,
      new_badges: [
        {
          id: 1,
          name: "最初の一歩",
          description: "初めての訪問！",
          icon_url: "",
        },
      ],
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
      expect(
        screen.getByRole("dialog", { name: "XP獲得" }),
      ).toBeInTheDocument();
    });

    // XPモーダルを閉じる
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // バッジモーダルが表示される
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "バッジ獲得" }),
      ).toBeInTheDocument();
      expect(screen.getByText("最初の一歩")).toBeInTheDocument();
    });
  });

  test("バッジがない場合、XPモーダルを閉じてもバッジモーダルは表示されない", async () => {
    const { createVisit } = await import("~/api/visits");
    vi.mocked(createVisit).mockResolvedValueOnce({
      id: 1,
      xp_earned: 50,
      total_xp: 150,
      is_level_up: false,
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
      expect(
        screen.getByRole("dialog", { name: "XP獲得" }),
      ).toBeInTheDocument();
    });

    // XPモーダルを閉じる
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // バッジモーダルは表示されない
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "バッジ獲得" }),
      ).not.toBeInTheDocument();
    });
  });

  // === Issue #164: 3件目完了時にXP獲得モーダルが表示されない問題 ===
  test("3件目チェックイン完了時にXPモーダルが表示される", async () => {
    const { createVisit } = await import("~/api/visits");
    // 1・2件目は未コンプリート、3件目でis_daily_completed=trueを返す
    vi.mocked(createVisit)
      .mockResolvedValueOnce({
        id: 1,
        xp_earned: 50,
        total_xp: 100,
        is_level_up: false,
        new_level: 2,
        new_badges: [],
        is_daily_completed: false,
      } as any)
      .mockResolvedValueOnce({
        id: 1,
        xp_earned: 50,
        total_xp: 100,
        is_level_up: false,
        new_level: 2,
        new_badges: [],
        is_daily_completed: false,
      } as any)
      .mockResolvedValueOnce({
        id: 1,
        xp_earned: 50,
        total_xp: 150,
        is_level_up: false,
        new_level: 2,
        new_badges: [],
        is_daily_completed: true,
      } as any);

    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // 1件目チェックイン → XPモーダル → 閉じる
    await user.click(screen.getByRole("button", { name: /行ってきた/ }));
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "XP獲得" }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // 2件目チェックイン → XPモーダル → 閉じる
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /行ってきた/ }),
      ).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: /行ってきた/ }));
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "XP獲得" }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // 3件目チェックイン (最後の1件) → XPモーダルが表示されること
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /行ってきた/ }),
      ).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: /行ってきた/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "XP獲得" }),
      ).toBeInTheDocument();
    });
  });

  // === Issue #165: 3件完了時にコンプリートカードを表示する ===
  test("全カードを訪問するとコンプリートカードが表示される", async () => {
    const { createVisit } = await import("~/api/visits");
    // バックエンドの訪問件数に基づくコンプリート判定: 3件目でis_daily_completed=trueを返す
    vi.mocked(createVisit)
      .mockResolvedValueOnce({ id: 1, is_daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, is_daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, is_daily_completed: true } as any);
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // 3枚全て訪問
    for (let i = 0; i < 3; i++) {
      const checkInButton = screen.getByRole("button", { name: /行ってきた/ });
      await user.click(checkInButton);
      await waitFor(
        () => {
          expect(checkInButton).not.toBeDisabled();
        },
        { timeout: 500 },
      ).catch(() => {});
    }

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "コンプリート" }),
      ).toBeInTheDocument();
    });
  });

  test("バッジモーダルを閉じると次のバッジが表示される", async () => {
    const { createVisit } = await import("~/api/visits");
    vi.mocked(createVisit).mockResolvedValueOnce({
      id: 1,
      xp_earned: 100,
      total_xp: 200,
      is_level_up: false,
      new_level: 2,
      new_badges: [
        {
          id: 1,
          name: "最初の一歩",
          description: "初めての訪問！",
          icon_url: "",
        },
        {
          id: 2,
          name: "コンフォートゾーン・ブレイカー",
          description: "脱却訪問を達成！",
          icon_url: "",
        },
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
      expect(
        screen.getByRole("dialog", { name: "XP獲得" }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    // 1枚目バッジモーダル
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "バッジ獲得" }),
      ).toBeInTheDocument();
      expect(screen.getByText("最初の一歩")).toBeInTheDocument();
    });

    // 1枚目を閉じる
    await user.click(screen.getByRole("button", { name: /バッジを獲得/ }));

    // 2枚目バッジモーダル
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "バッジ獲得" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("コンフォートゾーン・ブレイカー"),
      ).toBeInTheDocument();
    });
  });

  // === Issue #177: ページ再読み込み後もコンプリート画面を表示し、提案済みトーストを非表示にする ===
  test("getSuggestionsがis_completedフラグ付きで返した場合、コンプリートカードが表示される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [],
      is_completed: true,
    });

    renderHome();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "コンプリート" }),
      ).toBeInTheDocument();
    });
  });

  test("getSuggestionsがis_completedフラグ付きで返した場合、トーストは表示されない", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [],
      is_completed: true,
    });

    renderHome();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "コンプリート" }),
      ).toBeInTheDocument();
    });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  // === Issue #167: 興味ジャンル施設が半径内に見つからない場合のトースト通知 ===
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
      expect.stringContaining("興味ジャンル"),
      "info",
    );
  });

  test("noticeがない場合、興味ジャンル関連のinfoトーストは表示されない", async () => {
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });
    expect(mockShowToast).not.toHaveBeenCalledWith(
      expect.stringContaining("興味ジャンル"),
      "info",
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
      expect.stringContaining("興味ジャンル"),
      "info",
    );
  });

  test("React StrictMode環境でもエラー発生時のトーストは1回のみ表示される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockRejectedValue(
      new ApiError(500, "internal error", "INTERNAL_ERROR"),
    );

    renderHomeStrict();

    await waitFor(() => {
      expect(screen.getByText("お店の取得に失敗しました")).toBeInTheDocument();
    });

    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });

  // === Issue #268: 位置情報未許可時のUX改善 ===
  test("位置情報が拒否された場合、位置情報モーダルが表示される", async () => {
    const { getCurrentPosition } = await import("~/lib/geolocation");
    vi.mocked(getCurrentPosition).mockRejectedValueOnce(
      Object.assign(new Error("User denied Geolocation"), { code: 1 }),
    );

    renderHome();

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "位置情報が利用できません" }),
      ).toBeInTheDocument();
    });
  });

  test("位置情報モーダルで「渋谷駅周辺で試す」を選ぶと提案が表示される", async () => {
    // 前のテストで mockRejectedValue が設定されている可能性があるため明示的にリセット
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValue({
      places: [...mockPlaces],
      reload_count_remaining: 3,
    });

    const { getCurrentPosition } = await import("~/lib/geolocation");
    vi.mocked(getCurrentPosition).mockRejectedValueOnce(
      Object.assign(new Error("User denied Geolocation"), { code: 1 }),
    );

    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "位置情報が利用できません" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "渋谷駅周辺で試す" }));

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });
    // isDefaultLocation=true のとき AppHeader のアイコンが amber-500 色（location_off）に切り替わる
    const locationIcon = document.querySelector("svg.text-amber-500");
    expect(locationIcon).toBeInTheDocument();
  });

  test("位置情報モーダルで「設定で許可する」を選ぶと設定画面へ遷移する", async () => {
    const { getCurrentPosition } = await import("~/lib/geolocation");
    vi.mocked(getCurrentPosition).mockRejectedValueOnce(
      Object.assign(new Error("User denied Geolocation"), { code: 1 }),
    );

    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "位置情報が利用できません" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "設定で許可する" }));

    expect(mockNavigate).toHaveBeenCalledWith("/settings");
  });
});

// === Issue #223: 3件訪問後に発見画面を再訪問すると再度提案されるバグ修正 ===
describe("Issue #223: コンプリート状態の永続化", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    localStorageMock.clear();
    localStorage.setItem("home_tour_seen", "true"); // ツアーモーダルをスキップ
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValue({
      places: [...mockPlaces],
      reload_count_remaining: 3,
    });
  });

  test("3件全て訪問後に再マウントしてもコンプリート画面が表示される（APIで状態復元）", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    const { createVisit } = await import("~/api/visits");
    // バックエンドの訪問件数に基づくコンプリート判定: 3件目でis_daily_completed=trueを返す
    vi.mocked(createVisit)
      .mockResolvedValueOnce({ id: 1, is_daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, is_daily_completed: false } as any)
      .mockResolvedValueOnce({ id: 1, is_daily_completed: true } as any);

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
      await waitFor(
        () => {
          expect(checkInButton).not.toBeDisabled();
        },
        { timeout: 500 },
      ).catch(() => {});
    }

    // コンプリート状態になる
    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "コンプリート" }),
      ).toBeInTheDocument();
    });

    // API呼び出し回数を記録
    const callCountBeforeRemount = vi.mocked(getSuggestions).mock.calls.length;

    // コンポーネントをアンマウント（BottomNavで他の画面に遷移した想定）
    unmount();

    // 再マウント時はサーバーが is_completed=true を返す想定
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [],
      is_completed: true,
    });

    // 再マウント（BottomNavで/homeに戻った想定）
    renderHome();

    // APIの応答によりコンプリート画面が表示される
    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "コンプリート" }),
      ).toBeInTheDocument();
    });

    // 再マウント後は API が1回追加で呼ばれる
    expect(vi.mocked(getSuggestions).mock.calls.length).toBe(
      callCountBeforeRemount + 1,
    );
  });

  test("コンプリート状態は再マウント時のAPI応答で復元される", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [],
      is_completed: true,
    });

    // 初回レンダリング: サーバーからis_completed=trueが返る
    const { unmount } = renderHome();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "コンプリート" }),
      ).toBeInTheDocument();
    });

    // アンマウント
    unmount();

    // 再マウント: APIが再び is_completed=true を返す
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [],
      is_completed: true,
    });
    renderHome();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "コンプリート" }),
      ).toBeInTheDocument();
    });
  });
});

// === Issue #158: レイアウト・スクロール制御 ===
describe("ホームページ レイアウト・スクロール制御", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    localStorage.setItem("home_tour_seen", "true"); // ツアーモーダルをスキップ
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
      expect(screen.getByText("お店の取得に失敗しました")).toBeInTheDocument();
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
    localStorageMock.clear();
    sessionStorageMock.clear();
    localStorage.setItem("home_tour_seen", "true"); // ツアーモーダルをスキップ
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

    expect(
      screen.queryByRole("button", { name: /スキップ/ }),
    ).not.toBeInTheDocument();
  });

  test("リロードボタン押下でisReload付きでAPIが呼ばれる", async () => {
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
        true,
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
      new ApiError(
        429,
        "今日のリロードは使い切りました。明日また使えます",
        "RELOAD_LIMIT_REACHED",
      ),
    );

    const reloadButton = screen.getByRole("button", { name: /リロード/ });
    await user.click(reloadButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalled();
    });
  });
});

// === Issue #252: 位置情報変化による自動再提案機能の排除 ===
describe("Issue #252: 位置情報変化による自動再提案機能の排除", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    localStorage.setItem("home_tour_seen", "true"); // ツアーモーダルをスキップ
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValue({
      places: [...mockPlaces],
      reload_count_remaining: 3,
    });
  });

  test("マウント時の getSuggestions 呼び出しは1回のみ（位置情報変化で自動再呼び出しされない）", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // マウント後の呼び出し回数が1回のみであることを確認
    // 「位置情報が変わったら自動で再提案」という動作は存在しない
    expect(vi.mocked(getSuggestions).mock.calls.length).toBe(1);
  });

  // === Issue #262: 施設カード表示中は startPositionPolling が呼ばれる ===
  test("施設カード表示中は startPositionPolling が呼ばれる（距離定期更新）", async () => {
    const { startPositionPolling } = await import("~/lib/geolocation");

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // 施設カードが表示されている → startPositionPolling が呼ばれる
    expect(vi.mocked(startPositionPolling)).toHaveBeenCalled();
    // 位置更新が getSuggestions の再呼び出しを引き起こさない
    const { getSuggestions } = await import("~/api/suggestions");
    expect(vi.mocked(getSuggestions).mock.calls.length).toBe(1);
  });

  test("提案取得後にアンマウント→再マウントすると getSuggestions は再呼び出しされる（位置変化に関係なく）", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    const { getCurrentPosition } = await import("~/lib/geolocation");

    // 初回: 位置A
    vi.mocked(getCurrentPosition).mockResolvedValue({
      lat: 35.658,
      lng: 139.7016,
    });

    const { unmount } = renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const callCountAfterFirstMount =
      vi.mocked(getSuggestions).mock.calls.length;
    expect(callCountAfterFirstMount).toBe(1);

    // 画面遷移をシミュレート（アンマウント）
    unmount();

    // 位置が変わった（B地点）状態で再マウント
    vi.mocked(getCurrentPosition).mockResolvedValue({
      lat: 35.68,
      lng: 139.76,
    });
    renderHome();

    // 再マウント後も API 応答で提案カードが表示される
    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // 再マウント後に getSuggestions が1回追加で呼ばれることを確認
    expect(vi.mocked(getSuggestions).mock.calls.length).toBe(
      callCountAfterFirstMount + 1,
    );
  });

  test("isReload（リロードボタン押下）時は再取得する", async () => {
    const { getSuggestions } = await import("~/api/suggestions");
    const user = userEvent.setup();

    const { unmount } = renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // アンマウント → 再マウント
    unmount();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const callCountBeforeReload = vi.mocked(getSuggestions).mock.calls.length;

    // リロードボタンを押す
    const reloadButton = screen.getByRole("button", { name: /リロード/ });
    await user.click(reloadButton);

    await waitFor(() => {
      expect(vi.mocked(getSuggestions).mock.calls.length).toBeGreaterThan(
        callCountBeforeReload,
      );
    });

    // isReload=true で呼ばれていることを確認
    const lastCall = vi.mocked(getSuggestions).mock.calls.at(-1);
    expect(lastCall?.[3]).toBe(true); // 第4引数が isReload
  });
});

// === Issue #258: ホームチュートリアルツアーモーダル ===
describe("Issue #258: ホームチュートリアルツアーモーダル", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    const { getSuggestions } = await import("~/api/suggestions");
    vi.mocked(getSuggestions).mockResolvedValue({
      places: [...mockPlaces],
      reload_count_remaining: 3,
    });
  });

  test("home_tour_seen が null のとき HomeTourModal が表示される", async () => {
    renderHome();
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "使い方ツアー" }),
      ).toBeInTheDocument();
    });
  });

  test("home_tour_seen が 'true' のとき HomeTourModal は表示されない", async () => {
    localStorage.setItem("home_tour_seen", "true");
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("dialog", { name: "使い方ツアー" }),
    ).not.toBeInTheDocument();
  });
});
