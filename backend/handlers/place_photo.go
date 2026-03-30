package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type PlacePhotoHandler struct {
	RedisClient *redis.Client
	APIKey      string
}

const placesAPIBaseURL = "https://places.googleapis.com"

func (h *PlacePhotoHandler) resolvePhotoURL(photoRef string, maxWidth int) (string, error) {
	url := fmt.Sprintf(
		"%s/v1/%s/media?maxWidthPx=%d&key=%s",
		placesAPIBaseURL, photoRef, maxWidth, h.APIKey,
	)

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to request photo URL: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck

	if resp.StatusCode == http.StatusFound || resp.StatusCode == http.StatusMovedPermanently {
		location := resp.Header.Get("Location")
		if location != "" {
			return location, nil
		}
	}

	return "", fmt.Errorf("unexpected response status: %d", resp.StatusCode)
}

// GetPhoto godoc
// @Summary      施設写真URL取得
// @Description  Place ID に対応する写真URLを取得する。キャッシュ未ヒット時のみ photo_reference を使って解決する
// @Tags         Places
// @Produce      json
// @Security     BearerAuth
// @Param        placeId          path   string  true   "Place ID"
// @Param        photo_reference  query  string  false  "Google Places Photo Reference（キャッシュ未ヒット時に必須）"
// @Param        maxWidth         query  int     false  "画像最大幅ピクセル（デフォルト2000）"
// @Success      200  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/places/{placeId}/photo [get]
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
