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
}));

import Settings from "~/routes/settings";
import { updateDisplayName, changePassword } from "~/api/users";

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

  test("設定画面のタイトルが表示される", () => {
    renderSettings();
    expect(screen.getByText("設定")).toBeInTheDocument();
  });

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

  test("パスワード変更フォームが表示される", () => {
    renderSettings();
    expect(screen.getByLabelText("現在のパスワード")).toBeInTheDocument();
    expect(screen.getByLabelText("新しいパスワード")).toBeInTheDocument();
    expect(screen.getByLabelText("新しいパスワード（確認）")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "パスワードを変更" })).toBeInTheDocument();
  });

  test("パスワード変更ボタン押下でAPIが呼ばれる", async () => {
    const user = userEvent.setup();
    renderSettings();

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
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText("現在のパスワード"), "oldpassword123");
    await user.type(screen.getByLabelText("新しいパスワード"), "newpassword456");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "newpassword456");

    await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

    await waitFor(() => {
      expect(screen.getByText(/パスワードを変更しました/)).toBeInTheDocument();
    });
  });

  test("パスワード確認が一致しない場合エラー表示", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText("現在のパスワード"), "oldpassword123");
    await user.type(screen.getByLabelText("新しいパスワード"), "newpassword456");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "different789");

    await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

    expect(screen.getByText(/パスワードが一致しません/)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  test("新しいパスワードが8文字未満の場合エラー表示", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText("現在のパスワード"), "oldpassword123");
    await user.type(screen.getByLabelText("新しいパスワード"), "short");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "short");

    await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

    expect(
      screen.getByText(/パスワードは8文字以上で入力してください/)
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  test("戻るボタンが表示される", () => {
    renderSettings();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
  });

  test("パスワード変更失敗でエラーメッセージが表示される", async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(new Error("API Error: 401"));
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText("現在のパスワード"), "wrongpassword");
    await user.type(screen.getByLabelText("新しいパスワード"), "newpassword456");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "newpassword456");

    await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

    await waitFor(() => {
      expect(screen.getByText(/パスワードの変更に失敗しました/)).toBeInTheDocument();
    });
  });
});
