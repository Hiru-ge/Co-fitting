package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/services"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
)

const testJWTSecret = "test-secret-key"

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

func setupDevRouterWithAuth(environment string) *gin.Engine {
	handler := &DevHandler{
		RedisClient: testRedisClient,
	}

	r := gin.New()
	if environment == "development" {
		dev := r.Group("/api/dev")
		dev.Use(middleware.JWTAuth(testJWTSecret, testRedisClient))
		dev.DELETE("/suggestions/cache", handler.ResetSuggestionCache)
		dev.GET("/suggestions/stats", handler.GetSuggestionStats)
	}
	return r
}

func cleanupSuggestionCache(t *testing.T) {
	t.Helper()
	if testRedisClient == nil {
		t.Skip("Redis not available")
	}
	ctx := context.Background()
	patterns := []string{"suggestions:*", "suggestion:daily:*"}
	for _, pattern := range patterns {
		var cursor uint64
		for {
			keys, nextCursor, err := testRedisClient.Scan(ctx, cursor, pattern, 100).Result()
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

	t.Run("日次キャッシュキーも削除される", func(t *testing.T) {
		cleanupSuggestionCache(t)

		ctx := context.Background()
		// 旧キャッシュ
		testRedisClient.Set(ctx, "suggestions:35.6762:139.6503:3000", `[{"place_id":"p1"}]`, 24*time.Hour)
		// 日次キャッシュ
		testRedisClient.Set(ctx, "suggestion:daily:1:2026-02-15:35.68_139.65", `[{"place_id":"p2"}]`, 24*time.Hour)
		testRedisClient.Set(ctx, "suggestion:daily:2:2026-02-15:35.68_139.65", `[{"place_id":"p3"}]`, 24*time.Hour)

		router := setupDevRouter("development")
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/dev/suggestions/cache", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp) //nolint:errcheck

		deletedCount := int(resp["deleted_count"].(float64))
		if deletedCount != 3 {
			t.Errorf("Expected deleted_count 3, got %d", deletedCount)
		}

		// 全キーが削除されていることを確認
		keys1, _, _ := testRedisClient.Scan(ctx, 0, "suggestions:*", 100).Result()
		keys2, _, _ := testRedisClient.Scan(ctx, 0, "suggestion:daily:*", 100).Result()
		if len(keys1)+len(keys2) != 0 {
			t.Errorf("Expected 0 remaining keys, got %d + %d", len(keys1), len(keys2))
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
		json.Unmarshal(w.Body.Bytes(), &resp) //nolint:errcheck

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

func TestDevEndpointsAuthenticationRequired(t *testing.T) {
	if testRedisClient == nil {
		t.Skip("Redis not available")
	}

	t.Run("JWT認証なしでアクセス拒否されることの確認", func(t *testing.T) {
		cleanupSuggestionCache(t)

		// 実装後: JWT認証が必要になった
		router := setupDevRouterWithAuth("development")

		// ResetSuggestionCache
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/dev/suggestions/cache", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["error"] != "authorization header is required" {
			t.Errorf("Expected authorization error, got %v", resp["error"])
		}

		// GetSuggestionStats
		w = httptest.NewRecorder()
		req, _ = http.NewRequest("GET", "/api/dev/suggestions/stats", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("有効なJWTでアクセス成功テスト", func(t *testing.T) {
		cleanupSuggestionCache(t)

		// テスト用トークンを生成
		tokenPair, err := utils.GenerateTokenPair(1, testJWTSecret, time.Hour, 24*time.Hour)
		if err != nil {
			t.Fatalf("Failed to generate test token: %v", err)
		}

		router := setupDevRouterWithAuth("development")

		// ResetSuggestionCache（認証付き）
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/dev/suggestions/cache", nil)
		req.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if _, exists := resp["deleted_count"]; !exists {
			t.Errorf("Expected deleted_count in response, got %+v", resp)
		}

		// GetSuggestionStats（認証付き）
		w = httptest.NewRecorder()
		req, _ = http.NewRequest("GET", "/api/dev/suggestions/stats", nil)
		req.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var statsResp cacheStatsResponse
		if err := json.Unmarshal(w.Body.Bytes(), &statsResp); err != nil {
			t.Fatalf("Failed to parse stats response: %v", err)
		}

		if statsResp.KeyCount < 0 {
			t.Errorf("Expected non-negative key count, got %d", statsResp.KeyCount)
		}
	})

	t.Run("無効なJWTでアクセス拒否テスト", func(t *testing.T) {
		router := setupDevRouterWithAuth("development")

		// 無効なトークンでリクエスト
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/dev/suggestions/cache", nil)
		req.Header.Set("Authorization", "Bearer invalid-token")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["error"] != "invalid or expired token" {
			t.Errorf("Expected invalid token error, got %v", resp["error"])
		}
	})
}

func setupDevRouterForLoginAndTrigger(handler *DevHandler) *gin.Engine {
	r := gin.New()
	r.POST("/api/dev/auth/test-login", handler.TestLogin)
	r.POST("/api/dev/notifications/trigger", handler.TriggerNotification)
	return r
}

func TestDevTestLogin(t *testing.T) {
	handler := &DevHandler{
		DB:     testDB,
		JWTCfg: testAuthHandler.JWTCfg,
	}
	router := setupDevRouterForLoginAndTrigger(handler)

	t.Run("必須パラメータ不足で400", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/dev/auth/test-login", bytes.NewBufferString(`{"email":""}`))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d body=%s", w.Code, w.Body.String())
		}
	})

	t.Run("新規ユーザー作成でトークン返却", func(t *testing.T) {
		cleanupUsers(t)
		email := "dev-login-new@example.com"
		payload := map[string]string{
			"email":        email,
			"display_name": "Dev New",
		}
		body, _ := json.Marshal(payload)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/dev/auth/test-login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse response: %v", err)
		}

		if resp["access_token"] == "" || resp["refresh_token"] == "" {
			t.Fatalf("expected token pair, got %+v", resp)
		}
		isNew, ok := resp["is_new_user"].(bool)
		if !ok || !isNew {
			t.Fatalf("expected is_new_user=true, got %+v", resp["is_new_user"])
		}
	})

	t.Run("既存ユーザーで is_new_user=false", func(t *testing.T) {
		cleanupUsers(t)
		createTestUserByEmail(t, "dev-login-existing@example.com", "Existing")

		payload := map[string]string{
			"email":        "dev-login-existing@example.com",
			"display_name": "Existing",
		}
		body, _ := json.Marshal(payload)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/dev/auth/test-login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp) //nolint:errcheck
		isNew, ok := resp["is_new_user"].(bool)
		if !ok || isNew {
			t.Fatalf("expected is_new_user=false, got %+v", resp["is_new_user"])
		}
	})
}

type noopPushSender struct{}

func (noopPushSender) SendToUser(_ uint64, _ services.PushPayload) error { return nil }

func TestDevTriggerNotification(t *testing.T) {
	handler := &DevHandler{DB: testDB}
	router := setupDevRouterForLoginAndTrigger(handler)

	t.Run("scheduler未初期化で503", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/dev/notifications/trigger", bytes.NewBufferString(`{"type":"is_daily_suggestion_enabled"}`))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503, got %d body=%s", w.Code, w.Body.String())
		}
	})

	t.Run("不正typeで400", func(t *testing.T) {
		handler.Scheduler = services.NewNotificationScheduler(noopPushSender{}, nil, testDB)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/dev/notifications/trigger", bytes.NewBufferString(`{"type":"invalid"}`))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d body=%s", w.Code, w.Body.String())
		}
	})

	t.Run("有効typeで200", func(t *testing.T) {
		handler.Scheduler = services.NewNotificationScheduler(noopPushSender{}, nil, testDB)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/dev/notifications/trigger", bytes.NewBufferString(`{"type":"is_daily_suggestion_enabled"}`))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
		}
	})
}
