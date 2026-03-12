package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type NotificationHandler struct {
	VAPIDPublicKey string
}

// VAPIDKeyResponse はVAPID公開鍵取得エンドポイントのレスポンス型。
type VAPIDKeyResponse struct {
	VAPIDPublicKey string `json:"vapid_public_key"`
}

// GetVAPIDPublicKey godoc
// @Summary      VAPID公開鍵取得
// @Description  Web Push通知用のVAPID公開鍵を返す
// @Tags         Notifications
// @Produce      json
// @Success      200  {object}  VAPIDKeyResponse
// @Failure      500  {object}  map[string]string
// @Router       /api/notifications/push/vapid-key [get]
func (h *NotificationHandler) GetVAPIDPublicKey(c *gin.Context) {
	if h.VAPIDPublicKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "VAPID public key not configured"})
		return
	}
	c.JSON(http.StatusOK, VAPIDKeyResponse{VAPIDPublicKey: h.VAPIDPublicKey})
}
