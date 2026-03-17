package services_test

import (
	"sync"
	"testing"

	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
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

	assert.Equal(t, 4, sched.EntryCount(), "4件のジョブが登録されるべき")
}

// TestRunDailySuggestionNotification_SendsToSubscribers はPush購読ユーザーに
// SendToUserが呼ばれることを検証する
func TestRunDailySuggestionNotification_SendsToSubscribers(t *testing.T) {
	cleanupNotificationSettings(t)
	cleanupPushSubscriptions(t)
	cleanupUsers(t)

	user1 := createUser(t, "sched-daily-1@example.com")
	user2 := createUser(t, "sched-daily-2@example.com")

	// user1: Push購読あり、通知設定でDailySuggestion=true
	sub1 := models.PushSubscription{
		UserID:   user1.ID,
		Endpoint: "https://push.example.com/sched-sub1",
		P256DH:   "key1",
		Auth:     "auth1",
	}
	require.NoError(t, testDB.Create(&sub1).Error)

	settings1 := models.NotificationSettings{
		UserID:          user1.ID,
		PushEnabled:     true,
		DailySuggestion: true,
	}
	require.NoError(t, testDB.Create(&settings1).Error)

	// user2: Push購読なし（通知設定のみ）
	settings2 := models.NotificationSettings{
		UserID:          user2.ID,
		PushEnabled:     true,
		DailySuggestion: true,
	}
	require.NoError(t, testDB.Create(&settings2).Error)

	mockPush := &mockPushSender{}
	sched := services.NewNotificationScheduler(mockPush, nil, testDB)
	sched.RunDailySuggestionNotification()

	calledIDs := mockPush.CalledUserIDs()
	assert.Contains(t, calledIDs, user1.ID, "Push購読ありユーザーにSendToUserが呼ばれるべき")
	assert.NotContains(t, calledIDs, user2.ID, "Push購読なしユーザーには呼ばれないべき")
}
