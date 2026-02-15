package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type DevHandler struct {
	RedisClient *redis.Client
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

	// suggestions:* パターンと suggestion:daily:* パターンの両方を削除
	patterns := []string{"suggestions:*", "suggestion:daily:*"}
	for _, pattern := range patterns {
		var cursor uint64
		for {
			keys, nextCursor, err := h.RedisClient.Scan(ctx, cursor, pattern, 100).Result()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to scan cache keys"})
				return
			}

			if len(keys) > 0 {
				deleted, err := h.RedisClient.Del(ctx, keys...).Result()
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete cache keys"})
					return
				}
				deletedCount += deleted
			}

			cursor = nextCursor
			if cursor == 0 {
				break
			}
		}
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
		var cursor uint64
		for {
			keys, nextCursor, err := h.RedisClient.Scan(ctx, cursor, pattern, 100).Result()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to scan cache keys"})
				return
			}
			allKeys = append(allKeys, keys...)
			cursor = nextCursor
			if cursor == 0 {
				break
			}
		}
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
