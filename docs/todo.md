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

---

## 仕様レビュー指摘事項（2026-03-07）

> ベータ版公開後の仕様レビューで発見された、コンセプトと仕様の不一致・一貫性の問題を修正するタスク。
> TDD（RED→GREEN→REFACTOR）で進行。各タスクの実装完了後、関連ドキュメント（requirements.md等）も更新すること。

### タスク一覧

- [x] **設定変更時のリロード消費 + キャッシュクリア**（Issue #264）
  - **問題**: 興味タグ・提案半径を変更しても提案キャッシュがクリアされず、古い提案が表示され続ける（requirements.md:214の「即時反映」仕様に違反）。一方、無条件にキャッシュクリアするとリロード制限を迂回できてしまう
  - **方針**: 設定変更時にリロード1回分を消費してキャッシュクリア。リロード残0の場合は設定保存のみ行い、提案は翌日リセット時に反映
  - **フロントエンド**: 設定保存時に確認モーダル表示。リロード残ありなら「提案が更新されます（リロード1回分を消費します）」、残0なら「設定は保存されました。提案は明日リセット時に反映されます」
  - **バックエンド**: `PUT /api/users/me/interests` および `PATCH /api/users/me`（半径変更時）でキャッシュクリア + リロードカウントインクリメントを行う新規パラメータ or エンドポイント設計が必要
  - **対象ファイル**: `backend/handlers/user.go`, `backend/database/redis.go`, `frontend/app/routes/settings.tsx`, `frontend/app/hooks/use-suggestions.ts`
  - **ドキュメント更新**: `docs/requirements.md`（設定変更の即時反映セクション）

- [x] **ジャンル熟練度上限をLv.30に統一 + ボーナスXP反映**（Issue #265）
  - **問題**: ユーザーレベル（最大Lv.30）とジャンル熟練度（最大Lv.20）で上限が異なり、一貫性がない。また、初エリアボーナス（+30XP）・メモボーナス（+10XP）・ストリークボーナスがユーザーXPには加算されるがジャンル熟練度には反映されない
  - **方針**: ジャンル熟練度の上限をLv.30に変更。ボーナスXP（初エリア・メモ・ストリーク）もジャンル熟練度に加算し、ユーザーXPと一致させる
  - **対象ファイル**: `backend/services/gamification.go`（`calcGenreLevel` のキャップ変更、`UpdateGenreProficiency` のXP加算ロジック変更）、`backend/handlers/visit.go`
  - **ドキュメント更新**: `docs/requirements.md`（ジャンル熟練度セクション、XP付与ルールセクション）、`CLAUDE.md`

- [x] **複数端末同時利用未サポートの注記追加**（Issue #266）
  - **問題**: JWT方式で複数端末同時ログインが可能だが、フロントエンドキャッシュの整合性が保証されない（端末Aで訪問記録→端末Bに反映されない等）
  - **方針**: ドキュメントに注記を追加するのみ。根本対応はiOS版（Phase 2）で検討
  - **ドキュメント更新**: `docs/requirements.md`（非機能要件 or 既知の制約セクション）

- [x] **バックエンド距離検証追加（訪問記録API）**（Issue #267）
  - **問題**: 訪問ボタンの200m距離制限がフロントエンドのみで実装されており、APIを直接叩けば距離制限を迂回してXPを不正取得できる
  - **方針**: `POST /api/visits` のリクエストボディに `user_lat`, `user_lng` を追加。バックエンドでHaversine距離計算を行い、200m超なら400 Bad Requestを返す。`ENVIRONMENT=development` では検証スキップ
  - **対象ファイル**: `backend/handlers/visit.go`（リクエスト構造体追加、距離計算ロジック）、`frontend/app/hooks/use-suggestions.ts`（訪問記録送信時に現在地座標を含める）
  - **ドキュメント更新**: `docs/requirements.md`（訪問ボタンの有効条件セクション）

- [ ] **位置情報未許可時のUX改善**（Issue #268）
  - **問題**: 位置情報が未許可の場合、デフォルト位置（渋谷駅周辺）で提案が生成されるが、ユーザーに十分な説明がない
  - **方針**: 位置情報が拒否された場合にモーダルを表示。選択肢: (1)「設定で許可する」→設定画面へ (2)「渋谷駅周辺で試す」→デフォルト位置で提案生成。(2)を選んだ場合、カード上部に「デフォルト位置（渋谷駅周辺）で表示中」バナーを常時表示
  - **対象ファイル**: `frontend/app/hooks/use-suggestions.ts`, `frontend/app/routes/home.tsx`（モーダル・バナーUI追加）
  - **ドキュメント更新**: `docs/requirements.md`（位置情報取得セクション）

- [x] **`is_comfort_zone` カラムを `is_breakout` に改名**（Issue #269）
  - **問題**: `visit_history.is_comfort_zone` カラムの名前が実態（コンフォートゾーンの「外」= 脱却訪問かどうか）と逆の意味に読める
  - **方針**: `is_breakout` に改名。ベータ版公開済みのためDBマイグレーション（`ALTER TABLE`）で対応。GORM モデル・ハンドラ・フロントエンドのフィールド名も全て変更
  - **実装順序**: 他のタスク（#265, #264, #267）が `IsComfortZone` を参照しているため、このタスクを最初に実施すること
  - **対象ファイル**: `backend/models/visit.go`, `backend/handlers/visit.go`, `backend/handlers/suggestion.go`, `backend/services/gamification.go`, `frontend/app/types/`, マイグレーションSQL
  - **ドキュメント更新**: `docs/requirements.md`（データモデルセクション）、`CLAUDE.md`

### 実装引き継ぎコンテキスト

> 以下は仕様レビュー会話で決定した内容のうち、タスク詳細に含まれない判断・背景情報。

#### 実装順序（依存関係順）

1. **#269** `is_comfort_zone` → `is_breakout`（基盤変更。他タスクが参照するフィールド名が変わる）
2. **#265** ジャンル熟練度Lv.30統一（XPロジック変更）
3. **#264** 設定変更キャッシュクリア（バックエンド+フロントエンド）
4. **#267** バックエンド距離検証（バックエンド+フロントエンド）
5. **#268** 位置情報未許可UX（フロントエンドのみ）
6. **#266** 複数端末注記（ドキュメントのみ）

#### #269 影響範囲（コード上の変更箇所）

**リネーム対応表:**
| 変更前 | 変更後 |
|--------|--------|
| `IsComfortZone` (Go struct field) | `IsBreakout` |
| `is_comfort_zone` (JSON/DB column) | `is_breakout` |
| `isComfortZone` (TS/Go variable) | `isBreakout` |
| `isComfortZoneVisit()` (Go func) | `isBreakoutVisit()` |
| `comfort_zone_visits` (JSON key) | `breakout_visits` |
| `ComfortZoneVisits` (Go struct field) | `BreakoutVisits` |
| `comfortZoneCount` (TS variable) | `breakoutCount` |
| `comfortZoneLevelThreshold` (Go const) | `breakoutLevelThreshold` |
| `comfort_zone_break` (badge condition type) | `breakout` |
| `comfort_zone_count` (GA event param) | `breakout_count` |

**バックエンド対象ファイル（30箇所以上）:**
- `backend/models/user.go:39` — GORMモデル定義
- `backend/handlers/visit.go:32,42,76,141,155` — 訪問記録ハンドラ
- `backend/handlers/suggestion.go:34,296-300,665-666,726,749-750` — 提案ハンドラ + `isComfortZoneVisit()` 関数
- `backend/services/gamification.go:93-98,246-250,279,306,376-378,460,471,475` — XP計算・バッジ判定
- `backend/handlers/user.go:62,95,97` — ユーザー統計（`comfort_zone_visits`）
- `backend/database/seed.go:81` — バッジシードデータ（`comfort_zone_break` → `breakout`）
- `backend/handlers/visit_test.go` — 訪問テスト（約20箇所）
- `backend/services/gamification_test.go` — ゲーミフィケーションテスト（約15箇所）
- `backend/handlers/user_stats_test.go:39-133` — 統計テスト
- `backend/handlers/suggestion_test.go` — 提案テスト
- `backend/docs/docs.go`, `swagger.yaml`, `swagger.json` — API仕様

**フロントエンド対象ファイル（40箇所以上）:**
- `frontend/app/types/suggestion.ts:13` — `is_comfort_zone?: boolean`
- `frontend/app/types/visit.ts:13,37,64` — 訪問型定義
- `frontend/app/types/auth.ts:17` — `comfort_zone_visits: number`
- `frontend/app/hooks/use-suggestions.ts:237,279,290,334` — 提案フック
- `frontend/app/routes/home.tsx:62` — ホーム画面
- `frontend/app/routes/history-detail.tsx:196` — 履歴詳細
- `frontend/app/components/discovery-card.tsx:153` — 提案カード
- `frontend/app/components/visit-map.tsx:106,128,131,154,196` — 訪問マップ
- `frontend/app/lib/gtag.ts:52,62,69,78,84,97,106` — GA イベント
- 各テストファイル

**DBマイグレーション:**
```sql
ALTER TABLE visit_history CHANGE COLUMN is_comfort_zone is_breakout TINYINT(1) NOT NULL DEFAULT 0;
```
※ GORMの `AutoMigrate` ではカラム改名ができないため、手動マイグレーションが必要。`backend/database/migration.go` に追加するか、起動時に `db.Exec()` で実行。

#### #264 設計詳細

**フロー:**
1. ユーザーが設定画面で興味タグ or 半径を変更し「保存」をタップ
2. フロントエンドが現在のリロード残回数を確認
3. リロード残 > 0 → 確認モーダル「提案が更新されます（リロード1回分を消費します）」→ OK で API 呼び出し
4. リロード残 = 0 → 設定保存後にトースト「設定は保存されました。提案は明日リセット時に反映されます」
5. バックエンド: 設定更新 API にクエリパラメータ `refresh_suggestions=true` を追加。true の場合にキャッシュクリア + リロードカウントインクリメント

**バックエンド変更案:**
- `PUT /api/users/me/interests?refresh_suggestions=true` — 既存エンドポイントにクエリパラメータ追加
- `PATCH /api/users/me?refresh_suggestions=true` — 同上
- `refresh_suggestions=true` の場合: `ClearDailySuggestionsCache()` + `IncrementDailyReloadCount()` を呼び出し
- レスポンスに `reload_count_remaining` を含める

#### #265 設計詳細

**変更点:**
- `backend/services/gamification.go` の `calcGenreLevel()`: `if level > 20` → `if level > 30` に変更（実質キャップ削除。テーブルが30エントリなので自然にLv.30が上限）
- `UpdateGenreProficiency()`: 現在は `xpEarned`（base XP のみ）を加算しているが、ボーナスXP（`firstAreaBonus + memoBonus + streakBonus`）も含めた合計値を加算するように変更
- `backend/handlers/visit.go` または `backend/services/gamification.go` の `RecordVisitWithXP()` 内で、ジャンル熟練度に渡すXP値をボーナス込みに変更

#### #267 設計詳細

**バックエンド:**
- `CreateVisitRequest` 構造体に `UserLat float64` / `UserLng float64` を追加
- Haversine距離計算関数を `backend/services/` または `backend/handlers/visit.go` に追加（フロントエンドの `calcDistance` と同じロジック）
- 距離 > 200m かつ `ENVIRONMENT != "development"` → `400 Bad Request` + `{"error": "too far from place", "code": "TOO_FAR_FROM_PLACE"}`

**フロントエンド:**
- `frontend/app/hooks/use-suggestions.ts` の訪問記録送信部分で、`user_lat` / `user_lng` をリクエストボディに含める

#### 仕様レビューで「変更しない」と決めた事項

- **1日3件の提案枚数**: 維持。選択肢を絞ることでUX向上。将来的にプレミアムプランで制限解放を検討
- **興味内2枠+ランダム1枠の配分**: 意図的。緩やかな脱却を狙う設計
- **ストリーク週次の敷居**: 適切と判断。ベータFBで再検討
- **Web版廃止方針**: 維持。iOS版リリース後に廃止

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
