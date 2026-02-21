package models

import "time"

// User represents a user in the system
type User struct {
	ID           uint64     `gorm:"primaryKey" json:"id"`
	Email        string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string     `gorm:"not null" json:"-"`
	DisplayName  string     `gorm:"not null" json:"display_name"`
	AvatarURL    *string    `json:"avatar_url"`
	Level        int        `gorm:"default:1;not null" json:"level"`
	TotalXP      int        `gorm:"default:0;not null" json:"total_xp"`
	StreakCount  int        `gorm:"default:0;not null" json:"streak_count"`
	StreakLast   *time.Time `json:"streak_last"`
	SettingsJSON *string    `gorm:"type:json" json:"settings_json"`
	CreatedAt    time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	Visits []Visit `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

// TableName specifies the table name for User model
func (User) TableName() string {
	return "users"
}

// Visit represents a place visit record for a user
type Visit struct {
	ID            uint64    `gorm:"primaryKey" json:"id"`
	UserID        uint64    `gorm:"not null;index:idx_user_visited" json:"user_id"`
	PlaceID       string    `gorm:"not null" json:"place_id"`
	PlaceName     string    `gorm:"not null" json:"place_name"`
	Vicinity      string    `gorm:"type:varchar(255)" json:"vicinity"`
	Category      string    `gorm:"type:varchar(100)" json:"category"`
	Latitude      float64   `gorm:"column:lat;type:decimal(10,8)" json:"lat"`
	Longitude     float64   `gorm:"column:lng;type:decimal(11,8)" json:"lng"`
	GenreTagID    *uint64   `gorm:"index" json:"genre_tag_id"`
	Rating        *float32  `json:"rating"`
	Memo          *string   `json:"memo"`
	XpEarned      int       `gorm:"default:0;not null" json:"xp_earned"`
	IsComfortZone bool      `gorm:"default:false" json:"is_comfort_zone"`
	VisitedAt     time.Time `gorm:"not null;index:idx_user_visited" json:"visited_at"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	User     *User     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	GenreTag *GenreTag `gorm:"foreignKey:GenreTagID;constraint:OnDelete:SET NULL" json:"-"`
}

// TableName specifies the table name for Visit model
func (Visit) TableName() string {
	return "visit_history"
}
