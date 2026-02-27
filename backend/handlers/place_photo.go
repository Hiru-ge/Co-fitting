package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// PlacePhotoHandler は施設写真URLの解決とキャッシュを担う。
//
// セキュリティ注意: APIキー（APIKey フィールド）はサーバーサイドでのみ使用し、
// フロントエンドには露出しない。
// 運用対策として Google Cloud Console で以下の制限を推奨:
//   - 「APIの制限」でこのキーが使用できるAPIをPlaces APIのみに制限する
//   - 「アプリケーションの制限」でIPアドレス制限（サーバーIPのみ許可）を設定する
type PlacePhotoHandler struct {
	RedisClient *redis.Client
	APIKey      string
	HTTPClient  *http.Client
	BaseURL     string
}

func (h *PlacePhotoHandler) getBaseURL() string {
	if h.BaseURL != "" {
		return h.BaseURL
	}
	return "https://maps.googleapis.com"
}

func (h *PlacePhotoHandler) getHTTPClient() *http.Client {
	if h.HTTPClient != nil {
		return h.HTTPClient
	}
	return &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
		Timeout: 10 * time.Second,
	}
}

func (h *PlacePhotoHandler) resolvePhotoURL(photoRef string, maxWidth int) (string, error) {
	url := fmt.Sprintf(
		"%s/maps/api/place/photo?maxwidth=%d&photo_reference=%s&key=%s",
		h.getBaseURL(), maxWidth, photoRef, h.APIKey,
	)

	client := h.getHTTPClient()
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to request photo URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusFound || resp.StatusCode == http.StatusMovedPermanently {
		location := resp.Header.Get("Location")
		if location != "" {
			return location, nil
		}
	}

	return "", fmt.Errorf("unexpected response status: %d", resp.StatusCode)
}

func (h *PlacePhotoHandler) GetPhoto(c *gin.Context) {
	placeID := c.Param("placeId")
	photoRef := c.Query("photo_reference")

	maxWidth := 2000
	if mw := c.Query("maxWidth"); mw != "" {
		parsed := 0
		if n, err := fmt.Sscanf(mw, "%d", &parsed); n > 0 && err == nil && parsed > 0 {
			maxWidth = parsed
		}
	}

	ctx := c.Request.Context()
	cacheKey := fmt.Sprintf("photo:%s", placeID)
	if h.RedisClient != nil {
		cached, err := h.RedisClient.Get(ctx, cacheKey).Result()
		if err == nil && cached != "" {
			c.JSON(http.StatusOK, gin.H{"photo_url": cached})
			return
		}
	}

	if photoRef == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no cached photo found"})
		return
	}

	photoURL, err := h.resolvePhotoURL(photoRef, maxWidth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve photo URL"})
		return
	}

	if h.RedisClient != nil {
		h.RedisClient.Set(ctx, cacheKey, photoURL, 24*time.Hour)
	}

	c.JSON(http.StatusOK, gin.H{"photo_url": photoURL})
}
