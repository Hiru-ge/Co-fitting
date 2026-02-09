package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "github.com/Hiru-ge/roamble/docs"

	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

type Server struct {
	db *sql.DB
}

// @title 		 Health Check
// @description  サーバーのヘルスチェック用エンドポイント
// @tags         Health
// @produce      plain
// @success      200  {string}  string	"OK"
// @router       /health [get]
func (s *Server) healthHandler(c *gin.Context) {
	c.String(http.StatusOK, "OK")
}

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

	cfg := mysql.NewConfig()
	cfg.User = os.Getenv("MYSQL_USER")
	cfg.Passwd = os.Getenv("MYSQL_PASSWORD")
	cfg.Net = "tcp"
	cfg.Addr = os.Getenv("MYSQL_HOST") + ":" + os.Getenv("MYSQL_PORT")
	cfg.DBName = os.Getenv("MYSQL_DATABASE")
	cfg.ParseTime = true // DB内部では[]byteで扱われているcreated_atを正しくtime.Timeで解釈するための設定

	var err error
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatal(err)
	}

	// DB接続確認
	pingErr := db.Ping()
	if pingErr != nil {
		log.Fatal(pingErr)
	}
	fmt.Println("Connected!")

	// ルーティング
	server := &Server{db: db}
	router := gin.Default()
	router.GET("/health", server.healthHandler)
	router.Run(":8000")
}
