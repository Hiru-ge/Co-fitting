package database

import (
	"fmt"

	"github.com/Hiru-ge/roamble/models"
	"gorm.io/gorm"
)

// Migrate runs database migrations
func Migrate(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database instance is nil")
	}

	// AutoMigrate creates the tables if they don't exist
	// It also handles schema updates for existing tables
	if err := db.AutoMigrate(
		&models.User{},
		&models.Visit{},
	); err != nil {
		return err
	}

	// Clean up deprecated columns
	if db.Migrator().HasColumn(&models.Visit{}, "latitude") {
		db.Migrator().DropColumn(&models.Visit{}, "latitude")
	}
	if db.Migrator().HasColumn(&models.Visit{}, "longitude") {
		db.Migrator().DropColumn(&models.Visit{}, "longitude")
	}

	return nil
}
