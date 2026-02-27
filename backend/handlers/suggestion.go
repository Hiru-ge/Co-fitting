package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"net/http"
	"strconv"
	"time"

	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"googlemaps.github.io/maps"
	"gorm.io/gorm"
)

type PlaceResult struct {
	PlaceID         string   `json:"place_id"`
	Name            string   `json:"name"`
	Vicinity        string   `json:"vicinity"`
	Lat             float64  `json:"lat"`
	Lng             float64  `json:"lng"`
	Rating          float32  `json:"rating"`
	Types           []string `json:"types"`
	PhotoReference  string   `json:"photo_reference,omitempty"`
	IsInterestMatch *bool    `json:"is_interest_match"`
}

type PlacesSearcher interface {
	NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]PlaceResult, error)
}

type GooglePlacesClient struct {
	Client *maps.Client
}

func NewGooglePlacesClient(apiKey string) (*GooglePlacesClient, error) {
	client, err := maps.NewClient(maps.WithAPIKey(apiKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create Google Maps client: %w", err)
	}
	return &GooglePlacesClient{Client: client}, nil
}

func (g *GooglePlacesClient) NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]PlaceResult, error) {
	req := &maps.NearbySearchRequest{
		Location: &maps.LatLng{Lat: lat, Lng: lng},
		Radius:   radius,
		Language: "ja",
	}
	resp, err := g.Client.NearbySearch(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("nearby search failed: %w", err)
	}

	results := make([]PlaceResult, 0, len(resp.Results))
	for _, r := range resp.Results {
		var photoRef string
		if len(r.Photos) > 0 {
			photoRef = r.Photos[0].PhotoReference
		}
		results = append(results, PlaceResult{
			PlaceID:        r.PlaceID,
			Name:           r.Name,
			Vicinity:       r.Vicinity,
			Lat:            r.Geometry.Location.Lat,
			Lng:            r.Geometry.Location.Lng,
			Rating:         r.Rating,
			Types:          r.Types,
			PhotoReference: photoRef,
		})
	}
	return results, nil
}

// placeTypeToGenreName はGoogle Maps Place TypeからGenreTag名（日本語）へのマッピング
var placeTypeToGenreName = map[string]string{
	// 飲食
	"cafe":          "カフェ",
	"restaurant":    "レストラン",
	"meal_takeaway": "レストラン",
	"bar":           "居酒屋・バー",
	"night_club":    "居酒屋・バー",
	"bakery":        "スイーツ・ベーカリー",
	// アウトドア
	"park":       "公園・緑地",
	"campground": "自然・ハイキング",
	// 文化・芸術
	"art_gallery": "美術館・ギャラリー",
	"museum":      "博物館・科学館",
	"library":     "図書館・書店",
	"book_store":  "図書館・書店",
	// エンタメ
	"movie_theater": "映画館",
	"bowling_alley": "スポーツ施設",
	// ショッピング
	"shopping_mall":    "ショッピングモール",
	"clothing_store":   "雑貨・セレクトショップ",
	"department_store": "ショッピングモール",
	"home_goods_store": "雑貨・セレクトショップ",
	// リラクゼーション
	"spa": "マッサージ・スパ",
	// 観光・文化
	"place_of_worship":   "神社・寺",
	"church":             "神社・寺",
	"hindu_temple":       "神社・寺",
	"mosque":             "神社・寺",
	"synagogue":          "神社・寺",
	"tourist_attraction": "観光スポット",
	"aquarium":           "観光スポット",
	"zoo":                "観光スポット",
	"amusement_park":     "観光スポット",
}

// inInterestCount は提案3件中、興味内ジャンルから選ぶ件数
const inInterestCount = 2

// getGenreNameFromTypes はPlace TypesからGenreTag名を返す（最初にマッチしたもの）
func getGenreNameFromTypes(types []string) string {
	for _, t := range types {
		if name, ok := placeTypeToGenreName[t]; ok {
			return name
		}
	}
	return ""
}

// getUserInterestGenreNames はユーザーの興味タグ名セットをDBから取得する
func getUserInterestGenreNames(db *gorm.DB, userID uint64) (map[string]bool, error) {
	type interestWithTag struct {
		GenreTagName string
	}
	var results []interestWithTag
	if err := db.Table("user_interests").
		Select("genre_tags.name as genre_tag_name").
		Joins("JOIN genre_tags ON genre_tags.id = user_interests.genre_tag_id").
		Where("user_interests.user_id = ?", userID).
		Scan(&results).Error; err != nil {
		return nil, err
	}
	names := make(map[string]bool, len(results))
	for _, r := range results {
		names[r.GenreTagName] = true
	}
	return names, nil
}

// classifyByInterest は候補を興味内・興味外に分類し、興味内にはIsInterestMatch=trueを設定する
func classifyByInterest(places []PlaceResult, interestGenreNames map[string]bool) (inInterest, outOfInterest []PlaceResult) {
	for _, p := range places {
		genreName := getGenreNameFromTypes(p.Types)
		if genreName != "" && interestGenreNames[genreName] {
			p.IsInterestMatch = boolPtr(true)
			inInterest = append(inInterest, p)
		} else {
			outOfInterest = append(outOfInterest, p)
		}
	}
	return
}

// selectPersonalizedPlaces は興味内を優先しつつ、興味外も混在させて最大maxDailySuggestions件を選出する
// 比率: 興味内inInterestCount件 + 興味外(maxDailySuggestions-inInterestCount)件
func selectPersonalizedPlaces(inInterest, outOfInterest []PlaceResult) []PlaceResult {
	selected := make([]PlaceResult, 0, maxDailySuggestions)

	// 興味内から最大inInterestCount件
	inSelected := selectRandomPlaces(inInterest, inInterestCount)
	selected = append(selected, inSelected...)

	// 残り枠を興味外から補充
	remaining := maxDailySuggestions - len(selected)
	if remaining > 0 && len(outOfInterest) > 0 {
		outSelected := selectRandomPlaces(outOfInterest, remaining)
		selected = append(selected, outSelected...)
	}

	// まだ枠が残っていれば興味内から追加補充（興味外が足りない場合）
	remaining = maxDailySuggestions - len(selected)
	if remaining > 0 && len(inInterest) > len(inSelected) {
		selectedIDs := make(map[string]bool, len(selected))
		for _, p := range selected {
			selectedIDs[p.PlaceID] = true
		}
		var moreCandidates []PlaceResult
		for _, p := range inInterest {
			if !selectedIDs[p.PlaceID] {
				moreCandidates = append(moreCandidates, p)
			}
		}
		selected = append(selected, selectRandomPlaces(moreCandidates, remaining)...)
	}

	// それでも枠が残れば興味外から追加補充（すでに選ばれたものを除く）
	remaining = maxDailySuggestions - len(selected)
	if remaining > 0 && len(outOfInterest) > 0 {
		selectedIDs := make(map[string]bool, len(selected))
		for _, p := range selected {
			selectedIDs[p.PlaceID] = true
		}
		var moreCandidates []PlaceResult
		for _, p := range outOfInterest {
			if !selectedIDs[p.PlaceID] {
				moreCandidates = append(moreCandidates, p)
			}
		}
		selected = append(selected, selectRandomPlaces(moreCandidates, remaining)...)
	}

	return selected
}

// 訪れるのに適した場所のタイプ（許可リスト）
var visitableTypes = map[string]bool{
	// グルメ
	"restaurant":    true,
	"cafe":          true,
	"bar":           true,
	"bakery":        true,
	"meal_takeaway": true,
	// エンタメ
	"amusement_park": true,
	"aquarium":       true,
	"bowling_alley":  true,
	"movie_theater":  true,
	"night_club":     true,
	// 文化・アート
	"art_gallery":      true,
	"museum":           true,
	"library":          true,
	"book_store":       true,
	"place_of_worship": true,
	// 自然・アウトドア
	"park":       true,
	"campground": true,
	"zoo":        true,
	// ショッピング
	"shopping_mall":    true,
	"clothing_store":   true,
	"department_store": true,
	"home_goods_store": true,
	// 観光
	"tourist_attraction": true,
	"church":             true,
	"hindu_temple":       true,
	"mosque":             true,
	"synagogue":          true,
	// スポーツ・アクティブ
	"gym":     true,
	"stadium": true,
}

func isVisitablePlace(types []string) bool {
	for _, t := range types {
		if visitableTypes[t] {
			return true
		}
	}
	return false
}

type SuggestionHandler struct {
	DB          *gorm.DB
	RedisClient *redis.Client
	Places      PlacesSearcher
}

// SuggestionResult は提案APIのレスポンス型
// notice が "NO_INTEREST_PLACES" の場合、興味タグに合う施設が半径内に見つからなかったことを示す
// completed が true の場合、本日の3件提案を全て訪問済みであることを示す
type SuggestionResult struct {
	Places               []PlaceResult `json:"places"`
	Notice               string        `json:"notice,omitempty"`
	Completed            bool          `json:"completed,omitempty"`
	ReloadCountRemaining *int          `json:"reload_count_remaining,omitempty"`
}

type suggestionRequest struct {
	Lat         float64 `json:"lat" binding:"required"`
	Lng         float64 `json:"lng" binding:"required"`
	Radius      uint    `json:"radius"`
	ForceReload bool    `json:"force_reload"`
}

// 日次キャッシュで返す最大施設数
const maxDailySuggestions = 3

// デフォルトの検索半径（メートル）
const defaultSearchRadius uint = 3000

// 最大検索半径（メートル）— API課金制御
const maxSearchRadius uint = 50000

// Suggest godoc
// @Summary      場所の提案
// @Description  指定した位置情報の周辺から、訪れたことのない場所を最大3件提案する。同一ユーザー・同一日・同一エリアでは同じ結果を返す（日次キャッシュ）
// @Description  notice が "NO_INTEREST_PLACES" の場合、興味タグに合う施設が半径内になかったことを示す（施設自体は興味外から提案される）
// @Tags         Suggestion
// @Accept       json
// @Produce      json
// @Param        body  body  suggestionRequest  true  "位置情報と半径"
// @Success      200  {object}  SuggestionResult
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /api/suggestions [post]
// @Security     BearerAuth
func (h *SuggestionHandler) Suggest(c *gin.Context) {
	var req suggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	// radius未指定の場合はユーザーのsearch_radius設定値を使用
	if req.Radius == 0 {
		var user models.User
		if err := h.DB.Select("search_radius").First(&user, userID).Error; err == nil && user.SearchRadius > 0 {
			req.Radius = user.SearchRadius
		} else {
			req.Radius = defaultSearchRadius
		}
	}
	if req.Radius > maxSearchRadius {
		req.Radius = maxSearchRadius
	}

	ctx := c.Request.Context()
	jst := time.FixedZone("Asia/Tokyo", 9*60*60)
	today := time.Now().In(jst).Format("2006-01-02")
	userIDStr := strconv.FormatUint(userID, 10)

	// 0. リロードカウントの取得（レスポンスに含めるため）
	var reloadCount int
	if h.RedisClient != nil {
		rc, err := database.GetDailyReloadCount(ctx, h.RedisClient, userIDStr, today)
		if err == nil {
			reloadCount = rc
		}
	}

	// 0.5 force_reload の場合: リロード上限チェック → キャッシュクリア
	if req.ForceReload && h.RedisClient != nil {
		// 日次上限到達済みの場合はリロード不可
		reached, err := database.IsDailyLimitReached(ctx, h.RedisClient, userIDStr, today)
		if err == nil && reached {
			c.JSON(http.StatusOK, SuggestionResult{Completed: true})
			return
		}

		// リロード回数の上限チェック
		if reloadCount >= database.MaxDailyReloads {
			remaining := 0
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":                  "今日のリロードは使い切りました。明日また使えます",
				"code":                   "RELOAD_LIMIT_REACHED",
				"reload_count_remaining": remaining,
			})
			return
		}

		// リロードカウントをインクリメント
		newCount, err := database.IncrementDailyReloadCount(ctx, h.RedisClient, userIDStr, today, 24*time.Hour)
		if err == nil {
			reloadCount = newCount
		}

		// 日次提案キャッシュをクリア（新しい提案を生成するため）
		database.ClearDailySuggestionsCache(ctx, h.RedisClient, userIDStr)

		// Places APIキャッシュもクリア（完全に新しい候補を取得するため）
		placeCacheKey := fmt.Sprintf("suggestions:%.4f:%.4f:%d", req.Lat, req.Lng, req.Radius)
		h.RedisClient.Del(ctx, placeCacheKey)
	}

	// リロード残り回数を計算
	reloadRemaining := database.MaxDailyReloads - reloadCount
	if reloadRemaining < 0 {
		reloadRemaining = 0
	}

	// 1. 日次キャッシュを確認
	if h.RedisClient != nil {
		cached, err := database.GetDailySuggestions(ctx, h.RedisClient, userIDStr, today, req.Lat, req.Lng)
		if err == nil && cached != "" {
			var dailyPlaces []PlaceResult
			if err := json.Unmarshal([]byte(cached), &dailyPlaces); err == nil && len(dailyPlaces) > 0 {
				// キャッシュヒットしても訪問済み施設を除外
				filtered := filterOutVisited(h.DB, userID, dailyPlaces)
				if len(filtered) > 0 {
					// 最新の興味タグでis_interest_matchを再設定
					interestNames, _ := getUserInterestGenreNames(h.DB, userID)
					for i := range filtered {
						if len(interestNames) > 0 {
							genreName := getGenreNameFromTypes(filtered[i].Types)
							match := genreName != "" && interestNames[genreName]
							filtered[i].IsInterestMatch = &match
						} else {
							filtered[i].IsInterestMatch = nil
						}
					}
					c.JSON(http.StatusOK, SuggestionResult{Places: filtered, ReloadCountRemaining: &reloadRemaining})
					return
				}
				// 日次提案は割り当て済みで全て訪問済み → 本日の上限に達した
				// 上限到達フラグを立てておく（リストキャッシュが削除されても復活しないよう）
				database.SetDailyLimitReached(ctx, h.RedisClient, userIDStr, today, 24*time.Hour)
				c.JSON(http.StatusOK, SuggestionResult{Completed: true})
				return
			}
		}

		// 1.5. リストキャッシュがなくても上限到達フラグが立っている場合は完了として返す
		// 「全提案を訪問した後に興味タグを変更した」ケースをここで捉える
		// 未訪問提案がある状態での興味タグ変更（Issue #153）は上限到達フラグが立たないため通過する
		reached, err := database.IsDailyLimitReached(ctx, h.RedisClient, userIDStr, today)
		if err == nil && reached {
			c.JSON(http.StatusOK, SuggestionResult{Completed: true})
			return
		}
	}

	// 2. Places API結果のキャッシュを確認
	cacheKey := fmt.Sprintf("suggestions:%.4f:%.4f:%d", req.Lat, req.Lng, req.Radius)
	var places []PlaceResult
	if h.RedisClient != nil {
		cached, err := h.RedisClient.Get(ctx, cacheKey).Result()
		if err == nil {
			json.Unmarshal([]byte(cached), &places)
		}
	}

	// 3. キャッシュがなければPlaces APIを呼び出し
	if len(places) == 0 {
		var err error
		places, err = h.Places.NearbySearch(ctx, req.Lat, req.Lng, req.Radius)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search nearby places", "code": "INTERNAL_ERROR"})
			return
		}

		// 訪れるのに適した場所のみにフィルタリング
		filtered := make([]PlaceResult, 0, len(places))
		for _, p := range places {
			if isVisitablePlace(p.Types) {
				filtered = append(filtered, p)
			}
		}
		places = filtered

		// Redisにキャッシュ（TTL 24h）— フィルタ済みの結果を保存
		if h.RedisClient != nil && len(places) > 0 {
			data, _ := json.Marshal(places)
			h.RedisClient.Set(ctx, cacheKey, string(data), 24*time.Hour)
		}
	}

	if len(places) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no nearby places found", "code": "NO_NEARBY_PLACES"})
		return
	}

	// 4. 訪問済みを除外
	unvisited := filterOutVisited(h.DB, userID, places)

	if len(unvisited) == 0 {
		c.JSON(http.StatusOK, SuggestionResult{Completed: true})
		return
	}

	// 5. ユーザーの興味タグを取得してパーソナライズ選出（タグなしはランダムにフォールバック）
	var selected []PlaceResult
	var notice string
	interestGenreNames, err := getUserInterestGenreNames(h.DB, userID)
	if err != nil || len(interestGenreNames) == 0 {
		selected = selectRandomPlaces(unvisited, maxDailySuggestions)
		// 興味タグ未設定時は is_interest_match をセットしない（nil のまま）
	} else {
		inInterest, outOfInterest := classifyByInterest(unvisited, interestGenreNames)
		// 興味タグが設定されているが半径内に興味内施設が0件の場合はユーザーに通知
		if len(inInterest) == 0 && len(outOfInterest) > 0 {
			notice = "NO_INTEREST_PLACES"
		}
		selected = selectPersonalizedPlaces(inInterest, outOfInterest)
		// is_interest_match フラグをセット（興味内/外を示す）
		for i := range selected {
			genreName := getGenreNameFromTypes(selected[i].Types)
			match := genreName != "" && interestGenreNames[genreName]
			selected[i].IsInterestMatch = &match
		}
	}

	// 6. 日次キャッシュに保存（カウントは全提案訪問時にのみ設定。ここでは設定しない）
	if h.RedisClient != nil {
		data, _ := json.Marshal(selected)
		database.SetDailySuggestions(ctx, h.RedisClient, userIDStr, today, req.Lat, req.Lng, string(data), 24*time.Hour)
	}

	c.JSON(http.StatusOK, SuggestionResult{Places: selected, Notice: notice, ReloadCountRemaining: &reloadRemaining})
}

// selectRandomPlaces は候補から最大n件をランダムに選出する
func selectRandomPlaces(candidates []PlaceResult, n int) []PlaceResult {
	if len(candidates) <= n {
		return candidates
	}

	// Fisher-Yatesシャッフルで先頭n件を選出
	shuffled := make([]PlaceResult, len(candidates))
	copy(shuffled, candidates)
	for i := len(shuffled) - 1; i > 0; i-- {
		j := rand.IntN(i + 1)
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}
	return shuffled[:n]
}

// filterOutVisited は訪問済みの施設を除外する
func filterOutVisited(db *gorm.DB, userID uint64, places []PlaceResult) []PlaceResult {
	var visitedPlaceIDs []string
	db.Model(&models.Visit{}).
		Where("user_id = ?", userID).
		Pluck("place_id", &visitedPlaceIDs)

	visitedSet := make(map[string]bool, len(visitedPlaceIDs))
	for _, id := range visitedPlaceIDs {
		visitedSet[id] = true
	}

	var result []PlaceResult
	for _, p := range places {
		if !visitedSet[p.PlaceID] {
			result = append(result, p)
		}
	}
	return result
}

func boolPtr(b bool) *bool {
	return &b
}
