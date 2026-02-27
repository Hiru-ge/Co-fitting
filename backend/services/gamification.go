package services

import (
	"encoding/json"
	"time"

	"github.com/Hiru-ge/roamble/models"
	"gorm.io/gorm"
)

// XP計算ルール定数
const (
	XPNormalVisit  = 50  // 通常訪問
	XPComfortBreak = 100 // 脱却訪問
	XPFirstGenre   = 50  // 初めてのジャンルボーナス
	XPFirstArea    = 30  // 初めてのエリアボーナス
	XPMemoBonus    = 10  // 感想メモ記入ボーナス
)

// レベルテーブル: インデックスiのレベル(i+1)はthresholds[i]以上で到達
var levelThresholds = []int{0, 100, 300, 600, 1000, 2000, 3000, 4000, 4500, 5000}

// GamificationResult はゲーミフィケーション処理の結果
type GamificationResult struct {
	XPEarned  int
	TotalXP   int
	LevelUp   bool
	NewLevel  int
	NewBadges []models.Badge
}

// badgeCondition はConditionJSONのデコード用
type badgeCondition struct {
	Type      string `json:"type"`
	Threshold int    `json:"threshold"`
}

// CalcXP はXPを計算して返す
// isComfortZone: 興味ジャンル外ならtrue（脱却訪問）
// isFirstGenre: 初めてのジャンル訪問ならtrue
// isFirstArea: 初めてのエリア訪問ならtrue
// hasMemo: 感想メモありならtrue
func CalcXP(isComfortZone bool, isFirstGenre bool, isFirstArea bool, hasMemo bool) int {
	xp := XPNormalVisit
	if isComfortZone {
		xp = XPComfortBreak
	}
	if isFirstGenre {
		xp += XPFirstGenre
	}
	if isFirstArea {
		xp += XPFirstArea
	}
	if hasMemo {
		xp += XPMemoBonus
	}
	return xp
}

// CalcLevel はtotalXPからレベルを算出する（1〜10）
func CalcLevel(totalXP int) int {
	level := 1
	for i, threshold := range levelThresholds {
		if totalXP >= threshold {
			level = i + 1
		}
	}
	return level
}

// calcGenreLevel はジャンル熟練度XPからジャンルレベルを算出する
// ジャンルレベルは1〜5で、100XPごとに1レベルアップ（最大5）
func calcGenreLevel(xp int) int {
	level := xp/100 + 1
	if level > 5 {
		level = 5
	}
	return level
}

// UpdateStreak はストリークを更新する（週次継続判定）
// 同週内の訪問はスキップ、前週なら継続、2週以上空いたらリセット
func UpdateStreak(db *gorm.DB, userID uint64, visitedAt time.Time) error {
	var user models.User
	if err := db.First(&user, userID).Error; err != nil {
		return err
	}

	// 訪問週の月曜日（週の開始）を計算
	visitWeekStart := weekStart(visitedAt)

	if user.StreakLast == nil {
		// 初回訪問
		now := visitedAt
		return db.Model(&user).Updates(map[string]interface{}{
			"streak_count": 1,
			"streak_last":  now,
		}).Error
	}

	lastWeekStart := weekStart(*user.StreakLast)
	diff := visitWeekStart.Sub(lastWeekStart)
	weeks := int(diff.Hours() / (24 * 7))

	switch {
	case weeks == 0:
		// 同週内 → 変化なし
		return nil
	case weeks == 1:
		// 前週から継続 → streak++
		now := visitedAt
		return db.Model(&user).Updates(map[string]interface{}{
			"streak_count": user.StreakCount + 1,
			"streak_last":  now,
		}).Error
	default:
		// 2週以上空いた → リセット
		now := visitedAt
		return db.Model(&user).Updates(map[string]interface{}{
			"streak_count": 1,
			"streak_last":  now,
		}).Error
	}
}

// jst はJSTタイムゾーン
var jst = time.FixedZone("Asia/Tokyo", 9*60*60)

// isNightVisitJST はJST時刻で深夜帯（23:00〜翌5:00未満）かどうかを返す
func isNightVisitJST(t time.Time) bool {
	h := t.In(jst).Hour()
	return h >= 23 || h < 5
}

// isWeekendVisitJST はJST時刻で土曜日または日曜日かどうかを返す
func isWeekendVisitJST(t time.Time) bool {
	w := t.In(jst).Weekday()
	return w == time.Saturday || w == time.Sunday
}

// weekStart は指定時刻が属する週の月曜日（0時0分0秒UTC）を返す
func weekStart(t time.Time) time.Time {
	t = t.UTC()
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7 // Sunday → 7
	}
	monday := t.AddDate(0, 0, -(weekday - 1))
	return time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, time.UTC)
}

// UpdateGenreProficiency はジャンル別熟練度を更新する
// genreTagIDがnilの場合はスキップ
func UpdateGenreProficiency(db *gorm.DB, userID uint64, genreTagID *uint64, xpEarned int) error {
	if genreTagID == nil {
		return nil
	}

	var prof models.GenreProficiency
	result := db.Where("user_id = ? AND genre_tag_id = ?", userID, *genreTagID).First(&prof)

	if result.Error != nil && result.Error == gorm.ErrRecordNotFound {
		// 新規作成
		newXP := xpEarned
		prof = models.GenreProficiency{
			UserID:     userID,
			GenreTagID: *genreTagID,
			XP:         newXP,
			Level:      calcGenreLevel(newXP),
		}
		return db.Create(&prof).Error
	} else if result.Error != nil {
		return result.Error
	}

	// 既存レコードを更新
	newXP := prof.XP + xpEarned
	newLevel := calcGenreLevel(newXP)
	return db.Model(&prof).Updates(map[string]interface{}{
		"xp":    newXP,
		"level": newLevel,
	}).Error
}

// CheckAndAwardBadges はバッジ条件をチェックして未獲得バッジを付与し、新規獲得バッジを返す
// isComfortZone: 今回の訪問が脱却訪問かどうか
// visitCount: 現在の総訪問数（今回の訪問含む）
// visitedAt: 今回の訪問日時
func CheckAndAwardBadges(db *gorm.DB, userID uint64, isComfortZone bool, visitCount int, visitedAt time.Time) ([]models.Badge, error) {
	// 既獲得バッジIDを取得
	var existingBadgeIDs []uint64
	db.Model(&models.UserBadge{}).
		Where("user_id = ?", userID).
		Pluck("badge_id", &existingBadgeIDs)
	existingSet := make(map[uint64]bool, len(existingBadgeIDs))
	for _, id := range existingBadgeIDs {
		existingSet[id] = true
	}

	// 全バッジを取得
	var allBadges []models.Badge
	if err := db.Find(&allBadges).Error; err != nil {
		return nil, err
	}

	// 判定に必要な値を取得
	var user models.User
	if err := db.First(&user, userID).Error; err != nil {
		return nil, err
	}

	// ユニークジャンル数を取得
	var uniqueGenreCount int64
	db.Model(&models.Visit{}).
		Where("user_id = ? AND genre_tag_id IS NOT NULL", userID).
		Distinct("genre_tag_id").
		Count(&uniqueGenreCount)

	// コンフォートゾーン脱却訪問数
	var comfortBreakCount int64
	db.Model(&models.Visit{}).
		Where("user_id = ? AND is_comfort_zone = ?", userID, true).
		Count(&comfortBreakCount)

	// 新規獲得バッジを追加
	var newBadges []models.Badge
	now := time.Now()

	for _, badge := range allBadges {
		if existingSet[badge.ID] {
			continue
		}

		var cond badgeCondition
		if err := json.Unmarshal([]byte(badge.ConditionJSON), &cond); err != nil {
			continue
		}

		earned := false
		switch cond.Type {
		case "visit_count":
			earned = visitCount >= cond.Threshold
		case "comfort_zone_break":
			earned = isComfortZone && comfortBreakCount >= int64(cond.Threshold)
		case "genre_count":
			earned = int(uniqueGenreCount) >= cond.Threshold
		case "streak_weeks":
			earned = user.StreakCount >= cond.Threshold
		case "new_area":
			// エリア判定は今回の訪問がnew_area=trueの場合（後から追加可能）
			// 現時点では skip（フォールバック実装）
		case "night_visit":
			earned = isNightVisitJST(visitedAt)
		case "weekend_visits":
			// JST換算で土・日の訪問件数をカウント
			var weekendVisits []models.Visit
			db.Model(&models.Visit{}).
				Where("user_id = ?", userID).
				Select("visited_at").
				Find(&weekendVisits)
			weekendCount := 0
			for _, v := range weekendVisits {
				if isWeekendVisitJST(v.VisitedAt) {
					weekendCount++
				}
			}
			earned = weekendCount >= cond.Threshold
		}

		if earned {
			userBadge := models.UserBadge{
				UserID:   userID,
				BadgeID:  badge.ID,
				EarnedAt: now,
			}
			if err := db.Create(&userBadge).Error; err == nil {
				newBadges = append(newBadges, badge)
			}
		}
	}

	return newBadges, nil
}

// ProcessGamification は訪問記録に対してゲーミフィケーション処理を行い、結果を返す
// トランザクション内で: XP計算・users更新・ジャンル熟練度更新・バッジ付与・ストリーク更新を実行
func ProcessGamification(db *gorm.DB, userID uint64, visit models.Visit) (*GamificationResult, error) {
	var result GamificationResult

	err := db.Transaction(func(tx *gorm.DB) error {
		// 初めてのジャンル訪問かチェック
		isFirstGenre := false
		if visit.GenreTagID != nil {
			var count int64
			tx.Model(&models.Visit{}).
				Where("user_id = ? AND genre_tag_id = ? AND id != ?", userID, *visit.GenreTagID, visit.ID).
				Count(&count)
			isFirstGenre = count == 0
		}

		// 感想メモの有無
		hasMemo := visit.Memo != nil && *visit.Memo != ""

		// XP計算
		xpEarned := CalcXP(visit.IsComfortZone, isFirstGenre, false, hasMemo)
		result.XPEarned = xpEarned

		// 訪問記録にXPを保存
		if err := tx.Model(&models.Visit{}).Where("id = ?", visit.ID).Update("xp_earned", xpEarned).Error; err != nil {
			return err
		}

		// ユーザーのtotal_xpとlevelを更新
		var user models.User
		if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}

		oldLevel := user.Level
		newTotalXP := user.TotalXP + xpEarned
		newLevel := CalcLevel(newTotalXP)

		if err := tx.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
			"total_xp": newTotalXP,
			"level":    newLevel,
		}).Error; err != nil {
			return err
		}

		result.TotalXP = newTotalXP
		result.NewLevel = newLevel
		result.LevelUp = newLevel > oldLevel

		// ジャンル熟練度更新
		if err := UpdateGenreProficiency(tx, userID, visit.GenreTagID, xpEarned); err != nil {
			return err
		}

		// ストリーク更新
		if err := UpdateStreak(tx, userID, visit.VisitedAt); err != nil {
			return err
		}

		// バッジチェック
		var visitCount int64
		tx.Model(&models.Visit{}).Where("user_id = ?", userID).Count(&visitCount)
		newBadges, err := CheckAndAwardBadges(tx, userID, visit.IsComfortZone, int(visitCount), visit.VisitedAt)
		if err != nil {
			return err
		}
		result.NewBadges = newBadges

		return nil
	})

	if err != nil {
		return nil, err
	}
	return &result, nil
}
