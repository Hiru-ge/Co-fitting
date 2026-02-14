package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func noRedirectClient(mockServer *httptest.Server) *http.Client {
	client := mockServer.Client()
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}
	return client
}

func newTestPhotoHandler(mockServer *httptest.Server) *PlacePhotoHandler {
	return &PlacePhotoHandler{
		RedisClient: testRedisClient,
		APIKey:      "test-api-key",
		HTTPClient:  noRedirectClient(mockServer),
		BaseURL:     mockServer.URL,
	}
}

func setupPhotoRouter(handler *PlacePhotoHandler) *gin.Engine {
	r := gin.New()
	r.GET("/api/places/:placeId/photo", handler.GetPhoto)
	return r
}

func TestPlacePhoto(t *testing.T) {
	t.Run("photo_referenceなしで400エラー", func(t *testing.T) {
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("API should not be called")
		}))
		defer mockServer.Close()

		handler := newTestPhotoHandler(mockServer)
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/test_place/photo", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}

		var resp map[string]string
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["error"] != "photo_reference is required" {
			t.Errorf("Expected error message 'photo_reference is required', got '%s'", resp["error"])
		}
	})

	t.Run("有効なphoto_referenceでCDN URL返却", func(t *testing.T) {
		expectedCDNURL := "https://lh3.googleusercontent.com/places/test-photo-cdn"

		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Query().Get("photo_reference") != "test_ref_123" {
				t.Errorf("Expected photo_reference 'test_ref_123', got '%s'", r.URL.Query().Get("photo_reference"))
			}
			if r.URL.Query().Get("key") != "test-api-key" {
				t.Errorf("Expected key 'test-api-key', got '%s'", r.URL.Query().Get("key"))
			}
			w.Header().Set("Location", expectedCDNURL)
			w.WriteHeader(http.StatusFound)
		}))
		defer mockServer.Close()

		handler := &PlacePhotoHandler{
			RedisClient: nil,
			APIKey:      "test-api-key",
			HTTPClient:  noRedirectClient(mockServer),
			BaseURL:     mockServer.URL,
		}
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/test_place/photo?photo_reference=test_ref_123", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]string
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["photo_url"] != expectedCDNURL {
			t.Errorf("Expected photo_url '%s', got '%s'", expectedCDNURL, resp["photo_url"])
		}
	})

	t.Run("Google API障害時に500エラー", func(t *testing.T) {
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer mockServer.Close()

		handler := &PlacePhotoHandler{
			RedisClient: nil,
			APIKey:      "test-api-key",
			HTTPClient:  noRedirectClient(mockServer),
			BaseURL:     mockServer.URL,
		}
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/test_place/photo?photo_reference=bad_ref", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusInternalServerError, w.Code, w.Body.String())
		}
	})

	t.Run("キャッシュヒット時にRedisからURL返却", func(t *testing.T) {
		if testRedisClient == nil {
			t.Skip("Redis not available")
		}

		expectedCDNURL := "https://lh3.googleusercontent.com/places/cached-photo"
		placeID := "cached_place"
		cacheKey := fmt.Sprintf("photo:%s", placeID)

		ctx := context.Background()
		err := testRedisClient.Set(ctx, cacheKey, expectedCDNURL, 0).Err()
		if err != nil {
			t.Fatalf("Failed to set Redis cache: %v", err)
		}
		defer testRedisClient.Del(ctx, cacheKey)

		apiCalled := false
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiCalled = true
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer mockServer.Close()

		handler := newTestPhotoHandler(mockServer)
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", fmt.Sprintf("/api/places/%s/photo?photo_reference=any_ref", placeID), nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]string
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["photo_url"] != expectedCDNURL {
			t.Errorf("Expected photo_url '%s', got '%s'", expectedCDNURL, resp["photo_url"])
		}

		if apiCalled {
			t.Error("Google API should not be called when cache is hit")
		}
	})

	t.Run("maxWidthパラメータが正しく渡される", func(t *testing.T) {
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Query().Get("maxwidth") != "800" {
				t.Errorf("Expected maxwidth '800', got '%s'", r.URL.Query().Get("maxwidth"))
			}
			w.Header().Set("Location", "https://lh3.googleusercontent.com/places/test")
			w.WriteHeader(http.StatusFound)
		}))
		defer mockServer.Close()

		handler := &PlacePhotoHandler{
			RedisClient: nil,
			APIKey:      "test-api-key",
			HTTPClient:  noRedirectClient(mockServer),
			BaseURL:     mockServer.URL,
		}
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/test_place/photo?photo_reference=ref&maxWidth=800", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}
	})
}
