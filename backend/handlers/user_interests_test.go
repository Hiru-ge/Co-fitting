package handlers

import (
	"bytes"
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
	r.PUT("/api/users/me/interests", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.UpdateInterests)
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

func TestUpdateInterests(t *testing.T) {
	router := setupInterestsRouter()

	t.Run("新規設定パターン: 興味タグが登録されていない状態から設定できる", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "newinterests@example.com",
			PasswordHash: string(hash),
			DisplayName:  "New Interests User",
		}
		testDB.Create(&user)

		var genreTags []models.GenreTag
		testDB.Limit(3).Find(&genreTags)
		if len(genreTags) < 3 {
			t.Skip("ジャンルタグのシードデータが不足しています")
		}

		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"genre_tag_ids": []uint64{genreTags[0].ID, genreTags[1].ID, genreTags[2].ID},
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PUT", "/api/users/me/interests", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
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
			t.Errorf("Expected 3 interest items, got %d", len(resp))
		}

		// DBに反映されていることを確認
		var count int64
		testDB.Model(&models.UserInterest{}).Where("user_id = ?", user.ID).Count(&count)
		if count != 3 {
			t.Errorf("Expected 3 records in DB, got %d", count)
		}
	})

	t.Run("既存更新パターン: 興味タグを別のものに更新できる", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "updateinterests@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Update Interests User",
		}
		testDB.Create(&user)

		var genreTags []models.GenreTag
		testDB.Limit(4).Find(&genreTags)
		if len(genreTags) < 4 {
			t.Skip("ジャンルタグのシードデータが不足しています")
		}

		// 既存の興味タグを2件登録
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: genreTags[0].ID})
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: genreTags[1].ID})

		token := generateTestToken(user.ID)

		// 別の3件に更新
		body := map[string]interface{}{
			"genre_tag_ids": []uint64{genreTags[1].ID, genreTags[2].ID, genreTags[3].ID},
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PUT", "/api/users/me/interests", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		// DBが3件になっていることを確認
		var count int64
		testDB.Model(&models.UserInterest{}).Where("user_id = ?", user.ID).Count(&count)
		if count != 3 {
			t.Errorf("Expected 3 records in DB, got %d", count)
		}

		// 古いタグ[0]が削除されていることを確認
		var oldInterest models.UserInterest
		err := testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, genreTags[0].ID).First(&oldInterest).Error
		if err == nil {
			t.Error("古い興味タグが削除されていません")
		}
	})

	t.Run("バリデーションエラー: 3つ未満で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "fewtags@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Few Tags User",
		}
		testDB.Create(&user)

		var genreTags []models.GenreTag
		testDB.Limit(2).Find(&genreTags)
		if len(genreTags) < 2 {
			t.Skip("ジャンルタグのシードデータが不足しています")
		}

		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"genre_tag_ids": []uint64{genreTags[0].ID, genreTags[1].ID},
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PUT", "/api/users/me/interests", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("バリデーションエラー: 空配列で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "emptytags@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Empty Tags User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]interface{}{
			"genre_tag_ids": []uint64{},
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PUT", "/api/users/me/interests", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("未認証ユーザーは401 Unauthorized", func(t *testing.T) {
		body := map[string]interface{}{
			"genre_tag_ids": []uint64{1, 2, 3},
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PUT", "/api/users/me/interests", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})
}
