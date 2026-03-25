import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((url: string) => ({ url, _isRedirect: true })),
  };
});

vi.mock("~/lib/auth", () => ({
  getToken: vi.fn(),
  getUser: vi.fn(),
}));

describe("protectedLoader", () => {
  const mockToken = "test-token";
  const mockUser = {
    id: 1,
    email: "test@example.com",
    display_name: "テストユーザー",
    search_radius: 500,
    avatar_url: null,
    created_at: "2025-06-15T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("トークンがない場合は /login へリダイレクトする", async () => {
    const { getToken } = await import("~/lib/auth");
    vi.mocked(getToken).mockReturnValue(null);

    const { protectedLoader } = await import("~/lib/protected-loader");

    await expect(protectedLoader()).rejects.toMatchObject({ url: "/login" });
  });

  test("getUser が失敗した場合は /login へリダイレクトする", async () => {
    const { getToken, getUser } = await import("~/lib/auth");
    vi.mocked(getToken).mockReturnValue(mockToken);
    vi.mocked(getUser).mockRejectedValue(new Error("unauthorized"));

    const { protectedLoader } = await import("~/lib/protected-loader");

    await expect(protectedLoader()).rejects.toMatchObject({ url: "/login" });
  });

  test("トークンとユーザーが正常な場合は { user, token } を返す", async () => {
    const { getToken, getUser } = await import("~/lib/auth");
    vi.mocked(getToken).mockReturnValue(mockToken);
    vi.mocked(getUser).mockResolvedValue(mockUser);

    const { protectedLoader } = await import("~/lib/protected-loader");

    const result = await protectedLoader();
    expect(result).toEqual({ user: mockUser, token: mockToken });
  });
});
