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
- [ ] **スコープ確認**: `email`, `profile`, `openid` のみになっているか（不要なスコープが入っていないか）

### OAuth クライアントID（GCP → APIs & Services → Credentials）

- [x] 承認済みの JavaScript 生成元: `https://roamble.app` が追加されている
- [x] 承認済みの JavaScript 生成元: `https://roamble.pages.dev` が追加されている
- [ ] **承認済みの JavaScript 生成元の一覧を再確認**（古い / 不要なドメインが残っていないか）

### Google Maps / Places API キー

- [x] フロントエンド用キーの HTTPリファラー制限: `https://roamble.app/*` が含まれている
- [x] フロントエンド用キーの HTTPリファラー制限: `https://roamble.pages.dev/*` が含まれている
- [ ] **フロントエンド用キーの API 制限**: Maps JavaScript API のみになっているか確認
- [ ] **バックエンド用キーの API 制限**: Places API / Places Aggregate API / Places API (New) のみになっているか確認
- [ ] **バックエンド用キーのアプリケーション制限**: Cloud Run は動的IPのため「なし」またはAPIのみ制限が妥当。現状を確認
- [ ] **有効化済みAPI一覧の確認**（GCP → APIs & Services → Library）:
  - [ ] Maps JavaScript API
  - [ ] Places API
  - [ ] Places Aggregate API
  - [ ] Places API (New)

### Cloud Run 環境変数（GCP → Cloud Run → roamble-backend → Edit & Deploy New Revision）

- [ ] **`ALLOWED_ORIGIN` に `https://roamble.app` が含まれているか確認**（現在 `https://roamble.pages.dev` のみの可能性あり。カスタムドメイン追加後は両方 or `roamble.app` のみに更新が必要）
- [ ] `GIN_MODE=release` になっているか
- [ ] `ENVIRONMENT=production` になっているか
- [ ] `MYSQL_TLS=true` になっているか
- [ ] `REDIS_TLS=true` になっているか
- [ ] `JWT_SECRET` が本番用の強固なランダム文字列になっているか（`openssl rand -base64 32` で生成したもの）
- [ ] `GOOGLE_OAUTH_CLIENT_ID` が正しいクライアントIDになっているか

### Cloudflare Pages 環境変数（Cloudflare → Pages → roamble → Settings → Environment variables）

- [ ] `VITE_API_BASE_URL` が正しい Cloud Run の Service URL になっているか
- [ ] `VITE_GOOGLE_CLIENT_ID` が正しいクライアントIDになっているか（バックエンドと同じ値）
- [ ] `VITE_GOOGLE_MAPS_API_KEY` がフロントエンド用キーになっているか（バックエンド用と別のキー）
- [ ] `VITE_BETA_PASSPHRASE` が設定されているか

### Cloudflare Pages カスタムドメイン

- [ ] `roamble.app` が Cloudflare Pages のカスタムドメインとして設定されているか確認
- [ ] DNS が正しく向いているか（`roamble.pages.dev` へのCNAMEまたはALIAS）
- [ ] HTTPS が有効になっているか

### GCP 請求・モニタリング

- [ ] **GCP 請求アラート**を設定する（月 $10〜$50 程度の上限で通知）
- [ ] Places API の使用状況をモニタリングできているか確認（GCP → APIs & Services → Dashboard）

### Google Search Console

- [x] `roamble.app` のドメイン所有権確認が完了している（CloudflareのDNS TXTレコードで対応済み）

---

## セキュリティ確認（ベータ版公開前）

> 外部ユーザーを招待する前に、OWASP Top 10 を軸に主要な脆弱性がないことを確認する。

### 認証・認可

- [ ] JWT の有効期限（アクセストークン・リフレッシュトークン）が適切に設定されているか
- [ ] リフレッシュトークンの使い回し（Refresh Token Rotation）が実装されているか、または意図的にしていない場合のリスクを把握しているか
- [ ] 認証が必要なエンドポイントに未認証でアクセスした場合、401 が返ることを確認
- [ ] 他ユーザーの訪問記録・プロフィールに PATCH/DELETE できないか確認（IDOR: 水平権限昇格）

### 入力バリデーション・インジェクション

- [ ] バックエンドの全エンドポイントで入力値のバリデーションが行われているか（空文字・極端に長い文字列・特殊文字）
- [ ] GORM を使っているため SQL インジェクションのリスクは低いが、生クエリ（`db.Raw`）を使っている箇所がないか確認
- [ ] `place_id` や `genre_tag_id` など外部入力をそのまま DB に渡している箇所でのバリデーション確認

### CORS・HTTP ヘッダー

- [ ] `ALLOWED_ORIGIN` が本番ドメインのみに絞られているか（`*` になっていないか）
- [ ] Gin の本番モード（`GIN_MODE=release`）で不要なデバッグ情報がレスポンスに含まれていないか
- [ ] `/api/dev/auth/test-login` エンドポイントが `ENVIRONMENT=production` 時に無効化されているか確認（開発用エンドポイントの本番露出）

### 機密情報の管理

- [ ] `.gitignore` に `.env` が含まれており、シークレットが Git 履歴に含まれていないか確認（`git log --all -S "GOOGLE_" --oneline` 等で検索）
- [ ] JWT_SECRET が十分に長くランダムなものになっているか（`openssl rand -base64 32` 以上）
- [ ] Cloudflare Pages の環境変数にバックエンド用 Places API キー（`GOOGLE_PLACES_API_KEY`）が誤って設定されていないか

### レート制限・DoS 対策

- [ ] `/api/suggestions` への連続リクエストによる Places API コスト爆発を防ぐリロード回数制限が機能しているか確認
- [ ] `/api/auth/oauth/google` に対するブルートフォース対策（レート制限）があるか確認

### フロントエンド

- [ ] `localStorage` に保存しているトークンに対して XSS リスクがある場合、Content-Security-Policy ヘッダーが設定されているか（Cloudflare Pages のヘッダー設定で対応可能）
- [ ] Google Maps API キーのリファラー制限が正しく設定されており、外部から悪用できない状態か

---

## 本番動作確認（ベータ版公開前）

- [x] `https://roamble.pages.dev` にアクセスできる
- [x] 合言葉入力画面が表示される
- [x] Google ログインができる
- [x] 場所提案が生成される（Places API 経由）
- [x] 訪問記録ができ、XP・バッジが付与される
- [x] モバイルでの表示・操作感を確認済み
- [ ] **`https://roamble.app` でも同様にアクセス・操作できるか確認**（カスタムドメイン経由の最終動作確認）
- [ ] **スリープ/コールドスタート時間の確認**（Cloud Run は初回リクエストで 200-500ms 程度の遅延を許容範囲か確認）
- [ ] **Google OAuth が `roamble.app` ドメインで正常に動作するか確認**（JavaScript生成元の設定が効いているか）

---

## 3/7（土）: ベータ版公開

- [ ] **説明動画の撮り直し**（あなたの作業）
  - Roambleの使い方・コンセプトを短くまとめた動画を撮影
  - SNS（X, TikTok等）でベータ版参加を再告知
- [ ] **ベータ版公開記事の執筆**
  - 公開の背景・目的、ベータ版で試してほしいこと、今後の展望などをまとめた記事を執筆（/blog-writer スキルを使う）
  - noteで公開
- [ ] **ベータ版公開**
  - SNSで公開アナウンス。合言葉をDMまたはフォーム回答者に通知
  - LPにベータ版URL（`https://roamble.app`）を追記
- [ ] **ベータ版フォーム締め切り**（公開1週間後 = 3/14頃）

---

## 3/8〜: Optional（ひと段落後）

- [ ] Product Hunt "Upcoming" ページの活用

---

## Phase 2 計画（MVPベータFB次第）

> ベータ版テストのFBを見てから優先順位を決定する。

> **実装済み**: Google Mapsナビゲーション連携（Issue #200）・営業時間フィルタリング（Issue #201）は Phase 1 後半でβ版として先行実装済み。

---

## マーケティング（継続）

> ブランド構築・SNSアカウント・初期コンテンツはすべて完了済み。

- [~] **開発ログの継続投稿**: X / Instagram / TikTok で開発内容や気づきを共有する
- [ ] **Product Hunt / 開発系コミュニティへの「予告」**（Optional）
  - [ ] "Upcoming" ページ等の活用検討
