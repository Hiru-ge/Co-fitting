package utils

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

func AddTokenToBlacklist(ctx context.Context, client *redis.Client, token string, ttl time.Duration) error {
	if ttl <= 0 {
		return nil // 既に有効期限切れのトークンはブラックリストに登録する必要がない
	}

	key := fmt.Sprintf("blacklist:%s", token)
	return client.Set(ctx, key, "1", ttl).Err()
}

func IsTokenBlacklisted(ctx context.Context, client *redis.Client, token string) (bool, error) {
	key := fmt.Sprintf("blacklist:%s", token)
	count, err := client.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return count > 0, nil
}