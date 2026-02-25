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
	OAuthHandler      *handlers.OAuthHandler
	UserHandler       *handlers.UserHandler
	BadgeHandler      *handlers.BadgeHandler
	GenreHandler      *handlers.GenreHandler
	VisitHandler      *handlers.VisitHandler
	SuggestionHandler *handlers.SuggestionHandler
	PlacePhotoHandler *handlers.PlacePhotoHandler
	DevHandler        *handlers.DevHandler
	JWTSecret         string
	RedisClient       *redis.Client
	Environment       string
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
	auth.POST("/refresh", deps.AuthHandler.RefreshToken)
	if deps.OAuthHandler != nil {
		auth.POST("/oauth/google", deps.OAuthHandler.GoogleOAuth)
	}

	// 認証（JWT必要）
	authProtected := router.Group("/api/auth")
	authProtected.Use(middleware.JWTAuth(deps.JWTSecret, deps.RedisClient))
	authProtected.POST("/logout", deps.AuthHandler.Logout)

	// JWT保護付きAPI
	api := router.Group("/api")
	api.Use(middleware.JWTAuth(deps.JWTSecret, deps.RedisClient))
	api.GET("/users/me", deps.UserHandler.GetMe)
	api.GET("/users/me/stats", deps.UserHandler.GetStats)
	api.GET("/users/me/badges", deps.UserHandler.GetBadges)
	api.GET("/users/me/proficiency", deps.UserHandler.GetProficiency)
	api.GET("/users/me/interests", deps.UserHandler.GetInterests)
	api.PUT("/users/me/interests", deps.UserHandler.UpdateInterests)
	api.PATCH("/users/me", deps.UserHandler.UpdateMe)
	api.DELETE("/users/me", deps.UserHandler.DeleteMe)
	api.GET("/badges", deps.BadgeHandler.GetAllBadges)
	api.GET("/genres", deps.GenreHandler.GetAllGenreTags)
	if deps.SuggestionHandler != nil {
		api.POST("/suggestions", deps.SuggestionHandler.Suggest)
	}
	if deps.PlacePhotoHandler != nil {
		api.GET("/places/:placeId/photo", deps.PlacePhotoHandler.GetPhoto)
	}
	api.POST("/visits", deps.VisitHandler.CreateVisit)
	api.GET("/visits", deps.VisitHandler.ListVisits)
	api.GET("/visits/map", deps.VisitHandler.GetMapData)
	api.PATCH("/visits/:id", deps.VisitHandler.UpdateVisit)
	api.GET("/visits/:id", deps.VisitHandler.GetVisit)

	// 開発用エンドポイント（development環境のみ）
	if deps.Environment == "development" && deps.DevHandler != nil {
		// JWT不要の開発用エンドポイント
		devPublic := router.Group("/api/dev")
		devPublic.POST("/auth/test-login", deps.DevHandler.TestLogin)

		// JWT必須の開発用エンドポイント
		dev := router.Group("/api/dev")
		dev.Use(middleware.JWTAuth(deps.JWTSecret, deps.RedisClient))
		dev.DELETE("/suggestions/cache", deps.DevHandler.ResetSuggestionCache)
		dev.GET("/suggestions/stats", deps.DevHandler.GetSuggestionStats)
	}
}
