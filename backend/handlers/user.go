package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UserHandler struct {
	DB *gorm.DB
}

// GetMe godoc
// @Summary      ユーザー情報取得
// @Description  JWT認証済みユーザーの情報を返す
// @Tags         Users
// @Produce      json
// @Success      200  {object}  models.User
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /api/users/me [get]
func (h *UserHandler) GetMe(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, user)
}

type userStatsResponse struct {
	Level             int        `json:"level"`
	TotalXP           int        `json:"total_xp"`
	StreakCount       int        `json:"streak_count"`
	StreakLast        *time.Time `json:"streak_last"`
	TotalVisits       int64      `json:"total_visits"`
	ComfortZoneVisits int64      `json:"comfort_zone_visits"`
	ChallengeVisits   int64      `json:"challenge_visits"`
}

// GetStats godoc
// @Summary      ユーザー統計情報取得
// @Description  JWT認証済みユーザーのレベル・XP・ストリーク・訪問統計を返す
// @Tags         Users
// @Produce      json
// @Success      200  {object}  userStatsResponse
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /api/users/me/stats [get]
func (h *UserHandler) GetStats(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var totalVisits int64
	h.DB.Model(&models.Visit{}).Where("user_id = ?", userID).Count(&totalVisits)

	var comfortZoneVisits int64
	h.DB.Model(&models.Visit{}).Where("user_id = ? AND is_comfort_zone = ?", userID, true).Count(&comfortZoneVisits)

	c.JSON(http.StatusOK, userStatsResponse{
		Level:             user.Level,
		TotalXP:           user.TotalXP,
		StreakCount:       user.StreakCount,
		StreakLast:        user.StreakLast,
		TotalVisits:       totalVisits,
		ComfortZoneVisits: comfortZoneVisits,
		ChallengeVisits:   totalVisits - comfortZoneVisits,
	})
}

type updateMeRequest struct {
	DisplayName string `json:"display_name" binding:"required"`
}

// UpdateMe godoc
// @Summary      ユーザー情報更新
// @Description  JWT認証済みユーザーの表示名を更新する
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        body  body  updateMeRequest  true  "更新情報"
// @Success      200  {object}  models.User
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /api/users/me [patch]
func (h *UserHandler) UpdateMe(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "display_name is required"})
		return
	}

	trimmed := strings.TrimSpace(req.DisplayName)
	if trimmed == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "display_name is required"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	user.DisplayName = trimmed
	if err := h.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	c.JSON(http.StatusOK, user)
}
