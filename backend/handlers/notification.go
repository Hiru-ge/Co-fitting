package handlers

import (
	"net/http"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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

// UnsubscribePushRequest はPush購読解除リクエストの型。
type UnsubscribePushRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
}

// NotificationSettingsResponse は通知設定取得エンドポイントのレスポンス型。
type NotificationSettingsResponse struct {
	IsPushEnabled            bool `json:"is_push_enabled"`
	IsEmailEnabled           bool `json:"is_email_enabled"`
	IsDailySuggestionEnabled bool `json:"is_daily_suggestion_enabled"`
	IsWeeklySummaryEnabled   bool `json:"is_weekly_summary_enabled"`
	IsMonthlySummaryEnabled  bool `json:"is_monthly_summary_enabled"`
	IsStreakReminderEnabled  bool `json:"is_streak_reminder_enabled"`
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

// upsertPushSubscription はPush購読をUpsertする。
// 新規登録の場合は true、既存レコードの更新の場合は false を返す。
// MySQL の ON DUPLICATE KEY UPDATE は INSERT=1行、UPDATE=2行を返す。
func upsertPushSubscription(db *gorm.DB, userID uint64, endpoint, p256dh, auth, userAgent string) (isNew bool, err error) {
	sub := models.PushSubscription{
		UserID:    userID,
		Endpoint:  endpoint,
		P256DH:    p256dh,
		Auth:      auth,
		UserAgent: userAgent,
	}
	result := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "endpoint"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id", "p256_dh", "auth", "user_agent"}),
	}).Create(&sub)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
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
// @Failure      500  {object}  map[string]string
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

	isNew, err := upsertPushSubscription(h.DB, userID, req.Endpoint, req.P256DH, req.Auth, req.UserAgent)
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

// UnsubscribePush godoc
// @Summary      Push購読解除
// @Description  指定endpointのPush通知購読をDBから削除する。存在しない場合も204を返す（冪等）。
// @Tags         Notifications
// @Accept       json
// @Security     BearerAuth
// @Param        body  body  UnsubscribePushRequest  true  "解除するendpoint"
// @Success      204
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/notifications/push/subscribe [delete]
func (h *NotificationHandler) UnsubscribePush(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req UnsubscribePushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DB.Where("endpoint = ? AND user_id = ?", req.Endpoint, userID).Delete(&models.PushSubscription{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete subscription"})
		return
	}

	c.Status(http.StatusNoContent)
}

// UpdateNotificationSettingsRequest は通知設定更新リクエストの型。
// 各フィールドはポインタで、nil の場合は更新対象外。
type UpdateNotificationSettingsRequest struct {
	IsPushEnabled            *bool `json:"is_push_enabled"`
	IsEmailEnabled           *bool `json:"is_email_enabled"`
	IsDailySuggestionEnabled *bool `json:"is_daily_suggestion_enabled"`
	IsWeeklySummaryEnabled   *bool `json:"is_weekly_summary_enabled"`
	IsMonthlySummaryEnabled  *bool `json:"is_monthly_summary_enabled"`
	IsStreakReminderEnabled  *bool `json:"is_streak_reminder_enabled"`
}

// UpdateNotificationSettings godoc
// @Summary      通知設定更新
// @Description  ユーザーの通知設定を更新する。送信されたフィールドのみ更新（部分更新）。
// @Tags         Notifications
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  UpdateNotificationSettingsRequest  true  "更新する通知設定"
// @Success      200  {object}  NotificationSettingsResponse
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/notifications/settings [put]
func (h *NotificationHandler) UpdateNotificationSettings(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req UpdateNotificationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var settings models.NotificationSettings
	if err := h.DB.FirstOrCreate(&settings, models.NotificationSettings{UserID: userID}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get notification settings"})
		return
	}

	updates := map[string]interface{}{}
	if req.IsPushEnabled != nil {
		updates["push_enabled"] = *req.IsPushEnabled
	}
	if req.IsEmailEnabled != nil {
		updates["email_enabled"] = *req.IsEmailEnabled
	}
	if req.IsDailySuggestionEnabled != nil {
		updates["daily_suggestion"] = *req.IsDailySuggestionEnabled
	}
	if req.IsWeeklySummaryEnabled != nil {
		updates["weekly_summary"] = *req.IsWeeklySummaryEnabled
	}
	if req.IsMonthlySummaryEnabled != nil {
		updates["monthly_summary"] = *req.IsMonthlySummaryEnabled
	}
	if req.IsStreakReminderEnabled != nil {
		updates["streak_reminder"] = *req.IsStreakReminderEnabled
	}

	if len(updates) > 0 {
		if err := h.DB.Model(&settings).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update notification settings"})
			return
		}
		if err := h.DB.Where("user_id = ?", userID).First(&settings).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get updated notification settings"})
			return
		}
	}

	c.JSON(http.StatusOK, NotificationSettingsResponse{
		IsPushEnabled:            settings.IsPushEnabled,
		IsEmailEnabled:           settings.IsEmailEnabled,
		IsDailySuggestionEnabled: settings.IsDailySuggestionEnabled,
		IsWeeklySummaryEnabled:   settings.IsWeeklySummaryEnabled,
		IsMonthlySummaryEnabled:  settings.IsMonthlySummaryEnabled,
		IsStreakReminderEnabled:  settings.IsStreakReminderEnabled,
	})
}

// GetNotificationSettings godoc
// @Summary      通知設定取得
// @Description  ユーザーの通知設定を取得する
// @Tags         Notifications
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  NotificationSettingsResponse
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/notifications/settings [get]
func (h *NotificationHandler) GetNotificationSettings(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var settings models.NotificationSettings
	if err := h.DB.Where("user_id = ?", userID).First(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get notification settings"})
		return
	}

	c.JSON(http.StatusOK, NotificationSettingsResponse{
		IsPushEnabled:            settings.IsPushEnabled,
		IsEmailEnabled:           settings.IsEmailEnabled,
		IsDailySuggestionEnabled: settings.IsDailySuggestionEnabled,
		IsWeeklySummaryEnabled:   settings.IsWeeklySummaryEnabled,
		IsMonthlySummaryEnabled:  settings.IsMonthlySummaryEnabled,
		IsStreakReminderEnabled:  settings.IsStreakReminderEnabled,
	})
}
