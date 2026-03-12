package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func setupVAPIDKeyRouter(h *NotificationHandler) *gin.Engine {
	r := gin.New()
	r.GET("/api/notifications/push/vapid-key", h.GetVAPIDPublicKey)
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
