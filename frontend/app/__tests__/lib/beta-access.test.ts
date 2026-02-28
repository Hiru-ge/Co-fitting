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
    test("正しい合言葉を入力した場合は true を返し、localStorageにフラグを保存する", () => {
      const result = unlockBeta(import.meta.env.VITE_BETA_PASSPHRASE ?? "ROAMBLE_BETA");
      expect(result).toBe(true);
      expect(localStorage.getItem(BETA_STORAGE_KEY)).toBe("1");
    });

    test("誤った合言葉を入力した場合は false を返し、localStorageは変化しない", () => {
      const result = unlockBeta("wrong-passphrase");
      expect(result).toBe(false);
      expect(localStorage.getItem(BETA_STORAGE_KEY)).toBeNull();
    });

    test("連続して誤った合言葉を入力しても false を返し続ける", () => {
      expect(unlockBeta("abc")).toBe(false);
      expect(unlockBeta("def")).toBe(false);
      expect(isBetaUnlocked()).toBe(false);
    });

    test("大文字・小文字を区別する", () => {
      const passphrase = import.meta.env.VITE_BETA_PASSPHRASE ?? "ROAMBLE_BETA";
      expect(unlockBeta(passphrase.toLowerCase())).toBe(false);
      expect(isBetaUnlocked()).toBe(false);
    });

    test("前後の空白を無視して合言葉を照合する", () => {
      const passphrase = import.meta.env.VITE_BETA_PASSPHRASE ?? "ROAMBLE_BETA";
      const result = unlockBeta(`  ${passphrase}  `);
      expect(result).toBe(true);
      expect(isBetaUnlocked()).toBe(true);
    });
  });
});
