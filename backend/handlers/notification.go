package handlers

import (
	"net/http"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/repositories"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type NotificationHandler struct {
	VAPIDPublicKey string
	DB             *gorm.DB
}

// VAPIDKeyResponse はVAPID公開鍵取得エンドポイントのレスポンス型。
type VAPIDKeyResponse struct {
	VAPIDPublicKey string `json:"vapid_public_key"`
}

// SubscribePushRequest はPush購読登録リクエストの型。
type SubscribePushRequest struct {
	Endpoint  string `json:"endpoint" binding:"required"`
	P256DH    string `json:"p256dh" binding:"required"`
	Auth      string `json:"auth" binding:"required"`
	UserAgent string `json:"user_agent"`
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

// SubscribePush godoc
// @Summary      Push購読登録
// @Description  Push通知購読をDBに登録する。同一endpointが存在する場合はUpsert。
// @Tags         Notifications
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  SubscribePushRequest  true  "購読情報"
// @Success      201  {object}  map[string]string
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Router       /api/notifications/push/subscribe [post]
func (h *NotificationHandler) SubscribePush(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req SubscribePushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isNew, err := repositories.UpsertPushSubscription(h.DB, userID, req.Endpoint, req.P256DH, req.Auth, req.UserAgent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save subscription"})
		return
	}

	if isNew {
		c.JSON(http.StatusCreated, gin.H{"message": "subscribed"})
	} else {
		c.JSON(http.StatusOK, gin.H{"message": "subscription updated"})
	}
}
