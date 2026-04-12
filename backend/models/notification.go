package models

import "time"

// PushSubscription はWebプッシュ購読情報を表す（1ユーザー複数デバイス対応）。
type PushSubscription struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	UserID    uint64    `gorm:"not null;index" json:"user_id"`
	Endpoint  string    `gorm:"type:varchar(500);uniqueIndex" json:"endpoint"`
	P256DH    string    `gorm:"type:varchar(255)" json:"p256dh"`
	Auth      string    `gorm:"type:varchar(255)" json:"auth"`
	UserAgent string    `gorm:"type:varchar(500)" json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`

	User *User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func (PushSubscription) TableName() string {
	return "push_subscriptions"
}

// NotificationSettings はユーザーごとの通知設定を表す。
type NotificationSettings struct {
	UserID                   uint64    `gorm:"primaryKey" json:"user_id"`
	IsPushEnabled            bool      `gorm:"column:push_enabled;default:true" json:"is_push_enabled"`
	IsEmailEnabled           bool      `gorm:"column:email_enabled;default:true" json:"is_email_enabled"`
	IsDailySuggestionEnabled bool      `gorm:"column:daily_suggestion;default:true" json:"is_daily_suggestion_enabled"`
	IsWeeklySummaryEnabled   bool      `gorm:"column:weekly_summary;default:true" json:"is_weekly_summary_enabled"`
	IsMonthlySummaryEnabled  bool      `gorm:"column:monthly_summary;default:true" json:"is_monthly_summary_enabled"`
	IsStreakReminderEnabled  bool      `gorm:"column:streak_reminder;default:true" json:"is_streak_reminder_enabled"`
	UpdatedAt                time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	User *User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func (NotificationSettings) TableName() string {
	return "notification_settings"
}
