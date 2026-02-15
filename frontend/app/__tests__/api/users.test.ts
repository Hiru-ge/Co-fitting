import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateDisplayName, changePassword } from "~/api/users";
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

      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/users/me",
        mockToken,
        {
          method: "PATCH",
          body: JSON.stringify({ display_name: newDisplayName }),
        }
      );
      expect(result).toEqual(mockUser);
    });

    it("should handle empty display name", async () => {
      const emptyDisplayName = "";
      mockApiCall.mockResolvedValue({ ...mockUser, display_name: emptyDisplayName });

      const result = await updateDisplayName(mockToken, emptyDisplayName);

      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/users/me",
        mockToken,
        {
          method: "PATCH",
          body: JSON.stringify({ display_name: emptyDisplayName }),
        }
      );
      expect(result.display_name).toBe(emptyDisplayName);
    });

    it("should handle special characters in display name", async () => {
      const specialDisplayName = "名前 with émojis 😀, symbols & numbers 123!";
      const updatedUser = { ...mockUser, display_name: specialDisplayName };
      mockApiCall.mockResolvedValue(updatedUser);

      const result = await updateDisplayName(mockToken, specialDisplayName);

      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/users/me",
        mockToken,
        {
          method: "PATCH",
          body: JSON.stringify({ display_name: specialDisplayName }),
        }
      );
      expect(result.display_name).toBe(specialDisplayName);
    });

    it("should handle long display names", async () => {
      const longDisplayName = "A".repeat(255);
      const updatedUser = { ...mockUser, displayName: longDisplayName };
      mockApiCall.mockResolvedValue(updatedUser);

      await updateDisplayName(mockToken, longDisplayName);

      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/users/me",
        mockToken,
        {
          method: "PATCH",
          body: JSON.stringify({ display_name: longDisplayName }),
        }
      );
    });

    it("should propagate apiCall errors", async () => {
      const apiError = new Error("Server error");
      mockApiCall.mockRejectedValue(apiError);

      await expect(updateDisplayName(mockToken, "Test Name")).rejects.toThrow("Server error");
    });

    it("should return user object from response", async () => {
      const expectedUser: User = {
        id: 456,
        email: "updated@example.com",
        display_name: "Updated Name",
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
        expect(mockApiCall).toHaveBeenCalledWith(
          "/api/users/me",
          token,
          {
            method: "PATCH",
            body: JSON.stringify({ display_name: "Test Name" }),
          }
        );
      }
    });

    it("should properly serialize JSON body", async () => {
      const displayName = 'Test "Name" with quotes';
      mockApiCall.mockResolvedValue(mockUser);

      await updateDisplayName(mockToken, displayName);

      const expectedBody = JSON.stringify({ display_name: displayName });
      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/users/me",
        mockToken,
        {
          method: "PATCH",
          body: expectedBody,
        }
      );
      
      // JSON.stringifyが適切にエスケープしていることを確認
      expect(expectedBody).toContain('\\"Name\\"');
    });
  });

  describe("changePassword", () => {
    const currentPassword = "oldPassword123";
    const newPassword = "newPassword456";
    const mockResponse = { message: "Password changed successfully" };

    it("should call apiCall with correct parameters", async () => {
      mockApiCall.mockResolvedValue(mockResponse);

      const result = await changePassword(mockToken, currentPassword, newPassword);

      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/auth/change-password",
        mockToken,
        {
          method: "POST",
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle empty passwords", async () => {
      mockApiCall.mockResolvedValue(mockResponse);

      await changePassword(mockToken, "", "");

      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/auth/change-password",
        mockToken,
        {
          method: "POST",
          body: JSON.stringify({
            current_password: "",
            new_password: "",
          }),
        }
      );
    });

    it("should handle complex passwords with special characters", async () => {
      const complexCurrentPassword = "P@ssw0rd!$pecial#2023";
      const complexNewPassword = "N3w&Str0ng€P@ssw0rd%2024";
      mockApiCall.mockResolvedValue(mockResponse);

      await changePassword(mockToken, complexCurrentPassword, complexNewPassword);

      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/auth/change-password",
        mockToken,
        {
          method: "POST",
          body: JSON.stringify({
            current_password: complexCurrentPassword,
            new_password: complexNewPassword,
          }),
        }
      );
    });

    it("should handle very long passwords", async () => {
      const longPassword = "a".repeat(72); // bcryptの上限
      mockApiCall.mockResolvedValue(mockResponse);

      await changePassword(mockToken, longPassword, longPassword + "new");

      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/auth/change-password",
        mockToken,
        {
          method: "POST",
          body: JSON.stringify({
            current_password: longPassword,
            new_password: longPassword + "new",
          }),
        }
      );
    });

    it("should propagate apiCall errors for wrong current password", async () => {
      const wrongPasswordError = new Error("Current password is incorrect");
      mockApiCall.mockRejectedValue(wrongPasswordError);

      await expect(changePassword(mockToken, "wrongPassword", newPassword))
        .rejects.toThrow("Current password is incorrect");
    });

    it("should propagate apiCall errors for validation failures", async () => {
      const validationError = new Error("New password does not meet requirements");
      mockApiCall.mockRejectedValue(validationError);

      await expect(changePassword(mockToken, currentPassword, "weak"))
        .rejects.toThrow("New password does not meet requirements");
    });

    it("should return message from response", async () => {
      const customResponse = { message: "パスワードが正常に変更されました" };
      mockApiCall.mockResolvedValue(customResponse);

      const result = await changePassword(mockToken, currentPassword, newPassword);

      expect(result).toEqual(customResponse);
      expect(result.message).toBe("パスワードが正常に変更されました");
    });

    it("should handle different response formats", async () => {
      const responses = [
        { message: "Success" },
        { message: "Password updated", success: true },
        { message: "" },
      ];

      for (const response of responses) {
        mockApiCall.mockResolvedValue(response);
        const result = await changePassword(mockToken, currentPassword, newPassword);
        expect(result).toEqual(response);
      }
    });

    it("should properly serialize JSON body with passwords", async () => {
      const passwordWithQuotes = 'password"with"quotes';
      const passwordWithBackslash = 'password\\with\\backslash';
      mockApiCall.mockResolvedValue(mockResponse);

      await changePassword(mockToken, passwordWithQuotes, passwordWithBackslash);

      const expectedBody = JSON.stringify({
        current_password: passwordWithQuotes,
        new_password: passwordWithBackslash,
      });
      
      expect(mockApiCall).toHaveBeenCalledWith(
        "/api/auth/change-password",
        mockToken,
        {
          method: "POST",
          body: expectedBody,
        }
      );

      // 適切にエスケープされていることを確認
      expect(expectedBody).toContain('\\"with\\"');
      expect(expectedBody).toContain('\\\\with\\\\');
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network connection failed");
      mockApiCall.mockRejectedValue(networkError);

      await expect(changePassword(mockToken, currentPassword, newPassword))
        .rejects.toThrow("Network connection failed");
    });

    it("should work with different token formats", async () => {
      const tokenFormats = [
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "simple-token-123",
        "",
      ];
      mockApiCall.mockResolvedValue(mockResponse);

      for (const token of tokenFormats) {
        await changePassword(token, currentPassword, newPassword);
        expect(mockApiCall).toHaveBeenCalledWith(
          "/api/auth/change-password",
          token,
          {
            method: "POST",
            body: JSON.stringify({
              current_password: currentPassword,
              new_password: newPassword,
            }),
          }
        );
      }
    });
  });
});