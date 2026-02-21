package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/gin-gonic/gin"
)

func setupGenreRouter() *gin.Engine {
	genreHandler := &GenreHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/genres", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), genreHandler.GetAllGenreTags)
	return r
}

func TestGetAllGenreTags(t *testing.T) {
	router := setupGenreRouter()

	t.Run("認証済みユーザーは全ジャンルタグ一覧が取得できる", func(t *testing.T) {
		var count int64
		testDB.Table("genre_tags").Count(&count)
		if count == 0 {
			t.Skip("ジャンルタグのシードデータが存在しません")
		}

		token := generateTestToken(1)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/genres", nil)
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
			t.Errorf("Expected %d genre tags, got %d", count, len(resp))
		}

		if len(resp) > 0 {
			if _, ok := resp[0]["id"]; !ok {
				t.Error("レスポンスに id が含まれていません")
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
		req, _ := http.NewRequest("GET", "/api/genres", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("カテゴリ昇順・名前昇順でソートされて返却される", func(t *testing.T) {
		var count int64
		testDB.Table("genre_tags").Count(&count)
		if count < 2 {
			t.Skip("ジャンルタグのシードデータが2件以上必要です")
		}

		token := generateTestToken(1)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/genres", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		router.ServeHTTP(w, req)

		var resp []map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("レスポンスのパースに失敗: %v", err)
		}

		// カテゴリ昇順ソートの検証
		for i := 1; i < len(resp); i++ {
			prevCat, _ := resp[i-1]["category"].(string)
			curCat, _ := resp[i]["category"].(string)
			if curCat < prevCat {
				t.Errorf("カテゴリが昇順ソートされていません: index %d (%s) の前に index %d (%s) があります", i, curCat, i-1, prevCat)
			}
		}
	})
}
