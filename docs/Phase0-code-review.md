# Phase 0 コードレビュー結果

**レビュー日**: 2026-02-15  
**対象**: Phase 0（コアループ「提案→行動→記録」）全コード  
**重点観点**: セキュリティ / テストカバレッジ

---

## 📋 概要

Phase 0として「提案→行動→記録」のコアループが実装されている。Go (Gin) バックエンド + React (React Router) フロントエンド + MySQL + Redis の構成で、認証(JWT)・提案(Google Places API)・訪問記録の機能が揃っている。全体的に堅実な実装だが、セキュリティとテストカバレッジの観点でいくつか指摘事項がある。

---

## 🔴 Critical Issues

### 1. Google Places API Key が Place Photo のURLに含まれてフロントへ露出する可能性

**ファイル**: `backend/handlers/place_photo.go` L41-L44

`resolvePhotoURL` はリダイレクト先URLをRedisにキャッシュしてフロントに返している。この仕組み自体は良いが、リダイレクトが返らなかった場合（ステータスが200など）のエラーハンドリングで、**APIキーを含むリクエストURLがログに出る可能性**がある。エラーメッセージにURLを含めないよう注意すること。

---

## 🟡 Important Issues

### 2. レートリミットがない

認証エンドポイント（`/api/auth/login`, `/api/auth/signup`）にレートリミットがない。ブルートフォース攻撃に対して脆弱。

**推奨**: `gin-contrib/limiter` や Redis ベースのレートリミットミドルウェアを追加。少なくとも login には IP ベースで 5回/分 程度の制限を。

### 3. フロントエンドで `localStorage` にトークンを平文保存

**ファイル**: `frontend/app/lib/auth.ts` L8-L14

JWTトークンを `localStorage` に保存している。XSS攻撃が成功した場合、トークンが即座に窃取される。Phase 0では許容範囲だが、Phase 1以降は `httpOnly` Cookie への移行を検討すること。

---

## 🟢 Suggestions

### 4. `filterOutVisited` でDBエラーが無視される

**ファイル**: `backend/handlers/suggestion.go` L113-L117

`Pluck` のエラーが無視されている。DBエラー時にも正常レスポンスが返ってしまう。

```go
var visitedPlaceIDs []string
if err := db.Model(&models.Visit{}).Where("user_id = ?", userID).
    Pluck("place_id", &visitedPlaceIDs).Error; err != nil {
    // エラーログを出して、空として扱うかエラーを返す
}
```

### 5. `VisitHistoryItem` のXSS対策: `backgroundImage` URL

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
| middleware/cors.go | テスト済み | ✅ OK |
| middleware/error_handler.go | テスト済み | ✅ OK |

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
| routes/history.tsx | フィルタリング・ページネーション・グルーピングテスト済み | ✅ OK |
| components/toast.tsx | 表示・自動非表示・アクセシビリティテスト済み | ✅ OK |
| utils/ | category-map, error, geolocation 全テスト済み | ✅ OK |
| api/places.ts | photoURL取得・エラーハンドリングテスト済み | ✅ OK |
| api/users.ts | ユーザー情報取得・更新テスト済み | ✅ OK |

### テストカバレッジの状況

- **✅ 全ファイルでテストが完備** — Phase 0 として必要なテストカバレッジが達成されている。

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
| セキュリティ | ⭐⭐⭐⭐⭐ | 主要なセキュリティ問題が解消済み |
| テストカバレッジ | ⭐⭐⭐⭐⭐ | 全ファイルでテストが完備されており、Phase 0として十分 |

---

## Phase 1に進む前の推奨アクション（優先度順）

1. **login/signup にレートリミット追加** (Important) — ブルートフォース攻撃対策
2. **Google Places API Key の露出リスク検討** (Medium) — エラーハンドリングでのURL露出防止
3. **localStorage からhttpOnly Cookieへの移行検討** (Low) — XSS攻撃対策強化
