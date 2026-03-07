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
	t.Run("通常訪問（is_breakout=false）は50XP", func(t *testing.T) {
		xp := services.CalcXP(false, false, false)
		if xp != 50 {
			t.Errorf("expected 50, got %d", xp)
		}
	})

	t.Run("脱却訪問（is_breakout=true）は100XP", func(t *testing.T) {
		xp := services.CalcXP(true, false, false)
		if xp != 100 {
			t.Errorf("expected 100, got %d", xp)
		}
	})

	t.Run("初めてのエリアボーナス+30XP", func(t *testing.T) {
		xp := services.CalcXP(false, true, false)
		if xp != 80 {
			t.Errorf("expected 80 (50+30), got %d", xp)
		}
	})

	t.Run("感想メモ記入ボーナス+10XP", func(t *testing.T) {
		xp := services.CalcXP(false, false, true)
		if xp != 60 {
			t.Errorf("expected 60 (50+10), got %d", xp)
		}
	})

	t.Run("脱却+初エリア+メモ =140XP", func(t *testing.T) {
		xp := services.CalcXP(true, true, true)
		// 100 + 30 + 10 = 140
		if xp != 140 {
			t.Errorf("expected 140, got %d", xp)
		}
	})

	t.Run("通常+初エリア+メモ =90XP", func(t *testing.T) {
		xp := services.CalcXP(false, true, true)
		// 50 + 30 + 10 = 90
		if xp != 90 {
			t.Errorf("expected 90, got %d", xp)
		}
	})
}

// =============================================
// CalcLevel テスト（Lv.30拡張後）
// =============================================

func TestCalcLevel(t *testing.T) {
	tests := []struct {
		name      string
		totalXP   int
		wantLevel int
	}{
		// 基本境界値
		{"0XPはレベル1", 0, 1},
		{"99XPはレベル1", 99, 1},
		{"100XPはレベル2", 100, 2},
		// Lv.10前後
		{"3311XPはレベル9", 3311, 9},
		{"3312XPはレベル10", 3312, 10},
		// Lv.20
		{"13356XPはレベル19", 13356, 19},
		{"13357XPはレベル20", 13357, 20},
		// Lv.30境界
		{"29999XPはレベル29", 29999, 29},
		{"30000XPはレベル30", 30000, 30},
		// レベル上限: 30,000 XP以上はLv.30
		{"99999XPはレベル30上限", 99999, 30},
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
// CalcStreakBonus テスト
// =============================================

func TestCalcStreakBonus(t *testing.T) {
	tests := []struct {
		name        string
		streakCount int
		wantBonus   int
	}{
		{"streak=0でボーナスなし", 0, 0},
		{"streak=1で10XP", 1, 10},
		{"streak=5で50XP", 5, 50},
		{"streak=9で90XP", 9, 90},
		{"streak=10で上限100XP", 10, 100},
		{"streak=15でも上限100XP", 15, 100},
		{"streak=100でも上限100XP", 100, 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bonus := services.CalcStreakBonus(tt.streakCount)
			if bonus != tt.wantBonus {
				t.Errorf("CalcStreakBonus(%d) = %d, want %d", tt.streakCount, bonus, tt.wantBonus)
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

	t.Run("コンフォートゾーン脱却訪問4件ではバッジが付与されない", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "badge3a@example.com")
		database.SeedMasterData(testDB)

		for i := 0; i < 4; i++ {
			testDB.Create(&models.Visit{
				UserID:        user.ID,
				PlaceID:       fmt.Sprintf("place_czb4_%d", i),
				PlaceName:     "テスト場所",
				Category:      "museum",
				Latitude:      35.67,
				Longitude:     139.65,
				IsBreakout: true,
				VisitedAt:     time.Now(),
			})
		}

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, true, 4, time.Now())
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		for _, b := range newBadges {
			if b.Name == "コンフォートゾーン・ブレイカー" {
				t.Errorf("should not award 'コンフォートゾーン・ブレイカー' on 4th escape visit, got %v", newBadges)
			}
		}
	})

	t.Run("コンフォートゾーン脱却訪問5件目でバッジが付与される", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "badge3b@example.com")
		database.SeedMasterData(testDB)

		for i := 0; i < 5; i++ {
			testDB.Create(&models.Visit{
				UserID:        user.ID,
				PlaceID:       fmt.Sprintf("place_czb5_%d", i),
				PlaceName:     "テスト場所",
				Category:      "museum",
				Latitude:      35.67,
				Longitude:     139.65,
				IsBreakout: true,
				VisitedAt:     time.Now(),
			})
		}

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, true, 5, time.Now())
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
			t.Errorf("expected 'コンフォートゾーン・ブレイカー' badge on 5th escape visit, got %v", newBadges)
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

	// =============================================
	// エリアパイオニアバッジテスト
	// =============================================

	t.Run("過去訪問から10km以上離れた場所を訪問するとエリアパイオニアバッジを獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "area_pioneer1@example.com")
		database.SeedMasterData(testDB)

		// 東京駅付近の過去訪問
		tokyoLat, tokyoLng := 35.6812, 139.7671
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_tokyo",
			PlaceName: "東京スポット",
			Category:  "cafe",
			Latitude:  tokyoLat,
			Longitude: tokyoLng,
			VisitedAt: time.Now().Add(-24 * time.Hour),
		})

		// 横浜駅付近（東京から約30km）の新しい訪問
		yokohamaLat, yokohamaLng := 35.4660, 139.6225
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_yokohama",
			PlaceName: "横浜スポット",
			Category:  "cafe",
			Latitude:  yokohamaLat,
			Longitude: yokohamaLng,
			VisitedAt: time.Now(),
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 2, time.Now(), yokohamaLat, yokohamaLng)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "エリアパイオニア" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'エリアパイオニア' badge for visit 30km away from past visit, got %v", newBadges)
		}
	})

	t.Run("過去訪問から10km未満の場所を訪問してもエリアパイオニアバッジを獲得しない", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "area_pioneer2@example.com")
		database.SeedMasterData(testDB)

		// 東京駅付近の過去訪問
		tokyoLat, tokyoLng := 35.6812, 139.7671
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_tokyo2",
			PlaceName: "東京スポット",
			Category:  "cafe",
			Latitude:  tokyoLat,
			Longitude: tokyoLng,
			VisitedAt: time.Now().Add(-24 * time.Hour),
		})

		// 新宿駅付近（東京から約6km）の新しい訪問
		shinjukuLat, shinjukuLng := 35.6896, 139.7006
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_shinjuku",
			PlaceName: "新宿スポット",
			Category:  "cafe",
			Latitude:  shinjukuLat,
			Longitude: shinjukuLng,
			VisitedAt: time.Now(),
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 2, time.Now(), shinjukuLat, shinjukuLng)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		for _, b := range newBadges {
			if b.Name == "エリアパイオニア" {
				t.Errorf("should not award 'エリアパイオニア' badge for visit only 6km away from past visit")
			}
		}
	})

	t.Run("初めての訪問（過去訪問なし）はエリアパイオニアバッジを獲得しない", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "area_pioneer3@example.com")
		database.SeedMasterData(testDB)

		yokohamaLat, yokohamaLng := 35.4660, 139.6225
		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_first",
			PlaceName: "初めての場所",
			Category:  "cafe",
			Latitude:  yokohamaLat,
			Longitude: yokohamaLng,
			VisitedAt: time.Now(),
		})

		// visitCount=1 は初回訪問なのでエリア判定対象外
		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 1, time.Now(), yokohamaLat, yokohamaLng)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		for _, b := range newBadges {
			if b.Name == "エリアパイオニア" {
				t.Errorf("should not award 'エリアパイオニア' badge on first-ever visit")
			}
		}
	})

	t.Run("複数の過去訪問のうち1つから10km以上離れていればエリアパイオニアバッジを獲得", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "area_pioneer4@example.com")
		database.SeedMasterData(testDB)

		// 近くの過去訪問（新宿）
		testDB.Create(&models.Visit{
			UserID: user.ID, PlaceID: "place_near", PlaceName: "近いスポット",
			Category: "cafe", Latitude: 35.6896, Longitude: 139.7006,
			VisitedAt: time.Now().Add(-48 * time.Hour),
		})
		// 遠くの過去訪問（東京）
		testDB.Create(&models.Visit{
			UserID: user.ID, PlaceID: "place_far", PlaceName: "東京スポット",
			Category: "cafe", Latitude: 35.6812, Longitude: 139.7671,
			VisitedAt: time.Now().Add(-24 * time.Hour),
		})

		// 横浜（東京から30km）の新しい訪問
		yokohamaLat, yokohamaLng := 35.4660, 139.6225
		testDB.Create(&models.Visit{
			UserID: user.ID, PlaceID: "place_yokohama2", PlaceName: "横浜スポット",
			Category: "cafe", Latitude: yokohamaLat, Longitude: yokohamaLng,
			VisitedAt: time.Now(),
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 3, time.Now(), yokohamaLat, yokohamaLng)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		found := false
		for _, b := range newBadges {
			if b.Name == "エリアパイオニア" {
				found = true
			}
		}
		if !found {
			t.Errorf("expected 'エリアパイオニア' badge when at least one past visit is 10km+ away, got %v", newBadges)
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
			IsBreakout: false,
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
			IsBreakout: true,
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
			IsBreakout: false,
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
			IsBreakout: false,
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

	t.Run("streak=5のユーザーが訪問するとストリークボーナス+50XPが加算される", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif_streak@example.com")
		database.SeedMasterData(testDB)

		// streakを5に設定
		lastWeek := time.Now().AddDate(0, 0, -7)
		testDB.Model(&user).Updates(map[string]interface{}{
			"streak_count": 4, // UpdateStreak後に5になる
			"streak_last":  lastWeek,
		})

		visit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_streak_bonus",
			PlaceName:     "テスト",
			Category:      "cafe",
			Latitude:      35.67,
			Longitude:     139.65,
			IsBreakout: false,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&visit)

		result, err := services.ProcessGamification(testDB, user.ID, visit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		// 通常訪問50XP + ストリーク5週×10=50XP = 100XP
		// ストリークボーナスが含まれているか確認（最低基本XP+50以上）
		if result.XPEarned < 100 {
			t.Errorf("expected xp_earned >= 100 with streak bonus (streak=5), got %d", result.XPEarned)
		}
	})

	t.Run("streak=10のユーザーが訪問するとストリークボーナス上限100XPが加算される", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif_streak_cap@example.com")
		database.SeedMasterData(testDB)

		// streak=9（UpdateStreak後に10になる）
		lastWeek := time.Now().AddDate(0, 0, -7)
		testDB.Model(&user).Updates(map[string]interface{}{
			"streak_count": 9,
			"streak_last":  lastWeek,
		})

		visit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_streak_cap",
			PlaceName:     "テスト",
			Category:      "cafe",
			Latitude:      35.67,
			Longitude:     139.65,
			IsBreakout: false,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&visit)

		result, err := services.ProcessGamification(testDB, user.ID, visit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		// 通常訪問50XP + ストリーク上限100XP = 150XP
		if result.XPEarned < 150 {
			t.Errorf("expected xp_earned >= 150 with max streak bonus (streak=10), got %d", result.XPEarned)
		}
	})

	t.Run("過去訪問から10km以上離れた場所への訪問で初エリアボーナス+30XPが付与される", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif_first_area@example.com")
		database.SeedMasterData(testDB)

		// 東京駅付近の過去訪問
		pastVisit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_tokyo_past",
			PlaceName:     "東京の場所",
			Category:      "cafe",
			Latitude:      35.6812,
			Longitude:     139.7671,
			IsBreakout: false,
			VisitedAt:     time.Now().Add(-24 * time.Hour),
		}
		testDB.Create(&pastVisit)
		// 過去訪問のXPを更新しておく（ロジック外のため手動でXP付与）
		testDB.Model(&pastVisit).Update("xp_earned", 50)

		// 横浜（東京から約30km）の新しい訪問
		newVisit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_yokohama_new",
			PlaceName:     "横浜の場所",
			Category:      "cafe",
			Latitude:      35.4660,
			Longitude:     139.6225,
			IsBreakout: false,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&newVisit)

		result, err := services.ProcessGamification(testDB, user.ID, newVisit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		// 通常訪問50XP + 初エリアボーナス30XP = 80XP
		if result.XPEarned < 80 {
			t.Errorf("expected xp_earned >= 80 with first area bonus, got %d", result.XPEarned)
		}
	})

	t.Run("過去訪問から10km未満の場所への訪問では初エリアボーナスが付かない", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif_no_area_bonus@example.com")
		database.SeedMasterData(testDB)

		// 東京駅付近の過去訪問
		pastVisit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_tokyo_near_past",
			PlaceName:     "東京の場所",
			Category:      "cafe",
			Latitude:      35.6812,
			Longitude:     139.7671,
			IsBreakout: false,
			VisitedAt:     time.Now().Add(-24 * time.Hour),
		}
		testDB.Create(&pastVisit)

		// 新宿（東京から約6km）の新しい訪問
		nearVisit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_shinjuku_near",
			PlaceName:     "新宿の場所",
			Category:      "cafe",
			Latitude:      35.6896,
			Longitude:     139.7006,
			IsBreakout: false,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&nearVisit)

		// 同一ジャンルを設定して近距離であることを明確にする
		tag := getOrCreateGenreTag(t, "カフェ")
		testDB.Model(&pastVisit).Update("genre_tag_id", tag.ID)
		nearVisit.GenreTagID = &tag.ID
		testDB.Save(&nearVisit)

		result, err := services.ProcessGamification(testDB, user.ID, nearVisit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		// 通常訪問50XP のみ（初エリアボーナス30XP は付かない）
		if result.XPEarned > 60 {
			t.Errorf("expected xp_earned <= 60 (no first area bonus), got %d", result.XPEarned)
		}
	})
}

// =============================================
// CalcLevel 追加境界値テスト
// =============================================

func TestCalcLevelAdditionalBoundaries(t *testing.T) {
	tests := []struct {
		name      string
		totalXP   int
		wantLevel int
	}{
		// Lv.5境界（802 XP）
		{"801XPはレベル4（Lv.5境界直前）", 801, 4},
		{"802XPはレベル5（Lv.5到達）", 802, 5},
		// Lv.2境界（100 XP）と直前（99 XP）は既存テストで網羅済みだが確認
		{"266XPはレベル2（Lv.3直前）", 266, 2},
		{"267XPはレベル3（Lv.3到達）", 267, 3},
		// Lv.15境界（7497 XP）
		{"7496XPはレベル14", 7496, 14},
		{"7497XPはレベル15", 7497, 15},
		// 負のXPはレベル1（0未満でも最低Lv.1）
		{"負のXPはレベル1", -1, 1},
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
// UpdateGenreProficiency Lv.30キャップテスト
// =============================================

func TestUpdateGenreProficiencyLevel30Cap(t *testing.T) {
	t.Run("ジャンルXPがLv.21相当（14730 XP）でLv.21になる（Lv.20キャップは解除済み）", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "prof_cap1@example.com")
		tag := getOrCreateGenreTag(t, "映画館")

		testDB.Create(&models.GenreProficiency{
			UserID:     user.ID,
			GenreTagID: tag.ID,
			XP:         14700,
			Level:      20,
		})

		// 30XPを加算してLv.21閾値（14730）を超える
		err := services.UpdateGenreProficiency(testDB, user.ID, &tag.ID, 30)
		if err != nil {
			t.Fatalf("UpdateGenreProficiency failed: %v", err)
		}

		var prof models.GenreProficiency
		testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, tag.ID).First(&prof)
		if prof.XP != 14730 {
			t.Errorf("expected xp=14730, got %d", prof.XP)
		}
		// Lv.20キャップが解除されているので、14730 XP → Lv.21 になるはず
		if prof.Level != 21 {
			t.Errorf("expected level=21 (Lv.20キャップ解除), got %d", prof.Level)
		}
	})

	t.Run("ジャンルXPがLv.30閾値（30000 XP）でLv.30になる", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "prof_cap2@example.com")
		tag := getOrCreateGenreTag(t, "カラオケ")

		err := services.UpdateGenreProficiency(testDB, user.ID, &tag.ID, 30000)
		if err != nil {
			t.Fatalf("UpdateGenreProficiency failed: %v", err)
		}

		var prof models.GenreProficiency
		testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, tag.ID).First(&prof)
		if prof.Level != 30 {
			t.Errorf("expected level=30 (Lv.30上限), got %d", prof.Level)
		}
	})

	t.Run("ジャンルXPがLv.30を超えるXP（50000 XP）でもLv.30にキャップされる", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "prof_cap3@example.com")
		tag := getOrCreateGenreTag(t, "居酒屋")

		err := services.UpdateGenreProficiency(testDB, user.ID, &tag.ID, 50000)
		if err != nil {
			t.Fatalf("UpdateGenreProficiency failed: %v", err)
		}

		var prof models.GenreProficiency
		testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, tag.ID).First(&prof)
		if prof.Level > 30 {
			t.Errorf("expected level <= 30 (Lv.30キャップ), got %d", prof.Level)
		}
		if prof.Level != 30 {
			t.Errorf("expected level=30, got %d", prof.Level)
		}
	})
}

// =============================================
// Issue #265: ストリークボーナスのジャンル熟練度反映テスト
// =============================================

func TestGenreProficiencyIncludesStreakBonus(t *testing.T) {
	t.Run("ProcessGamificationのストリークボーナスXPがジャンル熟練度に反映される", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "genre_streak@example.com")
		database.SeedMasterData(testDB)

		tag := getOrCreateGenreTag(t, "カフェ")

		// streak=4 を事前設定（UpdateStreak後に5になる）
		lastWeek := time.Now().AddDate(0, 0, -7)
		testDB.Model(&user).Updates(map[string]interface{}{
			"streak_count": 4,
			"streak_last":  lastWeek,
		})

		visit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_genre_streak",
			PlaceName:     "ストリークカフェ",
			Category:      "cafe",
			Latitude:      35.6895,
			Longitude:     139.6917,
			IsBreakout: false,
			GenreTagID:    &tag.ID,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&visit)

		result, err := services.ProcessGamification(testDB, user.ID, visit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		// ストリーク5週×10XP = 50XP のボーナスが発生する
		// 通常訪問50XP + ストリーク50XP = 100XP total
		if result.XPBreakdown == nil {
			t.Fatal("expected XPBreakdown to be non-nil")
		}
		if result.XPBreakdown.StreakBonus != 50 {
			t.Fatalf("expected streak bonus=50, got %d (test precondition failed)", result.XPBreakdown.StreakBonus)
		}

		var prof models.GenreProficiency
		testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, tag.ID).First(&prof)

		// ジャンル熟練度XPはユーザーが獲得したXP（ストリーク含む）と一致するはず
		if prof.XP != result.XPEarned {
			t.Errorf("genre proficiency XP (%d) should match XPEarned (%d) including streak bonus", prof.XP, result.XPEarned)
		}
	})
}

// =============================================
// isNightVisitJST 境界値テスト（CheckAndAwardBadges 経由）
// =============================================

func TestNightVisitBoundaries(t *testing.T) {
	jstZone := time.FixedZone("Asia/Tokyo", 9*60*60)

	t.Run("22時59分JSTの訪問ではナイトウォーカーバッジを獲得しない（h=22 → false）", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "night_boundary1@example.com")
		database.SeedMasterData(testDB)

		// 2024-01-15 22:59 JST（深夜帯の1分前）
		visitTime := time.Date(2024, 1, 15, 22, 59, 0, 0, jstZone)

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_night_22_59",
			PlaceName: "22時59分の場所",
			Category:  "cafe",
			Latitude:  35.67,
			Longitude: 139.65,
			VisitedAt: visitTime,
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 1, visitTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		for _, b := range newBadges {
			if b.Name == "ナイトウォーカー" {
				t.Errorf("should not award 'ナイトウォーカー' badge for 22:59 JST visit (h=22 < 23)")
			}
		}
	})

	t.Run("5時00分JSTの訪問ではナイトウォーカーバッジを獲得しない（h=5 → false）", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "night_boundary2@example.com")
		database.SeedMasterData(testDB)

		// 2024-01-16 5:00 JST（深夜帯終了後の境界）
		visitTime := time.Date(2024, 1, 16, 5, 0, 0, 0, jstZone)

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_night_5_00",
			PlaceName: "5時00分の場所",
			Category:  "cafe",
			Latitude:  35.67,
			Longitude: 139.65,
			VisitedAt: visitTime,
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 1, visitTime)
		if err != nil {
			t.Fatalf("CheckAndAwardBadges failed: %v", err)
		}

		for _, b := range newBadges {
			if b.Name == "ナイトウォーカー" {
				t.Errorf("should not award 'ナイトウォーカー' badge for 5:00 JST visit (h=5, not < 5)")
			}
		}
	})

	t.Run("4時59分JSTの訪問ではナイトウォーカーバッジを獲得する（h=4 → true）", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "night_boundary3@example.com")
		database.SeedMasterData(testDB)

		// 2024-01-16 4:59 JST（深夜帯終了の1分前）
		visitTime := time.Date(2024, 1, 16, 4, 59, 0, 0, jstZone)

		testDB.Create(&models.Visit{
			UserID:    user.ID,
			PlaceID:   "place_night_4_59",
			PlaceName: "4時59分の場所",
			Category:  "cafe",
			Latitude:  35.67,
			Longitude: 139.65,
			VisitedAt: visitTime,
		})

		newBadges, err := services.CheckAndAwardBadges(testDB, user.ID, false, 1, visitTime)
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
			t.Errorf("expected 'ナイトウォーカー' badge for 4:59 JST visit (h=4 < 5), got %v", newBadges)
		}
	})
}

// Issue #227: XP計算内訳テスト
func TestProcessGamificationXPBreakdown(t *testing.T) {
	t.Run("ProcessGamificationはXP内訳情報(XPBreakdown)を返す", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif_breakdown@example.com")
		database.SeedMasterData(testDB)

		tag := getOrCreateGenreTag(t, "カフェ")
		visit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_breakdown_test",
			PlaceName:     "ブレイクダウンテスト",
			Category:      "cafe",
			Latitude:      35.6895,
			Longitude:     139.6917,
			IsBreakout: false,
			GenreTagID:    &tag.ID,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&visit)

		result, err := services.ProcessGamification(testDB, user.ID, visit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}

		if result.XPBreakdown == nil {
			t.Fatal("expected XPBreakdown to be non-nil")
		}
		if result.XPBreakdown.BaseXP <= 0 {
			t.Errorf("expected BaseXP > 0, got %d", result.XPBreakdown.BaseXP)
		}
		// base_xp + その他 = XPEarned
		sum := result.XPBreakdown.BaseXP + result.XPBreakdown.FirstAreaBonus +
			result.XPBreakdown.MemoBonus + result.XPBreakdown.StreakBonus
		if sum != result.XPEarned {
			t.Errorf("XPBreakdown合計(%d) != XPEarned(%d)", sum, result.XPEarned)
		}
	})

	t.Run("脱却訪問のXPBreakdownはBaseXP=100を返す", func(t *testing.T) {
		cleanupUsers(t)
		user := createUser(t, "gamif_breakdown_escape@example.com")
		database.SeedMasterData(testDB)

		tag := getOrCreateGenreTag(t, "カフェ")
		visit := models.Visit{
			UserID:        user.ID,
			PlaceID:       "place_escape_test",
			PlaceName:     "脱却テスト",
			Category:      "cafe",
			Latitude:      35.6895,
			Longitude:     139.6917,
			IsBreakout: true, // 脱却訪問
			GenreTagID:    &tag.ID,
			VisitedAt:     time.Now(),
		}
		testDB.Create(&visit)

		result, err := services.ProcessGamification(testDB, user.ID, visit)
		if err != nil {
			t.Fatalf("ProcessGamification failed: %v", err)
		}
		if result.XPBreakdown == nil {
			t.Fatal("expected XPBreakdown to be non-nil")
		}
		if result.XPBreakdown.BaseXP != services.XPComfortBreak {
			t.Errorf("expected BaseXP=%d for comfort zone break, got %d", services.XPComfortBreak, result.XPBreakdown.BaseXP)
		}
	})
}
