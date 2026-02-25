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
)

func setupProficiencyRouter() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me/proficiency", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetProficiency)
	return r
}

func TestGetProficiency(t *testing.T) {
	router := setupProficiencyRouter()

	t.Run("認証済みユーザーのジャンル別熟練度一覧が取得できる", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "proficiency@example.com",
			DisplayName: "Proficiency User",
		}
		testDB.Create(&user)

		var genreTags []models.GenreTag
		testDB.Limit(2).Find(&genreTags)
		if len(genreTags) < 2 {
			t.Skip("ジャンルタグのシードデータが不足しています")
		}

		proficiencies := []models.GenreProficiency{
			{UserID: user.ID, GenreTagID: genreTags[0].ID, XP: 150, Level: 2},
			{UserID: user.ID, GenreTagID: genreTags[1].ID, XP: 50, Level: 1},
		}
		for i := range proficiencies {
			testDB.Create(&proficiencies[i])
		}

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/proficiency", nil)
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
			t.Errorf("Expected 2 proficiency items, got %d", len(resp))
		}

		if len(resp) > 0 {
			if _, ok := resp[0]["genre_tag_id"]; !ok {
				t.Error("レスポンスに genre_tag_id が含まれていません")
			}
			if _, ok := resp[0]["genre_name"]; !ok {
				t.Error("レスポンスに genre_name が含まれていません")
			}
			if _, ok := resp[0]["category"]; !ok {
				t.Error("レスポンスに category が含まれていません")
			}
			if _, ok := resp[0]["xp"]; !ok {
				t.Error("レスポンスに xp が含まれていません")
			}
			if _, ok := resp[0]["level"]; !ok {
				t.Error("レスポンスに level が含まれていません")
			}

			// XP降順であることを確認
			if len(resp) >= 2 {
				xp0 := resp[0]["xp"].(float64)
				xp1 := resp[1]["xp"].(float64)
				if xp0 < xp1 {
					t.Errorf("熟練度がXP降順になっていません: %v < %v", xp0, xp1)
				}
			}
		}
	})

	t.Run("未認証ユーザーは401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/proficiency", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("熟練度データなしユーザーは空配列が返される", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "noprof@example.com",
			DisplayName: "No Prof User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/proficiency", nil)
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
			t.Errorf("熟練度データなしのユーザーに対して空配列が返されることを期待しましたが、%d 件返されました", len(resp))
		}
	})
}
