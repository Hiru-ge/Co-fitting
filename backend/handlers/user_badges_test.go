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
	"github.com/gin-gonic/gin"
)

func setupBadgesRouter() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me/badges", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetBadges)
	return r
}

func TestGetBadges(t *testing.T) {
	router := setupBadgesRouter()

	t.Run("認証済みユーザーの獲得バッジ一覧が取得できる", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "badges@example.com",
			DisplayName: "Badge User",
		}
		testDB.Create(&user)

		// シードデータからバッジを取得
		var badges []models.Badge
		testDB.Limit(3).Find(&badges)
		if len(badges) < 3 {
			t.Skip("バッジのシードデータが不足しています")
		}

		// ユーザーバッジを作成（獲得日時を異なる時刻にして順序を検証できるようにする）
		userBadges := []models.UserBadge{
			{UserID: user.ID, BadgeID: badges[0].ID, EarnedAt: time.Now().Add(-2 * time.Hour)},
			{UserID: user.ID, BadgeID: badges[1].ID, EarnedAt: time.Now().Add(-1 * time.Hour)},
			{UserID: user.ID, BadgeID: badges[2].ID, EarnedAt: time.Now()},
		}
		for i := range userBadges {
			testDB.Create(&userBadges[i])
		}

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/badges", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp []map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("レスポンスのパースに失敗: %v", err)
		}

		if len(resp) != 3 {
			t.Errorf("Expected 3 badges, got %d", len(resp))
		}

		if len(resp) > 0 {
			// レスポンスに必要なフィールドが含まれていることを確認
			if _, ok := resp[0]["id"]; !ok {
				t.Error("レスポンスに id が含まれていません")
			}
			if _, ok := resp[0]["name"]; !ok {
				t.Error("レスポンスに name が含まれていません")
			}
			if _, ok := resp[0]["description"]; !ok {
				t.Error("レスポンスに description が含まれていません")
			}
			if _, ok := resp[0]["icon_url"]; !ok {
				t.Error("レスポンスに icon_url が含まれていません")
			}
			if _, ok := resp[0]["earned_at"]; !ok {
				t.Error("レスポンスに earned_at が含まれていません")
			}

			// 獲得日時の降順（最新が先頭）であることを確認
			if len(resp) >= 2 {
				earnedAt0 := resp[0]["earned_at"].(string)
				earnedAt1 := resp[1]["earned_at"].(string)
				if earnedAt0 < earnedAt1 {
					t.Errorf("バッジが獲得日時の降順になっていません: %s < %s", earnedAt0, earnedAt1)
				}
			}
		}
	})

	t.Run("未認証ユーザーは401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/badges", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("バッジ未獲得ユーザーは空配列が返される", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "nobadge@example.com",
			DisplayName: "No Badge User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me/badges", nil)
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
			t.Errorf("バッジ未獲得のユーザーに対して空配列が返されることを期待しましたが、%d 件返されました", len(resp))
		}
	})
}
