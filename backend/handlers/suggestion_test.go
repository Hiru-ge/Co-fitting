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

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
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
	Results   []PlaceResult
	Err       error
	CallCount int
}

func (m *trackingMockPlacesClient) NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]PlaceResult, error) {
	m.CallCount++
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

func createTestUser(t *testing.T) models.User {
	t.Helper()
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	user := models.User{
		Email:        "suggest@example.com",
		PasswordHash: string(hash),
		DisplayName:  "Suggest User",
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

		var resp []PlaceResult
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

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

		var resp []PlaceResult
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

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

		var resp []PlaceResult
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

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

		var resp []PlaceResult
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response as array: %v. Body: %s", err, w.Body.String())
		}

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

		var resp1 []PlaceResult
		json.Unmarshal(w1.Body.Bytes(), &resp1)

		// 2回目のリクエスト
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusOK {
			t.Fatalf("2nd request: Expected status %d, got %d. Body: %s", http.StatusOK, w2.Code, w2.Body.String())
		}

		var resp2 []PlaceResult
		json.Unmarshal(w2.Body.Bytes(), &resp2)

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

		var resp []PlaceResult
		json.Unmarshal(w.Body.Bytes(), &resp)

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

		var resp []PlaceResult
		json.Unmarshal(w.Body.Bytes(), &resp)

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

		var resp1 []PlaceResult
		json.Unmarshal(w1.Body.Bytes(), &resp1)
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

		var resp2 []PlaceResult
		json.Unmarshal(w2.Body.Bytes(), &resp2)

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
}
