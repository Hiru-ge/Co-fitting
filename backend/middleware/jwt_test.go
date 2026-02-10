package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
)

const testSecret = "test-secret-key"

func setupRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	return router
}

func TestJWTAuth_ValidToken(t *testing.T) {
	router := setupRouter()
	token, _ := utils.GenerateAccessToken(42, testSecret, 15*time.Minute)

	router.GET("/protected", JWTAuth(testSecret), func(c *gin.Context) {
		userID, exists := GetUserIDFromContext(c)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "user ID not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user_id": userID})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}
}

func TestJWTAuth_NoAuthHeader(t *testing.T) {
	router := setupRouter()
	router.GET("/protected", JWTAuth(testSecret), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestJWTAuth_InvalidBearerFormat(t *testing.T) {
	router := setupRouter()
	router.GET("/protected", JWTAuth(testSecret), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "InvalidFormat token-here")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestJWTAuth_InvalidToken(t *testing.T) {
	router := setupRouter()
	router.GET("/protected", JWTAuth(testSecret), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalid.token.string")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestJWTAuth_ExpiredToken(t *testing.T) {
	router := setupRouter()
	token, _ := utils.GenerateAccessToken(42, testSecret, -1*time.Minute)

	router.GET("/protected", JWTAuth(testSecret), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestJWTAuth_WrongSecret(t *testing.T) {
	router := setupRouter()
	token, _ := utils.GenerateAccessToken(42, "different-secret", 15*time.Minute)

	router.GET("/protected", JWTAuth(testSecret), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestJWTAuth_RefreshTokenRejected(t *testing.T) {
	router := setupRouter()
	token, _ := utils.GenerateRefreshToken(42, testSecret, 7*24*time.Hour)

	router.GET("/protected", JWTAuth(testSecret), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestGetUserIDFromContext_NotSet(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	_, exists := GetUserIDFromContext(c)
	if exists {
		t.Error("expected exists to be false when user ID is not set")
	}
}
