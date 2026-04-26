import { describe, test, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSuggestionLoad } from "~/hooks/use-suggestion-load";
import { ApiError } from "~/utils/error";

vi.mock("~/api/suggestions", () => ({
  getSuggestions: vi.fn(),
}));

vi.mock("~/api/places", () => ({
  getPlacePhoto: vi.fn(),
}));

vi.mock("~/lib/gtag", () => ({
  sendSuggestionGenerated: vi.fn(),
  sendSuggestionReloaded: vi.fn(),
}));

import { getSuggestions } from "~/api/suggestions";

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children,
  );
}

describe("use-suggestion-load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("NO_INTEREST_PLACESのnoticeでinfoトーストが表示される", async () => {
    const showToast = vi.fn();
    vi.mocked(getSuggestions).mockResolvedValueOnce({
      places: [
        {
          place_id: "p1",
          name: "テスト",
          vicinity: "渋谷",
          lat: 35.6,
          lng: 139.7,
          rating: 4,
        },
      ],
      notice: "NO_INTEREST_PLACES",
      reload_count_remaining: 3,
    } as never);

    const { result } = renderHook(
      () =>
        useSuggestionLoad({
          authToken: "token",
          resolveCurrentPosition: async () => ({ lat: 35.6, lng: 139.7 }),
          showToast,
        }),
      { wrapper },
    );

    await result.current.loadSuggestions();

    await waitFor(() => {
      expect(result.current.places.length).toBe(1);
      expect(showToast).toHaveBeenCalledWith(
        "興味ジャンルに合う施設が近くにありませんでした。半径を広げるか、興味ジャンルを見直してみてください",
        "info",
      );
    });
  });

  test("RELOAD_LIMIT_REACHEDでreloadCountRemaining=0とinfoトースト", async () => {
    const showToast = vi.fn();
    vi.mocked(getSuggestions)
      .mockResolvedValueOnce({
        places: [
          {
            place_id: "p1",
            name: "初回",
            vicinity: "渋谷",
            lat: 35.6,
            lng: 139.7,
            rating: 4,
          },
        ],
        reload_count_remaining: 1,
      } as never)
      .mockRejectedValueOnce(
        new ApiError(
          429,
          "今日のリロードは使い切りました。明日また使えます",
          "RELOAD_LIMIT_REACHED",
        ),
      );

    const { result } = renderHook(
      () =>
        useSuggestionLoad({
          authToken: "token",
          resolveCurrentPosition: async () => ({ lat: 35.6, lng: 139.7 }),
          showToast,
        }),
      { wrapper },
    );

    await result.current.loadSuggestions();
    await result.current.handleReload();

    await waitFor(() => {
      expect(result.current.reloadCountRemaining).toBe(0);
      expect(showToast).toHaveBeenCalledWith(
        "今日のリロードは使い切りました。明日また使えます",
        "info",
      );
    });
  });
});
