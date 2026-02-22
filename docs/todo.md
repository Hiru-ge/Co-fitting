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

### Issue: S3アバター画像保存設定
**優先度**: 🟡 Medium | **工数**: 4h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
アバター画像をS3に保存するためのインフラ設定を行う。

**実装内容**

**A. S3設定**
- [ ] S3バケット作成（avatars用）
- [ ] CORS設定（フロントエンドからのアップロード対応）
- [ ] バケットポリシー設定（公開読み取り許可）
- [ ] ライフサイクル設定（古いファイルの自動削除）

**B. 環境変数・設定**
- [ ] AWS認証情報設定
- [ ] バケット名・リージョン設定
- [ ] CDN設定（CloudFront）検討

**C. セキュリティ**
- [ ] IAMロール・ポリシー設定
- [ ] 署名付きURL活用検討

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
- [ ] **RED**: 訪問記録更新のテストケース作成
  - 感想メモ更新テスト
  - 評価更新テスト
  - 権限チェックテスト
- [ ] **GREEN**: 最小実装
  - 訪問記録の部分更新処理
  - バリデーション・権限チェック
- [ ] **REFACTOR**: 更新可能フィールド管理

### Issue: マップ表示用データ取得エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/98
**優先度**: 🟡 Medium | **工数**: 5h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `GET /api/visits/map`

**TDD実装フロー**
- [ ] **RED**: マップデータ取得のテストケース作成
- [ ] **GREEN**: 位置情報・ジャンル情報の最適化取得
- [ ] **REFACTOR**: 大量データ処理・ページング対応

### Issue: ユーザー情報更新エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/99
**優先度**: 🟡 Medium | **工数**: 4h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `PATCH /api/users/me`

**TDD実装フロー**
- [ ] **RED**: ユーザー情報更新のテストケース作成
- [ ] **GREEN**: display_name・avatar_url等の更新処理
- [ ] **REFACTOR**: 部分更新・バリデーション統一

### Issue: メールアドレス変更エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/100
**優先度**: 🟡 Medium | **工数**: 8h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `PATCH /api/users/me/email`

**TDD実装フロー**
- [ ] **RED**: メール変更のテストケース作成
  - 認証フローのテスト
  - 重複メールエラーのテスト
- [ ] **GREEN**: 最小実装
  - 認証用トークン生成・メール送信
  - トークン検証・メール更新処理
- [ ] **REFACTOR**: セキュリティ強化・エラーハンドリング

### Issue: アカウント削除エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/101
**優先度**: 🟡 Medium | **工数**: 6h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `DELETE /api/users/me`

**TDD実装フロー**
- [ ] **RED**: アカウント削除のテストケース作成
- [ ] **GREEN**: 関連データカスケード削除・トランザクション処理
- [ ] **REFACTOR**: 物理削除vs論理削除の検討・実装

### Issue: アバター画像アップロードエンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/102
**優先度**: 🟡 Medium | **工数**: 8h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `POST /api/users/avatar`

**TDD実装フロー**
- [ ] **RED**: 画像アップロードのテストケース作成
  - 正常アップロードテスト
  - ファイル形式・サイズのバリデーションテスト
- [ ] **GREEN**: 最小実装
  - マルチパートファイル受信・バリデーション
  - 画像リサイズ処理（256x256px正方形）
  - S3アップロード・URL取得・DB更新
- [ ] **REFACTOR**: エラーハンドリング・ファイル名生成最適化

### Issue: アバター画像削除エンドポイント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/103
**優先度**: 🟡 Medium | **工数**: 4h | **担当**: 個人 | **Phase**: Phase 1
**エンドポイント**: `DELETE /api/users/avatar`

**TDD実装フロー**
- [ ] **RED**: 画像削除のテストケース作成
- [ ] **GREEN**: S3ファイル削除・DB初期化処理
- [ ] **REFACTOR**: 削除失敗時の処理統一

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
- [ ] **RED**: OAuth認証フローのテストケース作成
  - Google OAuth ボタンクリック時のテスト
  - OAuth認証成功時のリダイレクト処理テスト
  - 認証エラー時のハンドリングテスト
  - トークン保存・取得処理のテスト
- [ ] **GREEN**: 最小実装
  - Google Sign-In JavaScript SDK導入
  - ログイン画面に「Googleでログイン」ボタン追加
  - OAuth認証後のコールバック処理実装
  - トークン取得・保存処理実装
- [ ] **REFACTOR**: リファクタリング
  - 認証フローの共通化・抽象化
  - エラーハンドリングの統一
  - UX改善（ローディング状態等）

### Issue: オンボーディング画面実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/105
**優先度**: 🔴 High | **工数**: 12h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
新規ユーザー向けの興味タグ選択オンボーディング画面を実装する。

**TDD実装フロー**
- [ ] **RED**: オンボーディング画面のテストケース作成
  - 興味タグ一覧表示のテスト
  - 複数選択UI（3つ以上必須）のテスト
  - 選択状態の視覚フィードバックテスト
  - 設定完了・スキップ処理のテスト
  - 初回ユーザー判定・自動リダイレクトのテスト
- [ ] **GREEN**: 最小実装
  - `/onboarding` ルート・画面実装
  - 興味タグAPI連携・一覧表示
  - 複数選択チェックボックスUI実装
  - 設定保存・`/home` への遷移処理
  - 初回ユーザー判定ロジック実装
- [ ] **REFACTOR**: リファクタリング
  - 選択状態管理の最適化
  - バリデーション・UXの向上
  - レスポンシブ対応

### Issue: XP獲得モーダル・バッジトースト通知実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/106
**優先度**: 🔴 High | **工数**: 10h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
「行ってきた！」ボタン押下時のXP獲得モーダルとバッジ獲得トースト通知を実装する。

**TDD実装フロー**
- [ ] **RED**: XP獲得演出のテストケース作成
  - XP獲得モーダル表示・非表示のテスト
  - バッジ獲得トースト表示・自動消滅のテスト
  - マップピン追加アニメーションのテスト
  - レベルアップ表示のテスト（該当時）
  - 複数バッジ獲得時の処理テスト
- [ ] **GREEN**: 最小実装
  - XP獲得モーダルコンポーネント実装
  - バッジ獲得トーストコンポーネント実装
  - 訪問記録API応答データ活用・表示制御
  - アニメーション・タイマー処理実装
- [ ] **REFACTOR**: リファクタリング
  - 演出効果の調整・最適化
  - 状態管理の整理
  - アニメーション性能の改善

### Issue: 訪問詳細画面実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/107
**優先度**: 🟡 Medium | **工数**: 10h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
履歴画面の各アイテムから遷移する訪問詳細画面を実装する。

**TDD実装フロー**
- [ ] **RED**: 訪問詳細画面のテストケース作成
  - 訪問場所情報表示のテスト
  - 感想メモ・評価入力・表示のテスト
  - 編集・保存機能のテスト
  - 履歴画面からの遷移・戻るボタンのテスト
- [ ] **GREEN**: 最小実装
  - `/history/:id` ルート・画面実装
  - 訪問詳細API連携・データ表示
  - 5段階評価・感想メモ入力UI実装
  - 編集・保存機能実装
  - 履歴画面からのリンク・遷移処理
- [ ] **REFACTOR**: リファクタリング
  - フォーム管理の最適化
  - レスポンシブ対応
  - UX向上（保存状態の表示等）

### Issue: 設定画面タブ化実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/108
**優先度**: 🟡 Medium | **工数**: 12h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
プロフィール画面からアクセスできる設定画面をタブ化し、各種設定を管理できるようにする。

**TDD実装フロー**
- [ ] **RED**: 設定画面のテストケース作成
  - タブナビゲーション切り替えのテスト
  - ユーザー情報タブ（表示名・アバター・メール変更）のテスト
  - 提案設定タブ（興味タグ・半径・頻度）のテスト
  - アカウントタブ（パスワード変更・削除）のテスト
  - 設定保存・エラーハンドリングのテスト
- [ ] **GREEN**: 最小実装
  - `/settings` ルート・タブ構成実装
  - 各タブのUI・フォーム実装
  - 設定値取得・表示・更新処理
  - プロフィール画面からのアクセス実装
  - メールアドレス変更の認証フロー実装
- [ ] **REFACTOR**: リファクタリング
  - タブ状態管理の最適化
  - フォームバリデーションの統一
  - レスポンシブ対応

### Issue: アバター画像設定機能実装（フロントエンド）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/109
**優先度**: 🟡 Medium | **工数**: 6h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
設定画面でアバター画像をアップロード・設定・削除できるUI機能を実装する。

**TDD実装フロー**
- [ ] **RED**: アバター設定UIのテストケース作成
  - ファイル選択・プレビューのテスト
  - 画像アップロード・プログレス表示のテスト
  - アップロード成功・エラーハンドリングのテスト
  - 画像削除・確認モーダルのテスト
  - 各画面でのアバター表示のテスト
- [ ] **GREEN**: 最小実装
  - アバター設定セクション実装
  - ファイル選択・プレビュー機能実装
  - アップロード・削除API連携実装
  - プロフィール・ヘッダーでの表示実装
- [ ] **REFACTOR**: リファクタリング
  - ファイル処理の最適化
  - UI/UXの調整
  - エラーハンドリングの改善

### Issue: プロフィール画面拡張実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/110
**優先度**: 🟡 Medium | **工数**: 8h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
プロフィール画面にレベル・XP・プログレスバー・バッジを表示する。

**TDD実装フロー**
- [ ] **RED**: プロフィール画面拡張のテストケース作成
  - レベル・称号・XP表示のテスト
  - プログレスバー表示・計算のテスト
  - 獲得バッジ一覧表示のテスト
  - 統計情報表示のテスト
  - ジャンル別熟練度表示のテスト
- [ ] **GREEN**: 最小実装
  - ユーザー統計API連携・データ表示
  - レベル・XP・プログレスバー実装
  - バッジコレクション表示実装
  - ジャンル別熟練度（レーダーチャート等）実装
- [ ] **REFACTOR**: リファクタリング
  - 視覚エフェクトの調整
  - パフォーマンス最適化
  - レスポンシブ対応

### Issue: マップ画面実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/111
**優先度**: 🟡 Medium | **工数**: 14h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
Google Maps連携で訪問済み場所をピン表示するマップ画面を実装する。

**TDD実装フロー**
- [ ] **RED**: マップ画面のテストケース作成
  - Google Maps API連携のテスト
  - 訪問済みピン表示のテスト
  - ピンクリック時の詳細表示のテスト
  - ジャンル別ピンアイコン・色分けのテスト
  - 現在地表示・中心移動のテスト
- [ ] **GREEN**: 最小実装
  - `/map` ルート・Google Maps API連携
  - 訪問データAPI連携・ピン表示実装
  - ピンクリック時のインフォウィンドウ実装
  - ボトムナビにマップ追加
  - ジャンル別アイコン・色分け実装
- [ ] **REFACTOR**: リファクタリング
  - マップ操作パフォーマンス最適化
  - ピン表示ロジックの改善
  - レスポンシブ対応・UX向上
