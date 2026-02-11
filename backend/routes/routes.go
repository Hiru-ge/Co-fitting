package routes

import (
	"github.com/Hiru-ge/roamble/handlers"
	"github.com/Hiru-ge/roamble/middleware"
	"github.com/redis/go-redis/v9"
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
	RedisClient       *redis.Client
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

	// 認証（JWT必要）
	authProtected := router.Group("/api/auth")
	authProtected.Use(middleware.JWTAuth(deps.JWTSecret, deps.RedisClient))
	authProtected.POST("/logout", deps.AuthHandler.Logout)

	// JWT保護付きAPI
	api := router.Group("/api")
	api.Use(middleware.JWTAuth(deps.JWTSecret, deps.RedisClient))
	api.GET("/users/me", deps.UserHandler.GetMe)
	if deps.SuggestionHandler != nil {
		api.POST("/suggestions", deps.SuggestionHandler.Suggest)
	}
	api.POST("/visits", deps.VisitHandler.CreateVisit)
	api.GET("/visits", deps.VisitHandler.ListVisits)
}
