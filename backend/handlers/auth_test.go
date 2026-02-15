package handlers

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/testutil"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var testDB *gorm.DB
var testAuthHandler *AuthHandler
var testRedisClient *redis.Client

func TestMain(m *testing.M) {
	testutil.LoadTestEnv()

	var err error
	testDB, err = database.Init()
	if err != nil {
		panic("Failed to initialize test database: " + err.Error())
	}

	if err := database.Migrate(testDB); err != nil {
		panic("Failed to run migrations: " + err.Error())
	}

	os.Setenv("JWT_SECRET", "test-secret-key")
	jwtCfg, err := config.LoadJWTConfig()
	if err != nil {
		panic("Failed to load JWT config: " + err.Error())
	}

	// Redis初期化（テスト用にlocalhost接続）
	os.Setenv("REDIS_HOST", "localhost")
	redisClient, err := database.InitRedis()
	if err != nil {
		log.Printf("Warning: Redis not available for tests: %v", err)
	}
	testRedisClient = redisClient

	testAuthHandler = &AuthHandler{
		DB:          testDB,
		JWTCfg:      jwtCfg,
		RedisClient: testRedisClient,
	}

	gin.SetMode(gin.TestMode)

	code := m.Run()

	sqlDB, _ := testDB.DB()
	sqlDB.Close()
	os.Exit(code)
}

func cleanupUsers(t *testing.T) {
	t.Helper()
	testDB.Exec("DELETE FROM visit_history")
	testDB.Exec("DELETE FROM users")
}

func setupRouter() *gin.Engine {
	r := gin.New()
	r.POST("/api/auth/signup", testAuthHandler.SignUp)
	r.POST("/api/auth/login", testAuthHandler.Login)
	r.POST("/api/auth/refresh", testAuthHandler.RefreshToken)

	// JWT保護付きルート（ログアウトテスト用）
	authProtected := r.Group("/api/auth")
	authProtected.Use(middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient))
	authProtected.POST("/logout", testAuthHandler.Logout)

	// 保護されたテスト用エンドポイント
	api := r.Group("/api")
	api.Use(middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient))
	api.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	return r
}

func TestSignUp(t *testing.T) {
	router := setupRouter()

	t.Run("有効なデータで201 Created + トークンペア返却", func(t *testing.T) {
		cleanupUsers(t)

		body := map[string]string{
			"email":        "test@example.com",
			"password":     "password123",
			"display_name": "Test User",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/signup", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["access_token"] == nil || resp["access_token"] == "" {
			t.Error("Expected access_token in response")
		}
		if resp["refresh_token"] == nil || resp["refresh_token"] == "" {
			t.Error("Expected refresh_token in response")
		}
	})

	t.Run("メール重複で409 Conflict", func(t *testing.T) {
		cleanupUsers(t)

		// 先にユーザーを作成
		testDB.Create(&models.User{
			Email:        "dup@example.com",
			PasswordHash: "dummy",
			DisplayName:  "Existing",
		})

		body := map[string]string{
			"email":        "dup@example.com",
			"password":     "password123",
			"display_name": "New User",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/signup", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusConflict, w.Code, w.Body.String())
		}
	})

	t.Run("不正なメールで400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		body := map[string]string{
			"email":        "invalid-email",
			"password":     "password123",
			"display_name": "Test User",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/signup", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("短いパスワードで400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		body := map[string]string{
			"email":        "test@example.com",
			"password":     "short",
			"display_name": "Test User",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/signup", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("空のdisplay_nameで400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		body := map[string]string{
			"email":        "test@example.com",
			"password":     "password123",
			"display_name": "",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/signup", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("パスワードが平文で保存されていないことを確認", func(t *testing.T) {
		cleanupUsers(t)

		password := "password123"
		body := map[string]string{
			"email":        "hash@example.com",
			"password":     password,
			"display_name": "Hash Test",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/signup", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected status %d, got %d", http.StatusCreated, w.Code)
		}

		var user models.User
		testDB.Where("email = ?", "hash@example.com").First(&user)

		if user.PasswordHash == password {
			t.Error("Password is stored in plain text")
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
			t.Error("Password hash is not a valid bcrypt hash")
		}
	})

	t.Run("73文字パスワードで400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		// 73文字のパスワードを生成
		longPassword := strings.Repeat("a", 73)

		body := map[string]string{
			"email":        "test@example.com",
			"password":     longPassword,
			"display_name": "Test User",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/signup", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("72文字パスワードで201 Created（境界値テスト）", func(t *testing.T) {
		cleanupUsers(t)

		// 72文字のパスワードを生成
		maxPassword := strings.Repeat("a", 72)

		body := map[string]string{
			"email":        "test@example.com",
			"password":     maxPassword,
			"display_name": "Test User",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/signup", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
		}
	})
}

func TestLogin(t *testing.T) {
	router := setupRouter()

	t.Run("有効な認証情報で200 OK + トークンペア返却", func(t *testing.T) {
		cleanupUsers(t)

		// bcryptでハッシュ化したパスワードでユーザーを作成
		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		testDB.Create(&models.User{
			Email:        "login@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Login User",
		})

		body := map[string]string{
			"email":    "login@example.com",
			"password": "password123",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["access_token"] == nil || resp["access_token"] == "" {
			t.Error("Expected access_token in response")
		}
		if resp["refresh_token"] == nil || resp["refresh_token"] == "" {
			t.Error("Expected refresh_token in response")
		}
	})

	t.Run("存在しないユーザーで401 Unauthorized", func(t *testing.T) {
		cleanupUsers(t)

		body := map[string]string{
			"email":    "nonexistent@example.com",
			"password": "password123",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("パスワード不一致で401 Unauthorized", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.DefaultCost)
		testDB.Create(&models.User{
			Email:        "wrong@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Wrong Pass User",
		})

		body := map[string]string{
			"email":    "wrong@example.com",
			"password": "wrong-password",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})
}

func TestRefreshToken(t *testing.T) {
	router := setupRouter()

	t.Run("有効なリフレッシュトークンで新しいアクセストークン発行", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		testDB.Create(&models.User{
			Email:        "refresh@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Refresh User",
		})

		var user models.User
		testDB.Where("email = ?", "refresh@example.com").First(&user)

		refreshToken, _ := utils.GenerateRefreshToken(
			user.ID,
			testAuthHandler.JWTCfg.Secret,
			testAuthHandler.JWTCfg.RefreshExpiry,
		)

		body := map[string]string{
			"refresh_token": refreshToken,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/refresh", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["access_token"] == nil || resp["access_token"] == "" {
			t.Error("Expected access_token in response")
		}
	})

	t.Run("期限切れリフレッシュトークンで401 Unauthorized", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		testDB.Create(&models.User{
			Email:        "expired@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Expired User",
		})

		var user models.User
		testDB.Where("email = ?", "expired@example.com").First(&user)

		// 期限切れトークン（-1時間）
		expiredToken, _ := utils.GenerateRefreshToken(
			user.ID,
			testAuthHandler.JWTCfg.Secret,
			-1*time.Hour,
		)

		body := map[string]string{
			"refresh_token": expiredToken,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/refresh", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("無効なトークンで401 Unauthorized", func(t *testing.T) {
		body := map[string]string{
			"refresh_token": "invalid.token.string",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/refresh", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("アクセストークンをリフレッシュに使用で401 Unauthorized", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		testDB.Create(&models.User{
			Email:        "access@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Access User",
		})

		var user models.User
		testDB.Where("email = ?", "access@example.com").First(&user)

		// アクセストークンをリフレッシュとして送信
		accessToken, _ := utils.GenerateAccessToken(
			user.ID,
			testAuthHandler.JWTCfg.Secret,
			testAuthHandler.JWTCfg.AccessExpiry,
		)

		body := map[string]string{
			"refresh_token": accessToken,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/refresh", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})
}

func TestLogout(t *testing.T) {
	if testRedisClient == nil {
		t.Skip("Redis not available, skipping logout tests")
	}

	router := setupRouter()

	t.Run("有効なトークンで200 OK", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		testDB.Create(&models.User{
			Email:        "logout@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Logout User",
		})

		var user models.User
		testDB.Where("email = ?", "logout@example.com").First(&user)

		accessToken, _ := utils.GenerateAccessToken(
			user.ID,
			testAuthHandler.JWTCfg.Secret,
			testAuthHandler.JWTCfg.AccessExpiry,
		)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/logout", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}
		if resp["message"] == nil {
			t.Error("Expected message in response")
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/logout", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("ログアウト後、古いトークンでアクセス → 401 Unauthorized", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		testDB.Create(&models.User{
			Email:        "revoked@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Revoked User",
		})

		var user models.User
		testDB.Where("email = ?", "revoked@example.com").First(&user)

		accessToken, _ := utils.GenerateAccessToken(
			user.ID,
			testAuthHandler.JWTCfg.Secret,
			testAuthHandler.JWTCfg.AccessExpiry,
		)

		// まずログアウト
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/logout", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Logout failed: status %d, body %s", w.Code, w.Body.String())
		}

		// ログアウト後、同じトークンで保護されたエンドポイントにアクセス
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("GET", "/api/protected", nil)
		req2.Header.Set("Authorization", "Bearer "+accessToken)
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d after logout, got %d. Body: %s", http.StatusUnauthorized, w2.Code, w2.Body.String())
		}
	})
}
