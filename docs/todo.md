# TODO — GitHub Issue 化ガイド

> 以下の各セクションをGitHub Issueとして作成してください。
> ラベル: `Phase1`, `backend`, `frontend` を適宜付与

---

## マーケティング戦略の実行 — Phase 0 → Phase 1

> **目的**: アプリが完成する前からファンを作るための「準備」と「始動」の計画
> **フェーズ**: Phase 0 → Phase 1 開発開始直後

### 1. ブランド・アイデンティティ (Brand Identity)
SNSアカウントを作る前に、アプリの「顔」と「声」を定義する。

- [x] **アプリアイコンの確定**
  - [x] コンセプト決定（例: 「コンパス」「ドア」「靴」「ドット絵風」など、RPG感や冒険を感じさせるもの）
  - [x] ラフ作成 or 既存 `docs/screen-design/icon.png` のブラッシュアップ
  - [x] SNS用リサイズ（正方形 / 丸形トリミングを確認）
- [x] **ブランドカラー・トーンの定義**
  - [x] メインカラー（アクセントカラー）の決定
    アイコンなどで用いるブランドカラーは#525BBBにする。アプリの背景色はコントラストを維持するため#102222で維持
    アプリ内ではあくまでアクセントカラーとして使用し、全体のトーンは落ち着いた暗めの色味で統一する。
- [x] **SNS用ヘッダー画像作成**
  - [x] X (Twitter) 用: 1500x500px
  - [x] YouTube 用: 2560x1440px (TV表示対応エリア注意)

### 2. SNSアカウント・環境セットアップ (Account Setup)
「開発者」ではなく「チャレンジャー」としての舞台を整える。

- [x] **専用Googleアカウント取得** (Gmail)
  - [x] `roamble.official@gmail.com`を取得
- [x] **アカウント開設 & ID統一** (例: `@roamble_app`)
  - [x] **TikTok** (@roamble: https://www.tiktok.com/@roamble)
  - [x] **Instagram** (@Roamble_official: https://www.instagram.com/roamble_official/)
  - [x] **YouTube** (@Roamble: https://www.youtube.com/@Roamble)
  - [x] **X** (@roamble_app: https://x.com/roamble_app)
- [x] **プロフィール文 (Bio) の設定**
  - [x] **共通**: 「コンフォートゾーンを抜け出して新しい場所に辿り着くためのアプリ、「Roamble」の公式アカウント ベータテスター募集中！ 応募はプロフのリンクから👇」
  - [x] **ストーリー**: 「コミュ障エンジニアが、自作アプリの命令で知らない店に入る記録」というナラティブを入れる
  - [x] **リンク**: LP (Notion) へのリンク設置

### 3. コンテンツ素材の準備 (Content Prep): Phase 1完成時点までに準部
動画編集のテンプレートを作り、量産体制を整える。

- [ ] **「Day 1」動画の構成案作成**
  - [ ] スクリプト作成（「今日からこのアプリで人生変えます」宣言）
  - [ ] 絵コンテ（自撮り、PC画面、外の風景のカット割り）
- [ ] **撮影機材・環境の確認**
  - [ ] スマホでの撮影テスト（POV視点、マイク音質チェック）
  - [ ] 画面収録ソフトの準備（PC画面の操作ログ用）
- [ ] **動画テンプレート作成**
  - [ ] 共通のオープニング/エンディング（短く）
  - [ ] テロップのスタイル（ブランドカラーに合わせる）
  - [ ] BGM/SE選定（RPG風のレベルアップ音などを探しておく）

### 4. Phase 1 開発連動アクション (Dev & Marketing Sync)
開発作業そのものをコンテンツにするためのタスク。

- [ ] **「ゲーミフィケーション実装」の予告**
  - [ ] データベース設計図（ER図）をあえて印刷して写真に撮る（「ここが冒険の地図になる」的演出）
  - [ ] レベルテーブルの.md画面をスクショする（「レベル99までの道のりを作った」）
- [ ] **Before状態の記録**
  - [ ] 現在の「味気ない記録画面」を動画に撮っておく（後のAfter動画で劇的変化を見せるため）

### 5. 初動アクション (Launch Actions): Phase 1完成後すぐに実行
準備ができ次第、順次実行。

- [x] **LP (Notion) の微修正**
  - [x] 新しいアイコンに差し替え
  - [x] SNSリンクを追加
- [ ] **動画 #1「Day 1: 宣言」の投稿**
  - [ ] TikTok, Shorts, Reels に同時投稿
  - [ ] X で動画のリンクと共に「人生変える実験始めます」とポスト
- [ ] **Product Hunt / 開発系コミュニティへの「予告」** (Optional)
  - [ ] "Upcoming" ページ等の活用検討

---

## 🔄 Google OAuth認証のみへの移行 — Phase 1（仕様変更）

> **目的**: メール+パスワード認証を廃止し、Google OAuth認証のみに統一する。アバター画像はGoogleプロフィール画像を使用し、S3関連のインフラ・コードを不要にする。
> **理由**: 認証・アバター管理の実装コスト削減、S3コスト削減、ユーザー体験のシンプル化

### Issue: メール+パスワード認証の削除（バックエンド）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/138
**優先度**: 🔴 High | **工数**: 4h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
メール+パスワード認証関連のハンドラー・ルート・テストを削除する。

**実装内容**
- [x] `handlers/auth.go`: `SignUp()`, `Login()`, `ChangePassword()` メソッド削除
- [x] `handlers/auth.go`: `signUpRequest`, `loginRequest`, `changePasswordRequest` 型削除
- [x] `handlers/user.go`: `UpdateEmail()` メソッド削除
- [x] `routes/routes.go`: `/signup`, `/login`, `/change-password`, `/users/me/email` ルート削除
- [x] `handlers/auth_test.go`: SignUp/Login/ChangePassword テスト削除
- [x] `handlers/user_test.go`: UpdateEmail テスト削除

### Issue: DBマイグレーション — password_hash カラム削除
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/139
**優先度**: 🔴 High | **工数**: 1h | **担当**: 個人 | **Phase**: Phase 1

**実装内容**
- [x] `models/user.go`: `PasswordHash` フィールド削除
- [x] `database/migrate.go`: `password_hash` カラムドロップのマイグレーション追加

### Issue: ログイン・サインアップ画面統合（フロントエンド）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/140
**優先度**: 🔴 High | **工数**: 4h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
メール+パスワードフォームを削除し、Google OAuthボタンのみの認証画面に統合する。

**実装内容**
- [x] `routes/login.tsx`: メール+パスワードフォーム削除、`clientAction()` 削除、Google OAuthボタンのみに
- [x] `routes/signup.tsx`: 画面削除（signup不要のため）
- [x] `routes/index.tsx`: LP内のsignup/loginリンクを統一
- [x] `__tests__/routes/login.test.ts`: メール+パスワード関連テスト削除
- [x] `__tests__/routes/signup.test.ts`: 登録フォーム関連テスト削除

### Issue: 設定画面からメール変更・パスワード変更を削除（フロントエンド）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/141
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **Phase**: Phase 1

**実装内容**
- [x] `routes/settings.tsx`: メールアドレス変更セクション削除
- [x] `routes/settings.tsx`: パスワード変更セクション削除
- [x] `__tests__/routes/settings.test.tsx`: 関連テスト削除

### Issue: APIクライアント・型定義の整理（フロントエンド）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/142
**優先度**: 🟡 Medium | **工数**: 1h | **担当**: 個人 | **Phase**: Phase 1

**実装内容**
- [x] `api/users.ts`: `changePassword()`, `updateEmail()` 関数削除
- [x] `types/auth.ts`: `LoginRequest`, `SignupRequest` 型削除（既に不在のため対応不要）
- [x] `__tests__/api/users.test.ts`: 関連テスト削除

---

## 🗄️ インフラ・データベース — Phase 1

### Issue: データベース拡張・マイグレーション
**優先度**: 🔴 High | **工数**: 6h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
Phase 1で必要なテーブル追加・既存テーブル拡張を行う。

**実装内容**

**A. 新規テーブル作成**
- [x] `genre_tags` テーブル（施設ジャンルマスタ）
- [x] `user_interests` テーブル（ユーザー興味タグ）
- [x] `genre_proficiency` テーブル（ジャンル別熟練度）
- [x] `badges` テーブル（バッジマスタ）
- [x] `user_badges` テーブル（ユーザー獲得バッジ）

**B. 既存テーブル拡張**
- [x] `users` テーブル：display_name, avatar_url, level, total_xp, streak_count, streak_last, settings_json
- [x] `visit_history` テーブル：genre_tag_id, rating, memo, xp_earned, is_comfort_zone

**C. インデックス・制約追加**
- [x] パフォーマンス最適化インデックス
- [x] 外部キー制約
- [x] ユニーク制約

**D. マスタデータ投入**
- [x] 初期ジャンルタグデータ
- [x] 初期バッジデータ

### ~~Issue: S3アバター画像保存設定~~ ❌ 廃止
> **廃止理由**: Google OAuth認証のみに移行するため、Googleプロフィール画像を使用。S3でのアバター管理は不要。

---

## 🔧 バックエンド（Go + Gin）— Phase 1

> **バックエンド設計方針**: 
> - **t-wadaの TDD フロー**で開発（RED → GREEN → REFACTOR）
> - エンドポイント単位でIssue分割、テスト駆動開発を徹底

### Issue: Google OAuth認証エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/88
**優先度**: 🔴 High | **工数**: 8h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `POST /api/auth/oauth/google`

**タスク概要**
Google OAuth 2.0認証エンドポイントを実装し、トークン検証・ユーザー登録・JWT発行を行う。

**TDD実装フロー**
- [x] **RED**: OAuth認証のテストケース作成
  - トークン検証成功パターンのテスト
  - 無効トークンのエラーハンドリングテスト
  - 新規ユーザー登録パターンのテスト
  - 既存ユーザー更新パターンのテスト
- [x] **GREEN**: 最小実装
  - Google OAuth Client設定・環境変数読み込み
  - OAuth トークン検証処理
  - ユーザー情報取得・DB登録/更新
  - JWT トークン発行・レスポンス返却
- [x] **REFACTOR**: リファクタリング
  - コードの重複排除・関数分割
  - エラーハンドリング統一
  - ログ出力・モニタリング追加

### Issue: ユーザー統計情報取得エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/89
**優先度**: 🔴 High | **工数**: 6h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `GET /api/users/me/stats`

**タスク概要**
ユーザーのレベル・XP・ストリーク・統計情報を取得するエンドポイント。

**TDD実装フロー**
- [x] **RED**: 統計情報取得のテストケース作成
  - 認証済みユーザーの統計情報取得テスト
  - 未認証ユーザーのエラーテスト
  - 空データユーザーの初期値テスト
- [x] **GREEN**: 最小実装
  - JWT認証・ユーザー特定処理
  - レベル・XP・ストリーク計算
  - 統計データ集計・レスポンス組み立て
- [x] **REFACTOR**: リファクタリング
  - 統計計算ロジックの分離
  - キャッシュ機能の追加検討
  - パフォーマンス最適化

### Issue: 獲得バッジ一覧取得エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/90
**優先度**: 🔴 High | **工数**: 4h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `GET /api/users/me/badges`

**TDD実装フロー**
- [x] **RED**: バッジ取得のテストケース作成
  - 獲得バッジ一覧取得テスト
  - バッジ未獲得ユーザーのテスト
- [x] **GREEN**: 最小実装
  - user_badges JOIN badges での取得
  - 獲得日時順ソート・レスポンス組み立て
- [x] **REFACTOR**: リファクタリング
  - N+1問題対策・クエリ最適化

### Issue: 全バッジ一覧取得エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/91
**優先度**: 🟡 Medium | **工数**: 3h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `GET /api/badges`

**TDD実装フロー**
- [x] **RED**: 全バッジ取得のテストケース作成
- [x] **GREEN**: badges テーブル全件取得・レスポンス
- [x] **REFACTOR**: キャッシュ・最適化

### Issue: ジャンル別熟練度取得エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/92
**優先度**: 🟡 Medium | **工数**: 5h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `GET /api/users/me/proficiency`

**TDD実装フロー**
- [x] **RED**: 熟練度取得のテストケース作成
- [x] **GREEN**: genre_proficiency JOIN genre_tags での取得
- [x] **REFACTOR**: レーダーチャート用データ構造最適化

### Issue: 全ジャンルタグ一覧取得エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/93
**優先度**: 🔴 High | **工数**: 3h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `GET /api/genres`

**TDD実装フロー**
- [x] **RED**: ジャンルタグ取得のテストケース作成
- [x] **GREEN**: genre_tags テーブル全件取得
- [x] **REFACTOR**: キャッシュ・カテゴリ別ソート

### Issue: ユーザー興味タグ取得エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/94
**優先度**: 🟡 Medium | **工数**: 4h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `GET /api/users/me/interests`

**TDD実装フロー**
- [x] **RED**: 興味タグ取得のテストケース作成
- [x] **GREEN**: user_interests JOIN genre_tags での取得
- [x] **REFACTOR**: キャッシュ・パフォーマンス最適化

### Issue: ユーザー興味タグ更新エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/95
**優先度**: 🟡 Medium | **工数**: 6h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `PUT /api/users/me/interests`

**TDD実装フロー**
- [x] **RED**: 興味タグ更新のテストケース作成
  - 新規設定パターンのテスト
  - 既存更新パターンのテスト
  - バリデーションエラーテスト（3つ未満等）
- [x] **GREEN**: 最小実装
  - 既存興味タグの削除
  - 新しい興味タグの一括登録
  - トランザクション処理
- [x] **REFACTOR**: バッチ処理最適化

### Issue: 訪問記録詳細取得エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/96
**優先度**: 🟡 Medium | **工数**: 4h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `GET /api/visits/:id`

**TDD実装フロー**
- [x] **RED**: 訪問詳細取得のテストケース作成
- [x] **GREEN**: visit_history詳細情報取得・権限チェック
- [x] **REFACTOR**: レスポンス構造最適化

### Issue: 訪問記録更新エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/97
**優先度**: 🟡 Medium | **工数**: 6h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `PATCH /api/visits/:id`

**TDD実装フロー**
- [x] **RED**: 訪問記録更新のテストケース作成
  - 感想メモ更新テスト
  - 評価更新テスト
  - 権限チェックテスト
- [x] **GREEN**: 最小実装
  - 訪問記録の部分更新処理
  - バリデーション・権限チェック
- [x] **REFACTOR**: 更新可能フィールド管理

### Issue: マップ表示用データ取得エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/98
**優先度**: 🟡 Medium | **工数**: 5h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `GET /api/visits/map`

**TDD実装フロー**
- [x] **RED**: マップデータ取得のテストケース作成
- [x] **GREEN**: 位置情報・ジャンル情報の最適化取得
- [x] **REFACTOR**: 大量データ処理・ページング対応

### Issue: ユーザー情報更新エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/99
**優先度**: 🟡 Medium | **工数**: 3h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `PATCH /api/users/me`

> **変更**: Google OAuth移行により、avatar_urlはGoogle提供画像を使用。更新対象はdisplay_nameのみに簡素化。

**TDD実装フロー**
- [ ] **RED**: ユーザー情報更新のテストケース作成
- [ ] **GREEN**: display_name の更新処理
- [ ] **REFACTOR**: 部分更新・バリデーション統一

### ~~Issue: メールアドレス変更エンドポイント実装~~ ❌ 廃止
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/100
> **廃止理由**: Google OAuth認証のみに移行。メールアドレスはGoogle側で管理。既存実装コードは削除対象。

### Issue: アカウント削除エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/101
**優先度**: 🟡 Medium | **工数**: 6h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `DELETE /api/users/me`

**TDD実装フロー**
- [x] **RED**: アカウント削除のテストケース作成
- [x] **GREEN**: 関連データカスケード削除・トランザクション処理
- [x] **REFACTOR**: 物理削除vs論理削除の検討・実装（MVPは物理削除を採用。GORMのONDELETE:CASCADEで関連データを自動削除）

### ~~Issue: アバター画像アップロードエンドポイント実装~~ ❌ 廃止
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/102
> **廃止理由**: Google OAuth認証のみに移行。アバター画像はGoogleプロフィール画像を使用。S3アップロード不要。

### ~~Issue: アバター画像削除エンドポイント実装~~ ❌ 廃止
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/103
> **廃止理由**: Google OAuth認証のみに移行。アバター画像はGoogleプロフィール画像を使用。S3削除不要。

### Issue: パーソナライズ提案エンドポイント拡張
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/127
**優先度**: 🔴 High | **工数**: 8h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `POST /api/suggestions`

**タスク概要**
現在の提案ロジック（位置情報ベースのランダム選出）を拡張し、ユーザーの興味タグを考慮したパーソナライズ提案を実装する。興味ジャンル内の施設を優先提案しつつ、コンフォートゾーン脱却のために意図的に興味外ジャンルも混在させる。訪問記録時の `is_comfort_zone` フラグも自動設定する。

**TDD実装フロー**
- [x] **RED**: パーソナライズ提案のテストケース作成
  - 興味タグありユーザーへの優先度反映テスト
  - 脱却提案（興味外ジャンル）の混在比率テスト（例: 3件中1件）
  - 訪問記録登録時の `is_comfort_zone` フラグ正確性テスト
  - 興味タグ未設定ユーザーへのフォールバック（従来ランダム）テスト
- [x] **GREEN**: 最小実装
  - `POST /api/suggestions` ハンドラでユーザーの興味タグを取得
  - 提案候補を「興味ジャンル合致」と「興味ジャンル外」に分類
  - 優先スコアリングで選出（例: 3件中2件を興味内・1件を興味外から選出）
  - `POST /api/visits` 登録時に `is_comfort_zone`（興味外なら `true`）を自動設定
- [x] **REFACTOR**: リファクタリング
  - スコアリングロジックを独立した関数に分離（`classifyByInterest`, `selectPersonalizedPlaces`, `getUserInterestGenreNames`, `getGenreNameFromTypes`）
  - 興味内/外の混在比率を設定値化（`inInterestCount = 2`）
  - N+1問題対策：JOINクエリで興味タグを一括取得

### ~~Issue: 提案エンドポイント気分パラメータ対応~~ ❌ 廃止
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/129
> **廃止理由**: 気分選択機能を廃止。毎日気分を入力する操作が継続的なUX摩擦になる。興味タグ + 脱却モードで十分なパーソナライズが可能。Phase 2のAIが行動パターンから自動推定するため、手動入力は不要。

### Issue: 気分パラメータ関連コードの削除（バックエンド）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/143
**優先度**: 🟡 Medium | **工数**: 2h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
Issue #129 で実装した気分パラメータ対応コードを削除する。気分選択機能廃止に伴う対応。

**実装内容**
- [x] `handlers/suggestion.go`: `mood` フィールドのリクエスト型・バリデーション削除
- [x] `handlers/suggestion.go`: `moodTypeMapping` マッピングテーブル削除
- [x] `handlers/suggestion.go`: 提案候補フィルタリングの気分マッピング適用ロジック削除
- [x] `handlers/suggestion.go`: 日次キャッシュキーから `mood` を除去（気分なし時の従来キーに統一）
- [x] `handlers/suggestion_test.go`: 気分パラメータ関連テスト削除

### Issue: 訪問記録エンドポイント拡張（POST /api/visits）ゲーミフィケーション処理
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/128
**優先度**: 🔴 High | **工数**: 10h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `POST /api/visits`

**タスク概要**
現在は訪問記録のみ行うエンドポイントに、ゲーミフィケーション処理を追加する。XP計算・レベルアップ判定・バッジ付与・ジャンル熟練度更新・ストリーク更新をトランザクション内で処理し、フロントエンドのXP獲得演出（Issue #106）に必要な情報をレスポンスに返す。

**XP計算ルール**
- 通常訪問（`is_comfort_zone=false`）: 50 XP
- 脱却訪問（`is_comfort_zone=true`）: 100 XP
- 初めてのジャンル訪問ボーナス: +50 XP
- 初めてのエリア訪問ボーナス: +30 XP
- 感想メモ記入ボーナス: +10 XP

**TDD実装フロー**
- [x] **RED**: ゲーミフィケーション処理のテストケース作成
  - XP計算パターン別テスト（通常/脱却/ボーナス組み合わせ）
  - レベルアップ閾値テスト（総XPがレベルテーブルを超えた場合）
  - バッジ条件チェック・付与テスト（初脱却、初訪問等）
  - ジャンル熟練度更新テスト（新規/既存ジャンル）
  - ストリーク更新テスト（週次継続判定）
  - トランザクション失敗時のロールバックテスト
- [x] **GREEN**: 最小実装
  - XP計算関数の実装（条件ごとのボーナス加算）
  - `users.total_xp` 更新・レベルテーブル照合によるレベルアップ判定
  - `genre_proficiency` のXP・レベル更新（新規レコード作成 or 既存更新）
  - バッジ条件チェック関数・`user_badges` 追加
  - `streak_count` / `streak_last` の週次継続判定・更新
  - レスポンスに `xp_earned`, `total_xp`, `level_up`, `new_level`, `new_badges[]` を追加
- [x] **REFACTOR**: リファクタリング
  - バッジ条件チェックをルールベース設計で拡張容易に
  - XP計算・レベル判定を独立したサービス層に分離
  - パフォーマンス最適化（バッジ条件の一括チェック）

---

## 🎨 フロントエンド（React + TypeScript + React Router v7）— Phase 1

> **フロント設計方針**: 
> - **React Router v7 ファイルベースルーティング**を完全採用（routes.ts で一元管理）
> - **screen-design に忠実なデザイン実装**
> - **t-wadaの TDD フロー**で開発（RED → GREEN → REFACTOR）
> **注意**: SPAモード（`react-router.config.ts` で `ssr: false`）のため、サーバーサイド専用の `loader` / `action` は使用不可。必ず `clientLoader` / `clientAction` を使う。

### Issue: Google OAuth ログイン機能実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/104
**優先度**: 🔴 High | **工数**: 8h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
ログイン画面にGoogle OAuthボタンを追加し、OAuth認証フローを実装する。

**TDD実装フロー**
- [x] **RED**: OAuth認証フローのテストケース作成
  - Google OAuth ボタンクリック時のテスト
  - OAuth認証成功時のリダイレクト処理テスト
  - 認証エラー時のハンドリングテスト
  - トークン保存・取得処理のテスト
- [x] **GREEN**: 最小実装
  - Google Sign-In JavaScript SDK（@react-oauth/google）導入
  - ログイン画面に「Googleでログイン」ボタン追加
  - OAuth認証後のコールバック処理実装
  - トークン取得・保存処理実装
- [x] **REFACTOR**: リファクタリング
  - 認証フローの共通化・抽象化（lib/auth.ts に googleOAuth() として集約）
  - エラーハンドリングの統一
  - UX改善（ローディング状態等）

### Issue: オンボーディング画面実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/105
**優先度**: 🔴 High | **工数**: 12h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
新規ユーザー向けの興味タグ選択オンボーディング画面を実装する。

**TDD実装フロー**
- [x] **RED**: オンボーディング画面のテストケース作成
  - 興味タグ一覧表示のテスト
  - 複数選択UI（3つ以上必須）のテスト
  - 選択状態の視覚フィードバックテスト
  - 設定完了・スキップ処理のテスト
  - 初回ユーザー判定・自動リダイレクトのテスト
- [x] **GREEN**: 最小実装
  - `/onboarding` ルート・画面実装
  - 興味タグAPI連携・一覧表示
  - 複数選択チェックボックスUI実装
  - 設定保存・`/home` への遷移処理
  - 初回ユーザー判定ロジック実装（interests >= 3 なら /home へリダイレクト）
- [x] **REFACTOR**: リファクタリング
  - 選択状態管理の最適化
  - バリデーション・UXの向上
  - レスポンシブ対応

### Issue: XP獲得モーダル・バッジトースト通知実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/106
**優先度**: 🔴 High | **工数**: 10h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
「行ってきた！」ボタン押下時のXP獲得モーダルとバッジ獲得トースト通知を実装する。

**TDD実装フロー**
- [x] **RED**: XP獲得演出のテストケース作成
  - XP獲得モーダル表示・非表示のテスト
  - バッジ獲得トースト表示・自動消滅のテスト
  - レベルアップ表示のテスト（該当時）
  - 複数バッジ獲得時の処理テスト
- [x] **GREEN**: 最小実装
  - XP獲得モーダルコンポーネント実装（`components/xp-modal.tsx`）
  - バッジ獲得トーストコンポーネント実装（`components/badge-toast.tsx`）
  - レベル計算ユーティリティ実装（`utils/level.ts`）
  - 訪問記録API応答データ活用・表示制御（`routes/home.tsx`）
  - アニメーション・タイマー処理実装（`app.css`）
  - 型定義追加（`BadgeInfo`, `CreateVisitResponse`）
  - 注: Issue #128（バックエンドゲーミフィケーション）実装後、APIレスポンスにXPデータが含まれると自動的に動作する
- [x] **REFACTOR**: リファクタリング
  - デザインをscreen-design/報酬獲得モーダルに忠実に実装
  - 複数バッジ獲得時は最初のバッジをモーダルに、追加バッジをキュー式トーストで表示
  - アニメーション性能の改善（cubic-bezier spring animation）

### Issue: 訪問詳細画面実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/107
**優先度**: 🟡 Medium | **工数**: 10h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
履歴画面の各アイテムから遷移する訪問詳細画面を実装する。

**TDD実装フロー**
- [x] **RED**: 訪問詳細画面のテストケース作成
  - 訪問場所情報表示のテスト
  - 感想メモ・評価入力・表示のテスト
  - 編集・保存機能のテスト
  - 履歴画面からの遷移・戻るボタンのテスト
- [x] **GREEN**: 最小実装
  - `/history/:id` ルート・画面実装
  - 訪問詳細API連携・データ表示
  - 5段階評価・感想メモ入力UI実装
  - 編集・保存機能実装
  - 履歴画面からのリンク・遷移処理
- [x] **REFACTOR**: リファクタリング
  - フォーム管理の最適化（保存後のstate同期）
  - レスポンシブ対応
  - UX向上（保存状態の表示等）

### Issue: 設定画面タブ化実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/108
**優先度**: 🟡 Medium | **工数**: 12h | **担当**: 個人 | **Phase**: Phase 1

> **変更**: Google OAuth移行により、メール変更・パスワード変更・アバター変更は削除。ユーザー情報タブはdisplay_nameのみ、アカウントタブはアカウント削除のみに簡素化。

**タスク概要**
プロフィール画面からアクセスできる設定画面をタブ化し、各種設定を管理できるようにする。

**TDD実装フロー**
- [x] **RED**: 設定画面のテストケース作成
  - タブナビゲーション切り替えのテスト
  - ユーザー情報タブ（表示名変更）のテスト
  - 提案設定タブ（興味タグ・半径・頻度）のテスト
  - アカウントタブ（アカウント削除）のテスト
  - 設定保存・エラーハンドリングのテスト
- [x] **GREEN**: 最小実装
  - `/settings` ルート・タブ構成実装
  - 各タブのUI・フォーム実装
  - 設定値取得・表示・更新処理
  - プロフィール画面からのアクセス実装
  - メールアドレス変更の認証フロー実装
- [x] **REFACTOR**: リファクタリング
  - タブ状態管理の最適化
  - フォームバリデーションの統一
  - レスポンシブ対応

### ~~Issue: アバター画像設定機能実装（フロントエンド）~~ ❌ 廃止
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/109
> **廃止理由**: Google OAuth認証のみに移行。アバター画像はGoogleプロフィール画像を自動使用。アップロード/削除UIは不要。

### Issue: プロフィール画面拡張実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/110
**優先度**: 🟡 Medium | **工数**: 8h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
プロフィール画面にレベル・XP・プログレスバー・バッジを表示する。

**TDD実装フロー**
- [x] **RED**: プロフィール画面拡張のテストケース作成
  - レベル・称号・XP表示のテスト
  - プログレスバー表示・計算のテスト
  - 獲得バッジ一覧表示のテスト
  - 統計情報表示のテスト
  - ジャンル別熟練度表示のテスト
- [x] **GREEN**: 最小実装
  - ユーザー統計API連携・データ表示
  - レベル・XP・プログレスバー実装
  - バッジコレクション表示実装
  - ジャンル別熟練度（レーダーチャート等）実装
- [x] **REFACTOR**: リファクタリング
  - 視覚エフェクトの調整
  - パフォーマンス最適化
  - レスポンシブ対応

### Issue: マップ画面実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/111
**優先度**: 🟡 Medium | **工数**: 14h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
Google Maps連携で訪問済み場所をピン表示するマップ画面を実装する。

**TDD実装フロー**
- [x] **RED**: マップ画面のテストケース作成
  - Google Maps API連携のテスト
  - 訪問済みピン表示のテスト
  - ピンクリック時の詳細表示のテスト
  - ジャンル別ピンアイコン・色分けのテスト
  - 現在地表示・中心移動のテスト
- [x] **GREEN**: 最小実装
  - `/history` 画面にリスト/マップタブを追加（ボトムナビ変更なし）
  - 訪問データAPI連携（`GET /api/visits/map`）・ピン表示実装
  - ピンクリック時のインフォウィンドウ実装
  - ジャンル別アイコン・色分け実装
  - インフォウィンドウから `/history/:id` 詳細画面へのリンク
- [x] **REFACTOR**: リファクタリング
  - マップデータのキャッシュ（タブ切替のたびにAPIコールしない）
  - ピン色は `category-map.ts` の既存カラー情報を流用
  - pre-existing 型エラー修正（`CreateVisitResponse`, `mockVisits`）

### ~~Issue: 気分選択UI実装（ホーム画面）~~ ❌ 廃止
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/130
> **廃止理由**: 気分選択機能を廃止。毎日気分を入力する操作が継続的なUX摩擦になる。興味タグ + 脱却モードで十分なパーソナライズが可能。Phase 2のAIが行動パターンから自動推定するため、手動入力は不要。
