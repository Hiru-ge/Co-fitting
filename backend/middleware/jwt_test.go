package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

const testSecret = "test-secret-key"

var testRedisClient *redis.Client

func TestMain(m *testing.M) {
	// テスト用環境変数を読み込む
	_, filename, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(filename), "..", "..")
	envPath := filepath.Join(projectRoot, ".env")
	if err := godotenv.Load(envPath); err != nil {
		fmt.Println("middleware test: .env not found, using existing environment variables")
	}

	os.Setenv("REDIS_HOST", "localhost") //nolint:errcheck

	// Redis初期化
	host := os.Getenv("REDIS_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("REDIS_PORT")
	if port == "" {
		port = "6379"
	}
	testRedisClient = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", host, port),
	})

	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

func setupRouter() *gin.Engine {
	router := gin.New()
	return router
}

func TestJWTAuth_ValidToken(t *testing.T) {
	router := setupRouter()
	token, _ := utils.GenerateAccessToken(42, testSecret, 15*time.Minute)

	router.GET("/protected", JWTAuth(testSecret, testRedisClient), func(c *gin.Context) {
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
	router.GET("/protected", JWTAuth(testSecret, testRedisClient), func(c *gin.Context) {
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
	router.GET("/protected", JWTAuth(testSecret, testRedisClient), func(c *gin.Context) {
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
	router.GET("/protected", JWTAuth(testSecret, testRedisClient), func(c *gin.Context) {
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

	router.GET("/protected", JWTAuth(testSecret, testRedisClient), func(c *gin.Context) {
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

	router.GET("/protected", JWTAuth(testSecret, testRedisClient), func(c *gin.Context) {
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

	router.GET("/protected", JWTAuth(testSecret, testRedisClient), func(c *gin.Context) {
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
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	_, exists := GetUserIDFromContext(c)
	if exists {
		t.Error("expected exists to be false when user ID is not set")
	}
}
