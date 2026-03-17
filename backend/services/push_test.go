package services_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func cleanupPushSubscriptions(t *testing.T) {
	t.Helper()
	testDB.Exec("DELETE FROM push_subscriptions")
}

// TestSendPushToUser_410RemovesSubscription はモックサーバーが410を返した場合に
// 該当購読がDBから削除されることを検証する
func TestSendPushToUser_410RemovesSubscription(t *testing.T) {
	cleanupPushSubscriptions(t)
	cleanupUsers(t)

	user := createUser(t, "push-test-410@example.com")

	// モックHTTPサーバーが 410 を返す
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusGone)
	}))
	defer mockServer.Close()

	// テスト用の有効なP256DH鍵とAuth（webpush-goのテストで使われているもの）
	sub := models.PushSubscription{
		UserID:   user.ID,
		Endpoint: mockServer.URL,
		P256DH:   "BNNL5ZaTfK81qhXOx23-wewhigUeFb632jN6LvRWCFH1ubQr77FE_9qV1FuojuRmHP42zmf34rXgW80OvUVDgTk",
		Auth:     "zqbxT6JKstKSY9JKibZLSQ",
	}
	require.NoError(t, testDB.Create(&sub).Error)

	svc := services.NewPushServiceWithClient(
		testDB,
		"test-public-key",
		"test-private-key",
		"mailto:test@example.com",
		&http.Client{Transport: &mockTransport{server: mockServer}},
	)

	payload := services.PushPayload{
		Title: "テスト通知",
		Body:  "テスト本文",
		URL:   "/home",
	}

	// 送信を実行（410なので内部でcleanupが走る）
	_ = svc.SendToUser(user.ID, payload)

	// 購読がDBから削除されていることを確認
	var count int64
	testDB.Model(&models.PushSubscription{}).Where("endpoint = ?", mockServer.URL).Count(&count)
	assert.Equal(t, int64(0), count, "410応答時に購読がDBから削除されるべき")
}

// TestSendPushToUser_Success はモックサーバーが201を返した場合に
// 購読がDBに残ることを検証する
func TestSendPushToUser_Success(t *testing.T) {
	cleanupPushSubscriptions(t)
	cleanupUsers(t)

	user := createUser(t, "push-test-success@example.com")

	// モックHTTPサーバーが 201 を返す
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer mockServer.Close()

	sub := models.PushSubscription{
		UserID:   user.ID,
		Endpoint: mockServer.URL,
		P256DH:   "BNNL5ZaTfK81qhXOx23-wewhigUeFb632jN6LvRWCFH1ubQr77FE_9qV1FuojuRmHP42zmf34rXgW80OvUVDgTk",
		Auth:     "zqbxT6JKstKSY9JKibZLSQ",
	}
	require.NoError(t, testDB.Create(&sub).Error)

	svc := services.NewPushServiceWithClient(
		testDB,
		"test-public-key",
		"test-private-key",
		"mailto:test@example.com",
		&http.Client{Transport: &mockTransport{server: mockServer}},
	)

	payload := services.PushPayload{
		Title: "テスト通知",
		Body:  "テスト本文",
		URL:   "/home",
	}

	err := svc.SendToUser(user.ID, payload)

	// 成功レスポンスなのでエラーなし
	assert.NoError(t, err)

	// 購読がDBに残っていることを確認
	var count int64
	testDB.Model(&models.PushSubscription{}).Where("endpoint = ?", mockServer.URL).Count(&count)
	assert.Equal(t, int64(1), count, "200/201応答時に購読はDBに残るべき")
}

// TestPushPayload_JSONSerialization はPushPayloadのJSONシリアライズが
// 正しく行われることを確認する
func TestPushPayload_JSONSerialization(t *testing.T) {
	payload := services.PushPayload{
		Title: "新しい提案",
		Body:  "今日のおすすめスポットがあります",
		URL:   "/suggestions",
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded services.PushPayload
	require.NoError(t, json.Unmarshal(data, &decoded))

	assert.Equal(t, payload.Title, decoded.Title)
	assert.Equal(t, payload.Body, decoded.Body)
	assert.Equal(t, payload.URL, decoded.URL)
}

// mockTransport はモックサーバーに全リクエストをリダイレクトするHTTPトランスポート
type mockTransport struct {
	server *httptest.Server
}

func (t *mockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// モックサーバーのURLに置き換えてリクエストを送信
	req2, err := http.NewRequest(req.Method, t.server.URL, req.Body)
	if err != nil {
		return nil, err
	}
	req2.Header = req.Header
	return http.DefaultTransport.RoundTrip(req2)
}
