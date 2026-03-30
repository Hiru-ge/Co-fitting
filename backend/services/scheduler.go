package services

import (
	"fmt"
	"log"
	"time"

	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

// PushSender はプッシュ通知送信の抽象インターフェース
type PushSender interface {
	SendToUser(userID uint64, payload PushPayload) error
}

// EmailSender はメール送信の抽象インターフェース
type EmailSender interface {
	SendStreakReminder(toEmail, userName string, streakWeeks int) error
	SendWeeklySummary(toEmail string, data WeeklySummaryData) error
	SendMonthlySummary(toEmail string, data MonthlySummaryData) error
}

// NotificationScheduler は通知スケジューラーを表す
type NotificationScheduler struct {
	cron  *cron.Cron
	push  PushSender
	email EmailSender
	db    *gorm.DB
}

// NewNotificationScheduler は NotificationScheduler を初期化して返す
func NewNotificationScheduler(push PushSender, email EmailSender, db *gorm.DB) *NotificationScheduler {
	c := cron.New(cron.WithLocation(utils.JST))
	return &NotificationScheduler{
		cron:  c,
		push:  push,
		email: email,
		db:    db,
	}
}

// Start は4つの通知ジョブを登録してスケジューラーを起動する
func (s *NotificationScheduler) Start() {
	// デイリーサジェスション: 毎朝7時 JST
	s.cron.AddFunc("0 7 * * *", func() { //nolint:errcheck
		s.RunDailySuggestionNotification()
	})
	// ストリークリマインダー: 毎週日曜7時 JST（今週未訪問で「今日行かないとストリーク切れる」ユーザーに送信）
	s.cron.AddFunc("0 7 * * 0", func() { //nolint:errcheck
		s.RunStreakReminderNotification()
	})
	// 週次サマリー: 毎週月曜朝10時 JST
	s.cron.AddFunc("0 10 * * 1", func() { //nolint:errcheck
		s.RunWeeklySummaryNotification()
	})
	// 月次サマリー: 毎月1日朝10時 JST
	s.cron.AddFunc("0 10 1 * *", func() { //nolint:errcheck
		s.RunMonthlySummaryNotification()
	})
	s.cron.Start()
}

// Stop はスケジューラーを停止する
func (s *NotificationScheduler) Stop() {
	s.cron.Stop()
}

// EntryCount は登録済みジョブ数を返す
func (s *NotificationScheduler) EntryCount() int {
	return len(s.cron.Entries())
}

// RunDailySuggestionNotification はPush購読ユーザー全員にデイリーサジェスション通知を送信する
func (s *NotificationScheduler) RunDailySuggestionNotification() {
	userIDs, err := fetchDailySuggestionTargetUserIDs(s.db)
	if err != nil {
		log.Printf("scheduler: daily suggestion: fetch targets: %v", err)
		return
	}

	payload := PushPayload{
		Title: "提案カードがリフレッシュされたよ！",
		Body:  "Roambleをのぞいてみて。新しい冒険があなたを待ってる！",
		URL:   "/home",
	}

	for _, userID := range userIDs {
		if err := s.push.SendToUser(userID, payload); err != nil {
			log.Printf("scheduler: daily suggestion: send to user %d: %v", userID, err)
		}
	}
}

// RunStreakReminderNotification は今週未訪問（streak_last が今週月曜より前）かつ streak_count > 0 のユーザーにリマインダーを送信する
func (s *NotificationScheduler) RunStreakReminderNotification() {
	targets, err := fetchStreakReminderTargets(s.db)
	if err != nil {
		log.Printf("scheduler: streak reminder: fetch targets: %v", err)
		return
	}

	pushPayload := PushPayload{
		Title: "ストリークが切れちゃうよ！",
		Body:  "今日中に新しい場所を訪れてストリークをつなごう",
		URL:   "/home",
	}

	for _, target := range targets {
		if target.PushEnabled && target.StreakReminder {
			if err := s.push.SendToUser(target.UserID, pushPayload); err != nil {
				log.Printf("scheduler: streak reminder: push to user %d: %v", target.UserID, err)
			}
		}
		if s.email != nil && target.EmailEnabled && target.StreakReminder && target.Email != "" {
			if err := s.email.SendStreakReminder(target.Email, target.DisplayName, target.StreakCount); err != nil {
				log.Printf("scheduler: streak reminder: email to user %d: %v", target.UserID, err)
			}
		}
	}
}

// RunWeeklySummaryNotification は週次サマリー設定ONのユーザー全員にサマリーを送信する。
// 集計対象は常に先週（lastWeekStart()）の範囲。本番スケジューラー（月曜10時）では正しく動作する。
func (s *NotificationScheduler) RunWeeklySummaryNotification() {
	targets, err := fetchWeeklySummaryTargets(s.db)
	if err != nil {
		log.Printf("scheduler: weekly summary: fetch targets: %v", err)
		return
	}

	weekStart := lastWeekStart()
	weekEnd := weekStart.AddDate(0, 0, 7)

	for _, target := range targets {
		data, err := buildWeeklySummaryData(s.db, target, weekStart, weekEnd)
		if err != nil {
			log.Printf("scheduler: weekly summary: build data for user %d: %v", target.UserID, err)
			continue
		}

		if s.push != nil && target.PushEnabled && target.WeeklySummary {
			payload := PushPayload{
				Title: "先週のサマリーが届いてるよ！",
				Body:  "あなたの冒険を振り返ってみよう",
				URL:   "/summary/weekly",
			}
			if err := s.push.SendToUser(target.UserID, payload); err != nil {
				log.Printf("scheduler: weekly summary: push to user %d: %v", target.UserID, err)
			}
		}

		if s.email != nil && target.EmailEnabled && target.WeeklySummary && target.Email != "" {
			if err := s.email.SendWeeklySummary(target.Email, data); err != nil {
				log.Printf("scheduler: weekly summary: email to user %d: %v", target.UserID, err)
			}
		}
	}
}

// RunMonthlySummaryNotification は月次サマリー設定ONのユーザー全員にサマリーを送信する。
// 集計対象は常に前月の範囲。本番スケジューラー（毎月1日10時）では正しく動作する。
func (s *NotificationScheduler) RunMonthlySummaryNotification() {
	targets, err := fetchMonthlySummaryTargets(s.db)
	if err != nil {
		log.Printf("scheduler: monthly summary: fetch targets: %v", err)
		return
	}

	now := time.Now().In(utils.JST)
	// 前月の範囲を計算
	lastMonth := now.AddDate(0, -1, 0)
	monthStart := time.Date(lastMonth.Year(), lastMonth.Month(), 1, 0, 0, 0, 0, utils.JST)
	monthEnd := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, utils.JST)
	monthLabel := fmt.Sprintf("%d年%d月", lastMonth.Year(), int(lastMonth.Month()))

	for _, target := range targets {
		data, err := buildMonthlySummaryData(s.db, target, monthStart, monthEnd, monthLabel)
		if err != nil {
			log.Printf("scheduler: monthly summary: build data for user %d: %v", target.UserID, err)
			continue
		}

		if s.push != nil && target.PushEnabled && target.MonthlySummary {
			payload := PushPayload{
				Title: fmt.Sprintf("%sのサマリーが届いてるよ！", monthLabel),
				Body:  "あなたの冒険を振り返ってみよう",
				URL:   "/summary/monthly",
			}
			if err := s.push.SendToUser(target.UserID, payload); err != nil {
				log.Printf("scheduler: monthly summary: push to user %d: %v", target.UserID, err)
			}
		}

		if s.email != nil && target.EmailEnabled && target.MonthlySummary && target.Email != "" {
			if err := s.email.SendMonthlySummary(target.Email, data); err != nil {
				log.Printf("scheduler: monthly summary: email to user %d: %v", target.UserID, err)
			}
		}
	}
}

// --- リポジトリ関数 ---

// fetchDailySuggestionTargetUserIDs はデイリーサジェスション通知対象ユーザーIDを返す
// 条件: push_subscriptions に1件以上あり、通知設定で push_enabled=true かつ daily_suggestion=true
func fetchDailySuggestionTargetUserIDs(db *gorm.DB) ([]uint64, error) {
	var userIDs []uint64
	err := db.Model(&models.PushSubscription{}).
		Joins("JOIN notification_settings ns ON ns.user_id = push_subscriptions.user_id").
		Where("ns.push_enabled = ? AND ns.daily_suggestion = ?", true, true).
		Distinct("push_subscriptions.user_id").
		Pluck("push_subscriptions.user_id", &userIDs).Error
	return userIDs, err
}

// notificationTarget はストリーク/サマリー通知のターゲットユーザー情報を表す
type notificationTarget struct {
	UserID         uint64
	Email          string
	DisplayName    string
	StreakCount    int
	PushEnabled    bool
	EmailEnabled   bool
	StreakReminder bool
	WeeklySummary  bool
	MonthlySummary bool
}

// fetchStreakReminderTargets はストリークリマインダー対象ユーザーを返す
// 条件: streak_count > 0、streak_last が今週月曜より前（今週未訪問）、streak_reminder=true
func fetchStreakReminderTargets(db *gorm.DB) ([]notificationTarget, error) {
	// JST基準で今週月曜0時を算出（これより前が「今週未訪問」）
	thisWeekMonday := weekStart(time.Now())

	type row struct {
		UserID         uint64
		Email          string
		DisplayName    string
		StreakCount    int
		PushEnabled    bool
		EmailEnabled   bool
		StreakReminder bool
	}
	var rows []row

	err := db.Table("users u").
		Select("u.id AS user_id, u.email, u.display_name, u.streak_count, "+
			"ns.push_enabled, ns.email_enabled, ns.streak_reminder").
		Joins("JOIN notification_settings ns ON ns.user_id = u.id").
		Where("u.streak_count > 0 AND ns.streak_reminder = ?", true).
		Where("u.streak_last < ?", thisWeekMonday).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	targets := make([]notificationTarget, len(rows))
	for i, r := range rows {
		targets[i] = notificationTarget{
			UserID:         r.UserID,
			Email:          r.Email,
			DisplayName:    r.DisplayName,
			StreakCount:    r.StreakCount,
			PushEnabled:    r.PushEnabled,
			EmailEnabled:   r.EmailEnabled,
			StreakReminder: r.StreakReminder,
		}
	}
	return targets, nil
}

// fetchWeeklySummaryTargets は週次サマリー通知対象ユーザーを返す
func fetchWeeklySummaryTargets(db *gorm.DB) ([]notificationTarget, error) {
	return fetchSummaryTargets(db, "weekly_summary")
}

// fetchMonthlySummaryTargets は月次サマリー通知対象ユーザーを返す
func fetchMonthlySummaryTargets(db *gorm.DB) ([]notificationTarget, error) {
	return fetchSummaryTargets(db, "monthly_summary")
}

// fetchSummaryTargets はサマリー通知対象ユーザーを返す汎用関数
func fetchSummaryTargets(db *gorm.DB, settingColumn string) ([]notificationTarget, error) {
	type row struct {
		UserID         uint64
		Email          string
		DisplayName    string
		PushEnabled    bool
		EmailEnabled   bool
		WeeklySummary  bool
		MonthlySummary bool
	}
	var rows []row

	err := db.Table("users u").
		Select("u.id AS user_id, u.email, u.display_name, "+
			"ns.push_enabled, ns.email_enabled, ns.weekly_summary, ns.monthly_summary").
		Joins("JOIN notification_settings ns ON ns.user_id = u.id").
		Where(fmt.Sprintf("ns.%s = ?", settingColumn), true).
		Where("(ns.push_enabled = ? OR ns.email_enabled = ?)", true, true).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	targets := make([]notificationTarget, len(rows))
	for i, r := range rows {
		targets[i] = notificationTarget{
			UserID:         r.UserID,
			Email:          r.Email,
			DisplayName:    r.DisplayName,
			PushEnabled:    r.PushEnabled,
			EmailEnabled:   r.EmailEnabled,
			WeeklySummary:  r.WeeklySummary,
			MonthlySummary: r.MonthlySummary,
		}
	}
	return targets, nil
}

// buildWeeklySummaryData は週次サマリーのメールデータを構築する
func buildWeeklySummaryData(db *gorm.DB, target notificationTarget, weekStart, weekEnd time.Time) (WeeklySummaryData, error) {
	var visits []models.Visit
	if err := db.Where("user_id = ? AND visited_at >= ? AND visited_at < ?", target.UserID, weekStart, weekEnd).
		Find(&visits).Error; err != nil {
		return WeeklySummaryData{}, err
	}

	totalXP := 0
	for _, v := range visits {
		totalXP += v.XpEarned
	}

	var newBadgeNames []string
	var badges []models.UserBadge
	if err := db.Preload("Badge").
		Where("user_id = ? AND earned_at >= ? AND earned_at < ?", target.UserID, weekStart, weekEnd).
		Find(&badges).Error; err == nil {
		for _, ub := range badges {
			if ub.Badge != nil {
				newBadgeNames = append(newBadgeNames, ub.Badge.Name)
			}
		}
	}

	return WeeklySummaryData{
		UserName:   target.DisplayName,
		VisitCount: len(visits),
		TotalXP:    totalXP,
		NewBadges:  BadgeItemsFromNames(newBadgeNames),
	}, nil
}

// buildMonthlySummaryData は月次サマリーのメールデータを構築する
func buildMonthlySummaryData(db *gorm.DB, target notificationTarget, monthStart, monthEnd time.Time, monthLabel string) (MonthlySummaryData, error) {
	var visits []models.Visit
	if err := db.Where("user_id = ? AND visited_at >= ? AND visited_at < ?", target.UserID, monthStart, monthEnd).
		Find(&visits).Error; err != nil {
		return MonthlySummaryData{}, err
	}

	totalXP := 0
	for _, v := range visits {
		totalXP += v.XpEarned
	}

	var newBadgeNames []string
	var badges []models.UserBadge
	if err := db.Preload("Badge").
		Where("user_id = ? AND earned_at >= ? AND earned_at < ?", target.UserID, monthStart, monthEnd).
		Find(&badges).Error; err == nil {
		for _, ub := range badges {
			if ub.Badge != nil {
				newBadgeNames = append(newBadgeNames, ub.Badge.Name)
			}
		}
	}

	return MonthlySummaryData{
		UserName:   target.DisplayName,
		VisitCount: len(visits),
		TotalXP:    totalXP,
		NewBadges:  BadgeItemsFromNames(newBadgeNames),
		Month:      monthLabel,
	}, nil
}

// lastWeekStart は先週の月曜日（JST 0:00）を返す
func lastWeekStart() time.Time {
	thisMonday := weekStart(time.Now())
	return thisMonday.AddDate(0, 0, -7)
}
