package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/Hiru-ge/roamble/models"
	webpush "github.com/SherClockHolmes/webpush-go"
	"gorm.io/gorm"
)

// PushService はWebプッシュ通知の送信を担うサービス
type PushService struct {
	db              *gorm.DB
	vapidPublicKey  string
	vapidPrivateKey string
	vapidSubject    string
	httpClient      webpush.HTTPClient
}

// PushPayload はプッシュ通知のペイロードを表す
type PushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
}

// NewPushService は PushService を初期化して返す
func NewPushService(db *gorm.DB, publicKey, privateKey, subject string) *PushService {
	return &PushService{
		db:              db,
		vapidPublicKey:  publicKey,
		vapidPrivateKey: privateKey,
		vapidSubject:    subject,
		httpClient:      &http.Client{},
	}
}

// cleanupSubscription は期限切れの購読をDBから削除する
func (s *PushService) cleanupSubscription(endpoint string) error {
	return s.db.Where("endpoint = ?", endpoint).Delete(&models.PushSubscription{}).Error
}

// sendOne は1件の購読先にプッシュ通知を送信し、410/404時には購読を削除する
func (s *PushService) sendOne(sub models.PushSubscription, message []byte) error {
	subscription := &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			Auth:   sub.Auth,
			P256dh: sub.P256DH,
		},
	}

	options := &webpush.Options{
		HTTPClient:      s.httpClient,
		Subscriber:      s.vapidSubject,
		VAPIDPublicKey:  s.vapidPublicKey,
		VAPIDPrivateKey: s.vapidPrivateKey,
		TTL:             30,
	}

	resp, err := webpush.SendNotification(message, subscription, options)
	if err != nil {
		return fmt.Errorf("push: send notification: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck

	// 410 Gone または 404 Not Found は購読期限切れを示すため削除する
	if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
		if cleanupErr := s.cleanupSubscription(sub.Endpoint); cleanupErr != nil {
			log.Printf("push: cleanup failed for endpoint %s: %v", sub.Endpoint, cleanupErr)
		}
		return nil
	}

	return nil
}

// SendToUser は指定ユーザーの全購読先に対してプッシュ通知を並行送信する
func (s *PushService) SendToUser(userID uint64, payload PushPayload) error {
	var subs []models.PushSubscription
	if err := s.db.Where("user_id = ?", userID).Find(&subs).Error; err != nil {
		return fmt.Errorf("push: fetch subscriptions: %w", err)
	}

	if len(subs) == 0 {
		return nil
	}

	message, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("push: marshal payload: %w", err)
	}

	var wg sync.WaitGroup
	for _, sub := range subs {
		sub := sub
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := s.sendOne(sub, message); err != nil {
				log.Printf("push: send error for endpoint %s: %v", sub.Endpoint, err)
			}
		}()
	}
	wg.Wait()

	return nil
}
