package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type DatabaseConfig struct {
	User     string
	Password string
	Host     string
	Port     string
	Name     string
	TLSMode  string
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	UseTLS   bool
}

type CORSConfig struct {
	AllowedOrigins []string
}

type ServerConfig struct {
	Port        string
	Environment string
}

type GoogleConfig struct {
	OAuthClientID string
	PlacesAPIKey  string
}

type NotificationConfig struct {
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string
	ResendAPIKey    string
	EmailFrom       string
}

func (c NotificationConfig) IsPushConfigComplete() bool {
	return c.VAPIDPublicKey != "" && c.VAPIDPrivateKey != "" && c.VAPIDSubject != ""
}

func (c NotificationConfig) IsEmailConfigComplete() bool {
	return c.ResendAPIKey != "" && c.EmailFrom != ""
}

type BetaConfig struct {
	Passphrase string
}

type AppConfig struct {
	JWT          *JWTConfig
	Database     *DatabaseConfig
	Redis        *RedisConfig
	CORS         *CORSConfig
	Server       *ServerConfig
	Google       *GoogleConfig
	Notification *NotificationConfig
	Beta         *BetaConfig
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

func parseBoolEnv(envKey string, defaultValue bool) (bool, error) {
	val := strings.TrimSpace(os.Getenv(envKey))
	if val == "" {
		return defaultValue, nil
	}

	parsed, err := strconv.ParseBool(val)
	if err != nil {
		return false, fmt.Errorf("invalid %s: %w", envKey, err)
	}

	return parsed, nil
}

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

func LoadDatabaseConfig() (*DatabaseConfig, error) {
	user := os.Getenv("MYSQL_USER")
	password := os.Getenv("MYSQL_PASSWORD")
	host := os.Getenv("MYSQL_HOST")
	port := os.Getenv("MYSQL_PORT")
	name := os.Getenv("MYSQL_DATABASE")

	if user == "" || password == "" || host == "" || name == "" {
		return nil, errors.New("MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_DATABASE are required")
	}

	if port == "" {
		port = "3306"
	}

	return &DatabaseConfig{
		User:     user,
		Password: password,
		Host:     host,
		Port:     port,
		Name:     name,
		TLSMode:  os.Getenv("MYSQL_TLS"),
	}, nil
}

func LoadRedisConfig() (*RedisConfig, error) {
	host := os.Getenv("REDIS_HOST")
	if host == "" {
		host = "redis"
	}

	port := os.Getenv("REDIS_PORT")
	if port == "" {
		port = "6379"
	}

	useTLS, err := parseBoolEnv("REDIS_TLS", false)
	if err != nil {
		return nil, err
	}

	return &RedisConfig{
		Host:     host,
		Port:     port,
		Password: os.Getenv("REDIS_PASSWORD"),
		UseTLS:   useTLS,
	}, nil
}

func LoadCORSConfig() (*CORSConfig, error) {
	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	if allowedOrigin == "" {
		return nil, errors.New("ALLOWED_ORIGIN is required")
	}

	rawOrigins := strings.Split(allowedOrigin, ",")
	origins := make([]string, 0, len(rawOrigins))
	for _, origin := range rawOrigins {
		trimmed := strings.TrimSpace(origin)
		if trimmed == "" {
			return nil, errors.New("ALLOWED_ORIGIN contains empty origin")
		}
		origins = append(origins, trimmed)
	}

	return &CORSConfig{AllowedOrigins: origins}, nil
}

func LoadServerConfig() (*ServerConfig, error) {
	port := os.Getenv("PORT")
	if port == "" {
		return nil, errors.New("PORT is required")
	}

	environment := os.Getenv("ENVIRONMENT")
	if environment == "" {
		environment = "development"
	}

	return &ServerConfig{Port: port, Environment: environment}, nil
}

func LoadGoogleConfig() *GoogleConfig {
	return &GoogleConfig{
		OAuthClientID: os.Getenv("GOOGLE_OAUTH_CLIENT_ID"),
		PlacesAPIKey:  os.Getenv("GOOGLE_PLACES_API_KEY"),
	}
}

func LoadNotificationConfig() *NotificationConfig {
	return &NotificationConfig{
		VAPIDPublicKey:  os.Getenv("VAPID_PUBLIC_KEY"),
		VAPIDPrivateKey: os.Getenv("VAPID_PRIVATE_KEY"),
		VAPIDSubject:    os.Getenv("VAPID_SUBJECT"),
		ResendAPIKey:    os.Getenv("RESEND_API_KEY"),
		EmailFrom:       os.Getenv("NOTIFICATION_EMAIL_FROM"),
	}
}

func LoadBetaConfig() *BetaConfig {
	return &BetaConfig{Passphrase: os.Getenv("BETA_PASSPHRASE")}
}

func LoadAppConfig() (*AppConfig, error) {
	jwtCfg, err := LoadJWTConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load JWT config: %w", err)
	}

	dbCfg, err := LoadDatabaseConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load database config: %w", err)
	}

	redisCfg, err := LoadRedisConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load redis config: %w", err)
	}

	corsCfg, err := LoadCORSConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load CORS config: %w", err)
	}

	serverCfg, err := LoadServerConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load server config: %w", err)
	}

	return &AppConfig{
		JWT:          jwtCfg,
		Database:     dbCfg,
		Redis:        redisCfg,
		CORS:         corsCfg,
		Server:       serverCfg,
		Google:       LoadGoogleConfig(),
		Notification: LoadNotificationConfig(),
		Beta:         LoadBetaConfig(),
	}, nil
}
