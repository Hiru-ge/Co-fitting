package services

import (
	"bytes"
	"fmt"
	"html/template"

	"github.com/Hiru-ge/roamble/templates"
	"github.com/resend/resend-go/v2"
)

const emailAssetBaseURL = "https://roamble.app/assets/email"

type EmailService struct {
	client      *resend.Client
	fromAddress string
	tmpl        *template.Template
}

type BadgeItem struct {
	Name    string
	IconURL string
}

type WeeklySummaryData struct {
	UserName   string
	VisitCount int
	TotalXP    int
	NewBadges  []BadgeItem
	AssetBase  string
}

type MonthlySummaryData struct {
	UserName   string
	VisitCount int
	TotalXP    int
	NewBadges  []BadgeItem
	AssetBase  string
	YearMonth  string
}

var badgeIconMap = map[string]string{
	"最初の一歩":          "badge-footprint.svg",
	"ジャンル開拓者":        "badge-rocket.svg",
	"ジャンルコレクター Lv.1": "badge-bookmark.svg",
	"ジャンルコレクター Lv.2": "badge-bookmark.svg",
	"ジャンルコレクター Lv.3": "badge-bookmark.svg",
	"ストリークマスター Lv.1": "badge-fire.svg",
	"ストリークマスター Lv.2": "badge-fire.svg",
	"ストリークマスター Lv.3": "badge-fire.svg",
	"エリアパイオニア":       "badge-explore.svg",
	"ナイトウォーカー":       "badge-moon.svg",
	"ウィークエンドウォリアー":   "badge-weekend.svg",
}

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

type streakReminderData struct {
	UserName    string
	StreakWeeks int
	AssetBase   string
}

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

func isEmptySummary(visitCount int) bool {
	return visitCount == 0
}

func (s *EmailService) BuildWeeklySummaryHTML(data WeeklySummaryData) (string, error) {
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

func (s *EmailService) BuildMonthlySummaryHTML(data MonthlySummaryData) (string, error) {
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

func (s *EmailService) SendWeeklySummary(toEmail string, data WeeklySummaryData) error {
	html, err := s.BuildWeeklySummaryHTML(data)
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

func (s *EmailService) SendMonthlySummary(toEmail string, data MonthlySummaryData) error {
	html, err := s.BuildMonthlySummaryHTML(data)
	if err != nil {
		return err
	}
	params := &resend.SendEmailRequest{
		From:    s.fromAddress,
		To:      []string{toEmail},
		Subject: fmt.Sprintf("【Roamble】%sの冒険まとめ", data.YearMonth),
		Html:    html,
	}
	_, err = s.client.Emails.Send(params)
	return err
}
