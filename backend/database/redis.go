package database

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client

func InitRedis() (*redis.Client, error) {
	host := os.Getenv("REDIS_HOST")
	if host == "" {
		host = "redis"
	}
	port := os.Getenv("REDIS_PORT")
	if port == "" {
		port = "6379"
	}

	client := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", host, port),
	})

	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	RedisClient = client
	return client, nil
}

func CloseRedis() error {
	if RedisClient == nil {
		return nil
	}
	return RedisClient.Close()
}

// --- 日次提案キャッシュ ---

// DailySuggestionCacheKey は日次提案キャッシュのキーを生成する
// フォーマット: suggestion:daily:{userID}:{date}:{lat}_{lng} または suggestion:daily:{userID}:{date}:{lat}_{lng}:{mood}
func DailySuggestionCacheKey(userID string, date string, lat, lng float64, mood string) string {
	if mood == "" {
		return fmt.Sprintf("suggestion:daily:%s:%s:%.2f_%.2f", userID, date, lat, lng)
	}
	return fmt.Sprintf("suggestion:daily:%s:%s:%.2f_%.2f:%s", userID, date, lat, lng, mood)
}

// GetDailySuggestions は日次提案キャッシュを取得する
// キャッシュミスの場合は空文字列を返す
func GetDailySuggestions(ctx context.Context, client *redis.Client, userID string, date string, lat, lng float64, mood string) (string, error) {
	key := DailySuggestionCacheKey(userID, date, lat, lng, mood)
	result, err := client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("failed to get daily suggestions cache: %w", err)
	}
	return result, nil
}

// SetDailySuggestions は日次提案キャッシュを保存する
func SetDailySuggestions(ctx context.Context, client *redis.Client, userID string, date string, lat, lng float64, data string, ttl time.Duration, mood string) error {
	key := DailySuggestionCacheKey(userID, date, lat, lng, mood)
	return client.Set(ctx, key, data, ttl).Err()
}

// ClearDailySuggestionsCache は指定ユーザーの日次提案キャッシュを全て削除する
func ClearDailySuggestionsCache(ctx context.Context, client *redis.Client, userID string) (int64, error) {
	pattern := fmt.Sprintf("suggestion:daily:%s:*", userID)
	var deletedCount int64
	var cursor uint64
	for {
		keys, nextCursor, err := client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return 0, fmt.Errorf("failed to scan daily suggestion cache keys: %w", err)
		}
		if len(keys) > 0 {
			deleted, err := client.Del(ctx, keys...).Result()
			if err != nil {
				return deletedCount, fmt.Errorf("failed to delete daily suggestion cache keys: %w", err)
			}
			deletedCount += deleted
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return deletedCount, nil
}
