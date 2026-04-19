package services_test

import (
	"sync"
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockPushSender はテスト用のPushSenderモック
type mockPushSender struct {
	mu    sync.Mutex
	calls []mockPushCall
}

type mockPushCall struct {
	UserID  uint64
	Payload services.PushPayload
}

type mockEmailSender struct {
	mu                sync.Mutex
	weeklyCalls       []weeklyEmailCall
	monthlyCalls      []monthlyEmailCall
	streakReminderLog []streakReminderCall
}

type weeklyEmailCall struct {
	toEmail string
	data    services.WeeklySummaryData
}

type monthlyEmailCall struct {
	toEmail string
	data    services.MonthlySummaryData
}

type streakReminderCall struct {
	toEmail     string
	userName    string
	streakWeeks int
}

func (m *mockEmailSender) SendStreakReminder(toEmail, userName string, streakWeeks int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.streakReminderLog = append(m.streakReminderLog, streakReminderCall{toEmail: toEmail, userName: userName, streakWeeks: streakWeeks})
	return nil
}

func (m *mockEmailSender) SendWeeklySummary(toEmail string, data services.WeeklySummaryData) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.weeklyCalls = append(m.weeklyCalls, weeklyEmailCall{toEmail: toEmail, data: data})
	return nil
}

func (m *mockEmailSender) SendMonthlySummary(toEmail string, data services.MonthlySummaryData) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.monthlyCalls = append(m.monthlyCalls, monthlyEmailCall{toEmail: toEmail, data: data})
	return nil
}

func (m *mockPushSender) SendToUser(userID uint64, payload services.PushPayload) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, mockPushCall{UserID: userID, Payload: payload})
	return nil
}

func (m *mockPushSender) CalledUserIDs() []uint64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	ids := make([]uint64, len(m.calls))
	for i, c := range m.calls {
		ids[i] = c.UserID
	}
	return ids
}

func cleanupNotificationSettings(t *testing.T) {
	t.Helper()
	testDB.Exec("DELETE FROM notification_settings")
}

// TestSchedulerJobsRegistered はStart()後に5件のジョブが登録されることを検証する
func TestSchedulerJobsRegistered(t *testing.T) {
	mockPush := &mockPushSender{}
	sched := services.NewNotificationScheduler(mockPush, nil, testDB)
	sched.Start()
	defer sched.Stop()

	assert.Equal(t, 5, services.NotificationSchedulerEntryCount(sched), "5件のジョブが登録されるべき")
}

// TestResetExpiredStreaks_ResetsUsersWhoMissedThisWeek は
// 当週未訪問かつ streak_count > 0 のユーザーの streak_count が 0 になることを検証する
func TestResetExpiredStreaks_ResetsUsersWhoMissedThisWeek(t *testing.T) {
	cleanupNotificationSettings(t)
	cleanupPushSubscriptions(t)
	cleanupUsers(t)

	now := time.Now().In(utils.JST)
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	thisMonday := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, utils.JST)
	lastWeekVisit := thisMonday.AddDate(0, 0, -3) // 先週の訪問

	// userA: streak_count > 0 かつ先週訪問 → リセット対象
	userA := createUser(t, "streak-reset-a@example.com")
	streakLast := lastWeekVisit
	require.NoError(t, testDB.Model(&userA).Updates(map[string]interface{}{
		"streak_count": 5,
		"streak_last":  streakLast,
	}).Error)

	// userB: streak_count > 0 かつ今週訪問済み → リセット対象外
	userB := createUser(t, "streak-reset-b@example.com")
	thisWeekVisit := thisMonday.Add(10 * time.Hour)
	streakLastB := thisWeekVisit
	require.NoError(t, testDB.Model(&userB).Updates(map[string]interface{}{
		"streak_count": 3,
		"streak_last":  streakLastB,
	}).Error)

	// userC: streak_count = 0 → リセット不要（対象外）
	userC := createUser(t, "streak-reset-c@example.com")
	streakLastC := lastWeekVisit
	require.NoError(t, testDB.Model(&userC).Updates(map[string]interface{}{
		"streak_count": 0,
		"streak_last":  streakLastC,
	}).Error)

	sched := services.NewNotificationScheduler(nil, nil, testDB)
	sched.ResetExpiredStreaks()

	var updatedA, updatedB, updatedC models.User
	require.NoError(t, testDB.First(&updatedA, userA.ID).Error)
	require.NoError(t, testDB.First(&updatedB, userB.ID).Error)
	require.NoError(t, testDB.First(&updatedC, userC.ID).Error)

	assert.Equal(t, 0, updatedA.StreakCount, "先週訪問・今週未訪問ユーザーのストリークは0になるべき")
	assert.Equal(t, 3, updatedB.StreakCount, "今週訪問済みユーザーのストリークは変わらないべき")
	assert.Equal(t, 0, updatedC.StreakCount, "streak_count=0のユーザーは変わらない")
}

// TestRunDailySuggestionNotification_SendsToSubscribers はPush購読ユーザーに
// SendToUserが呼ばれることを検証する
func TestRunDailySuggestionNotification_SendsToSubscribers(t *testing.T) {
	cleanupNotificationSettings(t)
	cleanupPushSubscriptions(t)
	cleanupUsers(t)

	user1 := createUser(t, "sched-daily-1@example.com")
	user2 := createUser(t, "sched-daily-2@example.com")

	// user1: Push購読あり、通知設定でIsDailySuggestionEnabled=true
	sub1 := models.PushSubscription{
		UserID:   user1.ID,
		Endpoint: "https://push.example.com/sched-sub1",
		P256DH:   "key1",
		Auth:     "auth1",
	}
	require.NoError(t, testDB.Create(&sub1).Error)

	settings1 := models.NotificationSettings{
		UserID:                   user1.ID,
		IsPushEnabled:            true,
		IsDailySuggestionEnabled: true,
	}
	require.NoError(t, testDB.Create(&settings1).Error)

	// user2: Push購読なし（通知設定のみ）
	settings2 := models.NotificationSettings{
		UserID:                   user2.ID,
		IsPushEnabled:            true,
		IsDailySuggestionEnabled: true,
	}
	require.NoError(t, testDB.Create(&settings2).Error)

	mockPush := &mockPushSender{}
	sched := services.NewNotificationScheduler(mockPush, nil, testDB)
	sched.SendDailySuggestionNotifications()

	calledIDs := mockPush.CalledUserIDs()
	assert.Contains(t, calledIDs, user1.ID, "Push購読ありユーザーにSendToUserが呼ばれるべき")
	assert.NotContains(t, calledIDs, user2.ID, "Push購読なしユーザーには呼ばれないべき")
}

// TestRunStreakReminderNotification_NotVisitedThisWeek は
// 「今週未訪問かつ streak_count > 0」のユーザーにのみリマインダーが送られることを検証する
func TestRunStreakReminderNotification_NotVisitedThisWeek(t *testing.T) {
	cleanupNotificationSettings(t)
	cleanupPushSubscriptions(t)
	cleanupUsers(t)

	now := time.Now().In(utils.JST)
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	thisMonday := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, utils.JST)
	lastMonday := thisMonday.AddDate(0, 0, -7)

	// userA: 今週訪問済み → 対象外
	userA := createUser(t, "streak-remind-a@example.com")
	testDB.Model(&userA).Updates(map[string]interface{}{
		"streak_count": 3,
		"streak_last":  thisMonday.Add(10 * time.Hour),
	})
	subA := models.PushSubscription{UserID: userA.ID, Endpoint: "https://push.example.com/remind-a", P256DH: "keyA", Auth: "authA"}
	require.NoError(t, testDB.Create(&subA).Error)
	require.NoError(t, testDB.Create(&models.NotificationSettings{UserID: userA.ID, IsPushEnabled: true, IsStreakReminderEnabled: true}).Error)

	// userB: 先週訪問・今週未訪問 → 対象
	userB := createUser(t, "streak-remind-b@example.com")
	testDB.Model(&userB).Updates(map[string]interface{}{
		"streak_count": 2,
		"streak_last":  lastMonday.Add(10 * time.Hour),
	})
	subB := models.PushSubscription{UserID: userB.ID, Endpoint: "https://push.example.com/remind-b", P256DH: "keyB", Auth: "authB"}
	require.NoError(t, testDB.Create(&subB).Error)
	require.NoError(t, testDB.Create(&models.NotificationSettings{UserID: userB.ID, IsPushEnabled: true, IsStreakReminderEnabled: true}).Error)

	// userC: streak_count=0 → 対象外
	userC := createUser(t, "streak-remind-c@example.com")
	testDB.Model(&userC).Updates(map[string]interface{}{
		"streak_count": 0,
		"streak_last":  lastMonday.Add(10 * time.Hour),
	})
	subC := models.PushSubscription{UserID: userC.ID, Endpoint: "https://push.example.com/remind-c", P256DH: "keyC", Auth: "authC"}
	require.NoError(t, testDB.Create(&subC).Error)
	require.NoError(t, testDB.Create(&models.NotificationSettings{UserID: userC.ID, IsPushEnabled: true, IsStreakReminderEnabled: true}).Error)

	mockPush := &mockPushSender{}
	sched := services.NewNotificationScheduler(mockPush, nil, testDB)
	sched.SendStreakReminderNotifications()

	calledIDs := mockPush.CalledUserIDs()
	assert.NotContains(t, calledIDs, userA.ID, "今週訪問済みユーザーには送らない")
	assert.Contains(t, calledIDs, userB.ID, "先週訪問・今週未訪問ユーザーには送る")
	assert.NotContains(t, calledIDs, userC.ID, "streak_count=0のユーザーには送らない")
}

func TestSendWeeklySummaryNotifications_PushAndEmail(t *testing.T) {
	cleanupNotificationSettings(t)
	cleanupPushSubscriptions(t)
	cleanupUsers(t)

	user := createUser(t, "weekly-summary@example.com")

	now := time.Now().In(utils.JST)
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	currentWeekMonday := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, utils.JST)
	lastWeekMonday := currentWeekMonday.AddDate(0, 0, -7)
	visitAt := lastWeekMonday.Add(10 * time.Hour)

	// 先週の訪問データ（集計対象）
	require.NoError(t, testDB.Create(&models.Visit{
		UserID:    user.ID,
		PlaceID:   "weekly-place",
		PlaceName: "Weekly Place",
		VisitedAt: visitAt,
		XpEarned:  120,
	}).Error)

	// Push購読 + 通知設定
	require.NoError(t, testDB.Create(&models.PushSubscription{
		UserID:   user.ID,
		Endpoint: "https://push.example.com/weekly",
		P256DH:   "key-weekly",
		Auth:     "auth-weekly",
	}).Error)
	require.NoError(t, testDB.Create(&models.NotificationSettings{
		UserID:                  user.ID,
		IsPushEnabled:           true,
		IsEmailEnabled:          true,
		IsWeeklySummaryEnabled:  true,
		IsMonthlySummaryEnabled: false,
	}).Error)

	mockPush := &mockPushSender{}
	mockEmail := &mockEmailSender{}
	sched := services.NewNotificationScheduler(mockPush, mockEmail, testDB)
	sched.SendWeeklySummaryNotifications()

	calledIDs := mockPush.CalledUserIDs()
	assert.Contains(t, calledIDs, user.ID, "週次サマリーPushが送信されるべき")

	require.Len(t, mockEmail.weeklyCalls, 1, "週次サマリーメールが1件送信されるべき")
	assert.Equal(t, user.Email, mockEmail.weeklyCalls[0].toEmail)
	assert.Equal(t, 1, mockEmail.weeklyCalls[0].data.VisitCount)
	assert.Equal(t, 120, mockEmail.weeklyCalls[0].data.TotalXP)
}

// TestDailySuggestionPayload_Saturday は土曜日に土曜専用文言が返ることを検証する
func TestDailySuggestionPayload_Saturday(t *testing.T) {
	payload := services.DailySuggestionPayload(time.Saturday)
	assert.Equal(t, "今日は土曜日！ちょっとお出かけしてみない？", payload.Body)
}

// TestDailySuggestionPayload_Sunday は日曜日に日曜専用文言が返ることを検証する
func TestDailySuggestionPayload_Sunday(t *testing.T) {
	payload := services.DailySuggestionPayload(time.Sunday)
	assert.Equal(t, "今日は日曜日！絶好のお出かけ日和だね！", payload.Body)
}

// TestDailySuggestionPayload_Weekday は平日にデフォルト文言が返ることを検証する
func TestDailySuggestionPayload_Weekday(t *testing.T) {
	for _, weekday := range []time.Weekday{time.Monday, time.Tuesday, time.Wednesday, time.Thursday, time.Friday} {
		payload := services.DailySuggestionPayload(weekday)
		assert.Equal(t, "Roambleをのぞいてみて。新しい冒険があなたを待ってる！", payload.Body)
	}
}

func TestSendMonthlySummaryNotifications_PushAndEmail(t *testing.T) {
	cleanupNotificationSettings(t)
	cleanupPushSubscriptions(t)
	cleanupUsers(t)

	user := createUser(t, "monthly-summary@example.com")

	now := time.Now().In(utils.JST)
	lastMonth := now.AddDate(0, -1, 0)
	monthStart := time.Date(lastMonth.Year(), lastMonth.Month(), 1, 0, 0, 0, 0, utils.JST)
	visitAt := monthStart.Add(12 * time.Hour)

	require.NoError(t, testDB.Create(&models.Visit{
		UserID:    user.ID,
		PlaceID:   "monthly-place",
		PlaceName: "Monthly Place",
		VisitedAt: visitAt,
		XpEarned:  200,
	}).Error)

	require.NoError(t, testDB.Create(&models.PushSubscription{
		UserID:   user.ID,
		Endpoint: "https://push.example.com/monthly",
		P256DH:   "key-monthly",
		Auth:     "auth-monthly",
	}).Error)
	require.NoError(t, testDB.Create(&models.NotificationSettings{
		UserID:                  user.ID,
		IsPushEnabled:           true,
		IsEmailEnabled:          true,
		IsWeeklySummaryEnabled:  false,
		IsMonthlySummaryEnabled: true,
	}).Error)

	mockPush := &mockPushSender{}
	mockEmail := &mockEmailSender{}
	sched := services.NewNotificationScheduler(mockPush, mockEmail, testDB)
	sched.SendMonthlySummaryNotifications()

	calledIDs := mockPush.CalledUserIDs()
	assert.Contains(t, calledIDs, user.ID, "月次サマリーPushが送信されるべき")

	require.Len(t, mockEmail.monthlyCalls, 1, "月次サマリーメールが1件送信されるべき")
	assert.Equal(t, user.Email, mockEmail.monthlyCalls[0].toEmail)
	assert.Equal(t, 1, mockEmail.monthlyCalls[0].data.VisitCount)
	assert.Equal(t, 200, mockEmail.monthlyCalls[0].data.TotalXP)
	assert.Contains(t, mockEmail.monthlyCalls[0].data.YearMonth, "年")
}
