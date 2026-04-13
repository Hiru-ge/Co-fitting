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

	if err := runDataMigrations(db); err != nil {
		return fmt.Errorf("failed to run data migrations: %w", err)
	}

	return nil
}

// runDataMigrations はデータ移行を冪等に実行する
func runDataMigrations(db *gorm.DB) error {
	if err := migrateV342ExcludeNaturalSpots(db); err != nil {
		return fmt.Errorf("v342: %w", err)
	}
	if err := normalizePremiumVisitCategory(db); err != nil {
		return fmt.Errorf("premium-category-normalization: %w", err)
	}
	return nil
}

// normalizePremiumVisitCategory は「プレミア」ジャンルに紐づく訪問の
// category 列を "プレミア" に正規化する。
// 既に正規化済みのレコードは更新しない（冪等）。
func normalizePremiumVisitCategory(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var premiumTag models.GenreTag
		if err := tx.Where("name = ?", "プレミア").First(&premiumTag).Error; err != nil {
			return fmt.Errorf("プレミアジャンルが見つかりません: %w", err)
		}

		if err := tx.Model(&models.Visit{}).
			Where("genre_tag_id = ?", premiumTag.ID).
			Where("category IS NULL OR category <> ?", "プレミア").
			Update("category", "プレミア").Error; err != nil {
			return fmt.Errorf("プレミアcategory正規化失敗: %w", err)
		}

		return nil
	})
}

// migrateV342ExcludeNaturalSpots は Issue #342 のデータ移行。
// 自然スポット・観光地などの廃止ジャンルを削除し、
// 対象ジャンルへの既存訪問記録を「プレミア」ジャンルに付け替える。
// 「図書館・書店」は「書店」にリネームする。
// どちらも対象レコードが存在しない場合は何もしない（冪等）。
func migrateV342ExcludeNaturalSpots(db *gorm.DB) error {
	deprecatedGenres := []string{
		"公園・緑地",
		"自然・ハイキング",
		"海・川・湖",
		"神社・寺",
		"観光スポット",
		"美術館・ギャラリー",
		"博物館・科学館",
		"スポーツジム",
		"ショッピングモール",
	}

	return db.Transaction(func(tx *gorm.DB) error {
		// 廃止ジャンルが残っているか確認
		var deprecatedCount int64
		tx.Model(&models.GenreTag{}).Where("name IN ?", deprecatedGenres).Count(&deprecatedCount)

		if deprecatedCount > 0 {
			var premiumTag models.GenreTag
			if err := tx.Where("name = ?", "プレミア").First(&premiumTag).Error; err != nil {
				return fmt.Errorf("プレミアジャンルが見つかりません: %w", err)
			}

			// 廃止ジャンルの訪問記録をプレミアに付け替え
			subQuery := tx.Model(&models.GenreTag{}).Select("id").Where("name IN ?", deprecatedGenres)
			if err := tx.Model(&models.Visit{}).
				Where("genre_tag_id IN (?)", subQuery).
				Update("genre_tag_id", premiumTag.ID).Error; err != nil {
				return fmt.Errorf("visits更新失敗: %w", err)
			}

			// 廃止ジャンルを削除（CASCADE で user_interests・genre_proficiencies も削除）
			if err := tx.Where("name IN ?", deprecatedGenres).Delete(&models.GenreTag{}).Error; err != nil {
				return fmt.Errorf("廃止ジャンル削除失敗: %w", err)
			}
		}

		// 「図書館・書店」→「書店」リネーム
		var oldBookTag models.GenreTag
		if err := tx.Where("name = ?", "図書館・書店").First(&oldBookTag).Error; err == nil {
			var newBookTag models.GenreTag
			if err := tx.Where("name = ?", "書店").First(&newBookTag).Error; err != nil {
				return fmt.Errorf("書店ジャンルが見つかりません: %w", err)
			}

			// 訪問記録を新タグに付け替え
			if err := tx.Model(&models.Visit{}).
				Where("genre_tag_id = ?", oldBookTag.ID).
				Update("genre_tag_id", newBookTag.ID).Error; err != nil {
				return fmt.Errorf("書店visits更新失敗: %w", err)
			}

			// 旧タグを削除（CASCADE で user_interests・genre_proficiencies も削除）
			if err := tx.Delete(&oldBookTag).Error; err != nil {
				return fmt.Errorf("図書館・書店削除失敗: %w", err)
			}
		}

		return nil
	})
}
