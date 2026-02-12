import { describe, test, expect, beforeEach, vi } from "vitest";
import { setToken } from "~/lib/auth";

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

  test("ログイン成功 → トークン保存 → /home へリダイレクト", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
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

    // fetch が login API に呼ばれたか
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

  test("ログイン失敗 → エラーメッセージ返却", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const { clientAction } = await import("~/routes/login");

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "wrong-password");

    const request = new Request("http://localhost/login", {
      method: "POST",
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await clientAction({ request, params: {} } as any);

    expect(result).toEqual({ error: "メールアドレスまたはパスワードが正しくありません" });
    expect(localStorage.getItem("roamble_token")).toBeNull();
  });
});

describe("logout", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    vi.restoreAllMocks();
  });

  test("ログアウト → バックエンドAPI呼び出し → トークン削除", async () => {
    localStorage.setItem("roamble_token", "some-token");
    localStorage.setItem("roamble_refresh_token", "some-refresh");

    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { logout } = await import("~/lib/auth");

    await logout();

    // POST /api/auth/logout が呼ばれたか
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer some-token",
        }),
      })
    );

    // ローカルのトークンも削除されたか
    expect(localStorage.getItem("roamble_token")).toBeNull();
    expect(localStorage.getItem("roamble_refresh_token")).toBeNull();
  });

  test("ログアウト → API失敗でもトークンは削除される", async () => {
    localStorage.setItem("roamble_token", "some-token");
    localStorage.setItem("roamble_refresh_token", "some-refresh");

    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    const { logout } = await import("~/lib/auth");

    await logout();

    // API失敗してもローカルトークンは削除
    expect(localStorage.getItem("roamble_token")).toBeNull();
    expect(localStorage.getItem("roamble_refresh_token")).toBeNull();
  });
});

describe("refreshToken", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    vi.restoreAllMocks();
  });

  test("リフレッシュ成功 → 新トークンが保存される", async () => {
    localStorage.setItem("roamble_token", "old-access");
    localStorage.setItem("roamble_refresh_token", "valid-refresh");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
        }),
    });

    const { refreshToken } = await import("~/lib/auth");

    await refreshToken();

    // POST /api/auth/refresh が呼ばれたか
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/refresh",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ refresh_token: "valid-refresh" }),
      })
    );

    // 新トークンが保存されたか
    expect(localStorage.getItem("roamble_token")).toBe("new-access-token");
    expect(localStorage.getItem("roamble_refresh_token")).toBe(
      "new-refresh-token"
    );
  });

  test("リフレッシュ失敗 → エラーが throw される", async () => {
    localStorage.setItem("roamble_token", "old-access");
    localStorage.setItem("roamble_refresh_token", "expired-refresh");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const { refreshToken } = await import("~/lib/auth");

    await expect(refreshToken()).rejects.toThrow();
  });
});
