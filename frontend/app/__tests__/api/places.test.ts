import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPlacePhoto } from "~/api/places";
import { apiCall } from "~/api/client";

// apiCallをモック化
vi.mock("~/api/client");
const mockApiCall = vi.mocked(apiCall);

describe("places API", () => {
  const mockToken = "test-token";
  const mockPlaceId = "place123";
  const mockPhotoReference = "photo_ref_123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPlacePhoto", () => {
    it("should call apiCall with correct parameters", async () => {
      const expectedPhotoUrl = "https://example.com/photo.jpg";
      mockApiCall.mockResolvedValue({ photo_url: expectedPhotoUrl });

      const result = await getPlacePhoto(
        mockToken,
        mockPlaceId,
        mockPhotoReference,
      );

      expect(mockApiCall).toHaveBeenCalledWith(
        `/api/places/${mockPlaceId}/photo?photo_reference=${mockPhotoReference}`,
        mockToken,
      );
      expect(result).toBe(expectedPhotoUrl);
    });

    it("should encode photo_reference parameter properly", async () => {
      const specialPhotoRef = "photo_ref_with spaces & symbols";
      // URLSearchParamsは空白を+でエンコードする
      const expectedPhotoRef = "photo_ref_with+spaces+%26+symbols";
      const expectedPhotoUrl = "https://example.com/photo.jpg";

      mockApiCall.mockResolvedValue({ photo_url: expectedPhotoUrl });

      await getPlacePhoto(mockToken, mockPlaceId, specialPhotoRef);

      expect(mockApiCall).toHaveBeenCalledWith(
        `/api/places/${mockPlaceId}/photo?photo_reference=${expectedPhotoRef}`,
        mockToken,
      );
    });

    it("should return photo_url from apiCall response", async () => {
      const expectedPhotoUrl = "https://example.com/test-photo.jpg";
      mockApiCall.mockResolvedValue({ photo_url: expectedPhotoUrl });

      const result = await getPlacePhoto(
        mockToken,
        mockPlaceId,
        mockPhotoReference,
      );

      expect(result).toBe(expectedPhotoUrl);
    });

    it("should handle empty photo_reference (no query param)", async () => {
      const expectedPhotoUrl = "https://example.com/default.jpg";
      mockApiCall.mockResolvedValue({ photo_url: expectedPhotoUrl });

      // 空文字列は undefined と同様にクエリパラメータなしで呼ばれる
      await getPlacePhoto(mockToken, mockPlaceId, "");

      expect(mockApiCall).toHaveBeenCalledWith(
        `/api/places/${mockPlaceId}/photo`,
        mockToken,
      );
    });

    it("should omit photo_reference when not provided", async () => {
      const expectedPhotoUrl = "https://example.com/default.jpg";
      mockApiCall.mockResolvedValue({ photo_url: expectedPhotoUrl });

      await getPlacePhoto(mockToken, mockPlaceId);

      expect(mockApiCall).toHaveBeenCalledWith(
        `/api/places/${mockPlaceId}/photo`,
        mockToken,
      );
    });

    it("should handle special characters in placeId", async () => {
      const specialPlaceId = "place-123_abc";
      const expectedPhotoUrl = "https://example.com/photo.jpg";
      mockApiCall.mockResolvedValue({ photo_url: expectedPhotoUrl });

      await getPlacePhoto(mockToken, specialPlaceId, mockPhotoReference);

      expect(mockApiCall).toHaveBeenCalledWith(
        `/api/places/${specialPlaceId}/photo?photo_reference=${mockPhotoReference}`,
        mockToken,
      );
    });

    it("should propagate apiCall errors", async () => {
      const apiError = new Error("Network error");
      mockApiCall.mockRejectedValue(apiError);

      await expect(
        getPlacePhoto(mockToken, mockPlaceId, mockPhotoReference),
      ).rejects.toThrow("Network error");
    });

    it("should handle different photo_url formats", async () => {
      const formats = [
        "https://example.com/photo.jpg",
        "http://example.com/photo.png",
        "/api/static/photo123.jpg",
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
      ];

      for (const photoUrl of formats) {
        mockApiCall.mockResolvedValue({ photo_url: photoUrl });
        const result = await getPlacePhoto(
          mockToken,
          mockPlaceId,
          mockPhotoReference,
        );
        expect(result).toBe(photoUrl);
      }
    });

    it("should handle null or undefined photo_url", async () => {
      // null が返された場合
      mockApiCall.mockResolvedValue({ photo_url: null });
      let result = await getPlacePhoto(
        mockToken,
        mockPlaceId,
        mockPhotoReference,
      );
      expect(result).toBeNull();

      // undefined が返された場合
      mockApiCall.mockResolvedValue({ photo_url: undefined });
      result = await getPlacePhoto(mockToken, mockPlaceId, mockPhotoReference);
      expect(result).toBeUndefined();
    });

    it("should work with different token formats", async () => {
      const tokenFormats = [
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "simple-token-123",
        "",
      ];
      const expectedPhotoUrl = "https://example.com/photo.jpg";
      mockApiCall.mockResolvedValue({ photo_url: expectedPhotoUrl });

      for (const token of tokenFormats) {
        await getPlacePhoto(token, mockPlaceId, mockPhotoReference);
        expect(mockApiCall).toHaveBeenCalledWith(
          `/api/places/${mockPlaceId}/photo?photo_reference=${mockPhotoReference}`,
          token,
        );
      }
    });

    it("should construct URL correctly with complex parameters", async () => {
      const complexPlaceId = "ChIJ_____complex_place_id_123";
      const complexPhotoRef = "photo_ref_with/special%chars&symbols=test";
      const expectedPhotoUrl = "https://example.com/photo.jpg";

      mockApiCall.mockResolvedValue({ photo_url: expectedPhotoUrl });

      await getPlacePhoto(mockToken, complexPlaceId, complexPhotoRef);

      // URLSearchParams が正しくエンコードすることを確認
      const expectedUrl = `/api/places/${complexPlaceId}/photo?photo_reference=${encodeURIComponent(complexPhotoRef)}`;
      expect(mockApiCall).toHaveBeenCalledWith(expectedUrl, mockToken);
    });
  });
});
