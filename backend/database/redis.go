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
// フォーマット: suggestion:daily:{userID}:{date}:{lat}_{lng}
func DailySuggestionCacheKey(userID string, date string, lat, lng float64) string {
	return fmt.Sprintf("suggestion:daily:%s:%s:%.2f_%.2f", userID, date, lat, lng)
}

// GetDailySuggestions は日次提案キャッシュを取得する
// キャッシュミスの場合は空文字列を返す
func GetDailySuggestions(ctx context.Context, client *redis.Client, userID string, date string, lat, lng float64) (string, error) {
	key := DailySuggestionCacheKey(userID, date, lat, lng)
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
func SetDailySuggestions(ctx context.Context, client *redis.Client, userID string, date string, lat, lng float64, data string, ttl time.Duration) error {
	key := DailySuggestionCacheKey(userID, date, lat, lng)
	return client.Set(ctx, key, data, ttl).Err()
}

// ClearDailySuggestionsCache は指定ユーザーの日次提案リストキャッシュを全て削除する
// 注意: 日次カウントキー（suggestion:count:*）は削除しない
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

// --- 日次提案上限到達フラグ ---
// 上限到達フラグはリストキャッシュ(「suggest:daily:*」)とは独立したキーで管理される。
// 「ClearDailySuggestionsCache」でリストキャッシュが削除されてもこのフラグは消えない。
// これにより、「全提案を訪問後に興味タグを変更」しても当日の提案権利が復活しない。

// DailyLimitReachedKey は日次提案上限到達フラグのキーを生成する
// フォーマット: suggestion:count:{userID}:{date}
func DailyLimitReachedKey(userID string, date string) string {
	return fmt.Sprintf("suggestion:count:%s:%s", userID, date)
}

// IsDailyLimitReached は当日の提案上限に達しているかを返す
// フラグが無ければ false を返す
func IsDailyLimitReached(ctx context.Context, client *redis.Client, userID string, date string) (bool, error) {
	key := DailyLimitReachedKey(userID, date)
	_, err := client.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check daily limit: %w", err)
	}
	return true, nil
}

// SetDailyLimitReached は当日の提案上限到達を記録する
func SetDailyLimitReached(ctx context.Context, client *redis.Client, userID string, date string, ttl time.Duration) error {
	key := DailyLimitReachedKey(userID, date)
	return client.Set(ctx, key, 1, ttl).Err()
}
