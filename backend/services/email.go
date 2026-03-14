package services

import (
	"bytes"
	"fmt"
	"html/template"

	"github.com/Hiru-ge/roamble/templates"
	"github.com/resend/resend-go/v2"
)

// EmailService はResend APIを通じてメール送信を行うサービス
type EmailService struct {
	client      *resend.Client
	fromAddress string
	tmpl        *template.Template
}

// WeeklySummaryData は週次サマリーメールのテンプレートデータ
type WeeklySummaryData struct {
	UserName   string
	VisitCount int
	TotalXP    int
	NewBadges  []string
}

// MonthlySummaryData は月次サマリーメールのテンプレートデータ
type MonthlySummaryData struct {
	UserName   string
	VisitCount int
	TotalXP    int
	NewBadges  []string
	Month      string // 例: "2026年3月"
}

// streakReminderData はストリークリマインダーメールのテンプレートデータ
type streakReminderData struct {
	UserName    string
	StreakWeeks int
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
