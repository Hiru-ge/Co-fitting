package handlers

import (
	"bytes"
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

func setupVisitRouter() *gin.Engine {
	visitHandler := &VisitHandler{DB: testDB}

	r := gin.New()
	r.POST("/api/visits", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret), visitHandler.CreateVisit)
	return r
}

func createTestUserForVisit(t *testing.T) models.User {
	t.Helper()
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	user := models.User{
		Email:        "visit@example.com",
		PasswordHash: string(hash),
		DisplayName:  "Visit User",
	}
	testDB.Create(&user)
	return user
}

func TestCreateVisit(t *testing.T) {
	router := setupVisitRouter()

	t.Run("有効なデータで201 Created", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"place_id":   "ChIJl_example123",
			"place_name": "隠れ家カフェ MOON",
			"lat":        35.677,
			"lng":        139.650,
			"rating":     4.3,
			"visited_at": "2024-02-07T15:30:00Z",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/visits", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["place_id"] != "ChIJl_example123" {
			t.Errorf("Expected place_id 'ChIJl_example123', got '%v'", resp["place_id"])
		}
		if resp["place_name"] != "隠れ家カフェ MOON" {
			t.Errorf("Expected place_name '隠れ家カフェ MOON', got '%v'", resp["place_name"])
		}
		if resp["user_id"] == nil {
			t.Error("Expected user_id in response")
		}

		// DBに保存されていることを確認
		var visit models.Visit
		if err := testDB.Where("place_id = ? AND user_id = ?", "ChIJl_example123", user.ID).First(&visit).Error; err != nil {
			t.Fatalf("Visit not found in DB: %v", err)
		}
		if visit.PlaceName != "隠れ家カフェ MOON" {
			t.Errorf("Expected place_name '隠れ家カフェ MOON' in DB, got '%s'", visit.PlaceName)
		}
	})

	t.Run("ratingなしでも201 Created", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"place_id":   "ChIJl_no_rating",
			"place_name": "公園 パーク",
			"lat":        35.680,
			"lng":        139.655,
			"visited_at": "2024-02-08T10:00:00Z",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/visits", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
		}
	})

	t.Run("同じplace_idを複数回登録できる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"place_id":   "ChIJl_duplicate",
			"place_name": "お気に入りカフェ",
			"lat":        35.677,
			"lng":        139.650,
			"visited_at": "2024-02-07T15:30:00Z",
		}
		jsonBody, _ := json.Marshal(body)

		// 1回目
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/visits", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("1st visit: Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
		}

		// 2回目（別日時）
		body["visited_at"] = "2024-02-10T12:00:00Z"
		jsonBody, _ = json.Marshal(body)

		w = httptest.NewRecorder()
		req, _ = http.NewRequest("POST", "/api/visits", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("2nd visit: Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
		}

		// DBに2件あることを確認
		var count int64
		testDB.Model(&models.Visit{}).Where("place_id = ? AND user_id = ?", "ChIJl_duplicate", user.ID).Count(&count)
		if count != 2 {
			t.Errorf("Expected 2 visits, got %d", count)
		}
	})

	t.Run("place_id欠落で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"place_name": "カフェ",
			"lat":        35.677,
			"lng":        139.650,
			"visited_at": "2024-02-07T15:30:00Z",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/visits", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("place_name欠落で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"place_id":   "ChIJl_example",
			"lat":        35.677,
			"lng":        139.650,
			"visited_at": "2024-02-07T15:30:00Z",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/visits", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("visited_at欠落で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"place_id":   "ChIJl_example",
			"place_name": "カフェ",
			"lat":        35.677,
			"lng":        139.650,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/visits", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		body := map[string]interface{}{
			"place_id":   "ChIJl_example",
			"place_name": "カフェ",
			"lat":        35.677,
			"lng":        139.650,
			"visited_at": "2024-02-07T15:30:00Z",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/visits", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("レスポンスにvisited_atが含まれる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		visitedAt := "2024-02-07T15:30:00Z"
		body := map[string]interface{}{
			"place_id":   "ChIJl_time_check",
			"place_name": "時間テストカフェ",
			"lat":        35.677,
			"lng":        139.650,
			"visited_at": visitedAt,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/visits", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		expectedTime, _ := time.Parse(time.RFC3339, visitedAt)
		respTime, err := time.Parse(time.RFC3339, resp["visited_at"].(string))
		if err != nil {
			t.Fatalf("Failed to parse visited_at from response: %v", err)
		}
		if !respTime.Equal(expectedTime) {
			t.Errorf("Expected visited_at '%s', got '%s'", expectedTime, respTime)
		}
	})
}
