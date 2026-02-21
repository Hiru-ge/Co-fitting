package models

import "time"

// GenreTag represents a facility genre master (施設ジャンルマスタ)
type GenreTag struct {
	ID       uint64 `gorm:"primaryKey" json:"id"`
	Name     string `gorm:"type:varchar(100);not null;uniqueIndex" json:"name"`
	Category string `gorm:"type:varchar(100);not null" json:"category"`
	Icon     string `gorm:"type:varchar(100);not null;default:''" json:"icon"`
}

// TableName specifies the table name for GenreTag model
func (GenreTag) TableName() string {
	return "genre_tags"
}

// UserInterest represents a user's selected interest genre tags
type UserInterest struct {
	ID         uint64    `gorm:"primaryKey" json:"id"`
	UserID     uint64    `gorm:"not null;uniqueIndex:idx_user_interest" json:"user_id"`
	GenreTagID uint64    `gorm:"not null;uniqueIndex:idx_user_interest" json:"genre_tag_id"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	User     *User     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	GenreTag *GenreTag `gorm:"foreignKey:GenreTagID;constraint:OnDelete:CASCADE" json:"-"`
}

// TableName specifies the table name for UserInterest model
func (UserInterest) TableName() string {
	return "user_interests"
}

// GenreProficiency represents a user's XP and level per genre
type GenreProficiency struct {
	ID         uint64 `gorm:"primaryKey" json:"id"`
	UserID     uint64 `gorm:"not null;uniqueIndex:idx_user_genre_prof" json:"user_id"`
	GenreTagID uint64 `gorm:"not null;uniqueIndex:idx_user_genre_prof" json:"genre_tag_id"`
	XP         int    `gorm:"default:0;not null" json:"xp"`
	Level      int    `gorm:"default:1;not null" json:"level"`

	// Relations
	User     *User     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	GenreTag *GenreTag `gorm:"foreignKey:GenreTagID;constraint:OnDelete:CASCADE" json:"-"`
}

// TableName specifies the table name for GenreProficiency model
func (GenreProficiency) TableName() string {
	return "genre_proficiency"
}

// Badge represents a badge master definition
type Badge struct {
	ID            uint64 `gorm:"primaryKey" json:"id"`
	Name          string `gorm:"type:varchar(100);not null;uniqueIndex" json:"name"`
	Description   string `gorm:"type:varchar(500);not null" json:"description"`
	IconURL       string `gorm:"type:varchar(500);not null;default:''" json:"icon_url"`
	ConditionJSON string `gorm:"type:json;not null" json:"condition_json"`
}

// TableName specifies the table name for Badge model
func (Badge) TableName() string {
	return "badges"
}

// UserBadge represents a badge earned by a user
type UserBadge struct {
	ID       uint64    `gorm:"primaryKey" json:"id"`
	UserID   uint64    `gorm:"not null;uniqueIndex:idx_user_badge" json:"user_id"`
	BadgeID  uint64    `gorm:"not null;uniqueIndex:idx_user_badge" json:"badge_id"`
	EarnedAt time.Time `gorm:"not null" json:"earned_at"`

	// Relations
	User  *User  `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Badge *Badge `gorm:"foreignKey:BadgeID;constraint:OnDelete:CASCADE" json:"-"`
}

// TableName specifies the table name for UserBadge model
func (UserBadge) TableName() string {
	return "user_badges"
}
