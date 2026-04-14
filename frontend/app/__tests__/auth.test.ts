import { describe, test, expect, beforeEach, vi } from "vitest";
import { getToken, setToken, clearToken, getUser } from "~/lib/auth";

// Node.js 22+ の組み込み localStorage は Web Storage API と互換性がないため、
// テスト用に完全な Storage モックを作成する
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

describe("認証トークン管理", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
  });

  test("setToken でアクセストークンが localStorage に保存される", () => {
    setToken("test-access-token", "test-refresh-token");

    expect(localStorage.getItem("roamble_token")).toBe("test-access-token");
  });

  test("setToken でリフレッシュトークンも保存できる", () => {
    setToken("test-access-token", "test-refresh-token");

    expect(localStorage.getItem("roamble_token")).toBe("test-access-token");
    expect(localStorage.getItem("roamble_refresh_token")).toBe(
      "test-refresh-token",
    );
  });

  test("getToken で保存済みトークンを取得できる", () => {
    localStorage.setItem("roamble_token", "stored-token");

    expect(getToken()).toBe("stored-token");
  });

  test("getToken でトークン未保存時は null を返す", () => {
    expect(getToken()).toBeNull();
  });

  test("clearToken で全トークンが削除される", () => {
    localStorage.setItem("roamble_token", "test-token");
    localStorage.setItem("roamble_refresh_token", "test-refresh");

    clearToken();

    expect(localStorage.getItem("roamble_token")).toBeNull();
    expect(localStorage.getItem("roamble_refresh_token")).toBeNull();
  });
});

describe("getUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("有効なトークンで user データが返される", async () => {
    const mockUser = {
      id: 1,
      email: "test@example.com",
      display_name: "テストユーザー",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser),
    });

    const user = await getUser("valid-token");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/users/me"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer valid-token",
        }),
      }),
    );
    expect(user).toEqual(mockUser);
  });

  test("無効なトークンでエラーが throw される", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(getUser("invalid-token")).rejects.toThrow();
  });
});

describe("authRequiredLoader", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    vi.restoreAllMocks();
  });

  test("トークンなしで Response (redirect) が throw される", async () => {
    const { authRequiredLoader } = await import("~/lib/auth");

    try {
      await authRequiredLoader();
      expect.unreachable("redirect が throw されるべき");
    } catch (e) {
      // React Router の redirect は Response を throw する
      expect(e).toBeInstanceOf(Response);
      const response = e as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    }
  });

  test("有効なトークンで user と token が返される", async () => {
    const mockUser = {
      id: 1,
      email: "test@example.com",
      display_name: "テストユーザー",
    };

    localStorage.setItem("roamble_token", "valid-token");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUser),
    });

    const { authRequiredLoader } = await import("~/lib/auth");
    const result = await authRequiredLoader();

    expect(result).toEqual({
      user: mockUser,
      token: "valid-token",
    });
  });

  test("トークンはあるが getUser 失敗で redirect が throw される", async () => {
    localStorage.setItem("roamble_token", "expired-token");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const { authRequiredLoader } = await import("~/lib/auth");

    try {
      await authRequiredLoader();
      expect.unreachable("redirect が throw されるべき");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      const response = e as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    }
  });
});

describe("refreshToken / tryRefreshToken", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    vi.restoreAllMocks();
  });

  test("refreshToken: 成功時にrefresh_token未返却でも既存リフレッシュトークンを保持する", async () => {
    const { refreshToken } = await import("~/lib/auth");

    localStorage.setItem("roamble_refresh_token", "old-refresh");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access",
        }),
    });

    await refreshToken();

    expect(localStorage.getItem("roamble_token")).toBe("new-access");
    expect(localStorage.getItem("roamble_refresh_token")).toBe("old-refresh");
  });

  test("refreshToken: 失敗時に Error を throw する", async () => {
    const { refreshToken } = await import("~/lib/auth");

    localStorage.setItem("roamble_refresh_token", "bad-refresh");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(refreshToken()).rejects.toThrow("Token refresh failed: 401");
  });

  test("tryRefreshToken: リフレッシュトークンがなければ fetch を呼ばず false を返す", async () => {
    const { tryRefreshToken } = await import("~/lib/auth");

    global.fetch = vi.fn();

    const result = await tryRefreshToken();

    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("tryRefreshToken: リフレッシュ成功時に true を返す", async () => {
    const { tryRefreshToken } = await import("~/lib/auth");

    localStorage.setItem("roamble_refresh_token", "valid-refresh");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access",
        }),
    });

    const result = await tryRefreshToken();

    expect(result).toBe(true);
    expect(localStorage.getItem("roamble_token")).toBe("new-access");
  });

  test("tryRefreshToken: リフレッシュ失敗時に false を返す（throw しない）", async () => {
    const { tryRefreshToken } = await import("~/lib/auth");

    localStorage.setItem("roamble_refresh_token", "expired-refresh");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await tryRefreshToken();

    expect(result).toBe(false);
  });
});
