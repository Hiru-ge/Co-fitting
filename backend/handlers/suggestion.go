package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type PlacesSearcher interface {
	NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]services.PlaceResult, error)
}

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

func (g *GooglePlacesClient) NearbySearch(ctx context.Context, lat, lng float64, radius uint) ([]services.PlaceResult, error) {
	includedTypes := make([]string, 0, len(services.VisitableTypes))
	for t := range services.VisitableTypes {
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
	defer resp.Body.Close() //nolint:errcheck

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

	results := make([]services.PlaceResult, 0, len(apiResp.Places))
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
		results = append(results, services.PlaceResult{
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

type SuggestionHandler struct {
	DB          *gorm.DB
	RedisClient *redis.Client
	Places      PlacesSearcher
}

type SuggestionResult struct {
	Places               []services.PlaceResult `json:"places"`
	Notice               string                 `json:"notice,omitempty"`
	Completed            bool                   `json:"completed,omitempty"`
	ReloadCountRemaining *int                   `json:"reload_count_remaining,omitempty"`
}

type suggestionRequest struct {
	Lat           float64 `json:"lat" binding:"required"`
	Lng           float64 `json:"lng" binding:"required"`
	Radius        uint    `json:"radius"`
	Reload        bool    `json:"force_reload"`
	FilterOpenNow bool    `json:"filter_open_now"`
}

const defaultSearchRadius uint = 3000

const maxSearchRadius uint = 50000

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

func (h *SuggestionHandler) getReloadCount(ctx context.Context, userIDStr, today string) (int, error) {
	if h.RedisClient == nil {
		return 0, nil
	}
	rc, err := database.GetDailyReloadCount(ctx, h.RedisClient, userIDStr, today)
	if err != nil {
		return 0, nil
	}
	return rc, nil
}

func (h *SuggestionHandler) reload(ctx context.Context, userIDStr, today string, req suggestionRequest, reloadCount int) (newCount int, done bool, status int, body interface{}) {
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

	if _, err := database.ClearDailySuggestionsCache(ctx, h.RedisClient, userIDStr); err != nil {
		log.Printf("suggestion: failed to clear daily suggestions cache: %v", err)
	}

	placeCacheKey := fmt.Sprintf("suggestions:%.4f:%.4f:%d", req.Lat, req.Lng, req.Radius)
	h.RedisClient.Del(ctx, placeCacheKey)

	return newCount, false, 0, nil
}

func (h *SuggestionHandler) findDailySuggestionCache(ctx context.Context, userID uint64, userIDStr, today string, req suggestionRequest, reloadRemaining int) (*SuggestionResult, bool) {
	if h.RedisClient == nil {
		return nil, false
	}

	cached, err := database.GetDailySuggestions(ctx, h.RedisClient, userIDStr, today)
	if err == nil && cached != "" {
		var dailyPlaces []services.PlaceResult
		if err := json.Unmarshal([]byte(cached), &dailyPlaces); err == nil && len(dailyPlaces) > 0 {
			filtered := services.FilterOutVisited(h.DB, userID, dailyPlaces)
			if len(filtered) > 0 {
				interestNames, _ := services.GetUserInterestGenreNames(h.DB, userID)
				for i := range filtered {
					genreName := services.GetGenreNameFromTypes(filtered[i].Types)
					if len(interestNames) > 0 {
						match := genreName != "" && interestNames[genreName]
						filtered[i].IsInterestMatch = &match
					} else {
						filtered[i].IsInterestMatch = nil
					}
					isBreakout := services.IsBreakoutVisit(h.DB, userID, genreName)
					filtered[i].IsBreakout = &isBreakout
				}
				return &SuggestionResult{Places: filtered, ReloadCountRemaining: &reloadRemaining}, true
			}
			// 日次提案は割り当て済みで全て訪問済み → 本日の上限に達した
			if err := database.SetDailyLimitReached(ctx, h.RedisClient, userIDStr, today, 24*time.Hour); err != nil {
				log.Printf("suggestion: failed to set daily limit reached: %v", err)
			}
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

func (h *SuggestionHandler) fetchPlacesFromCacheOrAPI(ctx context.Context, req suggestionRequest, cacheKey string) ([]services.PlaceResult, error) {
	var places []services.PlaceResult

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

		filtered := make([]services.PlaceResult, 0, len(places))
		for _, p := range places {
			if services.IsVisitablePlace(p.Types) {
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
// @Failure      500  {object}  map[string]string
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
	today := time.Now().In(utils.JST).Format("2006-01-02")
	userIDStr := strconv.FormatUint(userID, 10)

	reloadCount, _ := h.getReloadCount(ctx, userIDStr, today)

	if req.Reload {
		newCount, done, status, body := h.reload(ctx, userIDStr, today, req, reloadCount)
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

	if result, found := h.findDailySuggestionCache(ctx, userID, userIDStr, today, req, reloadRemaining); found {
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
		places = services.FilterOpenNowPlaces(places)
		if len(places) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "no open places found", "code": "NO_OPEN_PLACES"})
			return
		}
	}

	unvisited := services.FilterOutVisited(h.DB, userID, places)
	if len(unvisited) == 0 {
		c.JSON(http.StatusOK, SuggestionResult{Completed: true, Notice: "ALL_VISITED_NEARBY"})
		return
	}

	selected, notice := services.BuildPersonalizedSelections(h.DB, userID, unvisited)

	if h.RedisClient != nil {
		data, _ := json.Marshal(selected)
		if err := database.SetDailySuggestions(ctx, h.RedisClient, userIDStr, today, string(data), 24*time.Hour); err != nil {
			log.Printf("suggestion: failed to set daily suggestions cache: %v", err)
		}
	}

	c.JSON(http.StatusOK, SuggestionResult{Places: selected, Notice: notice, ReloadCountRemaining: &reloadRemaining})
}
