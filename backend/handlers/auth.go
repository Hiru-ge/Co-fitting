package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB     *gorm.DB
	JWTCfg *config.JWTConfig
}

type signUpRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
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
