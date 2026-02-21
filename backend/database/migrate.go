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

	// Phase 1: マスタテーブルを先にマイグレート（外部キー参照先）
	if err := db.AutoMigrate(
		&models.GenreTag{},
		&models.Badge{},
	); err != nil {
		return fmt.Errorf("failed to migrate master tables: %w", err)
	}

	// ユーザー・訪問記録テーブル
	if err := db.AutoMigrate(
		&models.User{},
		&models.Visit{},
	); err != nil {
		return fmt.Errorf("failed to migrate core tables: %w", err)
	}

	// ユーザー関連テーブル（user_idへの外部キーを持つ）
	if err := db.AutoMigrate(
		&models.UserInterest{},
		&models.GenreProficiency{},
		&models.UserBadge{},
	); err != nil {
		return fmt.Errorf("failed to migrate user relation tables: %w", err)
	}

	// Clean up deprecated columns
	if db.Migrator().HasColumn(&models.Visit{}, "latitude") {
		db.Migrator().DropColumn(&models.Visit{}, "latitude")
	}
	if db.Migrator().HasColumn(&models.Visit{}, "longitude") {
		db.Migrator().DropColumn(&models.Visit{}, "longitude")
	}

	// マスタデータ投入
	if err := SeedMasterData(db); err != nil {
		return fmt.Errorf("failed to seed master data: %w", err)
	}

	return nil
}
