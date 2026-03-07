package services

import (
	"encoding/json"
	"math"
	"time"

	"github.com/Hiru-ge/roamble/models"
	"gorm.io/gorm"
)

const (
	XPNormalVisit        = 50  // 通常訪問
	XPComfortBreak       = 100 // 脱却訪問
	XPFirstArea          = 30  // 初めてのエリアボーナス
	XPMemoBonus          = 10  // 感想メモ記入ボーナス
	XPStreakBonusPerWeek = 10  // ストリークボーナス（1週あたり）
	XPStreakBonusMax     = 100 // ストリークボーナス上限（10週連続から固定）
)

// エリアパイオニアバッジの距離閾値（メートル）
const AreaPioneerDistanceM = 10000.0

func haversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadiusM = 6371000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusM * c
}

// レベルテーブル: インデックスiのレベル(i+1)はthresholds[i]以上で到達
// Lv.1〜30の指数カーブ（等差増加: 各ステップの増分が67XPずつ増加）、
// 最大Lv.30 = 30,000 XP
var levelThresholds = []int{
	0,     // Lv.1:      0 XP〜
	100,   // Lv.2:    100 XP〜
	267,   // Lv.3:    267 XP〜
	501,   // Lv.4:    501 XP〜
	802,   // Lv.5:    802 XP〜
	1170,  // Lv.6:  1,170 XP〜
	1605,  // Lv.7:  1,605 XP〜
	2107,  // Lv.8:  2,107 XP〜
	2676,  // Lv.9:  2,676 XP〜
	3312,  // Lv.10: 3,312 XP〜
	4015,  // Lv.11: 4,015 XP〜
	4785,  // Lv.12: 4,785 XP〜
	5622,  // Lv.13: 5,622 XP〜
	6526,  // Lv.14: 6,526 XP〜
	7497,  // Lv.15: 7,497 XP〜
	8535,  // Lv.16: 8,535 XP〜
	9640,  // Lv.17: 9,640 XP〜
	10812, // Lv.18: 10,812 XP〜
	12051, // Lv.19: 12,051 XP〜
	13357, // Lv.20: 13,357 XP〜
	14730, // Lv.21: 14,730 XP〜
	16170, // Lv.22: 16,170 XP〜
	17677, // Lv.23: 17,677 XP〜
	19251, // Lv.24: 19,251 XP〜
	20892, // Lv.25: 20,892 XP〜
	22600, // Lv.26: 22,600 XP〜
	24375, // Lv.27: 24,375 XP〜
	26217, // Lv.28: 26,217 XP〜
	28126, // Lv.29: 28,126 XP〜
	30000, // Lv.30: 30,000 XP〜
}

type GamificationResult struct {
	XPEarned    int
	TotalXP     int
	LevelUp     bool
	NewLevel    int
	NewBadges   []models.Badge
	XPBreakdown *XPBreakdown
}

type XPBreakdown struct {
	BaseXP         int `json:"base_xp"`          // ベースXP（通常50 or 脱却100）
	FirstAreaBonus int `json:"first_area_bonus"` // 初エリアボーナス
	MemoBonus      int `json:"memo_bonus"`       // メモボーナス
	StreakBonus    int `json:"streak_bonus"`     // ストリークボーナス
}

type badgeCondition struct {
	Type      string `json:"type"`
	Threshold int    `json:"threshold"`
}

// CalcXP はXPを計算して返す
// isComfortZone: 興味ジャンル外ならtrue（脱却訪問）
// isFirstArea: 初めてのエリア訪問ならtrue
// hasMemo: 感想メモありならtrue
func CalcXP(isComfortZone bool, isFirstArea bool, hasMemo bool) int {
	xp := XPNormalVisit
	if isComfortZone {
		xp = XPComfortBreak
	}
	if isFirstArea {
		xp += XPFirstArea
	}
	if hasMemo {
		xp += XPMemoBonus
	}
	return xp
}

func CalcLevel(totalXP int) int {
	level := 1
	for i, threshold := range levelThresholds {
		if totalXP >= threshold {
			level = i + 1
		}
	}
	return level
}

// CalcStreakBonus は連続週数に応じたストリークXPボーナスを返す
// streakCount週 × XPStreakBonusPerWeek、上限 XPStreakBonusMax（10週連続から固定）
func CalcStreakBonus(streakCount int) int {
	bonus := streakCount * XPStreakBonusPerWeek
	if bonus > XPStreakBonusMax {
		bonus = XPStreakBonusMax
	}
	return bonus
}

// calcGenreLevel はジャンル熟練度XPからジャンルレベルを算出する
// ユーザーレベルと同じ levelThresholds テーブルを使用し、最大Lv.30でキャップ
func calcGenreLevel(xp int) int {
	level := 1
	for i, threshold := range levelThresholds {
		if xp >= threshold {
			level = i + 1
		}
	}
	if level > 30 {
		level = 30
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

	visitWeekStart := weekStart(visitedAt)

	if user.StreakLast == nil {
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

// weekStart は指定時刻が属する週の月曜日（0時0分0秒JST）を返す
// 他のJST判定関数（isNightVisitJST, isWeekendVisitJST）とタイムゾーンを統一
func weekStart(t time.Time) time.Time {
	t = t.In(jst)
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7 // Sunday → 7
	}
	monday := t.AddDate(0, 0, -(weekday - 1))
	return time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, jst)
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
// coords: 今回の訪問地点の緯度・経度（省略可。new_area判定に使用）
func CheckAndAwardBadges(db *gorm.DB, userID uint64, isComfortZone bool, visitCount int, visitedAt time.Time, coords ...float64) ([]models.Badge, error) {
	var existingBadgeIDs []uint64
	db.Model(&models.UserBadge{}).
		Where("user_id = ?", userID).
		Pluck("badge_id", &existingBadgeIDs)
	existingSet := make(map[uint64]bool, len(existingBadgeIDs))
	for _, id := range existingBadgeIDs {
		existingSet[id] = true
	}

	var allBadges []models.Badge
	if err := db.Find(&allBadges).Error; err != nil {
		return nil, err
	}

	// 判定に必要な集計値を一括取得（N+1クエリ回避）
	var user models.User
	if err := db.First(&user, userID).Error; err != nil {
		return nil, err
	}

	var uniqueGenreCount int64
	db.Model(&models.Visit{}).
		Where("user_id = ? AND genre_tag_id IS NOT NULL", userID).
		Distinct("genre_tag_id").
		Count(&uniqueGenreCount)

	var comfortBreakCount int64
	db.Model(&models.Visit{}).
		Where("user_id = ? AND is_comfort_zone = ?", userID, true).
		Count(&comfortBreakCount)

	var allVisits []models.Visit
	db.Model(&models.Visit{}).
		Where("user_id = ?", userID).
		Select("lat, lng, visited_at").
		Find(&allVisits)

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
			if len(coords) >= 2 && visitCount > 1 {
				currentLat, currentLng := coords[0], coords[1]
				if currentLat == 0 && currentLng == 0 {
					break
				}
				for _, pv := range allVisits {
					if pv.Latitude == 0 && pv.Longitude == 0 {
						continue
					}
					if haversineDistance(currentLat, currentLng, pv.Latitude, pv.Longitude) >= AreaPioneerDistanceM {
						earned = true
						break
					}
				}
			}
		case "night_visit":
			earned = isNightVisitJST(visitedAt)
		case "weekend_visits":
			weekendCount := 0
			for _, v := range allVisits {
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

// isFirstAreaVisit は過去の訪問履歴にある地点から10km以上離れていれば true を返す
func isFirstAreaVisit(tx *gorm.DB, userID uint64, visit models.Visit) bool {
	if visit.Latitude == 0 && visit.Longitude == 0 {
		return false
	}
	var prevVisits []models.Visit
	tx.Model(&models.Visit{}).
		Where("user_id = ? AND id != ?", userID, visit.ID).
		Select("lat, lng").
		Find(&prevVisits)
	for _, pv := range prevVisits {
		if pv.Latitude == 0 && pv.Longitude == 0 {
			continue
		}
		if haversineDistance(visit.Latitude, visit.Longitude, pv.Latitude, pv.Longitude) >= AreaPioneerDistanceM {
			return true
		}
	}
	return false
}

// buildXPBreakdown はXP計算内訳を構築して返す（副作用なし）
func buildXPBreakdown(isComfortZone, isFirstArea, hasMemo bool, streakBonus int) *XPBreakdown {
	baseXP := XPNormalVisit
	if isComfortZone {
		baseXP = XPComfortBreak
	}
	firstAreaBonusXP := 0
	if isFirstArea {
		firstAreaBonusXP = XPFirstArea
	}
	memoBonusXP := 0
	if hasMemo {
		memoBonusXP = XPMemoBonus
	}
	return &XPBreakdown{
		BaseXP:         baseXP,
		FirstAreaBonus: firstAreaBonusXP,
		MemoBonus:      memoBonusXP,
		StreakBonus:    streakBonus,
	}
}

// applyXPAndProgression はXP・レベル・熟練度・ストリークをDBに反映し、
// 最終XP・newTotalXP・newLevel・levelUp・streakBonus を返す
func applyXPAndProgression(tx *gorm.DB, userID uint64, visit models.Visit, xpEarned int) (finalXP, newTotalXP, newLevel int, levelUp bool, streakBonus int, err error) {
	if err = tx.Model(&models.Visit{}).Where("id = ?", visit.ID).Update("xp_earned", xpEarned).Error; err != nil {
		return
	}

	var user models.User
	if err = tx.Where("id = ?", userID).First(&user).Error; err != nil {
		return
	}

	oldLevel := user.Level
	newTotalXP = user.TotalXP + xpEarned
	newLevel = CalcLevel(newTotalXP)

	if err = tx.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"total_xp": newTotalXP,
		"level":    newLevel,
	}).Error; err != nil {
		return
	}

	if err = UpdateGenreProficiency(tx, userID, visit.GenreTagID, xpEarned); err != nil {
		return
	}

	if err = UpdateStreak(tx, userID, visit.VisitedAt); err != nil {
		return
	}

	var updatedUser models.User
	if err = tx.Where("id = ?", userID).First(&updatedUser).Error; err != nil {
		return
	}
	streakBonus = CalcStreakBonus(updatedUser.StreakCount)
	finalXP = xpEarned + streakBonus
	if streakBonus > 0 {
		newTotalXP += streakBonus
		newLevel = CalcLevel(newTotalXP)
		if err = tx.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
			"total_xp": newTotalXP,
			"level":    newLevel,
		}).Error; err != nil {
			return
		}
		if err = tx.Model(&models.Visit{}).Where("id = ?", visit.ID).Update("xp_earned", finalXP).Error; err != nil {
			return
		}
		// ストリークボーナスもジャンル熟練度に反映（ユーザーXPと同一にする）
		if err = UpdateGenreProficiency(tx, userID, visit.GenreTagID, streakBonus); err != nil {
			return
		}
	}

	levelUp = newLevel > oldLevel
	return
}

// ProcessGamification は訪問記録に対してゲーミフィケーション処理を行い、結果を返す
// トランザクション内で: XP計算・users更新・ジャンル熟練度更新・バッジ付与・ストリーク更新を実行
func ProcessGamification(db *gorm.DB, userID uint64, visit models.Visit) (*GamificationResult, error) {
	var result GamificationResult

	err := db.Transaction(func(tx *gorm.DB) error {
		isFirstArea := isFirstAreaVisit(tx, userID, visit)
		hasMemo := visit.Memo != nil && *visit.Memo != ""
		xpEarned := CalcXP(visit.IsComfortZone, isFirstArea, hasMemo)

		finalXP, newTotalXP, newLevel, levelUp, streakBonus, err := applyXPAndProgression(tx, userID, visit, xpEarned)
		if err != nil {
			return err
		}

		result.XPEarned = finalXP
		result.TotalXP = newTotalXP
		result.NewLevel = newLevel
		result.LevelUp = levelUp
		result.XPBreakdown = buildXPBreakdown(visit.IsComfortZone, isFirstArea, hasMemo, streakBonus)

		var visitCount int64
		tx.Model(&models.Visit{}).Where("user_id = ?", userID).Count(&visitCount)
		newBadges, err := CheckAndAwardBadges(tx, userID, visit.IsComfortZone, int(visitCount), visit.VisitedAt, visit.Latitude, visit.Longitude)
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
