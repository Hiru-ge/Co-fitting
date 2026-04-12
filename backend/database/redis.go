package database

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"github.com/Hiru-ge/roamble/config"
	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client

func InitRedis() (*redis.Client, error) {
	redisCfg, err := config.LoadRedisConfig()
	if err != nil {
		return nil, err
	}

	opts := &redis.Options{
		Addr:     fmt.Sprintf("%s:%s", redisCfg.Host, redisCfg.Port),
		Password: redisCfg.Password,
	}
	if redisCfg.IsUsingTLS {
		opts.TLSConfig = &tls.Config{}
	}
	client := redis.NewClient(opts)

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

func DeleteKeysByPattern(ctx context.Context, client *redis.Client, pattern string) (int64, error) {
	var deletedCount int64
	var cursor uint64
	for {
		keys, nextCursor, err := client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return deletedCount, fmt.Errorf("failed to scan keys for pattern %q: %w", pattern, err)
		}
		if len(keys) > 0 {
			deleted, err := client.Del(ctx, keys...).Result()
			if err != nil {
				return deletedCount, fmt.Errorf("failed to delete keys for pattern %q: %w", pattern, err)
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

func ScanKeysByPattern(ctx context.Context, client *redis.Client, pattern string) ([]string, error) {
	var allKeys []string
	var cursor uint64
	for {
		keys, nextCursor, err := client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, fmt.Errorf("failed to scan keys for pattern %q: %w", pattern, err)
		}
		allKeys = append(allKeys, keys...)
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return allKeys, nil
}

func GenerateDailySuggestionCacheKey(userID string, date string) string {
	return fmt.Sprintf("suggestion:daily:%s:%s", userID, date)
}

func GetDailySuggestions(ctx context.Context, client *redis.Client, userID string, date string) (string, error) {
	key := GenerateDailySuggestionCacheKey(userID, date)
	result, err := client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("failed to get daily suggestions cache: %w", err)
	}
	return result, nil
}

func SetDailySuggestions(ctx context.Context, client *redis.Client, userID string, date string, data string, ttl time.Duration) error {
	key := GenerateDailySuggestionCacheKey(userID, date)
	return client.Set(ctx, key, data, ttl).Err()
}

func ClearDailySuggestionsCache(ctx context.Context, client *redis.Client, userID string) (int64, error) {
	pattern := fmt.Sprintf("suggestion:daily:%s:*", userID)
	return DeleteKeysByPattern(ctx, client, pattern)
}

// 上限到達フラグはリストキャッシュ(「suggest:daily:*」)とは独立したキーで管理される。
// 「ClearDailySuggestionsCache」でリストキャッシュが削除されてもこのフラグは消えない。
// これにより、「全提案を訪問後に興味タグを変更」しても当日の提案権利が復活しない。

func GenerateDailyLimitReachedKey(userID string, date string) string {
	return fmt.Sprintf("suggestion:count:%s:%s", userID, date)
}

func IsDailyLimitReached(ctx context.Context, client *redis.Client, userID string, date string) (bool, error) {
	key := GenerateDailyLimitReachedKey(userID, date)
	_, err := client.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check daily limit: %w", err)
	}
	return true, nil
}

func SetDailyLimitReached(ctx context.Context, client *redis.Client, userID string, date string, ttl time.Duration) error {
	key := GenerateDailyLimitReachedKey(userID, date)
	return client.Set(ctx, key, 1, ttl).Err()
}

// リロード回数は提案リストキャッシュ・上限到達フラグとは独立して管理される。
// キーフォーマット: suggestion:reload:{userID}:{date}

const MaxDailyReloads = 3

func GenerateDailyReloadCountKey(userID string, date string) string {
	return fmt.Sprintf("suggestion:reload:%s:%s", userID, date)
}

func GetDailyReloadCount(ctx context.Context, client *redis.Client, userID string, date string) (int, error) {
	key := GenerateDailyReloadCountKey(userID, date)
	result, err := client.Get(ctx, key).Int()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get daily reload count: %w", err)
	}
	return result, nil
}

func IncrementDailyReloadCount(ctx context.Context, client *redis.Client, userID string, date string, ttl time.Duration) (int, error) {
	key := GenerateDailyReloadCountKey(userID, date)
	newCount, err := client.Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to increment daily reload count: %w", err)
	}
	if newCount == 1 {
		client.Expire(ctx, key, ttl)
	}
	return int(newCount), nil
}
