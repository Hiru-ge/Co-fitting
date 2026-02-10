package main

import (
	"log"

	"github.com/Hiru-ge/roamble/database"
	_ "github.com/Hiru-ge/roamble/docs"
	"github.com/Hiru-ge/roamble/handlers"

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

	router := gin.Default()
	router.GET("/health", handlers.HealthCheck)
	router.Run(":8000")
}
