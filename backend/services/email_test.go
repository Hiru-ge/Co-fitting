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
	assert.True(t, strings.Contains(html, "テストユーザー"), "ユーザー名が含まれていること")
	assert.True(t, strings.Contains(html, "3"), "ストリーク週数が含まれていること")
}

func TestBuildWeeklySummaryEmail(t *testing.T) {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	data := services.WeeklySummaryData{
		UserName:   "テストユーザー",
		VisitCount: 5,
		TotalXP:    250,
		NewBadges:  []string{"最初の一歩"},
	}

	html, err := svc.BuildWeeklySummaryEmail(data)

	require.NoError(t, err)
	assert.True(t, strings.Contains(html, "テストユーザー"), "ユーザー名が含まれていること")
	assert.True(t, strings.Contains(html, "5"), "訪問件数が含まれていること")
	assert.True(t, strings.Contains(html, "250"), "獲得XPが含まれていること")
	assert.True(t, strings.Contains(html, "最初の一歩"), "バッジ名が含まれていること")
}

func TestBuildMonthlySummaryEmail(t *testing.T) {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	data := services.MonthlySummaryData{
		UserName:   "テストユーザー",
		VisitCount: 12,
		TotalXP:    800,
		NewBadges:  []string{"最初の一歩"},
		Month:      "2026年3月",
	}

	html, err := svc.BuildMonthlySummaryEmail(data)

	require.NoError(t, err)
	assert.True(t, strings.Contains(html, "テストユーザー"), "ユーザー名が含まれていること")
	assert.True(t, strings.Contains(html, "12"), "訪問件数が含まれていること")
	assert.True(t, strings.Contains(html, "800"), "獲得XPが含まれていること")
	assert.True(t, strings.Contains(html, "2026年3月"), "月が含まれていること")
	assert.True(t, strings.Contains(html, "最初の一歩"), "バッジ名が含まれていること")
}

func TestBuildWeeklySummaryEmptyEmail(t *testing.T) {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	data := services.WeeklySummaryData{
		UserName:   "テストユーザー",
		VisitCount: 0,
		TotalXP:    0,
		NewBadges:  []string{},
	}

	html, err := svc.BuildWeeklySummaryEmail(data)

	require.NoError(t, err)
	assert.True(t, strings.Contains(html, "テストユーザー"), "ユーザー名が含まれていること")
	assert.True(t, strings.Contains(html, "今週は冒険できなかった"), "空状態メッセージが含まれていること")
	assert.True(t, strings.Contains(html, "来週"), "来週への背中押しメッセージが含まれていること")
}

func TestBuildMonthlySummaryEmptyEmail(t *testing.T) {
	svc := services.NewEmailService("dummy-key", "noreply@roamble.app")

	data := services.MonthlySummaryData{
		UserName:   "テストユーザー",
		VisitCount: 0,
		TotalXP:    0,
		NewBadges:  []string{},
		Month:      "2026年3月",
	}

	html, err := svc.BuildMonthlySummaryEmail(data)

	require.NoError(t, err)
	assert.True(t, strings.Contains(html, "テストユーザー"), "ユーザー名が含まれていること")
	assert.True(t, strings.Contains(html, "2026年3月"), "月が含まれていること")
	assert.True(t, strings.Contains(html, "今月は冒険できなかった"), "空状態メッセージが含まれていること")
	assert.True(t, strings.Contains(html, "来月"), "来月への背中押しメッセージが含まれていること")
}
