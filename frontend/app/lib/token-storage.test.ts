import { describe, test, expect, beforeEach } from "vitest";
import {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  setToken,
  getToken,
  getRefreshToken,
  clearToken,
} from "~/lib/token-storage";

const storageData: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => storageData[key] ?? null,
  setItem: (key: string, value: string) => {
    storageData[key] = value;
  },
  removeItem: (key: string) => {
    delete storageData[key];
  },
  clear: () => {
    Object.keys(storageData).forEach((k) => delete storageData[k]);
  },
};

describe("token-storage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    localStorageMock.clear();
  });

  test("setTokenでaccess/refreshの両方を保存できる", () => {
    setToken("access-1", "refresh-1");

    expect(localStorage.getItem(TOKEN_KEY)).toBe("access-1");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-1");
  });

  test("getToken/getRefreshTokenは保存値を返す", () => {
    localStorage.setItem(TOKEN_KEY, "access-2");
    localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-2");

    expect(getToken()).toBe("access-2");
    expect(getRefreshToken()).toBe("refresh-2");
  });

  test("clearTokenで2つのトークンが削除される", () => {
    setToken("access-3", "refresh-3");
    clearToken();

    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
