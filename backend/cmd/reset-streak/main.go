// reset-streak は本番環境向けのアドホックストリークリセットスクリプト。
// 当週（月曜0時JST）未訪問かつ streak_count > 0 のユーザーを一括で streak_count = 0 にリセットする。
// 通常は日曜0時のcronジョブ（ResetExpiredStreaks）が自動実行するが、
// cronが走る前に手動でリセットしたい場合に使用する。
//
// 使い方:
//
//	MYSQL_HOST=... MYSQL_USER=... MYSQL_PASSWORD=... MYSQL_DATABASE=... MYSQL_PORT=4000 \
//	go run ./cmd/reset-streak/main.go
//
//	# 実行前に対象ユーザー数だけ確認する場合
//	... go run ./cmd/reset-streak/main.go --dry-run
package main

import (
	"flag"
	"fmt"
	"log"
	"time"

	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/utils"
)

func weekStart(t time.Time) time.Time {
	t = t.In(utils.JST)
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	monday := t.AddDate(0, 0, -(weekday - 1))
	return time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, utils.JST)
}

func main() {
	dryRun := flag.Bool("dry-run", false, "リセットせず対象ユーザー数だけ表示する")
	flag.Parse()

	db, err := database.Init()
	if err != nil {
		log.Fatalf("DB接続失敗: %v", err)
	}

	thisWeekMonday := weekStart(time.Now())
	fmt.Printf("当週開始（JST）: %s\n", thisWeekMonday.Format("2006-01-02 15:04:05"))

	var targets []models.User
	if err := db.
		Where("streak_count > 0 AND streak_last < ?", thisWeekMonday).
		Find(&targets).Error; err != nil {
		log.Fatalf("対象ユーザー取得失敗: %v", err)
	}

	fmt.Printf("リセット対象ユーザー数: %d 人\n", len(targets))

	if *dryRun {
		fmt.Println("--dry-run モード: リセットをスキップします")
		for _, u := range targets {
			fmt.Printf("  userID=%d streak_count=%d streak_last=%v\n", u.ID, u.StreakCount, u.StreakLast)
		}
		return
	}

	result := db.Model(&models.User{}).
		Where("streak_count > 0 AND streak_last < ?", thisWeekMonday).
		Update("streak_count", 0)
	if result.Error != nil {
		log.Fatalf("リセット失敗: %v", result.Error)
	}

	fmt.Printf("リセット完了: %d 人\n", result.RowsAffected)
}
