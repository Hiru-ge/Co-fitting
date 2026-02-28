package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// HealthHandler は DB と Redis の接続状態を含むヘルスチェックを担う。
type HealthHandler struct {
	DB          *gorm.DB
	RedisClient *redis.Client
}

// HealthCheck godoc
// @Summary      ヘルスチェック
// @Description  サーバー・DB・Redisのヘルスチェック用エンドポイント
// @Tags         Health
// @Produce      json
// @Success      200  {object}  map[string]string
// @Failure      503  {object}  map[string]string
// @Router       /health [get]
func (h *HealthHandler) HealthCheck(c *gin.Context) {
	dbStatus := h.checkDB()
	redisStatus := h.checkRedis()

	overallStatus := "ok"
	httpStatus := http.StatusOK
	if dbStatus == "error" || redisStatus == "error" {
		overallStatus = "degraded"
		httpStatus = http.StatusServiceUnavailable
	}

	c.JSON(httpStatus, gin.H{
		"status": overallStatus,
		"db":     dbStatus,
		"redis":  redisStatus,
	})
}

func (h *HealthHandler) checkDB() string {
	if h.DB == nil {
		return "unknown"
	}
	sqlDB, err := h.DB.DB()
	if err != nil {
		return "error"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		return "error"
	}
	return "ok"
}

func (h *HealthHandler) checkRedis() string {
	if h.RedisClient == nil {
		return "unknown"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := h.RedisClient.Ping(ctx).Err(); err != nil {
		return "error"
	}
	return "ok"
}
