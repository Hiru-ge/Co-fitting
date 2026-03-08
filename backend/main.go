package main

import (
	"log"
	"os"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/database"
	_ "github.com/Hiru-ge/roamble/docs"
	"github.com/Hiru-ge/roamble/handlers"
	"github.com/Hiru-ge/roamble/routes"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func initOAuthHandler(db *gorm.DB, jwtCfg *config.JWTConfig, redisClient *redis.Client) *handlers.OAuthHandler {
	googleClientID := os.Getenv("GOOGLE_OAUTH_CLIENT_ID")
	if googleClientID == "" {
		log.Println("Warning: GOOGLE_OAUTH_CLIENT_ID not set, Google OAuth endpoint disabled")
		return nil
	}
	log.Println("Google OAuth handler initialized")
	return &handlers.OAuthHandler{
		DB:          db,
		JWTCfg:      jwtCfg,
		RedisClient: redisClient,
		GoogleVerifier: &handlers.GoogleHTTPVerifier{
			ClientID: googleClientID,
		},
	}
}

func initPlacesHandlers(db *gorm.DB, redisClient *redis.Client) (*handlers.SuggestionHandler, *handlers.PlacePhotoHandler) {
	placesAPIKey := os.Getenv("GOOGLE_PLACES_API_KEY")
	if placesAPIKey == "" {
		log.Println("Warning: GOOGLE_PLACES_API_KEY not set, suggestions endpoint disabled")
		return nil, nil
	}
	placesClient, err := handlers.NewGooglePlacesClient(placesAPIKey)
	if err != nil {
		log.Fatalf("Failed to create Google Places client: %v", err)
	}
	log.Println("Google Places API client initialized")
	return &handlers.SuggestionHandler{
			DB:          db,
			RedisClient: redisClient,
			Places:      placesClient,
		}, &handlers.PlacePhotoHandler{
			RedisClient: redisClient,
			APIKey:      placesAPIKey,
		}
}

// @title           Roamble API
// @version         1.0
// @description     RoambleのバックエンドAPIドキュメント
// @host            localhost:8000
// @BasePath        /
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description JWTアクセストークン（Bearer形式）
func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	db, err := database.Init()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	log.Println("Database connected and migrated successfully")

	defer func() {
		if err := database.Close(); err != nil {
			log.Printf("Error closing database: %v", err)
		}
	}()

	redisClient, err := database.InitRedis()
	if err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	log.Println("Redis connected successfully")
	defer func() {
		if err := database.CloseRedis(); err != nil {
			log.Printf("Error closing Redis: %v", err)
		}
	}()

	jwtCfg, err := config.LoadJWTConfig()
	if err != nil {
		log.Fatalf("Failed to load JWT config: %v", err)
	}

	authHandler := &handlers.AuthHandler{
		DB:          db,
		JWTCfg:      jwtCfg,
		RedisClient: redisClient,
	}
	userHandler := &handlers.UserHandler{DB: db, RedisClient: redisClient, JWTCfg: jwtCfg}
	badgeHandler := &handlers.BadgeHandler{DB: db}
	genreHandler := &handlers.GenreHandler{DB: db}

	environment := os.Getenv("ENVIRONMENT")
	if environment == "" {
		environment = "development"
	}

	visitHandler := &handlers.VisitHandler{DB: db, Environment: environment}

	oauthHandler := initOAuthHandler(db, jwtCfg, redisClient)
	suggestionHandler, placePhotoHandler := initPlacesHandlers(db, redisClient)

	healthHandler := &handlers.HealthHandler{
		DB:          db,
		RedisClient: redisClient,
	}

	devHandler := &handlers.DevHandler{
		RedisClient: redisClient,
		DB:          db,
		JWTCfg:      jwtCfg,
	}

	betaHandler := &handlers.BetaHandler{}

	router := gin.Default()
	routes.Setup(router, routes.Deps{
		AuthHandler:       authHandler,
		OAuthHandler:      oauthHandler,
		UserHandler:       userHandler,
		BadgeHandler:      badgeHandler,
		GenreHandler:      genreHandler,
		VisitHandler:      visitHandler,
		SuggestionHandler: suggestionHandler,
		PlacePhotoHandler: placePhotoHandler,
		HealthHandler:     healthHandler,
		DevHandler:        devHandler,
		BetaHandler:       betaHandler,
		JWTSecret:         jwtCfg.Secret,
		RedisClient:       redisClient,
		Environment:       environment,
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
