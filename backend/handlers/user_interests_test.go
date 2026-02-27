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
)

func setupInterestsRouter() *gin.Engine {
	userHandler := &UserHandler{DB: testDB, RedisClient: nil}

	r := gin.New()
	r.GET("/api/users/me/interests", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetInterests)
	r.PUT("/api/users/me/interests", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.UpdateInterests)
	return r
}

func TestGetInterests(t *testing.T) {
	router := setupInterestsRouter()

	t.Run("認証済みユーザーの興味タグ一覧が取得できる", func(t *testing.T) {
		cleanupUsers(t)

		user := models.User{
			Email:       "interests@example.com",
			DisplayName: "Interests User",
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

		user := models.User{
			Email:       "nointerests@example.com",
			DisplayName: "No Interests User",
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

		user := models.User{
			Email:       "newinterests@example.com",
			DisplayName: "New Interests User",
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

		user := models.User{
			Email:       "updateinterests@example.com",
			DisplayName: "Update Interests User",
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

		user := models.User{
			Email:       "fewtags@example.com",
			DisplayName: "Few Tags User",
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

		user := models.User{
			Email:       "emptytags@example.com",
			DisplayName: "Empty Tags User",
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

// TestUpdateInterestsDoesNotClearDailyCache は興味タグ更新だけでは日次キャッシュが無効化されないことを確認する
// リロード（force_reload）を使って初めて新しい興味タグが反映される
func TestUpdateInterestsDoesNotClearDailyCache(t *testing.T) {
	if testRedisClient == nil {
		t.Skip("Redisクライアントが設定されていません")
	}

	cafePlaces := []PlaceResult{
		{PlaceID: "cache_cafe_1", Name: "キャッシュカフェA", Vicinity: "渋谷区1-1", Lat: 35.6762, Lng: 139.6503, Rating: 4.2, Types: []string{"cafe"}},
		{PlaceID: "cache_cafe_2", Name: "キャッシュカフェB", Vicinity: "渋谷区1-2", Lat: 35.6763, Lng: 139.6504, Rating: 4.0, Types: []string{"cafe"}},
		{PlaceID: "cache_cafe_3", Name: "キャッシュカフェC", Vicinity: "渋谷区1-3", Lat: 35.6764, Lng: 139.6505, Rating: 3.8, Types: []string{"cafe"}},
	}
	museumPlaces := []PlaceResult{
		{PlaceID: "cache_museum_1", Name: "キャッシュ博物館A", Vicinity: "渋谷区2-1", Lat: 35.6770, Lng: 139.6510, Rating: 4.5, Types: []string{"museum"}},
		{PlaceID: "cache_museum_2", Name: "キャッシュ博物館B", Vicinity: "渋谷区2-2", Lat: 35.6771, Lng: 139.6511, Rating: 4.3, Types: []string{"museum"}},
		{PlaceID: "cache_museum_3", Name: "キャッシュ博物館C", Vicinity: "渋谷区2-3", Lat: 35.6772, Lng: 139.6512, Rating: 4.1, Types: []string{"museum"}},
		{PlaceID: "cache_museum_4", Name: "キャッシュ博物館D", Vicinity: "渋谷区2-4", Lat: 35.6773, Lng: 139.6513, Rating: 3.9, Types: []string{"museum"}},
	}
	mixedPlaces := append(cafePlaces, museumPlaces...)

	t.Run("興味タグ変更だけではキャッシュは残り、force_reloadで初めて新タグが反映される", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		user := createTestUser(t)
		token := generateTestToken(user.ID)

		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		var museumTag models.GenreTag
		if err := testDB.Where("name = ?", "博物館・科学館").First(&museumTag).Error; err != nil {
			t.Skip("博物館・科学館ジャンルタグが見つかりません")
		}

		// 追加タグ（3つ以上必須）
		var extraTags []models.GenreTag
		testDB.Where("name != ? AND name != ?", "カフェ", "博物館・科学館").Limit(2).Find(&extraTags)
		if len(extraTags) < 2 {
			t.Skip("追加ジャンルタグが不足しています")
		}

		// ステップ1: カフェタグを設定（3つ必須）
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafeTag.ID})
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: extraTags[0].ID})
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: extraTags[1].ID})

		mock := &mockPlacesClient{Results: mixedPlaces}
		suggestionRouter := setupSuggestionRouterWithRedis(mock)
		userHandler := &UserHandler{DB: testDB, RedisClient: testRedisClient}
		interestsRouter := gin.New()
		interestsRouter.PUT("/api/users/me/interests", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.UpdateInterests)

		// ステップ2: 初回提案リクエスト（カフェタグで日次キャッシュが生成される）
		body := map[string]interface{}{"lat": 35.6762, "lng": 139.6503, "radius": 3000}
		jsonBody, _ := json.Marshal(body)
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		suggestionRouter.ServeHTTP(w1, req1)

		if w1.Code != http.StatusOK {
			t.Fatalf("初回提案リクエスト失敗: status %d, body: %s", w1.Code, w1.Body.String())
		}

		firstResp := parseSuggestions(t, w1.Body.Bytes())
		firstPlaceIDs := make([]string, len(firstResp))
		for i, p := range firstResp {
			firstPlaceIDs[i] = p.PlaceID
		}

		// ステップ3: 興味タグを博物館に変更（UpdateInterestsはキャッシュをクリアしない）
		var otherTags []models.GenreTag
		testDB.Where("name != ? AND name != ?", "カフェ", "博物館・科学館").Limit(2).Find(&otherTags)
		if len(otherTags) < 2 {
			t.Skip("追加ジャンルタグが不足しています")
		}
		updateBody := map[string]interface{}{
			"genre_tag_ids": []uint64{museumTag.ID, otherTags[0].ID, otherTags[1].ID},
		}
		updateJSON, _ := json.Marshal(updateBody)
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("PUT", "/api/users/me/interests", bytes.NewBuffer(updateJSON))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		interestsRouter.ServeHTTP(w2, req2)

		if w2.Code != http.StatusOK {
			t.Fatalf("興味タグ更新失敗: status %d, body: %s", w2.Code, w2.Body.String())
		}

		// ステップ4: タグ変更後に通常リクエスト → キャッシュが残っているので同じ提案が返る
		jsonBody2, _ := json.Marshal(body)
		w3 := httptest.NewRecorder()
		req3, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody2))
		req3.Header.Set("Content-Type", "application/json")
		req3.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		suggestionRouter.ServeHTTP(w3, req3)

		if w3.Code != http.StatusOK {
			t.Fatalf("タグ変更後の通常リクエスト失敗: status %d, body: %s", w3.Code, w3.Body.String())
		}

		secondResp := parseSuggestions(t, w3.Body.Bytes())

		// キャッシュが残っているので同じ施設が返るはず
		secondPlaceIDs := make([]string, len(secondResp))
		for i, p := range secondResp {
			secondPlaceIDs[i] = p.PlaceID
		}
		if len(firstPlaceIDs) != len(secondPlaceIDs) {
			t.Errorf("タグ変更後もキャッシュから同じ件数が返るはず: first=%d, second=%d", len(firstPlaceIDs), len(secondPlaceIDs))
		}
		for i := range firstPlaceIDs {
			if i < len(secondPlaceIDs) && firstPlaceIDs[i] != secondPlaceIDs[i] {
				t.Errorf("タグ変更後もキャッシュから同じ施設が返るはず: first[%d]=%s, second[%d]=%s", i, firstPlaceIDs[i], i, secondPlaceIDs[i])
			}
		}

		// ステップ5: force_reload で引き直し → 博物館が多い提案が返る
		reloadBody := map[string]interface{}{"lat": 35.6762, "lng": 139.6503, "radius": 3000, "force_reload": true}
		reloadJSON, _ := json.Marshal(reloadBody)
		w4 := httptest.NewRecorder()
		req4, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(reloadJSON))
		req4.Header.Set("Content-Type", "application/json")
		req4.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		suggestionRouter.ServeHTTP(w4, req4)

		if w4.Code != http.StatusOK {
			t.Fatalf("force_reloadリクエスト失敗: status %d, body: %s", w4.Code, w4.Body.String())
		}

		thirdResp := parseSuggestions(t, w4.Body.Bytes())

		// 博物館が多いことを確認（タグ変更がforce_reloadで反映されている）
		thirdMuseumCount := 0
		for _, p := range thirdResp {
			for _, typ := range p.Types {
				if typ == "museum" {
					thirdMuseumCount++
					break
				}
			}
		}
		if thirdMuseumCount < 2 {
			t.Errorf("force_reload後の提案で博物館が2件以上であることを期待しましたが、%d件でした", thirdMuseumCount)
		}
	})

	t.Run("異なる興味タグのユーザーで提案されるジャンルが異なる（Redis環境）", func(t *testing.T) {
		cleanupUsers(t)
		cleanupAllSuggestionCache(t)

		var cafeTag models.GenreTag
		if err := testDB.Where("name = ?", "カフェ").First(&cafeTag).Error; err != nil {
			t.Skip("カフェジャンルタグが見つかりません")
		}
		var museumTag models.GenreTag
		if err := testDB.Where("name = ?", "博物館・科学館").First(&museumTag).Error; err != nil {
			t.Skip("博物館・科学館ジャンルタグが見つかりません")
		}

		// ユーザーA（カフェタグ）
		userA := createTestUser(t)
		tokenA := generateTestToken(userA.ID)
		testDB.Create(&models.UserInterest{UserID: userA.ID, GenreTagID: cafeTag.ID})

		// ユーザーB（博物館タグ）- 別のメールアドレスで作成
		userB := models.User{Email: "suggest-museum@example.com", DisplayName: "Museum User"}
		testDB.Create(&userB)
		tokenB := generateTestToken(userB.ID)

		testDB.Create(&models.UserInterest{UserID: userB.ID, GenreTagID: museumTag.ID})

		mock := &mockPlacesClient{Results: mixedPlaces}
		router := setupSuggestionRouterWithRedis(mock)

		body := map[string]interface{}{"lat": 35.6762, "lng": 139.6503, "radius": 3000}
		jsonBody, _ := json.Marshal(body)

		// ユーザーAへの提案
		wA := httptest.NewRecorder()
		reqA, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBody))
		reqA.Header.Set("Content-Type", "application/json")
		reqA.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokenA))
		router.ServeHTTP(wA, reqA)

		if wA.Code != http.StatusOK {
			t.Fatalf("ユーザーAへの提案リクエスト失敗: status %d", wA.Code)
		}

		respA := parseSuggestions(t, wA.Body.Bytes())

		// ユーザーBへの提案
		jsonBodyB, _ := json.Marshal(body)
		wB := httptest.NewRecorder()
		reqB, _ := http.NewRequest("POST", "/api/suggestions", bytes.NewBuffer(jsonBodyB))
		reqB.Header.Set("Content-Type", "application/json")
		reqB.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokenB))
		router.ServeHTTP(wB, reqB)

		if wB.Code != http.StatusOK {
			t.Fatalf("ユーザーBへの提案リクエスト失敗: status %d", wB.Code)
		}

		respB := parseSuggestions(t, wB.Body.Bytes())

		// ユーザーAはカフェが多い
		cafeCountA := 0
		for _, p := range respA {
			for _, typ := range p.Types {
				if typ == "cafe" {
					cafeCountA++
					break
				}
			}
		}
		// ユーザーBは博物館が多い
		museumCountB := 0
		for _, p := range respB {
			for _, typ := range p.Types {
				if typ == "museum" {
					museumCountB++
					break
				}
			}
		}

		if cafeCountA < 2 {
			t.Errorf("ユーザーA（カフェタグ）の提案でカフェが2件以上であることを期待しましたが、%d件でした", cafeCountA)
		}
		if museumCountB < 2 {
			t.Errorf("ユーザーB（博物館タグ）の提案で博物館が2件以上であることを期待しましたが、%d件でした", museumCountB)
		}
	})
}
