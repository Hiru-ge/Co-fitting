# ドメイン取得・メールアドレス設定手順

Cloudflare Registrar でドメインを取得し、Cloudflare Email Routing でメールアドレスを設定する手順。

## 前提

- Cloudflareアカウントが必要（無料）
- 転送先として使う個人Gmailアカウントを用意しておく

---

## Step 1: Cloudflareアカウント作成

1. https://dash.cloudflare.com/sign-up にアクセス
2. メールアドレス・パスワードを入力して登録
3. メール認証を完了する

---

## Step 2: ドメイン取得（Cloudflare Registrar）

1. Cloudflareダッシュボード左サイドバーの **「Domain Registration」→「Register Domains」** をクリック
2. 取得したいドメイン名を検索（例: `roamble.app`）
3. 価格を確認して選択
   - `.app`: 約$14/年
   - `.io`: 約$32/年
   - `.com`: 約$10/年
4. **「Purchase」** をクリック
5. 支払い情報（クレジットカード）を入力して完了
6. 自動更新はデフォルトでONになっているので確認する

取得後、数分でCloudflareのDNSに追加される。
→ `roamble.app`を購入完了！
---

## Step 3: メール転送設定（Cloudflare Email Routing）

取得したドメイン宛のメールを、個人Gmailなどに転送する設定。`official@roamble.app` のようなアドレスが使えるようになる。

### 3-1. Email Routingを有効化

1. ダッシュボードで取得したドメインを選択
2. 左サイドバーの **「Email」→「Email Routing」** をクリック
3. **「Get started」** をクリック
4. カスタムアドレスに`official@roamble.app`を入力し、転送先のGmailアドレスも入力（例: 個人のGmail）
   これで `official@roamble.app` 宛のメールが個人Gmailに届くようになる。

---

## Step 4: 動作確認

1. 別のメールアドレスから `official@roamble.app` にテストメールを送信
2. 転送先のGmailに届いていることを確認

---

## Step 5: Gmailから送信する設定（任意）

転送先Gmailから `official@roamble.app` として返信・送信できるようにする設定。

1. Gmailを開き、右上の歯車アイコン →**「すべての設定を表示」**
2. **「アカウントとインポート」** タブを開く
3. **「他のメールアドレスを追加」** をクリック
4. 以下を入力：
   - 名前: `Roamble`
   - メールアドレス: `official@roamble.app`
5. SMTPサーバーの設定を入力（Gmailのsmtp.gmail.comを使う場合）：
   - SMTPサーバー: `smtp.gmail.com`
   - ポート: `587`
   - ユーザー名: 個人GmailのID
   - パスワード: Gmailの **アプリパスワード**（2段階認証が必要）
6. 確認コードがメールで届くので入力して完了

設定後、Gmail作成画面の「From」欄で `official@roamble.app` を選択して送信できる。
→ ブラウザ版Gmailで`official@roamble.app`から送信できることを確認！

---

## 完了後にやること

### GCP設定（`docs/google-oauth-setup.md` も参照）
- [x] OAuth 同意画面 → 承認済みドメインに `https://roamble.app` を追加
- [x] OAuth 同意画面 → ステータスを「本番環境に公開」に変更（テストユーザー制限の解除）
- [~] 本番環境公開での検証
- [x] OAuthクライアントID → 承認済みJavaScript生成元に `https://roamble.app` を追加（コンソールで要確認）
- [x] フロントエンド用APIキー → HTTPリファラー制限に `https://roamble.app/*` を追加
- [ ] ドメイン所有権確認（本番公開時にGoogleから求められる場合あり）← Google Search Console + CloudflareのDNS TXTレコードで対応

### その他
- [ ] App Store申請のサポートURL・プライバシーポリシーURLにドメインを使う
- [ ] LPのデプロイ先としてドメインを設定する（`docs/deploy-setup.md` 参照）
