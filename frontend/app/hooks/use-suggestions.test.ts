import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());
const mockSetPlaces = vi.hoisted(() => vi.fn());
const mockLoadSuggestions = vi.hoisted(() => vi.fn());
const mockHandleUseDefaultLocation = vi.hoisted(() => vi.fn());
const mockCloseLocationDeniedModal = vi.hoisted(() => vi.fn());
const mockSendSuggestionSkipped = vi.hoisted(() => vi.fn());
const mockSendSuggestionViewed = vi.hoisted(() => vi.fn());

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("~/components/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("~/lib/gtag", () => ({
  sendSuggestionSkipped: (...args: unknown[]) =>
    mockSendSuggestionSkipped(...args),
  sendSuggestionViewed: (...args: unknown[]) =>
    mockSendSuggestionViewed(...args),
}));

vi.mock("~/lib/geolocation", () => ({
  isWithinCheckInRange: vi.fn().mockReturnValue(false),
}));

vi.mock("~/hooks/use-location", () => ({
  useLocation: () => ({
    userPos: { lat: 35.6, lng: 139.7 },
    showLocationDeniedModal: false,
    isUsingDefaultLocation: false,
    resolveCurrentPosition: vi.fn(),
    handleUseDefaultLocation: mockHandleUseDefaultLocation,
    closeLocationDeniedModal: mockCloseLocationDeniedModal,
  }),
}));

vi.mock("~/hooks/use-suggestion-load", () => ({
  useSuggestionLoad: () => ({
    places: [
      {
        place_id: "p1",
        name: "カフェ",
        vicinity: "渋谷",
        lat: 35.6,
        lng: 139.7,
        rating: 4,
        is_interest_match: true,
        is_breakout: false,
      },
      {
        place_id: "p2",
        name: "ボウリング",
        vicinity: "渋谷",
        lat: 35.61,
        lng: 139.71,
        rating: 4,
        is_interest_match: false,
        is_breakout: true,
      },
    ],
    setPlaces: mockSetPlaces,
    isLoading: false,
    error: null,
    isCompleted: false,
    reloadCountRemaining: 3,
    isReloading: false,
    originalCardOrder: ["p1", "p2"],
    loadSuggestions: mockLoadSuggestions,
    handleReload: vi.fn(),
    setIsCompleted: vi.fn(),
  }),
}));

vi.mock("~/hooks/use-check-in", () => ({
  useCheckIn: () => ({
    visitedIds: new Set<string>(),
    isCheckingIn: false,
    xpModalState: null,
    badgeModalQueue: [],
    handleCheckIn: vi.fn(),
    handleXpModalClose: vi.fn(),
    handleBadgeModalClose: vi.fn(),
  }),
}));

import { useSuggestions } from "~/hooks/use-suggestions";

describe("use-suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("handleUseDefaultLocationはdefault反映後に再ロードする", async () => {
    const { result } = renderHook(() => useSuggestions("token"));

    await result.current.handleUseDefaultLocation();

    expect(mockHandleUseDefaultLocation).toHaveBeenCalled();
    expect(mockLoadSuggestions).toHaveBeenCalled();
  });

  test("handleGoToSettingsはモーダルを閉じて/settingsに遷移", () => {
    const { result } = renderHook(() => useSuggestions("token"));

    result.current.handleGoToSettings();

    expect(mockCloseLocationDeniedModal).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/settings");
  });

  test("handleSwipeはskipped/viewedイベント送信とsetPlacesを行う", () => {
    const { result } = renderHook(() => useSuggestions("token"));

    result.current.handleSwipe();

    expect(mockSendSuggestionSkipped).toHaveBeenCalled();
    expect(mockSetPlaces).toHaveBeenCalled();
  });
});
