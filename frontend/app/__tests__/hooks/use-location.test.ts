import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { DEFAULT_LOCATION } from "~/utils/constants";
import { useLocation } from "~/hooks/use-location";

const mockGetCurrentPosition = vi.fn();
const mockStartPositionPolling = vi.fn();

vi.mock("~/lib/geolocation", () => ({
  getCurrentPosition: () => mockGetCurrentPosition(),
  startPositionPolling: (...args: unknown[]) =>
    mockStartPositionPolling(...args),
}));

describe("useLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("位置情報取得成功で normal 状態と userPos を更新する", async () => {
    mockGetCurrentPosition.mockResolvedValueOnce({ lat: 35.1, lng: 139.1 });

    const { result } = renderHook(() => useLocation({ enablePolling: false }));

    const pos = await act(async () => {
      return result.current.resolveCurrentPosition();
    });

    expect(pos).toEqual({ lat: 35.1, lng: 139.1 });
    expect(result.current.locationStatus).toBe("normal");
    expect(result.current.userPos).toEqual({ lat: 35.1, lng: 139.1 });
    expect(result.current.showLocationDeniedModal).toBe(false);
  });

  test("位置情報拒否で denied 状態になりモーダルを開く", async () => {
    mockGetCurrentPosition.mockRejectedValueOnce({ code: 1 });

    const { result } = renderHook(() => useLocation({ enablePolling: false }));

    const pos = await act(async () => {
      return result.current.resolveCurrentPosition();
    });

    expect(pos).toBeNull();
    expect(result.current.locationStatus).toBe("denied");
    expect(result.current.showLocationDeniedModal).toBe(true);
  });

  test("タイムアウト等の非拒否エラー時は default 位置へフォールバックする", async () => {
    mockGetCurrentPosition.mockRejectedValueOnce({ code: 3 });

    const { result } = renderHook(() => useLocation({ enablePolling: false }));

    const pos = await act(async () => {
      return result.current.resolveCurrentPosition();
    });

    expect(pos).toEqual(DEFAULT_LOCATION);
    expect(result.current.locationStatus).toBe("using_default");
    expect(result.current.isUsingDefaultLocation).toBe(true);
    expect(result.current.userPos).toEqual(DEFAULT_LOCATION);
  });

  test("enablePolling=true かつ normal 状態で位置ポーリングを開始する", () => {
    mockStartPositionPolling.mockReturnValue(123);
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    const { unmount } = renderHook(() => useLocation({ enablePolling: true }));

    expect(mockStartPositionPolling).toHaveBeenCalledTimes(1);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledWith(123);
  });
});
