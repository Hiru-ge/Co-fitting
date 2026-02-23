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
	r.PATCH("/api/visits/:id", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), visitHandler.UpdateVisit)
	r.GET("/api/visits/:id", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), visitHandler.GetVisit)
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
			"vicinity":   "東京都渋谷区神南1丁目",
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
		if resp["vicinity"] != "東京都渋谷区神南1丁目" {
			t.Errorf("Expected vicinity '東京都渋谷区神南1丁目', got '%v'", resp["vicinity"])
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
		if visit.Vicinity != "東京都渋谷区神南1丁目" {
			t.Errorf("Expected vicinity '東京都渋谷区神南1丁目' in DB, got '%s'", visit.Vicinity)
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

func TestCreateVisitIsComfortZone(t *testing.T) {
	router := setupVisitRouter()

	t.Run("興味外ジャンル(museum)の訪問でis_comfort_zone=trueになる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		// "カフェ" 興味タグを設定
		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		body := map[string]interface{}{
			"place_id":    "ChIJl_museum_001",
			"place_name":  "渋谷区立博物館",
			"vicinity":    "東京都渋谷区",
			"category":    "museum",
			"place_types": []string{"museum", "point_of_interest"},
			"lat":         35.677,
			"lng":         139.650,
			"visited_at":  "2024-02-07T15:30:00Z",
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

		// DBのis_comfort_zoneがtrueであることを確認
		var visit models.Visit
		if err := testDB.Where("place_id = ? AND user_id = ?", "ChIJl_museum_001", user.ID).First(&visit).Error; err != nil {
			t.Fatalf("Visit not found in DB: %v", err)
		}
		if !visit.IsComfortZone {
			t.Error("Expected is_comfort_zone=true for out-of-interest genre (museum), got false")
		}
	})

	t.Run("興味内ジャンル(cafe)の訪問でis_comfort_zone=falseになる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		// "カフェ" 興味タグを設定
		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		body := map[string]interface{}{
			"place_id":    "ChIJl_cafe_001",
			"place_name":  "隠れ家カフェ",
			"vicinity":    "東京都渋谷区",
			"category":    "cafe",
			"place_types": []string{"cafe", "point_of_interest"},
			"lat":         35.677,
			"lng":         139.650,
			"visited_at":  "2024-02-07T15:30:00Z",
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

		var visit models.Visit
		if err := testDB.Where("place_id = ? AND user_id = ?", "ChIJl_cafe_001", user.ID).First(&visit).Error; err != nil {
			t.Fatalf("Visit not found in DB: %v", err)
		}
		if visit.IsComfortZone {
			t.Error("Expected is_comfort_zone=false for in-interest genre (cafe), got true")
		}
	})

	t.Run("興味タグ未設定ユーザーの訪問はis_comfort_zone=falseになる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		// 興味タグを設定しない

		body := map[string]interface{}{
			"place_id":    "ChIJl_nointerest_001",
			"place_name":  "テストカフェ",
			"vicinity":    "東京都渋谷区",
			"category":    "cafe",
			"place_types": []string{"cafe"},
			"lat":         35.677,
			"lng":         139.650,
			"visited_at":  "2024-02-07T15:30:00Z",
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

		var visit models.Visit
		if err := testDB.Where("place_id = ? AND user_id = ?", "ChIJl_nointerest_001", user.ID).First(&visit).Error; err != nil {
			t.Fatalf("Visit not found in DB: %v", err)
		}
		if visit.IsComfortZone {
			t.Error("Expected is_comfort_zone=false for user without interest tags, got true")
		}
	})

	t.Run("place_types未指定の訪問はis_comfort_zone=falseになる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		body := map[string]interface{}{
			"place_id":   "ChIJl_notypes_001",
			"place_name": "タイプなし場所",
			"vicinity":   "東京都渋谷区",
			"category":   "cafe",
			// place_types を送らない
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

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
		}

		var visit models.Visit
		if err := testDB.Where("place_id = ? AND user_id = ?", "ChIJl_notypes_001", user.ID).First(&visit).Error; err != nil {
			t.Fatalf("Visit not found in DB: %v", err)
		}
		if visit.IsComfortZone {
			t.Error("Expected is_comfort_zone=false when place_types not provided, got true")
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

	t.Run("limit=101で最大100件返却される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		createVisitsForUser(t, user.ID, 120) // 120件作成

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits?limit=101", nil)
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

		if len(resp.Visits) != 100 {
			t.Errorf("Expected 100 visits (limited from 101), got %d", len(resp.Visits))
		}
		if resp.Total != 120 {
			t.Errorf("Expected total 120, got %d", resp.Total)
		}
	})

	t.Run("limit=50で50件返却される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		createVisitsForUser(t, user.ID, 80) // 80件作成

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits?limit=50", nil)
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

		if len(resp.Visits) != 50 {
			t.Errorf("Expected 50 visits, got %d", len(resp.Visits))
		}
		if resp.Total != 80 {
			t.Errorf("Expected total 80, got %d", resp.Total)
		}
	})

	t.Run("limit=1000で最大100件に制限される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		createVisitsForUser(t, user.ID, 150) // 150件作成

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits?limit=1000", nil)
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

		if len(resp.Visits) != 100 {
			t.Errorf("Expected 100 visits (limited from 1000), got %d", len(resp.Visits))
		}
		if resp.Total != 150 {
			t.Errorf("Expected total 150, got %d", resp.Total)
		}
	})
}

func TestGetVisit(t *testing.T) {
	router := setupVisitRouter()

	t.Run("自分の訪問記録を正常取得できる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		visits := createVisitsForUser(t, user.ID, 1)
		visit := visits[0]

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", fmt.Sprintf("/api/visits/%d", visit.ID), nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp models.Visit
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp.ID != visit.ID {
			t.Errorf("Expected id %d, got %d", visit.ID, resp.ID)
		}
		if resp.PlaceName != visit.PlaceName {
			t.Errorf("Expected place_name '%s', got '%s'", visit.PlaceName, resp.PlaceName)
		}
		if resp.UserID != user.ID {
			t.Errorf("Expected user_id %d, got %d", user.ID, resp.UserID)
		}
	})

	t.Run("他人の訪問記録は404 Not Found", func(t *testing.T) {
		cleanupUsers(t)

		// ユーザー1の訪問記録を作成
		user1 := createTestUserForVisit(t)
		visits := createVisitsForUser(t, user1.ID, 1)
		visit := visits[0]

		// ユーザー2でアクセス
		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user2 := models.User{
			Email:        "other-get@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Other User",
		}
		testDB.Create(&user2)
		token2 := generateTestToken(user2.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", fmt.Sprintf("/api/visits/%d", visit.ID), nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token2))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})

	t.Run("存在しないIDで404 Not Found", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/999999", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})

	t.Run("無効なIDで400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/abc", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/visits/1", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})
}

func TestUpdateVisit(t *testing.T) {
	router := setupVisitRouter()

	t.Run("感想メモを更新できる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		visits := createVisitsForUser(t, user.ID, 1)
		visitID := visits[0].ID

		body := map[string]interface{}{
			"memo": "素晴らしい体験でした！",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", fmt.Sprintf("/api/visits/%d", visitID), bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["memo"] != "素晴らしい体験でした！" {
			t.Errorf("Expected memo '素晴らしい体験でした！', got '%v'", resp["memo"])
		}

		// DBに反映されていることを確認
		var updated models.Visit
		testDB.First(&updated, visitID)
		if updated.Memo == nil || *updated.Memo != "素晴らしい体験でした！" {
			t.Errorf("Expected DB memo '素晴らしい体験でした！', got '%v'", updated.Memo)
		}
	})

	t.Run("評価を更新できる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		visits := createVisitsForUser(t, user.ID, 1)
		visitID := visits[0].ID

		body := map[string]interface{}{
			"rating": 4.5,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", fmt.Sprintf("/api/visits/%d", visitID), bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["rating"] == nil {
			t.Error("Expected rating in response, got nil")
		}

		// DBに反映されていることを確認
		var updated models.Visit
		testDB.First(&updated, visitID)
		if updated.Rating == nil || *updated.Rating != 4.5 {
			t.Errorf("Expected DB rating 4.5, got '%v'", updated.Rating)
		}
	})

	t.Run("メモと評価を同時に更新できる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)
		visits := createVisitsForUser(t, user.ID, 1)
		visitID := visits[0].ID

		body := map[string]interface{}{
			"memo":   "両方更新テスト",
			"rating": 3.0,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", fmt.Sprintf("/api/visits/%d", visitID), bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var updated models.Visit
		testDB.First(&updated, visitID)
		if updated.Memo == nil || *updated.Memo != "両方更新テスト" {
			t.Errorf("Expected DB memo '両方更新テスト', got '%v'", updated.Memo)
		}
		if updated.Rating == nil || *updated.Rating != 3.0 {
			t.Errorf("Expected DB rating 3.0, got '%v'", updated.Rating)
		}
	})

	t.Run("他ユーザーの訪問記録を更新しようとすると403 Forbidden", func(t *testing.T) {
		cleanupUsers(t)

		// 訪問記録を持つユーザー1
		user1 := createTestUserForVisit(t)
		visits := createVisitsForUser(t, user1.ID, 1)
		visitID := visits[0].ID

		// 別のユーザー2のトークンで更新を試みる
		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user2 := models.User{
			Email:        "visit-other2@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Other User2",
		}
		testDB.Create(&user2)
		token2 := generateTestToken(user2.ID)

		body := map[string]interface{}{
			"memo": "不正アクセス",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", fmt.Sprintf("/api/visits/%d", visitID), bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token2))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusForbidden, w.Code, w.Body.String())
		}
	})

	t.Run("存在しない訪問記録で404 Not Found", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"memo": "存在しない",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/visits/99999999", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})

	t.Run("不正なID形式で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUserForVisit(t)
		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"memo": "テスト",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/visits/invalid-id", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		body := map[string]interface{}{
			"memo": "テスト",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/visits/1", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})
}
