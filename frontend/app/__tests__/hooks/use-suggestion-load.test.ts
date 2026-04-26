import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSuggestionLoad } from "~/hooks/use-suggestion-load";

vi.mock("~/api/suggestions", () => ({
  getSuggestions: vi.fn().mockResolvedValue({
    places: [],
    is_completed: false,
    reload_count_remaining: 3,
  }),
}));

vi.mock("~/api/places", () => ({
  getPlacePhoto: vi.fn(),
}));

vi.mock("~/lib/gtag", () => ({
  sendSuggestionGenerated: vi.fn(),
  sendSuggestionReloaded: vi.fn(),
}));

const stubPlace = {
  place_id: "prepend_1",
  name: "テストカフェ",
  vicinity: "渋谷区",
  lat: 35.6762,
  lng: 139.6503,
  rating: 4.2,
  display_type: "カフェ",
  photoUrl: undefined,
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = "TestWrapper";
  return Wrapper;
}

describe("useSuggestionLoad - prependPlace", () => {
  const resolveCurrentPosition = vi
    .fn()
    .mockResolvedValue({ lat: 35.6762, lng: 139.6503 });
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("prependPlace を呼ぶと指定施設が places[0] に来る", async () => {
    const { result } = renderHook(
      () =>
        useSuggestionLoad({
          authToken: "token",
          resolveCurrentPosition,
          showToast,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.places).toHaveLength(0));

    act(() => {
      result.current.prependPlace(stubPlace);
    });

    expect(result.current.places[0]).toEqual(stubPlace);
  });

  test("既存3枚がある状態で prependPlace すると先頭に入り4枚になる", async () => {
    const existingPlaces = [
      { ...stubPlace, place_id: "existing_1", name: "店A" },
      { ...stubPlace, place_id: "existing_2", name: "店B" },
      { ...stubPlace, place_id: "existing_3", name: "店C" },
    ];

    const { result } = renderHook(
      () =>
        useSuggestionLoad({
          authToken: "token",
          resolveCurrentPosition,
          showToast,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.places).toHaveLength(0));

    act(() => {
      result.current.setPlaces(existingPlaces);
    });

    act(() => {
      result.current.prependPlace(stubPlace);
    });

    expect(result.current.places).toHaveLength(4);
    expect(result.current.places[0].place_id).toBe("prepend_1");
  });
});
