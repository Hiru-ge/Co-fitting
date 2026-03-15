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
    id: 1, user_id: 1, place_id: "ChIJ_m1", place_name: "上野公園", vicinity: "台東区",
    category: "park", lat: 35.714, lng: 139.774, rating: null, memo: null,
    xp_earned: 50, is_breakout: false, visited_at: "2024-02-03T12:00:00Z", created_at: "2024-02-03T12:00:00Z",
  },
  {
    id: 2, user_id: 1, place_id: "ChIJ_m2", place_name: "浅草寺", vicinity: "台東区",
    category: "temple", lat: 35.714, lng: 139.796, rating: null, memo: null,
    xp_earned: 80, is_breakout: true, visited_at: "2024-02-15T12:00:00Z", created_at: "2024-02-15T12:00:00Z",
  },
];

const mockBadges = [
  { id: 2, name: "探検家", description: "5箇所を訪問", icon_url: "", earned_at: "2024-02-15T12:00:00Z" },
];

const mockStats = {
  level: 4, total_xp: 800, streak_count: 3, streak_last: null,
  total_visits: 15, breakout_visits: 5, challenge_visits: 2,
};

const mockUser = {
  id: 1, email: "test@example.com", display_name: "テストユーザー",
  search_radius: 1000, avatar_url: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
};

describe("SummaryMonthly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getToken).mockReturnValue("mock-token");
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(listVisits).mockResolvedValue({ visits: mockVisits, total: 2 });
    vi.mocked(getUserStats).mockResolvedValue(mockStats);
    vi.mocked(getUserBadges).mockResolvedValue(mockBadges);
  });

  test("訪問件数・獲得XPが表示される", async () => {
    const { default: SummaryMonthly } = await import("./summary.monthly");
    render(
      <MemoryRouter>
        <SummaryMonthly
          loaderData={{ user: mockUser, token: "mock-token" }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
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
          matches={[]}
        />
      </MemoryRouter>
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
          matches={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("探検家")).toBeInTheDocument();
  });

  test("未認証時は /login にリダイレクトされる", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    const { clientLoader } = await import("./summary.monthly");

    await expect(clientLoader({ params: {}, request: new Request("http://localhost/summary/monthly"), context: {} } as never)).rejects.toThrow();
  });
});
