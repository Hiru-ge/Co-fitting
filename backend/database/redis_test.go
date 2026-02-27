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

		// user1のキャッシュを2つ作成（日付違い）
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

func cleanupAllSuggestionKeys(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	var cursor uint64
	for {
		keys, nextCursor, err := testRedisClient.Scan(ctx, cursor, "suggestion:*", 100).Result()
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

func TestDailyLimitReachedKey(t *testing.T) {
	t.Run("上限到達フラグキーが正しいフォーマットで生成される", func(t *testing.T) {
		key := DailyLimitReachedKey("123", "2026-02-26")
		expected := "suggestion:count:123:2026-02-26"
		if key != expected {
			t.Errorf("Expected key '%s', got '%s'", expected, key)
		}
	})

	t.Run("異なるユーザーIDで異なるキーが生成される", func(t *testing.T) {
		key1 := DailyLimitReachedKey("user1", "2026-02-26")
		key2 := DailyLimitReachedKey("user2", "2026-02-26")
		if key1 == key2 {
			t.Errorf("Expected different keys for different users, got same: '%s'", key1)
		}
	})
}

func TestIsDailyLimitReachedAndSet(t *testing.T) {
	t.Run("SetDailyLimitReached後にIsDailyLimitReachedがtrueを返す", func(t *testing.T) {
		cleanupAllSuggestionKeys(t)
		ctx := context.Background()

		err := SetDailyLimitReached(ctx, testRedisClient, "user1", "2026-02-26", 24*time.Hour)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		reached, err := IsDailyLimitReached(ctx, testRedisClient, "user1", "2026-02-26")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if !reached {
			t.Error("Expected IsDailyLimitReached to return true after SetDailyLimitReached")
		}
	})

	t.Run("未設定の場合はfalseが返る", func(t *testing.T) {
		cleanupAllSuggestionKeys(t)
		ctx := context.Background()

		reached, err := IsDailyLimitReached(ctx, testRedisClient, "userX", "2026-02-26")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if reached {
			t.Error("Expected IsDailyLimitReached to return false for missing key")
		}
	})
}

func TestClearDailySuggestionsCacheDoesNotClearLimitReached(t *testing.T) {
	t.Run("ClearDailySuggestionsCacheは上限到達フラグを削除しない", func(t *testing.T) {
		cleanupAllSuggestionKeys(t)
		ctx := context.Background()

		// リストキャッシュと上限到達フラグを両方設定する
		listKey := DailySuggestionCacheKey("user1", "2026-02-26", 35.68, 139.65)
		testRedisClient.Set(ctx, listKey, `[{"place_id":"p1"}]`, 24*time.Hour)

		err := SetDailyLimitReached(ctx, testRedisClient, "user1", "2026-02-26", 24*time.Hour)
		if err != nil {
			t.Fatalf("Failed to set limit reached: %v", err)
		}

		// リストキャッシュを削除
		_, err = ClearDailySuggestionsCache(ctx, testRedisClient, "user1")
		if err != nil {
			t.Fatalf("Unexpected error from ClearDailySuggestionsCache: %v", err)
		}

		// リストキャッシュが削除されていることを確認
		_, listErr := testRedisClient.Get(ctx, listKey).Result()
		if listErr != redis.Nil {
			t.Error("Expected list cache to be deleted")
		}

		// 上限到達フラグは残っていることを確認
		reached, err := IsDailyLimitReached(ctx, testRedisClient, "user1", "2026-02-26")
		if err != nil {
			t.Fatalf("Unexpected error getting limit reached flag: %v", err)
		}
		if !reached {
			t.Error("Expected daily limit reached flag to survive ClearDailySuggestionsCache")
		}
	})
}

// === 日次リロードカウントのテスト ===

func TestDailyReloadCountKey(t *testing.T) {
	t.Run("リロードカウントキーが正しいフォーマットで生成される", func(t *testing.T) {
		key := DailyReloadCountKey("123", "2026-02-27")
		expected := "suggestion:reload:123:2026-02-27"
		if key != expected {
			t.Errorf("Expected key '%s', got '%s'", expected, key)
		}
	})

	t.Run("異なるユーザーIDで異なるキーが生成される", func(t *testing.T) {
		key1 := DailyReloadCountKey("user1", "2026-02-27")
		key2 := DailyReloadCountKey("user2", "2026-02-27")
		if key1 == key2 {
			t.Errorf("Expected different keys for different users, got same: '%s'", key1)
		}
	})

	t.Run("異なる日付で異なるキーが生成される", func(t *testing.T) {
		key1 := DailyReloadCountKey("user1", "2026-02-27")
		key2 := DailyReloadCountKey("user1", "2026-02-28")
		if key1 == key2 {
			t.Errorf("Expected different keys for different dates, got same: '%s'", key1)
		}
	})
}

func TestGetDailyReloadCount(t *testing.T) {
	t.Run("未設定時は0を返す", func(t *testing.T) {
		cleanupAllSuggestionKeys(t)
		ctx := context.Background()

		count, err := GetDailyReloadCount(ctx, testRedisClient, "user1", "2026-02-27")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if count != 0 {
			t.Errorf("Expected 0, got %d", count)
		}
	})

	t.Run("設定済みの値を正しく返す", func(t *testing.T) {
		cleanupAllSuggestionKeys(t)
		ctx := context.Background()

		key := DailyReloadCountKey("user1", "2026-02-27")
		testRedisClient.Set(ctx, key, 2, 24*time.Hour)

		count, err := GetDailyReloadCount(ctx, testRedisClient, "user1", "2026-02-27")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if count != 2 {
			t.Errorf("Expected 2, got %d", count)
		}
	})
}

func TestIncrementDailyReloadCount(t *testing.T) {
	t.Run("初回インクリメントで1を返す", func(t *testing.T) {
		cleanupAllSuggestionKeys(t)
		ctx := context.Background()

		count, err := IncrementDailyReloadCount(ctx, testRedisClient, "user1", "2026-02-27", 24*time.Hour)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected 1, got %d", count)
		}
	})

	t.Run("連続インクリメントでカウントが増加する", func(t *testing.T) {
		cleanupAllSuggestionKeys(t)
		ctx := context.Background()

		for i := 1; i <= 3; i++ {
			count, err := IncrementDailyReloadCount(ctx, testRedisClient, "user1", "2026-02-27", 24*time.Hour)
			if err != nil {
				t.Fatalf("Increment %d: Unexpected error: %v", i, err)
			}
			if count != i {
				t.Errorf("Increment %d: Expected %d, got %d", i, i, count)
			}
		}
	})

	t.Run("TTLが正しく設定される", func(t *testing.T) {
		cleanupAllSuggestionKeys(t)
		ctx := context.Background()

		_, err := IncrementDailyReloadCount(ctx, testRedisClient, "user1", "2026-02-27", 24*time.Hour)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		key := DailyReloadCountKey("user1", "2026-02-27")
		ttl, err := testRedisClient.TTL(ctx, key).Result()
		if err != nil {
			t.Fatalf("Failed to get TTL: %v", err)
		}
		if ttl < 23*time.Hour {
			t.Errorf("Expected TTL > 23h, got %v", ttl)
		}
	})

	t.Run("ClearDailySuggestionsCacheはリロードカウントを削除しない", func(t *testing.T) {
		cleanupAllSuggestionKeys(t)
		ctx := context.Background()

		// リロードカウントとリストキャッシュを両方設定
		_, err := IncrementDailyReloadCount(ctx, testRedisClient, "user1", "2026-02-27", 24*time.Hour)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		listKey := DailySuggestionCacheKey("user1", "2026-02-27", 35.68, 139.65)
		testRedisClient.Set(ctx, listKey, `[{"place_id":"p1"}]`, 24*time.Hour)

		// リストキャッシュを削除
		_, err = ClearDailySuggestionsCache(ctx, testRedisClient, "user1")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// リロードカウントは残っている
		count, err := GetDailyReloadCount(ctx, testRedisClient, "user1", "2026-02-27")
		if err != nil {
			t.Fatalf("Failed to get reload count: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected reload count 1 to survive cache clear, got %d", count)
		}
	})
}
