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
      }),
    );
  });

  test("レスポンスが ok でない場合 ApiError を throw する", async () => {
    const { apiCall } = await import("~/api/client");
    const { ApiError } = await import("~/utils/error");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal Server Error" }),
    });

    // localStorage モック（401 リフレッシュに影響しないようにする）
    const storageMock: Record<string, string> = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => storageMock[key] ?? null,
    );

    await expect(apiCall("/api/test", "token")).rejects.toThrow(ApiError);
    await expect(apiCall("/api/test", "token")).rejects.toThrow(
      "サーバーエラー",
    );
  });

  test("401 でリフレッシュ失敗時に access_token と refresh_token の両方が削除される（clearToken 相当）", async () => {
    const { apiCall } = await import("~/api/client");
    const { ApiError } = await import("~/utils/error");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "" },
      writable: true,
      configurable: true,
    });

    await expect(apiCall("/api/test", "token")).rejects.toThrow(ApiError);
    // clearToken() は roamble_token と roamble_refresh_token の両方を削除する
    expect(mockStorage.removeItem).toHaveBeenCalledWith("roamble_token");
    expect(mockStorage.removeItem).toHaveBeenCalledWith(
      "roamble_refresh_token",
    );

    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  test("401 レスポンスでリフレッシュトークンがなければトークンクリアされる", async () => {
    const { apiCall } = await import("~/api/client");
    const { ApiError } = await import("~/utils/error");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    // localStorage モック
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    // window.location.href への代入をモック
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "" },
      writable: true,
      configurable: true,
    });

    await expect(apiCall("/api/test", "token")).rejects.toThrow(ApiError);
    expect(mockStorage.removeItem).toHaveBeenCalledWith("roamble_token");

    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
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
      }),
    );
    expect(result).toEqual([{ place_id: "p1", name: "テストカフェ" }]);
  });

  test("getSuggestions に isReload を指定できる", async () => {
    const { getSuggestions } = await import("~/api/suggestions");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await getSuggestions("my-token", 35.6762, 139.6503, true);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/suggestions",
      expect.objectContaining({
        body: JSON.stringify({ lat: 35.6762, lng: 139.6503, is_reload: true }),
      }),
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
      category: "cafe",
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
      }),
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
      }),
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
      expect.anything(),
    );
  });
});
