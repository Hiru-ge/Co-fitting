import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { calcDistance, getPositionWithFallback, calcMapCenter, isWithinCheckInRange, startPositionPolling } from "~/utils/geolocation";
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

// === Issue #257: 訪問ボタン近接制限 ===
describe("isWithinCheckInRange", () => {
  test("同一地点は200m以内と判定される", () => {
    expect(isWithinCheckInRange(35.658, 139.7016, 35.658, 139.7016)).toBe(true);
  });

  test("約150m離れた地点は200m以内と判定される", () => {
    // 緯度0.00135度 ≈ 150m
    expect(isWithinCheckInRange(35.658, 139.7016, 35.6594, 139.7016)).toBe(true);
  });

  test("約300m離れた地点は200m超と判定される", () => {
    // 緯度0.0027度 ≈ 300m
    expect(isWithinCheckInRange(35.658, 139.7016, 35.6607, 139.7016)).toBe(false);
  });

  test("userPos が (0,0) のときは常に true（GPS未取得扱い）", () => {
    expect(isWithinCheckInRange(0, 0, 35.658, 139.7016)).toBe(true);
  });

  test("カスタム閾値（100m）での判定", () => {
    // 約150m離れた地点: 100m閾値ではfalse、200m閾値ではtrue
    expect(isWithinCheckInRange(35.658, 139.7016, 35.6594, 139.7016, 100)).toBe(false);
    expect(isWithinCheckInRange(35.658, 139.7016, 35.6594, 139.7016, 200)).toBe(true);
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

describe("calcMapCenter", () => {
  test("userPositionがある場合はそれを返す", () => {
    const pos = { lat: 35.7, lng: 139.8 };
    const visits = [{ lat: 35.6, lng: 139.7 }];
    expect(calcMapCenter(visits, pos)).toEqual(pos);
  });

  test("userPositionがなくvisitsがある場合は平均座標を返す", () => {
    const visits = [
      { lat: 35.6762, lng: 139.6503 },
      { lat: 35.68, lng: 139.66 },
    ];
    const result = calcMapCenter(visits, null);
    expect(result.lat).toBeCloseTo((35.6762 + 35.68) / 2);
    expect(result.lng).toBeCloseTo((139.6503 + 139.66) / 2);
  });

  test("userPositionもvisitsも空の場合はDEFAULT_LOCATIONを返す", () => {
    expect(calcMapCenter([], null)).toEqual({
      lat: DEFAULT_LOCATION.lat,
      lng: DEFAULT_LOCATION.lng,
    });
  });

  test("visits1件の場合はその座標を返す", () => {
    const visits = [{ lat: 35.7, lng: 139.9 }];
    const result = calcMapCenter(visits, null);
    expect(result.lat).toBe(35.7);
    expect(result.lng).toBe(139.9);
  });
});

// === Issue #262: 訪問ボタン距離判定の定期更新 ===
describe("startPositionPolling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("起動直後に1回取得し、コールバックが呼ばれる", () => {
    const onPosition = vi.fn();
    const getCurrentPositionMock = vi.fn().mockImplementation(
      (success: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
        success({ coords: { latitude: 35.68, longitude: 139.76 } });
      }
    );
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: getCurrentPositionMock },
    });

    startPositionPolling(onPosition);

    expect(getCurrentPositionMock).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    );
    expect(onPosition).toHaveBeenCalledWith({ lat: 35.68, lng: 139.76 });
  });

  test("30秒後に再度取得される", () => {
    const onPosition = vi.fn();
    const getCurrentPositionMock = vi.fn().mockImplementation(
      (success: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
        success({ coords: { latitude: 35.68, longitude: 139.76 } });
      }
    );
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: getCurrentPositionMock },
    });

    startPositionPolling(onPosition);
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30000);
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2);
  });

  test("onError コールバックが渡された場合、getCurrentPosition に転送される", () => {
    const onPosition = vi.fn();
    const onError = vi.fn();
    const getCurrentPositionMock = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: getCurrentPositionMock },
    });

    startPositionPolling(onPosition, onError);

    expect(getCurrentPositionMock).toHaveBeenCalledWith(
      expect.any(Function),
      onError,
      expect.any(Object)
    );
  });

  test("Geolocation非対応の場合は null を返す", () => {
    vi.stubGlobal("navigator", { geolocation: undefined });
    expect(startPositionPolling(vi.fn())).toBeNull();
  });
});
