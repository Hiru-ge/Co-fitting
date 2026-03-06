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
