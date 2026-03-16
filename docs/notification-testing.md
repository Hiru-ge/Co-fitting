# 通知機能 動作確認チェックリスト（ローカル環境）

**対象フェーズ**: Phase 2（通知機能）
**最終更新**: 2026-03-15

すべての手順は `docker-compose up` で立ち上げたローカル環境で完結する。

---

## 事前準備

- [x] `docker-compose up -d` でコンテナ起動済み
- [x] `backend/.env` に以下の環境変数が設定済み

```bash
grep -E "VAPID|RESEND|NOTIFICATION_EMAIL" backend/.env
```

```
VAPID_PUBLIC_KEY=<生成済みの公開鍵>
VAPID_PRIVATE_KEY=<生成済みの秘密鍵>
VAPID_SUBJECT=mailto:notifications@roamble.app
RESEND_API_KEY=re_<自分のAPIキー>
NOTIFICATION_EMAIL_FROM=Roamble <notifications@roamble.app>
```

> VAPID鍵の生成方法: `go run github.com/SherClockHolmes/webpush-go/cmd/webpush@latest`

- [x] バックエンド起動ログに以下が両方出ている

```bash
docker-compose logs backend | grep -E "push|email|notification"
```

```
Notification push service initialized
Notification email service initialized
```

片方でも `Warning: ... disabled` が出ていたら環境変数が未設定なので追記して再起動する。

---

## 確認範囲

| 確認内容 | PC Chrome | スマホ（Android） |
|---------|:---------:|:----------------:|
| APIエンドポイント | ✅ | ✅ |
| Web Push 通知受信 | ✅ | ✅ |
| メール通知 | ✅ | ✅ |
| Push許可ダイアログ | ✅ | ✅ |
| 通知設定UI | ✅ | ✅ |
| Push通知バナー表示 | ❌ standalone非対応 | ✅ PWAインストール後 |

**→ ほぼすべてPCのChromeで確認できる。バナーコンポーネントだけスマホPWAが必要。**

---

## Step 1: APIエンドポイント疎通確認

まずトークンを取得する。以降のステップでも使い回す。

```bash
BASE_URL=http://localhost:8000

TOKEN=$(curl -s -X POST $BASE_URL/api/dev/auth/test-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","display_name":"テストユーザー"}' \
  | jq -r '.access_token')

echo "TOKEN: $TOKEN"
```

```bash
# VAPID公開鍵取得（認証不要）
curl -s $BASE_URL/api/notifications/push/vapid-key | jq .

# 通知設定取得（初回は全ONのデフォルト値で自動作成）
curl -s -H "Authorization: Bearer $TOKEN" \
  $BASE_URL/api/notifications/settings | jq .

# 通知設定更新
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"push_enabled":true,"email_enabled":true,"weekly_summary":true}' \
  $BASE_URL/api/notifications/settings | jq .
```

- [x] VAPID公開鍵が `{"vapid_public_key":"..."}` 形式で返る
- [x] 初回の設定取得で全ONのデフォルト値が返る
- [x] 設定更新後に値が反映される

---

## Step 2: Web Push通知の確認（PCのChromeで実施）

1. `http://localhost:5173` をChromeで開く
2. 設定画面 → 通知タブ を開く
3. Push通知を許可する（Chromeの許可ダイアログ → 「許可」）

```bash
# Push購読登録をDBで確認
docker exec -it roamble_db mysql -uroamble -pDandelion1110 roamble \
  -e "SELECT user_id, SUBSTRING(endpoint, 1, 60) AS endpoint_prefix, user_agent, created_at FROM push_subscriptions;"
```

4. 通知を発火してChromeに届くか確認する

```bash
# デイリーサジェスション（Push専用・最もシンプル）
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"daily_suggestion"}'
```

数秒後にChromeの通知（画面右下のトースト）が届けばOK。

- [x] Push許可ダイアログが表示される
- [x] 許可後に `push_subscriptions` テーブルにレコードが作成される（2026-03-16確認）
- [ ] `daily_suggestion` を発火してChrome通知が届く
- [ ] `weekly_summary` を発火してChrome通知が届く（クリックで `/summary/weekly` に遷移）
- [ ] `monthly_summary` を発火してChrome通知が届く（クリックで `/summary/monthly` に遷移）
- [ ] Push通知をOFFにしてから発火しても通知が来ない
- [ ] Push購読解除後に `push_subscriptions` のレコードが削除される

> **注意**: ローカル環境でPush通知を確認するにはブラウザでPush許可を行ってから実施すること（許可前は `push_subscriptions` が0件のため通知は届かない）。

---

## Step 3: メール通知の確認

> ⚠️ スケジューラーは `weekly_summary` / `monthly_summary` がONの**全ユーザー**に送信する。自分の本アカウントにも届くので注意。

> ⚠️ `weekly_summary` の集計対象は「**先週（月〜日）**」、`monthly_summary` は「**前月**」。該当期間のデータがDBにない場合は訪問0件のメールが届く（正常動作）。先週・前月の日付で `visit_history` にデータを手動挿入してからテストすること。

> ⚠️ **Resend レート制限**: 連続して複数タイプを発火すると Resend の 2req/s 制限に引っかかる。各発火の間に **10秒程度の間隔**を空けること。

```bash
# 週次サマリー発火
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"weekly_summary"}'

sleep 10

# 月次サマリー発火
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"monthly_summary"}'
```

メールテンプレートをブラウザでプレビューする場合（送信前の目視確認）:

```bash
cd backend && go run cmd/preview-email/main.go
# → http://localhost:8088/preview/ が開く
# weekly_summary / monthly_summary / streak_reminder の各テンプレートを確認できる
```

- [x] 週次サマリーメールが受信できる（2026-03-15確認: 3箇所・210 XP）
- [x] 月次サマリーメールが受信できる（2026-03-15確認: 4箇所・250 XP）
- [x] HTMLが崩れていない
- [x] Resendダッシュボードに送信成功のログが出ている（[resend.com](https://resend.com) の `Emails` タブで確認）

---

## Step 4: エッジケース確認

### Push購読の無効化（410/404自動削除）

```bash
# 購読のendpointを無効な値に書き換え
docker exec -it roamble_db mysql -uroamble -pDandelion1110 roamble \
  -e "UPDATE push_subscriptions SET endpoint='https://invalid.example.com/invalid' LIMIT 1;"

# 通知を発火
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"daily_suggestion"}'

# バックエンドログで自動削除を確認
docker-compose logs backend | grep "cleanup"

# DBから該当レコードが消えていることを確認
docker exec -it roamble_db mysql -uroamble -pDandelion1110 roamble \
  -e "SELECT COUNT(*) FROM push_subscriptions WHERE endpoint='https://invalid.example.com/invalid';"
```

- [ ] バックエンドログに `cleanup` が出る
- [ ] 無効化したレコードがDBから削除される

### 設定OFFのユーザーへの非送信確認

```bash
# メール通知をOFF
curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email_enabled":false}' \
  $BASE_URL/api/notifications/settings

sleep 10

# weekly_summary を発火 → メールが届かないことを確認
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"weekly_summary"}' \
  $BASE_URL/api/dev/notifications/trigger
```

> **注意**: スキップされてもバックエンドログにスキップログは出ない（コードは正しく動作している）。メールが届かないことで確認すること。

- [ ] `email_enabled: false` の状態でメールが届かない

---

## Step 5: スマホ固有の確認

バナーコンポーネントだけは実機で確認する。スマホとPCを同じWi-Fiに繋ぎ、PCのローカルIPでアクセスする。

```bash
# PCのローカルIPを確認
ipconfig getifaddr en0   # macOS
```

スマホのChromeで `http://<PCのIP>:5173` にアクセスする。

1. Chromeのメニュー →「ホーム画面に追加」でPWAインストール
2. PWAを開いてホーム画面（`/home`）にアクセス
3. 画面下部に通知許可バナーが表示されることを確認

- [ ] PWA（standalone）でホームを開くとバナーが表示される
- [ ] 「許可する」でPush購読が完了してバナーが消える
- [ ] 「後で」でバナーが消えて再表示されない

---

## 発火タイプ一覧

| type | 送信方法 | 備考 |
|------|---------|------|
| `daily_suggestion` | Push のみ | 最もシンプル。動作確認の起点に最適 |
| `weekly_summary` | Push + メール | 集計対象は先週（月〜日）。先週のデータが必要 |
| `monthly_summary` | Push + メール | 集計対象は前月。前月のデータが必要 |
| `streak_reminder` | Push + メール | 前回訪問から6日経過 + streak > 0 のユーザーのみ対象。対象なしは正常 |

---

## トラブルシューティング

| 症状 | 確認点 |
|-----|--------|
| Push通知が届かない | `docker-compose logs backend` でVAPIDの初期化ログを確認。ブラウザの通知設定が `denied` になっていないか確認（一度denyするとURLバーの🔒から手動で解除が必要） |
| メールが届かない | Resendダッシュボードで送信ログを確認。`RESEND_API_KEY` が有効かを確認。迷惑メールフォルダも確認 |
| `rate limit exceeded` エラー | 発火コマンドの間隔を10秒以上空ける |
| `trigger` エンドポイントが404 | `backend/.env` に `ENVIRONMENT=development` が設定されているか確認 |
| 訪問0件のメールが届く | `weekly_summary` は先週・`monthly_summary` は前月のデータのみ集計する。該当期間の `visit_history` にデータを挿入してから再発火 |
| `streak_reminder` を発火しても何も送られない | 対象ユーザー（前回訪問から6日経過 + streak > 0）が存在しないため正常。`users.last_visited_at` を手動で6日前に設定してテスト |
| スマホからローカルにアクセスできない | `vite.config.ts` の `server.host` が `true` または `0.0.0.0` になっているか確認 |
