package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func setupDevRouter(environment string) *gin.Engine {
	handler := &DevHandler{
		RedisClient: testRedisClient,
	}

	r := gin.New()
	if environment == "development" {
		r.DELETE("/api/dev/suggestions/cache", handler.ResetSuggestionCache)
		r.GET("/api/dev/suggestions/stats", handler.GetSuggestionStats)
	}
	return r
}

func cleanupSuggestionCache(t *testing.T) {
	t.Helper()
	if testRedisClient == nil {
		t.Skip("Redis not available")
	}
	ctx := context.Background()
	var cursor uint64
	for {
		keys, nextCursor, err := testRedisClient.Scan(ctx, cursor, "suggestions:*", 100).Result()
		if err != nil {
			break
		}
		if len(keys) > 0 {
			testRedisClient.Del(ctx, keys...)
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
}

func TestDevResetSuggestionCache(t *testing.T) {
	if testRedisClient == nil {
		t.Skip("Redis not available")
	}

	t.Run("キャッシュキーが削除される", func(t *testing.T) {
		cleanupSuggestionCache(t)

		ctx := context.Background()
		testRedisClient.Set(ctx, "suggestions:35.6762:139.6503:3000", `[{"place_id":"p1"}]`, 24*time.Hour)
		testRedisClient.Set(ctx, "suggestions:35.6800:139.7000:1000", `[{"place_id":"p2"}]`, 24*time.Hour)

		router := setupDevRouter("development")
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/dev/suggestions/cache", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		deletedCount := int(resp["deleted_count"].(float64))
		if deletedCount != 2 {
			t.Errorf("Expected deleted_count 2, got %d", deletedCount)
		}

		// キーが実際に削除されたことを確認
		keys, _, _ := testRedisClient.Scan(ctx, 0, "suggestions:*", 100).Result()
		if len(keys) != 0 {
			t.Errorf("Expected 0 remaining keys, got %d", len(keys))
		}
	})

	t.Run("キャッシュが空でもエラーにならない", func(t *testing.T) {
		cleanupSuggestionCache(t)

		router := setupDevRouter("development")
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/dev/suggestions/cache", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		deletedCount := int(resp["deleted_count"].(float64))
		if deletedCount != 0 {
			t.Errorf("Expected deleted_count 0, got %d", deletedCount)
		}
	})
}

func TestDevGetSuggestionStats(t *testing.T) {
	if testRedisClient == nil {
		t.Skip("Redis not available")
	}

	t.Run("統計情報が正しいフォーマットで返却される", func(t *testing.T) {
		cleanupSuggestionCache(t)

		ctx := context.Background()
		testRedisClient.Set(ctx, "suggestions:35.6762:139.6503:3000", `[{"place_id":"p1"}]`, 24*time.Hour)

		router := setupDevRouter("development")
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/dev/suggestions/stats", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp cacheStatsResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp.KeyCount != 1 {
			t.Errorf("Expected key_count 1, got %d", resp.KeyCount)
		}

		if len(resp.Keys) != 1 {
			t.Fatalf("Expected 1 key in stats, got %d", len(resp.Keys))
		}

		if resp.Keys[0].Key != "suggestions:35.6762:139.6503:3000" {
			t.Errorf("Unexpected key: %s", resp.Keys[0].Key)
		}

		if resp.Keys[0].TTLSeconds <= 0 {
			t.Errorf("Expected positive TTL, got %d", resp.Keys[0].TTLSeconds)
		}
	})

	t.Run("キャッシュ空で統計が0件", func(t *testing.T) {
		cleanupSuggestionCache(t)

		router := setupDevRouter("development")
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/dev/suggestions/stats", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp cacheStatsResponse
		json.Unmarshal(w.Body.Bytes(), &resp)

		if resp.KeyCount != 0 {
			t.Errorf("Expected key_count 0, got %d", resp.KeyCount)
		}
	})
}

func TestDevEndpointsNotRegisteredInProduction(t *testing.T) {
	t.Run("本番環境ではエンドポイントが404", func(t *testing.T) {
		router := setupDevRouter("production")

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/dev/suggestions/cache", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
		}

		w = httptest.NewRecorder()
		req, _ = http.NewRequest("GET", "/api/dev/suggestions/stats", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
		}
	})
}
