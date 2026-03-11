# Roamble 通知機能 実装ロードマップ

**フェーズ**: Phase 2（iOS対応より先に実装）
**技術スタック**: Go（robfig/cron + webpush-go）、Resend（メール）、PWA Service Worker

---

## 通知種別

| 通知 | Web Push | Email | タイミング | 送信条件 |
|------|:--------:|:-----:|-----------|---------|
| 毎日提案リフレッシュ | ✅ | ❌ | 毎日 7:00 JST | Push購読済み・ON |
| ストリークリマインダー | ✅ | ✅ | 毎週木曜 20:00 JST | ストリーク > 0 かつ今週未訪問 |
| 週次サマリー | ✅ | ✅ | 毎週日曜 20:00 JST | 先週訪問件数 > 0 |
| 月次サマリー | ✅ | ✅ | 毎月1日 9:00 JST | 設定ON |

> デイリー通知はメール除外（毎日届くと迷惑メール認定されるリスクが高い）。

---

## Step 0: 前準備

### 外部サービス・環境設定

- [ ] **VAPID鍵生成**: `go run github.com/SherClockHolmes/webpush-go/cmd/webpush@latest` で公開鍵/秘密鍵を生成
  - 一度生成したら変更不可（変えると全購読が無効になる）
- [ ] **Resendアカウント作成**: [resend.com](https://resend.com) で登録（無料枠: 100通/日・3,000通/月）
- [ ] **DNSレコード追加（Cloudflare）**: Resend指定のSPF / DKIM / DMARCレコードを追加して `notifications@roamble.app` を送信元として認証
- [ ] **env変数追加**（`.env` + Cloud Run環境変数）:
  ```
  VAPID_PUBLIC_KEY=...
  VAPID_PRIVATE_KEY=...
  VAPID_SUBJECT=mailto:notifications@roamble.app
  RESEND_API_KEY=re_...
  NOTIFICATION_EMAIL_FROM=Roamble <notifications@roamble.app>
  ```
- [ ] **Cloud Run 最小インスタンス数を 0 → 1 に変更**: cronがGoプロセス内で動くため、スリープさせない

---

## Step 1: DB・モデル設計

**新規ファイル: `backend/models/notification.go`**

```go
// push_subscriptions: 1ユーザー複数デバイス対応
type PushSubscription struct {
    ID        uint64    `gorm:"primaryKey"`
    UserID    uint64    `gorm:"not null;index"`
    Endpoint  string    `gorm:"type:text;uniqueIndex"` // デバイスを一意に識別
    P256DH    string    `gorm:"type:varchar(255)"`
    Auth      string    `gorm:"type:varchar(255)"`
    UserAgent string    `gorm:"type:varchar(500)"`
    CreatedAt time.Time
}

// notification_settings: ユーザーごとの通知設定
type NotificationSettings struct {
    UserID          uint64    `gorm:"primaryKey"`
    PushEnabled     bool      `gorm:"default:true"`
    EmailEnabled    bool      `gorm:"default:true"`
    DailySuggestion bool      `gorm:"default:true"`
    WeeklySummary   bool      `gorm:"default:true"`
    MonthlySummary  bool      `gorm:"default:false"` // opt-in
    StreakReminder  bool      `gorm:"default:true"`
    UpdatedAt       time.Time `gorm:"autoUpdateTime"`
}
```

**`database/migrate.go` への追加**

```go
if err := db.AutoMigrate(
    &models.PushSubscription{},
    &models.NotificationSettings{},
); err != nil {
    return fmt.Errorf("failed to migrate notification tables: %w", err)
}
```

### 実装チェックリスト

- [ ] `models/notification.go` 作成
- [ ] `database/migrate.go` にAutoMigrate追加

---

## Step 2: バックエンドAPI（TDD）

**新規ファイル: `backend/handlers/notification.go`**

```
GET    /api/notifications/push/vapid-key    # VAPID公開鍵返却（認証不要）
POST   /api/notifications/push/subscribe    # Push購読登録（Upsert）
DELETE /api/notifications/push/subscribe    # Push購読解除
GET    /api/notifications/settings          # 通知設定取得
PUT    /api/notifications/settings          # 通知設定更新
```

**設計上の注意点**:
- `POST /subscribe` は `endpoint` をキーにしてUpsert（デバイス変更時も古い購読が残らない）
- `GET /settings` はレコード未作成でもデフォルト値を返す（初回ユーザーが設定画面を開けるように）

### 実装チェックリスト

- [ ] `handlers/notification_test.go` 作成（RED）
- [ ] `handlers/notification.go` 実装（GREEN）
- [ ] `routes/routes.go` に通知ルートを追加（`JWTAuth` ミドルウェア付き）
  - VAPID公開鍵エンドポイントのみ認証不要

---

## Step 3: 通知送信サービス

**新規ファイル: `backend/services/push.go`**
- ライブラリ: `github.com/SherClockHolmes/webpush-go`
- ユーザーの全購読に対してループ送信
- **410/404 を受け取ったら購読を自動削除**（放置すると無効な購読が積み上がる）

**新規ファイル: `backend/services/email.go`**
- ライブラリ: `github.com/resend/resend-go/v2`
- HTMLテンプレートは `text/template` で管理
- 週次/月次サマリーは集計期間の訪問件数・獲得XP・取得バッジをDBから取得して埋め込む

**新規ファイル: `backend/services/scheduler.go`**
- ライブラリ: `github.com/robfig/cron/v3`
- タイムゾーンは `cron.WithLocation(...)` で `Asia/Tokyo` を明示

```go
c := cron.New(cron.WithLocation(jst))
c.AddFunc("0 7 * * *",  svc.RunDailySuggestionNotification)
c.AddFunc("0 20 * * 4", svc.RunStreakReminderNotification)
c.AddFunc("0 20 * * 0", svc.RunWeeklySummaryNotification)
c.AddFunc("0 9 1 * *",  svc.RunMonthlySummaryNotification)
c.Start()
defer c.Stop()
```

### 実装チェックリスト

- [ ] `services/push.go` 作成（Push送信・購読削除ロジック）
- [ ] `services/email.go` 作成（メール送信・テンプレート）
- [ ] `services/scheduler.go` 作成（cronジョブ定義）
- [ ] `main.go` に `NotificationService` 初期化とスケジューラー起動を追加

---

## Step 4: フロントエンド Push 基盤

### vite-plugin-pwa のモード変更（重要）

現在の `registerType: "autoUpdate"` は workbox がSWを完全自動生成するため、push イベントを追加できない。`strategy: "injectManifest"` に変更してカスタムSWを使う。

**新規ファイル: `frontend/public/sw.js`**

```js
import { precacheAndRoute } from 'workbox-precaching'

// 既存のprecache設定を維持
precacheAndRoute(self.__WB_MANIFEST)

// Push通知受信
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Roamble', {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: data.url ?? '/home' },
    })
  )
})

// 通知クリックでアプリを開く
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

**注意**: `injectManifest` への変更後、既存のキャッシュ設定（`navigateFallback`・フォントの `CacheFirst` 等）をカスタムSW内に移植する必要がある。変更後は必ずPWAの動作（オフライン・インストール・アップデート）を実機確認すること。

**新規ファイル: `frontend/app/lib/push.ts`**

```ts
// VAPID公開鍵取得 → PushSubscription作成 → バックエンドに登録
export async function subscribePush(token: string): Promise<boolean>
export async function unsubscribePush(token: string): Promise<void>
export async function getPushPermissionState(): Promise<NotificationPermission>
```

**新規ファイル: `frontend/app/api/notifications.ts`**

```ts
export async function getNotificationSettings(token: string)
export async function updateNotificationSettings(token: string, settings: NotificationSettings)
export async function subscribePushToBackend(token: string, subscription: PushSubscription)
export async function unsubscribePushFromBackend(token: string, endpoint: string)
```

### 実装チェックリスト

- [ ] `vite.config.ts` の PWA設定を `strategy: "injectManifest"` に変更
- [ ] `public/sw.js` 作成（push / notificationclick イベント追加）
- [ ] 既存のworkboxキャッシュ設定をカスタムSWに移植
- [ ] `app/lib/push.ts` 作成
- [ ] `app/api/notifications.ts` 作成

---

## Step 5: 設定画面UI

`settings.tsx` に「通知」タブを追加（3タブ構成）:

```
[ユーザー情報]  [提案設定]  [通知]
```

**通知タブのUI構成**:

```
┌─ プッシュ通知 ──────────────────────────────────┐
│  ステータス: [許可済み / 未許可 / 非対応]          │
│  [通知を許可する] ボタン（未許可時のみ表示）       │
│  ─────────────────────────────────────────    │
│  プッシュ通知全体              [ON/OFF トグル]   │
│  ─────────────────────────────────────────    │
│  • 毎日のリフレッシュ通知        [ON/OFF]        │
│  • ストリークリマインダー        [ON/OFF]        │
│  • 週次サマリー                 [ON/OFF]        │
│  • 月次サマリー                 [ON/OFF]        │
└────────────────────────────────────────────┘

┌─ メール通知 ──────────────────────────────────┐
│  メール通知全体               [ON/OFF トグル]  │
│  ─────────────────────────────────────────  │
│  • ストリークリマインダー       [ON/OFF]       │
│  • 週次サマリー               [ON/OFF]        │
│  • 月次サマリー               [ON/OFF]        │
└───────────────────────────────────────────┘
```

**実装上の注意**:
- 全体ONを切ると個別設定がグレーアウト
- iOSでは `isStandalone()` でないとWeb Pushが使えない → 非スタンドアロン時は「ホーム画面に追加後に利用できます」と表示
- Push許可ステータスは `Notification.permission` をリアルタイムで表示

### 実装チェックリスト

- [ ] `settings.tsx` に「通知」タブを追加（TabId型の拡張）
- [ ] `NotificationTab` コンポーネントの実装
- [ ] Push許可状態表示・許可ボタンの実装
- [ ] トグルスイッチUIの実装（全体/個別）
- [ ] `PUT /api/notifications/settings` の即時保存（deounce不要。トグル変更で即送信）

---

## Step 6: 初回許可フロー

ホーム画面（`home.tsx`）に通知許可バナーを追加（条件付き表示）:

**表示条件**:
- `isStandalone() === true`
- `Notification.permission === "default"`
- `localStorage` に `"push-banner-dismissed"` がない

```
┌──────────────────────────────────────────────────┐
│ 毎朝7時に今日の提案をお届けします                  │
│ [許可する]                           [後で]      │
└──────────────────────────────────────────────────┘
```

- 「許可する」→ `subscribePush()` を呼び出してブラウザの許可ダイアログを表示
- 「後で」→ `localStorage` に `"push-banner-dismissed"` を保存して非表示

### 実装チェックリスト

- [ ] `home.tsx` に通知許可バナーコンポーネントを追加
- [ ] バナーの表示条件チェックとdismissロジックを実装

---

## よくある落とし穴

- **VAPID鍵は変えない**: 変更すると全ユーザーのPush購読が無効になり、再許可が必要になる
- **410/404レスポンスの処理を忘れない**: Push送信失敗時に購読を削除しないと、DBに無効な購読が蓄積してエラーログが増え続ける
- **Cron時刻はJSTを明示**: Cloud RunはデフォルトUTCなので `cron.WithLocation(jst)` を必ず設定する
- **PWA非インストール時のiOSへの説明**: Safari単体（非PWA）ではWeb Pushが使えないため、設定画面でわかりやすく案内する
