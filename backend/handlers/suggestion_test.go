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

		var resp PlaceResult
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp.PlaceID == "" {
			t.Error("Expected non-empty place_id")
		}
		if resp.Name == "" {
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

		var resp PlaceResult
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp.PlaceID != "place_3" {
			t.Errorf("Expected place_id 'place_3', got '%s'", resp.PlaceID)
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

		var resp PlaceResult
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp.PlaceID != "cafe_1" {
			t.Errorf("Expected only cafe to be returned, got place_id '%s' (%s)", resp.PlaceID, resp.Name)
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
