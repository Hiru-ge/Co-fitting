# TODO — ベータ版ロードマップ

> Phase 1 の実装・インフラ準備はすべて完了。**3/7（土）のベータ版公開**に向けた最終確認フェーズ。
> 現在のドメイン: `roamble.app`（本番）/ `roamble.pages.dev`（Cloudflare Pages デフォルト）

---

## セキュリティ確認

### フロントエンド

- [ ] `localStorage` に保存しているトークンに対して XSS リスクがある場合、Content-Security-Policy ヘッダーが設定されているか（`public/_headers` に CSP 未設定。ベータ版では許容範囲だが、正式リリース前に追加推奨）
- [ ] リフレッシュトークンを httpOnly Cookie に移行する（現状は `localStorage` に保存しており、XSS が刺さると盗まれるリスクがある。対応にはバックエンドでの Cookie 発行・CSRF 対策とセットで実装が必要。ユーザー数が増えるフェーズで対応を検討）
s
---

## 3/8〜: Optional（ひと段落後）

- [ ] Product Hunt "Upcoming" ページの活用

---

## Phase 1 バグ修正・機能改善

### 提案除外ジャンル設定実装（Issue #298）

> **背景**: 公園など「苦手ではないが行きたくもない」ジャンルが頻繁に提案される問題への対応。
> 3ステートトグル（未設定→興味あり→除外）で興味タグ設定画面に統合。除外ジャンルは提案から完全除外するが、訪問自体は妨げないためXPは通常通り付与する。

**🔴 RED**

- [ ] `backend/handlers/user_test.go` に `TestUpdateInterests_ExcludedStatus` テスト追加
  - `status: "excluded"` を含むリクエスト → DBに保存されるか検証
  - `status: "interested"` が3件未満 → 400を返すか検証
- [ ] `backend/handlers/suggestion_test.go` に `TestGetSuggestions_ExcludesExcludedGenres` テスト追加
  - excludedジャンルの場所が候補に含まれないか検証

**🟢 GREEN**

- [ ] `backend/models/gamification.go` の `UserInterest` 構造体に `Status string \`gorm:"type:enum('interested','excluded');default:'interested';not null" json:"status"\`` フィールド追加
- [ ] `backend/database/migrate.go` の AutoMigrate でカラム追加反映
- [ ] `backend/handlers/user.go` の `UpdateInterests` ハンドラ:
  - リクエスト型を `[]struct{ GenreTagID uint64 \`json:"genre_tag_id"\`; Status string \`json:"status"\` }` に変更
  - `interested` が3件以上のバリデーション追加
  - レスポンスの `interestResponse` に `status` フィールド追加
- [ ] `backend/handlers/suggestion.go` の `getUserInterestGenreNames()`: `WHERE status = 'interested'` 条件を追加
- [ ] `backend/handlers/suggestion.go` の候補フィルタリング: `excluded` ジャンルに該当する場所を除外
- [ ] `frontend/app/types/genre.ts` の `Interest` 型に `status: 'interested' | 'excluded'` フィールド追加
- [ ] `frontend/app/api/genres.ts` の `updateInterests()` リクエストボディを `{ genre_tag_ids: number[] }` から `{ interests: { genre_tag_id: number; status: string }[] }` に変更
- [ ] `frontend/app/routes/settings.tsx`: ジャンルタグの3ステートトグルUI実装
  - 未設定（グレー）→ 1回タップ → 興味あり（現行の選択状態）→ 2回タップ → 除外（バツ表示）→ 3回タップ → 未設定
  - セクションに静的テキスト追加「本当に苦手なジャンル以外の除外は、成長の機会を逃すかも！」

**🔵 REFACTOR**

- [ ] 除外ジャンルのフィルタリングロジックを `getExcludedGenreNames()` 関数に切り出し
- [ ] トグル状態管理をカスタムフックに切り出し検討

---

## バックエンドコード読解から洗い出したバグ修正・リファクタリング

### バグ修正

#### ストリークリマインダー送信タイミング修正（Issue #305）

**🔴 RED**
- [ ] `backend/services/scheduler_test.go` に `TestFetchStreakReminderTargets_SevenDaysAgo` テスト追加（前回訪問から7日経過したユーザーが対象になるか検証）

**🟢 GREEN**
- [ ] `backend/services/scheduler.go` の `fetchStreakReminderTargets`: `AddDate(0, 0, -6)` → `AddDate(0, 0, -7)` に修正
- [ ] 変数名 `sixDaysAgoJST` / `sixDaysAgoEnd` → `sevenDaysAgoJST` / `sevenDaysAgoEnd` に変更

**🔵 REFACTOR**
- [ ] なし

---

#### 提案の filter_open_now デフォルト値修正（Issue #306）

**🔴 RED**
- [ ] `backend/handlers/suggestion_test.go` に `TestGetSuggestions_FilterOpenNowDefault` テスト追加（パラメータ未指定時に filter_open_now=true として動作するか検証）

**🟢 GREEN**
- [ ] `backend/handlers/suggestion.go` の `filter_open_now` パラメータのデフォルト値を `true` に変更

**🔵 REFACTOR**
- [ ] なし

---

#### ストリークボーナスXPのジャンル熟練度加算バグ修正（Issue #307）

**🔴 RED**
- [ ] `backend/services/gamification_test.go` にストリークボーナスXPが熟練度に加算されないことを検証するテスト追加

**🟢 GREEN**
- [ ] `backend/services/gamification.go` の `applyXPAndProgression`: ストリークボーナス分のXPを `UpdateGenreProficiency` に渡さないよう修正

**🔵 REFACTOR**
- [ ] なし

---

#### ユーザー登録時の NotificationSettings 初期レコード作成（Issue #308）

**🔴 RED**
- [ ] `backend/handlers/google_oauth_test.go` にOAuth完了時に `NotificationSettings` レコードが作成されるか検証するテスト追加

**🟢 GREEN**
- [ ] `backend/handlers/google_oauth.go` のユーザー登録処理に `NotificationSettings` の初期レコード作成を追加
- [ ] `backend/handlers/notification.go` の `GetNotificationSettings` から `FirstOrCreate` を `First` に変更

**🔵 REFACTOR**
- [ ] なし

---

### 削除

#### 未使用コード・dead code の削除（Issue #309）

- [ ] `backend/middleware/rate_limit.go` を削除
- [ ] `backend/middleware/error_handler.go` を削除
- [ ] `backend/database/migrate.go` の適用済み一時パッチ3ブロック削除（`is_comfort_zone` 改名・`latitude`/`longitude`/`password_hash` 削除・`monthly_summary` デフォルト更新）
- [ ] `backend/handlers/place_photo.go` の旧Places API互換コード削除（`resolveLegacyPhotoURL` / `isNewAPIPhotoRef` / `getBaseURL` / `getNewAPIBaseURL` / `getHTTPClient`）
- [ ] `backend/handlers/visit.go` の `createVisitRequest.Rating` / `createVisitRequest.Memo` フィールド削除（Issue #304 と合わせて整理）
- [ ] `backend/handlers/visit.go` の `ListVisits` から `from` / `until` パラメータ削除

---

### リファクタリング

#### haversineDistance・jst の utils への切り出し（Issue #310）

- [ ] `backend/utils/geo.go` を新規作成し `haversineDistance` を定義
- [ ] `backend/utils/time.go` を新規作成し `JST` タイムゾーン定数を定義
- [ ] `visit.go` / `gamification.go` / `user.go` の重複定義を削除して `utils` からインポートするよう変更

---

#### suggestion.go ビジネスロジックのサービス層への移動（Issue #311）

- [ ] `backend/services/suggestion.go` を新規作成
- [ ] `filterOutVisited` / `filterOpenNowPlaces` / `buildPersonalizedSelections` / `isBreakoutVisit` / `classifyByInterest` / `selectPersonalizedPlaces` をサービス層へ移動
- [ ] `UpdateInterests` / `UpdateMe` のリロードカウント重複処理を共通関数に切り出し
- [ ] `RunWeeklySummaryNotification` / `RunMonthlySummaryNotification` を `runSummaryNotification` に共通化

---

#### テスト専用コードの testutil への分離（Issue #312）

- [ ] `backend/services/push.go` の `newPushServiceWithClient` を `backend/services/push_test.go` に移動
- [ ] `backend/handlers/place_photo.go` の `BaseURL` / `HTTPClient` フィールドと `getBaseURL` / `getNewAPIBaseURL` / `getHTTPClient` を削除し、テスト側でモックを差し替える設計に変更
- [ ] `backend/services/scheduler.go` の `EntryCount` を削除（テストで必要なら `testutil/` に別途定義）

---

#### 環境変数の config.go への集約（Issue #313）

- [ ] `backend/config/config.go` にすべての環境変数の読み込みと起動時バリデーションを集約
  - 対象: `MYSQL_*`（db.go）/ `REDIS_*`（redis.go）/ `PORT`（main.go）/ `ALLOWED_ORIGIN`（cors.go）/ `GOOGLE_*`（google_oauth.go）等
- [ ] `ALLOWED_ORIGIN` 未設定時のフォールバック削除（未設定ならエラー）
- [ ] 各ファイルの `os.Getenv` 直接呼び出しを `config` パッケージ経由に変更

---

#### 提案データの Redis/localStorage 二重管理の解消（Issue #314）

> 詳細は `docs/redis-localstorage.md` を参照。

- [ ] フロントエンドの提案キャッシュ（`SUGGESTIONS_CACHE_KEY`）を localStorage から削除し Redis 経由に統一
- [ ] 「今日の提案を全件完了したか」フラグ（`COMPLETED_KEY`）を localStorage から削除し Redis の `suggestion:count:*` に統一
- [ ] 複数端末でのキャッシュ整合性を確認

---

#### バックエンド全体の命名改善（Issue #315）

- [ ] `resolveGenreInfo` → `deriveGenreFromPlaceTypes` 等、実態に合う名前へ
- [ ] `ProcessGamification` → `AwardXPAndBadges` 等へ
- [ ] `applyXPAndProgression` → `persistXPAndProgression` 等へ
- [ ] `buildXPBreakdown` → `buildXPComponents` 等へ
- [ ] `ForceReload` / `processForceReload` → `Reload` / `processReload` へ
- [ ] Redis キー生成関数の命名統一（`Generate*Key` 等）/ 削除系を `Delete*` に統一
- [ ] `scheduler.go` の `build*` → `aggregate*` / `collect*` 等へ
- [ ] `email.go` の `Build*` → `Build*HTML` 等へ

---

## Phase 2 計画 — 通知機能（実装済み）

> 詳細は `docs/notification-roadmap.md` を参照。
> Issue #270〜#282 の通知基盤（DBモデル・エンドポイント・Push/メールサービス・スケジューラー・フロントエンドUI）はすべて実装済み。

---

## Phase 3 計画（iOS）— ベータFBと通知実装後に着手

---

## マーケティング（継続）

> ブランド構築・SNSアカウント・初期コンテンツはすべて完了済み。

- [~] **開発ログの継続投稿**: X / Instagram / TikTok で開発内容や気づきを共有する
- [ ] **Product Hunt / 開発系コミュニティへの「予告」**（Optional）
  - [ ] "Upcoming" ページ等の活用検討
