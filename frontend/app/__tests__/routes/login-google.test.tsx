import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// @react-oauth/google をモック（GoogleLogin コンポーネントをテスト用スタブに置き換える）
vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({
    onSuccess,
    onError,
  }: {
    onSuccess: (response: { credential?: string }) => void;
    onError: () => void;
  }) => (
    <div>
      <button
        onClick={() => onSuccess({ credential: "mock-google-credential" })}
      >
        Googleでログイン
      </button>
      <button data-testid="google-error-btn" onClick={onError}>
        GoogleエラーTrigger
      </button>
      <button
        data-testid="google-no-credential-btn"
        onClick={() => onSuccess({ credential: undefined })}
      >
        資格情報なし
      </button>
    </div>
  ),
}));

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useNavigation: () => ({ state: "idle" }),
    Form: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      method?: string;
      className?: string;
    }) => <form {...props}>{children}</form>,
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
  setToken: vi.fn(),
  googleOAuth: vi.fn(),
}));

function createStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

import Login from "~/routes/login";
import { setToken, googleOAuth } from "~/lib/auth";

describe("Login コンポーネント — Google OAuth", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    mockNavigate.mockReset();
    vi.mocked(googleOAuth).mockReset();
    vi.mocked(setToken).mockReset();
  });

  function renderLogin() {
    return render(<Login actionData={undefined as any} params={{} as any} matches={[] as any} />);
  }

  test("Googleでログインボタンが表示される", () => {
    renderLogin();
    expect(screen.getByText("Googleでログイン")).toBeInTheDocument();
  });

  test("Google OAuth成功時にsetTokenが呼ばれ /home にナビゲートされる", async () => {
    const user = userEvent.setup();
    vi.mocked(googleOAuth).mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      is_new_user: false,
    });

    renderLogin();
    await user.click(screen.getByText("Googleでログイン"));

    await waitFor(() => {
      expect(googleOAuth).toHaveBeenCalledWith("mock-google-credential");
      expect(setToken).toHaveBeenCalledWith("access-token", "refresh-token");
      expect(mockNavigate).toHaveBeenCalledWith("/home");
    });
  });

  test("credentialが空の場合にエラーメッセージが表示される", async () => {
    const user = userEvent.setup();

    renderLogin();
    await user.click(screen.getByTestId("google-no-credential-btn"));

    await waitFor(() => {
      expect(
        screen.getByText(/Googleログインに失敗しました/)
      ).toBeInTheDocument();
    });
    expect(googleOAuth).not.toHaveBeenCalled();
  });

  test("Google OAuthのonErrorでエラーメッセージが表示される", async () => {
    const user = userEvent.setup();

    renderLogin();
    await user.click(screen.getByTestId("google-error-btn"));

    await waitFor(() => {
      expect(
        screen.getByText(/Googleログインに失敗しました/)
      ).toBeInTheDocument();
    });
  });

  test("APIエラー時にエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    vi.mocked(googleOAuth).mockRejectedValue(new Error("oauth_failed"));

    renderLogin();
    await user.click(screen.getByText("Googleでログイン"));

    await waitFor(() => {
      expect(
        screen.getByText(/Googleログインに失敗しました/)
      ).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("サーバーエラー時にサーバーエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    vi.mocked(googleOAuth).mockRejectedValue(new Error("server_error"));

    renderLogin();
    await user.click(screen.getByText("Googleでログイン"));

    await waitFor(() => {
      expect(
        screen.getByText(/サーバーエラーが発生しました/)
      ).toBeInTheDocument();
    });
  });

  test("ネットワークエラー時にネットワークエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    vi.mocked(googleOAuth).mockRejectedValue(
      new TypeError("Failed to fetch")
    );

    renderLogin();
    await user.click(screen.getByText("Googleでログイン"));

    await waitFor(() => {
      expect(
        screen.getByText(/ネットワークに接続できません/)
      ).toBeInTheDocument();
    });
  });
});
