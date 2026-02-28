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
)

func setupVisitMapRouter() *gin.Engine {
	visitHandler := &VisitHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/visits/map", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), visitHandler.GetMapData)
	return r
}

func createTestUserForMap(t *testing.T) models.User {
	t.Helper()
	return createTestUserByEmail(t, "map@example.com", "Map User")
}

func createVisitsForMap(t *testing.T, userID uint64, count int) []models.Visit {
	t.Helper()
	visits := make([]models.Visit, count)
	categories := []string{"cafe", "park", "museum", "restaurant", "temple"}
	for i := 0; i < count; i++ {
		visits[i] = models.Visit{
			UserID:    userID,
			PlaceID:   fmt.Sprintf("ChIJl_map_%d", i),
			PlaceName: fmt.Sprintf("マップテスト場所 %d", i),
			Category:  categories[i%len(categories)],
			Latitude:  35.677 + float64(i)*0.001,
			Longitude: 139.650 + float64(i)*0.001,
			VisitedAt: time.Date(2024, 2, 10-i, 12, 0, 0, 0, time.UTC),
		}
		if err := testDB.Create(&visits[i]).Error; err != nil {
			t.Fatalf("Failed to create test visit %d: %v", i, err)
		}
	}
	return visits
}

func TestGetMapData(t *testing.T) {
	router := setupVisitMapRouter()

	t.Run("認証済みユーザーのマップデータが取得できる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForMap(t)
		token := generateTestToken(user.ID)
		createVisitsForMap(t, user.ID, 3)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/map", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp struct {
			Visits []map[string]interface{} `json:"visits"`
			Total  int64                    `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if len(resp.Visits) != 3 {
			t.Fatalf("Expected 3 visits, got %d", len(resp.Visits))
		}
		if resp.Total != 3 {
			t.Errorf("Expected total 3, got %d", resp.Total)
		}
	})

	t.Run("レスポンスにマップ表示に必要なフィールドが含まれる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForMap(t)
		token := generateTestToken(user.ID)
		createVisitsForMap(t, user.ID, 1)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/map", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp struct {
			Visits []map[string]interface{} `json:"visits"`
			Total  int64                    `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		v := resp.Visits[0]
		requiredFields := []string{"id", "place_id", "place_name", "lat", "lng", "category", "visited_at"}
		for _, field := range requiredFields {
			if _, ok := v[field]; !ok {
				t.Errorf("Expected field '%s' in response, but not found", field)
			}
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/map", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("訪問記録なしユーザーは空配列が返される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForMap(t)
		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/map", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp struct {
			Visits []map[string]interface{} `json:"visits"`
			Total  int64                    `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp.Visits == nil {
			t.Error("Expected empty array, got nil")
		}
		if len(resp.Visits) != 0 {
			t.Errorf("Expected 0 visits, got %d", len(resp.Visits))
		}
		if resp.Total != 0 {
			t.Errorf("Expected total 0, got %d", resp.Total)
		}
	})

	t.Run("自分のデータのみ返される", func(t *testing.T) {
		cleanupUsers(t)

		user1 := createTestUserForMap(t)
		token1 := generateTestToken(user1.ID)
		createVisitsForMap(t, user1.ID, 2)

		user2 := models.User{
			Email:       "map-other@example.com",
			DisplayName: "Other Map User",
		}
		testDB.Create(&user2)
		createVisitsForMap(t, user2.ID, 5)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/map", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token1))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp struct {
			Visits []map[string]interface{} `json:"visits"`
			Total  int64                    `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp.Total != 2 {
			t.Errorf("Expected total 2 (user1's visits only), got %d", resp.Total)
		}
		if len(resp.Visits) != 2 {
			t.Errorf("Expected 2 visits, got %d", len(resp.Visits))
		}
	})

	t.Run("ページングが機能する", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForMap(t)
		token := generateTestToken(user.ID)
		createVisitsForMap(t, user.ID, 5)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/map?limit=2&offset=0", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp struct {
			Visits []map[string]interface{} `json:"visits"`
			Total  int64                    `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if len(resp.Visits) != 2 {
			t.Errorf("Expected 2 visits (limited), got %d", len(resp.Visits))
		}
		if resp.Total != 5 {
			t.Errorf("Expected total 5, got %d", resp.Total)
		}
	})

	t.Run("limit=2001で上限2000件に制限される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForMap(t)
		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/map?limit=2001", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}
	})
}
