package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func setupUserRouter() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret), userHandler.GetMe)
	return r
}

func generateTestToken(userID uint64) string {
	token, _ := utils.GenerateAccessToken(
		userID,
		testAuthHandler.JWTCfg.Secret,
		testAuthHandler.JWTCfg.AccessExpiry,
	)
	return token
}

func TestGetMe(t *testing.T) {
	router := setupUserRouter()

	t.Run("JWTつきで自身の情報が返される", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "me@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Me User",
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
		if _, exists := resp["password_hash"]; exists {
			t.Error("password_hash should not be exposed in response")
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
