package database

import (
	"fmt"

	"github.com/Hiru-ge/roamble/models"
	"gorm.io/gorm"
)

// dropLegacyColumns は廃止済みカラムを安全に削除する。
// AutoMigrate はカラムを追加するがカラムを削除しないため、明示的に呼び出す必要がある。
// カラムが存在しない環境ではスキップするため、ローカル・本番・テストDBで安全に動作する。
func dropLegacyColumns(db *gorm.DB) error {
	if db.Migrator().HasColumn(&models.User{}, "settings_json") {
		if err := db.Migrator().DropColumn(&models.User{}, "settings_json"); err != nil {
			return fmt.Errorf("failed to drop users.settings_json: %w", err)
		}
	}
	return nil
}

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

	if err := db.AutoMigrate(
		&models.PushSubscription{},
		&models.NotificationSettings{},
	); err != nil {
		return fmt.Errorf("failed to migrate notification tables: %w", err)
	}

	if err := SeedMasterData(db); err != nil {
		return fmt.Errorf("failed to seed master data: %w", err)
	}

	if err := dropLegacyColumns(db); err != nil {
		return fmt.Errorf("failed to drop legacy columns: %w", err)
	}

	return nil
}
