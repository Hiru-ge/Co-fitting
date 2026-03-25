package testutil

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/joho/godotenv"
)

// LoadTestEnv はプロジェクトルートの .env からDB接続情報を読み込み、
// テスト用DBに接続するための環境変数を設定する。
// テストファイル用の共通ヘルパー。
func LoadTestEnv() {
	_, filename, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(filename), "..", "..")
	envPath := filepath.Join(projectRoot, ".env")

	if err := godotenv.Load(envPath); err != nil {
		fmt.Println("testutil: .env not found, using existing environment variables")
	}

	// テスト用DB名・root接続に上書き
	os.Setenv("MYSQL_USER", "root")                               //nolint:errcheck
	os.Setenv("MYSQL_PASSWORD", os.Getenv("MYSQL_ROOT_PASSWORD")) //nolint:errcheck
	os.Setenv("MYSQL_DATABASE", "roamble_test")                   //nolint:errcheck
	os.Setenv("MYSQL_HOST", "localhost")                          //nolint:errcheck
}
