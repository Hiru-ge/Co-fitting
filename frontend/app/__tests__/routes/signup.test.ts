import { describe, test, expect, beforeEach, vi } from "vitest";

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

describe("signup action", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    vi.restoreAllMocks();
  });

  test("フォーム送信 → SignUp API call → /home へ遷移", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
        }),
    });

    const { clientAction } = await import("~/routes/signup");

    const formData = new FormData();
    formData.set("display_name", "テストユーザー");
    formData.set("email", "test@example.com");
    formData.set("password", "password123");

    const request = new Request("http://localhost/signup", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    // signup API が正しいパラメータで呼ばれたか
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/signup",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: "テストユーザー",
          email: "test@example.com",
          password: "password123",
        }),
      })
    );

    // トークンが保存されたか
    expect(localStorage.getItem("roamble_token")).toBe("new-access-token");
    expect(localStorage.getItem("roamble_refresh_token")).toBe(
      "new-refresh-token"
    );

    // /home へリダイレクト
    expect(result).toBeInstanceOf(Response);
    const response = result as unknown as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/home");
  });

  test("メール重複 → エラーメッセージ表示", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          error: "このメールアドレスは既に登録されています",
        }),
    });

    const { clientAction } = await import("~/routes/signup");

    const formData = new FormData();
    formData.set("display_name", "テストユーザー");
    formData.set("email", "existing@example.com");
    formData.set("password", "password123");

    const request = new Request("http://localhost/signup", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    expect(result).toEqual({
      error: "このメールアドレスは既に使用されています。",
    });
    expect(localStorage.getItem("roamble_token")).toBeNull();
  });

  test("ネットワークエラー → エラーメッセージ返却", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    const { clientAction } = await import("~/routes/signup");

    const formData = new FormData();
    formData.set("display_name", "テストユーザー");
    formData.set("email", "test@example.com");
    formData.set("password", "password123");

    const request = new Request("http://localhost/signup", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    expect(result).toEqual({
      error: "ネットワークエラーが発生しました。時間をおいて再度お試しください。",
    });
    expect(localStorage.getItem("roamble_token")).toBeNull();
  });

  test("バリデーションエラー（パスワード短い） → エラーメッセージ返却", async () => {
    global.fetch = vi.fn();
    const { clientAction } = await import("~/routes/signup");

    const formData = new FormData();
    formData.set("display_name", "テストユーザー");
    formData.set("email", "test@example.com");
    formData.set("password", "short");

    const request = new Request("http://localhost/signup", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    expect(result).toEqual({
      error: "パスワードは8文字以上で入力してください。",
    });
    // API が呼ばれないこと
    expect(fetch).not.toHaveBeenCalled();
  });

  test("バリデーションエラー（表示名空） → エラーメッセージ返却", async () => {
    global.fetch = vi.fn();
    const { clientAction } = await import("~/routes/signup");

    const formData = new FormData();
    formData.set("display_name", "");
    formData.set("email", "test@example.com");
    formData.set("password", "password123");

    const request = new Request("http://localhost/signup", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    expect(result).toEqual({
      error: "表示名を入力してください。",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("バリデーションエラー（メール形式不正） → エラーメッセージ返却", async () => {
    global.fetch = vi.fn();
    const { clientAction } = await import("~/routes/signup");

    const formData = new FormData();
    formData.set("display_name", "テストユーザー");
    formData.set("email", "invalid-email");
    formData.set("password", "password123");

    const request = new Request("http://localhost/signup", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    expect(result).toEqual({
      error: "有効なメールアドレスを入力してください。",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
