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
	"github.com/Hiru-ge/roamble/services"
	"github.com/gin-gonic/gin"
)

func setupPlacePickerRouter(mock PlacesSearcher) *gin.Engine {
	handler := &PlacePickerHandler{
		DB:          testDB,
		Places:      mock,
		RedisClient: testRedisClient,
	}
	r := gin.New()
	r.GET("/api/places/nearby", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), handler.GetNearbyVisitablePlaces)
	return r
}

func createPlacePickerTestUser(t *testing.T) models.User {
	t.Helper()
	return createTestUserByEmail(t, "picker@example.com", "Picker User")
}

func parseVisitablePlaces(t *testing.T, body []byte) []services.PlaceResult {
	t.Helper()
	var result struct {
		Places []services.PlaceResult `json:"places"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("Failed to parse visitable places response: %v. Body: %s", err, string(body))
	}
	return result.Places
}

func TestGetVisitablePlaces(t *testing.T) {
	mockPlaces := []services.PlaceResult{
		{PlaceID: "place_1", Name: "Cafe Alpha", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "place_2", Name: "Park Beta", Vicinity: "渋谷区2-2", Lat: 35.6770, Lng: 139.6510, Rating: 4.0, Types: []string{"park"}},
		{PlaceID: "place_3", Name: "Restaurant Gamma", Vicinity: "渋谷区3-3", Lat: 35.6780, Lng: 139.6520, Rating: 3.8, Types: []string{"restaurant"}},
	}

	t.Run("有効な座標で施設リストが返される", func(t *testing.T) {
		cleanupUsers(t)
		user := createPlacePickerTestUser(t)
		token := generateTestToken(user.ID)
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupPlacePickerRouter(mock)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/nearby?lat=35.6762&lng=139.6503", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		places := parseVisitablePlaces(t, w.Body.Bytes())
		if len(places) == 0 {
			t.Error("Expected at least one place")
		}
	})

	t.Run("latを省略すると400を返す", func(t *testing.T) {
		cleanupUsers(t)
		user := createPlacePickerTestUser(t)
		token := generateTestToken(user.ID)
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupPlacePickerRouter(mock)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/nearby?lng=139.6503", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("lngを省略すると400を返す", func(t *testing.T) {
		cleanupUsers(t)
		user := createPlacePickerTestUser(t)
		token := generateTestToken(user.ID)
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupPlacePickerRouter(mock)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/nearby?lat=35.6762", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("30日以内に訪問済みの施設は除外される", func(t *testing.T) {
		cleanupUsers(t)
		user := createPlacePickerTestUser(t)
		token := generateTestToken(user.ID)

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_1",
			PlaceName: "Cafe Alpha",
			Latitude:  35.6762,
			Longitude: 139.6503,
			VisitedAt: time.Now(),
		})

		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupPlacePickerRouter(mock)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/nearby?lat=35.6762&lng=139.6503", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		places := parseVisitablePlaces(t, w.Body.Bytes())
		for _, p := range places {
			if p.PlaceID == "place_1" {
				t.Error("Expected visited place_1 to be excluded")
			}
		}
	})

	t.Run("VisitableTypes外の施設は除外される", func(t *testing.T) {
		cleanupUsers(t)
		user := createPlacePickerTestUser(t)
		token := generateTestToken(user.ID)
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupPlacePickerRouter(mock)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/nearby?lat=35.6762&lng=139.6503", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		places := parseVisitablePlaces(t, w.Body.Bytes())
		for _, p := range places {
			if p.PlaceID == "place_2" {
				t.Error("Expected park (place_2) to be excluded as non-visitable type")
			}
		}
	})

	t.Run("認証なしで401を返す", func(t *testing.T) {
		mock := &mockPlacesClient{Results: mockPlaces}
		router := setupPlacePickerRouter(mock)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/places/nearby?lat=35.6762&lng=139.6503", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})
}
