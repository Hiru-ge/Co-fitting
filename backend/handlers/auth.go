package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB          *gorm.DB
	JWTCfg      *config.JWTConfig
	RedisClient *redis.Client
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"` // オプション（下位互換性のため）
}

// RefreshToken godoc
// @Summary      トークンリフレッシュ
// @Description  リフレッシュトークンを使用して新しいアクセストークンを取得する
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body  refreshRequest  true  "リフレッシュトークン"
// @Success      200  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Router       /api/auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh_token is required"})
		return
	}

	ctx := context.Background()

	// リフレッシュトークンがブラックリスト化されているかチェック
	isBlacklisted, err := utils.IsTokenBlacklisted(ctx, h.RedisClient, req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check token blacklist"})
		return
	}
	if isBlacklisted {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token has been revoked"})
		return
	}

	// リフレッシュトークンを検証
	claims, err := utils.ValidateToken(req.RefreshToken, h.JWTCfg.Secret)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}

	// トークンタイプが "refresh" であることを確認
	if claims.TokenType != "refresh" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token type"})
		return
	}

	// 新しいアクセストークンを生成
	accessToken, err := utils.GenerateAccessToken(
		claims.UserID,
		h.JWTCfg.Secret,
		h.JWTCfg.AccessExpiry,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate access token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"access_token": accessToken})
}

// Logout godoc
// @Summary      ログアウト
// @Description  アクセストークンとリフレッシュトークンをブラックリストに登録して無効化する
// @Tags         Auth
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  logoutRequest  false  "リフレッシュトークン（オプション）"
// @Success      200  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	// Authorization ヘッダーからアクセストークンを取得
	authHeader := c.GetHeader("Authorization")
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header"})
		return
	}
	accessToken := parts[1]

	// アクセストークンの Claims を取得してTTLを算出
	accessClaims, err := utils.ValidateToken(accessToken, h.JWTCfg.Secret)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	ctx := context.Background()

	// アクセストークンをブラックリスト登録（TTL: トークンの残り有効期限）
	accessTTL := time.Until(accessClaims.ExpiresAt.Time)
	if err := utils.AddTokenToBlacklist(ctx, h.RedisClient, accessToken, accessTTL); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke access token"})
		return
	}

	// リクエストボディからリフレッシュトークンを取得（オプション）
	var logoutReq logoutRequest
	if err := c.ShouldBindJSON(&logoutReq); err == nil && logoutReq.RefreshToken != "" {
		// リフレッシュトークンが提供された場合はブラックリスト化
		refreshClaims, err := utils.ValidateToken(logoutReq.RefreshToken, h.JWTCfg.Secret)
		if err == nil {
			refreshTTL := time.Until(refreshClaims.ExpiresAt.Time)
			if err := utils.AddTokenToBlacklist(ctx, h.RedisClient, logoutReq.RefreshToken, refreshTTL); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke refresh token"})
				return
			}
		}
		// リフレッシュトークンの検証失敗は無視（既に期限切れの可能性があるため）
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}
