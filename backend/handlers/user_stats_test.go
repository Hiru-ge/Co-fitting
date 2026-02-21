package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func setupStatsRouter() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me/stats", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetStats)
	return r
}

func TestGetStats(t *testing.T) {
	router := setupStatsRouter()

	t.Run("認証済みユーザーの統計情報が取得できる", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "stats@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Stats User",
			Level:        3,
			TotalXP:      250,
			StreakCount:  5,
		}
		testDB.Create(&user)

		visits := []models.Visit{
			{UserID: user.ID, PlaceID: "place1", PlaceName: "カフェA", Category: "cafe", Latitude: 35.0, Longitude: 139.0, IsComfortZone: true, XpEarned: 50, VisitedAt: time.Now()},
			{UserID: user.ID, PlaceID: "place2", PlaceName: "バーB", Category: "bar", Latitude: 35.1, Longitude: 139.1, IsComfortZone: false, XpEarned: 100, VisitedAt: time.Now()},
			{UserID: user.ID, PlaceID: "place3", PlaceName: "美術館C", Category: "museum", Latitude: 35.2, Longitude: 139.2, IsComfortZone: false, XpEarned: 100, VisitedAt: time.Now()},
		}
		for i := range visits {
			testDB.Create(&visits[i])
		}

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/stats", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["level"] != float64(3) {
			t.Errorf("Expected level 3, got %v", resp["level"])
		}
		if resp["total_xp"] != float64(250) {
			t.Errorf("Expected total_xp 250, got %v", resp["total_xp"])
		}
		if resp["streak_count"] != float64(5) {
			t.Errorf("Expected streak_count 5, got %v", resp["streak_count"])
		}
		if resp["total_visits"] != float64(3) {
			t.Errorf("Expected total_visits 3, got %v", resp["total_visits"])
		}
		if resp["comfort_zone_visits"] != float64(1) {
			t.Errorf("Expected comfort_zone_visits 1, got %v", resp["comfort_zone_visits"])
		}
		if resp["challenge_visits"] != float64(2) {
			t.Errorf("Expected challenge_visits 2, got %v", resp["challenge_visits"])
		}
	})

	t.Run("未認証ユーザーは401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/stats", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("訪問記録なしユーザーは初期値が返される", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "newuser@example.com",
			PasswordHash: string(hash),
			DisplayName:  "New User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/stats", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["level"] != float64(1) {
			t.Errorf("Expected initial level 1, got %v", resp["level"])
		}
		if resp["total_xp"] != float64(0) {
			t.Errorf("Expected initial total_xp 0, got %v", resp["total_xp"])
		}
		if resp["streak_count"] != float64(0) {
			t.Errorf("Expected initial streak_count 0, got %v", resp["streak_count"])
		}
		if resp["total_visits"] != float64(0) {
			t.Errorf("Expected initial total_visits 0, got %v", resp["total_visits"])
		}
		if resp["comfort_zone_visits"] != float64(0) {
			t.Errorf("Expected initial comfort_zone_visits 0, got %v", resp["comfort_zone_visits"])
		}
		if resp["challenge_visits"] != float64(0) {
			t.Errorf("Expected initial challenge_visits 0, got %v", resp["challenge_visits"])
		}
	})
}
