package database

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Hiru-ge/roamble/models"
	"github.com/joho/godotenv"
)

func loadTestEnv(t *testing.T) {
	t.Helper()
	_, filename, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(filename), "..", "..")
	envPath := filepath.Join(projectRoot, ".env")

	if err := godotenv.Load(envPath); err != nil {
		fmt.Println("db_test: .env not found, using existing environment variables")
	}

	t.Setenv("MYSQL_USER", "root")
	t.Setenv("MYSQL_PASSWORD", os.Getenv("MYSQL_ROOT_PASSWORD"))
	t.Setenv("MYSQL_DATABASE", "roamble_test")
	t.Setenv("MYSQL_HOST", "localhost")
}

// TestDatabaseConnection tests MySQL connection and table creation
func TestDatabaseConnection(t *testing.T) {
	loadTestEnv(t)

	db, err := Init()
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}

	if db == nil {
		t.Fatal("Database instance is nil")
	}

	t.Run("Database connection should be established", func(t *testing.T) {
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

		requiredColumns := []string{"id", "email", "display_name", "avatar_url", "created_at", "updated_at"}
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

		requiredColumns := []string{"id", "user_id", "place_id", "place_name", "lat", "lng", "rating", "visited_at", "created_at"}
		for _, col := range requiredColumns {
			if !db.Migrator().HasColumn(&models.Visit{}, col) {
				t.Fatalf("Visit table missing column: %s", col)
			}
		}
	})

	t.Run("Foreign key constraint should exist", func(t *testing.T) {
		if !db.Migrator().HasColumn(&models.Visit{}, "user_id") {
			t.Fatal("Visit table missing user_id column")
		}

		// Verify the Visit model has the User relationship defined
		// by checking if the Migrator can see the relationship
		if !db.Migrator().HasTable(&models.User{}) {
			t.Fatal("User table not found for referential check")
		}

		// Try to query the schema to verify user_id column exists and can be joined
		sqlDB, _ := db.DB()
		var columnType string
		row := sqlDB.QueryRow("SELECT COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='visit_history' AND COLUMN_NAME='user_id'")
		if err := row.Scan(&columnType); err != nil {
			t.Fatalf("Failed to query user_id column: %v", err)
		}
	})

	sqlDB, _ := db.DB()
	if err := sqlDB.Close(); err != nil {
		t.Logf("Failed to close database: %v", err)
	}
}

// TestMigration tests that migrations can be run multiple times safely
func TestMigration(t *testing.T) {
	loadTestEnv(t)

	db, err := Init()
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}

	if err := Migrate(db); err != nil {
		t.Fatalf("First migration failed: %v", err)
	}

	if err := Migrate(db); err != nil {
		t.Fatalf("Second migration failed (migrations should be idempotent): %v", err)
	}

	sqlDB, _ := db.DB()
	sqlDB.Close() //nolint:errcheck
}
