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
	r.POST("/api/visits", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), visitHandler.CreateVisit)
	r.GET("/api/visits", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), visitHandler.ListVisits)
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
			"category":   "cafe",
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
		if resp["category"] != "cafe" {
			t.Errorf("Expected category 'cafe', got '%v'", resp["category"])
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
		if visit.Category != "cafe" {
			t.Errorf("Expected category 'cafe' in DB, got '%s'", visit.Category)
		}
	})

	t.Run("ratingなしでも201 Created", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"place_id":   "ChIJl_no_rating",
			"place_name": "公園 パーク",
			"category":   "park",
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
			"category":   "cafe",
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
			"category":   "cafe",
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
			"category":   "cafe",
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
			"category":   "cafe",
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

	t.Run("category欠落で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

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
			"category":   "cafe",
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
			"category":   "cafe",
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

// createVisitsForUser はテスト用の訪問記録を複数件作成するヘルパー
func createVisitsForUser(t *testing.T, userID uint64, count int) []models.Visit {
	t.Helper()
	visits := make([]models.Visit, count)
	categories := []string{"cafe", "park", "museum", "restaurant", "temple"}
	for i := 0; i < count; i++ {
		visits[i] = models.Visit{
			UserID:    userID,
			PlaceID:   fmt.Sprintf("ChIJl_list_%d", i),
			PlaceName: fmt.Sprintf("テスト場所 %d", i),
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

func TestListVisits(t *testing.T) {
	router := setupVisitRouter()

	t.Run("訪問履歴が降順で返される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		createVisitsForUser(t, user.ID, 3)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp struct {
			Visits []models.Visit `json:"visits"`
			Total  int64          `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if len(resp.Visits) != 3 {
			t.Fatalf("Expected 3 visits, got %d", len(resp.Visits))
		}

		// visited_at 降順であることを確認
		for i := 0; i < len(resp.Visits)-1; i++ {
			if resp.Visits[i].VisitedAt.Before(resp.Visits[i+1].VisitedAt) {
				t.Errorf("Visits not in descending order: [%d] %v < [%d] %v",
					i, resp.Visits[i].VisitedAt, i+1, resp.Visits[i+1].VisitedAt)
			}
		}

		if resp.Total != 3 {
			t.Errorf("Expected total 3, got %d", resp.Total)
		}
	})

	t.Run("ページネーションが正常に機能する", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		createVisitsForUser(t, user.ID, 5)

		// limit=2, offset=0 → 最初の2件
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits?limit=2&offset=0", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp1 struct {
			Visits []models.Visit `json:"visits"`
			Total  int64          `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp1); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if len(resp1.Visits) != 2 {
			t.Errorf("Expected 2 visits, got %d", len(resp1.Visits))
		}
		if resp1.Total != 5 {
			t.Errorf("Expected total 5, got %d", resp1.Total)
		}

		// limit=2, offset=2 → 次の2件
		w = httptest.NewRecorder()
		req, _ = http.NewRequest("GET", "/api/visits?limit=2&offset=2", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		var resp2 struct {
			Visits []models.Visit `json:"visits"`
			Total  int64          `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp2); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if len(resp2.Visits) != 2 {
			t.Errorf("Expected 2 visits, got %d", len(resp2.Visits))
		}

		// 1ページ目と2ページ目のデータが重複しないことを確認
		for _, v1 := range resp1.Visits {
			for _, v2 := range resp2.Visits {
				if v1.ID == v2.ID {
					t.Errorf("Duplicate visit ID %d found across pages", v1.ID)
				}
			}
		}
	})

	t.Run("自分のレコードのみ返される", func(t *testing.T) {
		cleanupUsers(t)

		// ユーザー1を作成
		user1 := createTestUserForVisit(t)
		token1 := generateTestToken(user1.ID)
		createVisitsForUser(t, user1.ID, 2)

		// ユーザー2を作成（別メールで）
		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user2 := models.User{
			Email:        "visit-other@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Other User",
		}
		testDB.Create(&user2)
		createVisitsForUser(t, user2.ID, 3)

		// ユーザー1でリクエスト → 自分の2件のみ
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token1))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp struct {
			Visits []models.Visit `json:"visits"`
			Total  int64          `json:"total"`
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

		for _, v := range resp.Visits {
			if v.UserID != user1.ID {
				t.Errorf("Expected user_id %d, got %d", user1.ID, v.UserID)
			}
		}
	})

	t.Run("訪問履歴がない場合は空配列で返される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp struct {
			Visits []models.Visit `json:"visits"`
			Total  int64          `json:"total"`
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

	t.Run("デフォルトのlimitは20", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		createVisitsForUser(t, user.ID, 25)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp struct {
			Visits []models.Visit `json:"visits"`
			Total  int64          `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if len(resp.Visits) != 20 {
			t.Errorf("Expected 20 visits (default limit), got %d", len(resp.Visits))
		}
		if resp.Total != 25 {
			t.Errorf("Expected total 25, got %d", resp.Total)
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})
}
