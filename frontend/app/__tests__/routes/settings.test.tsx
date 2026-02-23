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
  changePassword: vi.fn().mockResolvedValue({
    message: "password changed successfully",
  }),
  updateEmail: vi.fn().mockResolvedValue({
    message: "email updated successfully",
  }),
  deleteAccount: vi.fn().mockResolvedValue(undefined),
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
  updateInterests: vi.fn().mockResolvedValue([
    { genre_tag_id: 1, name: "カフェ", category: "グルメ", icon: "☕" },
    { genre_tag_id: 2, name: "レストラン", category: "グルメ", icon: "🍽️" },
    { genre_tag_id: 3, name: "公園", category: "アウトドア", icon: "🌳" },
  ]),
}));

import Settings from "~/routes/settings";
import { updateDisplayName, changePassword, updateEmail, deleteAccount } from "~/api/users";
import { updateInterests } from "~/api/genres";

const mockUser = {
  id: 1,
  email: "test@example.com",
  display_name: "テストユーザー",
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
  });

  // === タブナビゲーション ===
  describe("タブナビゲーション", () => {
    test("設定画面のタイトルが表示される", () => {
      renderSettings();
      expect(screen.getByText("設定")).toBeInTheDocument();
    });

    test("3つのタブが表示される", () => {
      renderSettings();
      expect(screen.getByRole("tab", { name: "ユーザ情報" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "提案設定" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "アカウント" })).toBeInTheDocument();
    });

    test("初期状態ではユーザー情報タブが選択されている", () => {
      renderSettings();
      const tab = screen.getByRole("tab", { name: "ユーザ情報" });
      expect(tab).toHaveAttribute("aria-selected", "true");
    });

    test("タブクリックで表示内容が切り替わる", async () => {
      const user = userEvent.setup();
      renderSettings();

      // 提案設定タブに切り替え
      await user.click(screen.getByRole("tab", { name: "提案設定" }));
      expect(screen.getByRole("tab", { name: "提案設定" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText("興味タグ")).toBeInTheDocument();

      // アカウントタブに切り替え
      await user.click(screen.getByRole("tab", { name: "アカウント" }));
      expect(screen.getByRole("tab", { name: "アカウント" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText("パスワードの変更")).toBeInTheDocument();
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

    test("メールアドレス変更フォームが表示される", () => {
      renderSettings();
      expect(screen.getByText("メールアドレスの変更")).toBeInTheDocument();
    });

    test("現在のメールアドレスが表示される", () => {
      renderSettings();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });

    test("メールアドレス変更でAPIが呼ばれる", async () => {
      const user = userEvent.setup();
      renderSettings();

      await user.type(screen.getByLabelText("新しいメールアドレス"), "new@example.com");
      await user.type(screen.getByLabelText("現在のパスワード（確認用）"), "mypassword123");
      await user.click(screen.getByRole("button", { name: "メールアドレスを変更" }));

      await waitFor(() => {
        expect(updateEmail).toHaveBeenCalledWith("test-token", "new@example.com", "mypassword123");
      });
    });

    test("メールアドレス変更成功で成功メッセージが表示される", async () => {
      const user = userEvent.setup();
      renderSettings();

      await user.type(screen.getByLabelText("新しいメールアドレス"), "new@example.com");
      await user.type(screen.getByLabelText("現在のパスワード（確認用）"), "mypassword123");
      await user.click(screen.getByRole("button", { name: "メールアドレスを変更" }));

      await waitFor(() => {
        expect(screen.getByText(/メールアドレスを変更しました/)).toBeInTheDocument();
      });
    });

    test("メールアドレス変更失敗でエラーメッセージが表示される", async () => {
      vi.mocked(updateEmail).mockRejectedValueOnce(new Error("API Error"));
      const user = userEvent.setup();
      renderSettings();

      await user.type(screen.getByLabelText("新しいメールアドレス"), "new@example.com");
      await user.type(screen.getByLabelText("現在のパスワード（確認用）"), "mypassword123");
      await user.click(screen.getByRole("button", { name: "メールアドレスを変更" }));

      await waitFor(() => {
        expect(screen.getByText(/メールアドレスの変更に失敗しました/)).toBeInTheDocument();
      });
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

    test("興味タグの保存でAPIが呼ばれる", async () => {
      const user = await switchToSuggestionTab();

      // レストランを追加選択
      await user.click(screen.getByRole("button", { name: /レストラン/ }));
      await user.click(screen.getByRole("button", { name: "興味タグを保存" }));

      await waitFor(() => {
        expect(updateInterests).toHaveBeenCalledWith("test-token", [1, 3, 4, 2]);
      });
    });

    test("興味タグ保存成功でメッセージが表示される", async () => {
      const user = await switchToSuggestionTab();

      await user.click(screen.getByRole("button", { name: /レストラン/ }));
      await user.click(screen.getByRole("button", { name: "興味タグを保存" }));

      await waitFor(() => {
        expect(screen.getByText(/興味タグを保存しました/)).toBeInTheDocument();
      });
    });

    test("興味タグが3つ未満だと保存ボタンが無効", async () => {
      const user = await switchToSuggestionTab();

      // 美術館と公園を解除（残り1つ）
      await user.click(screen.getByRole("button", { name: /美術館/ }));
      await user.click(screen.getByRole("button", { name: /公園/ }));

      const saveButton = screen.getByRole("button", { name: "興味タグを保存" });
      expect(saveButton).toBeDisabled();
    });
  });

  // === アカウントタブ ===
  describe("アカウントタブ", () => {
    async function switchToAccountTab() {
      const user = userEvent.setup();
      renderSettings();
      await user.click(screen.getByRole("tab", { name: "アカウント" }));
      return user;
    }

    test("パスワード変更フォームが表示される", async () => {
      await switchToAccountTab();
      expect(screen.getByText("パスワードの変更")).toBeInTheDocument();
      expect(screen.getByLabelText("現在のパスワード")).toBeInTheDocument();
      expect(screen.getByLabelText("新しいパスワード")).toBeInTheDocument();
      expect(screen.getByLabelText("新しいパスワード（確認）")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "パスワードを変更" })).toBeInTheDocument();
    });

    test("パスワード変更ボタン押下でAPIが呼ばれる", async () => {
      const user = await switchToAccountTab();

      await user.type(screen.getByLabelText("現在のパスワード"), "oldpassword123");
      await user.type(screen.getByLabelText("新しいパスワード"), "newpassword456");
      await user.type(screen.getByLabelText("新しいパスワード（確認）"), "newpassword456");
      await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

      await waitFor(() => {
        expect(changePassword).toHaveBeenCalledWith(
          "test-token",
          "oldpassword123",
          "newpassword456"
        );
      });
    });

    test("パスワード変更成功で成功メッセージが表示される", async () => {
      const user = await switchToAccountTab();

      await user.type(screen.getByLabelText("現在のパスワード"), "oldpassword123");
      await user.type(screen.getByLabelText("新しいパスワード"), "newpassword456");
      await user.type(screen.getByLabelText("新しいパスワード（確認）"), "newpassword456");
      await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

      await waitFor(() => {
        expect(screen.getByText(/パスワードを変更しました/)).toBeInTheDocument();
      });
    });

    test("パスワード確認が一致しない場合エラー表示", async () => {
      const user = await switchToAccountTab();

      await user.type(screen.getByLabelText("現在のパスワード"), "oldpassword123");
      await user.type(screen.getByLabelText("新しいパスワード"), "newpassword456");
      await user.type(screen.getByLabelText("新しいパスワード（確認）"), "different789");
      await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

      expect(screen.getByText(/パスワードが一致しません/)).toBeInTheDocument();
      expect(changePassword).not.toHaveBeenCalled();
    });

    test("新しいパスワードが8文字未満の場合エラー表示", async () => {
      const user = await switchToAccountTab();

      await user.type(screen.getByLabelText("現在のパスワード"), "oldpassword123");
      await user.type(screen.getByLabelText("新しいパスワード"), "short");
      await user.type(screen.getByLabelText("新しいパスワード（確認）"), "short");
      await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

      expect(
        screen.getByText(/パスワードは8文字以上で入力してください/)
      ).toBeInTheDocument();
      expect(changePassword).not.toHaveBeenCalled();
    });

    test("パスワード変更失敗でエラーメッセージが表示される", async () => {
      vi.mocked(changePassword).mockRejectedValueOnce(new Error("API Error: 401"));
      const user = await switchToAccountTab();

      await user.type(screen.getByLabelText("現在のパスワード"), "wrongpassword");
      await user.type(screen.getByLabelText("新しいパスワード"), "newpassword456");
      await user.type(screen.getByLabelText("新しいパスワード（確認）"), "newpassword456");
      await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

      await waitFor(() => {
        expect(screen.getByText(/パスワードの変更に失敗しました/)).toBeInTheDocument();
      });
    });

    test("アカウント削除セクションが表示される", async () => {
      await switchToAccountTab();
      expect(screen.getByText("アカウントの削除")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "アカウントを削除" })).toBeInTheDocument();
    });

    test("アカウント削除ボタンで確認モーダルが表示される", async () => {
      const user = await switchToAccountTab();

      await user.click(screen.getByRole("button", { name: "アカウントを削除" }));

      expect(screen.getByText("本当にアカウントを削除しますか？")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
    });

    test("アカウント削除確認でAPIが呼ばれる", async () => {
      const user = await switchToAccountTab();

      await user.click(screen.getByRole("button", { name: "アカウントを削除" }));
      await user.click(screen.getByRole("button", { name: "削除する" }));

      await waitFor(() => {
        expect(deleteAccount).toHaveBeenCalledWith("test-token");
      });
    });

    test("アカウント削除キャンセルでモーダルが閉じる", async () => {
      const user = await switchToAccountTab();

      await user.click(screen.getByRole("button", { name: "アカウントを削除" }));
      expect(screen.getByText("本当にアカウントを削除しますか？")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(screen.queryByText("本当にアカウントを削除しますか？")).not.toBeInTheDocument();
    });
  });
});
