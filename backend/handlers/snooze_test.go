package handlers

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/middleware"
	"github.com/gin-gonic/gin"
)

func setupSnoozeRouter() *gin.Engine {
	handler := &SnoozeHandler{
		RedisClient: testRedisClient,
	}

	r := gin.New()
	r.POST("/api/places/:place_id/snooze", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), handler.SnoozePlace)
	return r
}

func cleanupSnoozeKeys(t *testing.T) {
	t.Helper()
	if testRedisClient == nil {
		return
	}
	ctx := context.Background()
	database.DeleteKeysByPattern(ctx, testRedisClient, "place:snooze:*") //nolint:errcheck
}

func TestSnoozePlace(t *testing.T) {
	if testRedisClient == nil {
		t.Skip("Redis not available")
	}

	t.Run("正常なリクエストで200を返す", func(t *testing.T) {
		cleanupUsers(t)
		cleanupSnoozeKeys(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)
		router := setupSnoozeRouter()

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/places/place_snooze_1/snooze?days=7", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}
	})

	t.Run("スヌーズ後にRedisにキーが保存される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupSnoozeKeys(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)
		router := setupSnoozeRouter()

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/places/place_snooze_2/snooze?days=7", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		ctx := context.Background()
		userIDStr := fmt.Sprintf("%d", user.ID)
		snoozed, err := database.IsPlaceSnoozed(ctx, testRedisClient, userIDStr, "place_snooze_2")
		if err != nil {
			t.Fatalf("Unexpected error checking snooze: %v", err)
		}
		if !snoozed {
			t.Error("Expected place_snooze_2 to be marked as snoozed in Redis")
		}
	})

	t.Run("daysを省略すると400を返す", func(t *testing.T) {
		cleanupUsers(t)
		cleanupSnoozeKeys(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)
		router := setupSnoozeRouter()

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/places/place_snooze_3/snooze", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("days=0で400を返す", func(t *testing.T) {
		cleanupUsers(t)
		cleanupSnoozeKeys(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)
		router := setupSnoozeRouter()

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/places/place_snooze_4/snooze?days=0", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("days=366で400を返す", func(t *testing.T) {
		cleanupUsers(t)
		cleanupSnoozeKeys(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)
		router := setupSnoozeRouter()

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/places/place_snooze_5/snooze?days=366", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("認証なしで401を返す", func(t *testing.T) {
		router := setupSnoozeRouter()

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/places/place_snooze_6/snooze?days=7", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})
}
