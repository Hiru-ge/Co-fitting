package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
)

type mockPlacesClient struct {
	Results []PlaceResult
	Err     error
}

func (m *mockPlacesClient) NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]PlaceResult, error) {
	return m.Results, m.Err
}

// trackingMockPlacesClient はAPI呼び出し回数を追跡するモック
type trackingMockPlacesClient struct {
	Results    []PlaceResult
	Err        error
	CallCount  int
	LastRadius uint
}

func (m *trackingMockPlacesClient) NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]PlaceResult, error) {
	m.CallCount++
	m.LastRadius = radius
	return m.Results, m.Err
}

func setupSuggestionRouter(mock PlacesSearcher) *gin.Engine {
	handler := &SuggestionHandler{
		DB:          testDB,
		RedisClient: nil,
		Places:      mock,
	}

	r := gin.New()
	r.POST("/api/suggestions", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), handler.Suggest)
	return r
}

func setupSuggestionRouterWithRedis(mock PlacesSearcher) *gin.Engine {
	handler := &SuggestionHandler{
		DB:          testDB,
		RedisClient: testRedisClient,
		Places:      mock,
	}

	r := gin.New()
	r.POST("/api/suggestions", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), handler.Suggest)
	return r
}

func cleanupAllSuggestionCache(t *testing.T) {
	t.Helper()
	if testRedisClient == nil {
		return
	}
	ctx := context.Background()
	var cursor uint64
	for {
		keys, nextCursor, err := testRedisClient.Scan(ctx, cursor, "suggestion:*", 100).Result()
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
	// 旧キャッシュキーもクリア
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

// parseSuggestions は SuggestionResult ラッパーから []PlaceResult を取り出すテストヘルパー
func parseSuggestions(t *testing.T, body []byte) []PlaceResult {
	t.Helper()
	var result struct {
		Places []PlaceResult `json:"places"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("Failed to parse suggestion response: %v. Body: %s", err, string(body))
	}
	return result.Places
}

func createTestUser(t *testing.T) models.User {
	t.Helper()
	user := models.User{
		Email:       "suggest@example.com",
		DisplayName: "Suggest User",
	}
	testDB.Create(&user)
	return user
}

func TestSuggest(t *testing.T) {
	mockPlaces := []PlaceResult{
		{PlaceID: "place_1", Name: "Cafe Alpha", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "place_2", Name: "Park Beta", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"park"}},
		{PlaceID: "place_3", Name: "Restaurant Gamma", Vicinity: "渋谷区3-3", Lat: 35.6780, Lng: 139.6520, Rating: 3.8, Types: []string{"restaurant"}},
	}

	t.Run("有効な座標で施設が返される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		if len(resp) == 0 {
			t.Error("Expected at least one place")
		}
		if resp[0].PlaceID == "" {
			t.Error("Expected non-empty place_id")
		}
		if resp[0].Name == "" {
			t.Error("Expected non-empty name")
		}
	})

	t.Run("訪問済みの場所は除外される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_1",
			PlaceName: "Cafe Alpha",
			Latitude:  35.6762,
			Longitude: 139.6503,
			VisitedAt: time.Now(),
		})
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_2",
			PlaceName: "Park Beta",
			Latitude:  35.6770,
			Longitude: 139.6510,
			VisitedAt: time.Now(),
		})

		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		if len(resp) != 1 {
			t.Fatalf("Expected 1 place, got %d", len(resp))
		}
		if resp[0].PlaceID != "place_3" {
			t.Errorf("Expected place_id 'place_3', got '%s'", resp[0].PlaceID)
		}
	})

	t.Run("APIエラー時に500エラー", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &mockPlacesClient{Err: fmt.Errorf("API key invalid")}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusInternalServerError, w.Code, w.Body.String())
		}
	})

	t.Run("周辺施設なしで404", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &mockPlacesClient{Results: []PlaceResult{}}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat": 35.6762,
			"lng": 139.6503,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("不動産屋や市町村など訪問に不適切な場所は除外される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mixedPlaces := []PlaceResult{
			{PlaceID: "realestate_1", Name: "○○不動産", Vicinity: "渋谷区", Lat: 35.6762, Lng: 139.6503, Rating: 3.0, Types: []string{"real_estate_agency", "point_of_interest", "establishment"}},
			{PlaceID: "city_1", Name: "渋谷区", Vicinity: "東京都", Lat: 35.6640, Lng: 139.6982, Rating: 0, Types: []string{"locality", "political"}},
			{PlaceID: "cafe_1", Name: "隠れ家カフェ", Vicinity: "渋谷区1-1", Lat: 35.6770, Lng: 139.6510, Rating: 4.5, Types: []string{"cafe", "food", "point_of_interest", "establishment"}},
			{PlaceID: "lawyer_1", Name: "○○法律事務所", Vicinity: "渋谷区2-2", Lat: 35.6780, Lng: 139.6520, Rating: 4.0, Types: []string{"lawyer", "point_of_interest", "establishment"}},
		}

		mock := &mockPlacesClient{Results: mixedPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		if len(resp) != 1 {
			t.Fatalf("Expected 1 place, got %d", len(resp))
		}
		if resp[0].PlaceID != "cafe_1" {
			t.Errorf("Expected only cafe to be returned, got place_id '%s' (%s)", resp[0].PlaceID, resp[0].Name)
		}
	})

	t.Run("訪問可能な施設がゼロの場合404", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		onlyBadPlaces := []PlaceResult{
			{PlaceID: "realestate_1", Name: "○○不動産", Vicinity: "渋谷区", Lat: 35.6762, Lng: 139.6503, Rating: 3.0, Types: []string{"real_estate_agency", "establishment"}},
			{PlaceID: "city_1", Name: "渋谷区", Vicinity: "東京都", Lat: 35.6640, Lng: 139.6982, Rating: 0, Types: []string{"locality", "political"}},
		}

		mock := &mockPlacesClient{Results: onlyBadPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})

	t.Run("全施設訪問済みで404", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		for _, p := range mockPlaces {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   p.PlaceID,
				PlaceName: p.Name,
				Latitude:  p.Lat,
				Longitude: p.Lng,
				VisitedAt: time.Now(),
			})
		}

		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})

	t.Run("全施設訪問済みでcodeフィールドにDAILY_LIMIT_REACHEDが返る", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		for _, p := range mockPlaces {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   p.PlaceID,
				PlaceName: p.Name,
				Latitude:  p.Lat,
				Longitude: p.Lng,
				VisitedAt: time.Now(),
			})
		}

		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		var result map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response body: %v", err)
		}
		if result["code"] != "DAILY_LIMIT_REACHED" {
			t.Errorf("Expected code 'DAILY_LIMIT_REACHED', got '%s'", result["code"])
		}
	})

	t.Run("周辺施設なしでcodeフィールドにNO_NEARBY_PLACESが返る", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &mockPlacesClient{Results: []PlaceResult{}}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		var result map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response body: %v", err)
		}
		if result["code"] != "NO_NEARBY_PLACES" {
			t.Errorf("Expected code 'NO_NEARBY_PLACES', got '%s'", result["code"])
		}
	})

	t.Run("APIエラー時にcodeフィールドにINTERNAL_ERRORが返る", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &mockPlacesClient{Err: fmt.Errorf("API key invalid")}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		var result map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response body: %v", err)
		}
		if result["code"] != "INTERNAL_ERROR" {
			t.Errorf("Expected code 'INTERNAL_ERROR', got '%s'", result["code"])
		}
	})
}

func TestSuggestDailyCache(t *testing.T) {
	if testRedisClient == nil {
		t.Skip("Redis not available")
	}

	mockPlaces := []PlaceResult{
		{PlaceID: "place_1", Name: "Cafe Alpha", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "place_2", Name: "Park Beta", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"park"}},
		{PlaceID: "place_3", Name: "Restaurant Gamma", Vicinity: "渋谷区3-3", Lat: 35.6780, Lng: 139.6520, Rating: 3.8, Types: []string{"restaurant"}},
		{PlaceID: "place_4", Name: "Museum Delta", Vicinity: "渋谷区4-4", Lat: 35.6790, Lng: 139.6530, Rating: 4.5, Types: []string{"museum"}},
		{PlaceID: "place_5", Name: "Bar Epsilon", Vicinity: "渋谷区5-5", Lat: 35.6800, Lng: 139.6540, Rating: 3.5, Types: []string{"bar"}},
	}

	t.Run("レスポンスが配列（最大3件）で返される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		if len(resp) == 0 || len(resp) > 3 {
			t.Errorf("Expected 1-3 places, got %d", len(resp))
		}
	})

	t.Run("2回目のリクエストでキャッシュヒット→同じ結果が返る", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		// 1回目のリクエスト
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w1, req1)

		if w1.Code != http.StatusOK {
			t.Fatalf("1st request: Expected status %d, got %d. Body: %s", http.StatusOK, w1.Code, w1.Body.String())
		}

		resp1 := parseSuggestions(t, w1.Body.Bytes())

		// 2回目のリクエスト
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusOK {
			t.Fatalf("2nd request: Expected status %d, got %d. Body: %s", http.StatusOK, w2.Code, w2.Body.String())
		}

		resp2 := parseSuggestions(t, w2.Body.Bytes())

		// 同じ結果が返ることを確認
		if len(resp1) != len(resp2) {
			t.Fatalf("Expected same number of places, got %d and %d", len(resp1), len(resp2))
		}
		for i := range resp1 {
			if resp1[i].PlaceID != resp2[i].PlaceID {
				t.Errorf("Place %d: expected PlaceID '%s', got '%s'", i, resp1[i].PlaceID, resp2[i].PlaceID)
			}
		}
	})

	t.Run("キャッシュヒット時はPlaces APIが呼ばれない", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		// 1回目のリクエスト（APIが呼ばれる）
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w1, req1)

		callsAfterFirst := mock.CallCount

		// 2回目のリクエスト（キャッシュヒット→APIは呼ばれない）
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		if mock.CallCount != callsAfterFirst {
			t.Errorf("Expected Places API not to be called on cache hit, but CallCount went from %d to %d", callsAfterFirst, mock.CallCount)
		}
	})

	t.Run("施設数が3未満でも全て返される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		twoPlaces := []PlaceResult{
			{PlaceID: "place_1", Name: "Cafe Alpha", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
			{PlaceID: "place_2", Name: "Park Beta", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"park"}},
		}

		mock := &trackingMockPlacesClient{Results: twoPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		if len(resp) != 2 {
			t.Errorf("Expected 2 places, got %d", len(resp))
		}
	})

	t.Run("訪問済み施設は日次キャッシュから除外される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		// place_1を訪問済みにする
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_1",
			PlaceName: "Cafe Alpha",
			Latitude:  35.6762,
			Longitude: 139.6503,
			VisitedAt: time.Now(),
		})

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		for _, p := range resp {
			if p.PlaceID == "place_1" {
				t.Error("Expected visited place_1 to be excluded from suggestions")
			}
		}
	})

	t.Run("日次キャッシュヒット後でも訪問済みの施設は除外される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		// 1回目: キャッシュ作成
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w1, req1)

		if w1.Code != http.StatusOK {
			t.Fatalf("1st request: Expected status %d, got %d. Body: %s", http.StatusOK, w1.Code, w1.Body.String())
		}

		resp1 := parseSuggestions(t, w1.Body.Bytes())
		initialCount := len(resp1)

		if initialCount == 0 {
			t.Fatal("Expected at least 1 place in initial response")
		}

		// キャッシュ作成後に最初の施設を訪問済みにする
		visitedPlaceID := resp1[0].PlaceID
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   visitedPlaceID,
			PlaceName: resp1[0].Name,
			Latitude:  resp1[0].Lat,
			Longitude: resp1[0].Lng,
			VisitedAt: time.Now(),
		})

		// 2回目: キャッシュヒットするが訪問済み施設は除外されるべき
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusOK {
			t.Fatalf("2nd request: Expected status %d, got %d. Body: %s", http.StatusOK, w2.Code, w2.Body.String())
		}

		resp2 := parseSuggestions(t, w2.Body.Bytes())

		// 訪問済み施設が除外されている
		for _, p := range resp2 {
			if p.PlaceID == visitedPlaceID {
				t.Errorf("Expected visited place '%s' to be excluded from cached suggestions", visitedPlaceID)
			}
		}

		// 件数が減っている
		if len(resp2) >= initialCount {
			t.Errorf("Expected fewer places after visiting one (initial: %d, after: %d)", initialCount, len(resp2))
		}
	})

	t.Run("日次提案の全施設を訪問済みにした後に再リクエストすると429が返る", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		// 1回目: 日次提案を取得してキャッシュを作成
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w1, req1)

		if w1.Code != http.StatusOK {
			t.Fatalf("1st request: Expected status %d, got %d. Body: %s", http.StatusOK, w1.Code, w1.Body.String())
		}

		resp1 := parseSuggestions(t, w1.Body.Bytes())

		if len(resp1) == 0 {
			t.Fatal("Expected at least 1 place in initial response")
		}

		// 提案された全施設を訪問済みにする
		for _, p := range resp1 {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   p.PlaceID,
				PlaceName: p.Name,
				Latitude:  p.Lat,
				Longitude: p.Lng,
				VisitedAt: time.Now(),
			})
		}

		// 2回目: 日次提案が全て訪問済みなので拒否されるべき
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusTooManyRequests {
			t.Errorf("Expected status %d (Too Many Requests) after all daily suggestions visited, got %d. Body: %s",
				http.StatusTooManyRequests, w2.Code, w2.Body.String())
		}

		var errResp map[string]string
		json.Unmarshal(w2.Body.Bytes(), &errResp)
		if errResp["code"] != "daily_limit_reached" {
			t.Errorf("Expected error code 'daily_limit_reached', got '%s'", errResp["code"])
		}
	})
}

// TestInterestUpdateDoesNotResetDailyLimit は Issue #166 の回帰テスト
// 全提案を使い切った後に興味タグを変更しても、3件提案の権利は復活しないことを確認する
func TestInterestUpdateDoesNotResetDailyLimit(t *testing.T) {
	mockPlaces := []PlaceResult{
		{PlaceID: "place_1", Name: "Cafe Alpha", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "place_2", Name: "Park Beta", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"park"}},
		{PlaceID: "place_3", Name: "Restaurant Gamma", Vicinity: "渋谷区3-3", Lat: 35.6780, Lng: 139.6520, Rating: 3.8, Types: []string{"restaurant"}},
		{PlaceID: "place_4", Name: "Bar Delta", Vicinity: "渋谷区4-4", Lat: 35.6790, Lng: 139.6530, Rating: 3.5, Types: []string{"bar"}},
	}

	t.Run("全提案を訪問済み後に興味タグ変更しても日次上限は復活しない", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		if testRedisClient == nil {
			t.Skip("Redis not available")
		}

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		// ステップ1: 日次提案を取得
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w1, req1)

		if w1.Code != http.StatusOK {
			t.Fatalf("1st request: Expected status %d, got %d. Body: %s", http.StatusOK, w1.Code, w1.Body.String())
		}

		resp1 := parseSuggestions(t, w1.Body.Bytes())
		if len(resp1) == 0 {
			t.Fatal("Expected at least 1 place in initial response")
		}

		// ステップ2: 提案された全施設を訪問済みにする
		for _, p := range resp1 {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   p.PlaceID,
				PlaceName: p.Name,
				Latitude:  p.Lat,
				Longitude: p.Lng,
				VisitedAt: time.Now(),
			})
		}

		// ステップ3: 全訪問済みで再リクエスト → 429 + exhaustedフラグが立つ
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusTooManyRequests {
			t.Fatalf("全訪問後は429が返るはず: Expected status %d, got %d. Body: %s",
				http.StatusTooManyRequests, w2.Code, w2.Body.String())
		}

		// ステップ4: 興味タグ変更を模倣して提案リストキャッシュのみをクリアする
		// （実際には UpdateInterests → ClearDailySuggestionsCache が呼ばれる。exhaustedフラグは消えない）
		userIDStr := fmt.Sprintf("%d", user.ID)
		database.ClearDailySuggestionsCache(context.Background(), testRedisClient, userIDStr)

		// ステップ5: キャッシュクリア後に再リクエスト → 429 が引き続き返るべき
		w3 := httptest.NewRecorder()
		req3, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req3.Header.Set("Content-Type", "application/json")
		req3.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w3, req3)

		if w3.Code != http.StatusTooManyRequests {
			t.Errorf("興味タグ変更後も日次上限は有効なはず: Expected status %d, got %d. Body: %s",
				http.StatusTooManyRequests, w3.Code, w3.Body.String())
		}

		var errResp map[string]string
		json.Unmarshal(w3.Body.Bytes(), &errResp)
		if errResp["code"] != "daily_limit_reached" {
			t.Errorf("Expected error code 'daily_limit_reached', got '%s'", errResp["code"])
		}
	})
}

func TestPersonalizedSuggest(t *testing.T) {
	// 興味内: cafe（"カフェ"）、興味外: museum（"博物館・科学館"）
	cafePlaces := []PlaceResult{
		{PlaceID: "cafe_1", Name: "カフェA", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "cafe_2", Name: "カフェB", Vicinity: "渋谷区1-2", Lat: 35.6763, Lng: 139.6504, Rating: 4.0, Types: []string{"cafe"}},
		{PlaceID: "cafe_3", Name: "カフェC", Vicinity: "渋谷区1-3", Lat: 35.6764, Lng: 139.6505, Rating: 3.8, Types: []string{"cafe"}},
	}
	museumPlaces := []PlaceResult{
		{PlaceID: "museum_1", Name: "博物館A", Vicinity: "渋谷区2-1", Lat: 35.6770, Lng: 139.6510, Rating: 4.5, Types: []string{"museum"}},
		{PlaceID: "museum_2", Name: "博物館B", Vicinity: "渋谷区2-2", Lat: 35.6771, Lng: 139.6511, Rating: 4.3, Types: []string{"museum"}},
		{PlaceID: "museum_3", Name: "博物館C", Vicinity: "渋谷区2-3", Lat: 35.6772, Lng: 139.6512, Rating: 4.1, Types: []string{"museum"}},
		{PlaceID: "museum_4", Name: "博物館D", Vicinity: "渋谷区2-4", Lat: 35.6773, Lng: 139.6513, Rating: 3.9, Types: []string{"museum"}},
	}
	mixedPlaces := append(cafePlaces, museumPlaces...)

	t.Run("興味タグありユーザーへの提案で興味内施設が優先される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		// "カフェ" ジャンルタグのIDを取得して興味タグに設定
		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		mock := &mockPlacesClient{Results: mixedPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		if len(resp) == 0 {
			t.Fatal("Expected at least 1 place")
		}

		// 3件中少なくとも2件はcafe（興味内）であることを確認
		cafeCount := 0
		for _, p := range resp {
			for _, typ := range p.Types {
				if typ == "cafe" {
					cafeCount++
					break
				}
			}
		}
		if cafeCount < 2 {
			t.Errorf("Expected at least 2 cafe places (interest), got %d", cafeCount)
		}
	})

	t.Run("興味外施設が3件中1件混在する（脱却提案）", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		mock := &mockPlacesClient{Results: mixedPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		// 3件返される
		if len(resp) != 3 {
			t.Errorf("Expected 3 places, got %d", len(resp))
		}

		// museum（興味外）が少なくとも1件含まれる
		museumCount := 0
		for _, p := range resp {
			for _, typ := range p.Types {
				if typ == "museum" {
					museumCount++
					break
				}
			}
		}
		if museumCount < 1 {
			t.Errorf("Expected at least 1 museum place (out-of-interest for comfort zone break), got %d", museumCount)
		}
	})

	t.Run("興味タグ未設定ユーザーはフォールバック（従来ランダム）で3件返される", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)
		// 興味タグを設定しない

		mock := &mockPlacesClient{Results: mixedPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		if len(resp) == 0 || len(resp) > 3 {
			t.Errorf("Expected 1-3 places (fallback random), got %d", len(resp))
		}
	})

	t.Run("興味内施設のみの場合は全件が興味内になる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		mock := &mockPlacesClient{Results: cafePlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())

		// 全3件がcafe（興味内のみ）
		if len(resp) != 3 {
			t.Errorf("Expected 3 places, got %d", len(resp))
		}
		for _, p := range resp {
			isCafe := false
			for _, typ := range p.Types {
				if typ == "cafe" {
					isCafe = true
					break
				}
			}
			if !isCafe {
				t.Errorf("Expected all places to be cafe, but got %v", p.Types)
			}
		}
	})

	t.Run("興味タグありで半径内に興味内施設が0件の場合にNO_INTEREST_PLACESが返る", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		// カフェに興味タグを設定するが、APIが返す施設はカフェ以外（博物館）のみ
		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		mock := &mockPlacesClient{Results: museumPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var result struct {
			Places []PlaceResult `json:"places"`
			Notice string        `json:"notice"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response: %v. Body: %s", err, w.Body.String())
		}

		// 興味外からフォールバックして施設は返される
		if len(result.Places) == 0 {
			t.Error("Expected places to be returned (fallback to out-of-interest) even when no interest tag matches")
		}

		// NO_INTEREST_PLACES の notice が付いている
		if result.Notice != "NO_INTEREST_PLACES" {
			t.Errorf("Expected notice 'NO_INTEREST_PLACES', got '%s'", result.Notice)
		}
	})
}

func TestSuggestRadiusLimit(t *testing.T) {
	// ユーザー作成
	user := models.User{
		Email:       "radius-test@example.com",
		DisplayName: "Radius Tester",
	}
	testDB.Create(&user)
	defer testDB.Delete(&user)

	token := generateTestToken(user.ID)

	t.Run("radius=60000 should be limited to 50000", func(t *testing.T) {
		mock := &trackingMockPlacesClient{
			Results: []PlaceResult{
				{PlaceID: "place1", Name: "Test Place 1", Types: []string{"restaurant"}},
			},
			Err: nil,
		}

		handler := &SuggestionHandler{
			DB:          testDB,
			RedisClient: nil,
			Places:      mock,
		}

		r := gin.New()
		r.POST("/api/suggestions", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), handler.Suggest)

		reqBody := suggestionRequest{
			Lat:    35.6762,
			Lng:    139.6503,
			Radius: 60000, // 超過値
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/suggestions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != 200 {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		// 実際にAPIに渡された半径が50000に制限されているかチェック
		if mock.LastRadius != 50000 {
			t.Errorf("Expected radius to be limited to 50000, got %d", mock.LastRadius)
		}
	})

	t.Run("radius=30000 should remain 30000", func(t *testing.T) {
		mock := &trackingMockPlacesClient{
			Results: []PlaceResult{
				{PlaceID: "place2", Name: "Test Place 2", Types: []string{"cafe"}},
			},
			Err: nil,
		}

		handler := &SuggestionHandler{
			DB:          testDB,
			RedisClient: nil,
			Places:      mock,
		}

		r := gin.New()
		r.POST("/api/suggestions", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), handler.Suggest)

		reqBody := suggestionRequest{
			Lat:    35.6762,
			Lng:    139.6503,
			Radius: 30000, // 正常値
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/suggestions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != 200 {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		// 実際にAPIに渡された半径が30000のまま維持されているかチェック
		if mock.LastRadius != 30000 {
			t.Errorf("Expected radius to remain 30000, got %d", mock.LastRadius)
		}
	})

	t.Run("ユーザーのsearch_radius設定値が提案APIのデフォルト半径として使われる", func(t *testing.T) {
		// search_radius を 10000 に設定したユーザー
		userWithRadius := models.User{
			Email:        "radius-custom@example.com",
			DisplayName:  "Custom Radius Tester",
			SearchRadius: 10000,
		}
		testDB.Create(&userWithRadius)
		defer testDB.Delete(&userWithRadius)

		customToken := generateTestToken(userWithRadius.ID)

		mock := &trackingMockPlacesClient{
			Results: []PlaceResult{
				{PlaceID: "place_r", Name: "Test Place R", Types: []string{"cafe"}},
			},
			Err: nil,
		}

		handler := &SuggestionHandler{
			DB:          testDB,
			RedisClient: nil,
			Places:      mock,
		}

		r := gin.New()
		r.POST("/api/suggestions", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), handler.Suggest)

		reqBody := suggestionRequest{
			Lat: 35.6762,
			Lng: 139.6503,
			// Radius未指定 → ユーザー設定値10000が使われるべき
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/suggestions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+customToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != 200 {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		if mock.LastRadius != 10000 {
			t.Errorf("Expected radius 10000 from user setting, got %d", mock.LastRadius)
		}
	})

	t.Run("radius=0 のときユーザーのsearch_radius設定値(デフォルト5000)が使われる", func(t *testing.T) {
		mock := &trackingMockPlacesClient{
			Results: []PlaceResult{
				{PlaceID: "place3", Name: "Test Place 3", Types: []string{"park"}},
			},
			Err: nil,
		}

		handler := &SuggestionHandler{
			DB:          testDB,
			RedisClient: nil,
			Places:      mock,
		}

		r := gin.New()
		r.POST("/api/suggestions", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), handler.Suggest)

		reqBody := suggestionRequest{
			Lat: 35.6762,
			Lng: 139.6503,
			// Radius未指定（0になる）→ ユーザーのsearch_radius（DB デフォルト 5000）が使われる
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/suggestions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != 200 {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		// ユーザーのsearch_radius（DBデフォルト5000）が使われる
		if mock.LastRadius != 5000 {
			t.Errorf("Expected default radius to be 5000 (user's search_radius), got %d", mock.LastRadius)
		}
	})
}

// TestBreakoutModeSuggestion は Issue #179 の脱却モードテスト
// 提案APIレスポンスの各施設に is_interest_match フラグが正しく設定されることを確認する
func TestBreakoutModeSuggestion(t *testing.T) {
	cafePlaces := []PlaceResult{
		{PlaceID: "cafe_bm_1", Name: "カフェA", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "cafe_bm_2", Name: "カフェB", Vicinity: "渋谷区1-2", Lat: 35.6763, Lng: 139.6504, Rating: 4.0, Types: []string{"cafe"}},
	}
	museumPlaces := []PlaceResult{
		{PlaceID: "museum_bm_1", Name: "博物館A", Vicinity: "渋谷区2-1", Lat: 35.6770, Lng: 139.6510, Rating: 4.5, Types: []string{"museum"}},
		{PlaceID: "museum_bm_2", Name: "博物館B", Vicinity: "渋谷区2-2", Lat: 35.6771, Lng: 139.6511, Rating: 4.3, Types: []string{"museum"}},
	}
	mixedPlaces := append(cafePlaces, museumPlaces...)

	t.Run("興味タグありユーザーへの提案でis_interest_matchフラグが含まれる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		mock := &mockPlacesClient{Results: mixedPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		// is_interest_match フィールドを確認するために生のJSONをデコード
		var result struct {
			Places []struct {
				PlaceID        string   `json:"place_id"`
				Types          []string `json:"types"`
				IsInterestMatch *bool   `json:"is_interest_match"`
			} `json:"places"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response: %v. Body: %s", err, w.Body.String())
		}

		if len(result.Places) == 0 {
			t.Fatal("Expected at least 1 place")
		}

		// 全施設に is_interest_match が設定されており、値が正しいことを確認
		for _, p := range result.Places {
			if p.IsInterestMatch == nil {
				t.Errorf("Place %s: expected is_interest_match to be set (not nil)", p.PlaceID)
				continue
			}
			isCafe := false
			for _, typ := range p.Types {
				if typ == "cafe" {
					isCafe = true
					break
				}
			}
			if isCafe && !*p.IsInterestMatch {
				t.Errorf("Place %s (cafe): expected is_interest_match=true, got false", p.PlaceID)
			}
			if !isCafe && *p.IsInterestMatch {
				t.Errorf("Place %s (museum): expected is_interest_match=false, got true", p.PlaceID)
			}
		}
	})

	t.Run("興味タグなしユーザーへの提案でis_interest_matchはnil", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)
		// 興味タグを設定しない

		mock := &mockPlacesClient{Results: mixedPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":    35.6762,
			"lng":    139.6503,
			"radius": 3000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var result struct {
			Places []struct {
				PlaceID        string `json:"place_id"`
				IsInterestMatch *bool `json:"is_interest_match"`
			} `json:"places"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response: %v. Body: %s", err, w.Body.String())
		}

		for _, p := range result.Places {
			if p.IsInterestMatch != nil {
				t.Errorf("Place %s: expected is_interest_match=nil (no interest tags), got %v", p.PlaceID, *p.IsInterestMatch)
			}
		}
	})
}
