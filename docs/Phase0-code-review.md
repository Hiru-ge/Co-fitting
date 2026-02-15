# Phase 0 コードレビュー結果

**レビュー日**: 2026-02-15  
**対象**: Phase 0（コアループ「提案→行動→記録」）全コード  
**重点観点**: セキュリティ / テストカバレッジ

---

## 📋 概要

Phase 0として「提案→行動→記録」のコアループが実装されている。Go (Gin) バックエンド + React (React Router) フロントエンド + MySQL + Redis の構成で、認証(JWT)・提案(Google Places API)・訪問記録の機能が揃っている。全体的に堅実な実装だが、セキュリティとテストカバレッジの観点でいくつか指摘事項がある。

---

## 🔴 Critical Issues

### 1. CORS設定が `AllowOrigins: ["*"]` で全開放

**ファイル**: `backend/middleware/cors.go` L11

`AllowOrigins: []string{"*"}` となっている。本番デプロイ時にこのままだと、悪意のあるサイトからの認証付きリクエストが通ってしまう。

```go
// 現状
AllowOrigins: []string{"*"},

// 推奨: 環境変数で制御
AllowOrigins: []string{os.Getenv("ALLOWED_ORIGIN")}, // e.g. "https://roamble.app"
```

Phase 0でもデプロイ予定があるなら、環境変数ベースに切り替えるべき。

### 2. API_BASE_URL がハードコード

**ファイル**: `frontend/app/utils/constants.ts` L1

`API_BASE_URL = "http://localhost:8000"` がハードコードされている。本番デプロイ時にビルドが壊れる。

```typescript
// 推奨
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
```

### 3. Google Places API Key が Place Photo のURLに含まれてフロントへ露出する可能性

**ファイル**: `backend/handlers/place_photo.go` L41-L44

`resolvePhotoURL` はリダイレクト先URLをRedisにキャッシュしてフロントに返している。この仕組み自体は良いが、リダイレクトが返らなかった場合（ステータスが200など）のエラーハンドリングで、**APIキーを含むリクエストURLがログに出る可能性**がある。エラーメッセージにURLを含めないよう注意すること。

---

## 🟡 Important Issues

### 4. パスワード長の上限チェックがない

**ファイル**: `backend/handlers/auth.go` L31

`signUpRequest` の `Password` は `min=8` のみ。bcryptは72バイトまでしかハッシュしないため、超長文パスワードでDoSやハッシュ切り詰めが発生する。

```go
// 推奨: 最大128文字に制限
Password string `json:"password" binding:"required,min=8,max=128"`
```

`changePasswordRequest` の `NewPassword` にも同様の制限を追加すること。

### 5. リフレッシュトークンがログアウト時にブラックリスト化されない

**ファイル**: `backend/handlers/auth.go` L175-L199

`Logout` はアクセストークンのみブラックリスト化している。しかし、攻撃者がリフレッシュトークンを入手していた場合、ログアウト後も新しいアクセストークンを生成し続けることができる。

**推奨**: ログアウト時にリクエストボディでリフレッシュトークンも受け取り、両方をブラックリスト化する。または、`RefreshToken` エンドポイント側でもブラックリストチェックを行う。

### 6. レートリミットがない

認証エンドポイント（`/api/auth/login`, `/api/auth/signup`）にレートリミットがない。ブルートフォース攻撃に対して脆弱。

**推奨**: `gin-contrib/limiter` や Redis ベースのレートリミットミドルウェアを追加。少なくとも login には IP ベースで 5回/分 程度の制限を。

### 7. `ListVisits` の `limit` パラメータに上限がない

**ファイル**: `backend/handlers/visit.go` L80-L86

`limit` クエリパラメータに上限チェックがないため、`?limit=1000000` のような巨大リクエストが可能。

```go
if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
    limit = parsed
    if limit > 100 { // 上限を設定
        limit = 100
    }
}
```

### 8. `Suggest` エンドポイントで `Radius` の上限チェックがない

**ファイル**: `backend/handlers/suggestion.go` L147-L149

デフォルト3000は設定されるが、ユーザーが `radius: 50000` のような大きな値を送るとAPI課金が増大する。

```go
if req.Radius == 0 {
    req.Radius = 3000
}
if req.Radius > 50000 {
    req.Radius = 50000
}
```

### 9. 開発用エンドポイントの認証がない

**ファイル**: `backend/routes/routes.go` L55-L59

`dev` エンドポイントは `environment == "development"` でのみ登録されるが、JWT認証なし。開発環境でも認証を付けるか、ローカルアクセスのみに制限すべき。

### 10. フロントエンドで `localStorage` にトークンを平文保存

**ファイル**: `frontend/app/lib/auth.ts` L8-L14

JWTトークンを `localStorage` に保存している。XSS攻撃が成功した場合、トークンが即座に窃取される。Phase 0では許容範囲だが、Phase 1以降は `httpOnly` Cookie への移行を検討すること。

---

## 🟢 Suggestions

### 11. `filterOutVisited` でDBエラーが無視される

**ファイル**: `backend/handlers/suggestion.go` L113-L117

`Pluck` のエラーが無視されている。DBエラー時にも正常レスポンスが返ってしまう。

```go
var visitedPlaceIDs []string
if err := db.Model(&models.Visit{}).Where("user_id = ?", userID).
    Pluck("place_id", &visitedPlaceIDs).Error; err != nil {
    // エラーログを出して、空として扱うかエラーを返す
}
```

### 12. `VisitHistoryItem` のXSS対策: `backgroundImage` URL

**ファイル**: `frontend/app/routes/history.tsx`

`backgroundImage: url("${visit.photoUrl}")` として直接URLを埋め込んでいる。URLにバックエンドからのデータが入るため、URLスキームを検証する方がより安全（Google CDNからのURLのみ許可など）。

---

## テストカバレッジ分析

### Backend

| ファイル | テスト状況 | 評価 |
|----------|-----------|------|
| handlers/auth.go | SignUp/Login/Refresh/Logout/ChangePassword 全テスト済み | ✅ 充実 |
| handlers/suggestion.go | 正常系・異常系・キャッシュ・フィルタリング全テスト済み | ✅ 充実 |
| handlers/visit.go | CreateVisit/ListVisits バリデーション・ページネーション済み | ✅ 充実 |
| handlers/user.go | GetMe/UpdateMe テスト済み | ✅ OK |
| handlers/place_photo.go | 正常系・異常系・キャッシュテスト済み | ✅ OK |
| handlers/dev_handler.go | キャッシュクリア・統計・本番非公開テスト済み | ✅ OK |
| middleware/jwt.go | 全パターン（有効/無効/期限切れ/リフレッシュ拒否）テスト済み | ✅ 充実 |
| utils/jwt.go | 生成・検証・異常系テスト済み | ✅ 充実 |
| config/config.go | 環境変数の有無・不正値テスト済み | ✅ OK |
| database/ | DB接続・マイグレーション・Redis CRUD テスト済み | ✅ OK |
| middleware/cors.go | **テストなし** | 🟡 |
| middleware/error_handler.go | **テストなし** | 🟡 |

### Frontend

| ファイル | テスト状況 | 評価 |
|----------|-----------|------|
| api/client.ts | ヘッダー・エラー・401リフレッシュテスト済み | ✅ OK |
| api/suggestions.ts, visits.ts | パラメータ・デフォルト値テスト済み | ✅ OK |
| lib/auth.ts | set/get/clear/logout/refresh テスト済み | ✅ 充実 |
| lib/protected-loader.ts | リダイレクト・正常系テスト済み | ✅ OK |
| routes/login.tsx | action 正常系・異常系テスト済み | ✅ OK |
| routes/signup.tsx | action + バリデーション全パターンテスト済み | ✅ 充実 |
| routes/home.tsx | カード表示・スキップ・チェックイン・全訪問済みテスト済み | ✅ 充実 |
| routes/index.tsx | LP表示・ルーティング・認証リダイレクトテスト済み | ✅ OK |
| routes/profile.tsx | 情報表示・ログアウトモーダル・統計テスト済み | ✅ 充実 |
| routes/settings.tsx | 表示名変更・パスワード変更・バリデーションテスト済み | ✅ 充実 |
| routes/history.tsx | **テストなし** | 🔴 |
| components/toast.tsx | 表示・自動非表示・アクセシビリティテスト済み | ✅ OK |
| utils/ | category-map, error, geolocation 全テスト済み | ✅ OK |
| api/places.ts | **テストなし** | 🟡 |
| api/users.ts | **テストなし**（呼び出し元の settings.test 経由で間接的にカバー） | 🟡 |

### テストカバレッジの主要ギャップ

- **🔴 `routes/history.tsx`** — フィルタリング・ページネーション・写真読み込み・グルーピングなど複雑なロジックがあるにもかかわらず、テストがまったくない。Phase 1に向けて優先的にテスト追加すべき。
- **🟡 `middleware/cors.go` / `middleware/error_handler.go`** — 設定ミスで全壊するリスクがあるため、最低限の統合テストがあると安心。

---

## ✅ Good Practices Observed

- **bcryptによるパスワードハッシュ化** + テストでの検証まで実施
- **トークンブラックリスト** — ログアウト後のトークン無効化をRedisで実装している
- **トークンタイプ検証** — access/refresh の混用を防止している
- **PlacesSearcher インターフェース** — テスタビリティが高く、モックテストが容易
- **日次キャッシュ戦略** — APIコストを抑えつつUXを担保する良い設計
- **visitableTypes ホワイトリスト** — 不適切な場所の除外が堅実
- **エラーハンドリングの統一** — `ApiError` クラスで一貫したエラー処理
- **認証エラー時の情報非開示** — login で「invalid email or password」と統一メッセージを返し、メールの存在有無を漏らしていない
- **.env が .gitignore に含まれている** — シークレットの漏洩防止
- **テストカバレッジ全般** — Phase 0としてはかなり充実している

---

## 📊 Summary

| 観点 | 評価 | コメント |
|------|------|----------|
| 機密情報 | ⭐⭐⭐⭐ | .envは管理されている。CORS全開放とAPI_BASE_URLハードコードは要対処 |
| テストカバレッジ | ⭐⭐⭐⭐ | history.tsxのテスト欠落以外は充実。Phase 0として十分 |

---

## Phase 1に進む前の推奨アクション（優先度順）

1. **CORS設定を環境変数化** (Critical)
2. **API_BASE_URL を `import.meta.env` 化** (Critical)
3. **パスワード長の上限追加** (`max=128`) (Important)
4. **login/signup にレートリミット追加** (Important)
5. **history.tsx のテスト追加** (Important)
6. **ListVisits の limit 上限設定** (Quick fix)
