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
	if redisCfg.UseTLS {
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

// DeleteKeysByPattern は指定パターンにマッチするRedisキーをSCAN+DELで一括削除し、削除件数を返す
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

// ScanKeysByPattern は指定パターンにマッチするRedisキーを全て収集して返す
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

// GenerateDailySuggestionCacheKey は日次提案キャッシュのキーを生成する
// フォーマット: suggestion:daily:{userID}:{date}:{lat}_{lng}
func GenerateDailySuggestionCacheKey(userID string, date string, lat, lng float64) string {
	return fmt.Sprintf("suggestion:daily:%s:%s:%.2f_%.2f", userID, date, lat, lng)
}

// GetDailySuggestions は日次提案キャッシュを取得する
// キャッシュミスの場合は空文字列を返す
func GetDailySuggestions(ctx context.Context, client *redis.Client, userID string, date string, lat, lng float64) (string, error) {
	key := GenerateDailySuggestionCacheKey(userID, date, lat, lng)
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
	key := GenerateDailySuggestionCacheKey(userID, date, lat, lng)
	return client.Set(ctx, key, data, ttl).Err()
}

// ClearDailySuggestionsCache は指定ユーザーの日次提案リストキャッシュを全て削除する
// 注意: 日次カウントキー（suggestion:count:*）は削除しない
func ClearDailySuggestionsCache(ctx context.Context, client *redis.Client, userID string) (int64, error) {
	pattern := fmt.Sprintf("suggestion:daily:%s:*", userID)
	return DeleteKeysByPattern(ctx, client, pattern)
}

// 上限到達フラグはリストキャッシュ(「suggest:daily:*」)とは独立したキーで管理される。
// 「ClearDailySuggestionsCache」でリストキャッシュが削除されてもこのフラグは消えない。
// これにより、「全提案を訪問後に興味タグを変更」しても当日の提案権利が復活しない。

// GenerateDailyLimitReachedKey は日次提案上限到達フラグのキーを生成する
// フォーマット: suggestion:count:{userID}:{date}
func GenerateDailyLimitReachedKey(userID string, date string) string {
	return fmt.Sprintf("suggestion:count:%s:%s", userID, date)
}

// IsDailyLimitReached は当日の提案上限に達しているかを返す
// フラグが無ければ false を返す
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

// SetDailyLimitReached は当日の提案上限到達を記録する
func SetDailyLimitReached(ctx context.Context, client *redis.Client, userID string, date string, ttl time.Duration) error {
	key := GenerateDailyLimitReachedKey(userID, date)
	return client.Set(ctx, key, 1, ttl).Err()
}

// リロード回数は提案リストキャッシュ・上限到達フラグとは独立して管理される。
// キーフォーマット: suggestion:reload:{userID}:{date}

// MaxDailyReloads は1日あたりのリロード上限回数
const MaxDailyReloads = 3

// GenerateDailyReloadCountKey は日次リロードカウントのキーを生成する
func GenerateDailyReloadCountKey(userID string, date string) string {
	return fmt.Sprintf("suggestion:reload:%s:%s", userID, date)
}

// GetDailyReloadCount は当日のリロード回数を返す
// キーが未設定の場合は 0 を返す
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

// IncrementDailyReloadCount は当日のリロードカウントを1増やし、新しいカウントを返す
// キーが存在しない場合は1からスタート（TTL設定あり）
func IncrementDailyReloadCount(ctx context.Context, client *redis.Client, userID string, date string, ttl time.Duration) (int, error) {
	key := GenerateDailyReloadCountKey(userID, date)
	newCount, err := client.Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to increment daily reload count: %w", err)
	}
	// 初回インクリメント時にTTLを設定
	if newCount == 1 {
		client.Expire(ctx, key, ttl)
	}
	return int(newCount), nil
}
