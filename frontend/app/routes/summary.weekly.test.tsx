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
    place_id: "ChIJ_1",
    place_name: "代々木公園",
    vicinity: "渋谷区",
    category: "park",
    lat: 35.677,
    lng: 139.65,
    rating: null,
    memo: null,
    xp_earned: 50,
    is_breakout: false,
    visited_at: "2024-02-05T12:00:00Z",
    created_at: "2024-02-05T12:00:00Z",
  },
  {
    id: 2,
    user_id: 1,
    place_id: "ChIJ_2",
    place_name: "原宿カフェ",
    vicinity: "渋谷区",
    category: "cafe",
    lat: 35.678,
    lng: 139.651,
    rating: null,
    memo: null,
    xp_earned: 100,
    is_breakout: true,
    visited_at: "2024-02-06T12:00:00Z",
    created_at: "2024-02-06T12:00:00Z",
  },
];

// 固定時刻 2026-03-16（月曜）における先週の範囲内: 2026-03-10T01:00:00Z
const mockBadges = [
  {
    id: 1,
    name: "初冒険者",
    description: "初めての訪問",
    icon_url: "",
    earned_at: "2026-03-10T01:00:00.000Z",
  },
];

const mockUser = {
  id: 1,
  email: "test@example.com",
  display_name: "テストユーザー",
  search_radius: 1000,
  avatar_url: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// 2026-03-16 月曜日 12:00 JST に固定 (UTC: 03:00:00)
const FIXED_NOW_WEEKLY = new Date("2026-03-16T03:00:00Z").getTime();

describe("SummaryWeekly", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW_WEEKLY);
    vi.clearAllMocks();
    vi.mocked(getToken).mockReturnValue("mock-token");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 2026-03-16(月)固定 → 先週は 3/9（月）〜 3/15（日）
  const weekLabel = "3/9（月）〜 3/15（日）";

  test("訪問件数・獲得XPが表示される", async () => {
    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{
            user: mockUser,
            visits: mockVisits,
            badges: mockBadges,
            label: weekLabel,
          }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("150")).toBeInTheDocument(); // xp_earned合計
    expect(await screen.findByText("か所を冒険!")).toBeInTheDocument();
  });

  test("場所名一覧が表示される", async () => {
    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{
            user: mockUser,
            visits: mockVisits,
            badges: [],
            label: weekLabel,
          }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("代々木公園")).toBeInTheDocument();
    expect(await screen.findByText("原宿カフェ")).toBeInTheDocument();
  });

  test("バッジ名一覧が表示される", async () => {
    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{
            user: mockUser,
            visits: [],
            badges: mockBadges,
            label: weekLabel,
          }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("初冒険者")).toBeInTheDocument();
  });

  test("未認証時は /login にリダイレクトされる", async () => {
    vi.mocked(authRequiredLoader).mockRejectedValueOnce(
      new Error("unauthorized"),
    );
    const { clientLoader } = await import("./summary.weekly");

    await expect(clientLoader()).rejects.toThrow();
  });

  test("APIが失敗した場合に clientLoader がエラーをスローする", async () => {
    vi.mocked(authRequiredLoader).mockResolvedValue({
      user: mockUser,
      token: "mock-token",
    });
    vi.mocked(listVisits).mockRejectedValue(new Error("Network error"));
    const { clientLoader } = await import("./summary.weekly");

    await expect(clientLoader()).rejects.toThrow("Network error");
  });

  test("periodラベルが画面に表示される", async () => {
    const { default: SummaryWeekly } = await import("./summary.weekly");
    render(
      <MemoryRouter>
        <SummaryWeekly
          loaderData={{
            user: mockUser,
            visits: [],
            badges: [],
            label: weekLabel,
          }}
          params={{}}
          matches={[] as any}
        />
      </MemoryRouter>,
    );

    // 2026-03-16 (月) 固定 → 先週は 3/9（月）〜 3/15（日）
    expect(
      await screen.findByText("3/9（月）〜 3/15（日）"),
    ).toBeInTheDocument();
  });
});

// ---- バッジフィルタリングのロジック単体テスト ----
// getWeekRange() は new Date() に依存するため、vi.useFakeTimers() で現在時刻を固定する。
// 固定日時: 2026-03-16 月曜日 12:00 JST (= 2026-03-16T03:00:00Z)
// → 先週の範囲: 2026-03-09 00:00 JST (= 2026-03-08T15:00:00Z) 〜 2026-03-16 00:00 JST (= 2026-03-15T15:00:00Z)

describe("SummaryWeekly バッジフィルタリング", () => {
  // 2026-03-16 月曜日 12:00 JST に固定 (UTC: 03:00:00)
  const FIXED_NOW = new Date("2026-03-16T03:00:00Z").getTime();

  // 先週の範囲（JST基準）
  // from  = 2026-03-09 00:00 JST = 2026-03-08T15:00:00.000Z
  // until = 2026-03-16 00:00 JST = 2026-03-15T15:00:00.000Z
  const WEEK_FROM = "2026-03-08T15:00:00.000Z";
  const WEEK_UNTIL = "2026-03-15T15:00:00.000Z";

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

  test("earned_at が週の範囲内のバッジのみ表示される", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "週内バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-03-10T01:00:00.000Z",
      },
      {
        id: 2,
        name: "前週バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-03-07T01:00:00.000Z",
      },
      {
        id: 3,
        name: "翌週バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-03-17T01:00:00.000Z",
      },
    ]);

    const { clientLoader } = await import("./summary.weekly");
    const result = await clientLoader();
    const badgeNames = result.badges.map((b) => b.name);

    expect(badgeNames).toContain("週内バッジ");
    expect(badgeNames).not.toContain("前週バッジ");
    expect(badgeNames).not.toContain("翌週バッジ");
  });

  test("earned_at が from と一致する（境界値）バッジは表示される", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "週始まりバッジ",
        description: "",
        icon_url: "",
        earned_at: WEEK_FROM,
      },
    ]);

    const { clientLoader } = await import("./summary.weekly");
    const result = await clientLoader();
    const badgeNames = result.badges.map((b) => b.name);

    expect(badgeNames).toContain("週始まりバッジ");
  });

  test("earned_at が until と一致する（境界値）バッジは表示されない", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "週終わりバッジ",
        description: "",
        icon_url: "",
        earned_at: WEEK_UNTIL,
      },
    ]);

    const { clientLoader } = await import("./summary.weekly");
    const result = await clientLoader();
    const badgeNames = result.badges.map((b) => b.name);

    expect(badgeNames).not.toContain("週終わりバッジ");
  });

  test("期間内のバッジが複数ある場合は全て表示される", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "バッジA",
        description: "",
        icon_url: "",
        earned_at: "2026-03-09T05:00:00.000Z",
      },
      {
        id: 2,
        name: "バッジB",
        description: "",
        icon_url: "",
        earned_at: "2026-03-11T08:00:00.000Z",
      },
      {
        id: 3,
        name: "バッジC",
        description: "",
        icon_url: "",
        earned_at: "2026-03-13T12:00:00.000Z",
      },
      {
        id: 4,
        name: "範囲外バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-03-08T00:00:00.000Z",
      },
    ]);

    const { clientLoader } = await import("./summary.weekly");
    const result = await clientLoader();
    const badgeNames = result.badges.map((b) => b.name);

    expect(badgeNames).toContain("バッジA");
    expect(badgeNames).toContain("バッジB");
    expect(badgeNames).toContain("バッジC");
    expect(badgeNames).not.toContain("範囲外バッジ");
  });

  test("期間内のバッジが1件もない場合はバッジセクションが空になる", async () => {
    vi.mocked(getUserBadges).mockResolvedValue([
      {
        id: 1,
        name: "先週バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-03-01T00:00:00.000Z",
      },
      {
        id: 2,
        name: "来週バッジ",
        description: "",
        icon_url: "",
        earned_at: "2026-03-24T00:00:00.000Z",
      },
    ]);

    const { clientLoader } = await import("./summary.weekly");
    const result = await clientLoader();

    expect(result.badges).toHaveLength(0);
  });
});
