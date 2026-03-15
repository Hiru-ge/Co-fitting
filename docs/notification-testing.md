# 通知機能 動作確認ガイド（ローカル環境）

**対象フェーズ**: Phase 2（通知機能）
**最終更新**: 2026-03-15

すべての手順は `docker-compose up` で立ち上げたローカル環境で完結する。

---

## 事前準備

### 1. Docker環境を起動する

```bash
cd /Users/hiruge/Project/Roamble
docker-compose up -d
```

### 2. `backend/.env` に通知関連の環境変数を追加する

```bash
# 設定済みか確認
grep -E "VAPID|RESEND|NOTIFICATION_EMAIL" backend/.env
```

未設定の場合は以下を追記する。

```
VAPID_PUBLIC_KEY=<生成済みの公開鍵>
VAPID_PRIVATE_KEY=<生成済みの秘密鍵>
VAPID_SUBJECT=mailto:notifications@roamble.app
RESEND_API_KEY=re_<自分のAPIキー>
NOTIFICATION_EMAIL_FROM=Roamble <notifications@roamble.app>
```

> VAPID鍵の生成方法: `go run github.com/SherClockHolmes/webpush-go/cmd/webpush@latest`

### 3. バックエンドを再起動して起動ログを確認する

```bash
docker-compose restart backend
docker-compose logs backend | grep -E "push|email|notification"
```

**期待されるログ（両方出ればOK）:**

```
Notification push service initialized
Notification email service initialized
```

片方でも `Warning: ... disabled` が出ていたら環境変数が未設定なので追記して再起動する。

---

## テスト環境別の対応範囲

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

## 確認手順

### Step 1: APIエンドポイントの疎通確認

```bash
BASE_URL=http://localhost:8000

# テストログインでJWTトークンを取得
TOKEN=$(curl -s -X POST $BASE_URL/api/dev/auth/test-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","display_name":"テストユーザー"}' \
  | jq -r '.access_token')

echo "TOKEN: $TOKEN"

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

**チェックリスト:**
- [ ] VAPID公開鍵が `{"vapid_public_key":"..."}` 形式で返る
- [ ] 初回の設定取得で全ONのデフォルト値が返る
- [ ] 設定更新後に値が反映される

---

### Step 2: Web Push通知の確認（PCのChromeで実施）

**1. `http://localhost:5173` をChromeで開く**

**2. 設定画面 → 通知タブ を開く**

**3. Push通知を許可する**
- Chromeの許可ダイアログが表示される → 「許可」をクリック
- 「通知が許可されています」と表示されればOK

**4. DBで購読登録を確認する**

```bash
docker exec -it roamble-db mysql -u root -p roamble \
  -e "SELECT user_id, SUBSTRING(endpoint, 1, 60) AS endpoint_prefix, user_agent, created_at FROM push_subscriptions;"
```

レコードが作成されていればバックエンドへの購読登録が成功している。

**5. 通知を即時発火してChromeに届くか確認する**

```bash
# デイリーサジェスション（Push専用・最もシンプル）
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"daily_suggestion"}'
```

数秒後にChromeの通知（画面右下のトースト）が届けばOK。

**6. 通知クリックでアプリに遷移するか確認する**

通知をクリックして `/home` が開けばService Workerの `notificationclick` が正常動作している。

**チェックリスト:**
- [ ] Push許可ダイアログが表示される
- [ ] 許可後に `push_subscriptions` テーブルにレコードが作成される
- [ ] `daily_suggestion` を発火してChrome通知が届く
- [ ] `weekly_summary` を発火してChrome通知が届く
- [ ] 通知クリックで正しいURLに遷移する
- [ ] Push通知をOFFにしてから発火しても通知が来ない
- [ ] Push購読解除後に `push_subscriptions` のレコードが削除される

---

### Step 3: メール通知の確認

**1. テストユーザーのメールアドレスを自分の実在するアドレスに設定する**

```bash
docker exec -it roamble-db mysql -u root -p roamble \
  -e "UPDATE users SET email='your@example.com' WHERE email='test@example.com';"
```

**2. 通知設定でメール通知をONにする**

設定画面 → 通知タブ → メール通知トグルをON

**3. 週次サマリーを発火してメールを受信する**

```bash
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"weekly_summary"}'
```

**4. メールを確認する**
- 件名: `【Roamble】今週の冒険まとめ`
- 送信元: `Roamble <notifications@roamble.app>`
- HTMLが正しくレンダリングされているか目視確認

**5. Resendダッシュボードで送信ログを確認する**

[resend.com](https://resend.com) の `Emails` タブで送信履歴・エラーが確認できる。

**チェックリスト:**
- [ ] 週次サマリーメールが受信できる
- [ ] 月次サマリーメールが受信できる
- [ ] HTMLが崩れていない
- [ ] Resendダッシュボードに送信成功のログが出ている

---

### Step 4: 発火タイプ一覧

```bash
# デイリーサジェスション（Pushのみ）
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"daily_suggestion"}'

# ストリークリマインダー（Push + メール）
# ※「前回訪問から6日経過したユーザー」のみ対象。対象がいない場合は誰にも送られない（正常）
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"streak_reminder"}'

# 週次サマリー（Push + メール）← 動作確認に最適
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"weekly_summary"}'

# 月次サマリー（Push + メール）
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"monthly_summary"}'
```

> `streak_reminder` はDBの `users.streak_last` を手動で6日前に書き換えないとほぼ発火しない。
> 動作確認は `daily_suggestion` か `weekly_summary` から始めるのが楽。

---

### Step 5: スマホ（Android）固有の確認

バナーコンポーネントだけは実機で確認する。スマホとPCを同じWi-Fiに繋ぎ、PCのローカルIPでアクセスする。

```bash
# PCのローカルIPを確認
ipconfig getifaddr en0   # macOS
```

スマホのChromeで `http://<PCのIP>:5173` にアクセスする。

**手順:**
1. Chromeのメニュー →「ホーム画面に追加」でPWAインストール
2. PWAを開いてホーム画面（`/home`）にアクセス
3. 画面下部に通知許可バナーが表示されることを確認

**チェックリスト:**
- [ ] PWA（standalone）でホームを開くとバナーが表示される
- [ ] 「許可する」でPush購読が完了してバナーが消える
- [ ] 「後で」でバナーが消えて再表示されない

---

## エッジケース確認

### Push購読の無効化（410/404自動削除）

```bash
# 購読のendpointを無効な値に書き換え
docker exec -it roamble-db mysql -u root -p roamble \
  -e "UPDATE push_subscriptions SET endpoint='https://invalid.example.com/invalid' LIMIT 1;"

# 通知を発火
curl -s -X POST $BASE_URL/api/dev/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"daily_suggestion"}'

# バックエンドログで自動削除を確認
docker-compose logs backend | grep "cleanup"

# DBから該当レコードが消えていることを確認
docker exec -it roamble-db mysql -u root -p roamble \
  -e "SELECT COUNT(*) FROM push_subscriptions WHERE endpoint='https://invalid.example.com/invalid';"
```

### 設定OFFのユーザーへの非送信確認

```bash
# メール通知をOFF
curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email_enabled":false}' \
  $BASE_URL/api/notifications/settings

# weekly_summary を発火 → メールが届かないことを確認
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"weekly_summary"}' \
  $BASE_URL/api/dev/notifications/trigger
```

---

## トラブルシューティング

| 症状 | 確認点 |
|-----|--------|
| Push通知が届かない | `docker-compose logs backend` でVAPIDの初期化ログを確認。ブラウザの通知設定が `denied` になっていないか確認（一度denyするとURLバーの🔒から手動で解除が必要） |
| メールが届かない | Resendダッシュボードで送信ログを確認。`RESEND_API_KEY` が有効かを確認。迷惑メールフォルダも確認 |
| `trigger` エンドポイントが404 | `backend/.env` に `ENVIRONMENT=development` が設定されているか確認 |
| `streak_reminder` を発火しても何も送られない | 対象ユーザー（前回訪問から6日経過 + streak > 0）が存在しないため正常。`users.streak_last` を手動で6日前に設定してテスト |
| スマホからローカルにアクセスできない | `vite.config.ts` の `server.host` が `true` または `0.0.0.0` になっているか確認 |
