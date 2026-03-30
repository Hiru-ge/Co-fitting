package services

import (
	webpush "github.com/SherClockHolmes/webpush-go"
	"gorm.io/gorm"
)

// NewPushServiceWithClient はテスト用にHTTPClientを注入できる PushService を返す
func NewPushServiceWithClient(db *gorm.DB, publicKey, privateKey, subject string, client webpush.HTTPClient) *PushService {
	return &PushService{
		db:              db,
		vapidPublicKey:  publicKey,
		vapidPrivateKey: privateKey,
		vapidSubject:    subject,
		httpClient:      client,
	}
}

// NotificationSchedulerEntryCount はテスト用に登録済みジョブ数を返す
func NotificationSchedulerEntryCount(s *NotificationScheduler) int {
	return len(s.cron.Entries())
}
