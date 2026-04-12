import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  isBetaUnlocked,
  unlockBeta,
  BETA_STORAGE_KEY,
} from "~/lib/beta-access";

// localStorage をモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
});

describe("beta-access", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("isBetaUnlocked", () => {
    test("localStorageにフラグがない場合は false を返す", () => {
      expect(isBetaUnlocked()).toBe(false);
    });

    test("localStorageに '1' が保存されている場合は true を返す", () => {
      localStorage.setItem(BETA_STORAGE_KEY, "1");
      expect(isBetaUnlocked()).toBe(true);
    });

    test("localStorageに別の値が保存されている場合は false を返す", () => {
      localStorage.setItem(BETA_STORAGE_KEY, "0");
      expect(isBetaUnlocked()).toBe(false);
    });
  });

  describe("unlockBeta", () => {
    test("APIが200を返すと true を返し localStorageにフラグを保存する", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const result = await unlockBeta("EARLYROAMER");

      expect(result).toBe(true);
      expect(localStorage.getItem(BETA_STORAGE_KEY)).toBe("1");
    });

    test("APIが401を返すと false を返し localStorageは変化しない", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });

      const result = await unlockBeta("WRONGPASS");

      expect(result).toBe(false);
      expect(localStorage.getItem(BETA_STORAGE_KEY)).toBeNull();
    });

    test("ネットワークエラー時は false を返す（throw しない）", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await unlockBeta("EARLYROAMER");

      expect(result).toBe(false);
    });

    test("入力の前後スペースをトリムして API に送信する", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      await unlockBeta("  EARLYROAMER  ");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/beta/verify"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ passphrase: "EARLYROAMER" }),
        }),
      );
    });

    test("正しいエンドポイントに POST リクエストを送信する", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      await unlockBeta("EARLYROAMER");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/beta/verify"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });
});
