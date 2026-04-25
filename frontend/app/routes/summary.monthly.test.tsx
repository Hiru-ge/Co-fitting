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
import { getUserBadges } from "~/api/users";

const mockVisits = [
  {
    id: 1,
    user_id: 1,
    place_id: "ChIJ_m1",
    place_name: "上野ボウリング",
    vicinity: "台東区",
    category: "bowling_alley",
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
    place_name: "浅草書店",
    vicinity: "台東区",
    category: "book_store",
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

const mockUser = {
  id: 1,
  email: "test@example.com",
  display_name: "テストユーザー",
  search_radius: 1000,
  enable_adult_venues: true,
  avatar_url: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// 2026-03-16 12:00 JST に固定 (UTC: 03:00:00)
const FIXED_NOW_MONTHLY = new Date("2026-03-16T03:00:00Z").getTime();

describe("SummaryMonthly", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW_MONTHLY);
    vi.clearAllMocks();
    vi.mocked(getToken).mockReturnValue("mock-token");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 2026-03-16固定 → 先月は2026年2月
  const monthLabel = "2026年2月";

  test("訪問件数・獲得XPが表示される", async () => {
    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{
            user: mockUser,
            visits: mockVisits,
            badges: mockBadges,
            label: monthLabel,
          }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("130")).toBeInTheDocument(); // xp_earned合計
    expect(await screen.findByText("か所を冒険!")).toBeInTheDocument();
  });

  test("場所名一覧が表示される", async () => {
    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{
            user: mockUser,
            visits: mockVisits,
            badges: [],
            label: monthLabel,
          }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("上野ボウリング")).toBeInTheDocument();
    expect(await screen.findByText("浅草書店")).toBeInTheDocument();
  });

  test("バッジ名一覧が表示される", async () => {
    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{
            user: mockUser,
            visits: [],
            badges: mockBadges,
            label: monthLabel,
          }}
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
          loaderData={{
            user: mockUser,
            visits: [],
            badges: [],
            label: monthLabel,
          }}
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
// getYearMonthRange() は new Date() に依存するため、vi.useFakeTimers() で現在時刻を固定する。
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
    vi.clearAllMocks();
    vi.mocked(getToken).mockReturnValue("mock-token");
    vi.mocked(authRequiredLoader).mockResolvedValue({
      user: mockUser,
      token: "mock-token",
    });
    vi.mocked(listVisits).mockResolvedValue({ visits: [], total: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("earned_at が月の範囲内のバッジのみ表示される", async () => {
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

    const { clientLoader } = await import("./summary.monthly");
    const result = await clientLoader();
    const badgeNames = result.badges.map((b) => b.name);

    expect(badgeNames).toContain("月内バッジ");
    expect(badgeNames).not.toContain("先月バッジ");
    expect(badgeNames).not.toContain("翌月バッジ");
  });

  test("earned_at が from と一致する（境界値）バッジは表示される", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "月始まりバッジ",
        description: "",
        icon_url: "",
        earned_at: MONTH_FROM,
      },
    ]);

    const { clientLoader } = await import("./summary.monthly");
    const result = await clientLoader();
    const badgeNames = result.badges.map((b) => b.name);

    expect(badgeNames).toContain("月始まりバッジ");
  });

  test("earned_at が until と一致する（境界値）バッジは表示されない", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "月終わりバッジ",
        description: "",
        icon_url: "",
        earned_at: MONTH_UNTIL,
      },
    ]);

    const { clientLoader } = await import("./summary.monthly");
    const result = await clientLoader();
    const badgeNames = result.badges.map((b) => b.name);

    expect(badgeNames).not.toContain("月終わりバッジ");
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

    const { clientLoader } = await import("./summary.monthly");
    const result = await clientLoader();
    const badgeNames = result.badges.map((b) => b.name);

    expect(badgeNames).toContain("バッジX");
    expect(badgeNames).toContain("バッジY");
    expect(badgeNames).toContain("バッジZ");
    expect(badgeNames).not.toContain("範囲外バッジ");
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

    const { clientLoader } = await import("./summary.monthly");
    const result = await clientLoader();

    expect(result.badges).toHaveLength(0);
  });
});
