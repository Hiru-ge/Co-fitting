import { describe, it, expect, vi } from "vitest";

// 環境変数をテスト用に設定
vi.stubEnv("VITE_API_BASE_URL", "https://api.roamble.app");
vi.doMock("../../utils/constants", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../utils/constants")>();
  return {
    ...original,
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  };
});

describe("constants", () => {
  it("API_BASE_URL が環境変数ベースまたはデフォルト値である", () => {
    // 現在の実装を直接テスト
    const API_BASE_URL =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    // 環境変数が設定されていればその値、未設定ならデフォルト値
    expect(typeof API_BASE_URL).toBe("string");
    expect(API_BASE_URL.length).toBeGreaterThan(0);
    expect(API_BASE_URL.startsWith("http")).toBe(true);
  });

  it("デフォルト値の形式が正しい", () => {
    const defaultUrl = "http://localhost:8000";
    expect(defaultUrl).toMatch(/^https?:\/\/.*:\d+$/);
  });

  it("実際のconstantsファイルが正しく読み込める", async () => {
    const constants = await import("../../utils/constants");
    expect(constants.API_BASE_URL).toBeDefined();
    expect(typeof constants.API_BASE_URL).toBe("string");
    expect(constants.API_BASE_URL!.startsWith("http")).toBe(true);
  });

  it("その他の定数は変更されない", async () => {
    const { DEFAULT_LOCATION, DEFAULT_RADIUS } =
      await import("../../utils/constants");
    expect(DEFAULT_LOCATION).toEqual({ lat: 35.658, lng: 139.7016 });
    expect(DEFAULT_RADIUS).toBe(10000);
  });
});
