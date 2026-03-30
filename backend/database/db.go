package database

import (
	"errors"
	"fmt"

	"github.com/Hiru-ge/roamble/config"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func Init() (*gorm.DB, error) {
	dbCfg, err := config.LoadDatabaseConfig()
	if err != nil {
		return nil, err
	}

	params := "charset=utf8mb4&parseTime=True&loc=Local"
	if dbCfg.TLSMode != "" {
		params += "&tls=" + dbCfg.TLSMode
	}
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?%s",
		dbCfg.User, dbCfg.Password, dbCfg.Host, dbCfg.Port, dbCfg.Name, params)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return db, nil
}

func Close(db *gorm.DB) error {
	if db == nil {
		return errors.New("database not initialized")
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	return sqlDB.Close()
}
