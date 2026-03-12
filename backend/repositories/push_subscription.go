package repositories

import (
	"github.com/Hiru-ge/roamble/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// UpsertPushSubscription はPush購読をUpsertする。
// 新規登録の場合は true、既存レコードの更新の場合は false を返す。
// MySQL の ON DUPLICATE KEY UPDATE は INSERT=1行、UPDATE=2行を返す。
func UpsertPushSubscription(db *gorm.DB, userID uint64, endpoint, p256dh, auth, userAgent string) (isNew bool, err error) {
	sub := models.PushSubscription{
		UserID:    userID,
		Endpoint:  endpoint,
		P256DH:    p256dh,
		Auth:      auth,
		UserAgent: userAgent,
	}

	result := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "endpoint"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id", "p256_dh", "auth", "user_agent"}),
	}).Create(&sub)
	if result.Error != nil {
		return false, result.Error
	}

	// MySQL: INSERT → RowsAffected=1, ON DUPLICATE KEY UPDATE → RowsAffected=2
	return result.RowsAffected == 1, nil
}
