package database

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

var testRedisClient *redis.Client

func TestMain(m *testing.M) {
	// テスト用Redisに接続（localhost）
	host := os.Getenv("REDIS_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("REDIS_PORT")
	if port == "" {
		port = "6379"
	}

	testRedisClient = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", host, port),
	})

	if err := testRedisClient.Ping(context.Background()).Err(); err != nil {
		fmt.Printf("Redis not available: %v\n", err)
		os.Exit(1)
	}

	code := m.Run()

	testRedisClient.Close()
	os.Exit(code)
}

func cleanupDailySuggestionKeys(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	var cursor uint64
	for {
		keys, nextCursor, err := testRedisClient.Scan(ctx, cursor, "suggestion:daily:*", 100).Result()
		if err != nil {
			break
		}
		if len(keys) > 0 {
			testRedisClient.Del(ctx, keys...)
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
}

func TestDailySuggestionCacheKey(t *testing.T) {
	t.Run("キャッシュキーが正しいフォーマットで生成される", func(t *testing.T) {
		key := DailySuggestionCacheKey("123", "2026-02-15", 35.6762, 139.6503)
		expected := "suggestion:daily:123:2026-02-15:35.68_139.65"
		if key != expected {
			t.Errorf("Expected key '%s', got '%s'", expected, key)
		}
	})

	t.Run("異なるユーザーIDで異なるキーが生成される", func(t *testing.T) {
		key1 := DailySuggestionCacheKey("user1", "2026-02-15", 35.68, 139.65)
		key2 := DailySuggestionCacheKey("user2", "2026-02-15", 35.68, 139.65)
		if key1 == key2 {
			t.Errorf("Expected different keys for different users, got same: '%s'", key1)
		}
	})

	t.Run("異なる日付で異なるキーが生成される", func(t *testing.T) {
		key1 := DailySuggestionCacheKey("123", "2026-02-15", 35.68, 139.65)
		key2 := DailySuggestionCacheKey("123", "2026-02-16", 35.68, 139.65)
		if key1 == key2 {
			t.Errorf("Expected different keys for different dates, got same: '%s'", key1)
		}
	})

	t.Run("大きく異なる位置情報で異なるキーが生成される", func(t *testing.T) {
		key1 := DailySuggestionCacheKey("123", "2026-02-15", 35.68, 139.65)
		key2 := DailySuggestionCacheKey("123", "2026-02-15", 36.00, 140.00)
		if key1 == key2 {
			t.Errorf("Expected different keys for different locations, got same: '%s'", key1)
		}
	})
}

func TestGetDailySuggestions(t *testing.T) {
	t.Run("キャッシュミス時は空文字列を返す", func(t *testing.T) {
		cleanupDailySuggestionKeys(t)
		ctx := context.Background()

		result, err := GetDailySuggestions(ctx, testRedisClient, "user1", "2026-02-15", 35.68, 139.65)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if result != "" {
			t.Errorf("Expected empty string for cache miss, got '%s'", result)
		}
	})

	t.Run("キャッシュヒット時はJSON文字列を返す", func(t *testing.T) {
		cleanupDailySuggestionKeys(t)
		ctx := context.Background()

		cachedData := `[{"place_id":"p1","name":"テストカフェ"},{"place_id":"p2","name":"テスト公園"},{"place_id":"p3","name":"テストバー"}]`
		key := DailySuggestionCacheKey("user1", "2026-02-15", 35.68, 139.65)
		testRedisClient.Set(ctx, key, cachedData, 24*time.Hour)

		result, err := GetDailySuggestions(ctx, testRedisClient, "user1", "2026-02-15", 35.68, 139.65)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if result != cachedData {
			t.Errorf("Expected cached data '%s', got '%s'", cachedData, result)
		}
	})
}

func TestSetDailySuggestions(t *testing.T) {
	t.Run("キャッシュに保存して取得できる", func(t *testing.T) {
		cleanupDailySuggestionKeys(t)
		ctx := context.Background()

		data := `[{"place_id":"p1","name":"テストカフェ"}]`
		err := SetDailySuggestions(ctx, testRedisClient, "user1", "2026-02-15", 35.68, 139.65, data, 24*time.Hour)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// 保存されたデータを検証
		key := DailySuggestionCacheKey("user1", "2026-02-15", 35.68, 139.65)
		result, err := testRedisClient.Get(ctx, key).Result()
		if err != nil {
			t.Fatalf("Failed to get cached data: %v", err)
		}
		if result != data {
			t.Errorf("Expected '%s', got '%s'", data, result)
		}
	})

	t.Run("TTLが正しく設定される", func(t *testing.T) {
		cleanupDailySuggestionKeys(t)
		ctx := context.Background()

		data := `[{"place_id":"p1"}]`
		ttl := 24 * time.Hour
		err := SetDailySuggestions(ctx, testRedisClient, "user1", "2026-02-15", 35.68, 139.65, data, ttl)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		key := DailySuggestionCacheKey("user1", "2026-02-15", 35.68, 139.65)
		remainingTTL, err := testRedisClient.TTL(ctx, key).Result()
		if err != nil {
			t.Fatalf("Failed to get TTL: %v", err)
		}

		// TTLは23時間以上あるはず（テスト実行の遅延を考慮）
		if remainingTTL < 23*time.Hour {
			t.Errorf("Expected TTL > 23h, got %v", remainingTTL)
		}
	})
}

func TestClearDailySuggestionsCache(t *testing.T) {
	t.Run("指定ユーザーのキャッシュのみ削除される", func(t *testing.T) {
		cleanupDailySuggestionKeys(t)
		ctx := context.Background()

		// user1のキャッシュを2つ作成
		key1 := DailySuggestionCacheKey("user1", "2026-02-15", 35.68, 139.65)
		key2 := DailySuggestionCacheKey("user1", "2026-02-14", 35.68, 139.65)
		// user2のキャッシュを1つ作成
		key3 := DailySuggestionCacheKey("user2", "2026-02-15", 35.68, 139.65)

		testRedisClient.Set(ctx, key1, `[{"place_id":"p1"}]`, 24*time.Hour)
		testRedisClient.Set(ctx, key2, `[{"place_id":"p2"}]`, 24*time.Hour)
		testRedisClient.Set(ctx, key3, `[{"place_id":"p3"}]`, 24*time.Hour)

		// user1のキャッシュを削除
		deleted, err := ClearDailySuggestionsCache(ctx, testRedisClient, "user1")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if deleted != 2 {
			t.Errorf("Expected 2 deleted keys, got %d", deleted)
		}

		// user1のキャッシュが削除されていることを確認
		_, err = testRedisClient.Get(ctx, key1).Result()
		if err != redis.Nil {
			t.Error("Expected user1 key1 to be deleted")
		}
		_, err = testRedisClient.Get(ctx, key2).Result()
		if err != redis.Nil {
			t.Error("Expected user1 key2 to be deleted")
		}

		// user2のキャッシュは残っていることを確認
		val, err := testRedisClient.Get(ctx, key3).Result()
		if err != nil {
			t.Errorf("Expected user2 key to remain, got error: %v", err)
		}
		if val != `[{"place_id":"p3"}]` {
			t.Errorf("Expected user2 data to be intact, got '%s'", val)
		}
	})

	t.Run("キャッシュが空でもエラーにならない", func(t *testing.T) {
		cleanupDailySuggestionKeys(t)
		ctx := context.Background()

		deleted, err := ClearDailySuggestionsCache(ctx, testRedisClient, "nonexistent")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if deleted != 0 {
			t.Errorf("Expected 0 deleted keys, got %d", deleted)
		}
	})
}
