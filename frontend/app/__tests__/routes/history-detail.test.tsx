import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import HistoryDetail, { clientLoader } from "~/routes/history-detail";
import { getToken, getUser } from "~/lib/auth";
import { getVisit, updateVisit } from "~/api/visits";
import { toUserMessage } from "~/utils/error";
import { useToast } from "~/components/toast";
import type { Visit } from "~/types/visit";
import type { User } from "~/types/auth";

vi.mock("~/lib/auth");
vi.mock("~/api/visits");
vi.mock("~/utils/error");
vi.mock("~/components/toast");
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(),
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: "1" }),
  };
});

const mockGetToken = vi.mocked(getToken);
const mockGetUser = vi.mocked(getUser);
const mockGetVisit = vi.mocked(getVisit);
const mockUpdateVisit = vi.mocked(updateVisit);
const mockToUserMessage = vi.mocked(toUserMessage);
const mockUseToast = vi.mocked(useToast);

const mockUser: User = {
  id: 1,
  email: "test@example.com",
  display_name: "Test User",
  avatar_url: null,
  created_at: "2026-02-15T10:00:00Z",
  updated_at: "2026-02-15T10:00:00Z",
};
const mockToken = "mock-token";

const mockVisit: Visit = {
  id: 1,
  user_id: 1,
  place_id: "place1",
  place_name: "Blue Bottle Coffee",
  vicinity: "東京都渋谷区神南1-1-1",
  category: "cafe",
  lat: 35.6762,
  lng: 139.6503,
  rating: null,
  memo: null,
  xp_earned: 50,
  is_comfort_zone: false,
  visited_at: "2026-02-15T10:00:00Z",
  created_at: "2026-02-15T10:00:00Z",
};

describe("HistoryDetail", () => {
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue({ showToast: mockShowToast });
    mockToUserMessage.mockImplementation((err) => String(err));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ photo_url: "https://example.com/photo.jpg" }),
    });
  });

  describe("clientLoader", () => {
    it("トークンがない場合は /login にリダイレクトする", async () => {
      mockGetToken.mockReturnValue(null);
      await expect(
        clientLoader({ params: { id: "1" } } as any)
      ).rejects.toThrow();
    });

    it("認証済みの場合はユーザー・トークン・IDを返す", async () => {
      mockGetToken.mockReturnValue(mockToken);
      mockGetUser.mockResolvedValue(mockUser);
      const result = await clientLoader({ params: { id: "1" } } as any);
      expect(result).toEqual({ user: mockUser, token: mockToken, visitId: 1 });
    });

    it("IDが数値でない場合は /history にリダイレクトする", async () => {
      mockGetToken.mockReturnValue(mockToken);
      mockGetUser.mockResolvedValue(mockUser);
      await expect(
        clientLoader({ params: { id: "abc" } } as any)
      ).rejects.toThrow();
    });
  });

  describe("訪問場所情報の表示", () => {
    const renderDetail = () => {
      mockGetVisit.mockResolvedValue(mockVisit);
      return render(
        <MemoryRouter>
          <HistoryDetail
            loaderData={{ user: mockUser, token: mockToken, visitId: 1 }}
            params={{ id: "1" }}
            matches={[] as any}
          />
        </MemoryRouter>
      );
    };

    it("場所名を表示する", async () => {
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText("Blue Bottle Coffee")).toBeInTheDocument();
      });
    });

    it("住所（vicinity）を表示する", async () => {
      renderDetail();
      await waitFor(() => {
        expect(
          screen.getByText("東京都渋谷区神南1-1-1")
        ).toBeInTheDocument();
      });
    });

    it("訪問日を表示する", async () => {
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText(/2026年2月15日/)).toBeInTheDocument();
      });
    });

    it("獲得XPを表示する", async () => {
      renderDetail();
      await waitFor(() => {
        expect(screen.getByText(/50 XP/)).toBeInTheDocument();
      });
    });

    it("ローディング中はスケルトンを表示する", async () => {
      mockGetVisit.mockImplementation(() => new Promise(() => {}));
      render(
        <MemoryRouter>
          <HistoryDetail
            loaderData={{ user: mockUser, token: mockToken, visitId: 1 }}
            params={{ id: "1" }}
            matches={[] as any}
          />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
      });
    });
  });

  describe("感想メモ・評価の入力と表示", () => {
    it("感想メモがある場合はテキストエリアに表示する", async () => {
      mockGetVisit.mockResolvedValue({ ...mockVisit, memo: "とても良かった" });
      render(
        <MemoryRouter>
          <HistoryDetail
            loaderData={{ user: mockUser, token: mockToken, visitId: 1 }}
            params={{ id: "1" }}
            matches={[] as any}
          />
        </MemoryRouter>
      );
      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveValue("とても良かった");
      });
    });

    it("感想メモがない場合はテキストエリアが空", async () => {
      mockGetVisit.mockResolvedValue({ ...mockVisit, memo: null });
      render(
        <MemoryRouter>
          <HistoryDetail
            loaderData={{ user: mockUser, token: mockToken, visitId: 1 }}
            params={{ id: "1" }}
            matches={[] as any}
          />
        </MemoryRouter>
      );
      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveValue("");
      });
    });

    it("5段階の評価ボタンが表示される", async () => {
      mockGetVisit.mockResolvedValue(mockVisit);
      render(
        <MemoryRouter>
          <HistoryDetail
            loaderData={{ user: mockUser, token: mockToken, visitId: 1 }}
            params={{ id: "1" }}
            matches={[] as any}
          />
        </MemoryRouter>
      );
      await waitFor(() => {
        const stars = screen.getAllByRole("button", { name: /★/ });
        expect(stars).toHaveLength(5);
      });
    });

    it("既存の評価が反映される", async () => {
      mockGetVisit.mockResolvedValue({ ...mockVisit, rating: 3 });
      render(
        <MemoryRouter>
          <HistoryDetail
            loaderData={{ user: mockUser, token: mockToken, visitId: 1 }}
            params={{ id: "1" }}
            matches={[] as any}
          />
        </MemoryRouter>
      );
      await waitFor(() => {
        const stars = screen.getAllByRole("button", { name: /★/ });
        expect(stars[0]).toHaveAttribute("aria-pressed", "true");
        expect(stars[1]).toHaveAttribute("aria-pressed", "true");
        expect(stars[2]).toHaveAttribute("aria-pressed", "true");
        expect(stars[3]).toHaveAttribute("aria-pressed", "false");
        expect(stars[4]).toHaveAttribute("aria-pressed", "false");
      });
    });
  });

  describe("編集・保存機能", () => {
    const renderAndLoad = async () => {
      mockGetVisit.mockResolvedValue(mockVisit);
      const result = render(
        <MemoryRouter>
          <HistoryDetail
            loaderData={{ user: mockUser, token: mockToken, visitId: 1 }}
            params={{ id: "1" }}
            matches={[] as any}
          />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText("Blue Bottle Coffee")).toBeInTheDocument();
      });
      return result;
    };

    it("感想メモを入力してから保存できる", async () => {
      mockUpdateVisit.mockResolvedValue({
        ...mockVisit,
        memo: "最高のコーヒー",
      });
      await renderAndLoad();

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "最高のコーヒー" } });

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateVisit).toHaveBeenCalledWith(mockToken, 1, {
          memo: "最高のコーヒー",
          rating: null,
        });
      });
    });

    it("評価を変更してから保存できる", async () => {
      mockUpdateVisit.mockResolvedValue({ ...mockVisit, rating: 4 });
      await renderAndLoad();

      const stars = screen.getAllByRole("button", { name: /★/ });
      fireEvent.click(stars[3]); // 4つ目の星をクリック

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateVisit).toHaveBeenCalledWith(mockToken, 1, {
          memo: null,
          rating: 4,
        });
      });
    });

    it("保存成功時にトーストを表示する", async () => {
      mockUpdateVisit.mockResolvedValue(mockVisit);
      await renderAndLoad();

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          "保存しました",
          "success"
        );
      });
    });

    it("保存失敗時にエラートーストを表示する", async () => {
      mockUpdateVisit.mockRejectedValue(new Error("Network error"));
      mockToUserMessage.mockReturnValue("保存に失敗しました");
      await renderAndLoad();

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith("保存に失敗しました");
      });
    });
  });

  describe("履歴画面への戻る処理", () => {
    it("戻るボタンが表示される", async () => {
      mockGetVisit.mockResolvedValue(mockVisit);
      render(
        <MemoryRouter>
          <HistoryDetail
            loaderData={{ user: mockUser, token: mockToken, visitId: 1 }}
            params={{ id: "1" }}
            matches={[] as any}
          />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /戻る/ })
        ).toBeInTheDocument();
      });
    });
  });

  describe("API取得失敗のハンドリング", () => {
    it("訪問詳細の取得失敗時にエラートーストを表示する", async () => {
      mockGetVisit.mockRejectedValue(new Error("Not found"));
      mockToUserMessage.mockReturnValue("訪問記録が見つかりませんでした");
      render(
        <MemoryRouter>
          <HistoryDetail
            loaderData={{ user: mockUser, token: mockToken, visitId: 1 }}
            params={{ id: "1" }}
            matches={[] as any}
          />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          "訪問記録が見つかりませんでした"
        );
      });
    });
  });
});
