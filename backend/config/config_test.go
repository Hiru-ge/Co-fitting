package config

import (
	"testing"
	"time"
)

func TestLoadJWTConfig_WithAllEnvVars(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-key")
	t.Setenv("JWT_ACCESS_EXPIRY", "30")
	t.Setenv("JWT_REFRESH_EXPIRY", "20160")

	cfg, err := LoadJWTConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Secret != "test-secret-key" {
		t.Errorf("expected secret 'test-secret-key', got '%s'", cfg.Secret)
	}
	if cfg.AccessExpiry != 30*time.Minute {
		t.Errorf("expected access expiry 30m, got %v", cfg.AccessExpiry)
	}
	if cfg.RefreshExpiry != 20160*time.Minute {
		t.Errorf("expected refresh expiry 20160m, got %v", cfg.RefreshExpiry)
	}
}

func TestLoadJWTConfig_DefaultExpiry(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-key")

	cfg, err := LoadJWTConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.AccessExpiry != 15*time.Minute {
		t.Errorf("expected default access expiry 15m, got %v", cfg.AccessExpiry)
	}
	if cfg.RefreshExpiry != 10080*time.Minute {
		t.Errorf("expected default refresh expiry 10080m (7 days), got %v", cfg.RefreshExpiry)
	}
}

func TestLoadJWTConfig_MissingSecret(t *testing.T) {
	_, err := LoadJWTConfig()
	if err == nil {
		t.Fatal("expected error when JWT_SECRET is not set")
	}
}

func TestLoadJWTConfig_InvalidAccessExpiry(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-key")
	t.Setenv("JWT_ACCESS_EXPIRY", "not-a-number")

	_, err := LoadJWTConfig()
	if err == nil {
		t.Fatal("expected error for invalid JWT_ACCESS_EXPIRY")
	}
}

func TestLoadJWTConfig_InvalidRefreshExpiry(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-key")
	t.Setenv("JWT_REFRESH_EXPIRY", "not-a-number")

	_, err := LoadJWTConfig()
	if err == nil {
		t.Fatal("expected error for invalid JWT_REFRESH_EXPIRY")
	}
}

func TestLoadCORSConfig_WithMultipleOrigins(t *testing.T) {
	t.Setenv("ALLOWED_ORIGIN", "https://roamble.app, http://localhost:5173")

	cfg, err := LoadCORSConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(cfg.AllowedOrigins) != 2 {
		t.Fatalf("expected 2 origins, got %d", len(cfg.AllowedOrigins))
	}
	if cfg.AllowedOrigins[0] != "https://roamble.app" {
		t.Errorf("unexpected first origin: %s", cfg.AllowedOrigins[0])
	}
	if cfg.AllowedOrigins[1] != "http://localhost:5173" {
		t.Errorf("unexpected second origin: %s", cfg.AllowedOrigins[1])
	}
}

func TestLoadCORSConfig_MissingOrigin(t *testing.T) {
	t.Setenv("ALLOWED_ORIGIN", "")

	_, err := LoadCORSConfig()
	if err == nil {
		t.Fatal("expected error when ALLOWED_ORIGIN is not set")
	}
}

func TestLoadServerConfig_WithRequiredPort(t *testing.T) {
	t.Setenv("PORT", "8000")
	t.Setenv("ENVIRONMENT", "production")

	cfg, err := LoadServerConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Port != "8000" {
		t.Errorf("expected port 8000, got %s", cfg.Port)
	}
	if cfg.Environment != "production" {
		t.Errorf("expected environment production, got %s", cfg.Environment)
	}
}

func TestLoadServerConfig_MissingPort(t *testing.T) {
	t.Setenv("PORT", "")

	_, err := LoadServerConfig()
	if err == nil {
		t.Fatal("expected error when PORT is not set")
	}
}
