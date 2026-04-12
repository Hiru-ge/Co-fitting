import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useCheckIn } from "~/hooks/use-check-in";
import { ApiError } from "~/utils/error";

const mockCreateVisit = vi.fn();
const mockSendVisitRecorded = vi.fn();
const mockSendDailyCompleted = vi.fn();
const mockSendBadgeEarned = vi.fn();
const mockSendLevelUp = vi.fn();

vi.mock("~/api/visits", () => ({
  createVisit: (...args: unknown[]) => mockCreateVisit(...args),
}));

vi.mock("~/lib/gtag", () => ({
  sendVisitRecorded: (...args: unknown[]) => mockSendVisitRecorded(...args),
  sendDailyCompleted: (...args: unknown[]) => mockSendDailyCompleted(...args),
  sendBadgeEarned: (...args: unknown[]) => mockSendBadgeEarned(...args),
  sendLevelUp: (...args: unknown[]) => mockSendLevelUp(...args),
}));

describe("useCheckIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("チェックイン成功で訪問済み・XPモーダル・バッジキューが更新される", async () => {
    mockCreateVisit.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      place_id: "place_1",
      place_name: "テストカフェ",
      vicinity: "渋谷",
      category: "cafe",
      lat: 35.6,
      lng: 139.7,
      rating: null,
      memo: null,
      xp_earned: 100,
      is_breakout: false,
      visited_at: "2026-04-12T00:00:00Z",
      created_at: "2026-04-12T00:00:00Z",
      total_xp: 1000,
      is_level_up: true,
      new_level: 5,
      new_badges: [
        {
          id: 9,
          name: "Explorer",
          description: "desc",
          icon_url: "icon",
        },
      ],
      is_daily_completed: true,
      xp_breakdown: {
        base_xp: 50,
        first_area_bonus: 30,
        streak_bonus: 20,
      },
    });

    const onErrorToast = vi.fn();
    const initialPlaces = [
      {
        place_id: "place_1",
        name: "テストカフェ",
        vicinity: "渋谷",
        lat: 35.6,
        lng: 139.7,
        rating: 4.3,
        types: ["cafe"],
      },
    ];

    const { result } = renderHook(() => {
      const [places, setPlaces] = useState(initialPlaces);
      const [isCompleted, setIsCompleted] = useState(false);
      const checkIn = useCheckIn({
        authToken: "token",
        userPos: { lat: 35.6, lng: 139.7 },
        places,
        setPlaces,
        setIsCompleted,
        onErrorToast,
      });

      return { ...checkIn, places, isCompleted };
    });

    await act(async () => {
      await result.current.handleCheckIn();
    });

    expect(result.current.places).toHaveLength(0);
    expect(result.current.visitedIds.has("place_1")).toBe(true);
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.xpModalState?.xpEarned).toBe(100);
    expect(mockSendDailyCompleted).toHaveBeenCalledTimes(1);
    expect(mockSendLevelUp).toHaveBeenCalledWith(5);
    expect(mockSendBadgeEarned).toHaveBeenCalledWith("Explorer");

    act(() => {
      result.current.handleXpModalClose();
    });

    expect(result.current.badgeModalQueue).toHaveLength(1);
    expect(result.current.badgeModalQueue[0].name).toBe("Explorer");

    act(() => {
      result.current.handleBadgeModalClose();
    });

    expect(result.current.badgeModalQueue).toHaveLength(0);
  });

  test("429 エラー時は isCompleted を true に復元する", async () => {
    mockCreateVisit.mockRejectedValueOnce(new ApiError(429, "limit reached"));

    const onErrorToast = vi.fn();
    const initialPlaces = [
      {
        place_id: "place_1",
        name: "テストカフェ",
        vicinity: "渋谷",
        lat: 35.6,
        lng: 139.7,
        rating: 4.3,
        types: ["cafe"],
      },
    ];

    const { result } = renderHook(() => {
      const [places, setPlaces] = useState(initialPlaces);
      const [isCompleted, setIsCompleted] = useState(false);
      const checkIn = useCheckIn({
        authToken: "token",
        userPos: { lat: 35.6, lng: 139.7 },
        places,
        setPlaces,
        setIsCompleted,
        onErrorToast,
      });

      return { ...checkIn, isCompleted };
    });

    await act(async () => {
      await result.current.handleCheckIn();
    });

    expect(result.current.isCompleted).toBe(true);
    expect(onErrorToast).not.toHaveBeenCalled();
  });
});
