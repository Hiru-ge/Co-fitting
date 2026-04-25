package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type DevHandler struct {
	RedisClient *redis.Client
	DB          *gorm.DB
	JWTCfg      *config.JWTConfig
	Scheduler   *services.NotificationScheduler
}

type cacheStatsResponse struct {
	KeyCount int             `json:"key_count"`
	Keys     []cacheKeyStats `json:"keys"`
}

type cacheKeyStats struct {
	Key         string `json:"key"`
	TTLSeconds  int    `json:"ttl_seconds"`
	MemoryBytes int64  `json:"memory_bytes"`
}

// ResetSuggestionCache godoc
// @Summary      提案キャッシュ削除（開発用）
// @Description  提案関連のRedisキャッシュを削除する（development環境のみ有効）
// @Tags         Dev
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]string
// @Router       /api/dev/suggestions/cache [delete]
func (h *DevHandler) ResetSuggestionCache(c *gin.Context) {
	ctx := c.Request.Context()

	var deletedCount int64

	patterns := []string{"suggestions:*", "suggestion:daily:*"}
	for _, pattern := range patterns {
		deleted, err := database.DeleteKeysByPattern(ctx, h.RedisClient, pattern)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete cache keys"})
			return
		}
		deletedCount += deleted
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "suggestion cache cleared",
		"deleted_count": deletedCount,
	})
}

// GetSuggestionStats godoc
// @Summary      提案キャッシュ統計取得（開発用）
// @Description  提案関連キャッシュのキー数・TTL・メモリ使用量を返す（development環境のみ有効）
// @Tags         Dev
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  cacheStatsResponse
// @Failure      500  {object}  map[string]string
// @Router       /api/dev/suggestions/stats [get]
func (h *DevHandler) GetSuggestionStats(c *gin.Context) {
	ctx := c.Request.Context()

	var allKeys []string
	patterns := []string{"suggestions:*", "suggestion:daily:*"}
	for _, pattern := range patterns {
		keys, err := database.ScanKeysByPattern(ctx, h.RedisClient, pattern)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to scan cache keys"})
			return
		}
		allKeys = append(allKeys, keys...)
	}

	keyStats := make([]cacheKeyStats, 0, len(allKeys))
	for _, key := range allKeys {
		ttl, err := h.RedisClient.TTL(ctx, key).Result()
		if err != nil {
			ttl = -1 * time.Second
		}

		memUsage, err := h.RedisClient.MemoryUsage(ctx, key).Result()
		if err != nil {
			memUsage = 0
		}

		keyStats = append(keyStats, cacheKeyStats{
			Key:         key,
			TTLSeconds:  int(ttl.Seconds()),
			MemoryBytes: memUsage,
		})
	}

	c.JSON(http.StatusOK, cacheStatsResponse{
		KeyCount: len(allKeys),
		Keys:     keyStats,
	})
}

type testLoginRequest struct {
	Email       string `json:"email" binding:"required"`
	DisplayName string `json:"display_name" binding:"required"`
}

// TestLogin は development 環境限定のテストログインエンドポイント。
// 指定ユーザーが存在しない場合は作成し、JWTトークンペアを返す。
// @Summary      テストログイン（開発用）
// @Description  指定emailのユーザーでテストログインし、JWTアクセストークン/リフレッシュトークンを返す（development環境のみ有効）
// @Tags         Dev
// @Accept       json
// @Produce      json
// @Param        body  body  testLoginRequest  true  "テストログイン情報"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/dev/auth/test-login [post]
func (h *DevHandler) TestLogin(c *gin.Context) {
	var req testLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and display_name are required"})
		return
	}

	var user models.User
	isNewUser := false

	err := h.DB.Where("email = ?", req.Email).First(&user).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query user"})
			return
		}

		user = models.User{
			Email:             req.Email,
			DisplayName:       req.DisplayName,
			EnableAdultVenues: true,
		}
		if err := h.DB.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}
		isNewUser = true
	}

	tokenPair, err := utils.GenerateTokenPair(
		user.ID,
		h.JWTCfg.Secret,
		h.JWTCfg.AccessExpiry,
		h.JWTCfg.RefreshExpiry,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"is_new_user":   isNewUser,
	})
}

type triggerNotificationRequest struct {
	Type string `json:"type" binding:"required"`
}

// TriggerNotification は開発環境専用の通知即時発火エンドポイント。
// type に "is_daily_suggestion_enabled" / "is_streak_reminder_enabled" / "is_weekly_summary_enabled" / "is_monthly_summary_enabled" を指定する。
// @Summary      通知即時発火（開発用）
// @Description  指定した通知タイプを即時実行する（development環境のみ有効）
// @Tags         Dev
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  triggerNotificationRequest  true  "通知タイプ"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]interface{}
// @Failure      503  {object}  map[string]string
// @Router       /api/dev/notifications/trigger [post]
func (h *DevHandler) TriggerNotification(c *gin.Context) {
	if h.Scheduler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "scheduler not initialized"})
		return
	}

	var req triggerNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type is required"})
		return
	}

	switch req.Type {
	case "is_daily_suggestion_enabled":
		h.Scheduler.SendDailySuggestionNotifications()
	case "is_streak_reminder_enabled":
		h.Scheduler.SendStreakReminderNotifications()
	case "is_weekly_summary_enabled":
		h.Scheduler.SendWeeklySummaryNotifications()
	case "is_monthly_summary_enabled":
		h.Scheduler.SendMonthlySummaryNotifications()
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid type",
			"valid_types": []string{
				"is_daily_suggestion_enabled",
				"is_streak_reminder_enabled",
				"is_weekly_summary_enabled",
				"is_monthly_summary_enabled",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "notification triggered", "type": req.Type})
}
