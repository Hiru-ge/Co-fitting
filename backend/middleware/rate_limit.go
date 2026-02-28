package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// windowEntry は固定ウィンドウのカウンタと期限を保持する。
type windowEntry struct {
	mu       sync.Mutex
	count    int
	windowAt time.Time
}

// RateLimiter は IP アドレス単位の固定ウィンドウレートリミッターを保持する。
// ベータ版〜小規模利用を想定したインメモリ実装。
// 本番スケールアウト時は Redis ベースの実装へ移行すること。
type RateLimiter struct {
	mu       sync.Mutex
	entries  map[string]*windowEntry
	limit    int
	window   time.Duration
	lastGC   time.Time
}

// NewRateLimiter は指定した固定ウィンドウ内の上限リクエスト数でレートリミッターを生成する。
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		entries: make(map[string]*windowEntry),
		limit:   limit,
		window:  window,
		lastGC:  time.Now(),
	}
}

func (rl *RateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	entry, ok := rl.entries[ip]
	if !ok {
		entry = &windowEntry{}
		rl.entries[ip] = entry
	}
	rl.gcIfNeeded()
	rl.mu.Unlock()

	entry.mu.Lock()
	defer entry.mu.Unlock()

	now := time.Now()
	if now.After(entry.windowAt.Add(rl.window)) {
		entry.count = 0
		entry.windowAt = now
	}

	if entry.count >= rl.limit {
		return false
	}
	entry.count++
	return true
}

// gcIfNeeded は古い IP エントリを定期的に削除する（メモリリーク防止）。
// rl.mu を保持している状態で呼ぶこと。
func (rl *RateLimiter) gcIfNeeded() {
	if time.Since(rl.lastGC) < 5*time.Minute {
		return
	}
	threshold := time.Now().Add(-rl.window * 2)
	for ip, e := range rl.entries {
		e.mu.Lock()
		expired := e.windowAt.Before(threshold)
		e.mu.Unlock()
		if expired {
			delete(rl.entries, ip)
		}
	}
	rl.lastGC = time.Now()
}

// RateLimit は指定された RateLimiter を使う Gin ミドルウェアを返す。
// X-Forwarded-For ヘッダーが存在する場合はそれをクライアント IP として使用する。
func RateLimit(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !rl.allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "リクエストが多すぎます。しばらく待ってから再試行してください",
				"code":  "RATE_LIMIT_EXCEEDED",
			})
			return
		}
		c.Next()
	}
}
