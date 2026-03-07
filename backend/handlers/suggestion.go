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
	IsBreakout      *bool    `json:"is_breakout"`
	OpenNow         *bool    `json:"open_now,omitempty"`
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
// currentOpeningHours は季節・祝日を考慮した現在の営業状況（regularOpeningHours より正確）
const nearbySearchFieldMask = "places.id,places.displayName,places.location,places.types,places.photos,places.rating,places.shortFormattedAddress,places.currentOpeningHours"

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
	ID                    string                    `json:"id"`
	Types                 []string                  `json:"types"`
	DisplayName           nearbySearchDisplayName   `json:"displayName"`
	Location              nearbySearchLatLng        `json:"location"`
	Rating                float32                   `json:"rating"`
	Photos                []nearbySearchPhoto       `json:"photos"`
	ShortFormattedAddress string                    `json:"shortFormattedAddress"`
	CurrentOpeningHours   *nearbySearchOpeningHours `json:"currentOpeningHours,omitempty"`
}

type nearbySearchOpeningHours struct {
	OpenNow bool `json:"openNow"`
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
		var openNow *bool
		if p.CurrentOpeningHours != nil {
			v := p.CurrentOpeningHours.OpenNow
			openNow = &v
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
			OpenNow:        openNow,
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
	"stadium":        "スポーツ施設",
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

// isBreakoutVisit はジャンル熟練度と興味タグに基づいて脱却訪問かどうかを判定する
// 「興味タグ外 かつ 熟練度Lv.5以下」のジャンルへの訪問を脱却扱いとする
// 興味タグ内のジャンルへの訪問は脱却扱いしない
// genreName が空の場合や genreTag が見つからない場合は false を返す
func isBreakoutVisit(db *gorm.DB, userID uint64, genreName string) bool {
	if genreName == "" {
		return false
	}

	// 興味タグ内のジャンルは脱却扱いしない
	interestGenres, err := getUserInterestGenreNames(db, userID)
	if err == nil && interestGenres[genreName] {
		return false
	}

	var genreTag models.GenreTag
	if err := db.Where("name = ?", genreName).First(&genreTag).Error; err != nil {
		// ジャンルタグが見つからない場合は脱却扱い（未知のジャンル）
		return true
	}
	var prof models.GenreProficiency
	result := db.Where("user_id = ? AND genre_tag_id = ?", userID, genreTag.ID).First(&prof)
	// レコードなし or Level < breakoutLevelThreshold → 脱却扱い
	return result.Error != nil || prof.Level < breakoutLevelThreshold
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

// selectPersonalizedPlaces は「興味内2枠 + 完全ランダム1枠」で最大maxDailySuggestions件を選出する
// Issue #222: 発見感を高めるため、固定2枠興味内 + 1枠完全ランダム（興味内外問わず）とする
// 興味内が2未満の場合は全興味内を使い、残りをランダム補充する
func selectPersonalizedPlaces(inInterest, outOfInterest []PlaceResult) []PlaceResult {
	const interestSlots = 2

	// 興味内から最大2枠選出
	selected := selectRandomPlaces(inInterest, interestSlots)

	// 選出済みIDのセット
	selectedIDs := make(map[string]bool, len(selected))
	for _, p := range selected {
		selectedIDs[p.PlaceID] = true
	}

	// 完全ランダム枠: 選出済みを除いた全候補（興味内残り + 興味外）から補充
	allRemaining := make([]PlaceResult, 0, len(inInterest)+len(outOfInterest))
	for _, p := range inInterest {
		if !selectedIDs[p.PlaceID] {
			allRemaining = append(allRemaining, p)
		}
	}
	for _, p := range outOfInterest {
		if !selectedIDs[p.PlaceID] {
			allRemaining = append(allRemaining, p)
		}
	}

	remaining := maxDailySuggestions - len(selected)
	if remaining > 0 && len(allRemaining) > 0 {
		selected = append(selected, selectRandomPlaces(allRemaining, remaining)...)
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

// filterOpenNowPlaces は OpenNow=false の施設を除外する。
// OpenNow が nil（営業時間情報なし）の施設は深夜時間帯ユーザーへの配慮として除外しない。
func filterOpenNowPlaces(places []PlaceResult) []PlaceResult {
	filtered := make([]PlaceResult, 0, len(places))
	for _, p := range places {
		if p.OpenNow != nil && !*p.OpenNow {
			continue
		}
		filtered = append(filtered, p)
	}
	return filtered
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
	Lat           float64 `json:"lat" binding:"required"`
	Lng           float64 `json:"lng" binding:"required"`
	Radius        uint    `json:"radius"`
	ForceReload   bool    `json:"force_reload"`
	FilterOpenNow bool    `json:"filter_open_now"`
}

// 日次キャッシュで返す最大施設数
const maxDailySuggestions = 3

// breakoutLevelThreshold は脱却判定の熟練度閾値
// ジャンル熟練度がこのレベル未満（Lv.5以下 = 0〜499XP）なら脱却扱い
// ジャンル熟練度の最大はLv.20だが、Lv.6以上になれば興味タグ外でも通常扱い
const breakoutLevelThreshold = 6

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
// @Description  filter_open_now=true を指定すると現在営業中の施設のみを提案する（デフォルトOFF）。営業時間情報がない施設（公園など）は除外しない
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "code": "INVALID_REQUEST"})
		return
	}

	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	req.Radius = h.resolveRadius(userID, req.Radius)

	ctx := c.Request.Context()
	jst := time.FixedZone("Asia/Tokyo", 9*60*60)
	today := time.Now().In(jst).Format("2006-01-02")
	userIDStr := strconv.FormatUint(userID, 10)

	reloadCount := h.getReloadCount(ctx, userIDStr, today)

	if req.ForceReload {
		newCount, done, status, body := h.processForceReload(ctx, userIDStr, today, req, reloadCount)
		if done {
			c.JSON(status, body)
			return
		}
		reloadCount = newCount
	}

	reloadRemaining := database.MaxDailyReloads - reloadCount
	if reloadRemaining < 0 {
		reloadRemaining = 0
	}

	if result, found := h.checkDailyCacheResult(ctx, userID, userIDStr, today, req, reloadRemaining); found {
		c.JSON(http.StatusOK, *result)
		return
	}

	cacheKey := fmt.Sprintf("suggestions:%.4f:%.4f:%d", req.Lat, req.Lng, req.Radius)
	places, err := h.fetchPlacesFromCacheOrAPI(ctx, req, cacheKey)
	if err != nil {
		log.Printf("NearbySearch error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search nearby places", "code": "INTERNAL_ERROR"})
		return
	}

	if len(places) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no nearby places found", "code": "NO_NEARBY_PLACES"})
		return
	}

	if req.FilterOpenNow {
		places = filterOpenNowPlaces(places)
		if len(places) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "no open places found", "code": "NO_OPEN_PLACES"})
			return
		}
	}

	unvisited := filterOutVisited(h.DB, userID, places)
	if len(unvisited) == 0 {
		c.JSON(http.StatusOK, SuggestionResult{Completed: true, Notice: "ALL_VISITED_NEARBY"})
		return
	}

	selected, notice := h.buildPersonalizedSelections(userID, unvisited)

	if h.RedisClient != nil {
		data, _ := json.Marshal(selected)
		database.SetDailySuggestions(ctx, h.RedisClient, userIDStr, today, req.Lat, req.Lng, string(data), 24*time.Hour)
	}

	c.JSON(http.StatusOK, SuggestionResult{Places: selected, Notice: notice, ReloadCountRemaining: &reloadRemaining})
}

// resolveRadius はリクエストの radius が未指定の場合、ユーザーの設定値またはデフォルト値で補完する。
func (h *SuggestionHandler) resolveRadius(userID uint64, requestedRadius uint) uint {
	radius := requestedRadius
	if radius == 0 {
		var user models.User
		if err := h.DB.Select("search_radius").First(&user, userID).Error; err == nil && user.SearchRadius > 0 {
			radius = user.SearchRadius
		} else {
			radius = defaultSearchRadius
		}
	}
	if radius > maxSearchRadius {
		radius = maxSearchRadius
	}
	return radius
}

// getReloadCount は Redis からリロードカウントを取得する。Redis 未接続時は 0 を返す。
func (h *SuggestionHandler) getReloadCount(ctx context.Context, userIDStr, today string) int {
	if h.RedisClient == nil {
		return 0
	}
	rc, err := database.GetDailyReloadCount(ctx, h.RedisClient, userIDStr, today)
	if err != nil {
		return 0
	}
	return rc
}

// processForceReload は force_reload フラグの処理を行う。
// done=true の場合、caller は status/body でレスポンスを返して終了すべき。
// done=false の場合、reloadCount には更新後の値が入る。
func (h *SuggestionHandler) processForceReload(ctx context.Context, userIDStr, today string, req suggestionRequest, reloadCount int) (newCount int, done bool, status int, body interface{}) {
	if h.RedisClient == nil {
		return reloadCount, false, 0, nil
	}

	reached, err := database.IsDailyLimitReached(ctx, h.RedisClient, userIDStr, today)
	if err == nil && reached {
		return reloadCount, true, http.StatusOK, SuggestionResult{Completed: true}
	}

	if reloadCount >= database.MaxDailyReloads {
		remaining := 0
		return reloadCount, true, http.StatusTooManyRequests, gin.H{
			"error":                  "reload limit reached",
			"code":                   "RELOAD_LIMIT_REACHED",
			"reload_count_remaining": remaining,
		}
	}

	newCount, err = database.IncrementDailyReloadCount(ctx, h.RedisClient, userIDStr, today, 24*time.Hour)
	if err != nil {
		newCount = reloadCount
	}

	database.ClearDailySuggestionsCache(ctx, h.RedisClient, userIDStr)

	placeCacheKey := fmt.Sprintf("suggestions:%.4f:%.4f:%d", req.Lat, req.Lng, req.Radius)
	h.RedisClient.Del(ctx, placeCacheKey)

	return newCount, false, 0, nil
}

// checkDailyCacheResult は日次キャッシュを確認し、有効なキャッシュがあれば SuggestionResult を返す。
// found=true の場合、caller はその result を返して終了すべき。
func (h *SuggestionHandler) checkDailyCacheResult(ctx context.Context, userID uint64, userIDStr, today string, req suggestionRequest, reloadRemaining int) (*SuggestionResult, bool) {
	if h.RedisClient == nil {
		return nil, false
	}

	cached, err := database.GetDailySuggestions(ctx, h.RedisClient, userIDStr, today, req.Lat, req.Lng)
	if err == nil && cached != "" {
		var dailyPlaces []PlaceResult
		if err := json.Unmarshal([]byte(cached), &dailyPlaces); err == nil && len(dailyPlaces) > 0 {
			filtered := filterOutVisited(h.DB, userID, dailyPlaces)
			if len(filtered) > 0 {
				interestNames, _ := getUserInterestGenreNames(h.DB, userID)
				for i := range filtered {
					genreName := getGenreNameFromTypes(filtered[i].Types)
					if len(interestNames) > 0 {
						match := genreName != "" && interestNames[genreName]
						filtered[i].IsInterestMatch = &match
					} else {
						filtered[i].IsInterestMatch = nil
					}
					isBreakout := isBreakoutVisit(h.DB, userID, genreName)
					filtered[i].IsBreakout = &isBreakout
				}
				return &SuggestionResult{Places: filtered, ReloadCountRemaining: &reloadRemaining}, true
			}
			// 日次提案は割り当て済みで全て訪問済み → 本日の上限に達した
			database.SetDailyLimitReached(ctx, h.RedisClient, userIDStr, today, 24*time.Hour)
			return &SuggestionResult{Completed: true}, true
		}
	}

	// リストキャッシュがなくても上限到達フラグが立っている場合は完了として返す
	reached, err := database.IsDailyLimitReached(ctx, h.RedisClient, userIDStr, today)
	if err == nil && reached {
		return &SuggestionResult{Completed: true}, true
	}

	return nil, false
}

// fetchPlacesFromCacheOrAPI は Places API キャッシュを確認し、なければ API を呼び出す。
// フィルタ済みの PlaceResult スライスを返す。
func (h *SuggestionHandler) fetchPlacesFromCacheOrAPI(ctx context.Context, req suggestionRequest, cacheKey string) ([]PlaceResult, error) {
	var places []PlaceResult

	if h.RedisClient != nil {
		cached, err := h.RedisClient.Get(ctx, cacheKey).Result()
		if err == nil {
			if unmarshalErr := json.Unmarshal([]byte(cached), &places); unmarshalErr != nil {
				log.Printf("Warning: corrupted places cache for key %s, invalidating: %v", cacheKey, unmarshalErr)
				h.RedisClient.Del(ctx, cacheKey)
				places = nil
			}
		}
	}

	if len(places) == 0 {
		var err error
		places, err = h.Places.NearbySearch(ctx, req.Lat, req.Lng, req.Radius)
		if err != nil {
			return nil, err
		}

		filtered := make([]PlaceResult, 0, len(places))
		for _, p := range places {
			if isVisitablePlace(p.Types) {
				filtered = append(filtered, p)
			}
		}
		places = filtered

		if h.RedisClient != nil && len(places) > 0 {
			data, _ := json.Marshal(places)
			h.RedisClient.Set(ctx, cacheKey, string(data), 24*time.Hour)
		}
	}

	return places, nil
}

// buildPersonalizedSelections は未訪問施設から興味タグに基づいて提案施設を選出し、
// is_interest_match・is_breakout フラグを設定して返す。
func (h *SuggestionHandler) buildPersonalizedSelections(userID uint64, unvisited []PlaceResult) ([]PlaceResult, string) {
	var selected []PlaceResult
	var notice string

	interestGenreNames, err := getUserInterestGenreNames(h.DB, userID)
	if err != nil || len(interestGenreNames) == 0 {
		selected = selectRandomPlaces(unvisited, maxDailySuggestions)
	} else {
		inInterest, outOfInterest := classifyByInterest(unvisited, interestGenreNames)
		if len(inInterest) == 0 && len(outOfInterest) > 0 {
			notice = "NO_INTEREST_PLACES"
		}
		selected = selectPersonalizedPlaces(inInterest, outOfInterest)
		for i := range selected {
			genreName := getGenreNameFromTypes(selected[i].Types)
			match := genreName != "" && interestGenreNames[genreName]
			selected[i].IsInterestMatch = &match
		}
	}

	for i := range selected {
		genreName := getGenreNameFromTypes(selected[i].Types)
		isBreakout := isBreakoutVisit(h.DB, userID, genreName)
		selected[i].IsBreakout = &isBreakout
	}

	return selected, notice
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
