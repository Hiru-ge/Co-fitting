import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
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
  getUser: vi.fn().mockResolvedValue({
    id: 1,
    email: "test@example.com",
    display_name: "テストユーザー",
    avatar_url: null,
    created_at: "2025-06-15T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z",
  }),
  logout: vi.fn().mockResolvedValue(undefined),
  clearToken: vi.fn(),
}));

vi.mock("~/api/users", () => ({
  updateDisplayName: vi.fn().mockResolvedValue({
    id: 1,
    email: "test@example.com",
    display_name: "新しい名前",
    avatar_url: null,
    created_at: "2025-06-15T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z",
  }),
  deleteAccount: vi.fn().mockResolvedValue(undefined),
  updateSearchRadius: vi.fn().mockResolvedValue({
    id: 1,
    email: "test@example.com",
    display_name: "テストユーザー",
    search_radius: 10000,
    avatar_url: null,
    created_at: "2025-06-15T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z",
  }),
}));

vi.mock("~/api/genres", () => ({
  getGenreTags: vi.fn().mockResolvedValue([
    { id: 1, name: "カフェ", category: "グルメ", icon: "☕" },
    { id: 2, name: "レストラン", category: "グルメ", icon: "🍽️" },
    { id: 3, name: "公園", category: "アウトドア", icon: "🌳" },
    { id: 4, name: "美術館", category: "カルチャー", icon: "🎨" },
    { id: 5, name: "書店", category: "カルチャー", icon: "📚" },
  ]),
  getInterests: vi.fn().mockResolvedValue([
    { genre_tag_id: 1, name: "カフェ", category: "グルメ", icon: "☕" },
    { genre_tag_id: 3, name: "公園", category: "アウトドア", icon: "🌳" },
    { genre_tag_id: 4, name: "美術館", category: "カルチャー", icon: "🎨" },
  ]),
  updateInterests: vi.fn().mockResolvedValue({
    interests: [
      { genre_tag_id: 1, name: "カフェ", category: "グルメ", icon: "☕" },
      { genre_tag_id: 2, name: "レストラン", category: "グルメ", icon: "🍽️" },
      { genre_tag_id: 3, name: "公園", category: "アウトドア", icon: "🌳" },
    ],
    reload_count_remaining: 2,
  }),
}));

vi.mock("~/hooks/use-suggestions", () => ({
  clearSuggestionsCache: vi.fn(),
  getReloadCountRemaining: vi.fn().mockReturnValue(3),
}));

import Settings from "~/routes/settings";
import { updateDisplayName, deleteAccount, updateSearchRadius } from "~/api/users";
import { updateInterests } from "~/api/genres";
import { clearSuggestionsCache, getReloadCountRemaining } from "~/hooks/use-suggestions";

const mockUser = {
  id: 1,
  email: "test@example.com",
  display_name: "テストユーザー",
  search_radius: 5000,
  avatar_url: null,
  created_at: "2025-06-15T10:00:00Z",
  updated_at: "2025-12-01T10:00:00Z",
};

function renderSettings() {
  const loaderData = {
    user: mockUser,
    token: "test-token",
    genres: [
      { id: 1, name: "カフェ", category: "グルメ", icon: "☕" },
      { id: 2, name: "レストラン", category: "グルメ", icon: "🍽️" },
      { id: 3, name: "公園", category: "アウトドア", icon: "🌳" },
      { id: 4, name: "美術館", category: "カルチャー", icon: "🎨" },
      { id: 5, name: "書店", category: "カルチャー", icon: "📚" },
    ],
    interests: [
      { genre_tag_id: 1, name: "カフェ", category: "グルメ", icon: "☕" },
      { genre_tag_id: 3, name: "公園", category: "アウトドア", icon: "🌳" },
      { genre_tag_id: 4, name: "美術館", category: "カルチャー", icon: "🎨" },
    ],
  };
  return render(
    <Settings
      loaderData={loaderData as any}
      params={{} as any}
      matches={[] as any}
    />
  );
}

describe("設定画面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // テストごとにリロード残回数のデフォルト値を復元する
    vi.mocked(getReloadCountRemaining).mockReturnValue(3);
    // jsdom は matchMedia 未実装のためスタブを注入
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    // Permissions API スタブ
    Object.defineProperty(navigator, "permissions", {
      writable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }),
      },
    });
  });

  // === タブナビゲーション ===
  describe("タブナビゲーション", () => {
    test("設定画面のタイトルが表示される", () => {
      renderSettings();
      expect(screen.getByText("設定")).toBeInTheDocument();
    });

    test("2つのタブが表示される", () => {
      renderSettings();
      expect(screen.getByRole("tab", { name: "ユーザー" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "提案設定" })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "アカウント" })).not.toBeInTheDocument();
    });

    test("初期状態ではユーザー情報タブが選択されている", () => {
      renderSettings();
      const tab = screen.getByRole("tab", { name: "ユーザー" });
      expect(tab).toHaveAttribute("aria-selected", "true");
    });

    test("タブクリックで表示内容が切り替わる", async () => {
      const user = userEvent.setup();
      renderSettings();

      // 提案設定タブに切り替え
      await user.click(screen.getByRole("tab", { name: "提案設定" }));
      expect(screen.getByRole("tab", { name: "提案設定" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText("興味タグ")).toBeInTheDocument();
    });

    test("戻るボタンが表示される", () => {
      renderSettings();
      expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    });
  });

  // === ユーザー情報タブ ===
  describe("ユーザー情報タブ", () => {
    test("表示名変更フォームが表示される", () => {
      renderSettings();
      expect(screen.getByLabelText("表示名")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "表示名を変更" })).toBeInTheDocument();
    });

    test("現在の表示名が初期値としてセットされる", () => {
      renderSettings();
      const input = screen.getByLabelText("表示名") as HTMLInputElement;
      expect(input.value).toBe("テストユーザー");
    });

    test("表示名変更ボタン押下でAPIが呼ばれる", async () => {
      const user = userEvent.setup();
      renderSettings();

      const input = screen.getByLabelText("表示名");
      await user.clear(input);
      await user.type(input, "新しい名前");
      await user.click(screen.getByRole("button", { name: "表示名を変更" }));

      await waitFor(() => {
        expect(updateDisplayName).toHaveBeenCalledWith("test-token", "新しい名前");
      });
    });

    test("表示名変更成功で成功メッセージが表示される", async () => {
      const user = userEvent.setup();
      renderSettings();

      const input = screen.getByLabelText("表示名");
      await user.clear(input);
      await user.type(input, "新しい名前");
      await user.click(screen.getByRole("button", { name: "表示名を変更" }));

      await waitFor(() => {
        expect(screen.getByText(/表示名を変更しました/)).toBeInTheDocument();
      });
    });

    test("ユーザー情報タブにアカウント削除ボタンが表示される", () => {
      renderSettings();
      expect(screen.getByText("アカウントの削除")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "アカウントを削除" })).toBeInTheDocument();
    });

    test("アカウント削除ボタンで確認モーダルが表示される", async () => {
      const user = userEvent.setup();
      renderSettings();

      await user.click(screen.getByRole("button", { name: "アカウントを削除" }));

      expect(screen.getByText("本当にアカウントを削除しますか？")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
    });

    test("アカウント削除確認でAPIが呼ばれる", async () => {
      const user = userEvent.setup();
      renderSettings();

      await user.click(screen.getByRole("button", { name: "アカウントを削除" }));
      await user.click(screen.getByRole("button", { name: "削除する" }));

      await waitFor(() => {
        expect(deleteAccount).toHaveBeenCalledWith("test-token");
      });
    });

    test("アカウント削除キャンセルでモーダルが閉じる", async () => {
      const user = userEvent.setup();
      renderSettings();

      await user.click(screen.getByRole("button", { name: "アカウントを削除" }));
      expect(screen.getByText("本当にアカウントを削除しますか？")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(screen.queryByText("本当にアカウントを削除しますか？")).not.toBeInTheDocument();
    });

  });

  // === 提案設定タブ ===
  describe("提案設定タブ", () => {
    async function switchToSuggestionTab() {
      const user = userEvent.setup();
      renderSettings();
      await user.click(screen.getByRole("tab", { name: "提案設定" }));
      return user;
    }

    test("興味タグが表示される", async () => {
      await switchToSuggestionTab();
      expect(screen.getByText("興味タグ")).toBeInTheDocument();
    });

    test("全ジャンルタグが選択可能に表示される", async () => {
      await switchToSuggestionTab();
      expect(screen.getByRole("button", { name: /カフェ/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /レストラン/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /公園/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /美術館/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /書店/ })).toBeInTheDocument();
    });

    test("現在の興味タグが選択状態で表示される", async () => {
      await switchToSuggestionTab();

      // カフェ、公園、美術館が選択済み
      const cafeChip = screen.getByRole("button", { name: /カフェ/ });
      const parkChip = screen.getByRole("button", { name: /公園/ });
      const museumChip = screen.getByRole("button", { name: /美術館/ });
      expect(cafeChip).toHaveAttribute("aria-pressed", "true");
      expect(parkChip).toHaveAttribute("aria-pressed", "true");
      expect(museumChip).toHaveAttribute("aria-pressed", "true");

      // レストラン、書店は未選択
      const restaurantChip = screen.getByRole("button", { name: /レストラン/ });
      const bookstoreChip = screen.getByRole("button", { name: /書店/ });
      expect(restaurantChip).toHaveAttribute("aria-pressed", "false");
      expect(bookstoreChip).toHaveAttribute("aria-pressed", "false");
    });

    test("興味タグの保存で提案更新確認モーダルが表示される（リロード残あり）", async () => {
      const user = await switchToSuggestionTab();

      await user.click(screen.getByRole("button", { name: /レストラン/ }));
      await user.click(screen.getByRole("button", { name: "興味タグを保存" }));

      // 確認モーダルが表示される
      await waitFor(() => {
        expect(screen.getByText("提案が更新されます")).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "保存する" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
    });

    test("興味タグの保存でAPIが呼ばれる（モーダル確認後）", async () => {
      const user = await switchToSuggestionTab();

      // レストランを追加選択
      await user.click(screen.getByRole("button", { name: /レストラン/ }));
      await user.click(screen.getByRole("button", { name: "興味タグを保存" }));

      // モーダル確認
      await waitFor(() => expect(screen.getByText("提案が更新されます")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "保存する" }));

      await waitFor(() => {
        expect(updateInterests).toHaveBeenCalledWith("test-token", [1, 3, 4, 2], true);
      });
    });

    test("興味タグ保存成功でメッセージが表示される（モーダル確認後）", async () => {
      const user = await switchToSuggestionTab();

      await user.click(screen.getByRole("button", { name: /レストラン/ }));
      await user.click(screen.getByRole("button", { name: "興味タグを保存" }));

      // モーダル確認
      await waitFor(() => expect(screen.getByText("提案が更新されます")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "保存する" }));

      await waitFor(() => {
        expect(screen.getByText(/興味タグを保存しました/)).toBeInTheDocument();
      });
    });

    test("モーダルキャンセルでAPIが呼ばれない", async () => {
      const user = await switchToSuggestionTab();

      await user.click(screen.getByRole("button", { name: /レストラン/ }));
      await user.click(screen.getByRole("button", { name: "興味タグを保存" }));

      await waitFor(() => expect(screen.getByText("提案が更新されます")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "キャンセル" }));

      expect(updateInterests).not.toHaveBeenCalled();
      expect(screen.queryByText("提案が更新されます")).not.toBeInTheDocument();
    });

    test("リロード残0の場合はモーダルなしで保存される", async () => {
      vi.mocked(getReloadCountRemaining).mockReturnValue(0);
      const user = await switchToSuggestionTab();

      await user.click(screen.getByRole("button", { name: /レストラン/ }));
      await user.click(screen.getByRole("button", { name: "興味タグを保存" }));

      // モーダルは表示されぺにダイレクト保存
      await waitFor(() => {
        expect(updateInterests).toHaveBeenCalledWith("test-token", [1, 3, 4, 2], false);
      });
      expect(screen.queryByText("提案が更新されます")).not.toBeInTheDocument();
    });

    test("リロード残0の場合、翔日反映メッセージが表示される", async () => {
      vi.mocked(getReloadCountRemaining).mockReturnValue(0);
      const user = await switchToSuggestionTab();

      await user.click(screen.getByRole("button", { name: /レストラン/ }));
      await user.click(screen.getByRole("button", { name: "興味タグを保存" }));

      await waitFor(() => {
        expect(screen.getByText(/明日リセット時に反映されます/)).toBeInTheDocument();
      });
    });

    test("リロード残0の場合、clearSuggestionsCacheは呼ばれない", async () => {
      vi.mocked(getReloadCountRemaining).mockReturnValue(0);
      const user = await switchToSuggestionTab();

      await user.click(screen.getByRole("button", { name: /レストラン/ }));
      await user.click(screen.getByRole("button", { name: "興味タグを保存" }));

      await waitFor(() => expect(updateInterests).toHaveBeenCalled());
      expect(clearSuggestionsCache).not.toHaveBeenCalled();
    });

    test("興味タグが3つ未満だと保存ボタンが無効", async () => {
      const user = await switchToSuggestionTab();

      // 美術館と公園を解除（残り1つ）
      await user.click(screen.getByRole("button", { name: /美術館/ }));
      await user.click(screen.getByRole("button", { name: /公園/ }));

      const saveButton = screen.getByRole("button", { name: "興味タグを保存" });
      expect(saveButton).toBeDisabled();
    });

    test("提案半径のスライダーUIが表示される", async () => {
      await switchToSuggestionTab();
      expect(screen.getByRole("heading", { name: /提案半径/ })).toBeInTheDocument();
      expect(screen.getByRole("slider", { name: "提案半径" })).toBeInTheDocument();
    });

    test("現在のsearch_radiusがスライダーの初期値として設定される", async () => {
      await switchToSuggestionTab();
      // mockUser の search_radius = 5000
      const slider = screen.getByRole("slider", { name: "提案半径" }) as HTMLInputElement;
      expect(slider.value).toBe("5000");
    });

    test("半径変更でupdateSearchRadiusが呼ばれる（モーダル確認後）", async () => {
      const user = await switchToSuggestionTab();

      const slider = screen.getByRole("slider", { name: "提案半径" });
      await user.type(slider, "{ArrowRight}".repeat(5));
      await user.click(screen.getByRole("button", { name: "半径を保存" }));

      // モーダル確認
      await waitFor(() => expect(screen.getByText("提案が更新されます")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "保存する" }));

      await waitFor(() => {
        expect(updateSearchRadius).toHaveBeenCalled();
      });
    });

    test("半径保存成功でメッセージが表示される（モーダル確認後）", async () => {
      const user = await switchToSuggestionTab();

      await user.click(screen.getByRole("button", { name: "半径を保存" }));

      // モーダル確認
      await waitFor(() => expect(screen.getByText("提案が更新されます")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "保存する" }));

      await waitFor(() => {
        expect(screen.getByText(/提案半径を保存しました/)).toBeInTheDocument();
      });
    });
  });

  // === Issue #158: スクロール制御 ===
  describe("レイアウト・スクロール制御", () => {
    test("ルートコンテナに過剰な下部余白クラス(pb-32)がない", () => {
      const { container } = renderSettings();
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).not.toHaveClass("pb-32");
    });
  });

});
