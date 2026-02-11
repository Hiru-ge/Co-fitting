package routes

import (
	"github.com/Hiru-ge/roamble/handlers"
	"github.com/Hiru-ge/roamble/middleware"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/gin-gonic/gin"
)

type Deps struct {
	AuthHandler       *handlers.AuthHandler
	UserHandler       *handlers.UserHandler
	VisitHandler      *handlers.VisitHandler
	SuggestionHandler *handlers.SuggestionHandler
	JWTSecret         string
}

func Setup(router *gin.Engine, deps Deps) {
	// グローバルミドルウェア
	router.Use(middleware.CORS())
	router.Use(middleware.ErrorHandler())

	// ヘルスチェック
	router.GET("/health", handlers.HealthCheck)

	// Swagger
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// 認証（JWT不要）
	auth := router.Group("/api/auth")
	auth.POST("/signup", deps.AuthHandler.SignUp)
	auth.POST("/login", deps.AuthHandler.Login)
	auth.POST("/refresh", deps.AuthHandler.RefreshToken)

	// JWT保護付きAPI
	api := router.Group("/api")
	api.Use(middleware.JWTAuth(deps.JWTSecret))
	api.GET("/users/me", deps.UserHandler.GetMe)
	if deps.SuggestionHandler != nil {
		api.POST("/suggestions", deps.SuggestionHandler.Suggest)
	}
	api.POST("/visits", deps.VisitHandler.CreateVisit)
	api.GET("/visits", deps.VisitHandler.ListVisits)
}
