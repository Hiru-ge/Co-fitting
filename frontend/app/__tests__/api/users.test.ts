import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateDisplayName } from "~/api/users";
import { apiCall } from "~/api/client";
import type { User } from "~/types/auth";

// apiCallをモック化
vi.mock("~/api/client");
const mockApiCall = vi.mocked(apiCall);

describe("users API", () => {
  const mockToken = "test-token";
  const mockUser: User = {
    id: 123,
    email: "test@example.com",
    display_name: "Updated User",
    search_radius: 500,
    enable_adult_venues: true,
    avatar_url: null,
    created_at: "2026-02-15T10:00:00Z",
    updated_at: "2026-02-15T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateDisplayName", () => {
    it("should call apiCall with correct parameters", async () => {
      const newDisplayName = "New Display Name";
      mockApiCall.mockResolvedValue(mockUser);

      const result = await updateDisplayName(mockToken, newDisplayName);

      expect(mockApiCall).toHaveBeenCalledWith("/api/users/me", mockToken, {
        method: "PATCH",
        body: JSON.stringify({ display_name: newDisplayName }),
      });
      expect(result).toEqual(mockUser);
    });

    it("should handle empty display name", async () => {
      const emptyDisplayName = "";
      mockApiCall.mockResolvedValue({
        ...mockUser,
        display_name: emptyDisplayName,
      });

      const result = await updateDisplayName(mockToken, emptyDisplayName);

      expect(mockApiCall).toHaveBeenCalledWith("/api/users/me", mockToken, {
        method: "PATCH",
        body: JSON.stringify({ display_name: emptyDisplayName }),
      });
      expect(result.display_name).toBe(emptyDisplayName);
    });

    it("should handle special characters in display name", async () => {
      const specialDisplayName = "名前 with émojis 😀, symbols & numbers 123!";
      const updatedUser = { ...mockUser, display_name: specialDisplayName };
      mockApiCall.mockResolvedValue(updatedUser);

      const result = await updateDisplayName(mockToken, specialDisplayName);

      expect(mockApiCall).toHaveBeenCalledWith("/api/users/me", mockToken, {
        method: "PATCH",
        body: JSON.stringify({ display_name: specialDisplayName }),
      });
      expect(result.display_name).toBe(specialDisplayName);
    });

    it("should handle long display names", async () => {
      const longDisplayName = "A".repeat(255);
      const updatedUser = { ...mockUser, displayName: longDisplayName };
      mockApiCall.mockResolvedValue(updatedUser);

      await updateDisplayName(mockToken, longDisplayName);

      expect(mockApiCall).toHaveBeenCalledWith("/api/users/me", mockToken, {
        method: "PATCH",
        body: JSON.stringify({ display_name: longDisplayName }),
      });
    });

    it("should propagate apiCall errors", async () => {
      const apiError = new Error("Server error");
      mockApiCall.mockRejectedValue(apiError);

      await expect(updateDisplayName(mockToken, "Test Name")).rejects.toThrow(
        "Server error",
      );
    });

    it("should return user object from response", async () => {
      const expectedUser: User = {
        id: 456,
        email: "updated@example.com",
        display_name: "Updated Name",
        search_radius: 500,
        enable_adult_venues: true,
        avatar_url: null,
        created_at: "2026-02-15T10:00:00Z",
        updated_at: "2026-02-15T10:00:00Z",
      };
      mockApiCall.mockResolvedValue(expectedUser);

      const result = await updateDisplayName(mockToken, "Updated Name");

      expect(result).toEqual(expectedUser);
      expect(result.id).toBe(456);
      expect(result.email).toBe("updated@example.com");
      expect(result.display_name).toBe("Updated Name");
    });

    it("should handle different token formats", async () => {
      const tokenFormats = [
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "simple-token-123",
        "",
      ];
      mockApiCall.mockResolvedValue(mockUser);

      for (const token of tokenFormats) {
        await updateDisplayName(token, "Test Name");
        expect(mockApiCall).toHaveBeenCalledWith("/api/users/me", token, {
          method: "PATCH",
          body: JSON.stringify({ display_name: "Test Name" }),
        });
      }
    });

    it("should properly serialize JSON body", async () => {
      const displayName = 'Test "Name" with quotes';
      mockApiCall.mockResolvedValue(mockUser);

      await updateDisplayName(mockToken, displayName);

      const expectedBody = JSON.stringify({ display_name: displayName });
      expect(mockApiCall).toHaveBeenCalledWith("/api/users/me", mockToken, {
        method: "PATCH",
        body: expectedBody,
      });

      // JSON.stringifyが適切にエスケープしていることを確認
      expect(expectedBody).toContain('\\"Name\\"');
    });
  });
});
