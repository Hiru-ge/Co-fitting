package services_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
	"github.com/Hiru-ge/roamble/testutil"
	"gorm.io/gorm"
)

var testDB *gorm.DB

func TestMain(m *testing.M) {
	testutil.LoadTestEnv()

	var err error
	testDB, err = database.Init()
	if err != nil {
		panic("Failed to initialize test database: " + err.Error())
	}
	if err := database.Migrate(testDB); err != nil {
		panic("Failed to run migrations: " + err.Error())
	}

	sqlDB, _ := testDB.DB()
	defer sqlDB.Close()

	m.Run()
}

// --- ヘルパー ---

func cleanupUsers(t *testing.T) {
	t.Helper()
	testDB.Exec("DELETE FROM user_badges")
	testDB.Exec("DELETE FROM genre_proficiency")
	testDB.Exec("DELETE FROM user_interests")
	testDB.Exec("DELETE FROM visit_history")
	testDB.Exec("DELETE FROM users")
}

func createUser(t *testing.T, email string) models.User {
	t.Helper()
	user := models.User{
		Email:       email,
		DisplayName: "Test User",
	}
	testDB.Create(&user)
	return user
}

func getOrCreateGenreTag(t *testing.T, name string) models.GenreTag {
	t.Helper()
	database.SeedMasterData(testDB)
	var tag models.GenreTag
	if err := testDB.Where("name = ?", name).First(&tag).Error; err != nil {
		tag = models.GenreTag{Name: name, Category: "テスト", Icon: "test"}
		testDB.Create(&tag)
	}
	return tag
}

// =============================================
// CalcXP テスト
// =============================================

func TestCalcXP(t *testing.T) {
	t.Run("通常訪問（is_comfort_zone=false）は50XP", func(t *testing.T) {
		xp := services.CalcXP(false, false, false, false)
		if xp != 50 {
			t.Errorf("expected 50, got %d", xp)
		}
	})

	t.Run("脱却訪問（is_comfort_zone=true）は100XP", func(t *testing.T) {
		xp := services.CalcXP(true, false, false, false)
		if xp != 100 {
			t.Errorf("expected 100, got %d", xp)
		}
	})

	t.Run("初めてのジャンルボーナス+50XP", func(t *testing.T) {
		xp := services.CalcXP(false, true, false, false)
		if xp != 100 {
			t.Errorf("expected 100 (50+50), got %d", xp)
		}
	})

	t.Run("初めてのエリアボーナス+30XP", func(t *testing.T) {
		xp := services.CalcXP(false, false, true, false)
		if xp != 80 {
			t.Errorf("expected 80 (50+30), got %d", xp)
		}
	})

	t.Run("感想メモ記入ボーナス+10XP", func(t *testing.T) {
		xp := services.CalcXP(false, false, false, true)
		if xp != 60 {
			t.Errorf("expected 60 (50+10), got %d", xp)
		}
	})

	t.Run("脱却+初ジャンル+初エリア+メモ =190XP", func(t *testing.T) {
		xp := services.CalcXP(true, true, true, true)
		// 100 + 50 + 30 + 10 = 190
		if xp != 190 {
			t.Errorf("expected 190, got %d", xp)
		}
	})

	t.Run("通常+初ジャンル+初エリア+メモ =140XP", func(t *testing.T) {
		xp := services.CalcXP(false, true, true, true)
		// 50 + 50 + 30 + 10 = 140
		if xp != 140 {
			t.Errorf("expected 140, got %d", xp)
		}
	})
}

// =============================================
// CalcLevel テスト
// =============================================

func TestCalcLevel(t *testing.T) {
	tests := []struct {
		name      string
		totalXP   int
		wantLevel int
	}{
		{"0XPはレベル1", 0, 1},
		{"99XPはレベル1", 99, 1},
		{"100XPはレベル2", 100, 2},
		{"299XPはレベル2", 299, 2},
		{"300XPはレベル3", 300, 3},
		{"599XPはレベル3", 599, 3},
		{"600XPはレベル4", 600, 4},
		{"999XPはレベル4", 999, 4},
		{"1000XPはレベル5", 1000, 5},
		{"1999XPはレベル5", 1999, 5},
		{"2000XPはレベル6", 2000, 6},
		{"4999XPはレベル9", 4999, 9},
		{"5000XPはレベル10", 5000, 10},
		{"10000XP以上はレベル10上限", 99999, 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			level := services.CalcLevel(tt.totalXP)
			if level != tt.wantLevel {
				t.Errorf("CalcLevel(%d) = %d, want %d", tt.totalXP, level, tt.wantLevel)
			}
		})
	}
}

// =============================================
// UpdateStreak テスト
// =============================================

func TestUpdateStreak(t *testing.T) {
	t.Run("初回訪問でstreak_count=1になる", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "streak1@example.com")

		now := time.Now()
		err := services.UpdateStreak(testDB, user.ID, now)
		if err != nil {
			t.Fatalf("UpdateStreak failed: %v", err)
		}

		var updated models.User
		testDB.First(&updated, user.ID)
		if updated.StreakCount != 1 {
			t.Errorf("expected streak_count=1, got %d", updated.StreakCount)
		}
		if updated.StreakLast == nil {
			t.Error("expected streak_last to be set")
		}
	})

	t.Run("前週訪問済みなら継続でstreak_count増加", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "streak2@example.com")

		lastWeek := time.Now().AddDate(0, 0, -7)
		testDB.Model(&user).Updates(map[string]interface{}{
			"streak_count": 3,
			"streak_last":  lastWeek,
		})

		now := time.Now()
		err := services.UpdateStreak(testDB, user.ID, now)
		if err != nil {
			t.Fatalf("UpdateStreak failed: %v", err)
		}

		var updated models.User
		testDB.First(&updated, user.ID)
		if updated.StreakCount != 4 {
			t.Errorf("expected streak_count=4, got %d", updated.StreakCount)
		}
	})

	t.Run("同週訪問済みならstreak_countは変化しない", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "streak3@example.com")

		// 今週の月曜日の翌日（火曜日以降は必ず同週になる）
		// 今週の月曜日 + 1日 = 火曜日
		now := time.Now().UTC()
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		// 今週月曜日
		monday := now.AddDate(0, 0, -(weekday - 1))
		monday = time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, time.UTC)
		// 月曜日は同一日、火〜日なら月曜日を使う（確実に同週）
		sameWeek := monday.Add(time.Hour) // 今週月曜日の1時間後（確実に同週）

		testDB.Model(&user).Updates(map[string]interface{}{
			"streak_count": 2,
			"streak_last":  sameWeek,
		})

		now2 := time.Now()
		err := services.UpdateStreak(testDB, user.ID, now2)
		if err != nil {
			t.Fatalf("UpdateStreak failed: %v", err)
		}

		var updated models.User
		testDB.First(&updated, user.ID)
		if updated.StreakCount != 2 {
			t.Errorf("expected streak_count=2 (no change), got %d", updated.StreakCount)
		}
	})

	t.Run("2週以上訪問なしでstreak_countリセット1", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "streak4@example.com")

		twoWeeksAgo := time.Now().AddDate(0, 0, -15)
		testDB.Model(&user).Updates(map[string]interface{}{
			"streak_count": 5,
			"streak_last":  twoWeeksAgo,
		})

		now := time.Now()
		err := services.UpdateStreak(testDB, user.ID, now)
		if err != nil {
			t.Fatalf("UpdateStreak failed: %v", err)
		}

		var updated models.User
		testDB.First(&updated, user.ID)
		if updated.StreakCount != 1 {
			t.Errorf("expected streak_count=1 (reset), got %d", updated.StreakCount)
		}
	})
}

// =============================================
// UpdateGenreProficiency テスト
// =============================================

func TestUpdateGenreProficiency(t *testing.T) {
	t.Run("新規ジャンルでレコード作成されXPが加算される", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "prof1@example.com")
		tag := getOrCreateGenreTag(t, "カフェ")

		err := services.UpdateGenreProficiency(testDB, user.ID, &tag.ID, 50)
		if err != nil {
			t.Fatalf("UpdateGenreProficiency failed: %v", err)
		}

		var prof models.GenreProficiency
		if err := testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, tag.ID).First(&prof).Error; err != nil {
			t.Fatalf("proficiency record not found: %v", err)
		}
		if prof.XP != 50 {
			t.Errorf("expected xp=50, got %d", prof.XP)
		}
		if prof.Level != 1 {
			t.Errorf("expected level=1, got %d", prof.Level)
		}
	})

	t.Run("既存ジャンルにXPが追加される", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "prof2@example.com")
		tag := getOrCreateGenreTag(t, "レストラン")

		testDB.Create(&models.GenreProficiency{
			UserID:     user.ID,
			GenreTagID: tag.ID,
			XP:         80,
			Level:      1,
		})

		err := services.UpdateGenreProficiency(testDB, user.ID, &tag.ID, 50)
		if err != nil {
			t.Fatalf("UpdateGenreProficiency failed: %v", err)
		}

		var prof models.GenreProficiency
		testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, tag.ID).First(&prof)
		if prof.XP != 130 {
			t.Errorf("expected xp=130, got %d", prof.XP)
		}
	})

	t.Run("ジャンルXPが100を超えるとレベル2になる", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "prof3@example.com")
		tag := getOrCreateGenreTag(t, "公園・緑地")

		testDB.Create(&models.GenreProficiency{
			UserID:     user.ID,
			GenreTagID: tag.ID,
			XP:         90,
			Level:      1,
		})

		err := services.UpdateGenreProficiency(testDB, user.ID, &tag.ID, 50)
		if err != nil {
			t.Fatalf("UpdateGenreProficiency failed: %v", err)
		}

		var prof models.GenreProficiency
		testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, tag.ID).First(&prof)
		if prof.XP != 140 {
			t.Errorf("expected xp=140, got %d", prof.XP)
		}
		if prof.Level != 2 {
			t.Errorf("expected level=2 after 140xp, got %d", prof.Level)
		}
	})

	t.Run("genreTagID=nilの場合はスキップ", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "prof4@example.com")

		err := services.UpdateGenreProficiency(testDB, user.ID, nil, 50)
		if err != nil {
			t.Fatalf("UpdateGenreProficiency with nil genreTagID should not error: %v", err)
		}
	})
}

// =============================================
// CheckAndAwardBadges テスト
// =============================================

func TestCheckAndAwardBadges(t *testing.T) {
	t.Run("初訪問で「最初の一歩」バッジを獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "badge1@example.com")
		database.SeedMasterData(testDB)

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place1",
			PlaceName: "テスト場所",
			Category:  "cafe",
			Latitude:  35.67,
			Longitude: 139.65,
			VisitedAt: time.Now(),
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 1, time.Now())
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "最初の一歩" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected '最初の一歩' badge, got %v", newBadges)
		}
	})

	t.Run("2回目以降は「最初の一歩」バッジは付与されない", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "badge2@example.com")
		database.SeedMasterData(testDB)

		var badge models.Badge
		testDB.Where("name = ?", "最初の一歩").First(&badge)
		testDB.Create(&models.UserBadge{
			UserID:   user.ID,
			BadgeID:  badge.ID,
			EarnedAt: time.Now(),
		})

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place2",
			PlaceName: "テスト場所2",
			Category:  "cafe",
			Latitude:  35.67,
			Longitude: 139.65,
			VisitedAt: time.Now(),
		})
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place3",
			PlaceName: "テスト場所3",
			Category:  "cafe",
			Latitude:  35.67,
			Longitude: 139.65,
			VisitedAt: time.Now(),
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 2, time.Now())
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		for _, b := range newBadges {
			if b.Name == "最初の一歩" {
				t.Error("should not award '最初の一歩' badge again")
			}
		}
	})

	t.Run("コンフォートゾーン脱却時に「コンフォートゾーン・ブレイカー」バッジを獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "badge3@example.com")
		database.SeedMasterData(testDB)

		testDB.Create(&models.Visit{
			UserID:        user.ID,
			PlaceID:       "place1",
			PlaceName:     "テスト場所",
			Category:      "museum",
			Latitude:      35.67,
			Longitude:     139.65,
			IsComfortZone: true,
			VisitedAt:     time.Now(),
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, true, 1, time.Now())
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "コンフォートゾーン・ブレイカー" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'コンフォートゾーン・ブレイカー' badge, got %v", newBadges)
		}
	})

	t.Run("3種類のジャンルを訪問したら「ジャンルコレクター Lv.1」を獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "badge4@example.com")
		database.SeedMasterData(testDB)

		tag1 := getOrCreateGenreTag(t, "カフェ")
		tag2 := getOrCreateGenreTag(t, "ラーメン・麺類")
		tag3 := getOrCreateGenreTag(t, "公園・緑地")

		for i, tagID := range []uint64{tag1.ID, tag2.ID, tag3.ID} {
			id := tagID
			testDB.Create(&models.Visit{
				UserID:     user.ID,
				PlaceID:    "place" + string(rune('1'+i)),
				PlaceName:  "テスト場所",
				Category:   "test",
				Latitude:   35.67,
				Longitude:  139.65,
				GenreTagID: &id,
				VisitedAt:  time.Now(),
			})
		}

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 3, time.Now())
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "ジャンルコレクター Lv.1" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'ジャンルコレクター Lv.1' badge, got %v", newBadges)
		}
	})

	t.Run("ストリーク4週でストリークマスター Lv.1を獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "badge5@example.com")
		database.SeedMasterData(testDB)

		testDB.Model(&user).Update("streak_count", 4)

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 1, time.Now())
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "ストリークマスター Lv.1" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'ストリークマスター Lv.1' badge, got %v", newBadges)
		}
	})

	t.Run("深夜（23時JST）の訪問でナイトウォーカーバッジを獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "night1@example.com")
		database.SeedMasterData(testDB)

		jst := time.FixedZone("Asia/Tokyo", 9*60*60)
		nightVisitTime := time.Date(2024, 1, 15, 23, 0, 0, 0, jst)

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_night1",
			PlaceName: "深夜のカフェ",
			Category:  "cafe",
			Latitude:  35.67,
			Longitude: 139.65,
			VisitedAt: nightVisitTime,
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 1, nightVisitTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "ナイトウォーカー" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'ナイトウォーカー' badge for 23:00 JST visit, got %v", newBadges)
		}
	})

	t.Run("翌5時未満（4時JST）の訪問でナイトウォーカーバッジを獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "night2@example.com")
		database.SeedMasterData(testDB)

		jst := time.FixedZone("Asia/Tokyo", 9*60*60)
		nightVisitTime := time.Date(2024, 1, 16, 4, 0, 0, 0, jst)

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_night2",
			PlaceName: "早朝の公園",
			Category:  "park",
			Latitude:  35.67,
			Longitude: 139.65,
			VisitedAt: nightVisitTime,
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 1, nightVisitTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "ナイトウォーカー" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'ナイトウォーカー' badge for 4:00 JST visit, got %v", newBadges)
		}
	})

	t.Run("昼間（15時JST）の訪問ではナイトウォーカーバッジを獲得しない", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "night3@example.com")
		database.SeedMasterData(testDB)

		jst := time.FixedZone("Asia/Tokyo", 9*60*60)
		dayVisitTime := time.Date(2024, 1, 15, 15, 0, 0, 0, jst)

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_day1",
			PlaceName: "昼のカフェ",
			Category:  "cafe",
			Latitude:  35.67,
			Longitude: 139.65,
			VisitedAt: dayVisitTime,
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 1, dayVisitTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		for _, b := range newBadges {
			if b.Name == "ナイトウォーカー" {
				t.Errorf("should not award 'ナイトウォーカー' badge for 15:00 JST visit")
			}
		}
	})

	// =============================================
	// ウィークエンドウォリアー バッジテスト
	// =============================================

	t.Run("週末（土曜JST）に3箇所以上訪問するとウィークエンドウォリアーバッジを獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "weekend1@example.com")
		database.SeedMasterData(testDB)

		jst := time.FixedZone("Asia/Tokyo", 9*60*60)
		// 2024-01-20 は土曜日（JST）
		saturdayTime := time.Date(2024, 1, 20, 14, 0, 0, 0, jst)

		for i := 0; i < 3; i++ {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   fmt.Sprintf("place_weekend_sat_%d", i),
				PlaceName: fmt.Sprintf("週末スポット%d", i+1),
				Category:  "cafe",
				Latitude:  35.67,
				Longitude: 139.65,
				VisitedAt: saturdayTime.Add(time.Duration(i) * time.Hour),
			})
		}

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 3, saturdayTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "ウィークエンドウォリアー" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'ウィークエンドウォリアー' badge for 3 weekend visits, got %v", newBadges)
		}
	})

	t.Run("週末（日曜JST）に3箇所以上訪問するとウィークエンドウォリアーバッジを獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "weekend2@example.com")
		database.SeedMasterData(testDB)

		jst := time.FixedZone("Asia/Tokyo", 9*60*60)
		// 2024-01-21 は日曜日（JST）
		sundayTime := time.Date(2024, 1, 21, 14, 0, 0, 0, jst)

		for i := 0; i < 3; i++ {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   fmt.Sprintf("place_weekend_sun_%d", i),
				PlaceName: fmt.Sprintf("日曜スポット%d", i+1),
				Category:  "cafe",
				Latitude:  35.67,
				Longitude: 139.65,
				VisitedAt: sundayTime.Add(time.Duration(i) * time.Hour),
			})
		}

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 3, sundayTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "ウィークエンドウォリアー" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'ウィークエンドウォリアー' badge for 3 Sunday visits, got %v", newBadges)
		}
	})

	t.Run("週末訪問が2箇所ではウィークエンドウォリアーバッジを獲得しない", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "weekend3@example.com")
		database.SeedMasterData(testDB)

		jst := time.FixedZone("Asia/Tokyo", 9*60*60)
		// 2024-01-20 は土曜日（JST）
		saturdayTime := time.Date(2024, 1, 20, 14, 0, 0, 0, jst)

		for i := 0; i < 2; i++ {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   fmt.Sprintf("place_weekend_2_%d", i),
				PlaceName: fmt.Sprintf("週末スポット%d", i+1),
				Category:  "cafe",
				Latitude:  35.67,
				Longitude: 139.65,
				VisitedAt: saturdayTime.Add(time.Duration(i) * time.Hour),
			})
		}

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 2, saturdayTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		for _, b := range newBadges {
			if b.Name == "ウィークエンドウォリアー" {
				t.Errorf("should not award 'ウィークエンドウォリアー' badge for only 2 weekend visits")
			}
		}
	})

	t.Run("平日の訪問3件ではウィークエンドウォリアーバッジを獲得しない", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "weekend4@example.com")
		database.SeedMasterData(testDB)

		jst := time.FixedZone("Asia/Tokyo", 9*60*60)
		// 2024-01-15 は月曜日（JST）
		mondayTime := time.Date(2024, 1, 15, 14, 0, 0, 0, jst)

		for i := 0; i < 3; i++ {
			testDB.Create(&models.Visit{
				UserID:    user.ID,
				PlaceID:   fmt.Sprintf("place_weekday_%d", i),
				PlaceName: fmt.Sprintf("平日スポット%d", i+1),
				Category:  "cafe",
				Latitude:  35.67,
				Longitude: 139.65,
				VisitedAt: mondayTime.Add(time.Duration(i) * time.Hour),
			})
		}

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 3, mondayTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		for _, b := range newBadges {
			if b.Name == "ウィークエンドウォリアー" {
				t.Errorf("should not award 'ウィークエンドウォリアー' badge for weekday visits")
			}
		}
	})

	t.Run("土日合計で3箇所以上（異なる週末日）でウィークエンドウォリアーバッジを獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "weekend5@example.com")
		database.SeedMasterData(testDB)

		jst := time.FixedZone("Asia/Tokyo", 9*60*60)
		// 2024-01-20 土曜, 2024-01-21 日曜
		saturdayTime := time.Date(2024, 1, 20, 14, 0, 0, 0, jst)
		sundayTime := time.Date(2024, 1, 21, 14, 0, 0, 0, jst)

		testDB.Create(&models.Visit{
			UserID: user.ID, PlaceID: "place_sat_mixed_1", PlaceName: "土曜スポット1",
			Category: "cafe", Latitude: 35.67, Longitude: 139.65, VisitedAt: saturdayTime,
		})
		testDB.Create(&models.Visit{
			UserID: user.ID, PlaceID: "place_sat_mixed_2", PlaceName: "土曜スポット2",
			Category: "cafe", Latitude: 35.67, Longitude: 139.65, VisitedAt: saturdayTime.Add(time.Hour),
		})
		testDB.Create(&models.Visit{
			UserID: user.ID, PlaceID: "place_sun_mixed_1", PlaceName: "日曜スポット1",
			Category: "cafe", Latitude: 35.67, Longitude: 139.65, VisitedAt: sundayTime,
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 3, sundayTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "ウィークエンドウォリアー" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'ウィークエンドウォリアー' badge for 3 total weekend visits (Sat+Sun), got %v", newBadges)
		}
	})
}

// =============================================
// ProcessGamification 統合テスト
// =============================================

func TestProcessGamification(t *testing.T) {
	t.Run("通常訪問でXPが加算されレスポンスが返る", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif1@example.com")
		database.SeedMasterData(testDB)

		visit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place1",
			PlaceName:     "テストカフェ",
			Category:      "cafe",
			Latitude:      35.67,
			Longitude:     139.65,
			IsComfortZone: false,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&visit)

		result, err := services.ProcessGamification(testDB, user.ID, visit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		if result.XPEarned < 50 {
			t.Errorf("expected xp_earned >= 50, got %d", result.XPEarned)
		}
		if result.TotalXP < 50 {
			t.Errorf("expected total_xp >= 50 after update, got %d", result.TotalXP)
		}
	})

	t.Run("脱却訪問で100XP基本値が加算される", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif2@example.com")
		database.SeedMasterData(testDB)

		visit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place1",
			PlaceName:     "美術館",
			Category:      "museum",
			Latitude:      35.67,
			Longitude:     139.65,
			IsComfortZone: true,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&visit)

		result, err := services.ProcessGamification(testDB, user.ID, visit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		if result.XPEarned < 100 {
			t.Errorf("expected xp_earned >= 100 for comfort zone break, got %d", result.XPEarned)
		}
	})

	t.Run("レベルアップ時にlevel_up=trueとnew_levelが返る", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif3@example.com")
		database.SeedMasterData(testDB)

		testDB.Model(&user).Updates(map[string]interface{}{
			"total_xp": 90,
			"level":    1,
		})

		visit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place1",
			PlaceName:     "テスト",
			Category:      "cafe",
			Latitude:      35.67,
			Longitude:     139.65,
			IsComfortZone: false,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&visit)

		result, err := services.ProcessGamification(testDB, user.ID, visit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		if !result.LevelUp {
			t.Errorf("expected level_up=true, got false (total_xp=%d)", result.TotalXP)
		}
		if result.NewLevel != 2 {
			t.Errorf("expected new_level=2, got %d", result.NewLevel)
		}
	})

	t.Run("visit.xp_earnedがDBに保存される", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif4@example.com")
		database.SeedMasterData(testDB)

		visit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_xp_save",
			PlaceName:     "テスト",
			Category:      "cafe",
			Latitude:      35.67,
			Longitude:     139.65,
			IsComfortZone: false,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&visit)

		result, err := services.ProcessGamification(testDB, user.ID, visit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		var updated models.Visit
		testDB.First(&updated, visit.ID)
		if updated.XpEarned != result.XPEarned {
			t.Errorf("expected visit.xp_earned=%d in DB, got %d", result.XPEarned, updated.XpEarned)
		}
	})
}
