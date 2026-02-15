package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestErrorHandler(t *testing.T) {
	// テストモード設定
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		setupHandler   func(*gin.Context)
		expectedStatus int
		expectedBody   string
		description    string
	}{
		{
			name: "no errors - normal response",
			setupHandler: func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"message":"success"}`,
			description:    "エラーがない場合は通常のレスポンスが返される",
		},
		{
			name: "single error - error response",
			setupHandler: func(c *gin.Context) {
				c.Error(errors.New("test error"))
			},
			expectedStatus: http.StatusInternalServerError,
			expectedBody:   `{"error":"test error"}`,
			description:    "単一のエラーが発生した場合、500エラーと統一フォーマットが返される",
		},
		{
			name: "multiple errors - last error response",
			setupHandler: func(c *gin.Context) {
				c.Error(errors.New("first error"))
				c.Error(errors.New("second error"))
				c.Error(errors.New("last error"))
			},
			expectedStatus: http.StatusInternalServerError,
			expectedBody:   `{"error":"last error"}`,
			description:    "複数のエラーが発生した場合、最後のエラーが返される",
		},
		{
			name: "error with already written response",
			setupHandler: func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "already written"})
				c.Error(errors.New("error after response"))
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"message":"already written"}`,
			description:    "レスポンスが既に書き込まれている場合、元のレスポンスがそのまま返される",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()
			r.Use(ErrorHandler())

			r.GET("/test", tt.setupHandler)

			req := httptest.NewRequest("GET", "/test", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code, tt.description)
			assert.JSONEq(t, tt.expectedBody, w.Body.String(), tt.description)
		})
	}
}

func TestErrorHandler_PanicRecovery(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(gin.Recovery()) // パニックリカバリミドルウェアを追加
	r.Use(ErrorHandler())

	r.GET("/panic", func(c *gin.Context) {
		panic("test panic")
	})

	req := httptest.NewRequest("GET", "/panic", nil)
	w := httptest.NewRecorder()

	// パニックが発生してもサーバーが落ちずに処理が継続されることを確認
	assert.NotPanics(t, func() {
		r.ServeHTTP(w, req)
	}, "パニックが発生してもサーバーは停止しない")

	// パニックの場合はGinのRecoveryミドルウェアが500を返す
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestErrorHandler_ErrorLogging(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(ErrorHandler())

	r.GET("/test", func(c *gin.Context) {
		c.Error(errors.New("logged error"))
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// エラーが適切にレスポンスされることを確認
	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.JSONEq(t, `{"error":"logged error"}`, w.Body.String())
}

func TestErrorHandler_EmptyErrorMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(ErrorHandler())

	r.GET("/test", func(c *gin.Context) {
		c.Error(errors.New(""))
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// 空のエラーメッセージでも適切に処理される
	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.JSONEq(t, `{"error":""}`, w.Body.String())
}

func TestErrorHandler_WithDifferentHTTPMethods(t *testing.T) {
	gin.SetMode(gin.TestMode)

	methods := []string{"GET", "POST", "PUT", "PATCH", "DELETE"}

	for _, method := range methods {
		t.Run("method_"+method, func(t *testing.T) {
			r := gin.New()
			r.Use(ErrorHandler())

			r.Handle(method, "/test", func(c *gin.Context) {
				c.Error(errors.New("method error"))
			})

			req := httptest.NewRequest(method, "/test", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			assert.Equal(t, http.StatusInternalServerError, w.Code)
			assert.JSONEq(t, `{"error":"method error"}`, w.Body.String())
		})
	}
}

func TestErrorHandler_ErrorResponseFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(ErrorHandler())

	r.GET("/test", func(c *gin.Context) {
		c.Error(errors.New("format test error"))
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// レスポンスヘッダーの確認
	assert.Equal(t, "application/json; charset=utf-8", w.Header().Get("Content-Type"))
	assert.Equal(t, http.StatusInternalServerError, w.Code)

	// レスポンスボディの形式確認
	expectedJSON := `{"error":"format test error"}`
	assert.JSONEq(t, expectedJSON, w.Body.String())
}

func TestErrorHandler_NoResponseRewrite(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(ErrorHandler())

	r.GET("/test", func(c *gin.Context) {
		// 先にレスポンスを書き込む
		c.JSON(http.StatusCreated, gin.H{"data": "created"})
		// その後でエラーを追加
		c.Error(errors.New("after response error"))
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// 既に書き込まれたレスポンスが保持される
	assert.Equal(t, http.StatusCreated, w.Code)
	assert.JSONEq(t, `{"data":"created"}`, w.Body.String())

	// エラーレスポンスに上書きされない
	assert.NotContains(t, w.Body.String(), "after response error")
}
