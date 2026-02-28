package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func setupRateLimitRouter(rl *RateLimiter) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RateLimit(rl))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r
}

func TestRateLimit_AllowsUnderLimit(t *testing.T) {
	rl := NewRateLimiter(5, time.Minute)
	router := setupRateLimitRouter(rl)

	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "1.2.3.4:1234"
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}
}

func TestRateLimit_BlocksOverLimit(t *testing.T) {
	rl := NewRateLimiter(3, time.Minute)
	router := setupRateLimitRouter(rl)

	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "1.2.3.4:1234"
		router.ServeHTTP(w, req)
	}

	// 4回目はブロックされる
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	router.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429, got %d", w.Code)
	}
}

func TestRateLimit_DifferentIPsIndependent(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)
	router := setupRateLimitRouter(rl)

	// IP1 が上限に達しても IP2 は通る
	for _, ip := range []string{"1.2.3.4:1234", "5.6.7.8:5678"} {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = ip
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("ip %s: expected 200, got %d", ip, w.Code)
		}
	}
}

func TestRateLimit_ResetsAfterWindow(t *testing.T) {
	rl := NewRateLimiter(1, 50*time.Millisecond)
	router := setupRateLimitRouter(rl)

	// 1回目: OK
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// 2回目: ブロック
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	router.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w.Code)
	}

	// ウィンドウが経過したら復活
	time.Sleep(60 * time.Millisecond)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("after window reset: expected 200, got %d", w.Code)
	}
}
