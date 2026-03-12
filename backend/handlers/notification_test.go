package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/repositories"
	"github.com/gin-gonic/gin"
)

func setupVAPIDKeyRouter(h *NotificationHandler) *gin.Engine {
	r := gin.New()
	r.GET("/api/notifications/push/vapid-key", h.GetVAPIDPublicKey)
	return r
}

func setupSubscribePushRouter(h *NotificationHandler) *gin.Engine {
	r := gin.New()
	r.POST("/api/notifications/push/subscribe",
		middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient),
		h.SubscribePush,
	)
	return r
}

func TestGetVAPIDPublicKey_Success(t *testing.T) {
	h := &NotificationHandler{VAPIDPublicKey: "test-vapid-public-key"}
	router := setupVAPIDKeyRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/notifications/push/vapid-key", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var resp VAPIDKeyResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースに失敗: %v", err)
	}

	if resp.VAPIDPublicKey != "test-vapid-public-key" {
		t.Errorf("Expected vapid_public_key='test-vapid-public-key', got '%s'", resp.VAPIDPublicKey)
	}
}

func TestGetVAPIDPublicKey_NotSet(t *testing.T) {
	h := &NotificationHandler{VAPIDPublicKey: ""}
	router := setupVAPIDKeyRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/notifications/push/vapid-key", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusInternalServerError, w.Code, w.Body.String())
	}
}

func TestSubscribePush_Success(t *testing.T) {
	cleanupUsers(t)
	testDB.Exec("DELETE FROM push_subscriptions")

	user := createTestUserByEmail(t, "push@example.com", "Push User")
	token := generateTestToken(user.ID)

	h := &NotificationHandler{VAPIDPublicKey: "test-key", DB: testDB}
	router := setupSubscribePushRouter(h)

	body := map[string]interface{}{
		"endpoint":   "https://fcm.googleapis.com/fcm/send/test-endpoint-1",
		"p256dh":     "test-p256dh-key",
		"auth":       "test-auth-key",
		"user_agent": "Mozilla/5.0 Test Browser",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/notifications/push/subscribe", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
	}
}

func TestSubscribePush_Upsert(t *testing.T) {
	cleanupUsers(t)
	testDB.Exec("DELETE FROM push_subscriptions")

	user := createTestUserByEmail(t, "push-upsert@example.com", "Push Upsert User")
	token := generateTestToken(user.ID)

	h := &NotificationHandler{VAPIDPublicKey: "test-key", DB: testDB}
	router := setupSubscribePushRouter(h)

	body := map[string]interface{}{
		"endpoint":   "https://fcm.googleapis.com/fcm/send/same-endpoint",
		"p256dh":     "original-p256dh",
		"auth":       "original-auth",
		"user_agent": "Mozilla/5.0 Original",
	}
	jsonBody, _ := json.Marshal(body)

	// 1回目の登録
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("POST", "/api/notifications/push/subscribe", bytes.NewBuffer(jsonBody))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusCreated {
		t.Fatalf("1回目: Expected status %d, got %d. Body: %s", http.StatusCreated, w1.Code, w1.Body.String())
	}

	// 2回目は同一endpointで再登録（Upsert）→ 200
	updatedBody := map[string]interface{}{
		"endpoint":   "https://fcm.googleapis.com/fcm/send/same-endpoint",
		"p256dh":     "updated-p256dh",
		"auth":       "updated-auth",
		"user_agent": "Mozilla/5.0 Updated",
	}
	jsonUpdated, _ := json.Marshal(updatedBody)

	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/api/notifications/push/subscribe", bytes.NewBuffer(jsonUpdated))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("2回目（Upsert）: Expected status %d, got %d. Body: %s", http.StatusOK, w2.Code, w2.Body.String())
	}
}

func setupUnsubscribePushRouter(h *NotificationHandler) *gin.Engine {
	r := gin.New()
	r.DELETE("/api/notifications/push/subscribe",
		middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient),
		h.UnsubscribePush,
	)
	return r
}

func TestUnsubscribePush_Success(t *testing.T) {
	cleanupUsers(t)
	testDB.Exec("DELETE FROM push_subscriptions")

	user := createTestUserByEmail(t, "unsub@example.com", "Unsub User")
	token := generateTestToken(user.ID)

	// 事前に購読を登録しておく
	_, err := repositories.UpsertPushSubscription(testDB, user.ID, "https://fcm.googleapis.com/fcm/send/unsub-endpoint", "p256dh", "auth", "UA")
	if err != nil {
		t.Fatalf("購読登録に失敗: %v", err)
	}

	h := &NotificationHandler{VAPIDPublicKey: "test-key", DB: testDB}
	router := setupUnsubscribePushRouter(h)

	body := map[string]interface{}{
		"endpoint": "https://fcm.googleapis.com/fcm/send/unsub-endpoint",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/notifications/push/subscribe", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNoContent, w.Code, w.Body.String())
	}
}

func TestUnsubscribePush_NotFound(t *testing.T) {
	cleanupUsers(t)
	testDB.Exec("DELETE FROM push_subscriptions")

	user := createTestUserByEmail(t, "unsub-notfound@example.com", "Unsub NotFound User")
	token := generateTestToken(user.ID)

	h := &NotificationHandler{VAPIDPublicKey: "test-key", DB: testDB}
	router := setupUnsubscribePushRouter(h)

	body := map[string]interface{}{
		"endpoint": "https://fcm.googleapis.com/fcm/send/nonexistent-endpoint",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/notifications/push/subscribe", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	router.ServeHTTP(w, req)

	// 冪等: 存在しないendpointでも204を返す
	if w.Code != http.StatusNoContent {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNoContent, w.Code, w.Body.String())
	}
}

func TestUnsubscribePush_Unauthorized(t *testing.T) {
	h := &NotificationHandler{VAPIDPublicKey: "test-key", DB: testDB}
	router := setupUnsubscribePushRouter(h)

	body := map[string]interface{}{
		"endpoint": "https://fcm.googleapis.com/fcm/send/test",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/notifications/push/subscribe", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	// Authorization ヘッダーなし
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
	}
}

func TestSubscribePush_Unauthorized(t *testing.T) {
	h := &NotificationHandler{VAPIDPublicKey: "test-key", DB: testDB}
	router := setupSubscribePushRouter(h)

	body := map[string]interface{}{
		"endpoint":   "https://fcm.googleapis.com/fcm/send/test",
		"p256dh":     "test-p256dh",
		"auth":       "test-auth",
		"user_agent": "Mozilla/5.0 Test",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/notifications/push/subscribe", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	// Authorization ヘッダーなし
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
	}
}

func setupGetNotificationSettingsRouter(h *NotificationHandler) *gin.Engine {
	r := gin.New()
	r.GET("/api/notifications/settings",
		middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient),
		h.GetNotificationSettings,
	)
	return r
}

func TestGetNotificationSettings_WithRecord(t *testing.T) {
	cleanupUsers(t)
	testDB.Exec("DELETE FROM notification_settings")

	user := createTestUserByEmail(t, "ns-withrecord@example.com", "NS WithRecord User")
	token := generateTestToken(user.ID)

	// 事前にレコードを作成（PushEnabled=false に設定）
	testDB.Exec(
		"INSERT INTO notification_settings (user_id, push_enabled, email_enabled, daily_suggestion, weekly_summary, monthly_summary, streak_reminder) VALUES (?, ?, ?, ?, ?, ?, ?)",
		user.ID, false, true, false, true, true, false,
	)

	h := &NotificationHandler{DB: testDB}
	router := setupGetNotificationSettingsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/notifications/settings", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var resp NotificationSettingsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースに失敗: %v", err)
	}

	if resp.PushEnabled != false {
		t.Errorf("Expected PushEnabled=false, got %v", resp.PushEnabled)
	}
	if resp.EmailEnabled != true {
		t.Errorf("Expected EmailEnabled=true, got %v", resp.EmailEnabled)
	}
}

func TestGetNotificationSettings_NoRecord(t *testing.T) {
	cleanupUsers(t)
	testDB.Exec("DELETE FROM notification_settings")

	user := createTestUserByEmail(t, "ns-norecord@example.com", "NS NoRecord User")
	token := generateTestToken(user.ID)

	h := &NotificationHandler{DB: testDB}
	router := setupGetNotificationSettingsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/notifications/settings", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var resp NotificationSettingsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースに失敗: %v", err)
	}

	// レコードなし → デフォルト値（PushEnabled: true）
	if resp.PushEnabled != true {
		t.Errorf("Expected PushEnabled=true (default), got %v", resp.PushEnabled)
	}
	if resp.StreakReminder != true {
		t.Errorf("Expected StreakReminder=true (default), got %v", resp.StreakReminder)
	}
	if resp.MonthlySummary != false {
		t.Errorf("Expected MonthlySummary=false (default), got %v", resp.MonthlySummary)
	}
}

func TestGetNotificationSettings_Unauthorized(t *testing.T) {
	h := &NotificationHandler{DB: testDB}
	router := setupGetNotificationSettingsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/notifications/settings", nil)
	// Authorization ヘッダーなし
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
	}
}

func setupUpdateNotificationSettingsRouter(h *NotificationHandler) *gin.Engine {
	r := gin.New()
	r.PUT("/api/notifications/settings",
		middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient),
		h.UpdateNotificationSettings,
	)
	return r
}

func TestUpdateNotificationSettings_Success(t *testing.T) {
	cleanupUsers(t)
	testDB.Exec("DELETE FROM notification_settings")

	user := createTestUserByEmail(t, "ns-update@example.com", "NS Update User")
	token := generateTestToken(user.ID)

	h := &NotificationHandler{DB: testDB}
	router := setupUpdateNotificationSettingsRouter(h)

	pushEnabled := false
	streakReminder := true
	body := map[string]interface{}{
		"push_enabled":    pushEnabled,
		"streak_reminder": streakReminder,
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/notifications/settings", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var resp NotificationSettingsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースに失敗: %v", err)
	}

	if resp.PushEnabled != false {
		t.Errorf("Expected PushEnabled=false, got %v", resp.PushEnabled)
	}
	if resp.StreakReminder != true {
		t.Errorf("Expected StreakReminder=true, got %v", resp.StreakReminder)
	}
}

func TestUpdateNotificationSettings_Unauthorized(t *testing.T) {
	h := &NotificationHandler{DB: testDB}
	router := setupUpdateNotificationSettingsRouter(h)

	body := map[string]interface{}{
		"push_enabled": true,
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/notifications/settings", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	// Authorization ヘッダーなし
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
	}
}
