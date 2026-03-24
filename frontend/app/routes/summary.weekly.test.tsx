import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("~/api/visits", () => ({
  listVisits: vi.fn(),
}));

vi.mock("~/api/users", () => ({
  getUserStats: vi.fn(),
  getUserBadges: vi.fn(),
}));

vi.mock("~/lib/auth", () => ({
  getToken: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("~/api/places", () => ({
  getPlacePhoto: vi.fn().mockResolvedValue(""),
}));

import { getToken, getUser } from "~/lib/auth";
import { listVisits } from "~/api/visits";
import { getUserStats, getUserBadges } from "~/api/users";

const mockVisits = [
  {
    id: 1, user_id: 1, place_id: "ChIJ_1", place_name: "代々木公園", vicinity: "渋谷区",
    category: "park", lat: 35.677, lng: 139.650, rating: null, memo: null,
    xp_earned: 50, is_breakout: false, visited_at: "2024-02-05T12:00:00Z", created_at: "2024-02-05T12:00:00Z",
  },
  {
    id: 2, user_id: 1, place_id: "ChIJ_2", place_name: "原宿カフェ", vicinity: "渋谷区",
    category: "cafe", lat: 35.678, lng: 139.651, rating: null, memo: null,
    xp_earned: 100, is_breakout: true, visited_at: "2024-02-06T12:00:00Z", created_at: "2024-02-06T12:00:00Z",
  },
];

// 固定時刻 2026-03-16（月曜）における今週の範囲内: 2026-03-17T01:00:00Z
const mockBadges = [
  { id: 1, name: "初冒険者", description: "初めての訪問", icon_url: "", earned_at: "2026-03-17T01:00:00.000Z" },
];

const mockStats = {
  level: 3, total_xp: 500, streak_count: 2, streak_last: null,
  total_visits: 10, breakout_visits: 3, challenge_visits: 1,
};

const mockUser = {
  id: 1, email: "test@example.com", display_name: "テストユーザー",
  search_radius: 1000, avatar_url: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
};

// 2026-03-16 月曜日 12:00 JST に固定 (UTC: 03:00:00)
// Date のみフェイクにすることで findByText などの非同期待機はリアルタイマーを使用できる
const FIXED_NOW_WEEKLY = new Date("2026-03-16T03:00:00Z").getTime();

describe("SummaryWeekly", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW_WEEKLY);
    vi.clearAllMocks();
    vi.mocked(getToken).mockReturnValue("mock-token");
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(listVisits).mockResolvedValue({ visits: mockVisits, total: 2 });
    vi.mocked(getUserStats).mockResolvedValue(mockStats);
    vi.mocked(getUserBadges).mockResolvedValue(mockBadges);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("訪問件数・獲得XPが表示される", async () => {
    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("150")).toBeInTheDocument(); // xp_earned合計
    expect(await screen.findByText("か所を冒険!")).toBeInTheDocument();
  });

  test("場所名一覧が表示される", async () => {
    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("代々木公園")).toBeInTheDocument();
    expect(await screen.findByText("原宿カフェ")).toBeInTheDocument();
  });

  test("バッジ名一覧が表示される", async () => {
    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("初冒険者")).toBeInTheDocument();
  });

  test("未認証時は /login にリダイレクトされる", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    const { clientLoader } = await import("./summary.weekly");

    await expect(clientLoader({ params: {}, request: new Request("http://localhost/summary/weekly"), context: {} } as never)).rejects.toThrow();
  });

  test("APIが失敗した場合にエラーメッセージが表示される", async () => {
    vi.mocked(listVisits).mockRejectedValue(new Error("Network error"));
    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText(/データの取得に失敗しました/)).toBeInTheDocument();
  });

  test("periodラベルが画面に表示される", async () => {
    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    // 2026-03-16 (月) 固定 → 週は 3/16（月）〜 3/22（日）
    expect(await screen.findByText("3/16（月）〜 3/22（日）")).toBeInTheDocument();
  });
});

// ---- バッジフィルタリングのロジック単体テスト ----
// getWeekRange() は Date.now() に依存するため、vi.useFakeTimers() で現在時刻を固定する。
// 固定日時: 2026-03-16 月曜日 12:00 JST (= 2026-03-16T03:00:00Z)
// → 週の範囲: 2026-03-16 00:00 JST (= 2026-03-15T15:00:00Z) 〜 2026-03-23 00:00 JST (= 2026-03-22T15:00:00Z)

describe("SummaryWeekly バッジフィルタリング", () => {
  // 2026-03-16 月曜日 12:00 JST に固定 (UTC: 03:00:00)
  const FIXED_NOW = new Date("2026-03-16T03:00:00Z").getTime();

  // この週の範囲（JST基準）
  // from  = 2026-03-16 00:00 JST = 2026-03-15T15:00:00.000Z
  // until = 2026-03-23 00:00 JST = 2026-03-22T15:00:00.000Z
  const WEEK_FROM  = "2026-03-15T15:00:00.000Z";
  const WEEK_UNTIL = "2026-03-22T15:00:00.000Z";

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

  test("earned_at が週の範囲内のバッジのみ表示される", async () => {
    // 期間内: 2026-03-17 10:00 JST (= 2026-03-17T01:00:00Z)
    // 期間外（前週）: 2026-03-14 10:00 JST (= 2026-03-14T01:00:00Z)
    // 期間外（翌週）: 2026-03-23 10:00 JST (= 2026-03-23T01:00:00Z)
    vi.mocked(getUserBadges).mockResolvedValue([
      { id: 1, name: "週内バッジ",   description: "", icon_url: "", earned_at: "2026-03-17T01:00:00.000Z" },
      { id: 2, name: "前週バッジ",   description: "", icon_url: "", earned_at: "2026-03-14T01:00:00.000Z" },
      { id: 3, name: "翌週バッジ",   description: "", icon_url: "", earned_at: "2026-03-23T01:00:00.000Z" },
    ]);

    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("週内バッジ")).toBeInTheDocument();
    expect(screen.queryByText("前週バッジ")).not.toBeInTheDocument();
    expect(screen.queryByText("翌週バッジ")).not.toBeInTheDocument();
  });

  test("earned_at が from と一致する（境界値）バッジは表示される", async () => {
    // from ちょうど: 2026-03-15T15:00:00.000Z
    vi.mocked(getUserBadges).mockResolvedValue([
      { id: 1, name: "週始まりバッジ", description: "", icon_url: "", earned_at: WEEK_FROM },
    ]);

    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("週始まりバッジ")).toBeInTheDocument();
  });

  test("earned_at が until と一致する（境界値）バッジは表示されない", async () => {
    // until ちょうど: 2026-03-22T15:00:00.000Z （翌週月曜0時JSTは範囲外）
    vi.mocked(getUserBadges).mockResolvedValue([
      { id: 1, name: "週終わりバッジ", description: "", icon_url: "", earned_at: WEEK_UNTIL },
    ]);

    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    // まずローディング完了を待ってから、表示されないことを確認する
    expect(await screen.findByText("か所を冒険!")).toBeInTheDocument();
    expect(screen.queryByText("週終わりバッジ")).not.toBeInTheDocument();
  });

  test("期間内のバッジが複数ある場合は全て表示される", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      { id: 1, name: "バッジA", description: "", icon_url: "", earned_at: "2026-03-16T05:00:00.000Z" },
      { id: 2, name: "バッジB", description: "", icon_url: "", earned_at: "2026-03-18T08:00:00.000Z" },
      { id: 3, name: "バッジC", description: "", icon_url: "", earned_at: "2026-03-20T12:00:00.000Z" },
      { id: 4, name: "範囲外バッジ", description: "", icon_url: "", earned_at: "2026-03-10T00:00:00.000Z" },
    ]);

    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("バッジA")).toBeInTheDocument();
    expect(await screen.findByText("バッジB")).toBeInTheDocument();
    expect(await screen.findByText("バッジC")).toBeInTheDocument();
    expect(screen.queryByText("範囲外バッジ")).not.toBeInTheDocument();
  });

  test("期間内のバッジが1件もない場合はバッジセクションが空になる", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      { id: 1, name: "先週バッジ",   description: "", icon_url: "", earned_at: "2026-03-09T00:00:00.000Z" },
      { id: 2, name: "来週バッジ",   description: "", icon_url: "", earned_at: "2026-03-24T00:00:00.000Z" },
    ]);

    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    // ローディング完了を待つ
    expect(await screen.findByText("か所を冒険!")).toBeInTheDocument();
    expect(screen.queryByText("先週バッジ")).not.toBeInTheDocument();
    expect(screen.queryByText("来週バッジ")).not.toBeInTheDocument();
  });
});
