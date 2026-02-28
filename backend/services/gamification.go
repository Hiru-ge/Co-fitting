package services

import (
	"encoding/json"
	"math"
	"time"

	"github.com/Hiru-ge/roamble/models"
	"gorm.io/gorm"
)

// XP計算ルール定数
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

// haversineDistance は2点間の大圏距離をメートルで返す
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

// GamificationResult はゲーミフィケーション処理の結果
type GamificationResult struct {
	XPEarned    int
	TotalXP     int
	LevelUp     bool
	NewLevel    int
	NewBadges   []models.Badge
	XPBreakdown *XPBreakdown
}

// XPBreakdown はXP獲得の内訳
type XPBreakdown struct {
	BaseXP         int `json:"base_xp"`          // ベースXP（通常50 or 脱却100）
	FirstAreaBonus int `json:"first_area_bonus"` // 初エリアボーナス
	MemoBonus      int `json:"memo_bonus"`       // メモボーナス
	StreakBonus    int `json:"streak_bonus"`     // ストリークボーナス
}

// badgeCondition はConditionJSONのデコード用
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

// CalcLevel はtotalXPからレベルを算出する（1〜30）
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
// coords: 今回の訪問地点の緯度・経度（省略可。new_area判定に使用）
func CheckAndAwardBadges(db *gorm.DB, userID uint64, isComfortZone bool, visitCount int, visitedAt time.Time, coords ...float64) ([]models.Badge, error) {
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

	// new_area・weekend_visits判定用: 全訪問の座標・日時を一括取得
	var allVisits []models.Visit
	db.Model(&models.Visit{}).
		Where("user_id = ?", userID).
		Select("lat, lng, visited_at").
		Find(&allVisits)

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

// ProcessGamification は訪問記録に対してゲーミフィケーション処理を行い、結果を返す
// トランザクション内で: XP計算・users更新・ジャンル熟練度更新・バッジ付与・ストリーク更新を実行
func ProcessGamification(db *gorm.DB, userID uint64, visit models.Visit) (*GamificationResult, error) {
	var result GamificationResult

	err := db.Transaction(func(tx *gorm.DB) error {
		// 初めてのエリア訪問かチェック（過去訪問のいずれかから10km以上離れていればtrue）
		isFirstArea := false
		if visit.Latitude != 0 || visit.Longitude != 0 {
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
					isFirstArea = true
					break
				}
			}
		}

		// 感想メモの有無
		hasMemo := visit.Memo != nil && *visit.Memo != ""

		// XP計算
		xpEarned := CalcXP(visit.IsComfortZone, isFirstArea, hasMemo)

		// 内訳を記録
		baseXP := XPNormalVisit
		if visit.IsComfortZone {
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

		// ジャンル熟練度更新
		if err := UpdateGenreProficiency(tx, userID, visit.GenreTagID, xpEarned); err != nil {
			return err
		}

		// ストリーク更新
		if err := UpdateStreak(tx, userID, visit.VisitedAt); err != nil {
			return err
		}

		// ストリーク更新後のstreakCountを取得してXPボーナスを付与
		var updatedUser models.User
		if err := tx.Where("id = ?", userID).First(&updatedUser).Error; err != nil {
			return err
		}
		streakBonus := CalcStreakBonus(updatedUser.StreakCount)
		if streakBonus > 0 {
			xpEarned += streakBonus
			newTotalXP += streakBonus
			newLevel = CalcLevel(newTotalXP)
			if err := tx.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
				"total_xp": newTotalXP,
				"level":    newLevel,
			}).Error; err != nil {
				return err
			}
			// 訪問記録のXPもストリークボーナスを含めて更新
			if err := tx.Model(&models.Visit{}).Where("id = ?", visit.ID).Update("xp_earned", xpEarned).Error; err != nil {
				return err
			}
		}

		result.XPEarned = xpEarned
		result.TotalXP = newTotalXP
		result.NewLevel = newLevel
		result.LevelUp = newLevel > oldLevel
		result.XPBreakdown = &XPBreakdown{
			BaseXP:         baseXP,
			FirstAreaBonus: firstAreaBonusXP,
			MemoBonus:      memoBonusXP,
			StreakBonus:    streakBonus,
		}

		// バッジチェック
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
