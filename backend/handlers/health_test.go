package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func setupHealthRouter(h *HealthHandler) *gin.Engine {
	r := gin.New()
	r.GET("/health", h.HealthCheck)
	return r
}

func TestHealthCheck_AllHealthy(t *testing.T) {
	h := &HealthHandler{DB: testDB, RedisClient: testRedisClient}
	router := setupHealthRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("レスポンスのパースに失敗: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("Expected status 'ok', got '%s'", body["status"])
	}
	if body["db"] != "ok" {
		t.Errorf("Expected db 'ok', got '%s'", body["db"])
	}
	if body["redis"] != "ok" {
		t.Errorf("Expected redis 'ok', got '%s'", body["redis"])
	}
}

func TestHealthCheck_NilDeps(t *testing.T) {
	// DB/Redis が nil の場合（依存なし起動）は "unknown" を返す
	h := &HealthHandler{DB: nil, RedisClient: nil}
	router := setupHealthRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("レスポンスのパースに失敗: %v", err)
	}

	if body["db"] != "unknown" {
		t.Errorf("Expected db 'unknown', got '%s'", body["db"])
	}
	if body["redis"] != "unknown" {
		t.Errorf("Expected redis 'unknown', got '%s'", body["redis"])
	}
}

func TestHealthCheck_ContentType(t *testing.T) {
	h := &HealthHandler{DB: testDB, RedisClient: testRedisClient}
	router := setupHealthRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	if w.Header().Get("Content-Type") != "application/json; charset=utf-8" {
		t.Errorf("Expected Content-Type 'application/json; charset=utf-8', got '%s'", w.Header().Get("Content-Type"))
	}
}
