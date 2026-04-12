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

// TestSchedulerJobsRegistered はStart()後に4件のジョブが登録されることを検証する
func TestSchedulerJobsRegistered(t *testing.T) {
	mockPush := &mockPushSender{}
	sched := services.NewNotificationScheduler(mockPush, nil, testDB)
	sched.Start()
	defer sched.Stop()

	assert.Equal(t, 4, services.NotificationSchedulerEntryCount(sched), "4件のジョブが登録されるべき")
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
