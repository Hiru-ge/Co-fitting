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
