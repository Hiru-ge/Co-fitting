import { describe, test, expect, beforeEach, vi } from "vitest";

vi.mock("~/lib/token-storage", () => ({
  getRefreshToken: vi.fn(),
  setToken: vi.fn(),
}));

import { refreshToken, tryRefreshToken } from "~/lib/token-refresh";
import { getRefreshToken, setToken } from "~/lib/token-storage";

describe("token-refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("refreshToken成功時にsetTokenが呼ばれる", async () => {
    vi.mocked(getRefreshToken).mockReturnValue("refresh-ok");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access",
          refresh_token: "new-refresh",
        }),
    } as Response);

    await refreshToken();

    expect(fetch).toHaveBeenCalled();
    expect(setToken).toHaveBeenCalledWith("new-access", "new-refresh");
  });

  test("refreshToken失敗時は例外を投げる", async () => {
    vi.mocked(getRefreshToken).mockReturnValue("refresh-ng");

    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(refreshToken()).rejects.toThrow("Token refresh failed: 401");
  });

  test("tryRefreshTokenはrefresh tokenがない場合false", async () => {
    vi.mocked(getRefreshToken).mockReturnValue(null);
    await expect(tryRefreshToken()).resolves.toBe(false);
  });

  test("tryRefreshTokenは成功時true、失敗時false", async () => {
    vi.mocked(getRefreshToken).mockReturnValue("refresh-present");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "a", refresh_token: "r" }),
    } as Response);
    await expect(tryRefreshToken()).resolves.toBe(true);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(tryRefreshToken()).resolves.toBe(false);
  });
});
