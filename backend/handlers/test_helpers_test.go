package handlers

// このファイルは handlers パッケージのテストで共通利用するヘルパー関数を集約する。
// テスト専用ファイル (_test.go) なのでビルド成果物には含まれない。

import (
	"testing"

	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/utils"
)

// cleanupUsers はテスト前後の DB クリーンアップに使用する共通ヘルパー。
// visit_history → users の順で DELETE する（外部キー制約対応）。
func cleanupUsers(t *testing.T) {
	t.Helper()
	testDB.Exec("DELETE FROM visit_history")
	testDB.Exec("DELETE FROM users")
}

// generateTestToken は指定 userID の JWT アクセストークンを生成する共通ヘルパー。
func generateTestToken(userID uint64) string {
	token, _ := utils.GenerateAccessToken(
		userID,
		testAuthHandler.JWTCfg.Secret,
		testAuthHandler.JWTCfg.AccessExpiry,
	)
	return token
}

// boolPtr はテスト用に bool のポインタを返すヘルパー。
func boolPtr(b bool) *bool { return &b }

// createTestUserByEmail は任意のメールアドレスでテストユーザーを作成する汎用ヘルパー。
// 各テストファイル内の createTestUser* 系関数はこれを呼び出す。
func createTestUserByEmail(t *testing.T, email, displayName string) models.User {
	t.Helper()
	user := models.User{
		Email:       email,
		DisplayName: displayName,
	}
	testDB.Create(&user)
	return user
}
