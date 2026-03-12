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

	// is_comfort_zone → is_breakout カラム改名（Issue #269）
	// AutoMigrate(Visit) より前に実行すること: AutoMigrate が is_breakout を先に追加すると
	// CHANGE COLUMN が "Duplicate column name" エラーになるため。
	if db.Migrator().HasColumn(&models.Visit{}, "is_comfort_zone") &&
		!db.Migrator().HasColumn(&models.Visit{}, "is_breakout") {
		if err := db.Exec("ALTER TABLE visit_history CHANGE COLUMN is_comfort_zone is_breakout TINYINT(1) NOT NULL DEFAULT 0").Error; err != nil {
			return fmt.Errorf("failed to rename is_comfort_zone to is_breakout: %w", err)
		}
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Visit{},
	); err != nil {
		return fmt.Errorf("failed to migrate core tables: %w", err)
	}

	if err := db.AutoMigrate(
		&models.UserInterest{},
		&models.GenreProficiency{},
		&models.UserBadge{},
	); err != nil {
		return fmt.Errorf("failed to migrate user relation tables: %w", err)
	}

	if db.Migrator().HasColumn(&models.Visit{}, "latitude") {
		db.Migrator().DropColumn(&models.Visit{}, "latitude")
	}
	if db.Migrator().HasColumn(&models.Visit{}, "longitude") {
		db.Migrator().DropColumn(&models.Visit{}, "longitude")
	}

	// Google OAuth移行に伴い password_hash カラムを削除
	if db.Migrator().HasColumn(&models.User{}, "password_hash") {
		db.Migrator().DropColumn(&models.User{}, "password_hash")
	}

	if err := db.AutoMigrate(
		&models.PushSubscription{},
		&models.NotificationSettings{},
	); err != nil {
		return fmt.Errorf("failed to migrate notification tables: %w", err)
	}

	if err := SeedMasterData(db); err != nil {
		return fmt.Errorf("failed to seed master data: %w", err)
	}

	return nil
}
