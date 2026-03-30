// send-push は本番環境向けのアドホックPush通知送信スクリプト。
// スケジューラーが対応していない任意文面の通知を全購読ユーザーに送信する。
// 開発用エンドポイント（/api/dev/notifications/trigger）が本番に存在しないための代替手段。
//
// 使い方:
//
//	MYSQL_USER=... MYSQL_PASSWORD=... \
//	VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=... \
//	go run ./cmd/send-push/main.go \
//	  -title "プッシュ通知、届いてる？" \
//	  -body  "Roamble通知機能のテストだよ！" \
//	  -url   "/settings/notifications"
package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/Hiru-ge/roamble/config"
	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
)

func main() {
	title := flag.String("title", "", "通知タイトル（必須）")
	body := flag.String("body", "", "通知本文（必須）")
	url := flag.String("url", "/home", "タップ時の遷移先URL")
	dryRun := flag.Bool("dry-run", false, "送信せず対象ユーザー数だけ表示する")
	flag.Parse()

	if *title == "" || *body == "" {
		fmt.Fprintln(os.Stderr, "エラー: -title と -body は必須です")
		flag.Usage()
		os.Exit(1)
	}

	// DB接続
	db, err := database.Init()
	if err != nil {
		log.Fatalf("DB接続失敗: %v", err)
	}

	// 対象ユーザー（push_subscriptions が存在し push_enabled=true のユーザー）を取得
	var userIDs []uint64
	err = db.Model(&models.PushSubscription{}).
		Joins("JOIN notification_settings ns ON ns.user_id = push_subscriptions.user_id").
		Where("ns.push_enabled = ?", true).
		Distinct("push_subscriptions.user_id").
		Pluck("push_subscriptions.user_id", &userIDs).Error
	if err != nil {
		log.Fatalf("対象ユーザー取得失敗: %v", err)
	}

	fmt.Printf("対象ユーザー数: %d 人\n", len(userIDs))

	if *dryRun {
		fmt.Println("--dry-run モード: 送信をスキップします")
		return
	}

	// Push送信
	notificationCfg := config.LoadNotificationConfig()
	if !notificationCfg.IsPushConfigComplete() {
		log.Fatal("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT が未設定です")
	}

	pushSvc := services.NewPushService(db, notificationCfg.VAPIDPublicKey, notificationCfg.VAPIDPrivateKey, notificationCfg.VAPIDSubject)
	payload := services.PushPayload{
		Title: *title,
		Body:  *body,
		URL:   *url,
	}

	successCount := 0
	for _, userID := range userIDs {
		if err := pushSvc.SendToUser(userID, payload); err != nil {
			log.Printf("送信失敗 userID=%d: %v", userID, err)
			continue
		}
		successCount++
	}

	fmt.Printf("送信完了: %d / %d 人\n", successCount, len(userIDs))
}
