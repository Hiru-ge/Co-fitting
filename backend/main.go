package main

import (
	"log"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/database"
	_ "github.com/Hiru-ge/roamble/docs"
	"github.com/Hiru-ge/roamble/handlers"
	"github.com/Hiru-ge/roamble/routes"
	"github.com/Hiru-ge/roamble/services"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func initOAuthHandler(db *gorm.DB, jwtCfg *config.JWTConfig, redisClient *redis.Client, googleClientID string) *handlers.OAuthHandler {
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

func initNotificationScheduler(db *gorm.DB, notificationCfg *config.NotificationConfig) *services.NotificationScheduler {
	var pushSvc services.PushSender
	if notificationCfg.IsPushConfigComplete() {
		pushSvc = services.NewPushService(db, notificationCfg.VAPIDPublicKey, notificationCfg.VAPIDPrivateKey, notificationCfg.VAPIDSubject)
		log.Println("Notification push service initialized")
	} else {
		log.Println("Warning: VAPID keys not set, push notifications disabled")
	}

	var emailSvc services.EmailSender
	if notificationCfg.IsEmailConfigComplete() {
		emailSvc = services.NewEmailService(notificationCfg.ResendAPIKey, notificationCfg.EmailFrom)
		log.Println("Notification email service initialized")
	} else {
		log.Println("Warning: Resend config not set, email notifications disabled")
	}

	return services.NewNotificationScheduler(pushSvc, emailSvc, db)
}

func initPlacesHandlers(db *gorm.DB, redisClient *redis.Client, placesAPIKey string) (*handlers.SuggestionHandler, *handlers.PlacePhotoHandler) {
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

	appCfg, err := config.LoadAppConfig()
	if err != nil {
		log.Fatalf("Failed to load app config: %v", err)
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

	jwtCfg := appCfg.JWT
	authHandler := &handlers.AuthHandler{DB: db, JWTCfg: jwtCfg, RedisClient: redisClient}
	userHandler := &handlers.UserHandler{DB: db, RedisClient: redisClient, JWTCfg: jwtCfg}
	badgeHandler := &handlers.BadgeHandler{DB: db}
	genreHandler := &handlers.GenreHandler{DB: db}
	visitHandler := &handlers.VisitHandler{DB: db, Environment: appCfg.Server.Environment}
	oauthHandler := initOAuthHandler(db, jwtCfg, redisClient, appCfg.Google.OAuthClientID)
	suggestionHandler, placePhotoHandler := initPlacesHandlers(db, redisClient, appCfg.Google.PlacesAPIKey)
	healthHandler := &handlers.HealthHandler{DB: db, RedisClient: redisClient}
	betaHandler := &handlers.BetaHandler{Passphrase: appCfg.Beta.Passphrase}
	notificationHandler := &handlers.NotificationHandler{VAPIDPublicKey: appCfg.Notification.VAPIDPublicKey, DB: db}

	scheduler := initNotificationScheduler(db, appCfg.Notification)
	scheduler.Start()
	defer scheduler.Stop()

	devHandler := &handlers.DevHandler{
		RedisClient: redisClient,
		DB:          db,
		JWTCfg:      jwtCfg,
		Scheduler:   scheduler,
	}

	router := gin.Default()
	routes.Setup(router, routes.Deps{
		AuthHandler:         authHandler,
		OAuthHandler:        oauthHandler,
		UserHandler:         userHandler,
		BadgeHandler:        badgeHandler,
		GenreHandler:        genreHandler,
		VisitHandler:        visitHandler,
		SuggestionHandler:   suggestionHandler,
		PlacePhotoHandler:   placePhotoHandler,
		HealthHandler:       healthHandler,
		DevHandler:          devHandler,
		BetaHandler:         betaHandler,
		NotificationHandler: notificationHandler,
		JWTSecret:           jwtCfg.Secret,
		RedisClient:         redisClient,
		AllowedOrigins:      appCfg.CORS.AllowedOrigins,
		Environment:         appCfg.Server.Environment,
	})

	if err := router.Run(":" + appCfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
