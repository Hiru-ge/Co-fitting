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

type badgeResponse struct {
	ID          uint64    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IconURL     string    `json:"icon_url"`
	EarnedAt    time.Time `json:"earned_at"`
}

// GetBadges godoc
// @Summary      獲得バッジ一覧取得
// @Description  JWT認証済みユーザーの獲得バッジ一覧を返す（獲得日時の降順）
// @Tags         Users
// @Produce      json
// @Success      200  {array}   badgeResponse
// @Failure      401  {object}  map[string]string
// @Router       /api/users/me/badges [get]
func (h *UserHandler) GetBadges(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var badges []badgeResponse
	result := h.DB.Table("user_badges").
		Select("badges.id, badges.name, badges.description, badges.icon_url, user_badges.earned_at").
		Joins("JOIN badges ON user_badges.badge_id = badges.id").
		Where("user_badges.user_id = ?", userID).
		Order("user_badges.earned_at DESC").
		Scan(&badges)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if badges == nil {
		badges = []badgeResponse{}
	}

	c.JSON(http.StatusOK, badges)
}

type proficiencyResponse struct {
	GenreTagID uint64 `json:"genre_tag_id"`
	GenreName  string `json:"genre_name"`
	Category   string `json:"category"`
	Icon       string `json:"icon"`
	XP         int    `json:"xp"`
	Level      int    `json:"level"`
}

// GetProficiency godoc
// @Summary      ジャンル別熟練度取得
// @Description  JWT認証済みユーザーのジャンル別熟練度一覧を返す（XP降順）
// @Tags         Users
// @Produce      json
// @Success      200  {array}   proficiencyResponse
// @Failure      401  {object}  map[string]string
// @Router       /api/users/me/proficiency [get]
func (h *UserHandler) GetProficiency(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var proficiencies []proficiencyResponse
	result := h.DB.Table("genre_proficiency").
		Select("genre_proficiency.genre_tag_id, genre_tags.name AS genre_name, genre_tags.category, genre_tags.icon, genre_proficiency.xp, genre_proficiency.level").
		Joins("JOIN genre_tags ON genre_proficiency.genre_tag_id = genre_tags.id").
		Where("genre_proficiency.user_id = ?", userID).
		Order("genre_proficiency.xp DESC").
		Scan(&proficiencies)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if proficiencies == nil {
		proficiencies = []proficiencyResponse{}
	}

	c.JSON(http.StatusOK, proficiencies)
}

type interestResponse struct {
	GenreTagID uint64 `json:"genre_tag_id"`
	Name       string `json:"name"`
	Category   string `json:"category"`
	Icon       string `json:"icon"`
}

// GetInterests godoc
// @Summary      ユーザー興味タグ取得
// @Description  JWT認証済みユーザーの興味タグ一覧を返す（ジャンル名昇順）
// @Tags         Users
// @Produce      json
// @Success      200  {array}   interestResponse
// @Failure      401  {object}  map[string]string
// @Router       /api/users/me/interests [get]
func (h *UserHandler) GetInterests(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var interests []interestResponse
	result := h.DB.Table("user_interests").
		Select("user_interests.genre_tag_id, genre_tags.name, genre_tags.category, genre_tags.icon").
		Joins("JOIN genre_tags ON user_interests.genre_tag_id = genre_tags.id").
		Where("user_interests.user_id = ?", userID).
		Order("genre_tags.name ASC").
		Scan(&interests)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if interests == nil {
		interests = []interestResponse{}
	}

	c.JSON(http.StatusOK, interests)
}

type updateInterestsRequest struct {
	GenreTagIDs []uint64 `json:"genre_tag_ids" binding:"required"`
}

// UpdateInterests godoc
// @Summary      ユーザー興味タグ更新
// @Description  JWT認証済みユーザーの興味タグを一括更新する（3つ以上必須）
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        body  body  updateInterestsRequest  true  "興味タグIDリスト"
// @Success      200  {array}   interestResponse
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Router       /api/users/me/interests [put]
func (h *UserHandler) UpdateInterests(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req updateInterestsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "genre_tag_ids is required"})
		return
	}

	if len(req.GenreTagIDs) < 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least 3 genre tags are required"})
		return
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&models.UserInterest{}).Error; err != nil {
			return err
		}

		newInterests := make([]models.UserInterest, 0, len(req.GenreTagIDs))
		for _, tagID := range req.GenreTagIDs {
			newInterests = append(newInterests, models.UserInterest{
				UserID:     userID,
				GenreTagID: tagID,
			})
		}

		return tx.Create(&newInterests).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update interests"})
		return
	}

	var interests []interestResponse
	result := h.DB.Table("user_interests").
		Select("user_interests.genre_tag_id, genre_tags.name, genre_tags.category, genre_tags.icon").
		Joins("JOIN genre_tags ON user_interests.genre_tag_id = genre_tags.id").
		Where("user_interests.user_id = ?", userID).
		Order("genre_tags.name ASC").
		Scan(&interests)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if interests == nil {
		interests = []interestResponse{}
	}

	c.JSON(http.StatusOK, interests)
}

// DeleteMe godoc
// @Summary      アカウント削除
// @Description  JWT認証済みユーザーのアカウントと関連データを物理削除する
// @Tags         Users
// @Security     BearerAuth
// @Produce      json
// @Success      204
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/users/me [delete]
func (h *UserHandler) DeleteMe(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	result := h.DB.Delete(&models.User{}, userID)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete account"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.Status(http.StatusNoContent)
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
