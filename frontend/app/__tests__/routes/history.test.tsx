import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import History, { clientLoader } from "~/routes/history";
import { getToken, getUser } from "~/lib/auth";
import { listVisits } from "~/api/visits";
import { toUserMessage } from "~/utils/error";
import { useToast } from "~/components/toast";
import { getCategoryInfoByKey } from "~/utils/category-map";
import { formatShortDate, groupByMonth } from "~/utils/helpers";
import type { Visit } from "~/types/visit";
import type { User } from "~/types/auth";

// モック設定
vi.mock("~/lib/auth");
vi.mock("~/api/visits");
vi.mock("~/utils/error");
vi.mock("~/components/toast");
vi.mock("~/utils/category-map");
vi.mock("~/utils/helpers");
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(),
    useNavigate: () => vi.fn(),
  };
});

// モックされた関数の型安全性のため
const mockGetToken = vi.mocked(getToken);
const mockGetUser = vi.mocked(getUser);
const mockListVisits = vi.mocked(listVisits);
const mockToUserMessage = vi.mocked(toUserMessage);
const mockUseToast = vi.mocked(useToast);
const mockGetCategoryInfoByKey = vi.mocked(getCategoryInfoByKey);
const mockFormatShortDate = vi.mocked(formatShortDate);
const mockGroupByMonth = vi.mocked(groupByMonth);

// サンプルデータ
const mockUser: User = {
  id: 1,
  email: "test@example.com",
  display_name: "Test User",
  avatar_url: null,
  created_at: "2026-02-15T10:00:00Z",
  updated_at: "2026-02-15T10:00:00Z",
};
const mockToken = "mock-token";

const mockVisits: Visit[] = [
  {
    id: 1,
    user_id: 1,
    place_id: "place1",
    place_name: "カフェA",
    vicinity: "東京都渋谷区",
    category: "カフェ",
    lat: 35.6762,
    lng: 139.6503,
    rating: null,
    memo: null,
    is_comfort_zone: false,
    visited_at: "2026-02-15T10:00:00Z",
    created_at: "2026-02-15T10:00:00Z",
  },
  {
    id: 2,
    user_id: 1,
    place_id: "place2",
    place_name: "公園B",
    vicinity: "東京都港区",
    category: "公園",
    lat: 35.6584,
    lng: 139.7454,
    rating: null,
    memo: null,
    is_comfort_zone: false,
    visited_at: "2026-02-14T14:30:00Z",
    created_at: "2026-02-14T14:30:00Z",
  },
  {
    id: 3,
    user_id: 1,
    place_id: "place3",
    place_name: "美術館C",
    vicinity: "東京都中央区",
    category: "美術館・博物館",
    lat: 35.6694,
    lng: 139.7583,
    rating: null,
    memo: null,
    is_comfort_zone: false,
    visited_at: "2026-01-20T16:00:00Z",
    created_at: "2026-01-20T16:00:00Z",
  },
];

describe("History", () => {
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // デフォルトのモック設定
    mockUseToast.mockReturnValue({ showToast: mockShowToast });
    mockGetCategoryInfoByKey.mockImplementation((key) => ({
      label: key === "カフェ" ? "カフェ" : key === "公園" ? "公園" : "美術館・博物館",
      icon: key === "カフェ" ? "coffee" : key === "公園" ? "park" : "museum",
      gradient: key === "カフェ" ? "from-amber-600 to-orange-800" : key === "公園" ? "from-green-500 to-green-700" : "from-purple-500 to-purple-700",
    }));
    mockFormatShortDate.mockImplementation((date) => "2月15日");
    mockGroupByMonth.mockImplementation((visits, dateFn) => 
      new Map([
        ["2026年2月", (visits as Visit[]).filter(v => new Date(v.visited_at).getMonth() === 1)],
        ["2026年1月", (visits as Visit[]).filter(v => new Date(v.visited_at).getMonth() === 0)],
      ])
    );

    // fetch のモック（写真取得用）
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ photo_url: "https://example.com/photo.jpg" }),
    });
  });

  describe("clientLoader", () => {
    it("should redirect to login when no token", async () => {
      mockGetToken.mockReturnValue(null);
      const mockRedirect = vi.fn();
      vi.doMock("react-router", () => ({ redirect: mockRedirect }));
      
      await expect(clientLoader({} as any)).rejects.toThrow();
    });

    it("should return user and token when authenticated", async () => {
      mockGetToken.mockReturnValue(mockToken);
      mockGetUser.mockResolvedValue(mockUser);
      
      const result = await clientLoader({} as any);
      expect(result).toEqual({ user: mockUser, token: mockToken });
    });
  });

  describe("Component rendering", () => {
    const renderHistory = (visits = mockVisits, total = 3) => {
      mockListVisits.mockResolvedValue({ visits, total });
      
      return render(
        <MemoryRouter>
          <History 
            loaderData={{ user: mockUser, token: mockToken }}
            params={{}} 
            matches={[] as any}
          />
        </MemoryRouter>
      );
    };

    it("should display loading skeleton initially", async () => {
      mockListVisits.mockImplementation(() => new Promise(() => {})); // 永続的なpending状態
      
      renderHistory();
      
      // スケルトンローダーが表示されることを確認
      await waitFor(() => {
        expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
      });
      
      const genericElements = screen.getAllByRole("generic");
      expect(genericElements.length).toBeGreaterThan(0);
    });

    it("should display empty state when no visits", async () => {
      renderHistory([], 0);
      
      await waitFor(() => {
        expect(screen.getByText(/まだ訪問記録がありません/)).toBeInTheDocument();
        expect(screen.getByText(/新しい場所を発見しに行きましょう！/)).toBeInTheDocument();
      });
    });

    it("should display visit history grouped by month", async () => {
      renderHistory();
      
      await waitFor(() => {
        // 月別グループ化を確認
        expect(mockGroupByMonth).toHaveBeenCalled();
        
        // 訪問記録が表示されることを確認
        expect(screen.getByText("カフェA")).toBeInTheDocument();
        expect(screen.getByText("公園B")).toBeInTheDocument();
        expect(screen.getByText("美術館C")).toBeInTheDocument();
      });
    });
  });

  describe("Category filtering", () => {
    const renderWithFilter = async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      // 初期ロードを待つ
      await waitFor(() => {
        expect(screen.getByText("カフェA")).toBeInTheDocument();
      });
    };

    it("should display all categories in filter buttons", async () => {
      await renderWithFilter();
      
      // 「すべて」ボタンが表示される
      expect(screen.getByText("すべて")).toBeInTheDocument();
      
      // 各カテゴリーボタンが表示される
      expect(screen.getByText("カフェ")).toBeInTheDocument();
      expect(screen.getByText("公園")).toBeInTheDocument();
      expect(screen.getByText("美術館・博物館")).toBeInTheDocument();
    });

    it("should filter visits by category when filter button clicked", async () => {
      await renderWithFilter();
      
      // カフェフィルターをクリック
      const cafeFilterButton = screen.getByRole("button", { name: /カフェ/ });
      fireEvent.click(cafeFilterButton);
      
      await waitFor(() => {
        // カフェが選択状態になっていることを確認
        expect(cafeFilterButton).toHaveClass("bg-primary-purple text-white");
      });
    });

    it("should show all visits when 'all' filter is selected", async () => {
      await renderWithFilter();
      
      // カフェフィルターを選択
      const cafeFilter = screen.getByRole("button", { name: /カフェ/ });
      fireEvent.click(cafeFilter);
      
      // すべてフィルターを選択
      const allFilter = screen.getByRole("button", { name: "すべて" });
      fireEvent.click(allFilter);
      
      await waitFor(() => {
        expect(allFilter).toHaveClass("bg-primary-purple text-white");
        // 全ての訪問記録が表示される
        expect(screen.getByText("カフェA")).toBeInTheDocument();
        expect(screen.getByText("公園B")).toBeInTheDocument();
        expect(screen.getByText("美術館C")).toBeInTheDocument();
      });
    });
  });

  describe("Pagination", () => {
    it("should display 'Load more' button when there are more visits", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits.slice(0, 2), total: 5 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "もっと見る" })).toBeInTheDocument();
      });
    });

    it("should hide 'Load more' button when all visits are loaded", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "もっと見る" })).not.toBeInTheDocument();
      });
    });

    it("should load more visits when 'Load more' button clicked", async () => {
      // 初回は2件、2回目の呼び出しでは残り1件を返す
      mockListVisits
        .mockResolvedValueOnce({ visits: mockVisits.slice(0, 2), total: 3 })
        .mockResolvedValueOnce({ visits: [mockVisits[2]], total: 3 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      // 初回ロードを待つ
      await waitFor(() => {
        expect(screen.getByText("カフェA")).toBeInTheDocument();
      });
      
      // 「もっと見る」ボタンをクリック
      const loadMoreButton = screen.getByRole("button", { name: "もっと見る" });
      fireEvent.click(loadMoreButton);
      
      // 2回目のAPI呼び出しが正しいoffsetで実行されることを確認
      await waitFor(() => {
        expect(mockListVisits).toHaveBeenCalledTimes(2);
        expect(mockListVisits).toHaveBeenLastCalledWith(mockToken, 20, 2); // offset = 2
      });
    });

    it("should show loading state when loading more visits", async () => {
      mockListVisits
        .mockResolvedValueOnce({ visits: mockVisits.slice(0, 2), total: 3 })
        .mockImplementationOnce(() => new Promise(() => {})); // 永続的なpending状態
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "もっと見る" })).toBeInTheDocument();
      });
      
      const loadMoreButton = screen.getByRole("button", { name: "もっと見る" });
      fireEvent.click(loadMoreButton);
      
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "読み込み中..." })).toBeInTheDocument();
        expect(loadMoreButton).toBeDisabled();
      });
    });
  });

  describe("Photo loading", () => {
    it("should load photos for visits with place_id", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        // 各place_idに対してfetchが呼ばれることを確認
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:8000/api/places/place1/photo",
          { headers: { Authorization: `Bearer ${mockToken}` } }
        );
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:8000/api/places/place2/photo",
          { headers: { Authorization: `Bearer ${mockToken}` } }
        );
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:8000/api/places/place3/photo",
          { headers: { Authorization: `Bearer ${mockToken}` } }
        );
      });
    });

    it("should display default camera icon when photo fails to load", async () => {
      // fetch を失敗させる
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      mockListVisits.mockResolvedValue({ visits: [mockVisits[0]], total: 1 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        // カメラアイコンが表示されることを確認
        expect(screen.getByText("photo_camera")).toBeInTheDocument();
      });
    });

    it("should display photo when successfully loaded", async () => {
      const photoUrl = "https://example.com/photo.jpg";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ photo_url: photoUrl }),
      });
      mockListVisits.mockResolvedValue({ visits: [mockVisits[0]], total: 1 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        // 背景画像としてphoto_urlが設定されることを確認
        const imageElement = document.querySelector('[style*="background-image"]');
        expect(imageElement).toBeInTheDocument();
      });
    });
  });

  describe("Error handling", () => {
    it("should show error toast when visit loading fails", async () => {
      const errorMessage = "Network error";
      mockListVisits.mockRejectedValue(new Error(errorMessage));
      mockToUserMessage.mockReturnValue("ネットワークエラーが発生しました");
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(mockToUserMessage).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith("ネットワークエラーが発生しました");
      });
    });

    it("should continue working when photo loading fails for some visits", async () => {
      // 1つ目は成功、2つ目は失敗
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ photo_url: "https://example.com/photo1.jpg" }),
        })
        .mockRejectedValueOnce(new Error("Photo load error"));
      
      mockListVisits.mockResolvedValue({ visits: mockVisits.slice(0, 2), total: 2 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        // エラーに関係なく、訪問記録は表示される
        expect(screen.getByText("カフェA")).toBeInTheDocument();
        expect(screen.getByText("公園B")).toBeInTheDocument();
      });
    });
  });

  describe("Date formatting and grouping", () => {
    it("should call formatShortDate for each visit", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        // 各訪問記録の日付フォーマットが呼ばれることを確認
        expect(mockFormatShortDate).toHaveBeenCalledTimes(3);
        expect(mockFormatShortDate).toHaveBeenCalledWith(mockVisits[0].visited_at);
        expect(mockFormatShortDate).toHaveBeenCalledWith(mockVisits[1].visited_at);
        expect(mockFormatShortDate).toHaveBeenCalledWith(mockVisits[2].visited_at);
      });
    });

    it("should call groupByMonth to organize visits by month", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });
      
      render(
        <MemoryRouter>
          <History {...({ loaderData: { user: mockUser, token: mockToken } } as any)} />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        // groupByMonthが適切に呼ばれることを確認
        expect(mockGroupByMonth).toHaveBeenCalledWith(
          expect.any(Array), // filteredVisits
          expect.any(Function) // date extractor function
        );
      });
    });
  });
});