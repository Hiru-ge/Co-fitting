package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB          *gorm.DB
	JWTCfg      *config.JWTConfig
	RedisClient *redis.Client
}

type signUpRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8,max=72"`
	DisplayName string `json:"display_name" binding:"required"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// SignUp godoc
// @Summary      ユーザー登録
// @Description  新しいユーザーを登録し、トークンペアを返す
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body  signUpRequest  true  "登録情報"
// @Success      201  {object}  utils.TokenPair
// @Failure      400  {object}  map[string]string
// @Failure      409  {object}  map[string]string
// @Router       /api/auth/signup [post]
func (h *AuthHandler) SignUp(c *gin.Context) {
	var req signUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// メール重複チェック
	var existing models.User
	isEmailExists := h.DB.Where("email = ?", req.Email).First(&existing).Error == nil
	if isEmailExists {
		c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
		return
	}

	// bcrypt パスワードハッシュ化
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	user := models.User{
		Email:        req.Email,
		PasswordHash: string(hash),
		DisplayName:  strings.TrimSpace(req.DisplayName),
	}

	if err := h.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	// トークンペア生成
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

	c.JSON(http.StatusCreated, tokenPair)
}

// Login godoc
// @Summary      ログイン
// @Description  メールとパスワードで認証し、トークンペアを返す
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body  loginRequest  true  "ログイン情報"
// @Success      200  {object}  utils.TokenPair
// @Failure      401  {object}  map[string]string
// @Router       /api/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// メールでユーザー検索
	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// bcrypt パスワード比較
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	// トークンペア生成
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

	c.JSON(http.StatusOK, tokenPair)
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
// @Description  トークンをブラックリストに登録して無効化する
// @Tags         Auth
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	// Authorization ヘッダーからトークンを取得
	authHeader := c.GetHeader("Authorization")
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header"})
		return
	}
	token := parts[1]

	// トークンの Claims を取得してTTLを算出
	claims, err := utils.ValidateToken(token, h.JWTCfg.Secret)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	// Redis にブラックリスト登録（TTL: トークンの残り有効期限）
	ttl := time.Until(claims.ExpiresAt.Time)
	if ttl > 0 {
		ctx := context.Background()
		key := fmt.Sprintf("blacklist:%s", token)
		if err := h.RedisClient.Set(ctx, key, "1", ttl).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke token"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8,max=72"`
}

// ChangePassword godoc
// @Summary      パスワード変更
// @Description  現在のパスワードを確認し、新しいパスワードに変更する
// @Tags         Auth
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  changePasswordRequest  true  "パスワード変更情報"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /api/auth/change-password [post]
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	// 現在のパスワードを確認
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
		return
	}

	// 新しいパスワードをハッシュ化
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	user.PasswordHash = string(hash)
	if err := h.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password changed successfully"})
}
