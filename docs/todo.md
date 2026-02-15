# TODO — GitHub Issue 化ガイド

> 以下の各セクションをGitHub Issueとして作成してください。
> ラベル: `Phase0`, `Phase1`, `backend`, `frontend` を適宜付与

---

## 📋 インフラ整備（Phase 0・Phase 1 共通基盤）

### Issue: インフラ初期セットアップ ✅ 完了
**タスク概要**
Docker環境およびローカル開発環境を整備。以降のバックエンド・フロントエンド開発の基盤を構築する。

### Issue: DBスキーマ設計・実装（Phase 0） ✅ 完了
**タスク概要**
MySQL スキーマを設計・実装。Phase 0 に必要な最小限のテーブル(`users`, `visit_history`)を定義。

### Issue: 環境変数管理・設定ファイル作成 ✅ 完了
**タスク概要**
バックエンド・フロントエンドの環境変数ファイルを作成。

## 🔧 バックエンド（Go + Gin）— Phase 0

### Issue: Go プロジェクト初期セットアップ ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/4
**タスク**: Go プロジェクト基本構造の整備

### Issue: ヘルスチェック API 実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/5
**タスク**: `GET /health` エンドポイント実装

### Issue: MySQL 接続・初期化処理実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/6
**タスク**: GORM 経由での MySQL 接続・テーブル自動マイグレーション

### Issue: JWT認証ミドルウェア実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/7
**タスク**: JWT ベースの認証ミドルウェア・ユーティリティ実装

### Issue: 認証API実装（signup/login） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/8
**タスク**: ユーザー登録・ログイン API 実装

### Issue: トークンリフレッシュAPI実装（Go） — POST /api/auth/refresh ✅ 完了
**GitHub Issue**:　https://github.com/Hiru-ge/Roamble/issues/38
**タスク**: リフレッシュトークンを使用して新しいアクセストークンを取得する API を実装。

### Issue: ログアウトAPI実装（Go） — POST /api/auth/logout ✅ 完了
**GitHub Issue**:　https://github.com/Hiru-ge/Roamble/issues/39
**タスク**: ユーザーのログアウト処理を実装。トークンを無効化する。

### Issue: ユーザー情報取得API実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/9
**タスク**: GET /api/users/me エンドポイント実装

### Issue: 提案API実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/10
**タスク**: Google Places API 連携・周辺施設提案エンドポイント実装

### Issue: 訪問記録API実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/11
**タスク**: POST /api/visits エンドポイント実装

### Issue: 訪問履歴取得API実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/12
**タスク**: GET /api/visits エンドポイント実装

### Issue: ルーティング設定（Gin） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/13
**タスク**: Gin ルーターにエンドポイントを集約

### Issue: Google Places Photo API 統合 — 施設画像取得エンドポイント実装　✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/52
**タスク**　Google Places Photo API を使用して、施設の写真URL を取得。バックエンド新規エンドポイントを実装し、メイン発見画面・履歴画面での画像表示に対応。

### Issue: 開発用：提案キャッシュリセット・管理エンドポイント実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/53
**タスク**　開発時に施設の提案キャッシュをリセット・管理するための開発者向けエンドポイントを実装。同じ提案が繰り返される状況を回避し、開発効率を向上させる。

### Issue: 提案キャッシュの日次持続化 — 1日間同じ3施設を表示 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/55
**タスク**: Redis を活用してユーザー・日付・位置情報をキーにした日次キャッシュを実装。1日間同じ3施設を提案し、訪問済み施設は除外する機能を追加。

### Issue: 訪問履歴テーブル設計見直し — ジャンル・地名カラムの追加 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/58
**タスク**: `visit_history` テーブルに`category`・`place_name`カラムを追加。訪問記録APIでジャンル情報を保存し、履歴画面で動的カテゴリーフィルターを実現。

---

### Issue: Google Places API レスポンスの日本語化 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/59
**タスク**: Google Places API の `language` パラメータに `ja` を指定し、施設名・住所を日本語で取得するように修正。

---

## 🎨 フロントエンド（React + TypeScript + React Router v7）— Phase 0

> **フロント設計方針**: 
> - **React Router v7 ファイルベースルーティング**を完全採用（routes.ts で一元管理）
> - **screen-design に忠実なデザイン実装**
> - **t-wadaの TDD フロー**で開発（テスト→実装→リファクタ）
> **注意**: SPAモード（`react-router.config.ts` で `ssr: false`）のため、サーバーサイド専用の `loader` / `action` は使用不可。必ず `clientLoader` / `clientAction` を使う。

### Issue: React Router v7 プロジェクト初期セットアップ　✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/14
**タスク**　React Router v7 ベースの SPA 開発環境を整備。ファイルベースルーティング (routes.ts) で全ルートを一元管理。

### Issue: React Router v7 ルーティング設定　✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/15
**タスク**　React Router v7 のファイルベースルーティングを設定。

### Issue: 認証状態管理実装（React + React Router v7 clientLoader） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/16
**タスク**　React Router v7 の clientLoader / clientAction で JWT トークン管理・認証状態を実装。

---

### Issue: ランディングページ実装（React） — / (未認証) ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/24
**タスク**: ベータ版向けの簡潔なランディングページを実装。Heroセクション、利用フロー、3ステップ、CTAボタンを含む構成。

---

### Issue: サインアップ画面実装（React） — /signup ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/25
**タスク** ユーザー登録画面を実装。メール・パスワード・表示名の入力フォームを設置。バックエンド auth.go の SignUp API と連携。

### Issue: ログイン画面実装（React） — /login ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/26
**タスク** ログイン画面を実装。メール・パスワード入力でバックエンド Login API と連携。

### Issue: メイン発見画面実装（React） — /home（提案表示） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/27
**タスク** Roamble のコア画面。Google Places API の提案施設をカード表示し、スキップで次のカード、「行ってきた！」で訪問記録を行う。

### Issue: 訪問履歴画面実装（React） — /history ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/28
**タスク概要**　これまでの訪問記録を一覧表示。日付でグループ化し、ジャンル別フィルター機能を実装。
**デザイン**: `docs/screen-design/履歴画面/code.html` に忠実に実装

### Issue: ユーザープロフィール画面実装（React） — /profile（簡易版 Phase 0） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/29
**タスク**: ユーザー情報と簡易統計情報（訪問数、開始日）を表示するマイページ。ログアウト機能、設定ページ・履歴ページへのリンクを含む。

---

### Issue: 共通レイアウト・コンポーネント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/31
**タスク概要** フロントエンド全体で使用する共通レイアウト・コンポーネントを実装。

### Issue: Tailwind CSS カラーパレット・レスポンシブ設定　✅完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/32
**タスク**　Tailwind CSS を screen-design のデザインに合わせて設定。カラーパレット・タイポグラフィ・ブレークポイントを定義。

---

### Issue: API エラーハンドリング・バリデーション統一 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/33
**タスク**: バックエンドAPIのエラー応答に対する統一的なエラーハンドリングを実装。トーストコンポーネントでユーザー通知、401エラー時の自動リフレッシュ処理を追加。

---

### Issue: フロントエンド E2E テスト（Playwright） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/30
**タスク**: signup → login → home → history の主要フローを E2E テストで検証。

---

### Issue: ユーザー設定変更機能実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/63
**タスク**: マイページから遷移するユーザー設定画面を実装。表示名変更・パスワード変更機能を提供。

---

### Issue: Material Symbols アイコンのロード時ちらつき軽減 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/68
**タスク**: @fontsourceパッケージを使用してフォントをローカルホスティングに変更。アイコン読み込み時のちらつきを軽減。

---

### Issue: アバター画像設定機能実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/70
**優先度**: 🟡 Medium | **工数**: 4h | **担当**: 個人 | **Phase**: Phase 1

**タスク概要**
ユーザー設定画面でアバター画像をアップロード・設定できる機能を実装。プロフィール画面・設定画面でアバター画像を表示する。

**実装内容**

**A. バックエンド（Go）**
- [ ] `POST /api/users/avatar` — アバター画像アップロードエンドポイント
- [ ] 画像バリデーション（形式: jpg/png、サイズ上限: 5MB）
- [ ] 画像リサイズ処理（正方形 256x256px）
- [ ] S3 バケットへアップロード
- [ ] users テーブルに `avatar_url` カラム追加
- [ ] `DELETE /api/users/avatar` — アバター画像削除エンドポイント

**B. フロントエンド（React）**
- [ ] `/settings` 画面にアバター画像設定セクション追加
- [ ] 画像選択UI（ファイル選択ボタン + プレビュー）
- [ ] 画像アップロード処理
- [ ] プロフィール画面 (`/profile`) でアバター画像表示
- [ ] デフォルトアバター画像（未設定時）

**C. インフラ**
- [ ] S3 バケット作成・CORS設定
- [ ] バケットポリシー設定（公開読み取り許可）

**受け入れ基準**
- [ ] 画像を選択してアップロードできる
- [ ] プロフィール画面にアバター画像が表示される
- [ ] 画像を削除できる（デフォルトアバターに戻る）
- [ ] テスト全パス

---

## 🔐 セキュリティ強化（Phase 0 Complete後のセキュリティハードニング）

### Issue: CORS設定の環境変数化 — AllowOrigins: ["*"] の全開放を修正 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/72
**タスク**: CORS設定を環境変数ベースの制御に変更。本番デプロイ時のセキュリティリスクを解消。

---

### Issue: API_BASE_URL の環境変数化 — ハードコードされたURLを修正 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/73
**タスク概要**　`API_BASE_URL = "http://localhost:8000"` がハードコードされており、本番デプロイ時にビルドが壊れる。環境変数ベースに変更する。

### Issue: パスワード長上限チェック追加 — bcrypt制限対応とDoS防止 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/74
**タスク概要**　パスワード長に上限がなく、bcryptの72バイト制限による切り詰めやDoS攻撃のリスクがある。最大72文字制限を追加する。

### Issue: リフレッシュトークンのログアウト時ブラックリスト化 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/75
**タスク概要**　ログアウト時にアクセストークンのみブラックリスト化されており、リフレッシュトークンが残存するセキュリティリスクがある。

### Issue: ListVisits APIの limit パラメータ上限設定 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/76
**タスク概要**　`limit` クエリパラメータに上限がなく、`?limit=1000000` のような巨大リクエストによるリソース消費攻撃が可能。

### Issue: Suggest APIの Radius パラメータ上限設定 — API課金制御 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/77
**タスク概要**　`radius` パラメータに上限がなく、大きな値によるGoogle Places API課金増大のリスクがある。

### Issue: 開発用エンドポイントへの認証追加
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/78
**タスク概要**　`dev` エンドポイントが認証なしで公開されており、開発環境でも不正アクセスのリスクがある。

## 🧪 テストカバレッジ改善（Phase 0 Complete後のテスト強化）

### Issue: テスト未実装ファイルへのテスト追加 — カバレッジギャップ解消 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/79
**タスク概要**　コードレビューで特定されたテスト未実装ファイルに対してテストを追加し、テストカバレッジのギャップを解消する。

---

## フロントエンド実装チェックリスト（Phase 0 完了時）

| タスク | 状態 |
|--------|------|
| React Router v7 セットアップ | ✅ 完了 |
| ルーティング設定 | ✅ 完了 |
| 認証状態管理・clientLoader | ✅ 完了 |
| ランディングページ | ✅ 完了 |
| サインアップ画面 | ✅ 完了 |
| ログイン画面 | ✅ 完了 |
| メイン発見画面 | ✅ 完了 |
| 履歴画面 | ✅ 完了（Issue #58 で動的カテゴリーフィルター対応） |
| マイページ | ✅ 完了 |
| 共通コンポーネント・レイアウト | ✅ 完了 |
| Tailwind 設定 | ✅ 完了 |
| エラーハンドリング | ✅ 完了 |
| ユーザー設定変更 | ✅ 完了 |
| E2E テスト | ✅ 完了 |
