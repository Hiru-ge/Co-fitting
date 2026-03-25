package services

import (
	"bytes"
	"fmt"
	"html/template"

	"github.com/Hiru-ge/roamble/templates"
	"github.com/resend/resend-go/v2"
)

const emailAssetBaseURL = "https://roamble.app/assets/email"

// EmailService はResend APIを通じてメール送信を行うサービス
type EmailService struct {
	client      *resend.Client
	fromAddress string
	tmpl        *template.Template
}

// BadgeItem はメール内のバッジ表示データ
type BadgeItem struct {
	Name    string
	IconURL string
}

// WeeklySummaryData は週次サマリーメールのテンプレートデータ
type WeeklySummaryData struct {
	UserName   string
	VisitCount int
	TotalXP    int
	NewBadges  []BadgeItem
	AssetBase  string
}

// MonthlySummaryData は月次サマリーメールのテンプレートデータ
type MonthlySummaryData struct {
	UserName   string
	VisitCount int
	TotalXP    int
	NewBadges  []BadgeItem
	AssetBase  string
	Month      string // 例: "2026年3月"
}

// badgeIconMap はバッジ名からメール用アイコンファイル名へのマッピング
var badgeIconMap = map[string]string{
	"最初の一歩": "badge-footprint.svg",
	"コンフォートゾーン・ブレイカー": "badge-rocket.svg",
	"ジャンルコレクター Lv.1":  "badge-bookmark.svg",
	"ジャンルコレクター Lv.2":  "badge-bookmark.svg",
	"ジャンルコレクター Lv.3":  "badge-bookmark.svg",
	"ストリークマスター Lv.1":  "badge-fire.svg",
	"ストリークマスター Lv.2":  "badge-fire.svg",
	"ストリークマスター Lv.3":  "badge-fire.svg",
	"エリアパイオニア":        "badge-explore.svg",
	"ナイトウォーカー":        "badge-moon.svg",
	"ウィークエンドウォリアー":    "badge-weekend.svg",
}

// BadgeItemsFromNames はバッジ名スライスをBadgeItemスライスに変換する
func BadgeItemsFromNames(names []string) []BadgeItem {
	items := make([]BadgeItem, len(names))
	for i, name := range names {
		icon := "badge-default.svg"
		if mapped, ok := badgeIconMap[name]; ok {
			icon = mapped
		}
		items[i] = BadgeItem{
			Name:    name,
			IconURL: emailAssetBaseURL + "/" + icon,
		}
	}
	return items
}

// streakReminderData はストリークリマインダーメールのテンプレートデータ
type streakReminderData struct {
	UserName    string
	StreakWeeks int
	AssetBase   string
}

// NewEmailService は EmailService を初期化して返す
func NewEmailService(apiKey, from string) *EmailService {
	tmpl, err := template.ParseFS(templates.EmailFS, "email/*.html")
	if err != nil {
		panic(fmt.Sprintf("email: failed to parse templates: %v", err))
	}
	return &EmailService{
		client:      resend.NewClient(apiKey),
		fromAddress: from,
		tmpl:        tmpl,
	}
}

// BuildStreakReminderEmail はストリークリマインダーメールのHTMLを返す
func (s *EmailService) BuildStreakReminderEmail(userName string, streakWeeks int) (string, error) {
	data := streakReminderData{
		UserName:    userName,
		StreakWeeks: streakWeeks,
		AssetBase:   emailAssetBaseURL,
	}
	var buf bytes.Buffer
	if err := s.tmpl.ExecuteTemplate(&buf, "streak_reminder.html", data); err != nil {
		return "", fmt.Errorf("email: streak reminder template: %w", err)
	}
	return buf.String(), nil
}

// isEmptySummary は訪問件数がゼロかどうかを返す
func isEmptySummary(visitCount int) bool {
	return visitCount == 0
}

// BuildWeeklySummaryEmail は週次サマリーメールのHTMLを返す
// 訪問件数がゼロの場合は空状態専用テンプレートを使用する
func (s *EmailService) BuildWeeklySummaryEmail(data WeeklySummaryData) (string, error) {
	data.AssetBase = emailAssetBaseURL
	tmplName := "weekly_summary.html"
	if isEmptySummary(data.VisitCount) {
		tmplName = "weekly_summary_empty.html"
	}
	var buf bytes.Buffer
	if err := s.tmpl.ExecuteTemplate(&buf, tmplName, data); err != nil {
		return "", fmt.Errorf("email: weekly summary template: %w", err)
	}
	return buf.String(), nil
}

// BuildMonthlySummaryEmail は月次サマリーメールのHTMLを返す
// 訪問件数がゼロの場合は空状態専用テンプレートを使用する
func (s *EmailService) BuildMonthlySummaryEmail(data MonthlySummaryData) (string, error) {
	data.AssetBase = emailAssetBaseURL
	tmplName := "monthly_summary.html"
	if isEmptySummary(data.VisitCount) {
		tmplName = "monthly_summary_empty.html"
	}
	var buf bytes.Buffer
	if err := s.tmpl.ExecuteTemplate(&buf, tmplName, data); err != nil {
		return "", fmt.Errorf("email: monthly summary template: %w", err)
	}
	return buf.String(), nil
}

// SendStreakReminder はストリークリマインダーメールを送信する
func (s *EmailService) SendStreakReminder(toEmail, userName string, streakWeeks int) error {
	html, err := s.BuildStreakReminderEmail(userName, streakWeeks)
	if err != nil {
		return err
	}
	params := &resend.SendEmailRequest{
		From:    s.fromAddress,
		To:      []string{toEmail},
		Subject: "【Roamble】ストリークが切れちゃうよ!",
		Html:    html,
	}
	_, err = s.client.Emails.Send(params)
	return err
}

// SendWeeklySummary は週次サマリーメールを送信する
func (s *EmailService) SendWeeklySummary(toEmail string, data WeeklySummaryData) error {
	html, err := s.BuildWeeklySummaryEmail(data)
	if err != nil {
		return err
	}
	params := &resend.SendEmailRequest{
		From:    s.fromAddress,
		To:      []string{toEmail},
		Subject: "【Roamble】今週の冒険まとめ",
		Html:    html,
	}
	_, err = s.client.Emails.Send(params)
	return err
}

// SendMonthlySummary は月次サマリーメールを送信する
func (s *EmailService) SendMonthlySummary(toEmail string, data MonthlySummaryData) error {
	html, err := s.BuildMonthlySummaryEmail(data)
	if err != nil {
		return err
	}
	params := &resend.SendEmailRequest{
		From:    s.fromAddress,
		To:      []string{toEmail},
		Subject: fmt.Sprintf("【Roamble】%sの冒険まとめ", data.Month),
		Html:    html,
	}
	_, err = s.client.Emails.Send(params)
	return err
}
