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
	UserID          uint64    `gorm:"primaryKey" json:"user_id"`
	PushEnabled     bool      `gorm:"default:true" json:"push_enabled"`
	EmailEnabled    bool      `gorm:"default:true" json:"email_enabled"`
	DailySuggestion bool      `gorm:"default:true" json:"daily_suggestion"`
	WeeklySummary   bool      `gorm:"default:true" json:"weekly_summary"`
	MonthlySummary  bool      `gorm:"default:true" json:"monthly_summary"`
	StreakReminder  bool      `gorm:"default:true" json:"streak_reminder"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	User *User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func (NotificationSettings) TableName() string {
	return "notification_settings"
}
