package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockGoogleVerifier はテスト用のモックGoogle IDトークン検証器
type mockGoogleVerifier struct {
	userInfo *GoogleUserInfo
	err      error
}

func (m *mockGoogleVerifier) VerifyIDToken(ctx context.Context, idToken string) (*GoogleUserInfo, error) {
	return m.userInfo, m.err
}

func newTestOAuthHandler(verifier GoogleTokenVerifier) *OAuthHandler {
	return &OAuthHandler{
		DB:             testDB,
		JWTCfg:         testAuthHandler.JWTCfg,
		RedisClient:    testRedisClient,
		GoogleVerifier: verifier,
	}
}

func setupOAuthRouter(handler *OAuthHandler) *gin.Engine {
	r := gin.New()
	r.POST("/api/auth/oauth/google", handler.GoogleOAuth)
	return r
}

func cleanupForOAuth(t *testing.T) {
	t.Helper()
	testDB.Exec("DELETE FROM user_badges")
	testDB.Exec("DELETE FROM genre_proficiency")
	testDB.Exec("DELETE FROM user_interests")
	testDB.Exec("DELETE FROM visit_history")
	testDB.Exec("DELETE FROM users")
}

func TestGoogleOAuth(t *testing.T) {
	t.Run("有効なIDトークンで新規ユーザー登録・トークンペア返却", func(t *testing.T) {
		cleanupForOAuth(t)

		verifier := &mockGoogleVerifier{
			userInfo: &GoogleUserInfo{
				Sub:           "google-sub-123",
				Email:         "newuser@gmail.com",
				EmailVerified: true,
				Name:          "Test User",
				Picture:       "https://example.com/photo.jpg",
			},
		}

		handler := newTestOAuthHandler(verifier)
		router := setupOAuthRouter(handler)

		body := map[string]string{"id_token": "valid-google-id-token"}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/oauth/google", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code, "Body: %s", w.Body.String())

		var resp googleOAuthResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		assert.NotEmpty(t, resp.AccessToken)
		assert.NotEmpty(t, resp.RefreshToken)
		assert.True(t, resp.IsNewUser)

		// DBにユーザーが作成されているか確認
		var user models.User
		err = testDB.Where("email = ?", "newuser@gmail.com").First(&user).Error
		require.NoError(t, err)
		assert.Equal(t, "Test User", user.DisplayName)
		assert.NotNil(t, user.AvatarURL)
		assert.Equal(t, "https://example.com/photo.jpg", *user.AvatarURL)
	})

	t.Run("既存ユーザーでログイン（is_new_user=false）", func(t *testing.T) {
		cleanupForOAuth(t)

		// 先にユーザーを作成
		testDB.Create(&models.User{
			Email:       "existing@gmail.com",
			DisplayName: "Existing User",
		})

		verifier := &mockGoogleVerifier{
			userInfo: &GoogleUserInfo{
				Sub:           "google-sub-456",
				Email:         "existing@gmail.com",
				EmailVerified: true,
				Name:          "Existing User",
				Picture:       "https://example.com/photo.jpg",
			},
		}

		handler := newTestOAuthHandler(verifier)
		router := setupOAuthRouter(handler)

		body := map[string]string{"id_token": "valid-google-id-token"}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/oauth/google", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code, "Body: %s", w.Body.String())

		var resp googleOAuthResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)

		assert.NotEmpty(t, resp.AccessToken)
		assert.NotEmpty(t, resp.RefreshToken)
		assert.False(t, resp.IsNewUser)
	})

	t.Run("無効なIDトークンで401 Unauthorized", func(t *testing.T) {
		verifier := &mockGoogleVerifier{
			err: errors.New("invalid token"),
		}

		handler := newTestOAuthHandler(verifier)
		router := setupOAuthRouter(handler)

		body := map[string]string{"id_token": "invalid-token"}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/oauth/google", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)

		var resp map[string]string
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, "invalid id_token", resp["error"])
	})

	t.Run("id_tokenが未指定で400 Bad Request", func(t *testing.T) {
		verifier := &mockGoogleVerifier{}

		handler := newTestOAuthHandler(verifier)
		router := setupOAuthRouter(handler)

		body := map[string]string{}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/oauth/google", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("メール未認証で401 Unauthorized", func(t *testing.T) {
		verifier := &mockGoogleVerifier{
			userInfo: &GoogleUserInfo{
				Sub:           "google-sub-789",
				Email:         "unverified@gmail.com",
				EmailVerified: false,
				Name:          "Unverified User",
			},
		}

		handler := newTestOAuthHandler(verifier)
		router := setupOAuthRouter(handler)

		body := map[string]string{"id_token": "valid-but-unverified"}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/oauth/google", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)

		var resp map[string]string
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, "email not verified", resp["error"])
	})

	t.Run("名前なしの場合はメールプレフィックスがdisplay_nameになる", func(t *testing.T) {
		cleanupForOAuth(t)

		verifier := &mockGoogleVerifier{
			userInfo: &GoogleUserInfo{
				Sub:           "google-sub-noname",
				Email:         "noname@gmail.com",
				EmailVerified: true,
				Name:          "",
				Picture:       "",
			},
		}

		handler := newTestOAuthHandler(verifier)
		router := setupOAuthRouter(handler)

		body := map[string]string{"id_token": "valid-token-noname"}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/oauth/google", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp googleOAuthResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.IsNewUser)

		// display_name がメールのプレフィックスになっているか確認
		var user models.User
		err = testDB.Where("email = ?", "noname@gmail.com").First(&user).Error
		require.NoError(t, err)
		assert.Equal(t, "noname", user.DisplayName)
		assert.Nil(t, user.AvatarURL)
	})

	t.Run("アバターURLなしの新規ユーザーでavatar_urlがnil", func(t *testing.T) {
		cleanupForOAuth(t)

		verifier := &mockGoogleVerifier{
			userInfo: &GoogleUserInfo{
				Sub:           "google-sub-nopic",
				Email:         "nopic@gmail.com",
				EmailVerified: true,
				Name:          "No Pic User",
				Picture:       "",
			},
		}

		handler := newTestOAuthHandler(verifier)
		router := setupOAuthRouter(handler)

		body := map[string]string{"id_token": "valid-token-nopic"}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/oauth/google", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var user models.User
		err := testDB.Where("email = ?", "nopic@gmail.com").First(&user).Error
		require.NoError(t, err)
		assert.Nil(t, user.AvatarURL)
	})
}
