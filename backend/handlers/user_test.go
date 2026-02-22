package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func setupUserRouter() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetMe)
	return r
}

func generateTestToken(userID uint64) string {
	token, _ := utils.GenerateAccessToken(
		userID,
		testAuthHandler.JWTCfg.Secret,
		testAuthHandler.JWTCfg.AccessExpiry,
	)
	return token
}

func setupUserRouterWithPatch() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.GET("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.GetMe)
	r.PATCH("/api/users/me", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.UpdateMe)
	return r
}

func TestGetMe(t *testing.T) {
	router := setupUserRouter()

	t.Run("JWTつきで自身の情報が返される", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "me@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Me User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["email"] != "me@example.com" {
			t.Errorf("Expected email 'me@example.com', got '%v'", resp["email"])
		}
		if resp["display_name"] != "Me User" {
			t.Errorf("Expected display_name 'Me User', got '%v'", resp["display_name"])
		}
		if _, exists := resp["password_hash"]; exists {
			t.Error("password_hash should not be exposed in response")
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("ユーザーが存在しない場合404 Not Found", func(t *testing.T) {
		cleanupUsers(t)

		token := generateTestToken(99999)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users/me", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})
}

func TestUpdateMe(t *testing.T) {
	router := setupUserRouterWithPatch()

	t.Run("表示名を更新できる", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "update@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Old Name",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"display_name": "New Name",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp["display_name"] != "New Name" {
			t.Errorf("Expected display_name 'New Name', got '%v'", resp["display_name"])
		}

		// DBに反映されていることを確認
		var updated models.User
		testDB.First(&updated, user.ID)
		if updated.DisplayName != "New Name" {
			t.Errorf("Expected DB display_name 'New Name', got '%s'", updated.DisplayName)
		}
	})

	t.Run("空の表示名で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "empty@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Original",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"display_name": "",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("表示名の前後空白がトリムされる", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "trim@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Original",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"display_name": "  Trimmed Name  ",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["display_name"] != "Trimmed Name" {
			t.Errorf("Expected display_name 'Trimmed Name', got '%v'", resp["display_name"])
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		body := map[string]string{
			"display_name": "New Name",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("ユーザーが存在しない場合404 Not Found", func(t *testing.T) {
		cleanupUsers(t)

		token := generateTestToken(99999)

		body := map[string]string{
			"display_name": "Ghost",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusNotFound, w.Code, w.Body.String())
		}
	})
}

func setupUserRouterWithEmail() *gin.Engine {
	userHandler := &UserHandler{DB: testDB}

	r := gin.New()
	r.PATCH("/api/users/me/email", middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient), userHandler.UpdateEmail)
	return r
}

func TestUpdateEmail(t *testing.T) {
	router := setupUserRouterWithEmail()

	t.Run("有効なリクエストでメールアドレスを変更できる", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "old@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Email User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"new_email":        "new@example.com",
			"current_password": "password123",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me/email", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		var updated models.User
		testDB.First(&updated, user.ID)
		if updated.Email != "new@example.com" {
			t.Errorf("Expected email 'new@example.com', got '%s'", updated.Email)
		}
	})

	t.Run("重複するメールアドレスで409 Conflict", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		existing := models.User{
			Email:        "taken@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Taken User",
		}
		testDB.Create(&existing)

		user := models.User{
			Email:        "current@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Current User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"new_email":        "taken@example.com",
			"current_password": "password123",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me/email", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusConflict, w.Code, w.Body.String())
		}
	})

	t.Run("無効なメールフォーマットで400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "valid@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Format User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"new_email":        "not-an-email",
			"current_password": "password123",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me/email", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("現在のパスワードが不正で401 Unauthorized", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "auth@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Auth User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"new_email":        "newemail@example.com",
			"current_password": "wrongpassword",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me/email", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		body := map[string]string{
			"new_email":        "new@example.com",
			"current_password": "password123",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me/email", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("必須フィールド欠損で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "missing@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Missing User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"new_email": "new@example.com",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("PATCH", "/api/users/me/email", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})
}

func TestChangePassword(t *testing.T) {
	router := gin.New()
	authProtected := router.Group("/api/auth")
	authProtected.Use(middleware.JWTAuth(testAuthHandler.JWTCfg.Secret, testRedisClient))
	authProtected.POST("/change-password", testAuthHandler.ChangePassword)

	t.Run("有効なパスワード変更で200 OK", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "changepw@example.com",
			PasswordHash: string(hash),
			DisplayName:  "ChangePass User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"current_password": "oldpassword123",
			"new_password":     "newpassword456",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/change-password", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		// 新しいパスワードでログインできることを確認
		var updated models.User
		testDB.First(&updated, user.ID)
		if err := bcrypt.CompareHashAndPassword([]byte(updated.PasswordHash), []byte("newpassword456")); err != nil {
			t.Error("New password was not saved correctly")
		}
	})

	t.Run("現在のパスワードが不正で401 Unauthorized", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "wrongpw@example.com",
			PasswordHash: string(hash),
			DisplayName:  "WrongPW User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"current_password": "wrongpassword",
			"new_password":     "newpassword456",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/change-password", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("短い新パスワードで400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "shortpw@example.com",
			PasswordHash: string(hash),
			DisplayName:  "ShortPW User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"current_password": "oldpassword123",
			"new_password":     "short",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/change-password", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("必須フィールド欠損で400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "missing@example.com",
			PasswordHash: string(hash),
			DisplayName:  "Missing Fields",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		body := map[string]string{
			"current_password": "oldpassword123",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/change-password", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("JWTなしで401 Unauthorized", func(t *testing.T) {
		body := map[string]string{
			"current_password": "oldpassword123",
			"new_password":     "newpassword456",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/change-password", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusUnauthorized, w.Code, w.Body.String())
		}
	})

	t.Run("73文字新パスワードで400 Bad Request", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "longpw@example.com",
			PasswordHash: string(hash),
			DisplayName:  "LongPW User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		// 73文字のパスワードを生成
		longPassword := strings.Repeat("a", 73)

		body := map[string]string{
			"current_password": "oldpassword123",
			"new_password":     longPassword,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/change-password", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusBadRequest, w.Code, w.Body.String())
		}
	})

	t.Run("72文字新パスワードで200 OK（境界値テスト）", func(t *testing.T) {
		cleanupUsers(t)

		hash, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
		user := models.User{
			Email:        "maxpw@example.com",
			PasswordHash: string(hash),
			DisplayName:  "MaxPW User",
		}
		testDB.Create(&user)

		token := generateTestToken(user.ID)

		// 72文字のパスワードを生成
		maxPassword := strings.Repeat("a", 72)

		body := map[string]string{
			"current_password": "oldpassword123",
			"new_password":     maxPassword,
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/change-password", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
		}

		// 新しいパスワードでログインできることを確認
		var updated models.User
		testDB.First(&updated, user.ID)
		if err := bcrypt.CompareHashAndPassword([]byte(updated.PasswordHash), []byte(maxPassword)); err != nil {
			t.Error("New long password was not saved correctly")
		}
	})
}
