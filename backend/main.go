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
)

// @title           Roamble API
// @version         1.0
// @description     RoambleのバックエンドAPIドキュメント
// @host            localhost:8080
// @BasePath        /
func main() {
	// .envファイルから環境変数を読み込む
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

	// Redis初期化
	redisClient, err := database.InitRedis()
	if err != nil {
		log.Printf("Warning: Failed to initialize Redis: %v (caching disabled)", err)
	} else {
		log.Println("Redis connected successfully")
		defer func() {
			if err := database.CloseRedis(); err != nil {
				log.Printf("Error closing Redis: %v", err)
			}
		}()
	}

	jwtCfg, err := config.LoadJWTConfig()
	if err != nil {
		log.Fatalf("Failed to load JWT config: %v", err)
	}

	authHandler := &handlers.AuthHandler{
		DB:     db,
		JWTCfg: jwtCfg,
	}
	userHandler := &handlers.UserHandler{DB: db}
	visitHandler := &handlers.VisitHandler{DB: db}

	// Google Places APIクライアント初期化
	var suggestionHandler *handlers.SuggestionHandler
	placesAPIKey := os.Getenv("GOOGLE_PLACES_API_KEY")
	if placesAPIKey != "" {
		placesClient, err := handlers.NewGooglePlacesClient(placesAPIKey)
		if err != nil {
			log.Fatalf("Failed to create Google Places client: %v", err)
		}
		suggestionHandler = &handlers.SuggestionHandler{
			DB:          db,
			RedisClient: redisClient,
			Places:      placesClient,
		}
		log.Println("Google Places API client initialized")
	} else {
		log.Println("Warning: GOOGLE_PLACES_API_KEY not set, suggestions endpoint disabled")
	}

	router := gin.Default()
	routes.Setup(router, routes.Deps{
		AuthHandler:       authHandler,
		UserHandler:       userHandler,
		VisitHandler:      visitHandler,
		SuggestionHandler: suggestionHandler,
		JWTSecret:         jwtCfg.Secret,
	})

	router.Run(":8000")
}
