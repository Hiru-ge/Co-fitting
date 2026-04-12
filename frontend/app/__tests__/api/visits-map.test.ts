import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMapVisits } from "~/api/visits";
import { apiCall } from "~/api/client";
import type { MapVisitResponse } from "~/types/visit";

vi.mock("~/api/client");
const mockApiCall = vi.mocked(apiCall);

describe("getMapVisits", () => {
  const mockToken = "test-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正しいエンドポイントへリクエストする", async () => {
    const mockResponse: MapVisitResponse = { visits: [], total: 0 };
    mockApiCall.mockResolvedValue(mockResponse);

    await getMapVisits(mockToken);

    expect(mockApiCall).toHaveBeenCalledWith("/api/visits/map", mockToken);
  });

  it("訪問データとtotalを返す", async () => {
    const mockResponse: MapVisitResponse = {
      visits: [
        {
          id: 1,
          place_id: "ChIJabc",
          place_name: "カフェA",
          lat: 35.6762,
          lng: 139.6503,
          category: "cafe",
          visited_at: "2024-02-10T12:00:00Z",
        },
      ],
      total: 1,
    };
    mockApiCall.mockResolvedValue(mockResponse);

    const result = await getMapVisits(mockToken);

    expect(result.visits).toHaveLength(1);
    expect(result.visits[0].place_name).toBe("カフェA");
    expect(result.total).toBe(1);
  });

  it("訪問記録なしの場合は空配列を返す", async () => {
    const mockResponse: MapVisitResponse = { visits: [], total: 0 };
    mockApiCall.mockResolvedValue(mockResponse);

    const result = await getMapVisits(mockToken);

    expect(result.visits).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("APIエラー時は例外を投げる", async () => {
    mockApiCall.mockRejectedValue(new Error("Unauthorized"));

    await expect(getMapVisits(mockToken)).rejects.toThrow("Unauthorized");
  });
});
