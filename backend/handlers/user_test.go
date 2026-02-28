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
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
)

func setupUserRouter() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetMe)
	return r
}

func setupUserRouterWithPatch() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetMe)
	r.PATCH("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.UpdateMe)
	return r
}

func TestGetMe(t *testing.T) {
	router := setupUserRouter()

	t.Run("JWTつきで自身の情報が返される", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "me@example.com",
			DisplayName: "Me User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["email"] != "me@example.com" {
			t.Errorf("Expected email 'me@example.com', got '%v'", resp["email"])
		}
		if resp["display_name"] != "Me User" {
			t.Errorf("Expected display_name 'Me User', got '%v'", resp["display_name"])
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("ユーザーが存在しない場合404 Not Found", func(t *testing.T) {
		cleanupUsers(t)

		token := generateTestToken(99999)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})
}

func TestUpdateMe(t *testing.T) {
	router := setupUserRouterWithPatch()

	t.Run("表示名を更新できる", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "update@example.com",
			DisplayName: "Old Name",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"display_name": "New Name",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
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

		if resp["display_name"] != "New Name" {
			t.Errorf("Expected display_name 'New Name', got '%v'", resp["display_name"])
		}

		// DBに反映されていることを確認
		var updated models.User
		testDB.First(&updated, user.ID)
		if updated.DisplayName != "New Name" {
			t.Errorf("Expected DB display_name 'New Name', got '%s'", updated.DisplayName)
		}
	})

	t.Run("空の表示名で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "empty@example.com",
			DisplayName: "Original",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"display_name": "",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("表示名の前後空白がトリムされる", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "trim@example.com",
			DisplayName: "Original",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"display_name": "  Trimmed Name  ",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["display_name"] != "Trimmed Name" {
			t.Errorf("Expected display_name 'Trimmed Name', got '%v'", resp["display_name"])
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		body := map[string]string{
			"display_name": "New Name",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("ユーザーが存在しない場合404 Not Found", func(t *testing.T) {
		cleanupUsers(t)

		token := generateTestToken(99999)

		body := map[string]string{
			"display_name": "Ghost",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})
}

func setupUserRouterWithPatchAndRadius() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetMe)
	r.PATCH("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.UpdateMe)
	return r
}

func TestUpdateSearchRadius(t *testing.T) {
	router := setupUserRouterWithPatchAndRadius()

	t.Run("search_radiusを更新できる", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "radius@example.com",
			DisplayName: "Radius User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"search_radius": 10000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)

		if resp["search_radius"] != float64(10000) {
			t.Errorf("Expected search_radius 10000, got '%v'", resp["search_radius"])
		}

		var updated models.User
		testDB.First(&updated, user.ID)
		if updated.SearchRadius != 10000 {
			t.Errorf("Expected DB search_radius 10000, got %d", updated.SearchRadius)
		}
	})

	t.Run("search_radiusが最小値3000未満で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "radius2@example.com",
			DisplayName: "Radius User 2",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"search_radius": 2999,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("search_radiusが最大値30000超で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "radius3@example.com",
			DisplayName: "Radius User 3",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"search_radius": 30001,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("display_nameとsearch_radiusを同時に更新できる", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "both@example.com",
			DisplayName: "Old Name",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"display_name":  "New Name",
			"search_radius": 7000,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)

		if resp["display_name"] != "New Name" {
			t.Errorf("Expected display_name 'New Name', got '%v'", resp["display_name"])
		}
		if resp["search_radius"] != float64(7000) {
			t.Errorf("Expected search_radius 7000, got '%v'", resp["search_radius"])
		}
	})
}

func setupUserRouterWithDelete() *gin.Engine {
	userHandler := &UserHandler{
		DB:          testDB,
		JWTCfg:      testAuthHandler.JWTCfg,
		RedisClient: testRedisClient,
	}

	r := gin.New()
	r.DELETE("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.DeleteMe)
	return r
}

func TestDeleteMe(t *testing.T) {
	router := setupUserRouterWithDelete()

	t.Run("認証済みユーザーが自身のアカウントを削除できる", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "delete@example.com",
			DisplayName: "Delete Me",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/users/me", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNoContent, w.Code, w.Body.String())
		}

		// DBからユーザーが削除されていることを確認
		var deleted models.User
		result := testDB.First(&deleted, user.ID)
		if result.Error == nil {
			t.Error("Expected user to be deleted from DB")
		}
	})

	t.Run("関連する訪問記録も削除される", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "delete_with_visits@example.com",
			DisplayName: "Delete With Visits",
		}
		testDB.Create(&user)

		visit := models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_test_001",
			PlaceName: "テスト場所",
			Vicinity:  "テスト住所",
			Category:  "cafe",
			VisitedAt: time.Now(),
		}
		testDB.Create(&visit)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/users/me", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNoContent, w.Code, w.Body.String())
		}

		// 訪問記録も削除されていることを確認
		var count int64
		testDB.Model(&models.Visit{}).Where("user_id = ?", user.ID).Count(&count)
		if count != 0 {
			t.Errorf("Expected all visits to be deleted, but found %d", count)
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/users/me", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("存在しないユーザーIDで404 Not Found", func(t *testing.T) {
		cleanupUsers(t)

		token := generateTestToken(99999)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/users/me", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})

	t.Run("削除後のアクセストークンがブラックリストに登録される", func(t *testing.T) {
		if testRedisClient == nil {
			t.Skip("Redis not available")
		}
		cleanupUsers(t)

		user := models.User{
			Email:       "delete_blacklist@example.com",
			DisplayName: "Delete Blacklist",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/users/me", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNoContent, w.Code, w.Body.String())
		}

		// 削除後のトークンがブラックリストに登録されていることを確認
		isBlacklisted, err := utils.IsTokenBlacklisted(context.Background(), testRedisClient, token)
		if err != nil {
			t.Fatalf("Failed to check blacklist: %v", err)
		}
		if !isBlacklisted {
			t.Error("Expected access token to be blacklisted after account deletion")
		}
	})

	t.Run("削除後にユーザーのRedisキャッシュが削除される", func(t *testing.T) {
		if testRedisClient == nil {
			t.Skip("Redis not available")
		}
		cleanupUsers(t)

		user := models.User{
			Email:       "delete_cache@example.com",
			DisplayName: "Delete Cache",
		}
		testDB.Create(&user)

		// テスト用のRedisキャッシュを事前に設定
		ctx := context.Background()
		userIDStr := fmt.Sprintf("%d", user.ID)
		today := time.Now().Format("2006-01-02")
		database.SetDailySuggestions(ctx, testRedisClient, userIDStr, today, 35.0, 135.0, `{"places":[]}`, 24*time.Hour)
		database.SetDailyLimitReached(ctx, testRedisClient, userIDStr, today, 24*time.Hour)
		database.IncrementDailyReloadCount(ctx, testRedisClient, userIDStr, today, 24*time.Hour)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/users/me", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNoContent, w.Code, w.Body.String())
		}

		// Redisキャッシュが削除されていることを確認
		dailyKeys, _ := database.ScanKeysByPattern(ctx, testRedisClient, fmt.Sprintf("suggestion:daily:%s:*", userIDStr))
		if len(dailyKeys) > 0 {
			t.Errorf("Expected daily suggestion cache to be deleted, but found %d keys", len(dailyKeys))
		}
		countKeys, _ := database.ScanKeysByPattern(ctx, testRedisClient, fmt.Sprintf("suggestion:count:%s:*", userIDStr))
		if len(countKeys) > 0 {
			t.Errorf("Expected suggestion count cache to be deleted, but found %d keys", len(countKeys))
		}
		reloadKeys, _ := database.ScanKeysByPattern(ctx, testRedisClient, fmt.Sprintf("suggestion:reload:%s:*", userIDStr))
		if len(reloadKeys) > 0 {
			t.Errorf("Expected suggestion reload cache to be deleted, but found %d keys", len(reloadKeys))
		}
	})
}
