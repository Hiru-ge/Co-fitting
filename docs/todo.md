# TODO — ベータ版ロードマップ

> Phase 1 の実装・インフラ準備はすべて完了。**3/7（土）のベータ版公開**に向けた最終確認フェーズ。
> 現在のドメイン: `roamble.app`（本番）/ `roamble.pages.dev`（Cloudflare Pages デフォルト）

---

## GCP 設定チェックリスト

> `docs/infra/google-oauth.md` および `docs/infra/domain-email.md` に設定手順あり。
> ベータ版公開前に必ず全項目を GCP コンソールで目視確認すること。

### OAuth 同意画面（GCP → APIs & Services → OAuth consent screen）

- [x] ステータスが「本番環境に公開」になっている（テストユーザー制限が解除されている）
- [x] アプリケーションのホームページ: `https://roamble.app/lp`
- [x] プライバシーポリシーリンク: `https://roamble.app/privacy`
- [x] 承認済みドメイン: `roamble.app` が追加されている
- [x] **スコープ確認**: `email`, `profile`, `openid` のみになっているか（不要なスコープが入っていないか）（データアクセス画面で非機密・機密・制限付きスコープすべて「行なし」を確認。基本OIDCスコープのみで正常）

### OAuth クライアントID（GCP → APIs & Services → Credentials）

- [x] 承認済みの JavaScript 生成元: `https://roamble.app` が追加されている
- [x] 承認済みの JavaScript 生成元: `https://roamble.pages.dev` が追加されている
- [x] **承認済みの JavaScript 生成元の一覧を再確認**（`localhost:3000`, `roamble.pages.dev`, `roamble.app` の3件のみ。不要なドメインなし）

### Google Maps / Places API キー

- [x] フロントエンド用キーの HTTPリファラー制限: `https://roamble.app/*` が含まれている
- [x] フロントエンド用キーの HTTPリファラー制限: `https://roamble.pages.dev/*` が含まれている
- [x] **フロントエンド用キーの API 制限**: Maps JavaScript API (`maps-backend.googleapis.com`) のみに設定済み
- [x] **バックエンド用キーの API 制限**: `places-backend.googleapis.com` / `places.googleapis.com` のみに設定済み
- [x] **バックエンド用キーのアプリケーション制限**: ブラウザ制限を削除。アプリ制限なし（APIのみ制限）に設定済み
- [x] **有効化済みAPI一覧の確認**（GCP → APIs & Services → Library）:
  - [x] Maps JavaScript API（`maps-backend.googleapis.com`）
  - [x] Places API（`places-backend.googleapis.com`）
  - [x] Places Aggregate API（GCP上に独立したサービスとして存在しない。Places API / Places API (New) に統合されている模様）
  - [x] Places API (New)（`places.googleapis.com`）

### Cloud Run 環境変数（GCP → Cloud Run → roamble-backend → Edit & Deploy New Revision）

- [x] **`ALLOWED_ORIGIN` に `https://roamble.app` が含まれているか確認**（`https://roamble.app,https://roamble.pages.dev` に更新済み）
- [x] `ENVIRONMENT=production` になっているか
- [x] `MYSQL_TLS=true` になっているか
- [x] `REDIS_TLS=true` になっているか
- [x] `JWT_SECRET` が本番用の強固なランダム文字列になっているか（`openssl rand -base64 32` で生成したもの）
- [x] `GOOGLE_OAUTH_CLIENT_ID` が正しいクライアントIDになっているか

### Cloudflare Pages 環境変数（Cloudflare → Pages → roamble → Settings → Environment variables）

- [x] `VITE_API_BASE_URL` が正しい Cloud Run の Service URL になっているか（`https://roamble-back...` 設定済み）
- [x] `VITE_GOOGLE_CLIENT_ID` が正しいクライアントIDになっているか（バックエンドと同じ値）
- [x] `VITE_GOOGLE_MAPS_API_KEY` がフロントエンド用キーになっているか（`AIzaSyB8RT2JXNHX...` = バックエンド用キー `AIzaSyC5...` と別キー確認済み）
- [x] `VITE_BETA_PASSPHRASE` が設定されているか（`ROAMBLE_BETA` 設定済み）

### Cloudflare Pages カスタムドメイン

- [x] `roamble.app` が Cloudflare Pages のカスタムドメインとして設定されているか確認（HTTP 200 確認済み）
- [x] DNS が正しく向いているか（Cloudflare プロキシ経由で配信確認済み）
- [x] HTTPS が有効になっているか（HTTP/2 + HTTPS 確認済み）

### GCP 請求・モニタリング

- [x] **GCP 請求アラート**を設定する（月 $4 以上の請求が発生した場合に通知されるように設定）
- [x] Places API の使用状況をモニタリングできているか確認（GCP → APIs & Services → Dashboard）

### Google Search Console

- [x] `roamble.app` のドメイン所有権確認が完了している（CloudflareのDNS TXTレコードで対応済み）

---

## セキュリティ確認（ベータ版公開前）

> 外部ユーザーを招待する前に、OWASP Top 10 を軸に主要な脆弱性がないことを確認する。

### 認証・認可

- [x] JWT の有効期限（アクセストークン・リフレッシュトークン）が適切に設定されているか（アクセス: 15分 / リフレッシュ: 7日）
- [x] リフレッシュトークンの使い回し（Refresh Token Rotation）が実装されているか、または意図的にしていない場合のリスクを把握しているか（Rotation未実装・意図的。ログアウト時にRedisブラックリストで無効化する方式で対応）
- [x] 認証が必要なエンドポイントに未認証でアクセスした場合、401 が返ることを確認（`/api/users/me`, `/api/visits` など全て 401 確認済み）
- [x] 他ユーザーの訪問記録・プロフィールに PATCH/DELETE できないか確認（`WHERE id = ? AND user_id = ?` および `visit.UserID != userID` チェック実装済み）

### 入力バリデーション・インジェクション

- [x] バックエンドの全エンドポイントで入力値のバリデーションが行われているか（`binding:"required"` による基本バリデーションあり。max length は未設定だが Places API 由来の値のみのため実害は限定的）
- [x] GORM を使っているため SQL インジェクションのリスクは低いが、生クエリ（`db.Raw`）を使っている箇所がないか確認（`db.Raw` の使用なし）
- [x] `place_id` や `genre_tag_id` など外部入力をそのまま DB に渡している箇所でのバリデーション確認（GORM のプリペアドステートメント経由のため注入リスクなし）

### CORS・HTTP ヘッダー

- [x] `ALLOWED_ORIGIN` が本番ドメインのみに絞られているか（`https://roamble.app,https://roamble.pages.dev` に設定済み）
- [x] Gin の本番モード（`GIN_MODE=release`）で不要なデバッグ情報がレスポンスに含まれていないか（GIN_MODE未設定だが ENVIRONMENT=production で運用上問題なし）
- [x] `/api/dev/auth/test-login` エンドポイントが `ENVIRONMENT=production` 時に無効化されているか確認（本番で 404 を確認済み。`deps.Environment == "development"` 条件で正しくガード）

### 機密情報の管理

- [x] `.gitignore` に `.env` が含まれており、シークレットが Git 履歴に含まれていないか確認（`.env` は .gitignore 済み。`git log -S "GOOGLE_PLACES_API_KEY"` の結果はドキュメント整備コミットのみで実際のキー値は履歴に含まれていない）
- [x] JWT_SECRET が十分に長くランダムなものになっているか（32文字のランダム文字列。`openssl rand -base64 32` 相当）
- [x] Cloudflare Pages の環境変数にバックエンド用 Places API キー（`GOOGLE_PLACES_API_KEY`）が誤って設定されていないか（Cloudflare コンソールで確認済み。混入なし）

### レート制限・DoS 対策

- [x] `/api/suggestions` への連続リクエストによる Places API コスト爆発を防ぐリロード回数制限が機能しているか確認（グローバルレート制限 120req/分 + フロントエンド側のリロード回数制限で二重対策済み）
- [x] `/api/auth/oauth/google` に対するブルートフォース対策（レート制限）があるか確認（グローバルレート制限ミドルウェアが全ルートに適用済み）

### フロントエンド

- [ ] `localStorage` に保存しているトークンに対して XSS リスクがある場合、Content-Security-Policy ヘッダーが設定されているか（`public/_headers` に CSP 未設定。ベータ版では許容範囲だが、正式リリース前に追加推奨）
- [x] Google Maps API キーのリファラー制限が正しく設定されており、外部から悪用できない状態か（`localhost/*`, `roamble.pages.dev/*`, `roamble.app/*` のみに制限済み）

---

## 本番動作確認（ベータ版公開前）

- [x] `https://roamble.pages.dev` にアクセスできる
- [x] 合言葉入力画面が表示される
- [x] Google ログインができる
- [x] 場所提案が生成される（Places API 経由）
- [x] 訪問記録ができ、XP・バッジが付与される
- [x] モバイルでの表示・操作感を確認済み
- [x] **`https://roamble.app` でも同様にアクセス・操作できるか確認**（フロントエンドは HTTP 200 確認済み。Google OAuth + 提案 + 訪問記録の一連フローを実際に操作して確認）
- [x] **スリープ/コールドスタート時間の確認**（Cloud Run レスポンスタイム約 120ms。コールドスタートなしで良好）
- [x] **Google OAuth が `roamble.app` ドメインで正常に動作するか確認**（JavaScript生成元の設定が効いているか）

---

## 3/7（土）: ベータ版公開

- [x] **説明動画の撮り直し**（あなたの作業）
  - Roambleの使い方・コンセプトを短くまとめたキャッチーな動画を撮影
  - SNS（X, TikTok等）でベータ版参加を再告知
  - 公開完了：https://x.com/roamble_app/status/2030244530717700323?s=20
- [x] **ベータ版公開記事の執筆**
  - 公開の背景・目的、ベータ版で試してほしいこと、今後の展望などをまとめた記事を執筆（/blog-writer スキルを使う）
  - noteで公開(https://note.com/hiruge/n/n8f84df8d1e28)
- [x] **ベータ版公開**
  - SNSで公開アナウンス。合言葉をDMまたはフォーム回答者に通知
  - LPにベータ版URL（`https://roamble.app`）を追記
- [ ] **ベータ版フォーム締め切り**（公開1週間後 = 3/14頃）

---

## 3/8〜: Optional（ひと段落後）

- [ ] Product Hunt "Upcoming" ページの活用


## Phase 2 計画 — 通知機能

> 詳細は `docs/notification-roadmap.md` を参照。

> **実装済み**: Google Mapsナビゲーション連携（Issue #200）・営業時間フィルタリング（Issue #201）は Phase 1 後半でβ版として先行実装済み。

### 通知機能前準備（Issue #270）

> TDDなし（設定作業）。完了後に env変数・DNS伝播を実機確認すること。

- [x] VAPID鍵生成（`go run github.com/SherClockHolmes/webpush-go/cmd/webpush@latest`）
  - `.env` + Cloud Run に `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` を追加
- [x] Resendアカウント作成・DNS認証
  - Cloudflare に SPF / DKIM / DMARC レコード追加
  - `RESEND_API_KEY` / `NOTIFICATION_EMAIL_FROM` を `.env` + Cloud Run に追加
- [x] Cloud Run 最小インスタンス数を 0 → 1 に変更
- [x] Resend API でテスト送信を行い、自分のメールアドレスに届くか確認
- [x] Cloud Run のログに env 関連のエラーが出ていないか確認

### 通知DBモデル実装（Issue #271）

**🔴 RED**

- [x] `backend/models/notification_test.go` 作成
  - `TestPushSubscriptionFields` — `PushSubscription` の各フィールドが期待するGORMタグを持つか検証
  - `TestNotificationSettingsDefaults` — `NotificationSettings` のデフォルト値が正しいか検証

**🟢 GREEN**

- [x] `backend/models/notification.go` 作成
  - `type PushSubscription struct` — `ID`, `UserID`, `Endpoint`(uniqueIndex), `P256DH`, `Auth`, `UserAgent`, `CreatedAt`
  - `type NotificationSettings struct` — `UserID`(primaryKey), `PushEnabled`, `EmailEnabled`, `DailySuggestion`, `WeeklySummary`, `MonthlySummary`(default:false), `StreakReminder`, `UpdatedAt`
- [x] `backend/database/migrate.go` に `PushSubscription` / `NotificationSettings` の AutoMigrate 追加

**🔵 REFACTOR**

- [x] フィールド名・型・GORMタグの見直し（Endpoint: varchar(500) に変更。MySQLインデックス上限対応）

---

### VAPID公開鍵取得エンドポイント実装（Issue #272）

**🔴 RED**

- [x] `backend/handlers/notification_test.go` 作成
  - `TestGetVAPIDPublicKey_Success` — `VAPID_PUBLIC_KEY` 設定済み → 200 + `{ "vapid_public_key": "..." }`
  - `TestGetVAPIDPublicKey_NotSet` — 未設定 → 500

**🟢 GREEN**

- [x] `backend/handlers/notification.go` 作成
  - `NotificationHandler` 構造体（`VAPIDPublicKey` フィールド）と `GetVAPIDPublicKey` メソッド実装
  - `h.VAPIDPublicKey` を参照して返却
- [x] `backend/routes/routes.go` に `GET /api/notifications/push/vapid-key` 追加（認証不要）

**🔵 REFACTOR**

- [x] レスポンス型を `VAPIDKeyResponse` 構造体に切り出し

---

### Push購読登録エンドポイント実装（Issue #273）

**🔴 RED**

- [x] `backend/handlers/notification_test.go` に追記
  - `TestSubscribePush_Success` — 正常登録 → 201
  - `TestSubscribePush_Upsert` — 同一 `endpoint` 再登録 → 200（レコード更新）
  - `TestSubscribePush_Unauthorized` — 認証なし → 401

**🟢 GREEN**

- [x] `handlers/notification.go` に `SubscribePush` ハンドラ実装
  - リクエスト: `SubscribePushRequest{ Endpoint, P256DH, Auth, UserAgent string }`
  - `db.Clauses(clause.OnConflict{ Columns: []clause.Column{{Name: "endpoint"}}, DoUpdates: clause.AssignmentColumns(...) }).Create()`でUpsert
- [x] `routes/routes.go` に `POST /api/notifications/push/subscribe` 追加（JWTAuth付き）

**🔵 REFACTOR**

- [x] Upsertロジックをリポジトリ関数 `UpsertPushSubscription` に切り出し

---

### Push購読解除エンドポイント実装（Issue #274）

**🔴 RED**

- [x] `handlers/notification_test.go` に追記
  - `TestUnsubscribePush_Success` — 購読解除 → 204
  - `TestUnsubscribePush_NotFound` — 存在しない endpoint → 204（冪等）
  - `TestUnsubscribePush_Unauthorized` — 認証なし → 401

**🟢 GREEN**

- [x] `handlers/notification.go` に `UnsubscribePush` ハンドラ実装
  - リクエスト: `UnsubscribePushRequest{ Endpoint string }`
  - `db.Where("endpoint = ? AND user_id = ?", endpoint, userID).Delete(&PushSubscription{})` で削除
- [x] `routes/routes.go` に `DELETE /api/notifications/push/subscribe` 追加（JWTAuth付き）

**🔵 REFACTOR**

- [x] DELETE操作のエラーハンドリング統一

---

### 通知設定取得エンドポイント実装（Issue #275）

**🔴 RED**

- [x] `handlers/notification_test.go` に追記
  - `TestGetNotificationSettings_WithRecord` — レコードあり → 200 + 設定値
  - `TestGetNotificationSettings_NoRecord` — レコードなし → 200 + デフォルト値（`PushEnabled: true` 等）
  - `TestGetNotificationSettings_Unauthorized` — 認証なし → 401

**🟢 GREEN**

- [x] `handlers/notification.go` に `GetNotificationSettings` ハンドラ実装
  - `db.FirstOrCreate(&settings, NotificationSettings{UserID: userID})` でデフォルト値込みで取得
- [x] `routes/routes.go` に `GET /api/notifications/settings` 追加（JWTAuth付き）

**🔵 REFACTOR**

- [x] `NotificationSettingsResponse` 型に切り出し

> ⚠️ **懸念**: GETで `FirstOrCreate` によるレコード作成（副作用）が発生するのはRESTの観点では好ましくない。更新側（#276）を `FirstOrCreate` + `Updates` 構成にして、GETは単純な `First` + デフォルト値返却に変更することも検討余地あり。

---

### 通知設定更新エンドポイント実装（Issue #276）

**🔴 RED**

- [x] `handlers/notification_test.go` に追記
  - `TestUpdateNotificationSettings_Success` — 正常更新 → 200 + 更新後の設定値
  - `TestUpdateNotificationSettings_Unauthorized` — 認証なし → 401

**🟢 GREEN**

- [x] `handlers/notification.go` に `UpdateNotificationSettings` ハンドラ実装
  - リクエスト: `UpdateNotificationSettingsRequest{ PushEnabled, EmailEnabled, DailySuggestion, WeeklySummary, MonthlySummary, StreakReminder *bool }`
  - `db.Save(&settings)` で全フィールド更新
- [x] `routes/routes.go` に `PUT /api/notifications/settings` 追加（JWTAuth付き）

**🔵 REFACTOR**

- [x] 部分更新（nil フィールドを無視）が必要な場合は `db.Model().Updates()` に変更検討

---

### Push通知送信サービス実装（Issue #277）

> 送信ロジックはユニットテスト可能。**実際に端末へ届くかは実機確認必須**。

**🔴 RED**

- [x] `backend/services/push_test.go` 作成
  - `TestSendPushToUser_410RemovesSubscription` — モックHTTPサーバーが410返却 → 該当購読がDBから削除される
  - `TestSendPushToUser_Success` — 200返却 → 購読を維持

**🟢 GREEN**

- [x] `backend/services/push.go` 作成
  - `type PushService struct { db *gorm.DB; vapidPublicKey, vapidPrivateKey, vapidSubject string }`
  - `type PushPayload struct { Title, Body, URL string }`
  - `func NewPushService(db, publicKey, privateKey, subject) *PushService`
  - `func (s *PushService) SendToUser(userID uint64, payload PushPayload) error` — 全購読にループ送信
  - `func (s *PushService) cleanupSubscription(endpoint string) error` — 410/404時に呼ぶ

**🔵 REFACTOR**

- [x] 送信失敗ログ（endpoint単位）の整備
- [x] goroutineによる並行送信検討（ユーザーが多端末保有の場合）

---

### メール通知送信サービス実装（Issue #278）

**🔴 RED**

- [x] `backend/services/email_test.go` 作成
  - `TestBuildStreakReminderEmail` — テンプレートレンダリング結果に期待する文字列が含まれるか検証
  - `TestBuildWeeklySummaryEmail` — 訪問件数・獲得XPが埋め込まれるか検証
  - `TestBuildMonthlySummaryEmail` — 訪問件数・獲得XP・月が埋め込まれるか検証

**🟢 GREEN**

- [x] `backend/services/email.go` 作成
  - `type EmailService struct { client *resend.Client; fromAddress string }`
  - `type WeeklySummaryData struct { UserName string; VisitCount int; TotalXP int; NewBadges []string }`
  - `type MonthlySummaryData struct { ... }`
  - `func NewEmailService(apiKey, from string) *EmailService`
  - `func (s *EmailService) SendStreakReminder(toEmail, userName string, streakWeeks int) error`
  - `func (s *EmailService) SendWeeklySummary(toEmail string, data WeeklySummaryData) error`
  - `func (s *EmailService) SendMonthlySummary(toEmail string, data MonthlySummaryData) error`
- [x] `backend/templates/email/streak_reminder.html` 作成
- [x] `backend/templates/email/weekly_summary.html` 作成
- [x] `backend/templates/email/monthly_summary.html` 作成

**🔵 REFACTOR**

- [x] テンプレートの共通ヘッダー/フッターを `base.html` に切り出し

---

### 通知スケジューラー実装（Issue #279）

> cronの時刻トリガー動作は自動テスト不可。**ステージング環境での手動確認必須**。

**🔴 RED**

- [ ] `backend/services/scheduler_test.go` 作成
  - `TestSchedulerJobsRegistered` — `NewNotificationScheduler().Start()` 後に4件のジョブが登録されているか
  - `TestRunDailySuggestionNotification_SendsToSubscribers` — Push購読ユーザーに `PushService.SendToUser` が呼ばれるか（PushServiceをモック）

**🟢 GREEN**

- [ ] `backend/services/scheduler.go` 作成
  - `type NotificationScheduler struct { cron *cron.Cron; push *PushService; email *EmailService; db *gorm.DB }`
  - `func NewNotificationScheduler(push, email, db) *NotificationScheduler`
  - `func (s *NotificationScheduler) Start()` — `cron.WithLocation(jst)` で4ジョブを登録して起動
    - デイリーサジェスション: `0 7 * * *`（毎朝7時 JST）
    - ストリークリマインダー: `0 7 * * 0`（毎週日曜朝7時 JST）※ #284 でローリングウィンドウ方式に変更予定
    - 週次サマリー: `0 10 * * 1`（毎週月曜朝10時 JST）
    - 月次サマリー: `0 10 1 * *`（毎月1日朝10時 JST）
  - `func (s *NotificationScheduler) Stop()`
  - `func (s *NotificationScheduler) RunDailySuggestionNotification()` — Push購読ユーザー全員に送信
  - `func (s *NotificationScheduler) RunStreakReminderNotification()` — 今週未訪問（暦週）+ streak>0 のユーザーにPush+メール（切れる当日=日曜朝7時に送信）
  - `func (s *NotificationScheduler) RunWeeklySummaryNotification()` — 週次サマリー設定ONのユーザー全員にPush+メール（訪問なしでも必ず送る）
  - `func (s *NotificationScheduler) RunMonthlySummaryNotification()` — 月次サマリー設定ONのユーザー全員にPush+メール（訪問なしでも必ず送る）
- [ ] `backend/main.go` に `NotificationScheduler` 初期化・`Start()` 追加（`defer scheduler.Stop()`）

**🔵 REFACTOR**

- [ ] 各ジョブのDB集計クエリをリポジトリ関数に切り出し
- [ ] ジョブごとのエラーログ整備

---

### フロントエンドPush通知基盤実装（Issue #280）

> **実機確認必須**: `injectManifest` 切り替え後のPWAインストール・オフライン・アップデート挙動（iOS Safari含む）は実機で確認すること。

**🔴 RED**

- [x] `frontend/app/lib/push.test.ts` 作成
  - `subscribePush` — ServiceWorkerとPushManagerをモック → `subscribePushToBackend` が呼ばれるか
  - `unsubscribePush` — `unsubscribePushFromBackend` が呼ばれるか
  - `getPushPermissionState` — `Notification.permission` の値を返すか

**🟢 GREEN**

- [x] `frontend/vite.config.ts` の PWA設定を `strategy: "injectManifest"` に変更（`srcDir: "public"`, `filename: "sw.js"` を指定）
- [x] `frontend/public/sw.js` 作成
  - `precacheAndRoute(self.__WB_MANIFEST)` で既存キャッシュ設定を移植
  - `push` イベント: `showNotification(title, { body, icon, badge, data: { url } })`
  - `notificationclick` イベント: `clients.openWindow(event.notification.data.url)`
- [x] `frontend/app/lib/push.ts` 作成
  - `subscribePush(token: string): Promise<boolean>`
  - `unsubscribePush(token: string): Promise<void>`
  - `getPushPermissionState(): Promise<NotificationPermission>`
- [x] `frontend/app/api/notifications.ts` 作成
  - `getNotificationSettings(token: string): Promise<NotificationSettings>`
  - `updateNotificationSettings(token: string, settings: Partial<NotificationSettings>): Promise<void>`
  - `subscribePushToBackend(token: string, subscription: PushSubscriptionJSON): Promise<void>`
  - `unsubscribePushFromBackend(token: string, endpoint: string): Promise<void>`
- [x] `frontend/app/types/notification.ts` 作成（`NotificationSettings` 型定義）

**🔵 REFACTOR**

- [x] VAPID公開鍵取得をキャッシュして毎回APIを叩かないよう最適化

---

### 通知設定画面実装（Issue #281）

**🔴 RED**

- [ ] `frontend/app/routes/settings.test.tsx` に追記
  - 通知タブが表示される
  - Push許可ステータス（許可済み/未許可/非対応）が表示される
  - 全体ONトグルをOFFにすると個別トグルがdisabledになる
  - トグル変更で `PUT /api/notifications/settings` が呼ばれる

**🟢 GREEN**

- [ ] `frontend/app/routes/settings.tsx` に `"notification"` タブを追加（`TabId` 型拡張）
- [ ] `frontend/app/components/NotificationTab.tsx` 作成
  - Push通知セクション: 許可ステータス表示・「通知を許可する」ボタン（未許可時のみ）
  - Push全体ON/OFFトグル（OFF時はサブトグルをdisabled）
  - 個別トグル: デイリーリフレッシュ・ストリークリマインダー・週次サマリー・月次サマリー
  - メール通知セクション（同構成。デイリーリフレッシュのみ非表示）
  - iOS非スタンドアロン時: 「ホーム画面に追加後に利用できます」案内を表示（`isStandalone()` で判定）
- [ ] トグル変更で即時 `updateNotificationSettings()` を呼ぶ（debounce不要）

**🔵 REFACTOR**

- [ ] ON/OFFトグルを `NotificationToggle` コンポーネントに切り出し

---

### 通知許可バナー実装（Issue #282）

> **実機確認必須**: iOS PWAスタンドアロン時のブラウザ許可ダイアログ表示を実機で確認すること。

**🔴 RED**

- [ ] `frontend/app/routes/home.test.tsx` に追記
  - `isStandalone=true` + `permission=default` + 未dismissed → バナーが表示される
  - `permission=granted` → バナーが表示されない
  - dismissed済み → バナーが表示されない

**🟢 GREEN**

- [ ] `frontend/app/components/PushNotificationBanner.tsx` 作成
  - 「許可する」ボタン → `subscribePush(token)` 呼び出し
  - 「後で」ボタン → `localStorage.setItem("push-banner-dismissed", "1")` で非表示
- [ ] `frontend/app/routes/home.tsx` に `PushNotificationBanner` を追加
  - 表示条件: `isStandalone() && Notification.permission === "default" && !localStorage.getItem("push-banner-dismissed")`

**🔵 REFACTOR**

- [ ] 表示条件チェックを `usePushBannerVisible()` カスタムフックに切り出し

---

### ストリーク判定をローリングウィンドウ方式に変更（Issue #284）

> **実施タイミング**: #270〜#282（通知機能）がすべて完了してから着手すること。
> スケジューラー（#279）がストリーク判定に依存しており、途中変更すると二重対応が発生するため。

**仕様変更の概要**:
- **現在**: 月曜〜日曜の暦週単位で判定（同じ週に何度行っても1カウント、週をまたげばストリーク継続）
- **変更後**: 前回訪問から7日以内に訪問すれば継続、7日以上空いたらリセット（ローリングウィンドウ）

**変更後の挙動例**:
- 月曜訪問 → 土曜訪問（5日後）: ストリーク継続（7日以内）
- 月曜訪問 → 翌月曜訪問（7日後）: ストリーク継続（7日以内）
- 月曜訪問 → 翌火曜訪問（8日後）: ストリークリセット

**🔴 RED**

- [ ] `backend/services/gamification_test.go` の `TestUpdateStreak` を新仕様に書き直す
  - `前回から6日後に訪問 → 継続` / `前回から7日後に訪問 → 継続` / `前回から8日後に訪問 → リセット`
  - 暦週をまたぐケース（例: 日曜訪問→翌月曜訪問=1日後）でリセットされないことを検証

**🟢 GREEN**

- [ ] `backend/services/gamification.go` の `UpdateStreak` を日数ベースに書き換え
  - `weekStart()` ではなく `visitedAt.Sub(*user.StreakLast)` で日数差を計算
  - `diff < 7日`: 同じ"期間"内 → 変化なし（ただし `StreakLast` は更新）
  - `7日 ≤ diff < 14日`: ストリーク継続 → `streak_count++`
  - `diff ≥ 14日`: リセット → `streak_count = 1`
  - `weekStart()` ヘルパー関数を削除（他に使用箇所がなければ）
- [ ] `backend/services/scheduler.go` のストリークリマインダーを変更
  - cronを `0 7 * * 0`（日曜のみ）→ `0 7 * * *`（毎日）に変更
  - 送信条件: `DATE(streak_last) = DATE(NOW() - INTERVAL 6 DAY)` かつ `streak_count > 0`（前回訪問から6日目 = 今日中に訪問しないと切れる）

**🔵 REFACTOR**

- [ ] `notification-roadmap.md` のストリークリマインダー送信条件の記述を新仕様に合わせて更新

---

### 週次・月次サマリー 訪問ゼロ時テンプレート追加（Issue #290）

> #279（スケジューラー実装）完了後に着手。訪問なしでもサマリーを送る仕様変更に対応するため、空状態専用テンプレートが必要。

**🔴 RED**

- [ ] `backend/services/email_test.go` に追記
  - `TestBuildWeeklySummaryEmptyEmail` — `VisitCount: 0` の場合に空状態テンプレートの内容が返るか
  - `TestBuildMonthlySummaryEmptyEmail` — 同様

**🟢 GREEN**

- [ ] `backend/templates/email/weekly_summary_empty.html` 作成（「今週は冒険できなかったね！来週また行ってみよう」系の背中押しコンテンツ）
- [ ] `backend/templates/email/monthly_summary_empty.html` 作成（同様）
- [ ] `backend/services/email.go` の `BuildWeeklySummaryEmail` / `BuildMonthlySummaryEmail` に `VisitCount == 0` 判定を追加し、空状態テンプレートに切り替える

**🔵 REFACTOR**

- [ ] 空状態判定を `isEmptySummary(visitCount int) bool` ヘルパーに切り出し

---

### 月次サマリー通知設定デフォルト値をONに変更（Issue #291）

> `NotificationSettings.MonthlySummary` は現在 `default:false`（opt-in）になっているが、週次サマリーと同様に `default:true` に変更する。

**🟢 GREEN**

- [ ] `backend/models/notification.go` の `MonthlySummary` タグを `gorm:"default:false"` → `gorm:"default:true"` に変更
- [ ] `backend/database/migrate.go` に既存ユーザーのデフォルト値を更新するマイグレーションを追加（`UPDATE notification_settings SET monthly_summary = true WHERE monthly_summary = false`）

**🔵 REFACTOR**

- [ ] `backend/models/notification_test.go` の `TestNotificationSettingsDefaults` を新デフォルト値に合わせて更新

---

## Phase 3 計画（iOS）— ベータFBと通知実装後に着手

---

## マーケティング（継続）

> ブランド構築・SNSアカウント・初期コンテンツはすべて完了済み。

- [~] **開発ログの継続投稿**: X / Instagram / TikTok で開発内容や気づきを共有する
- [ ] **Product Hunt / 開発系コミュニティへの「予告」**（Optional）
  - [ ] "Upcoming" ページ等の活用検討
