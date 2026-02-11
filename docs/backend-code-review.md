# バックエンドコードレビュー結果

> 対象: `backend/` ディレクトリ全体（Go + Gin）
> 実施日: 2026-02-11
> フェーズ: Phase 0（最小公開・簡易版）

---

## 総合評価

| 観点 | 評価 | コメント |
|------|------|----------|
| 可読性 | 4/5 | 関数が短く構造が明確。Swagger docコメントも付与されている |
| 命名規則 | 4/5 | Goの規約に従ったcamelCase命名。意図が明確 |
| DRY | 3/5 | テストヘルパーの重複、バリデーションエラーレスポンスのパターン重複あり |
| エラーハンドリング | 3/5 | 基本パスは処理済みだが、Redis障害時やJSON Unmarshalエラー等の見落としあり |
| セキュリティ | 4/5 | JWT署名検証・bcrypt・json除外など基本対策済み。CORS・トークン無効化に改善余地 |
| テストカバレッジ | 4/5 | ハッピーパス・エラーケース充実。JWT攻撃テストやE2Eテストあり |
| パフォーマンス | 3/5 | limit上限なしが最大の懸念。DBインデックスは適切 |

---

## Critical（本番デプロイ前に対応必須）

### C-1: `ListVisits` の limit に上限制限がない

**ファイル**: `handlers/visit.go:92-98`

`limit` パラメータに上限チェックがないため、`?limit=1000000` のようなリクエストでメモリ枯渇やDB負荷によるDoS攻撃のベクトルになる。

```go
// 修正方針: 最大値を定数で定義し、上限を超える場合はキャップする
const maxLimit = 100

if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
    limit = parsed
    if limit > maxLimit {
        limit = maxLimit
    }
}
```

### C-2: CORS設定で `AllowOrigins: ["*"]` を使用

**ファイル**: `middleware/cors.go:12`

全オリジンからのリクエストを許可している。本番環境ではフロントエンドのオリジンを明示的に指定すべき。

```go
// 修正方針: 環境変数で指定
AllowOrigins: []string{os.Getenv("CORS_ALLOWED_ORIGIN")},
```

### C-3: Redisブラックリストチェックで `redis.Nil` 以外のエラーを無視

**ファイル**: `middleware/jwt.go:44-50`

Redis障害時（接続障害、タイムアウト等）にエラーが無視され、ログアウト済みトークンが有効として扱われるセキュリティリスクがある。

```go
// 修正方針: redis.Nil とそれ以外のエラーを区別する
_, err = redisClient.Get(ctx, key).Result()
if err == nil {
    c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token has been revoked"})
    return
}
if err != redis.Nil {
    log.Printf("Redis blacklist check failed: %v", err)
    c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
    return
}
```

### C-4: `suggestionRequest` の `lat`/`lng` バリデーション不足

**ファイル**: `handlers/suggestion.go:128-132`

- `binding:"required"` はfloat64のゼロ値(0.0)を「未送信」と区別できない
- 無効な座標値（`lat: -999` 等）が通過してしまう
- `Radius` にも上限がない（Google Places APIの上限は50000m）

```go
// 修正方針: 明示的な範囲バリデーションを使う
type suggestionRequest struct {
    Lat    float64 `json:"lat" binding:"min=-90,max=90"`
    Lng    float64 `json:"lng" binding:"min=-180,max=180"`
    Radius uint    `json:"radius" binding:"max=50000"`
}
```

---

## Important（早期対応推奨）

### I-1: グローバル変数 `DB`/`RedisClient` とDIパターンの混在

**ファイル**: `database/db.go:12`, `database/redis.go:11`

`Init()`/`InitRedis()` は戻り値としてインスタンスを返しつつ、グローバル変数にもセットしている。`main.go` ではDIパターンを使うが、`Close()` や `GetDB()` はグローバル変数に依存。テスト時のグローバル状態汚染リスクあり。

**修正方針**: グローバル変数を排除し、DIパターンに統一する。

### I-2: `ErrorHandler` が内部エラーの詳細をクライアントに返している

**ファイル**: `middleware/error_handler.go:19-23`

`lastErr.Error()` にGormのエラーメッセージやスタックトレースが含まれる可能性があり、DB構造やテーブル名等の情報漏洩リスクがある。

**修正方針**: クライアントには汎用メッセージを返し、詳細はサーバーログにのみ記録する。

### I-3: バリデーションエラーメッセージが詳細すぎる

**ファイル**: `handlers/auth.go:54-57` 他全ハンドラー

Ginのバリデーションエラーメッセージが内部実装の詳細（フィールド名・バリデーションタグ等）を含み、攻撃者にルールを直接知らせることになる。

**修正方針**: バリデーションエラーをユーザーフレンドリーなメッセージに変換するヘルパー関数を作成する。

### I-4: `SignUp` のメール重複チェックにTOCTOU競合の可能性

**ファイル**: `handlers/auth.go:60-65`

SELECTでチェックしてからINSERTする間に別リクエストで同じメールが登録される可能性がある。ユニーク制約違反時のGORMエラーが適切にハンドリングされていない。

**修正方針**: SELECTチェックを削除し、INSERT時のユニーク制約違反をキャッチして409を返す。

### I-5: `Suggest` ハンドラーで `json.Unmarshal` のエラーが無視されている

**ファイル**: `handlers/suggestion.go:172`

キャッシュデータが破損している場合に不正なデータが使用される可能性がある。197行目の `json.Marshal` も同様。

**修正方針**: エラーチェックを追加し、失敗時はキャッシュ無効として扱う。

### I-6: `RefreshToken` でユーザーの存在確認がない

**ファイル**: `handlers/auth.go:159-191`

削除されたユーザーのリフレッシュトークンで新しいアクセストークンが発行されてしまう。

**修正方針**: トークン検証後にDBでユーザーの存在確認を追加する。

### I-7: ログアウト後もリフレッシュトークンが有効

**ファイル**: `handlers/auth.go:159-191`

ログアウト時にアクセストークンはブラックリスト登録されるが、リフレッシュトークンは登録されない。ログアウトの意味が実質的に無効化されている。

**修正方針**: ログアウト時にリフレッシュトークンもブラックリストに登録する。`RefreshToken` ハンドラー内でもブラックリストチェックを行う。

### I-8: `router.Run()` のエラーが無視されている

**ファイル**: `main.go:98`

ポートが既に使用中の場合などにサイレントフェイルする。

```go
// 修正方針
if err := router.Run(":8000"); err != nil {
    log.Fatalf("Failed to start server: %v", err)
}
```

### I-9: ポート番号のハードコード

**ファイル**: `main.go:98`

```go
// 修正方針: 環境変数から読み取る
port := os.Getenv("PORT")
if port == "" {
    port = "8000"
}
```

### I-10: `testutil.LoadTestEnv()` が `os.Setenv` でグローバル環境変数を変更

**ファイル**: `testutil/db.go:25-28`

`os.Setenv` はプロセス全体のグローバル環境変数を変更するため、並行テスト間で干渉するリスクがある。`auth_test.go:42,49` でも同様。

---

## Suggestion（改善提案）

| # | 指摘 | ファイル |
|---|------|---------|
| S-1 | `MYSQL_PORT` にデフォルト値 `3306` を設定（Redisの `6379` と一貫性を持たせる） | `database/db.go:18` |
| S-2 | `Rating` に範囲バリデーション追加（`binding:"omitempty,min=0,max=5"`） | `handlers/visit.go:23` |
| S-3 | ビルドバイナリ `roamble` が `.gitignore` に含まれているか確認 | `backend/roamble` |
| S-4 | 本番用にマルチステージDockerビルドを検討（イメージサイズ・攻撃面の削減） | `Dockerfile` |
| S-5 | Places APIクライアント関連コードを `places/` パッケージに分離 | `handlers/suggestion.go` |
| S-6 | テストヘルパー `createTestUser` / `createTestUserForVisit` の統合 | `suggestion_test.go`, `visit_test.go` |
| S-7 | `JWT_SECRET` の最小長チェック追加（HMAC-SHA256では32バイト以上推奨） | `config/config.go:18-21` |
| S-8 | `isVisitablePlace` の単体テスト追加 | `handlers/suggestion.go:71-111` |
| S-9 | 構造化ログ（`log/slog`）の導入検討 | 全体 |
| S-10 | `Logout` でのAuthorizationヘッダー再パースが冗長（ミドルウェアで検証済み） | `handlers/auth.go:205-211` |

---

## 良い実践として認められる点

1. **JWTの署名アルゴリズム検証**: `ValidateToken` でHMAC以外の署名方法を拒否。`none`アルゴリズム攻撃に対するテストも含まれている
2. **パスワードのJSON除外**: `models.User` の `PasswordHash` に `json:"-"` タグ設定済み。テストでも検証
3. **PlacesSearcher インターフェースによるテスタビリティ**: 外部APIをインターフェースで抽象化し、テストではモックを使用
4. **トークンタイプの区別**: アクセストークンとリフレッシュトークンに `token_type` クレームを設定・検証
5. **ログアウト後のトークン無効化テスト**: E2Eレベルでテスト済み
6. **ページネーション実装**: limit/offsetベースのページネーション + totalカウント
7. **`.env` の `.gitignore` 設定**: 機密ファイルがGit管理から除外済み
8. **bcryptの使用**: 適切なコストでパスワードハッシュ化
9. **Place タイプフィルタリング**: 訪問に不適切な場所を除外する `visitableTypes` 許可リスト
10. **Redisキャッシュ戦略**: Places APIレスポンスをTTL 24hでキャッシュ。`RedisClient` がnilの場合のフォールバックも実装
