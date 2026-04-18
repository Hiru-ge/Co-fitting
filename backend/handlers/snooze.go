package handlers

import (
	"net/http"
	"strconv"

	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/middleware"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type SnoozeHandler struct {
	RedisClient *redis.Client
}

// SnoozePlace godoc
// @Summary      お店のスヌーズ設定
// @Description  指定したお店を一定期間提案から除外する。期間は days クエリパラメータで指定する（1〜365の整数、必須）。
// @Tags         Places
// @Produce      json
// @Security     BearerAuth
// @Param        place_id  path   string  true  "Place ID"
// @Param        days      query  int     true  "スヌーズ期間（日数、1〜365）"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/places/{place_id}/snooze [post]
func (h *SnoozeHandler) SnoozePlace(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	placeID := c.Param("place_id")
	if placeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Place ID is required"})
		return
	}

	daysStr := c.Query("days")
	if daysStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "days is required", "code": "INVALID_REQUEST"})
		return
	}
	days, err := strconv.Atoi(daysStr)
	if err != nil || days <= 0 || days > 365 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "days must be an integer between 1 and 365", "code": "INVALID_REQUEST"})
		return
	}

	if h.RedisClient == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Redis client not initialized"})
		return
	}

	userIDStr := strconv.FormatUint(userID, 10)
	if err := database.SetPlaceSnooze(c.Request.Context(), h.RedisClient, userIDStr, placeID, days); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set snooze: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Place snoozed for " + strconv.Itoa(days) + " days"})
}
