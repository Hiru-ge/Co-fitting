# 通知機能前準備 セットアップ手順書

> **対象**: Issue #270 — 通知機能前準備（設定作業）
> **前提**: `roamble.app` のドメイン・DNS 管理は Cloudflare。バックエンドは Cloud Run (asia-northeast1)。
> **完了後確認事項**: env変数が実機で読み込まれているか・DNS伝播が完了しているかを必ず確認すること。

---

## 全体の流れ

```
1. VAPID 鍵生成 → .env + Cloud Run に追加
2. Resend アカウント作成・ドメイン認証（Cloudflare 自動連携）
3. RESEND_API_KEY / NOTIFICATION_EMAIL_FROM を .env + Cloud Run に追加
4. Cloud Run 最小インスタンス数を 0 → 1 に変更
5. 動作確認
```

---

## 1. VAPID 鍵生成

Web Push 通知を送信するために必要な VAPID（Voluntary Application Server Identification）鍵ペアを生成する。

### 1-1. 鍵生成コマンド実行

```bash
npx web-push generate-vapid-keys
```

実行すると以下の形式で出力される:

```
Private Key: <base64url エンコードされた秘密鍵>
Public Key:  <base64url エンコードされた公開鍵>
```

> **注意**: 出力された鍵はこの1回しか表示されないため、必ず安全な場所に保存すること。再生成した場合、既存の Push 購読がすべて無効になる（再購読が必要になる）。

### 1-2. .env への追加

プロジェクトルートの `backend/.env` に以下を追記する:

```dotenv
VAPID_PUBLIC_KEY=<生成された Public Key>
VAPID_PRIVATE_KEY=<生成された Private Key>
VAPID_SUBJECT=mailto:official@roamble.app
```

`VAPID_SUBJECT` は Push サービスがエラー時に連絡するための識別子。メールアドレス（`mailto:` プレフィックス必須）または HTTPS URL を指定する。

### 1-3. Cloud Run への環境変数追加

```bash
gcloud run services update roamble-backend \
  --region asia-northeast1 \
  --update-env-vars "VAPID_PUBLIC_KEY=<Public Key>,VAPID_PRIVATE_KEY=<Private Key>,VAPID_SUBJECT=mailto:official@roamble.app"
```

または GCP コンソールから設定する場合:

1. GCP コンソール → 「Cloud Run」→「roamble-backend」
2. 「Edit & Deploy New Revision」をクリック
3. 「Variables & Secrets」タブ → 「Add Variable」で以下を追加:

| 変数名 | 値 |
|--------|-----|
| `VAPID_PUBLIC_KEY` | 生成された Public Key |
| `VAPID_PRIVATE_KEY` | 生成された Private Key |
| `VAPID_SUBJECT` | `mailto:official@roamble.app` |

4. 「Deploy」をクリック

---

## 2. Resend アカウント作成・ドメイン認証

Resend はメール送信 SaaS。無料プランで月3,000通まで送信可能。

### 2-1. アカウント作成

1. https://resend.com にアクセス
2. 「Sign Up」→ GitHubでログイン
3. メール認証が届く場合は確認して完了

### 2-2. ドメイン追加

1. Resend ダッシュボード左サイドバーの「**Domains**」をクリック
2. 「**Add Domain**」をクリック
3. ドメイン名に `roamble.app` を入力して「Add」
4. Region は **Tokyo (ap-northeast-1)** を選択（日本ユーザー向けのため）
5. 「Add」をクリック

追加後、DNS レコードの設定画面が表示される。次のステップで Cloudflare と自動連携する。

### 2-3. Cloudflare 自動連携で DNS レコードを追加

Resend のドメイン追加画面に「**Connect with Cloudflare**」オプションが表示される。これを使うと SPF・DKIM・DMARC・MX の全レコードが自動で追加される。

1. 「**Connect with Cloudflare**」をクリック
2. Cloudflare アカウントでの認証画面が表示されるので許可する
3. 対象ゾーン（`roamble.app`）を選択して「**Allow**」
4. Resend ダッシュボードに戻り、ドメインのステータスが「**Verified**」になるのを確認する

> Cloudflare 管理のドメインは自動連携後、通常数分以内に認証が完了する。

---

## 3. Resend API キーの発行

1. Resend ダッシュボード左サイドバーの「**API Keys**」をクリック
2. 「**Create API Key**」をクリック
3. 以下を設定して「Add」:
   - **Name**: `roamble-production`
   - **Permission**: `Sending access`（Full access は不要）
   - **Domain**: `roamble.app`（ドメインを絞ると安全）
4. 表示された API キー（`re_` で始まる文字列）をコピーして安全な場所に保存

> **注意**: API キーはこの1回しか表示されない。忘れた場合は再発行が必要。

---

## 4. .env + Cloud Run に Resend 環境変数を追加

### 4-1. .env への追加

`backend/.env` に以下を追記:

```dotenv
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTIFICATION_EMAIL_FROM=Roamble <official@roamble.app>
```

### 4-2. Cloud Run への環境変数追加

```bash
gcloud run services update roamble-backend \
  --region asia-northeast1 \
  --update-env-vars "RESEND_API_KEY=re_xxxxxxxx,NOTIFICATION_EMAIL_FROM=Roamble <official@roamble.app>"
```

または GCP コンソールから「Edit & Deploy New Revision」→「Variables & Secrets」で追加:

| 変数名 | 値 |
|--------|-----|
| `RESEND_API_KEY` | `re_` で始まる API キー |
| `NOTIFICATION_EMAIL_FROM` | `Roamble <official@roamble.app>` |

---

## 5. Cloud Run 最小インスタンス数を 0 → 1 に変更

通知スケジューラー（Issue #279）はバックグラウンドで定期実行するため、インスタンスが 0 にスケールインするとスケジューラーが停止してしまう。最小インスタンス数を 1 に設定して常時起動を保証する。

> **注意**: 最小インスタンス 1 に変更すると月額 $0 → 約 $3〜5/月（256MB, 1vCPU, Tokyo の場合）の料金が発生する。GCP 無料枠（月180,000 vCPU-seconds）を超えた分が課金される。

### 5-1. gcloud CLI で変更

```bash
gcloud run services update roamble-backend \
  --region asia-northeast1 \
  --min-instances 1
```

### 5-2. GCP コンソールから変更する場合

1. GCP コンソール → 「Cloud Run」→「roamble-backend」
2. 「Edit & Deploy New Revision」をクリック
3. 「Capacity」タブ（または「Container」タブ内のスケーリング設定）を開く
4. **「Minimum number of instances」** を `0` → `1` に変更
5. 「Deploy」をクリック

### 5-3. 設定確認

```bash
gcloud run services describe roamble-backend \
  --region asia-northeast1 \
  --format="value(spec.template.metadata.annotations)"
```

出力に `autoscaling.knative.dev/minScale: "1"` が含まれていれば設定完了。

---

## 6. 動作確認チェックリスト

### VAPID 鍵

- [x] `backend/.env` に `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` が設定されている
- [x] Cloud Run の環境変数に同じ3つの変数が設定されている
- [x] Cloud Run の最新リビジョンが新しい env 変数を読み込んでいる（`gcloud run revisions describe` で確認）

### Resend DNS 認証

- [x] Resend ダッシュボードで `roamble.app` のドメイン認証が完了（全レコード ✓ Verified）
- [x] `dig TXT send.roamble.app` で SPF レコードが返ってくる
- [x] `dig TXT resend._domainkey.roamble.app` で DKIM レコードが返ってくる
- [x] `dig TXT _dmarc.roamble.app` で DMARC レコードが返ってくる

### Resend 環境変数

- [x] `backend/.env` に `RESEND_API_KEY` / `NOTIFICATION_EMAIL_FROM` が設定されている
- [x] Cloud Run の環境変数に同じ2つの変数が設定されている

### Cloud Run インスタンス設定

- [x] Cloud Run の最小インスタンス数が `1` になっている
- [x] デプロイが正常に完了し、サービスが `READY` 状態である

### 実機確認（テスト送信）

- [x] Resend API でテスト送信を行い、エラーが出ないか確認（成功すると `{"id":"..."}` が返り Logs に履歴が表示される）
  ```bash
  curl -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"from":"Roamble <official@roamble.app>","to":["自分のメアド"],"subject":"テスト","text":"テスト送信"}'
  ```
- [x] Cloud Run のログ（GCP → Cloud Run → roamble-backend → Logs）に env 関連のエラーが出ていないか確認

---

## 環境変数まとめ（Issue #270 で追加するもの）

| 変数名 | 追加先 | 値の形式 |
|--------|--------|---------|
| `VAPID_PUBLIC_KEY` | `.env` + Cloud Run | base64url 文字列（`npx web-push generate-vapid-keys` で生成） |
| `VAPID_PRIVATE_KEY` | `.env` + Cloud Run | base64url 文字列（`npx web-push generate-vapid-keys` で生成） |
| `VAPID_SUBJECT` | `.env` + Cloud Run | `mailto:official@roamble.app` |
| `RESEND_API_KEY` | `.env` + Cloud Run | `re_` で始まる文字列 |
| `NOTIFICATION_EMAIL_FROM` | `.env` + Cloud Run | `Roamble <official@roamble.app>` |

---

## トラブルシューティング

### `npx web-push generate-vapid-keys` でエラーが出る

```bash
# Node.js がインストールされていない場合
brew install node

# または Go で直接生成する場合
cd backend && go get github.com/SherClockHolmes/webpush-go
go run - <<'EOF'
package main

import (
    "fmt"
    webpush "github.com/SherClockHolmes/webpush-go"
)

func main() {
    privateKey, publicKey, err := webpush.GenerateVAPIDKeys()
    if err != nil { panic(err) }
    fmt.Printf("VAPID_PUBLIC_KEY=%s\n", publicKey)
    fmt.Printf("VAPID_PRIVATE_KEY=%s\n", privateKey)
}
EOF
```

### Resend の DNS 認証がなかなか通らない

- Cloudflare 自動連携を使った場合でも、まれに数分〜数十分かかることがある
- Resend ダッシュボードの「Verify DNS Records」ボタンを押して手動で再チェックする
- 最大 24 時間待ってから再確認する

### Resend から送信したメールがスパムに入る

DMARC ポリシーが `p=none` の間はスパム判定されやすい。ドメイン認証が安定したら以下の順で強化する:

1. `p=none` → 2週間モニタリング
2. `p=quarantine` → さらに2週間
3. `p=reject` → 本格運用

Cloudflare の DMARC レコードを編集して `p=quarantine` などに変更する。

### Cloud Run でコールドスタートが発生する

最小インスタンス 1 に設定しても、デプロイ直後や設定変更後のリビジョン切り替え時は一時的にコールドスタートが発生することがある。通常の運用では最小 1 インスタンスが常駐するため問題ない。
