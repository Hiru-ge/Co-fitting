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
	"github.com/Hiru-ge/roamble/services"
	"github.com/gin-gonic/gin"
)

type mockPlacesClient struct {
	Results []services.PlaceResult
	Err     error
}

func (m *mockPlacesClient) NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]services.PlaceResult, error) {
	return m.Results, m.Err
}

// trackingMockPlacesClient はAPI呼び出し回数を追跡するモック
type trackingMockPlacesClient struct {
	Results    []services.PlaceResult
	Err        error
	CallCount  int
	LastRadius uint
}

func (m *trackingMockPlacesClient) NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]services.PlaceResult, error) {
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
	database.DeleteKeysByPattern(ctx, testRedisClient, "suggestion:*")  //nolint:errcheck
	database.DeleteKeysByPattern(ctx, testRedisClient, "suggestions:*") //nolint:errcheck
}

// parseSuggestions は SuggestionResult ラッパーから []services.PlaceResult を取り出すテストヘルパー
func parseSuggestions(t *testing.T, body []byte) []services.PlaceResult {
	t.Helper()
	var result struct {
		Places []services.PlaceResult `json:"places"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("Failed to parse suggestion response: %v. Body: %s", err, string(body))
	}
	return result.Places
}

func createTestUser(t *testing.T) models.User {
	t.Helper()
	return createTestUserByEmail(t, "suggest@example.com", "Suggest User")
}

func TestSuggest(t *testing.T) {
	mockPlaces := []services.PlaceResult{
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

		mock := &mockPlacesClient{Results: []services.PlaceResult{}}
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

		mixedPlaces := []services.PlaceResult{
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

		onlyBadPlaces := []services.PlaceResult{
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

	t.Run("全施設訪問済みで200+is_completedフラグが返る", func(t *testing.T) {
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

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var result struct {
			IsCompleted bool                   `json:"is_completed"`
			Places      []services.PlaceResult `json:"places"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response body: %v", err)
		}
		if !result.IsCompleted {
			t.Errorf("Expected is_completed=true, got false. Body: %s", w.Body.String())
		}
		if len(result.Places) != 0 {
			t.Errorf("Expected empty places when is_completed, got %d places", len(result.Places))
		}
	})

	t.Run("周辺施設なしでcodeフィールドにNO_NEARBY_PLACESが返る", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &mockPlacesClient{Results: []services.PlaceResult{}}
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

	mockPlaces := []services.PlaceResult{
		{PlaceID: "place_1", Name: "Cafe Alpha", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "place_2", Name: "Bowling Beta", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"bowling_alley"}},
		{PlaceID: "place_3", Name: "Restaurant Gamma", Vicinity: "渋谷区3-3", Lat: 35.6780, Lng: 139.6520, Rating: 3.8, Types: []string{"restaurant"}},
		{PlaceID: "place_4", Name: "Karaoke Delta", Vicinity: "渋谷区4-4", Lat: 35.6790, Lng: 139.6530, Rating: 4.5, Types: []string{"karaoke"}},
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

		twoPlaces := []services.PlaceResult{
			{PlaceID: "place_1", Name: "Cafe Alpha", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
			{PlaceID: "place_2", Name: "Bar Beta", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"bar"}},
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

		// 2回目: 日次提案が全て訪問済みなので is_completed:true が返るべき
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusOK {
			t.Errorf("Expected status %d after all daily suggestions visited, got %d. Body: %s",
				http.StatusOK, w2.Code, w2.Body.String())
		}

		var completedResp struct {
			IsCompleted bool                   `json:"is_completed"`
			Places      []services.PlaceResult `json:"places"`
		}
		json.Unmarshal(w2.Body.Bytes(), &completedResp) //nolint:errcheck
		if !completedResp.IsCompleted {
			t.Errorf("Expected is_completed=true after all suggestions visited. Body: %s", w2.Body.String())
		}
	})
}

// TestInterestUpdateDoesNotResetDailyLimit は Issue #166 の回帰テスト
// 全提案を使い切った後に興味タグを変更しても、3件提案の権利は復活しないことを確認する
func TestInterestUpdateDoesNotResetDailyLimit(t *testing.T) {
	mockPlaces := []services.PlaceResult{
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

		// ステップ3: 全訪問済みで再リクエスト → is_completed:true + exhaustedフラグが立つ
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusOK {
			t.Fatalf("全訪問後はis_completed:trueが返るはず: Expected status %d, got %d. Body: %s",
				http.StatusOK, w2.Code, w2.Body.String())
		}

		var w2Resp struct {
			IsCompleted bool                   `json:"is_completed"`
			Places      []services.PlaceResult `json:"places"`
		}
		json.Unmarshal(w2.Body.Bytes(), &w2Resp) //nolint:errcheck
		if !w2Resp.IsCompleted {
			t.Fatalf("全訪問後はis_completed=trueが返るはず. Body: %s", w2.Body.String())
		}

		// ステップ4: 興味タグ変更を模倣（UpdateInterestsはキャッシュをクリアしない）
		// 興味タグの変更はDBレベルのみ。キャッシュは残るが、exhaustedフラグで日次上限が管理される

		// ステップ5: タグ変更後に再リクエスト → is_completed:true が引き続き返るべき（日次上限は復活しない）
		w3 := httptest.NewRecorder()
		req3, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req3.Header.Set("Content-Type", "application/json")
		req3.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w3, req3)

		if w3.Code != http.StatusOK {
			t.Errorf("興味タグ変更後も日次上限は有効なはず: Expected status %d, got %d. Body: %s",
				http.StatusOK, w3.Code, w3.Body.String())
		}

		var w3Resp struct {
			IsCompleted bool                   `json:"is_completed"`
			Places      []services.PlaceResult `json:"places"`
		}
		json.Unmarshal(w3.Body.Bytes(), &w3Resp) //nolint:errcheck
		if !w3Resp.IsCompleted {
			t.Errorf("興味タグ変更後も is_completed=true が返るはず（日次上限は復活しない）. Body: %s", w3.Body.String())
		}
	})
}

func TestPersonalizedSuggest(t *testing.T) {
	// 興味内: cafe（"カフェ"）、興味外: bowling_alley（"スポーツ施設"）
	cafePlaces := []services.PlaceResult{
		{PlaceID: "cafe_1", Name: "カフェA", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "cafe_2", Name: "カフェB", Vicinity: "渋谷区1-2", Lat: 35.6763, Lng: 139.6504, Rating: 4.0, Types: []string{"cafe"}},
		{PlaceID: "cafe_3", Name: "カフェC", Vicinity: "渋谷区1-3", Lat: 35.6764, Lng: 139.6505, Rating: 3.8, Types: []string{"cafe"}},
	}
	bowlingPlaces := []services.PlaceResult{
		{PlaceID: "bowling_1", Name: "ボウリング場A", Vicinity: "渋谷区2-1", Lat: 35.6770, Lng: 139.6510, Rating: 4.5, Types: []string{"bowling_alley"}},
		{PlaceID: "bowling_2", Name: "ボウリング場B", Vicinity: "渋谷区2-2", Lat: 35.6771, Lng: 139.6511, Rating: 4.3, Types: []string{"bowling_alley"}},
		{PlaceID: "bowling_3", Name: "ボウリング場C", Vicinity: "渋谷区2-3", Lat: 35.6772, Lng: 139.6512, Rating: 4.1, Types: []string{"bowling_alley"}},
		{PlaceID: "bowling_4", Name: "ボウリング場D", Vicinity: "渋谷区2-4", Lat: 35.6773, Lng: 139.6513, Rating: 3.9, Types: []string{"bowling_alley"}},
	}
	mixedPlaces := append(cafePlaces, bowlingPlaces...)

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

	t.Run("興味外施設が含まれるミックス環境でも3件が提案される（強制挿入なし）", func(t *testing.T) {
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
		// 強制挿入なし: is_interest_match フラグが設定されていること
		for _, p := range resp {
			if p.IsInterestMatch == nil {
				t.Errorf("Place %s: is_interest_match should be set (not nil) when interests are configured", p.PlaceID)
			}
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

		// カフェに興味タグを設定するが、APIが返す施設はカフェ以外（ボウリング場）のみ
		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		mock := &mockPlacesClient{Results: bowlingPlaces}
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
			Places []services.PlaceResult `json:"places"`
			Notice string                 `json:"notice"`
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
			Results: []services.PlaceResult{
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
			Results: []services.PlaceResult{
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
			Results: []services.PlaceResult{
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

	t.Run("radius=0 のときユーザーのsearch_radius設定値(デフォルト10000)が使われる", func(t *testing.T) {
		mock := &trackingMockPlacesClient{
			Results: []services.PlaceResult{
				{PlaceID: "place3", Name: "Test Place 3", Types: []string{"cafe"}},
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
			// Radius未指定（0になる）→ ユーザーのsearch_radius（DB デフォルト 10000）が使われる
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

		// ユーザーのsearch_radius（DBデフォルト10000）が使われる
		if mock.LastRadius != 10000 {
			t.Errorf("Expected default radius to be 10000 (user's search_radius), got %d", mock.LastRadius)
		}
	})
}

// === Issue #178: is_interest_match フラグのテスト ===
func TestInterestMatchFlag(t *testing.T) {
	cafePlaces := []services.PlaceResult{
		{PlaceID: "cafe_1", Name: "カフェA", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "cafe_2", Name: "カフェB", Vicinity: "渋谷区1-2", Lat: 35.6763, Lng: 139.6504, Rating: 4.0, Types: []string{"cafe"}},
		{PlaceID: "cafe_3", Name: "カフェC", Vicinity: "渋谷区1-3", Lat: 35.6764, Lng: 139.6505, Rating: 3.8, Types: []string{"cafe"}},
	}
	museumPlaces := []services.PlaceResult{
		{PlaceID: "museum_1", Name: "博物館A", Vicinity: "渋谷区2-1", Lat: 35.6770, Lng: 139.6510, Rating: 4.5, Types: []string{"museum"}},
		{PlaceID: "museum_2", Name: "博物館B", Vicinity: "渋谷区2-2", Lat: 35.6771, Lng: 139.6511, Rating: 4.3, Types: []string{"museum"}},
		{PlaceID: "museum_3", Name: "博物館C", Vicinity: "渋谷区2-3", Lat: 35.6772, Lng: 139.6512, Rating: 4.1, Types: []string{"museum"}},
		{PlaceID: "museum_4", Name: "博物館D", Vicinity: "渋谷区2-4", Lat: 35.6773, Lng: 139.6513, Rating: 3.9, Types: []string{"museum"}},
	}
	mixedPlaces := append(cafePlaces, museumPlaces...)

	t.Run("興味タグ一致施設は is_interest_match=true で返される", func(t *testing.T) {
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
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())
		if len(resp) == 0 {
			t.Fatal("Expected at least 1 place")
		}

		// cafeはis_interest_match=true、museumはfalseであることを確認
		for _, p := range resp {
			isCafe := false
			for _, typ := range p.Types {
				if typ == "cafe" {
					isCafe = true
					break
				}
			}
			if isCafe && (p.IsInterestMatch == nil || !*p.IsInterestMatch) {
				t.Errorf("cafe place '%s' should have is_interest_match=true, got %v", p.PlaceID, p.IsInterestMatch)
			}
			if !isCafe && p.IsInterestMatch != nil && *p.IsInterestMatch {
				t.Errorf("museum place '%s' should have is_interest_match=false, got true", p.PlaceID)
			}
		}
	})

	t.Run("興味タグ未設定ユーザーは全施設が is_interest_match=false", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)
		// 興味タグを設定しない

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
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())
		for _, p := range resp {
			if p.IsInterestMatch != nil && *p.IsInterestMatch {
				t.Errorf("place '%s' should have is_interest_match=nil or false when no interests set, got true", p.PlaceID)
			}
		}
	})
}

// TestBreakoutModeSuggestion は Issue #179 の脱却モードテスト
// 提案APIレスポンスの各施設に is_interest_match フラグが正しく設定されることを確認する
func TestBreakoutModeSuggestion(t *testing.T) {
	cafePlaces := []services.PlaceResult{
		{PlaceID: "cafe_bm_1", Name: "カフェA", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "cafe_bm_2", Name: "カフェB", Vicinity: "渋谷区1-2", Lat: 35.6763, Lng: 139.6504, Rating: 4.0, Types: []string{"cafe"}},
	}
	museumPlaces := []services.PlaceResult{
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
				PlaceID         string   `json:"place_id"`
				Types           []string `json:"types"`
				IsInterestMatch *bool    `json:"is_interest_match"`
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
				PlaceID         string `json:"place_id"`
				IsInterestMatch *bool  `json:"is_interest_match"`
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

// === Issue #184: 提案リロード機能テスト ===

func TestSuggestForceReload(t *testing.T) {
	if testRedisClient == nil {
		t.Skip("Redis not available")
	}

	mockPlaces := []services.PlaceResult{
		{PlaceID: "place_1", Name: "Cafe Alpha", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "place_2", Name: "Park Beta", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"park"}},
		{PlaceID: "place_3", Name: "Restaurant Gamma", Vicinity: "渋谷区3-3", Lat: 35.6780, Lng: 139.6520, Rating: 3.8, Types: []string{"restaurant"}},
		{PlaceID: "place_4", Name: "Museum Delta", Vicinity: "渋谷区4-4", Lat: 35.6790, Lng: 139.6530, Rating: 4.5, Types: []string{"museum"}},
		{PlaceID: "place_5", Name: "Bar Epsilon", Vicinity: "渋谷区5-5", Lat: 35.6800, Lng: 139.6540, Rating: 3.5, Types: []string{"bar"}},
	}

	t.Run("is_reload=trueで3回を超えるリクエストは429を返す", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		// 初回通常リクエスト（リロードカウントを消費しない）
		body := map[string]interface{}{
			"lat": 35.6762,
			"lng": 139.6503,
		}
		jsonBody, _ := json.Marshal(body)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Initial request: Expected 200, got %d. Body: %s", w.Code, w.Body.String())
		}

		// is_reload=true で3回リロード（すべて成功するはず）
		for i := 1; i <= 3; i++ {
			reloadBody := map[string]interface{}{
				"lat":       35.6762,
				"lng":       139.6503,
				"is_reload": true,
			}
			reloadJSON, _ := json.Marshal(reloadBody)
			rw := httptest.NewRecorder()
			rr, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(reloadJSON))
			rr.Header.Set("Content-Type", "application/json")
			rr.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
			router.ServeHTTP(rw, rr)
			if rw.Code != http.StatusOK {
				t.Fatalf("IsReload %d: Expected 200, got %d. Body: %s", i, rw.Code, rw.Body.String())
			}
		}

		// 4回目のリロードは429を返すべき
		reloadBody := map[string]interface{}{
			"lat":       35.6762,
			"lng":       139.6503,
			"is_reload": true,
		}
		reloadJSON, _ := json.Marshal(reloadBody)
		rw := httptest.NewRecorder()
		rr, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(reloadJSON))
		rr.Header.Set("Content-Type", "application/json")
		rr.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(rw, rr)

		if rw.Code != http.StatusTooManyRequests {
			t.Errorf("4th reload: Expected 429, got %d. Body: %s", rw.Code, rw.Body.String())
		}

		var errResp map[string]interface{}
		json.Unmarshal(rw.Body.Bytes(), &errResp) //nolint:errcheck
		if errResp["code"] != "RELOAD_LIMIT_REACHED" {
			t.Errorf("Expected code 'RELOAD_LIMIT_REACHED', got '%v'", errResp["code"])
		}
	})

	t.Run("is_reload=trueでキャッシュがクリアされ新しい提案が生成される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		// 初回通常リクエスト
		body := map[string]interface{}{
			"lat": 35.6762,
			"lng": 139.6503,
		}
		jsonBody, _ := json.Marshal(body)
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w1, req1)

		callsAfterFirst := mock.CallCount

		// 通常の2回目リクエスト（キャッシュヒットするのでAPI呼び出しなし）
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)
		if mock.CallCount != callsAfterFirst {
			t.Errorf("Normal 2nd request should use cache, but API was called")
		}

		// is_reload=true でリクエスト（キャッシュクリアされるのでAPI呼び出しあり）
		reloadBody := map[string]interface{}{
			"lat":       35.6762,
			"lng":       139.6503,
			"is_reload": true,
		}
		reloadJSON, _ := json.Marshal(reloadBody)
		w3 := httptest.NewRecorder()
		req3, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(reloadJSON))
		req3.Header.Set("Content-Type", "application/json")
		req3.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w3, req3)

		if w3.Code != http.StatusOK {
			t.Fatalf("IsReload request: Expected 200, got %d. Body: %s", w3.Code, w3.Body.String())
		}
		// Places APIが再度呼び出されたことを確認（キャッシュクリアによる）
		if mock.CallCount <= callsAfterFirst {
			t.Errorf("Expected Places API to be called again on reload, but CallCount stayed at %d", mock.CallCount)
		}
	})

	t.Run("通常リクエストはリロードカウントを消費しない", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		// 通常リクエストを5回実行しても全て成功する
		for i := 0; i < 5; i++ {
			body := map[string]interface{}{
				"lat": 35.6762,
				"lng": 139.6503,
			}
			jsonBody, _ := json.Marshal(body)
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
			router.ServeHTTP(w, req)
			if w.Code != http.StatusOK {
				t.Fatalf("Normal request %d: Expected 200, got %d. Body: %s", i+1, w.Code, w.Body.String())
			}
		}
	})

	t.Run("レスポンスにreload_count_remainingが含まれる", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		// 通常リクエスト（リロード0回の状態）
		body := map[string]interface{}{
			"lat": 35.6762,
			"lng": 139.6503,
		}
		jsonBody, _ := json.Marshal(body)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d. Body: %s", w.Code, w.Body.String())
		}

		var result struct {
			Places               []services.PlaceResult `json:"places"`
			ReloadCountRemaining *int                   `json:"reload_count_remaining"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response: %v. Body: %s", err, w.Body.String())
		}

		if result.ReloadCountRemaining == nil {
			t.Fatal("Expected reload_count_remaining to be present in response")
		}
		if *result.ReloadCountRemaining != 3 {
			t.Errorf("Expected reload_count_remaining=3, got %d", *result.ReloadCountRemaining)
		}

		// リロード1回後
		reloadBody := map[string]interface{}{
			"lat":       35.6762,
			"lng":       139.6503,
			"is_reload": true,
		}
		reloadJSON, _ := json.Marshal(reloadBody)
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(reloadJSON))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		var result2 struct {
			Places               []services.PlaceResult `json:"places"`
			ReloadCountRemaining *int                   `json:"reload_count_remaining"`
		}
		json.Unmarshal(w2.Body.Bytes(), &result2) //nolint:errcheck
		if result2.ReloadCountRemaining == nil || *result2.ReloadCountRemaining != 2 {
			remaining := -1
			if result2.ReloadCountRemaining != nil {
				remaining = *result2.ReloadCountRemaining
			}
			t.Errorf("After 1 reload: Expected reload_count_remaining=2, got %d", remaining)
		}
	})

	t.Run("DailyLimitReached状態ではis_reloadでもis_completedが返る", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mock := &trackingMockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		// 初回リクエスト
		body := map[string]interface{}{
			"lat": 35.6762,
			"lng": 139.6503,
		}
		jsonBody, _ := json.Marshal(body)
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w1, req1)

		resp := parseSuggestions(t, w1.Body.Bytes())
		// 全施設訪問済みにする
		for _, p := range resp {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   p.PlaceID,
				PlaceName: p.Name,
				Latitude:  p.Lat,
				Longitude: p.Lng,
				VisitedAt: time.Now(),
			})
		}

		// 全訪問後に通常リクエスト → is_completed
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		var compResp struct {
			IsCompleted bool `json:"is_completed"`
		}
		json.Unmarshal(w2.Body.Bytes(), &compResp) //nolint:errcheck
		if !compResp.IsCompleted {
			t.Fatalf("Expected is_completed=true after all visited")
		}

		// is_reload=true でも is_completed が返るべき（日次上限を超えてリロードできない）
		reloadBody := map[string]interface{}{
			"lat":       35.6762,
			"lng":       139.6503,
			"is_reload": true,
		}
		reloadJSON, _ := json.Marshal(reloadBody)
		w3 := httptest.NewRecorder()
		req3, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(reloadJSON))
		req3.Header.Set("Content-Type", "application/json")
		req3.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w3, req3)

		if w3.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d. Body: %s", w3.Code, w3.Body.String())
		}

		var compResp2 struct {
			IsCompleted bool `json:"is_completed"`
		}
		json.Unmarshal(w3.Body.Bytes(), &compResp2) //nolint:errcheck
		if !compResp2.IsCompleted {
			t.Errorf("Expected is_completed=true even with force_reload after daily limit reached. Body: %s", w3.Body.String())
		}
	})

	t.Run("興味タグ変更後にis_reloadで新設定が反映される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		cafePlaces := []services.PlaceResult{
			{PlaceID: "cafe_r1", Name: "カフェR1", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
			{PlaceID: "cafe_r2", Name: "カフェR2", Vicinity: "渋谷区1-2", Lat: 35.6763, Lng: 139.6504, Rating: 4.0, Types: []string{"cafe"}},
			{PlaceID: "cafe_r3", Name: "カフェR3", Vicinity: "渋谷区1-3", Lat: 35.6764, Lng: 139.6505, Rating: 3.8, Types: []string{"cafe"}},
		}
		bowlingPlaces := []services.PlaceResult{
			{PlaceID: "bowling_r1", Name: "ボウリング場R1", Vicinity: "渋谷区2-1", Lat: 35.6770, Lng: 139.6510, Rating: 4.5, Types: []string{"bowling_alley"}},
			{PlaceID: "bowling_r2", Name: "ボウリング場R2", Vicinity: "渋谷区2-2", Lat: 35.6771, Lng: 139.6511, Rating: 4.3, Types: []string{"bowling_alley"}},
			{PlaceID: "bowling_r3", Name: "ボウリング場R3", Vicinity: "渋谷区2-3", Lat: 35.6772, Lng: 139.6512, Rating: 4.1, Types: []string{"bowling_alley"}},
		}
		allPlaces := append(cafePlaces, bowlingPlaces...)
		mock := &trackingMockPlacesClient{Results: allPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		// ステップ1: 興味タグなしで初回提案取得
		body := map[string]interface{}{
			"lat": 35.6762,
			"lng": 139.6503,
		}
		jsonBody, _ := json.Marshal(body)
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w1, req1)

		if w1.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d", w1.Code)
		}

		// ステップ2: カフェの興味タグを追加
		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})

		// ステップ3: 興味タグ変更（UpdateInterestsはキャッシュをクリアしない。is_reloadが自身でクリアする）

		// ステップ4: is_reload=true でリクエスト → キャッシュクリア＋カフェが優先される
		reloadBody := map[string]interface{}{
			"lat":       35.6762,
			"lng":       139.6503,
			"is_reload": true,
		}
		reloadJSON, _ := json.Marshal(reloadBody)
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(reloadJSON))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusOK {
			t.Fatalf("IsReload: Expected 200, got %d. Body: %s", w2.Code, w2.Body.String())
		}

		resp2 := parseSuggestions(t, w2.Body.Bytes())
		// パーソナライズにより興味内(cafe)が優先される
		cafeCount := 0
		for _, p := range resp2 {
			for _, typ := range p.Types {
				if typ == "cafe" {
					cafeCount++
					break
				}
			}
		}
		if cafeCount < 2 {
			t.Errorf("After interest update + reload: Expected at least 2 cafe places, got %d", cafeCount)
		}
	})
}

// TestCorruptedCacheHandling はキャッシュに破損したJSONが入っている場合に
// パニックせず、Places APIを再取得して正常な提案を返すことを確認する (Issue #203)
func TestCorruptedCacheHandling(t *testing.T) {
	if testRedisClient == nil {
		t.Skip("Redis not available")
	}

	mockPlaces := []services.PlaceResult{
		{PlaceID: "place_1", Name: "Cafe Alpha", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "place_2", Name: "Park Beta", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"park"}},
		{PlaceID: "place_3", Name: "Restaurant Gamma", Vicinity: "渋谷区3-3", Lat: 35.6780, Lng: 139.6520, Rating: 3.8, Types: []string{"restaurant"}},
	}

	t.Run("Redisキャッシュに破損JSONがある場合でもPlaces APIを呼び出して正常に提案を返す", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		// Redisに破損したJSONを設定
		ctx := context.Background()
		cacheKey := fmt.Sprintf("suggestions:%.4f:%.4f:%d", 35.6762, 139.6503, 3000)
		testRedisClient.Set(ctx, cacheKey, "this is not valid JSON{{{", 24*60*60*1000000000)

		trackingMock := &trackingMockPlacesClient{Results: mockPlaces}
		handler := &SuggestionHandler{
			DB:          testDB,
			RedisClient: testRedisClient,
			Places:      trackingMock,
		}

		r := gin.New()
		r.POST("/api/suggestions", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), handler.Suggest)

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
		r.ServeHTTP(w, req)

		// パニックせず正常なレスポンスが返ること
		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		// Places APIが呼び出されていること（キャッシュ破損時の再取得）
		if trackingMock.CallCount == 0 {
			t.Error("Expected Places API to be called when cache is corrupted, but it was not called")
		}

		// 正常な提案が返されること
		resp := parseSuggestions(t, w.Body.Bytes())
		if len(resp) == 0 {
			t.Error("Expected at least one place to be returned after corrupted cache fallback")
		}

		// キャッシュが有効なJSONで更新（または削除）されていること
		// → 次のリクエストでPlaces APIが再呼び出しされないことを確認
		trackingMock.CallCount = 0
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		r.ServeHTTP(w2, req2)

		if w2.Code != http.StatusOK {
			t.Errorf("Second request: Expected status %d, got %d. Body: %s", http.StatusOK, w2.Code, w2.Body.String())
		}
		// キャッシュが正常に更新されていれば、2回目はPlaces APIを呼ばない
		if trackingMock.CallCount != 0 {
			t.Error("After cache recovery, Places API should not be called again (cache should be valid)")
		}
	})
}

// TestProficiencyBasedComfortZone は Issue #198 の熟練度ベース脱却判定テスト
// 提案APIレスポンスに is_breakout フラグが設定されることを確認する
func TestProficiencyBasedComfortZone(t *testing.T) {
	cafePlaces := []services.PlaceResult{
		{PlaceID: "cafe_prof_1", Name: "カフェX", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "cafe_prof_2", Name: "カフェY", Vicinity: "渋谷区1-2", Lat: 35.6763, Lng: 139.6504, Rating: 4.0, Types: []string{"cafe"}},
		{PlaceID: "cafe_prof_3", Name: "カフェZ", Vicinity: "渋谷区1-3", Lat: 35.6764, Lng: 139.6505, Rating: 3.8, Types: []string{"cafe"}},
	}

	t.Run("初回訪問ユーザーへの提案にis_breakout=trueが設定される（熟練度Lv.1）", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)
		// 熟練度レコードなし（初回訪問想定）

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
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		// is_breakout フィールドを確認するために生のJSONをデコード
		var result struct {
			Places []struct {
				PlaceID    string `json:"place_id"`
				IsBreakout *bool  `json:"is_breakout"`
			} `json:"places"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response: %v. Body: %s", err, w.Body.String())
		}

		if len(result.Places) == 0 {
			t.Fatal("Expected at least 1 place")
		}

		// 全施設に is_breakout が設定されており、熟練度Lv.1（初回）は true であること
		for _, p := range result.Places {
			if p.IsBreakout == nil {
				t.Errorf("Place %s: expected is_breakout to be set (not nil) for first-time visitor", p.PlaceID)
				continue
			}
			if !*p.IsBreakout {
				t.Errorf("Place %s: expected is_breakout=true for first-time visitor (proficiency Lv.1), got false", p.PlaceID)
			}
		}
	})

	t.Run("熟練度Lv.2ジャンルの提案でもLv.5以下なのでis_breakout=trueになる", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		// カフェジャンルの熟練度をLv.2に設定（Lv.5以下なので脱却扱い）
		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		testDB.Create(&models.GenreProficiency{
			UserID:     user.ID,
			GenreTagID: cafeTag.ID,
			XP:         100,
			Level:      2,
		})

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
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var result struct {
			Places []struct {
				PlaceID    string `json:"place_id"`
				IsBreakout *bool  `json:"is_breakout"`
			} `json:"places"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response: %v. Body: %s", err, w.Body.String())
		}

		for _, p := range result.Places {
			if p.IsBreakout == nil {
				t.Errorf("Place %s: expected is_breakout to be set (not nil)", p.PlaceID)
				continue
			}
			if !*p.IsBreakout {
				t.Errorf("Place %s: expected is_breakout=true for cafe with proficiency Lv.2 (Lv.5以下), got false", p.PlaceID)
			}
		}
	})

	t.Run("selectPersonalizedPlacesは興味内2枠+完全ランダム1枠で選出する（Issue #222）", func(t *testing.T) {
		// 興味内ぴったり2件（2枠に対して2件）→ 必ず2件とも選ばれ、残り1枠は興味外から
		inInterest := []services.PlaceResult{
			{PlaceID: "cafe_sel_1", Types: []string{"cafe"}, IsInterestMatch: boolPtr(true)},
			{PlaceID: "cafe_sel_2", Types: []string{"cafe"}, IsInterestMatch: boolPtr(true)},
		}
		outOfInterest := []services.PlaceResult{
			{PlaceID: "museum_sel_1", Types: []string{"museum"}, IsInterestMatch: boolPtr(false)},
			{PlaceID: "museum_sel_2", Types: []string{"museum"}, IsInterestMatch: boolPtr(false)},
			{PlaceID: "museum_sel_3", Types: []string{"museum"}, IsInterestMatch: boolPtr(false)},
		}

		// 複数回試行しても常に同じパターンになることを確認
		const trials = 20
		for i := 0; i < trials; i++ {
			selected := services.SelectPersonalizedPlaces(inInterest, outOfInterest)

			if len(selected) != 3 {
				t.Fatalf("trial %d: Expected 3 selected places, got %d", i, len(selected))
			}

			// 興味内（cafe）が必ず2件含まれること（固定2枠）
			cafeCount := 0
			for _, p := range selected {
				for _, typ := range p.Types {
					if typ == "cafe" {
						cafeCount++
						break
					}
				}
			}
			if cafeCount != 2 {
				t.Errorf("trial %d: Expected exactly 2 cafe places (fixed interest slots), got %d", i, cafeCount)
			}

			// 残り1枠は興味外（museum）から選ばれること
			museumCount := 0
			for _, p := range selected {
				for _, typ := range p.Types {
					if typ == "museum" {
						museumCount++
						break
					}
				}
			}
			if museumCount != 1 {
				t.Errorf("trial %d: Expected exactly 1 museum place (random slot from outOfInterest), got %d", i, museumCount)
			}
		}
	})

	t.Run("selectPersonalizedPlacesは興味内3件以上あっても2枠に制限する（Issue #222）", func(t *testing.T) {
		// 興味内3件、興味外4件 → 2枠のみ興味内、1枠はすべての残り候補からランダム
		inInterest := []services.PlaceResult{
			{PlaceID: "cafe_sel_1", Types: []string{"cafe"}, IsInterestMatch: boolPtr(true)},
			{PlaceID: "cafe_sel_2", Types: []string{"cafe"}, IsInterestMatch: boolPtr(true)},
			{PlaceID: "cafe_sel_3", Types: []string{"cafe"}, IsInterestMatch: boolPtr(true)},
		}
		outOfInterest := []services.PlaceResult{
			{PlaceID: "museum_sel_1", Types: []string{"museum"}, IsInterestMatch: boolPtr(false)},
			{PlaceID: "museum_sel_2", Types: []string{"museum"}, IsInterestMatch: boolPtr(false)},
			{PlaceID: "museum_sel_3", Types: []string{"museum"}, IsInterestMatch: boolPtr(false)},
			{PlaceID: "museum_sel_4", Types: []string{"museum"}, IsInterestMatch: boolPtr(false)},
		}

		selected := services.SelectPersonalizedPlaces(inInterest, outOfInterest)

		if len(selected) != 3 {
			t.Fatalf("Expected 3 selected places, got %d", len(selected))
		}

		// 興味内は必ず2件（旧挙動の3件全取りは廃止）
		cafeCount := 0
		for _, p := range selected {
			for _, typ := range p.Types {
				if typ == "cafe" {
					cafeCount++
					break
				}
			}
		}
		if cafeCount < 2 {
			t.Errorf("Expected at least 2 cafe places (2 fixed interest slots), got %d", cafeCount)
		}
	})

	t.Run("selectPersonalizedPlacesは興味内が2未満の場合は全件使い残りをランダム補充", func(t *testing.T) {
		// 興味内1件のみ
		inInterest := []services.PlaceResult{
			{PlaceID: "cafe_sel_1", Types: []string{"cafe"}, IsInterestMatch: boolPtr(true)},
		}
		outOfInterest := []services.PlaceResult{
			{PlaceID: "museum_sel_1", Types: []string{"museum"}, IsInterestMatch: boolPtr(false)},
			{PlaceID: "museum_sel_2", Types: []string{"museum"}, IsInterestMatch: boolPtr(false)},
		}

		selected := services.SelectPersonalizedPlaces(inInterest, outOfInterest)

		if len(selected) != 3 {
			t.Errorf("Expected 3 selected places, got %d", len(selected))
		}
		// cafe が1件含まれること（興味内全件）
		cafeCount := 0
		for _, p := range selected {
			for _, typ := range p.Types {
				if typ == "cafe" {
					cafeCount++
					break
				}
			}
		}
		if cafeCount < 1 {
			t.Errorf("Expected at least 1 cafe place (inInterest), got %d", cafeCount)
		}
	})
}

// === スポーツ施設のジャンルマッピングテスト ===

// TestSportsVenueGenreMapping は bowling_alley タイプが "スポーツ施設" にマッピングされることを確認する
func TestSportsVenueGenreMapping(t *testing.T) {
	t.Run("bowling_alleyタイプはスポーツ施設にマッピングされる", func(t *testing.T) {
		name := services.GetGenreNameFromTypes([]string{"bowling_alley"})
		if name != "スポーツ施設" {
			t.Errorf("expected 'スポーツ施設', got '%s'", name)
		}
	})

	t.Run("スポーツ施設興味タグ設定ユーザーへのbowling_alley提案はis_interest_match=trueになる", func(t *testing.T) {
		cleanupUsers(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		var sportsTag models.GenreTag
		if err := testDB.Where("name = ?", "スポーツ施設").First(&sportsTag).Error; err != nil {
			t.Skip("スポーツ施設ジャンルタグが見つかりません")
		}
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: sportsTag.ID})

		bowlingPlaces := []services.PlaceResult{
			{PlaceID: "bowling_195_1", Name: "ボウリング場A", Vicinity: "渋谷区3-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.0, Types: []string{"bowling_alley"}},
			{PlaceID: "bowling_195_2", Name: "ボウリング場B", Vicinity: "渋谷区3-2", Lat: 35.6763, Lng: 139.6504, Rating: 3.8, Types: []string{"bowling_alley"}},
			{PlaceID: "bowling_195_3", Name: "ボウリング場C", Vicinity: "渋谷区3-3", Lat: 35.6764, Lng: 139.6505, Rating: 3.9, Types: []string{"bowling_alley"}},
		}
		mock := &mockPlacesClient{Results: bowlingPlaces}
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
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())
		if len(resp) == 0 {
			t.Fatal("Expected at least 1 place")
		}

		for _, p := range resp {
			if p.IsInterestMatch == nil || !*p.IsInterestMatch {
				t.Errorf("bowling_alley place '%s' should have is_interest_match=true (スポーツ施設 interest set), got %v", p.PlaceID, p.IsInterestMatch)
			}
		}
	})
}

func TestNewGenreTypeMapping(t *testing.T) {
	tests := []struct {
		placeType string
		genre     string
	}{
		{"ramen_restaurant", "ラーメン・麺類"},
		{"karaoke", "カラオケ"},
		{"amusement_center", "ゲームセンター"},
		{"video_arcade", "ゲームセンター"},
		{"public_bath", "温泉・銭湯"},
		{"sauna", "温泉・銭湯"},
		{"bowling_alley", "スポーツ施設"},
	}
	for _, tt := range tests {
		t.Run(tt.placeType+"→"+tt.genre, func(t *testing.T) {
			name := services.GetGenreNameFromTypes([]string{tt.placeType})
			if name != tt.genre {
				t.Errorf("expected '%s', got '%s'", tt.genre, name)
			}
		})
	}

	// services.VisitableTypes にも含まれていることを確認
	t.Run("ジャンルタイプがservices.VisitableTypesに含まれる", func(t *testing.T) {
		validTypes := []string{
			"ramen_restaurant", "karaoke", "amusement_center", "video_arcade",
			"public_bath", "sauna", "bowling_alley",
		}
		for _, tp := range validTypes {
			if !services.VisitableTypes[tp] {
				t.Errorf("'%s' should be in services.VisitableTypes", tp)
			}
		}
	})
}

func TestNewPlacesAPINearbySearch(t *testing.T) {
	t.Run("New API レスポンスが正しくPlaceResultに変換される", func(t *testing.T) {
		// New Places API (v1) 形式のレスポンスを返すモックサーバー
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// リクエスト検証
			if r.Method != "POST" {
				t.Errorf("expected POST, got %s", r.Method)
			}
			if r.URL.Path != "/v1/places:searchNearby" {
				t.Errorf("expected /v1/places:searchNearby, got %s", r.URL.Path)
			}
			if r.Header.Get("X-Goog-Api-Key") == "" {
				t.Error("expected X-Goog-Api-Key header")
			}
			if r.Header.Get("X-Goog-FieldMask") == "" {
				t.Error("expected X-Goog-FieldMask header")
			}

			// リクエストボディの検証
			var reqBody map[string]interface{}
			json.NewDecoder(r.Body).Decode(&reqBody) //nolint:errcheck
			if reqBody["rankPreference"] != "DISTANCE" {
				t.Errorf("expected rankPreference=DISTANCE, got %v", reqBody["rankPreference"])
			}
			if reqBody["languageCode"] != "ja" {
				t.Errorf("expected languageCode=ja, got %v", reqBody["languageCode"])
			}

			// New API 形式のレスポンス
			resp := map[string]interface{}{
				"places": []map[string]interface{}{
					{
						"id":    "ChIJN1t_tDeuEmsRUsoyG83frY4",
						"types": []string{"cafe", "food", "point_of_interest", "establishment"},
						"displayName": map[string]string{
							"text":         "カフェ アルファ",
							"languageCode": "ja",
						},
						"location": map[string]float64{
							"latitude":  35.6762,
							"longitude": 139.6503,
						},
						"rating": 4.2,
						"photos": []map[string]interface{}{
							{
								"name":     "places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AUGGfZl",
								"widthPx":  4032,
								"heightPx": 3024,
							},
						},
						"shortFormattedAddress": "渋谷区1-1",
					},
					{
						"id":    "ChIJP3Sa8ziYEmsRUKgyFmh9AQM",
						"types": []string{"park", "point_of_interest"},
						"displayName": map[string]string{
							"text":         "公園 ベータ",
							"languageCode": "ja",
						},
						"location": map[string]float64{
							"latitude":  35.6770,
							"longitude": 139.6510,
						},
						"rating":                4.0,
						"shortFormattedAddress": "渋谷区2-2",
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp) //nolint:errcheck
		}))
		defer server.Close()

		client := &GooglePlacesClient{
			APIKey:  "test-api-key",
			BaseURL: server.URL,
		}

		results, err := client.NearbySearch(context.Background(), 35.6762, 139.6503, 3000)
		if err != nil {
			t.Fatalf("NearbySearch failed: %v", err)
		}

		if len(results) != 2 {
			t.Fatalf("expected 2 results, got %d", len(results))
		}

		// 1件目の検証
		r1 := results[0]
		if r1.PlaceID != "ChIJN1t_tDeuEmsRUsoyG83frY4" {
			t.Errorf("expected PlaceID 'ChIJN1t_tDeuEmsRUsoyG83frY4', got '%s'", r1.PlaceID)
		}
		if r1.Name != "カフェ アルファ" {
			t.Errorf("expected Name 'カフェ アルファ', got '%s'", r1.Name)
		}
		if r1.Vicinity != "渋谷区1-1" {
			t.Errorf("expected Vicinity '渋谷区1-1', got '%s'", r1.Vicinity)
		}
		if r1.Lat != 35.6762 {
			t.Errorf("expected Lat 35.6762, got %f", r1.Lat)
		}
		if r1.Lng != 139.6503 {
			t.Errorf("expected Lng 139.6503, got %f", r1.Lng)
		}
		if r1.Rating != 4.2 {
			t.Errorf("expected Rating 4.2, got %f", r1.Rating)
		}
		if r1.PhotoReference != "places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AUGGfZl" {
			t.Errorf("expected PhotoReference 'places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AUGGfZl', got '%s'", r1.PhotoReference)
		}
		if len(r1.Types) != 4 || r1.Types[0] != "cafe" {
			t.Errorf("expected Types starting with 'cafe', got %v", r1.Types)
		}

		// 2件目: 写真なしの場合
		r2 := results[1]
		if r2.PlaceID != "ChIJP3Sa8ziYEmsRUKgyFmh9AQM" {
			t.Errorf("expected PlaceID 'ChIJP3Sa8ziYEmsRUKgyFmh9AQM', got '%s'", r2.PlaceID)
		}
		if r2.PhotoReference != "" {
			t.Errorf("expected empty PhotoReference for place without photos, got '%s'", r2.PhotoReference)
		}
	})

	t.Run("New API が空レスポンスを返した場合", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{}`)) //nolint:errcheck
		}))
		defer server.Close()

		client := &GooglePlacesClient{
			APIKey:  "test-api-key",
			BaseURL: server.URL,
		}

		results, err := client.NearbySearch(context.Background(), 35.6762, 139.6503, 3000)
		if err != nil {
			t.Fatalf("NearbySearch should not fail on empty response: %v", err)
		}
		if len(results) != 0 {
			t.Errorf("expected 0 results, got %d", len(results))
		}
	})

	t.Run("New API がエラーステータスを返した場合", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error": {"message": "Invalid request"}}`)) //nolint:errcheck
		}))
		defer server.Close()

		client := &GooglePlacesClient{
			APIKey:  "test-api-key",
			BaseURL: server.URL,
		}

		_, err := client.NearbySearch(context.Background(), 35.6762, 139.6503, 3000)
		if err == nil {
			t.Error("expected error for bad response status")
		}
	})

	t.Run("includedTypesにservices.VisitableTypesが指定される", func(t *testing.T) {
		var receivedTypes []string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var reqBody struct {
				IncludedTypes []string `json:"includedTypes"`
			}
			json.NewDecoder(r.Body).Decode(&reqBody) //nolint:errcheck
			receivedTypes = reqBody.IncludedTypes

			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{}`)) //nolint:errcheck
		}))
		defer server.Close()

		client := &GooglePlacesClient{
			APIKey:  "test-api-key",
			BaseURL: server.URL,
		}

		client.NearbySearch(context.Background(), 35.6762, 139.6503, 3000) //nolint:errcheck

		if len(receivedTypes) == 0 {
			t.Error("expected includedTypes to be sent in request")
		}
		// services.VisitableTypes のキーがすべて含まれていることを確認
		typeSet := make(map[string]bool)
		for _, tp := range receivedTypes {
			typeSet[tp] = true
		}
		for vt := range services.VisitableTypes {
			if !typeSet[vt] {
				t.Errorf("visitableType '%s' not found in includedTypes", vt)
			}
		}
	})
}

// TestVisitedFilterWithTimeThreshold は Issue #197 の訪問済みフィルタ閾値テスト
// 30日以内の訪問済み施設は除外され、31日以上前の訪問済み施設は再提案候補に含まれることを確認する
func TestVisitedFilterWithTimeThreshold(t *testing.T) {
	mockPlaces := []services.PlaceResult{
		{PlaceID: "thresh_1", Name: "Cafe A", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "thresh_2", Name: "Park B", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"park"}},
		{PlaceID: "thresh_3", Name: "Restaurant C", Vicinity: "渋谷区3-3", Lat: 35.6780, Lng: 139.6520, Rating: 3.8, Types: []string{"restaurant"}},
	}

	t.Run("30日以内の訪問済み施設は提案から除外される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		// 1日前に訪問済み（30日以内）
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "thresh_1",
			PlaceName: "Cafe A",
			Latitude:  35.6762,
			Longitude: 139.6503,
			VisitedAt: time.Now().AddDate(0, 0, -1),
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
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())
		for _, p := range resp {
			if p.PlaceID == "thresh_1" {
				t.Errorf("thresh_1 は30日以内に訪問済みのため提案に含まれるべきでない")
			}
		}
	})

	t.Run("31日以上前に訪問した施設は再提案候補に含まれる", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		// 31日前に訪問済み（閾値を超えているため再提案候補）
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "thresh_1",
			PlaceName: "Cafe A",
			Latitude:  35.6762,
			Longitude: 139.6503,
			VisitedAt: time.Now().AddDate(0, 0, -31),
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
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		resp := parseSuggestions(t, w.Body.Bytes())
		found := false
		for _, p := range resp {
			if p.PlaceID == "thresh_1" {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("thresh_1 は31日以上前の訪問のため再提案候補に含まれるべき")
		}
	})

	t.Run("全施設が30日以内に訪問済みの場合、is_completed=trueかつnotice=ALL_VISITED_NEARBYが返る", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		// 全施設を3日前に訪問済み（30日以内）
		for _, p := range mockPlaces {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   p.PlaceID,
				PlaceName: p.Name,
				Latitude:  p.Lat,
				Longitude: p.Lng,
				VisitedAt: time.Now().AddDate(0, 0, -3),
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

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var result struct {
			IsCompleted bool                   `json:"is_completed"`
			Notice      string                 `json:"notice"`
			Places      []services.PlaceResult `json:"places"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response body: %v", err)
		}
		if !result.IsCompleted {
			t.Errorf("Expected is_completed=true, got false. Body: %s", w.Body.String())
		}
		if result.Notice != "ALL_VISITED_NEARBY" {
			t.Errorf("Expected notice='ALL_VISITED_NEARBY', got '%s'. Body: %s", result.Notice, w.Body.String())
		}
		if len(result.Places) != 0 {
			t.Errorf("Expected empty places when all visited nearby, got %d", len(result.Places))
		}
	})

	t.Run("全施設が31日以上前に訪問済みの場合は通常通り提案が返る", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		// 全施設を40日前に訪問済み（閾値超えのため再提案候補）
		for _, p := range mockPlaces {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   p.PlaceID,
				PlaceName: p.Name,
				Latitude:  p.Lat,
				Longitude: p.Lng,
				VisitedAt: time.Now().AddDate(0, 0, -40),
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

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var result struct {
			IsCompleted bool                   `json:"is_completed"`
			Notice      string                 `json:"notice"`
			Places      []services.PlaceResult `json:"places"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("Failed to parse response body: %v", err)
		}
		if result.IsCompleted {
			t.Errorf("全施設が閾値超えのため is_completed=false であるべき. Body: %s", w.Body.String())
		}
		if len(result.Places) == 0 {
			t.Errorf("全施設が閾値超えのため再提案候補として Places が返るべき. Body: %s", w.Body.String())
		}
	})
}

// TestSuggestFilterOpenNow は営業時間フィルタ（should_filter_open_now）の動作を検証する
func TestSuggestFilterOpenNow(t *testing.T) {
	openNow := true
	closedNow := false

	t.Run("should_filter_open_now=trueの場合、閉店中の施設は除外される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mockPlaces := []services.PlaceResult{
			{PlaceID: "open_1", Name: "Open Cafe", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}, IsOpenNow: &openNow},
			{PlaceID: "closed_1", Name: "Closed Restaurant", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 3.8, Types: []string{"restaurant"}, IsOpenNow: &closedNow},
			{PlaceID: "open_2", Name: "Open Park", Vicinity: "渋谷区3-3", Lat: 35.6780, Lng: 139.6520, Rating: 4.5, Types: []string{"park"}, IsOpenNow: &openNow},
		}
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":                    35.6762,
			"lng":                    139.6503,
			"should_filter_open_now": true,
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

		places := parseSuggestions(t, w.Body.Bytes())
		for _, p := range places {
			if p.PlaceID == "closed_1" {
				t.Errorf("閉店中の施設 'closed_1' が提案に含まれている")
			}
		}
		if len(places) == 0 {
			t.Error("営業中の施設が1件も返されていない")
		}
	})

	t.Run("should_filter_open_now=falseの場合、閉店中の施設も提案に含まれうる", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mockPlaces := []services.PlaceResult{
			{PlaceID: "closed_only", Name: "Closed Cafe", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 3.0, Types: []string{"cafe"}, IsOpenNow: &closedNow},
		}
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":                    35.6762,
			"lng":                    139.6503,
			"should_filter_open_now": false,
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

		places := parseSuggestions(t, w.Body.Bytes())
		found := false
		for _, p := range places {
			if p.PlaceID == "closed_only" {
				found = true
				break
			}
		}
		if !found {
			t.Error("should_filter_open_now=falseなのに閉店中の施設が除外されている")
		}
	})

	t.Run("should_filter_open_now=trueで全施設閉店中の場合は404", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mockPlaces := []services.PlaceResult{
			{PlaceID: "closed_1", Name: "Closed Cafe", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 3.0, Types: []string{"cafe"}, IsOpenNow: &closedNow},
			{PlaceID: "closed_2", Name: "Closed Restaurant", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 3.5, Types: []string{"restaurant"}, IsOpenNow: &closedNow},
		}
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":                    35.6762,
			"lng":                    139.6503,
			"should_filter_open_now": true,
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

	t.Run("is_open_now情報がない施設はshould_filter_open_now=trueでも提案に含まれる", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		mockPlaces := []services.PlaceResult{
			{PlaceID: "unknown_hours", Name: "Unknown Hours Cafe", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.0, Types: []string{"cafe"}, IsOpenNow: nil},
		}
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupSuggestionRouter(mock)

		body := map[string]interface{}{
			"lat":                    35.6762,
			"lng":                    139.6503,
			"should_filter_open_now": true,
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

		places := parseSuggestions(t, w.Body.Bytes())
		found := false
		for _, p := range places {
			if p.PlaceID == "unknown_hours" {
				found = true
				break
			}
		}
		if !found {
			t.Error("営業時間不明の施設がshould_filter_open_now=trueで除外されている（除外されるべきではない）")
		}
	})
}
