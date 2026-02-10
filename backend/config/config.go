package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

func LoadJWTConfig() (*JWTConfig, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return nil, errors.New("JWT_SECRET is required")
	}

	accessExpiry, err := parseDurationMinutes("JWT_ACCESS_EXPIRY", 15)
	if err != nil {
		return nil, err
	}

	refreshExpiry, err := parseDurationMinutes("JWT_REFRESH_EXPIRY", 10080)
	if err != nil {
		return nil, err
	}

	return &JWTConfig{
		Secret:        secret,
		AccessExpiry:  accessExpiry,
		RefreshExpiry: refreshExpiry,
	}, nil
}

func parseDurationMinutes(envKey string, defaultMinutes int) (time.Duration, error) {
	val := os.Getenv(envKey)
	if val == "" {
		return time.Duration(defaultMinutes) * time.Minute, nil
	}

	minutes, err := strconv.Atoi(val)
	if err != nil {
		return 0, fmt.Errorf("invalid %s: %w", envKey, err)
	}

	return time.Duration(minutes) * time.Minute, nil
}
