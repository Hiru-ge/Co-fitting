import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, test, expect, vi, beforeEach } from "vitest";

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

const mockBadges = [
  { id: 1, name: "初冒険者", description: "初めての訪問", icon_url: "", earned_at: "2024-02-05T12:00:00Z" },
];

const mockStats = {
  level: 3, total_xp: 500, streak_count: 2, streak_last: null,
  total_visits: 10, breakout_visits: 3, challenge_visits: 1,
};

const mockUser = {
  id: 1, email: "test@example.com", display_name: "テストユーザー",
  search_radius: 1000, avatar_url: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
};

describe("SummaryWeekly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getToken).mockReturnValue("mock-token");
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(listVisits).mockResolvedValue({ visits: mockVisits, total: 2 });
    vi.mocked(getUserStats).mockResolvedValue(mockStats);
    vi.mocked(getUserBadges).mockResolvedValue(mockBadges);
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
});
