package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func setupInterestsRouter() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me/interests", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetInterests)
	return r
}

func TestGetInterests(t *testing.T) {
	router := setupInterestsRouter()

	t.Run("認証済みユーザーの興味タグ一覧が取得できる", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "interests@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Interests User",
		}
		testDB.Create(&user)

		var genreTags []models.GenreTag
		testDB.Limit(2).Find(&genreTags)
		if len(genreTags) < 2 {
			t.Skip("ジャンルタグのシードデータが不足しています")
		}

		interests := []models.UserInterest{
			{UserID: user.ID, GenreTagID: genreTags[0].ID},
			{UserID: user.ID, GenreTagID: genreTags[1].ID},
		}
		for i := range interests {
			testDB.Create(&interests[i])
		}

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/interests", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp []map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("レスポンスのパースに失敗: %v", err)
		}

		if len(resp) != 2 {
			t.Errorf("Expected 2 interest items, got %d", len(resp))
		}

		if len(resp) > 0 {
			if _, ok := resp[0]["genre_tag_id"]; !ok {
				t.Error("レスポンスに genre_tag_id が含まれていません")
			}
			if _, ok := resp[0]["name"]; !ok {
				t.Error("レスポンスに name が含まれていません")
			}
			if _, ok := resp[0]["category"]; !ok {
				t.Error("レスポンスに category が含まれていません")
			}
			if _, ok := resp[0]["icon"]; !ok {
				t.Error("レスポンスに icon が含まれていません")
			}
		}
	})

	t.Run("未認証ユーザーは401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/interests", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("興味タグデータなしユーザーは空配列が返される", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "nointerests@example.com",
			PasswordHash: string(hash),
			DisplayName:  "No Interests User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/interests", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp []map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("レスポンスのパースに失敗: %v", err)
		}

		if len(resp) != 0 {
			t.Errorf("興味タグデータなしのユーザーに対して空配列が返されることを期待しましたが、%d 件返されました", len(resp))
		}
	})
}
