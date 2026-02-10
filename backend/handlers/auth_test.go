package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/testutil"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var testDB *gorm.DB
var testAuthHandler *AuthHandler

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

	testAuthHandler = &AuthHandler{
		DB:     testDB,
		JWTCfg: jwtCfg,
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
