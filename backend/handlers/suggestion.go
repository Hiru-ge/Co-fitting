package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
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
	IsComfortZone   *bool    `json:"is_comfort_zone"`
}

type PlacesSearcher interface {
	NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]PlaceResult, error)
}

// GooglePlacesClient は New Places API (v1) を net/http で直接呼び出すクライアント
type GooglePlacesClient struct {
	APIKey     string
	HTTPClient *http.Client
	BaseURL    string // テスト用。空の場合は本番エンドポイントを使用
}

const defaultPlacesAPIBaseURL = "https://places.googleapis.com"

// fieldMask は New Places API のレスポンスに含めるフィールド
const nearbySearchFieldMask = "places.id,places.displayName,places.location,places.types,places.photos,places.rating,places.shortFormattedAddress"

func NewGooglePlacesClient(apiKey string) (*GooglePlacesClient, error) {
	return &GooglePlacesClient{
		APIKey: apiKey,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

func (g *GooglePlacesClient) getBaseURL() string {
	if g.BaseURL != "" {
		return g.BaseURL
	}
	return defaultPlacesAPIBaseURL
}

func (g *GooglePlacesClient) getHTTPClient() *http.Client {
	if g.HTTPClient != nil {
		return g.HTTPClient
	}
	return &http.Client{Timeout: 10 * time.Second}
}

// nearbySearchRequest は New Places API (v1) searchNearby のリクエストボディ
type nearbySearchAPIRequest struct {
	IncludedTypes       []string                     `json:"includedTypes"`
	LocationRestriction nearbySearchLocationRestrict `json:"locationRestriction"`
	RankPreference      string                       `json:"rankPreference"`
	LanguageCode        string                       `json:"languageCode"`
	MaxResultCount      int                          `json:"maxResultCount"`
}

type nearbySearchLocationRestrict struct {
	Circle nearbySearchCircle `json:"circle"`
}

type nearbySearchCircle struct {
	Center nearbySearchLatLng `json:"center"`
	Radius float64            `json:"radius"`
}

type nearbySearchLatLng struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// nearbySearchAPIResponse は New Places API (v1) searchNearby のレスポンス
type nearbySearchAPIResponse struct {
	Places []nearbySearchPlace `json:"places"`
}

type nearbySearchPlace struct {
	ID                    string                  `json:"id"`
	Types                 []string                `json:"types"`
	DisplayName           nearbySearchDisplayName `json:"displayName"`
	Location              nearbySearchLatLng      `json:"location"`
	Rating                float32                 `json:"rating"`
	Photos                []nearbySearchPhoto     `json:"photos"`
	ShortFormattedAddress string                  `json:"shortFormattedAddress"`
}

type nearbySearchDisplayName struct {
	Text         string `json:"text"`
	LanguageCode string `json:"languageCode"`
}

type nearbySearchPhoto struct {
	Name     string `json:"name"`
	WidthPx  int    `json:"widthPx"`
	HeightPx int    `json:"heightPx"`
}

func (g *GooglePlacesClient) NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]PlaceResult, error) {
	// visitableTypes からリクエスト用の includedTypes を構築
	includedTypes := make([]string, 0, len(visitableTypes))
	for t := range visitableTypes {
		includedTypes = append(includedTypes, t)
	}

	apiReq := nearbySearchAPIRequest{
		IncludedTypes: includedTypes,
		LocationRestriction: nearbySearchLocationRestrict{
			Circle: nearbySearchCircle{
				Center: nearbySearchLatLng{
					Latitude:  lat,
					Longitude: lng,
				},
				Radius: float64(radius),
			},
		},
		RankPreference: "DISTANCE",
		LanguageCode:   "ja",
		MaxResultCount: 20,
	}

	body, err := json.Marshal(apiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := g.getBaseURL() + "/v1/places:searchNearby"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Goog-Api-Key", g.APIKey)
	httpReq.Header.Set("X-Goog-FieldMask", nearbySearchFieldMask)

	resp, err := g.getHTTPClient().Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("nearby search request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nearby search failed with status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var apiResp nearbySearchAPIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	results := make([]PlaceResult, 0, len(apiResp.Places))
	for _, p := range apiResp.Places {
		var photoRef string
		if len(p.Photos) > 0 {
			photoRef = p.Photos[0].Name
		}
		results = append(results, PlaceResult{
			PlaceID:        p.ID,
			Name:           p.DisplayName.Text,
			Vicinity:       p.ShortFormattedAddress,
			Lat:            p.Location.Latitude,
			Lng:            p.Location.Longitude,
			Rating:         p.Rating,
			Types:          p.Types,
			PhotoReference: photoRef,
		})
	}
	return results, nil
}

// placeTypeToGenreName はGoogle Maps Place TypeからGenreTag名（日本語）へのマッピング
var placeTypeToGenreName = map[string]string{
	// 飲食
	"cafe":             "カフェ",
	"restaurant":       "レストラン",
	"meal_takeaway":    "レストラン",
	"bar":              "居酒屋・バー",
	"night_club":       "居酒屋・バー",
	"bakery":           "スイーツ・ベーカリー",
	"ramen_restaurant": "ラーメン・麺類",
	// アウトドア・自然
	"park":       "公園・緑地",
	"campground": "自然・ハイキング",
	"beach":      "海・川・湖",
	"lake":       "海・川・湖",
	"river":      "海・川・湖",
	// 文化・芸術
	"art_gallery": "美術館・ギャラリー",
	"museum":      "博物館・科学館",
	"library":     "図書館・書店",
	"book_store":  "図書館・書店",
	// エンタメ
	"movie_theater":    "映画館",
	"bowling_alley":    "スポーツ施設",
	"karaoke":          "カラオケ",
	"amusement_center": "ゲームセンター",
	"video_arcade":     "ゲームセンター",
	// スポーツ・アクティブ
	"gym":            "スポーツジム",
	"fitness_center": "スポーツジム",
	// リラクゼーション
	"spa":         "マッサージ・スパ",
	"public_bath": "温泉・銭湯",
	"sauna":       "温泉・銭湯",
	// ショッピング
	"shopping_mall":    "ショッピングモール",
	"clothing_store":   "雑貨・セレクトショップ",
	"department_store": "ショッピングモール",
	"home_goods_store": "雑貨・セレクトショップ",
	// 観光・文化
	"church":             "神社・寺",
	"hindu_temple":       "神社・寺",
	"mosque":             "神社・寺",
	"synagogue":          "神社・寺",
	"tourist_attraction": "観光スポット",
	"aquarium":           "観光スポット",
	"zoo":                "観光スポット",
	"amusement_park":     "観光スポット",
}

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

// isComfortZoneVisit はジャンル熟練度に基づいて脱却訪問かどうかを判定する
// 熟練度Lv.1（レコードなし or Level==1）なら脱却扱い（初回〜数回の訪問）
// genreName が空の場合や genreTag が見つからない場合は false を返す
func isComfortZoneVisit(db *gorm.DB, userID uint64, genreName string) bool {
	if genreName == "" {
		return false
	}
	var genreTag models.GenreTag
	if err := db.Where("name = ?", genreName).First(&genreTag).Error; err != nil {
		// ジャンルタグが見つからない場合は脱却扱い（未知のジャンル）
		return true
	}
	var prof models.GenreProficiency
	result := db.Where("user_id = ? AND genre_tag_id = ?", userID, genreTag.ID).First(&prof)
	// レコードなし or Level < comfortZoneLevelThreshold → 脱却扱い
	return result.Error != nil || prof.Level < comfortZoneLevelThreshold
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

// selectPersonalizedPlaces は興味内を優先して最大maxDailySuggestions件を選出する
// 興味内が3件以上あれば全て興味内から選出（旧来の強制挿入＝上限2件キャップを廃止）
// 興味内が不足する場合のみ興味外から補充する
// 脱却判定は訪問時の熟練度ベース（Issue #198）で自然に発生するため強制挿入は不要
func selectPersonalizedPlaces(inInterest, outOfInterest []PlaceResult) []PlaceResult {
	// 興味内から最大maxDailySuggestions件選出（強制上限なし）
	selected := selectRandomPlaces(inInterest, maxDailySuggestions)
	// 不足分を興味外から補充
	remaining := maxDailySuggestions - len(selected)
	if remaining > 0 && len(outOfInterest) > 0 {
		selected = append(selected, selectRandomPlaces(outOfInterest, remaining)...)
	}
	return selected
}

// 訪れるのに適した場所のタイプ（許可リスト）
var visitableTypes = map[string]bool{
	// グルメ
	"restaurant":       true,
	"cafe":             true,
	"bar":              true,
	"bakery":           true,
	"meal_takeaway":    true,
	"ramen_restaurant": true,
	// エンタメ
	"amusement_park":   true,
	"aquarium":         true,
	"bowling_alley":    true,
	"movie_theater":    true,
	"night_club":       true,
	"karaoke":          true,
	"amusement_center": true,
	"video_arcade":     true,
	// 文化・アート
	"art_gallery": true,
	"museum":      true,
	"library":     true,
	"book_store":  true,
	// 自然・アウトドア
	"park":       true,
	"campground": true,
	"zoo":        true,
	"beach":      true,
	"lake":       true,
	"river":      true,
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
	"gym":            true,
	"fitness_center": true,
	"stadium":        true,
	// リラクゼーション
	"spa":         true,
	"public_bath": true,
	"sauna":       true,
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

// comfortZoneLevelThreshold は脱却判定の熟練度閾値
// ジャンル熟練度がこのレベル未満（Lv.1 = 0〜99XP）なら脱却扱い
const comfortZoneLevelThreshold = 2

// デフォルトの検索半径（メートル）
const defaultSearchRadius uint = 3000

// 最大検索半径（メートル）— API課金制御
const maxSearchRadius uint = 50000

// visitedExclusionDays は訪問済みフィルタの閾値日数
// この日数以内に訪問した施設は提案から除外される。それより前の訪問は再提案候補として扱う
const visitedExclusionDays = 30

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
		c.JSON(http.StatusBadRequest, gin.H{"error": "リクエストの形式が正しくありません"})
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
					// 最新の興味タグでis_interest_matchを再設定、熟練度ベースis_comfort_zoneを設定
					interestNames, _ := getUserInterestGenreNames(h.DB, userID)
					for i := range filtered {
						genreName := getGenreNameFromTypes(filtered[i].Types)
						if len(interestNames) > 0 {
							match := genreName != "" && interestNames[genreName]
							filtered[i].IsInterestMatch = &match
						} else {
							filtered[i].IsInterestMatch = nil
						}
						// 熟練度ベース脱却判定を再設定
						isComfort := isComfortZoneVisit(h.DB, userID, genreName)
						filtered[i].IsComfortZone = &isComfort
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
			if unmarshalErr := json.Unmarshal([]byte(cached), &places); unmarshalErr != nil {
				// キャッシュが破損している場合はキャッシュを無効化してAPI再取得へフォールバック
				log.Printf("Warning: corrupted places cache for key %s, invalidating: %v", cacheKey, unmarshalErr)
				h.RedisClient.Del(ctx, cacheKey)
				places = nil
			}
		}
	}

	// 3. キャッシュがなければPlaces APIを呼び出し
	if len(places) == 0 {
		var err error
		places, err = h.Places.NearbySearch(ctx, req.Lat, req.Lng, req.Radius)
		if err != nil {
			log.Printf("NearbySearch error: %v", err)
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
		c.JSON(http.StatusOK, SuggestionResult{Completed: true, Notice: "ALL_VISITED_NEARBY"})
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

	// 熟練度ベース脱却判定 is_comfort_zone を全選出施設にセット
	for i := range selected {
		genreName := getGenreNameFromTypes(selected[i].Types)
		isComfort := isComfortZoneVisit(h.DB, userID, genreName)
		selected[i].IsComfortZone = &isComfort
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

// filterOutVisited は最近（30日以内）訪問済みの施設を除外する。
// visitedExclusionDays 日より前に訪問した施設は除外対象から外し、再提案候補として扱う。
// 候補のplace_idのみに絞ってクエリすることで、全訪問履歴のロードを回避する。
func filterOutVisited(db *gorm.DB, userID uint64, places []PlaceResult) []PlaceResult {
	if len(places) == 0 {
		return nil
	}

	candidateIDs := make([]string, len(places))
	for i, p := range places {
		candidateIDs[i] = p.PlaceID
	}

	threshold := time.Now().AddDate(0, 0, -visitedExclusionDays)
	var visitedPlaceIDs []string
	db.Model(&models.Visit{}).
		Where("user_id = ? AND visited_at >= ? AND place_id IN ?", userID, threshold, candidateIDs).
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
