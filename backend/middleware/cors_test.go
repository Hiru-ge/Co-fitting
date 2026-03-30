package middleware

import (
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORS_WithAllowedOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS([]string{"https://roamble.com"}))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "ok"})
	})

	// プリフライトリクエストをテスト
	req := httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "https://roamble.com")
	req.Header.Set("Access-Control-Request-Method", "GET")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// CORS ヘッダーが正しく設定されていることを確認
	if w.Header().Get("Access-Control-Allow-Origin") != "https://roamble.com" {
		t.Errorf("Expected Access-Control-Allow-Origin to be 'https://roamble.com', got '%s'", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_WithSingleOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS([]string{"http://localhost:5173"}))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "ok"})
	})

	// 単一オリジン設定での動作をテスト
	req := httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "GET")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// 設定したオリジンが許可されていることを確認
	if w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Errorf("Expected Access-Control-Allow-Origin to be 'http://localhost:5173', got '%s'", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_WithMultipleOrigins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS([]string{"https://roamble.com", "http://localhost:5173", "https://dev.roamble.com"}))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "ok"})
	})

	testCases := []string{
		"https://roamble.com",
		"http://localhost:5173",
		"https://dev.roamble.com",
	}

	for _, origin := range testCases {
		t.Run(fmt.Sprintf("origin_%s", origin), func(t *testing.T) {
			req := httptest.NewRequest("OPTIONS", "/test", nil)
			req.Header.Set("Origin", origin)
			req.Header.Set("Access-Control-Request-Method", "GET")

			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			// 該当オリジンが許可されていることを確認
			if w.Header().Get("Access-Control-Allow-Origin") != origin {
				t.Errorf("Expected Access-Control-Allow-Origin to be '%s', got '%s'", origin, w.Header().Get("Access-Control-Allow-Origin"))
			}
		})
	}
}

func TestCORS_DisallowedOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS([]string{"https://roamble.com"}))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "ok"})
	})

	// 許可されていないオリジンでテスト
	req := httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "https://malicious-site.com")
	req.Header.Set("Access-Control-Request-Method", "GET")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// 不正なオリジンには Access-Control-Allow-Origin ヘッダーが設定されないことを確認
	allowOrigin := w.Header().Get("Access-Control-Allow-Origin")
	if allowOrigin == "https://malicious-site.com" {
		t.Errorf("Malicious origin should not be allowed, but got Access-Control-Allow-Origin: '%s'", allowOrigin)
	}
}
