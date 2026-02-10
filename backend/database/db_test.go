package database

import (
	"testing"

	"github.com/Hiru-ge/roamble/models"
)

// TestDatabaseConnection tests MySQL connection and table creation
func TestDatabaseConnection(t *testing.T) {
	// Setup: Set environment variables for test (t.Setenv はテスト終了時に自動で元の値に戻る)
	t.Setenv("MYSQL_USER", "root")
	t.Setenv("MYSQL_PASSWORD", "root")
	t.Setenv("MYSQL_HOST", "localhost")
	t.Setenv("MYSQL_PORT", "3306")
	t.Setenv("MYSQL_DATABASE", "roamble_test")

	// Initialize database connection
	db, err := Init()
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}

	if db == nil {
		t.Fatal("Database instance is nil")
	}

	t.Run("Database connection should be established", func(t *testing.T) {
		// Ping the database
		sqlDB, err := db.DB()
		if err != nil {
			t.Fatalf("Failed to get SQL database: %v", err)
		}

		if err := sqlDB.Ping(); err != nil {
			t.Fatalf("Failed to ping database: %v", err)
		}
	})

	t.Run("User table should be auto-created", func(t *testing.T) {
		if !db.Migrator().HasTable(&models.User{}) {
			t.Fatal("User table was not created")
		}

		// Check required columns
		requiredColumns := []string{"id", "email", "password_hash", "display_name", "avatar_url", "created_at", "updated_at"}
		for _, col := range requiredColumns {
			if !db.Migrator().HasColumn(&models.User{}, col) {
				t.Fatalf("User table missing column: %s", col)
			}
		}
	})

	t.Run("Visit table should be auto-created", func(t *testing.T) {
		if !db.Migrator().HasTable(&models.Visit{}) {
			t.Fatal("Visit table was not created")
		}

		// Check required columns
		requiredColumns := []string{"id", "user_id", "place_id", "place_name", "lat", "lng", "rating", "visited_at", "created_at"}
		for _, col := range requiredColumns {
			if !db.Migrator().HasColumn(&models.Visit{}, col) {
				t.Fatalf("Visit table missing column: %s", col)
			}
		}
	})

	t.Run("Foreign key constraint should exist", func(t *testing.T) {
		// Check if foreign key relationship exists
		if !db.Migrator().HasConstraint(&models.Visit{}, "UserID") {
			t.Fatal("Foreign key constraint for UserID not found")
		}
	})

	// Cleanup: Close database connection
	sqlDB, _ := db.DB()
	if err := sqlDB.Close(); err != nil {
		t.Logf("Failed to close database: %v", err)
	}
}

// TestMigration tests that migrations can be run multiple times safely
func TestMigration(t *testing.T) {
	t.Setenv("MYSQL_USER", "root")
	t.Setenv("MYSQL_PASSWORD", "root")
	t.Setenv("MYSQL_HOST", "localhost")
	t.Setenv("MYSQL_PORT", "3306")
	t.Setenv("MYSQL_DATABASE", "roamble_test")

	db, err := Init()
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}

	// Run migration twice to ensure idempotency
	if err := Migrate(db); err != nil {
		t.Fatalf("First migration failed: %v", err)
	}

	if err := Migrate(db); err != nil {
		t.Fatalf("Second migration failed (migrations should be idempotent): %v", err)
	}

	sqlDB, _ := db.DB()
	sqlDB.Close()
}
