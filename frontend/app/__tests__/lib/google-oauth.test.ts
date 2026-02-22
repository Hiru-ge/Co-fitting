import { describe, test, expect, beforeEach, vi } from "vitest";
import { googleOAuth } from "~/lib/auth";

describe("googleOAuth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("IDトークンで /api/auth/oauth/google を呼び出す", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "access-token",
          refresh_token: "refresh-token",
          is_new_user: false,
        }),
    });

    const result = await googleOAuth("google-id-token");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/oauth/google",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: "google-id-token" }),
      })
    );
    expect(result).toEqual({
      access_token: "access-token",
      refresh_token: "refresh-token",
      is_new_user: false,
    });
  });

  test("新規ユーザーの場合 is_new_user が true で返る", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "access-token",
          refresh_token: "refresh-token",
          is_new_user: true,
        }),
    });

    const result = await googleOAuth("google-id-token");

    expect(result.is_new_user).toBe(true);
  });

  test("APIエラー（401）時にエラーをthrowする", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(googleOAuth("invalid-token")).rejects.toThrow("oauth_failed");
  });

  test("サーバーエラー（500）時に server_error をthrowする", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(googleOAuth("some-token")).rejects.toThrow("server_error");
  });

  test("ネットワークエラー時にエラーをthrowする", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(googleOAuth("some-token")).rejects.toThrow("Failed to fetch");
  });
});
