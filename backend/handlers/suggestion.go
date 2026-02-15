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
	PlaceID        string   `json:"place_id"`
	Name           string   `json:"name"`
	Vicinity       string   `json:"vicinity"`
	Lat            float64  `json:"lat"`
	Lng            float64  `json:"lng"`
	Rating         float32  `json:"rating"`
	Types          []string `json:"types"`
	PhotoReference string   `json:"photo_reference,omitempty"`
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

type suggestionRequest struct {
	Lat    float64 `json:"lat" binding:"required"`
	Lng    float64 `json:"lng" binding:"required"`
	Radius uint    `json:"radius"`
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
// @Tags         Suggestion
// @Accept       json
// @Produce      json
// @Param        body  body  suggestionRequest  true  "位置情報と半径"
// @Success      200  {array}   PlaceResult
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

	if req.Radius == 0 {
		req.Radius = defaultSearchRadius
	}
	if req.Radius > maxSearchRadius {
		req.Radius = maxSearchRadius
	}

	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	ctx := c.Request.Context()
	today := time.Now().Format("2006-01-02")
	userIDStr := strconv.FormatUint(userID, 10)

	// 1. 日次キャッシュを確認
	if h.RedisClient != nil {
		cached, err := database.GetDailySuggestions(ctx, h.RedisClient, userIDStr, today, req.Lat, req.Lng)
		if err == nil && cached != "" {
			var dailyPlaces []PlaceResult
			if err := json.Unmarshal([]byte(cached), &dailyPlaces); err == nil && len(dailyPlaces) > 0 {
				// キャッシュヒットしても訪問済み施設を除外
				filtered := filterOutVisited(h.DB, userID, dailyPlaces)
				if len(filtered) > 0 {
					c.JSON(http.StatusOK, filtered)
					return
				}
				// 全て訪問済みならキャッシュを無効化して再取得へ
			}
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search nearby places"})
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
		c.JSON(http.StatusNotFound, gin.H{"error": "no nearby places found"})
		return
	}

	// 4. 訪問済みを除外
	unvisited := filterOutVisited(h.DB, userID, places)

	if len(unvisited) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "all nearby places have been visited"})
		return
	}

	// 5. ランダムに最大3件選出
	selected := selectRandomPlaces(unvisited, maxDailySuggestions)

	// 6. 日次キャッシュに保存
	if h.RedisClient != nil {
		data, _ := json.Marshal(selected)
		database.SetDailySuggestions(ctx, h.RedisClient, userIDStr, today, req.Lat, req.Lng, string(data), 24*time.Hour)
	}

	c.JSON(http.StatusOK, selected)
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
