package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type GoogleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

type GoogleTokenVerifier interface {
	VerifyIDToken(ctx context.Context, idToken string) (*GoogleUserInfo, error)
}

type GoogleHTTPVerifier struct {
	ClientID   string
	HTTPClient *http.Client
}

func (v *GoogleHTTPVerifier) VerifyIDToken(ctx context.Context, idToken string) (*GoogleUserInfo, error) {
	url := fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", idToken)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	client := v.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to verify token: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("invalid id_token")
	}

	var tokenInfo struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
		Aud           string `json:"aud"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if tokenInfo.Aud != v.ClientID {
		return nil, errors.New("token audience mismatch")
	}

	return &GoogleUserInfo{
		Sub:           tokenInfo.Sub,
		Email:         tokenInfo.Email,
		EmailVerified: tokenInfo.EmailVerified == "true",
		Name:          tokenInfo.Name,
		Picture:       tokenInfo.Picture,
	}, nil
}

type OAuthHandler struct {
	DB             *gorm.DB
	JWTCfg         *config.JWTConfig
	RedisClient    *redis.Client
	GoogleVerifier GoogleTokenVerifier
}

type googleOAuthRequest struct {
	IDToken string `json:"id_token" binding:"required"`
}

type googleOAuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IsNewUser    bool   `json:"is_new_user"`
}

// GoogleOAuth godoc
// @Summary      Google OAuth認証
// @Description  Google IDトークンを検証し、ユーザー登録/ログインを行いJWTトークンペアを返す
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body  googleOAuthRequest  true  "Google IDトークン"
// @Success      200  {object}  googleOAuthResponse
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/auth/oauth/google [post]
func (h *OAuthHandler) GoogleOAuth(c *gin.Context) {
	var req googleOAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id_token is required"})
		return
	}

	ctx := c.Request.Context()

	userInfo, err := h.GoogleVerifier.VerifyIDToken(ctx, req.IDToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid id_token"})
		return
	}

	if !userInfo.EmailVerified {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "email not verified"})
		return
	}

	var user models.User
	isNewUser := false

	err = h.DB.Where("email = ?", userInfo.Email).First(&user).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query user"})
			return
		}

		displayName := userInfo.Name
		if displayName == "" {
			displayName = strings.Split(userInfo.Email, "@")[0]
		}

		var avatarURL *string
		if userInfo.Picture != "" {
			avatarURL = &userInfo.Picture
		}

		user = models.User{
			Email:       userInfo.Email,
			DisplayName: displayName,
			AvatarURL:   avatarURL,
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

	c.JSON(http.StatusOK, googleOAuthResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		IsNewUser:    isNewUser,
	})
}
