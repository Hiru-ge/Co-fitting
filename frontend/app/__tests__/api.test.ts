import { describe, test, expect, beforeEach, vi } from "vitest";

describe("apiCall", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("正しいヘッダーとURLで fetch が呼ばれる", async () => {
    const { apiCall } = await import("~/api/client");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "test" }),
    });

    await apiCall("/api/test", "my-token");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer my-token",
        }),
      })
    );
  });

  test("レスポンスが ok でない場合エラーを throw する", async () => {
    const { apiCall } = await import("~/api/client");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(apiCall("/api/test", "token")).rejects.toThrow("API Error: 500");
  });
});

describe("suggestions API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("getSuggestions が正しいパラメータで POST する", async () => {
    const { getSuggestions } = await import("~/api/suggestions");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ place_id: "p1", name: "テストカフェ" }]),
    });

    const result = await getSuggestions("my-token", 35.6762, 139.6503);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/suggestions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ lat: 35.6762, lng: 139.6503 }),
      })
    );
    expect(result).toEqual([{ place_id: "p1", name: "テストカフェ" }]);
  });

  test("getSuggestions に radius を指定できる", async () => {
    const { getSuggestions } = await import("~/api/suggestions");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await getSuggestions("my-token", 35.6762, 139.6503, 5000);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/suggestions",
      expect.objectContaining({
        body: JSON.stringify({ lat: 35.6762, lng: 139.6503, radius: 5000 }),
      })
    );
  });
});

describe("visits API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("createVisit が POST で訪問データを送信する", async () => {
    const { createVisit } = await import("~/api/visits");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    });

    const visitData = {
      place_id: "ChIJ...",
      place_name: "テストカフェ",
      lat: 35.6762,
      lng: 139.6503,
      visited_at: "2024-02-15T10:00:00Z",
    };
    const result = await createVisit("my-token", visitData);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/visits",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(visitData),
      })
    );
    expect(result).toEqual({ id: 1 });
  });

  test("listVisits が GET でページネーション付きで取得する", async () => {
    const { listVisits } = await import("~/api/visits");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ visits: [] }),
    });

    await listVisits("my-token", 10, 20);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/visits?limit=10&offset=20",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-token",
        }),
      })
    );
  });

  test("listVisits のデフォルト値が limit=20, offset=0", async () => {
    const { listVisits } = await import("~/api/visits");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ visits: [] }),
    });

    await listVisits("my-token");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/visits?limit=20&offset=0",
      expect.anything()
    );
  });
});
