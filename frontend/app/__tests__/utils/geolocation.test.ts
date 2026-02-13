import { describe, test, expect, vi, beforeEach } from "vitest";
import { calcDistance, getPositionWithFallback } from "~/utils/geolocation";
import { DEFAULT_LOCATION } from "~/utils/constants";

describe("calcDistance", () => {
  test("同一地点の距離は0", () => {
    expect(calcDistance(35.658, 139.7016, 35.658, 139.7016)).toBe(0);
  });

  test("渋谷→東京駅（約5km）の距離計算が妥当", () => {
    const dist = calcDistance(35.658, 139.7016, 35.6812, 139.7671);
    expect(dist).toBeGreaterThan(5000);
    expect(dist).toBeLessThan(7000);
  });

  test("渋谷→新宿（約3km）の距離計算が妥当", () => {
    const dist = calcDistance(35.658, 139.7016, 35.6896, 139.6999);
    expect(dist).toBeGreaterThan(2500);
    expect(dist).toBeLessThan(4500);
  });
});

describe("getPositionWithFallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("GPS成功時 → 実際の位置を返す", async () => {
    const mockPosition = {
      coords: { latitude: 35.68, longitude: 139.76 },
    };
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: (pos: typeof mockPosition) => void) =>
          success(mockPosition),
      },
    });

    const pos = await getPositionWithFallback();
    expect(pos.lat).toBe(35.68);
    expect(pos.lng).toBe(139.76);
  });

  test("GPS失敗時 → デフォルト位置（渋谷）にフォールバック", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (
          _success: unknown,
          error: (err: Error) => void
        ) => error(new Error("User denied")),
      },
    });

    const pos = await getPositionWithFallback();
    expect(pos.lat).toBe(DEFAULT_LOCATION.lat);
    expect(pos.lng).toBe(DEFAULT_LOCATION.lng);
  });

  test("Geolocation非対応 → デフォルト位置にフォールバック", async () => {
    vi.stubGlobal("navigator", { geolocation: undefined });

    const pos = await getPositionWithFallback();
    expect(pos.lat).toBe(DEFAULT_LOCATION.lat);
    expect(pos.lng).toBe(DEFAULT_LOCATION.lng);
  });
});
