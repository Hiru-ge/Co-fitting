package utils

import (
	"context"
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/testutil"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
)

var testRedisClient *redis.Client

func setupBlacklistTest(t *testing.T) {
	testutil.LoadTestEnv()

	testRedisClient = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1, // テスト用DB
	})

	// Redis が利用可能かテスト
	if _, err := testRedisClient.Ping(context.Background()).Result(); err != nil {
		testRedisClient = nil
		t.Skip("Redis not available for blacklist tests")
		return
	}

	// テストデータをクリア
	testRedisClient.FlushDB(context.Background())
}

func TestAddTokenToBlacklist(t *testing.T) {
	setupBlacklistTest(t)
	if testRedisClient == nil {
		return
	}

	ctx := context.Background()

	t.Run("有効なトークンをブラックリストに追加", func(t *testing.T) {
		token := "test-token-123"
		ttl := 1 * time.Hour

		err := AddTokenToBlacklist(ctx, testRedisClient, token, ttl)
		assert.NoError(t, err)

		// トークンがブラックリスト化されているか確認
		exists := testRedisClient.Exists(ctx, "blacklist:test-token-123").Val()
		assert.Equal(t, int64(1), exists)
	})

	t.Run("TTLが0以下の場合はブラックリストに追加しない", func(t *testing.T) {
		token := "expired-token"
		ttl := -1 * time.Hour

		err := AddTokenToBlacklist(ctx, testRedisClient, token, ttl)
		assert.NoError(t, err)

		// トークンがブラックリスト化されていないか確認
		exists := testRedisClient.Exists(ctx, "blacklist:expired-token").Val()
		assert.Equal(t, int64(0), exists)
	})

	t.Run("TTLが正しく設定される", func(t *testing.T) {
		token := "ttl-test-token"
		ttl := 10 * time.Second

		err := AddTokenToBlacklist(ctx, testRedisClient, token, ttl)
		assert.NoError(t, err)

		// TTLが設定されているか確認
		remainingTTL := testRedisClient.TTL(ctx, "blacklist:ttl-test-token").Val()
		assert.True(t, remainingTTL > 0 && remainingTTL <= ttl)
	})
}

func TestIsTokenBlacklisted(t *testing.T) {
	setupBlacklistTest(t)
	if testRedisClient == nil {
		return
	}

	ctx := context.Background()

	t.Run("ブラックリスト化されたトークンはtrueを返す", func(t *testing.T) {
		token := "blacklisted-token"

		// まずブラックリストに追加
		err := AddTokenToBlacklist(ctx, testRedisClient, token, 1*time.Hour)
		assert.NoError(t, err)

		// ブラックリストチェック
		isBlacklisted, err := IsTokenBlacklisted(ctx, testRedisClient, token)
		assert.NoError(t, err)
		assert.True(t, isBlacklisted)
	})

	t.Run("ブラックリスト化されていないトークンはfalseを返す", func(t *testing.T) {
		token := "clean-token"

		// ブラックリストチェック
		isBlacklisted, err := IsTokenBlacklisted(ctx, testRedisClient, token)
		assert.NoError(t, err)
		assert.False(t, isBlacklisted)
	})
}
