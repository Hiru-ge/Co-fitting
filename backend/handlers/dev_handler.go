package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type DevHandler struct {
	RedisClient *redis.Client
	DB          *gorm.DB
	JWTCfg      *config.JWTConfig
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

// TestLogin は開発環境専用のテストログインエンドポイント。
// セキュリティ: routes.go の `environment == "development"` チェックにより本番環境では
// このルート自体が登録されないため、エンドポイントは存在しない（一次防衛）。
// Docker ネットワーク経由では RemoteAddr がゲートウェイ IP になるため、
// localhost IP フィルタは機能しない。環境変数による環境ガードを唯一の防衛とする。
// ユーザーが存在しない場合は作成し、JWT トークンペアを返す。
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
			Email:       req.Email,
			DisplayName: req.DisplayName,
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
