import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import History, { clientLoader } from "~/routes/history";
import { authRequiredLoader } from "~/lib/auth";
import { listVisits, getMapVisits } from "~/api/visits";
import { getPlacePhoto } from "~/api/places";
import { toUserMessage } from "~/utils/error";
import { useToast } from "~/components/Toast";
import { getCategoryInfoByKey } from "~/lib/category-map";
import { formatShortDate, groupByMonth } from "~/utils/helpers";
import type { Visit } from "~/types/visit";
import type { User } from "~/types/auth";

// モック設定
vi.mock("~/lib/auth", () => ({
  authRequiredLoader: vi.fn(),
}));
vi.mock("~/api/visits");
vi.mock("~/api/places");
vi.mock("~/utils/error");
vi.mock("~/components/Toast");
vi.mock("~/lib/category-map");
vi.mock("~/utils/helpers");
// VisitMapコンポーネントをモック（Google Maps APIを使うため）
vi.mock("~/components/VisitMap", () => ({
  default: ({ visits }: { visits: unknown[] }) => (
    <div data-testid="visit-map">マップ表示 ({visits.length}件)</div>
  ),
}));
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(),
    useNavigate: () => vi.fn(),
  };
});

// モックされた関数の型安全性のため
const mockGetPlacePhoto = vi.mocked(getPlacePhoto);
const mockGetMapVisits = vi.mocked(getMapVisits);
const mockProtectedLoader = vi.mocked(authRequiredLoader);
const mockListVisits = vi.mocked(listVisits);
const mockToUserMessage = vi.mocked(toUserMessage);
const mockUseToast = vi.mocked(useToast);
const mockGetCategoryInfoByKey = vi.mocked(getCategoryInfoByKey);
const mockFormatShortDate = vi.mocked(formatShortDate);
const mockGroupByMonth = vi.mocked(groupByMonth);

// サンプルデータ
const mockVisitWithPhoto: Visit = {
  id: 10,
  user_id: 1,
  place_id: "place_with_photo",
  place_name: "写真あり店舗",
  vicinity: "東京都新宿区",
  category: "カフェ",
  lat: 35.6895,
  lng: 139.6917,
  rating: null,
  memo: null,
  photo_reference: "places/ChIJxxx/photos/AUyyy",
  xp_earned: 50,
  is_breakout: false,
  visited_at: "2026-02-15T10:00:00Z",
  created_at: "2026-02-15T10:00:00Z",
};

const mockUser: User = {
  id: 1,
  email: "test@example.com",
  display_name: "Test User",
  search_radius: 500,
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
    xp_earned: 50,
    is_breakout: false,
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
    xp_earned: 50,
    is_breakout: false,
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
    xp_earned: 50,
    is_breakout: false,
    visited_at: "2026-01-20T16:00:00Z",
    created_at: "2026-01-20T16:00:00Z",
  },
];

describe("History", () => {
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockProtectedLoader.mockResolvedValue({ user: mockUser, token: mockToken });
    mockUseToast.mockReturnValue({ showToast: mockShowToast });
    mockGetCategoryInfoByKey.mockImplementation((key) => ({
      label:
        key === "カフェ"
          ? "カフェ"
          : key === "公園"
            ? "公園"
            : "美術館・博物館",
      icon:
        key === "カフェ" ? "local_cafe" : key === "公園" ? "park" : "museum",
      gradient:
        key === "カフェ"
          ? "from-amber-600 to-orange-800"
          : key === "公園"
            ? "from-green-500 to-green-700"
            : "from-purple-500 to-purple-700",
    }));
    mockFormatShortDate.mockImplementation(() => "2月15日");
    mockGroupByMonth.mockImplementation(
      (visits) =>
        new Map([
          [
            "2026年2月",
            (visits as Visit[]).filter(
              (v) => new Date(v.visited_at).getMonth() === 1,
            ),
          ],
          [
            "2026年1月",
            (visits as Visit[]).filter(
              (v) => new Date(v.visited_at).getMonth() === 0,
            ),
          ],
        ]),
    );

    // 写真取得モック
    mockGetPlacePhoto.mockResolvedValue("https://example.com/photo.jpg");
  });

  describe("clientLoader", () => {
    it("should redirect to login when no token", async () => {
      mockProtectedLoader.mockRejectedValueOnce(new Error("unauthorized"));

      await expect(clientLoader()).rejects.toThrow();
    });

    it("should return user and token when authenticated", async () => {
      mockProtectedLoader.mockResolvedValueOnce({
        user: mockUser,
        token: mockToken,
      });

      const result = await clientLoader();
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
        </MemoryRouter>,
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
        expect(
          screen.getByText(/まだ訪問記録がありません/),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/新しい場所を発見しに行きましょう！/),
        ).toBeInTheDocument();
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
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
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
      mockListVisits.mockResolvedValue({
        visits: mockVisits.slice(0, 2),
        total: 5,
      });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "もっと見る" }),
        ).toBeInTheDocument();
      });
    });

    it("should hide 'Load more' button when all visits are loaded", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "もっと見る" }),
        ).not.toBeInTheDocument();
      });
    });

    it("should load more visits when 'Load more' button clicked", async () => {
      // 初回は2件、2回目の呼び出しでは残り1件を返す
      mockListVisits
        .mockResolvedValueOnce({ visits: mockVisits.slice(0, 2), total: 3 })
        .mockResolvedValueOnce({ visits: [mockVisits[2]], total: 3 });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
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
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "もっと見る" }),
        ).toBeInTheDocument();
      });

      const loadMoreButton = screen.getByRole("button", { name: "もっと見る" });
      fireEvent.click(loadMoreButton);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "読み込み中..." }),
        ).toBeInTheDocument();
        expect(loadMoreButton).toBeDisabled();
      });
    });
  });

  describe("Photo loading", () => {
    it("photo_referenceがない訪問でもgetPlacePhotoを呼ぶ", async () => {
      // 現在の実装ではphoto_referenceの有無を事前判定せず、取得を試みる
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("カフェA")).toBeInTheDocument();
      });

      expect(mockGetPlacePhoto).toHaveBeenCalled();
    });

    it("photo_referenceがある訪問はgetPlacePhotoを呼ぶ", async () => {
      mockListVisits.mockResolvedValue({
        visits: [mockVisitWithPhoto],
        total: 1,
      });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(mockGetPlacePhoto).toHaveBeenCalledWith(
          mockToken,
          "place_with_photo",
          "places/ChIJxxx/photos/AUyyy",
        );
      });
    });

    it("photo取得に失敗した訪問はプレースホルダーアイコンを表示する", async () => {
      mockListVisits.mockResolvedValue({ visits: [mockVisits[0]], total: 1 });
      mockGetPlacePhoto.mockRejectedValueOnce(new Error("photo not found"));

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("photo_camera")).toBeInTheDocument();
      });

      expect(mockGetPlacePhoto).toHaveBeenCalled();
    });

    it("should display photo when successfully loaded", async () => {
      const photoUrl = "https://example.com/photo.jpg";
      mockGetPlacePhoto.mockResolvedValue(photoUrl);
      mockListVisits.mockResolvedValue({
        visits: [mockVisitWithPhoto],
        total: 1,
      });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const imageElement = document.querySelector(
          '[style*="background-image"]',
        );
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
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(mockToUserMessage).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith(
          "ネットワークエラーが発生しました",
        );
      });
    });

    it("should continue working when photo loading fails for some visits", async () => {
      // photo_referenceあり1件は失敗、なし1件はスキップ
      mockGetPlacePhoto.mockRejectedValueOnce(new Error("Photo load error"));

      mockListVisits.mockResolvedValue({
        visits: [mockVisitWithPhoto, mockVisits[1]],
        total: 2,
      });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // エラーに関係なく、訪問記録は表示される
        expect(screen.getByText("写真あり店舗")).toBeInTheDocument();
        expect(screen.getByText("公園B")).toBeInTheDocument();
      });
    });
  });

  describe("マップ/リストタブの切り替え", () => {
    it("リストとマップのタブボタンが表示される", async () => {
      mockListVisits.mockResolvedValue({ visits: [], total: 0 });
      mockGetMapVisits.mockResolvedValue({ visits: [], total: 0 });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /リスト/ }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /マップ/ }),
        ).toBeInTheDocument();
      });
    });

    it("初期表示はリストモード", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });
      mockGetMapVisits.mockResolvedValue({ visits: [], total: 0 });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId("visit-map")).not.toBeInTheDocument();
      });
    });

    it("マップタブクリックでVisitMapコンポーネントが表示される", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });
      mockGetMapVisits.mockResolvedValue({ visits: [], total: 0 });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /マップ/ }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /マップ/ }));

      await waitFor(() => {
        expect(screen.getByTestId("visit-map")).toBeInTheDocument();
      });
    });

    it("リストタブクリックで訪問リストに戻る", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });
      mockGetMapVisits.mockResolvedValue({ visits: [], total: 0 });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /マップ/ }),
        ).toBeInTheDocument();
      });

      // マップタブをクリック
      fireEvent.click(screen.getByRole("button", { name: /マップ/ }));
      await waitFor(() => {
        expect(screen.getByTestId("visit-map")).toBeInTheDocument();
      });

      // リストタブに戻る
      fireEvent.click(screen.getByRole("button", { name: /リスト/ }));
      await waitFor(() => {
        expect(screen.queryByTestId("visit-map")).not.toBeInTheDocument();
      });
    });
  });

  describe("Date formatting and grouping", () => {
    it("should call formatShortDate for each visit", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // 各訪問記録の日付フォーマットが呼ばれることを確認
        expect(mockFormatShortDate).toHaveBeenCalledTimes(3);
        expect(mockFormatShortDate).toHaveBeenCalledWith(
          mockVisits[0].visited_at,
        );
        expect(mockFormatShortDate).toHaveBeenCalledWith(
          mockVisits[1].visited_at,
        );
        expect(mockFormatShortDate).toHaveBeenCalledWith(
          mockVisits[2].visited_at,
        );
      });
    });

    it("should call groupByMonth to organize visits by month", async () => {
      mockListVisits.mockResolvedValue({ visits: mockVisits, total: 3 });

      render(
        <MemoryRouter>
          <History
            {...({ loaderData: { user: mockUser, token: mockToken } } as any)}
          />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // groupByMonthが適切に呼ばれることを確認
        expect(mockGroupByMonth).toHaveBeenCalledWith(
          expect.any(Array), // filteredVisits
          expect.any(Function), // date extractor function
        );
      });
    });
  });
});
