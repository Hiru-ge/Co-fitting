package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func setupBetaRouter(h *BetaHandler) *gin.Engine {
	r := gin.New()
	r.POST("/api/beta/verify", h.VerifyPassphrase)
	return r
}

func TestVerifyPassphrase_正しい合言葉で200を返す(t *testing.T) {
	h := &BetaHandler{Passphrase: "EARLYROAMER"}
	router := setupBetaRouter(h)

	body, _ := json.Marshal(map[string]string{"passphrase": "EARLYROAMER"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/beta/verify", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]bool
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスのパースに失敗: %v", err)
	}
	if !resp["ok"] {
		t.Errorf("Expected ok=true, got %v", resp)
	}
}

func TestVerifyPassphrase_間違った合言葉で401を返す(t *testing.T) {
	h := &BetaHandler{Passphrase: "EARLYROAMER"}
	router := setupBetaRouter(h)

	body, _ := json.Marshal(map[string]string{"passphrase": "WRONGPASSWORD"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/beta/verify", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestVerifyPassphrase_前後スペースは照合前にトリムされない(t *testing.T) {
	h := &BetaHandler{Passphrase: "EARLYROAMER"}
	router := setupBetaRouter(h)

	// バックエンドはそのまま比較するためスペース付きは不一致
	body, _ := json.Marshal(map[string]string{"passphrase": " EARLYROAMER "})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/beta/verify", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d (スペース付きは不一致のはず)", http.StatusUnauthorized, w.Code)
	}
}

func TestVerifyPassphrase_環境変数未設定時は常に200を返す(t *testing.T) {
	h := &BetaHandler{}
	router := setupBetaRouter(h)

	body, _ := json.Marshal(map[string]string{"passphrase": "anything"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/beta/verify", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}
}

func TestVerifyPassphrase_リクエストボディなしで400を返す(t *testing.T) {
	h := &BetaHandler{Passphrase: "EARLYROAMER"}
	router := setupBetaRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/beta/verify", bytes.NewBuffer([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}
