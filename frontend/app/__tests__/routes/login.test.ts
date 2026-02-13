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

describe("login action", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    vi.restoreAllMocks();
  });

  test("正しい認証情報 → JWT 取得 → /home へ遷移", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
        }),
    });

    const { clientAction } = await import("~/routes/login");

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "password123");

    const request = new Request("http://localhost/login", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    // login API が正しいパラメータで呼ばれたか
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      })
    );

    // トークンが保存されたか
    expect(localStorage.getItem("roamble_token")).toBe("test-access-token");
    expect(localStorage.getItem("roamble_refresh_token")).toBe(
      "test-refresh-token"
    );

    // /home へリダイレクト
    expect(result).toBeInstanceOf(Response);
    const response = result as unknown as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/home");
  });

  test("認証失敗（401） → エラーメッセージ返却", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({
          error: "Invalid credentials",
        }),
    });

    const { clientAction } = await import("~/routes/login");

    const formData = new FormData();
    formData.set("email", "wrong@example.com");
    formData.set("password", "wrongpassword");

    const request = new Request("http://localhost/login", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    expect(result).toEqual({
      error: "メールアドレスまたはパスワードが正しくありません",
    });
    // トークンが保存されていないこと
    expect(localStorage.getItem("roamble_token")).toBeNull();
  });

  test("ネットワークエラー → エラーメッセージ返却", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    const { clientAction } = await import("~/routes/login");

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "password123");

    const request = new Request("http://localhost/login", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    expect(result).toEqual({
      error: "ネットワークエラーが発生しました",
    });
    // トークンが保存されていないこと
    expect(localStorage.getItem("roamble_token")).toBeNull();
  });
});
