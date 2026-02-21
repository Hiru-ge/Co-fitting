package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/gin-gonic/gin"
)

func setupAllBadgesRouter() *gin.Engine {
	badgeHandler := &BadgeHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/badges", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), badgeHandler.GetAllBadges)
	return r
}

func TestGetAllBadges(t *testing.T) {
	router := setupAllBadgesRouter()

	t.Run("認証済みユーザーは全バッジ一覧が取得できる", func(t *testing.T) {
		cleanupUsers(t)

		// シードデータのバッジ数を確認
		var count int64
		testDB.Table("badges").Count(&count)
		if count == 0 {
			t.Skip("バッジのシードデータが存在しません")
		}

		token := generateTestToken(1)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/badges", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp []map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("レスポンスのパースに失敗: %v", err)
		}

		if int64(len(resp)) != count {
			t.Errorf("Expected %d badges, got %d", count, len(resp))
		}

		if len(resp) > 0 {
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
			// condition_json はフロントエンドに不要なため含まれないこと
			if _, ok := resp[0]["condition_json"]; ok {
				t.Error("レスポンスに condition_json が含まれてはいけません")
			}
		}
	})

	t.Run("未認証ユーザーは401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/badges", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})
}
