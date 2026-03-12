package services

import (
	webpush "github.com/SherClockHolmes/webpush-go"
	"gorm.io/gorm"
)

// NewPushServiceWithClient はテスト用にHTTPClientを注入できる PushService を返す
func NewPushServiceWithClient(db *gorm.DB, publicKey, privateKey, subject string, client webpush.HTTPClient) *PushService {
	return newPushServiceWithClient(db, publicKey, privateKey, subject, client)
}
