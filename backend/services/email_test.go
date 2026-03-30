package services_test

import (
	"strings"
	"testing"

	"github.com/Hiru-ge/roamble/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildStreakReminderEmail(t *testing.T) {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	html, err := svc.BuildStreakReminderEmail("テストユーザー", 3)

	require.NoError(t, err)
	assert.True(t, strings.Contains(html, "テストユーザーさん"), "ユーザー名+さんが含まれていること")
	assert.True(t, strings.Contains(html, "3"), "ストリーク週数が含まれていること")
	assert.True(t, strings.Contains(html, "fire.svg"), "炎アイコンが含まれていること")
	assert.False(t, containsEmoji(html), "絵文字が含まれていないこと")
}

func TestBuildWeeklySummaryEmail(t *testing.T) {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	data := services.WeeklySummaryData{
		UserName:   "テストユーザー",
		VisitCount: 5,
		TotalXP:    250,
		NewBadges:  services.BadgeItemsFromNames([]string{"最初の一歩"}),
	}

	html, err := svc.BuildWeeklySummaryHTML(data)

	require.NoError(t, err)
	assert.True(t, strings.Contains(html, "テストユーザーさん"), "ユーザー名+さんが含まれていること")
	assert.True(t, strings.Contains(html, "5"), "訪問件数が含まれていること")
	assert.True(t, strings.Contains(html, "250"), "獲得XPが含まれていること")
	assert.True(t, strings.Contains(html, "最初の一歩"), "バッジ名が含まれていること")
	assert.True(t, strings.Contains(html, "badge-footprint.svg"), "バッジアイコンURLが含まれていること")
	assert.True(t, strings.Contains(html, "pin.svg"), "ピンアイコンが含まれていること")
	assert.True(t, strings.Contains(html, "bolt.svg"), "ボルトアイコンが含まれていること")
	assert.False(t, containsEmoji(html), "絵文字が含まれていないこと")
}

func TestBuildMonthlySummaryEmail(t *testing.T) {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	data := services.MonthlySummaryData{
		UserName:   "テストユーザー",
		VisitCount: 12,
		TotalXP:    800,
		NewBadges:  services.BadgeItemsFromNames([]string{"最初の一歩"}),
		YearMonth:  "2026年3月",
	}

	html, err := svc.BuildMonthlySummaryHTML(data)

	require.NoError(t, err)
	assert.True(t, strings.Contains(html, "テストユーザーさん"), "ユーザー名+さんが含まれていること")
	assert.True(t, strings.Contains(html, "12"), "訪問件数が含まれていること")
	assert.True(t, strings.Contains(html, "800"), "獲得XPが含まれていること")
	assert.True(t, strings.Contains(html, "2026年3月"), "月が含まれていること")
	assert.True(t, strings.Contains(html, "最初の一歩"), "バッジ名が含まれていること")
	assert.True(t, strings.Contains(html, "badge-footprint.svg"), "バッジアイコンURLが含まれていること")
	assert.False(t, containsEmoji(html), "絵文字が含まれていないこと")
}

func TestBuildWeeklySummaryEmptyEmail(t *testing.T) {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	data := services.WeeklySummaryData{
		UserName:   "テストユーザー",
		VisitCount: 0,
		TotalXP:    0,
		NewBadges:  []services.BadgeItem{},
	}

	html, err := svc.BuildWeeklySummaryHTML(data)

	require.NoError(t, err)
	assert.True(t, strings.Contains(html, "テストユーザーさん"), "ユーザー名+さんが含まれていること")
	assert.True(t, strings.Contains(html, "今週は冒険できなかった"), "空状態メッセージが含まれていること")
	assert.True(t, strings.Contains(html, "来週"), "来週への背中押しメッセージが含まれていること")
	assert.False(t, containsEmoji(html), "絵文字が含まれていないこと")
}

func TestBuildMonthlySummaryEmptyEmail(t *testing.T) {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	data := services.MonthlySummaryData{
		UserName:   "テストユーザー",
		VisitCount: 0,
		TotalXP:    0,
		NewBadges:  []services.BadgeItem{},
		YearMonth:  "2026年3月",
	}

	html, err := svc.BuildMonthlySummaryHTML(data)

	require.NoError(t, err)
	assert.True(t, strings.Contains(html, "テストユーザーさん"), "ユーザー名+さんが含まれていること")
	assert.True(t, strings.Contains(html, "2026年3月"), "月が含まれていること")
	assert.True(t, strings.Contains(html, "今月は冒険できなかった"), "空状態メッセージが含まれていること")
	assert.True(t, strings.Contains(html, "来月"), "来月への背中押しメッセージが含まれていること")
	assert.False(t, containsEmoji(html), "絵文字が含まれていないこと")
}

func TestBadgeItemsFromNames(t *testing.T) {
	items := services.BadgeItemsFromNames([]string{"最初の一歩", "エリアパイオニア", "未知のバッジ"})

	require.Len(t, items, 3)
	assert.Equal(t, "最初の一歩", items[0].Name)
	assert.Contains(t, items[0].IconURL, "badge-footprint.svg")
	assert.Equal(t, "エリアパイオニア", items[1].Name)
	assert.Contains(t, items[1].IconURL, "badge-explore.svg")
	assert.Equal(t, "未知のバッジ", items[2].Name)
	assert.Contains(t, items[2].IconURL, "badge-default.svg")
}

// containsEmoji は文字列にUnicode絵文字が含まれているかを判定する
func containsEmoji(s string) bool {
	for _, r := range s {
		if (r >= 0x1F600 && r <= 0x1F64F) ||
			(r >= 0x1F300 && r <= 0x1F5FF) ||
			(r >= 0x1F680 && r <= 0x1F6FF) ||
			(r >= 0x1F900 && r <= 0x1F9FF) ||
			(r >= 0x2600 && r <= 0x26FF) ||
			(r >= 0x2700 && r <= 0x27BF) ||
			(r >= 0x1FA00 && r <= 0x1FA6F) ||
			(r >= 0x1FA70 && r <= 0x1FAFF) {
			return true
		}
	}
	return false
}
