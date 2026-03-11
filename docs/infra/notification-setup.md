# 通知機能前準備 セットアップ手順書

> **対象**: Issue #270 — 通知機能前準備（設定作業）
> **前提**: `roamble.app` のドメイン・DNS 管理は Cloudflare。バックエンドは Cloud Run (asia-northeast1)。
> **完了後確認事項**: env変数が実機で読み込まれているか・DNS伝播が完了しているかを必ず確認すること。

---

## 全体の流れ

```
1. VAPID 鍵生成 → .env + Cloud Run に追加
2. Resend アカウント作成・ドメイン認証
3. Cloudflare に SPF / DKIM / DMARC レコード追加
4. RESEND_API_KEY / NOTIFICATION_EMAIL_FROM を .env + Cloud Run に追加
5. Cloud Run 最小インスタンス数を 0 → 1 に変更
6. 動作確認
```

---

## 1. VAPID 鍵生成

Web Push 通知を送信するために必要な VAPID（Voluntary Application Server Identification）鍵ペアを生成する。

### 1-1. 鍵生成コマンド実行

```bash
go run github.com/SherClockHolmes/webpush-go/cmd/webpush@latest
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
2. 「Sign Up」→ GitHub または Google アカウントでログイン
3. メール認証が届く場合は確認して完了

### 2-2. ドメイン追加

1. Resend ダッシュボード左サイドバーの「**Domains**」をクリック
2. 「**Add Domain**」をクリック
3. ドメイン名に `roamble.app` を入力して「Add」
4. Region は **Tokyo (ap-northeast-1)** を選択（日本ユーザー向けのため）
5. 「Add」をクリック

追加後、DNS レコードの設定画面が表示される。次のステップで Cloudflare に追加する。

### 2-3. Resend が要求する DNS レコードを確認

Resend の Domains 画面に表示される以下のレコードをメモしておく（値は実際の画面の値を使うこと）:

| タイプ | 名前 | 値 |
|--------|------|-----|
| MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | `p=<長い公開鍵文字列>` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

> 実際の値は Resend ダッシュボードの Domains 画面に表示されるものを使用すること。上記はサンプル値。

---

## 3. Cloudflare に DNS レコード追加

### 3-1. Cloudflare ダッシュボードを開く

1. https://dash.cloudflare.com にアクセス
2. 「roamble.app」ドメインを選択
3. 左サイドバーの「**DNS**」→「**Records**」を開く

### 3-2. SPF レコード追加

> SPF (Sender Policy Framework): `roamble.app` からのメール送信を Amazon SES 経由で許可する設定。

「Add record」をクリックして以下を入力:

| 項目 | 値 |
|------|-----|
| Type | `TXT` |
| Name | `send` |
| Content | `v=spf1 include:amazonses.com ~all` |
| TTL | Auto |
| Proxy status | DNS only（オレンジ雲 OFF） |

「Save」をクリック。

### 3-3. DKIM レコード追加

> DKIM (DomainKeys Identified Mail): メールが改ざんされていないことを証明する署名設定。

「Add record」をクリックして以下を入力:

| 項目 | 値 |
|------|-----|
| Type | `TXT` |
| Name | `resend._domainkey` |
| Content | Resend ダッシュボードに表示された `p=...` の値（長い文字列） |
| TTL | Auto |
| Proxy status | DNS only（オレンジ雲 OFF） |

「Save」をクリック。

> **注意**: DKIM の Content 値は非常に長い場合がある。Cloudflare は長い TXT レコードを自動的に分割して保存するため、そのまま貼り付けてよい。

### 3-4. DMARC レコード追加

> DMARC (Domain-based Message Authentication): SPF・DKIM の認証結果に基づくメール処理ポリシー設定。初期は `p=none`（モニタリングのみ）で設定し、問題ないことを確認してから `p=quarantine` → `p=reject` に強化する。

「Add record」をクリックして以下を入力:

| 項目 | 値 |
|------|-----|
| Type | `TXT` |
| Name | `_dmarc` |
| Content | `v=DMARC1; p=none; rua=mailto:official@roamble.app` |
| TTL | Auto |
| Proxy status | DNS only（オレンジ雲 OFF） |

「Save」をクリック。

### 3-5. MX レコード追加

| 項目 | 値 |
|------|-----|
| Type | `MX` |
| Name | `send` |
| Mail server | `feedback-smtp.ap-northeast-1.amazonses.com` |
| Priority | `10` |
| TTL | Auto |
| Proxy status | DNS only（オレンジ雲 OFF） |

「Save」をクリック。

### 3-6. DNS 伝播の確認

Cloudflare の DNS 変更は通常数分〜数十分で伝播する。以下のコマンドで確認できる:

```bash
# SPF レコード確認
dig TXT send.roamble.app

# DKIM レコード確認
dig TXT resend._domainkey.roamble.app

# DMARC レコード確認
dig TXT _dmarc.roamble.app
```

または https://mxtoolbox.com/SuperTool.aspx でドメインを入力して確認することもできる。

---

## 4. Resend でドメイン認証を完了

DNS レコード追加後、Resend 側で認証状態を確認する。

1. Resend ダッシュボード → 「Domains」→ `roamble.app` を選択
2. 「**Verify DNS Records**」ボタンをクリック
3. 各レコードのステータスが「✓ Verified」になるまで待つ

> DNS 伝播には最大 24〜48 時間かかる場合があるが、Cloudflare 管理のドメインは通常数分で反映される。

### 4-1. API キーの発行

1. Resend ダッシュボード左サイドバーの「**API Keys**」をクリック
2. 「**Create API Key**」をクリック
3. 以下を設定して「Add」:
   - **Name**: `roamble-production`
   - **Permission**: `Sending access`（Full access は不要）
   - **Domain**: `roamble.app`（ドメインを絞ると安全）
4. 表示された API キー（`re_` で始まる文字列）をコピーして安全な場所に保存

> **注意**: API キーはこの1回しか表示されない。忘れた場合は再発行が必要。

---

## 5. .env + Cloud Run に Resend 環境変数を追加

### 5-1. .env への追加

`backend/.env` に以下を追記:

```dotenv
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTIFICATION_EMAIL_FROM=Roamble <noreply@send.roamble.app>
```

> `NOTIFICATION_EMAIL_FROM` のメールアドレスは `send.roamble.app` サブドメイン（Resend で設定したドメイン）にすること。`@roamble.app` 直接は送信できない。

### 5-2. Cloud Run への環境変数追加

```bash
gcloud run services update roamble-backend \
  --region asia-northeast1 \
  --update-env-vars "RESEND_API_KEY=re_xxxxxxxx,NOTIFICATION_EMAIL_FROM=Roamble <noreply@send.roamble.app>"
```

または GCP コンソールから「Edit & Deploy New Revision」→「Variables & Secrets」で追加:

| 変数名 | 値 |
|--------|-----|
| `RESEND_API_KEY` | `re_` で始まる API キー |
| `NOTIFICATION_EMAIL_FROM` | `Roamble <noreply@send.roamble.app>` |

---

## 6. Cloud Run 最小インスタンス数を 0 → 1 に変更

通知スケジューラー（Issue #279）はバックグラウンドで定期実行するため、インスタンスが 0 にスケールインするとスケジューラーが停止してしまう。最小インスタンス数を 1 に設定して常時起動を保証する。

> **注意**: 最小インスタンス 1 に変更すると月額 $0 → 約 $3〜5/月（256MB, 1vCPU, Tokyo の場合）の料金が発生する。GCP 無料枠（月180,000 vCPU-seconds）を超えた分が課金される。

### 6-1. gcloud CLI で変更

```bash
gcloud run services update roamble-backend \
  --region asia-northeast1 \
  --min-instances 1
```

### 6-2. GCP コンソールから変更する場合

1. GCP コンソール → 「Cloud Run」→「roamble-backend」
2. 「Edit & Deploy New Revision」をクリック
3. 「Capacity」タブ（または「Container」タブ内のスケーリング設定）を開く
4. **「Minimum number of instances」** を `0` → `1` に変更
5. 「Deploy」をクリック

### 6-3. 設定確認

```bash
gcloud run services describe roamble-backend \
  --region asia-northeast1 \
  --format="value(spec.template.metadata.annotations)"
```

出力に `autoscaling.knative.dev/minScale: "1"` が含まれていれば設定完了。

---

## 7. 動作確認チェックリスト

### VAPID 鍵

- [ ] `backend/.env` に `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` が設定されている
- [ ] Cloud Run の環境変数に同じ3つの変数が設定されている
- [ ] Cloud Run の最新リビジョンが新しい env 変数を読み込んでいる（`gcloud run revisions describe` で確認）

### Resend DNS 認証

- [ ] Resend ダッシュボードで `roamble.app` のドメイン認証が完了（全レコード ✓ Verified）
- [ ] `dig TXT send.roamble.app` で SPF レコードが返ってくる
- [ ] `dig TXT resend._domainkey.roamble.app` で DKIM レコードが返ってくる
- [ ] `dig TXT _dmarc.roamble.app` で DMARC レコードが返ってくる

### Resend 環境変数

- [ ] `backend/.env` に `RESEND_API_KEY` / `NOTIFICATION_EMAIL_FROM` が設定されている
- [ ] Cloud Run の環境変数に同じ2つの変数が設定されている

### Cloud Run インスタンス設定

- [ ] Cloud Run の最小インスタンス数が `1` になっている
- [ ] デプロイが正常に完了し、サービスが `READY` 状態である

### 実機確認（テスト送信）

- [ ] Resend ダッシュボードの「**Logs**」でテスト送信を試みてエラーが出ないか確認
  - 「Testing」タブから `official@roamble.app` 宛にテストメールを送信できる
- [ ] Cloud Run のログ（GCP → Cloud Run → roamble-backend → Logs）に env 関連のエラーが出ていないか確認

---

## 環境変数まとめ（Issue #270 で追加するもの）

| 変数名 | 追加先 | 値の形式 |
|--------|--------|---------|
| `VAPID_PUBLIC_KEY` | `.env` + Cloud Run | base64url 文字列（`go run webpush` で生成） |
| `VAPID_PRIVATE_KEY` | `.env` + Cloud Run | base64url 文字列（`go run webpush` で生成） |
| `VAPID_SUBJECT` | `.env` + Cloud Run | `mailto:official@roamble.app` |
| `RESEND_API_KEY` | `.env` + Cloud Run | `re_` で始まる文字列 |
| `NOTIFICATION_EMAIL_FROM` | `.env` + Cloud Run | `Roamble <noreply@send.roamble.app>` |

---

## トラブルシューティング

### `go run webpush` でエラーが出る

```
# Go がインストールされていない場合
brew install go

# またはモジュールキャッシュの問題の場合
go clean -modcache
go run github.com/SherClockHolmes/webpush-go/cmd/webpush@latest
```

### Resend の DNS 認証がなかなか通らない

- Cloudflare の「プロキシステータス」が **DNS only（オレンジ雲 OFF）** になっているか確認。プロキシが有効だと TXT レコードが正しく解決されない場合がある
- `dig` コマンドで実際に DNS が伝播しているか確認する
- 最大 24 時間待ってから再確認する

### Resend から送信したメールがスパムに入る

DMARC ポリシーが `p=none` の間はスパム判定されやすい。ドメイン認証が安定したら以下の順で強化する:

1. `p=none` → 2週間モニタリング
2. `p=quarantine` → さらに2週間
3. `p=reject` → 本格運用

Cloudflare の DMARC レコードを編集して `p=quarantine` などに変更する。

### Cloud Run でコールドスタートが発生する

最小インスタンス 1 に設定しても、デプロイ直後や設定変更後のリビジョン切り替え時は一時的にコールドスタートが発生することがある。通常の運用では最小 1 インスタンスが常駐するため問題ない。
