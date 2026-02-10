package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestHealthCheck(t *testing.T) {
	// テストモード設定
	gin.SetMode(gin.TestMode)

	// テスト用ルーターを作成
	router := gin.New()
	router.GET("/health", HealthCheck)

	// テストケース
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	// ステータスコード確認
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// レスポンスボディ確認
	expectedBody := `{"status":"ok"}`
	if w.Body.String() != expectedBody {
		t.Errorf("Expected body %s, got %s", expectedBody, w.Body.String())
	}

	// Content-Type 確認
	if w.Header().Get("Content-Type") != "application/json; charset=utf-8" {
		t.Errorf("Expected Content-Type 'application/json; charset=utf-8', got '%s'", w.Header().Get("Content-Type"))
	}
}
