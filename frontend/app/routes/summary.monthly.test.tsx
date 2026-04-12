import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("~/api/visits", () => ({
  listVisits: vi.fn(),
}));

vi.mock("~/api/users", () => ({
  getUserStats: vi.fn(),
  getUserBadges: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("~/lib/auth", () => ({
  getToken: vi.fn(),
  authRequiredLoader: vi.fn(),
}));

vi.mock("~/api/places", () => ({
  getPlacePhoto: vi.fn().mockResolvedValue(""),
}));

import { getToken, authRequiredLoader } from "~/lib/auth";
import { listVisits } from "~/api/visits";
import { getUserStats, getUserBadges, getUser } from "~/api/users";

const mockVisits = [
  {
    id: 1,
    user_id: 1,
    place_id: "ChIJ_m1",
    place_name: "上野公園",
    vicinity: "台東区",
    category: "park",
    lat: 35.714,
    lng: 139.774,
    rating: null,
    memo: null,
    xp_earned: 50,
    is_breakout: false,
    visited_at: "2024-02-03T12:00:00Z",
    created_at: "2024-02-03T12:00:00Z",
  },
  {
    id: 2,
    user_id: 1,
    place_id: "ChIJ_m2",
    place_name: "浅草寺",
    vicinity: "台東区",
    category: "temple",
    lat: 35.714,
    lng: 139.796,
    rating: null,
    memo: null,
    xp_earned: 80,
    is_breakout: true,
    visited_at: "2024-02-15T12:00:00Z",
    created_at: "2024-02-15T12:00:00Z",
  },
];

// 固定時刻 2026-03-16（3月）における先月（2月）の範囲内: 2026-02-10T01:00:00Z
const mockBadges = [
  {
    id: 2,
    name: "探検家",
    description: "5箇所を訪問",
    icon_url: "",
    earned_at: "2026-02-10T01:00:00.000Z",
  },
];

const mockStats = {
  level: 4,
  total_xp: 800,
  streak_count: 3,
  streak_last: null,
  total_visits: 15,
  breakout_visits: 5,
  challenge_visits: 2,
};

const mockUser = {
  id: 1,
  email: "test@example.com",
  display_name: "テストユーザー",
  search_radius: 1000,
  avatar_url: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// 2026-03-16 12:00 JST に固定 (UTC: 03:00:00)
// Date のみフェイクにすることで findByText などの非同期待機はリアルタイマーを使用できる
const FIXED_NOW_MONTHLY = new Date("2026-03-16T03:00:00Z").getTime();

describe("SummaryMonthly", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW_MONTHLY);
    vi.clearAllMocks();
    vi.mocked(getToken).mockReturnValue("mock-token");
    vi.mocked(authRequiredLoader).mockResolvedValue({
      user: mockUser,
      token: "mock-token",
    });
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(listVisits).mockResolvedValue({ visits: mockVisits, total: 2 });
    vi.mocked(getUserStats).mockResolvedValue(mockStats);
    vi.mocked(getUserBadges).mockResolvedValue(mockBadges);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("訪問件数・獲得XPが表示される", async () => {
    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    // 訪問件数と獲得XPの両方が存在すること
    expect(await screen.findByText("130")).toBeInTheDocument(); // xp_earned合計
    expect(await screen.findByText("か所を冒険!")).toBeInTheDocument();
  });

  test("場所名一覧が表示される", async () => {
    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("上野公園")).toBeInTheDocument();
    expect(await screen.findByText("浅草寺")).toBeInTheDocument();
  });

  test("バッジ名一覧が表示される", async () => {
    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("探検家")).toBeInTheDocument();
  });

  test("未認証時は /login にリダイレクトされる", async () => {
    vi.mocked(authRequiredLoader).mockRejectedValueOnce(
      new Error("unauthorized"),
    );
    const { clientLoader } = await import("./summary.monthly");

    await expect(clientLoader()).rejects.toThrow();
  });

  test("periodラベルが先月の月として表示される", async () => {
    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    // 2026-03-16 固定 → 先月は 2026年2月
    expect(await screen.findByText("2026年2月")).toBeInTheDocument();
  });
});

// ---- バッジフィルタリングのロジック単体テスト ----
// getMonthRange() は Date.now() に依存するため、vi.useFakeTimers() で現在時刻を固定する。
// 固定日時: 2026-03-16 12:00 JST (= 2026-03-16T03:00:00Z)
// → 先月の範囲: 2026-02-01 00:00 JST (= 2026-01-31T15:00:00Z) 〜 2026-03-01 00:00 JST (= 2026-02-28T15:00:00Z)

describe("SummaryMonthly バッジフィルタリング", () => {
  // 2026-03-16 12:00 JST に固定 (UTC: 03:00:00)
  const FIXED_NOW = new Date("2026-03-16T03:00:00Z").getTime();

  // 先月の範囲（JST基準: 2026年2月）
  // from  = 2026-02-01 00:00 JST = 2026-01-31T15:00:00.000Z
  // until = 2026-03-01 00:00 JST = 2026-02-28T15:00:00.000Z
  const MONTH_FROM = "2026-01-31T15:00:00.000Z";
  const MONTH_UNTIL = "2026-02-28T15:00:00.000Z";

  beforeEach(() => {
    // Date のみフェイクにし、setTimeout/setInterval はリアルのまま保持する。
    // こうすることで findByText などの非同期待機がタイムアウトしない。
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
    vi.clearAllMocks();
    vi.mocked(getToken).mockReturnValue("mock-token");
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(listVisits).mockResolvedValue({ visits: [], total: 0 });
    vi.mocked(getUserStats).mockResolvedValue(mockStats);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("earned_at が月の範囲内のバッジのみ表示される", async () => {
    // 期間内: 2026-02-10 10:00 JST (= 2026-02-10T01:00:00Z)
    // 期間外（先々月）: 2026-01-28 10:00 JST (= 2026-01-28T01:00:00Z)
    // 期間外（今月）: 2026-03-01 10:00 JST (= 2026-03-01T01:00:00Z)
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "月内バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-02-10T01:00:00.000Z",
      },
      {
        id: 2,
        name: "先月バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-01-28T01:00:00.000Z",
      },
      {
        id: 3,
        name: "翌月バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-03-01T01:00:00.000Z",
      },
    ]);

    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("月内バッジ")).toBeInTheDocument();
    expect(screen.queryByText("先月バッジ")).not.toBeInTheDocument();
    expect(screen.queryByText("翌月バッジ")).not.toBeInTheDocument();
  });

  test("earned_at が from と一致する（境界値）バッジは表示される", async () => {
    // from ちょうど: 2026-02-28T15:00:00.000Z (= 2026-03-01 00:00 JST)
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "月始まりバッジ",
        description: "",
        icon_url: "",
        earned_at: MONTH_FROM,
      },
    ]);

    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("月始まりバッジ")).toBeInTheDocument();
  });

  test("earned_at が until と一致する（境界値）バッジは表示されない", async () => {
    // until ちょうど: 2026-03-31T15:00:00.000Z (= 2026-04-01 00:00 JST、翌月は範囲外)
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "月終わりバッジ",
        description: "",
        icon_url: "",
        earned_at: MONTH_UNTIL,
      },
    ]);

    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    // ローディング完了を待ってから、表示されないことを確認する
    expect(await screen.findByText("か所を冒険!")).toBeInTheDocument();
    expect(screen.queryByText("月終わりバッジ")).not.toBeInTheDocument();
  });

  test("期間内のバッジが複数ある場合は全て表示される", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "バッジX",
        description: "",
        icon_url: "",
        earned_at: "2026-02-05T00:00:00.000Z",
      },
      {
        id: 2,
        name: "バッジY",
        description: "",
        icon_url: "",
        earned_at: "2026-02-15T00:00:00.000Z",
      },
      {
        id: 3,
        name: "バッジZ",
        description: "",
        icon_url: "",
        earned_at: "2026-02-25T00:00:00.000Z",
      },
      {
        id: 4,
        name: "範囲外バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-01-15T00:00:00.000Z",
      },
    ]);

    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("バッジX")).toBeInTheDocument();
    expect(await screen.findByText("バッジY")).toBeInTheDocument();
    expect(await screen.findByText("バッジZ")).toBeInTheDocument();
    expect(screen.queryByText("範囲外バッジ")).not.toBeInTheDocument();
  });

  test("期間内のバッジが1件もない場合はバッジセクションが空になる", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "先月バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-01-10T00:00:00.000Z",
      },
      {
        id: 2,
        name: "来月バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-03-10T00:00:00.000Z",
      },
    ]);

    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    // ローディング完了を待つ
    expect(await screen.findByText("か所を冒険!")).toBeInTheDocument();
    expect(screen.queryByText("先月バッジ")).not.toBeInTheDocument();
    expect(screen.queryByText("来月バッジ")).not.toBeInTheDocument();
  });
});
