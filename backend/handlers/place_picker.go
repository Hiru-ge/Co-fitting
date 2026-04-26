package handlers

import (
	"net/http"
	"strconv"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/services"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const placePickerRadius uint = 1000

type PlacePickerHandler struct {
	DB          *gorm.DB
	Places      PlacesSearcher
	RedisClient *redis.Client
}

// GetNearbyVisitablePlaces godoc
// @Summary      行き先候補施設の取得
// @Description  指定した位置情報の周囲1km内から、訪問可能かつ30日以内未訪問の施設を返す。マップ行き先指定機能で利用する。
// @Tags         Places
// @Produce      json
// @Security     BearerAuth
// @Param        lat  query  number  true  "緯度"
// @Param        lng  query  number  true  "経度"
// @Success      200  {object}  map[string][]services.PlaceResult
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/places/nearby [get]
func (h *PlacePickerHandler) GetNearbyVisitablePlaces(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	if latStr == "" || lngStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "lat and lng are required", "code": "INVALID_REQUEST"})
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lat", "code": "INVALID_REQUEST"})
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lng", "code": "INVALID_REQUEST"})
		return
	}

	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	ctx := c.Request.Context()
	places, err := h.Places.NearbySearch(ctx, lat, lng, placePickerRadius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search nearby places", "code": "INTERNAL_ERROR"})
		return
	}

	filtered := make([]services.PlaceResult, 0, len(places))
	for _, p := range places {
		if services.IsVisitablePlace(p.PrimaryType) {
			filtered = append(filtered, p)
		}
	}

	filtered = services.FilterOutVisited(h.DB, userID, filtered)

	userIDStr := strconv.FormatUint(userID, 10)
	filtered = services.FilterOutSnoozed(ctx, h.RedisClient, userIDStr, filtered)

	interestGenres, _ := services.GetUserInterestGenreNames(h.DB, userID)
	for i := range filtered {
		genreName := services.GetGenreNameFromPrimaryType(filtered[i].PrimaryType)
		match := interestGenres[genreName]
		filtered[i].IsInterestMatch = &match
		isBreakout := services.IsBreakoutVisit(h.DB, userID, genreName)
		filtered[i].IsBreakout = &isBreakout
	}

	c.JSON(http.StatusOK, gin.H{"places": filtered})
}
