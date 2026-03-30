package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type rewriteTransport struct {
	target *url.URL
	base   http.RoundTripper
}

func (t *rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	rewritten := req.Clone(req.Context())
	rewritten.URL.Scheme = t.target.Scheme
	rewritten.URL.Host = t.target.Host
	rewritten.Host = t.target.Host
	return t.base.RoundTrip(rewritten)
}

func useMockPlacesAPI(t *testing.T, mockServer *httptest.Server) {
	t.Helper()

	target, err := url.Parse(mockServer.URL)
	if err != nil {
		t.Fatalf("failed to parse mock server URL: %v", err)
	}

	prev := http.DefaultTransport
	http.DefaultTransport = &rewriteTransport{
		target: target,
		base:   mockServer.Client().Transport,
	}

	t.Cleanup(func() {
		http.DefaultTransport = prev
	})
}

func setupPhotoRouter(handler *PlacePhotoHandler) *gin.Engine {
	r := gin.New()
	r.GET("/api/places/:placeId/photo", handler.GetPhoto)
	return r
}

func TestPlacePhoto(t *testing.T) {
	t.Run("photo_referenceなし・キャッシュなしで404エラー", func(t *testing.T) {
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("API should not be called")
		}))
		defer mockServer.Close()
		useMockPlacesAPI(t, mockServer)

		handler := &PlacePhotoHandler{
			RedisClient: nil,
			APIKey:      "test-api-key",
		}
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/test_place/photo", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}

		var resp map[string]string
		json.Unmarshal(w.Body.Bytes(), &resp) //nolint:errcheck //nolint:errcheck
		if resp["error"] != "no cached photo found" {
			t.Errorf("Expected error message 'no cached photo found', got '%s'", resp["error"])
		}
	})

	t.Run("有効なphoto_referenceでCDN URL返却", func(t *testing.T) {
		expectedCDNURL := "https://lh3.googleusercontent.com/places/test-photo-cdn"

		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.HasPrefix(r.URL.Path, "/v1/places/test_place/photos/test_ref_123/media") {
				t.Errorf("unexpected path: %s", r.URL.Path)
			}
			if r.URL.Query().Get("key") != "test-api-key" {
				t.Errorf("Expected key 'test-api-key', got '%s'", r.URL.Query().Get("key"))
			}
			w.Header().Set("Location", expectedCDNURL)
			w.WriteHeader(http.StatusFound)
		}))
		defer mockServer.Close()
		useMockPlacesAPI(t, mockServer)

		handler := &PlacePhotoHandler{
			RedisClient: nil,
			APIKey:      "test-api-key",
		}
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/test_place/photo?photo_reference=places%2Ftest_place%2Fphotos%2Ftest_ref_123", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]string
		json.Unmarshal(w.Body.Bytes(), &resp) //nolint:errcheck
		if resp["photo_url"] != expectedCDNURL {
			t.Errorf("Expected photo_url '%s', got '%s'", expectedCDNURL, resp["photo_url"])
		}
	})

	t.Run("Google API障害時に500エラー", func(t *testing.T) {
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer mockServer.Close()
		useMockPlacesAPI(t, mockServer)

		handler := &PlacePhotoHandler{
			RedisClient: nil,
			APIKey:      "test-api-key",
		}
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/test_place/photo?photo_reference=places%2Fbad_place%2Fphotos%2Fbad_ref", nil)
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
		useMockPlacesAPI(t, mockServer)

		handler := &PlacePhotoHandler{RedisClient: testRedisClient, APIKey: "test-api-key"}
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", fmt.Sprintf("/api/places/%s/photo?photo_reference=any_ref", placeID), nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]string
		json.Unmarshal(w.Body.Bytes(), &resp) //nolint:errcheck
		if resp["photo_url"] != expectedCDNURL {
			t.Errorf("Expected photo_url '%s', got '%s'", expectedCDNURL, resp["photo_url"])
		}

		if apiCalled {
			t.Error("Google API should not be called when cache is hit")
		}
	})

	t.Run("photo_referenceなし・キャッシュヒット時に200返却", func(t *testing.T) {
		if testRedisClient == nil {
			t.Skip("Redis not available")
		}

		expectedCDNURL := "https://lh3.googleusercontent.com/places/fallback-cached-photo"
		placeID := "fallback_cache_place"
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
		useMockPlacesAPI(t, mockServer)

		handler := &PlacePhotoHandler{RedisClient: testRedisClient, APIKey: "test-api-key"}
		router := setupPhotoRouter(handler)

		// photo_referenceを指定しない
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", fmt.Sprintf("/api/places/%s/photo", placeID), nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]string
		json.Unmarshal(w.Body.Bytes(), &resp) //nolint:errcheck
		if resp["photo_url"] != expectedCDNURL {
			t.Errorf("Expected photo_url '%s', got '%s'", expectedCDNURL, resp["photo_url"])
		}

		if apiCalled {
			t.Error("Google API should not be called when cache is hit (even without photo_reference)")
		}
	})

	t.Run("maxWidthパラメータが正しく渡される", func(t *testing.T) {
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Query().Get("maxWidthPx") != "800" {
				t.Errorf("Expected maxWidthPx '800', got '%s'", r.URL.Query().Get("maxWidthPx"))
			}
			w.Header().Set("Location", "https://lh3.googleusercontent.com/places/test")
			w.WriteHeader(http.StatusFound)
		}))
		defer mockServer.Close()
		useMockPlacesAPI(t, mockServer)

		handler := &PlacePhotoHandler{
			RedisClient: nil,
			APIKey:      "test-api-key",
		}
		router := setupPhotoRouter(handler)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/test_place/photo?photo_reference=places%2Ftest_place%2Fphotos%2Fref&maxWidth=800", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}
	})
}
