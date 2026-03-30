package database

import (
	"errors"
	"fmt"

	"github.com/Hiru-ge/roamble/config"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// DB はグローバルDBインスタンス。現在はInit()での初期化とGetDB()経由のアクセスに使用。
// 方針: ハンドラ・サービスへはコンストラクタ注入（DI）で渡す。
// グローバル変数は後方互換のために残すが、新規コードでは直接参照しないこと。
// 段階的にDIのみに統一し、最終的にこのグローバル変数を廃止する。
var DB *gorm.DB

func Init() (*gorm.DB, error) {
	dbCfg, err := config.LoadDatabaseConfig()
	if err != nil {
		return nil, err
	}

	// Build DSN (Data Source Name)
	// MYSQL_TLS: TiDB Cloud等TLS必須環境では "tidb" を設定。ローカル開発時は空でよい
	params := "charset=utf8mb4&parseTime=True&loc=Local"
	if dbCfg.TLSMode != "" {
		params += "&tls=" + dbCfg.TLSMode
	}
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?%s",
		dbCfg.User, dbCfg.Password, dbCfg.Host, dbCfg.Port, dbCfg.Name, params)

	// Connect to MySQL
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Set as global instance
	DB = db

	return db, nil
}

func Close() error {
	if DB == nil {
		return errors.New("database not initialized")
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	return sqlDB.Close()
}

func GetDB() *gorm.DB {
	return DB
}
