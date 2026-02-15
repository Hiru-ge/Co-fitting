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
**優先度**: 🔴 High | **工数**: 2.5h | **担当**: 個人 | **Phase**: Phase 0
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/55

**タスク概要**
本来、1日の間は同じ3施設を提案する設計であったが、現在、ページをリロードすると異なる3施設が出てしまい、仕様通りの動作になっていない。
これを修正し、1日の間は常に同じ3施設を提案するようにキャッシュ機構を改善する。
Redis を活用して、ユーザー・日付・位置情報をキーにした日次キャッシュを実装する。
また、訪問済みの施設はホーム画面に表示されないようにする（チェックイン直後の即時除去 + リロード時のDB照合）。

**実装内容**

**A. バックエンド（Go）実装**

- [x] `database/redis.go` 拡張 — 日次キャッシュ関数群を追加
  - `DailySuggestionCacheKey(userID, date string, lat, lng float64) string` — キャッシュキー生成関数
    - キャッシュキー: `suggestion:daily:{userID}:{date}:{lat}_{lng}` （例：`suggestion:daily:1:2026-02-13:35.68_139.69`）
  - `GetDailySuggestions(ctx, client, userID, date, lat, lng) (string, error)` — キャッシュ取得
    - キャッシュミス時は空文字列を返す（呼び出し元でJSONデコードする設計）
  - `SetDailySuggestions(ctx, client, userID, date, lat, lng, data, ttl) error` — キャッシュ保存
    - JSON文字列をそのまま保存。TTL: 24時間
  - `ClearDailySuggestionsCache(ctx, client, userID) (int64, error)` — ユーザー単位キャッシュ削除
    - SCANパターン `suggestion:daily:{userID}:*` で対象キーを一括削除

- [x] `handlers/suggestion.go` 更新 — レスポンス形式変更 + 日次キャッシュ統合 + 訪問済み除外
  - POST `/api/suggestions` のレスポンスを単一 `PlaceResult` → `[]PlaceResult`（最大3件）に変更
  - 処理フロー:
    1. 日次キャッシュ確認 → ヒット時も `filterOutVisited()` で訪問済みを除外してから返却
    2. 全て訪問済みならキャッシュを無視して再取得へフォールスルー
    3. Places API結果キャッシュ確認 → なければAPI呼び出し
    4. `filterOutVisited()` で訪問済みを除外
    5. `selectRandomPlaces()` で最大3件をFisher-Yatesシャッフルで選出
    6. 選出結果を日次キャッシュに保存（TTL 24h）
  - `filterOutVisited(db, userID, places)` ヘルパー関数を抽出（キャッシュヒット・ミス共通で使用）
  - `selectRandomPlaces(candidates, n)` ヘルパー関数を追加

- [x] 日付取得の統一
  - Go 側で `time.Now().Format("2006-01-02")` で日付を取得

- [x] テスト実装（TDD: RED→GREEN→REFACTOR）
  - `database/redis_test.go` 新規作成
    - キャッシュキー形式テスト、キャッシュミス（空文字列）、キャッシュヒット、TTL検証、ユーザー単位削除
  - `handlers/suggestion_test.go` 拡張
    - `trackingMockPlacesClient` で API 呼び出し回数を追跡
    - 日次キャッシュ: 配列レスポンス、2回目同一結果、API呼び出しスキップ、3件未満返却、訪問済み除外、キャッシュヒット後の訪問済み除外（計7テスト追加）

**B. フロントエンド（React）対応**

- [x] `app/api/suggestions.ts` 更新
  - `getSuggestions(token, lat, lng, radius?)` 新規作成 — `Place[]` を返す配列レスポンス対応
  - `getSuggestion()` は `@deprecated` として残存（内部で `getSuggestions()[0]` にフォールバック）

- [x] `app/routes/home.tsx` 簡素化
  - 3回ループの重複排除ロジックを廃止 → 1回の `getSuggestions()` 呼び出しに統一
  - チェックイン時、`setPlaces(prev => prev.filter(...))` で訪問済みカードを即座に除去
  - 全カード訪問後は「スポットが見つかりませんでした」と再取得ボタンを表示

- [x] テスト更新
  - `app/__tests__/routes/home.test.tsx` — モック・テストを配列レスポンスに対応、カード除去動作テスト追加
  - `app/__tests__/api.test.ts` — `getSuggestions()` の配列レスポンステスト

**C. 開発者向け デバッグ**

- [x] `handlers/dev_handler.go` 拡張
  - `ResetSuggestionCache` と `GetSuggestionStats` が `suggestions:*` と `suggestion:daily:*` の両パターンを処理
- [x] `handlers/dev_handler_test.go` 拡張
  - 日次キャッシュキーも削除されるテスト追加

**受け入れ基準**

- [x] バックエンドで `GetDailySuggestions()` / `SetDailySuggestions()` / `ClearDailySuggestionsCache()` が実装される
- [x] ページ初回訪問 → Google Places API から最大3施設取得 → Redis に日付キーで保存
- [x] ページリロード → Redis キャッシュから同じ施設を取得（API 呼び出しスキップ）、ただし訪問済みは除外
- [x] 日付が変わった時点 → キャッシュ有効期限切れ → 新しい施設を取得
- [x] 位置情報が大きく変わった場合 → 新しいキャッシュキーで新施設取得
- [x] Redis キャッシュの TTL が 24h で動作
- [x] 訪問済みチェックイン直後 → フロントエンドでカードが即座に消える
- [x] リロード時 → バックエンドで訪問履歴DBを参照して訪問済み施設を除外
- [x] テスト: `go test ./...` 全パッケージ成功、`npx vitest run` 全48テスト成功

### Issue: 訪問履歴テーブル設計見直し — ジャンル・地名カラムの追加
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **Phase**: Phase 0
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/58

**タスク概要**
訪問履歴テーブル（`visit_history`）に「ジャンル」と「地名」カラムを追加。
現在の提案画面ではジャンル情報が正しく表示されているため、その情報を `visit_history` にも格納することで、訪問履歴画面での表示をスムーズにする。

**実装内容**

**A. データベース・マイグレーション**

- [x] `backend/database/migrate.go` 更新
  - `visit_history` テーブルに以下のカラム追加：
    - `category VARCHAR(100)` — ジャンル（例：カフェ、公園、観光地）
    - `place_name VARCHAR(255)` — 施設名（日本語）
  - マイグレーション SQL 文作成・実行

**B. バックエンド（Go）実装**

- [x] `backend/models/user.go` または新規 `backend/models/visit.go` を参照
  - Visit モデルに `Category` と `PlaceName` フィールド追加

- [x] `backend/handlers/visit.go` 更新 — POST `/api/visits`
  - リクエスト本体に `category` と `place_name` を含める
  - visit_history に保存時、これらのフィールドを格納

- [x] `backend/handlers/visit.go` 更新 — GET `/api/visits`
  - 訪問履歴取得時、`category` と `place_name` を返却

**C. テスト**

- [x] `backend/handlers/visit_test.go` 拡張
  - POST `/api/visits` 時、category / place_name が正しく保存される確認
  - GET `/api/visits` 時、category / place_name が返却される確認

**D. フロントエンド（React）対応**

- [x] `app/types/visit.ts` 更新
  ```typescript
  export interface Visit {
    id: string;
    placeId: string;
    placeName: string;  // 追加
    category: string;   // 追加
    latitude: number;
    longitude: number;
    visitedAt: Date;
    imageUrl?: string;
  }
  ```

- [x] `app/api/visits.ts` 更新 — createVisit()
  ```typescript
  function createVisit(
    token: string,
    placeId: string,
    placeName: string,  // 追加
    category: string,   // 追加
    latitude: number,
    longitude: number
  ) { ... }
  ```

- [x] `app/routes/home.tsx` 更新
  - 「行ってきた！」ボタン押下時、discoveryCard に表示されている category / place_name を createVisit に渡す

**受け入れ基準**

- [x] DBマイグレーション成功 → `visit_history` に `category`, `place_name` カラムが存在
- [x] POST `/api/visits` → category / place_name が保存される
- [x] GET `/api/visits` → category / place_name が返却される
- [x] 訪問履歴画面 — ジャンル・施設名が正しく表示される（動的フィルター対応）
- [x] `go test ./handlers -v` でテスト成功（テストコード実装済み）

---

### Issue: Google Places API レスポンスの日本語化 ✅ 完了
**優先度**: 🔴 High | **工数**: 0.5h | **担当**: 個人 | **Phase**: Phase 0
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/59

**タスク概要**
Google Places API から返ってくる施設名・住所が英語表記になっていた。
API の `language` パラメータに `ja` を指定することで、レスポンス自体を日本語で取得できることを確認・対応。
翻訳ロジックの実装は不要だった。

**調査結果**

- Google Places API の Nearby Search は `language` パラメータをサポートしており、`ja` を指定すると施設名（`name`）・住所（`vicinity`）が日本語で返却される
- `backend/handlers/suggestion.go` の `NearbySearchRequest` に `Language` フィールドが未設定だったことが原因

**実装内容**

- [x] `backend/handlers/suggestion.go` — `NearbySearchRequest` に `Language: "ja"` を追加
- [x] ビルド・既存テスト全パス確認（`go test ./handlers/ -run Suggest -v`）

**受け入れ基準**

- [x] `NearbySearchRequest` に `Language: "ja"` が設定されている
- [x] ビルド成功・既存テスト全パス
- [x] ※既存の Redis キャッシュに英語レスポンスが残っている場合は、開発用キャッシュリセットエンドポイントでクリアすれば日本語レスポンスに切り替わる

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
**優先度**: 🟡 Medium | **工数**: 1.5h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ベータ版向けの簡潔なランディングページを実装。価値提案はコンパクトにとどめ、利用フロー（提案→訪問→記録）をざっくり説明し、即時利用に移れる構成。

**実装内容**

- [x] `app/routes/index.tsx` 実装
  - Hero: Roamble ロゴ + サブタイトル（価値提案）
  - 利用フロー: 提案→訪問→記録 の3ステップをアイコン付きで表示
  - 「Roamble ってなに？」→ Notion LP（https://hiruge.notion.site/roamble-lp）への外部リンク
  - CTA: 「さっそく始める」（/signup）、「ログイン」（/login）
  - `clientLoader`: 認証済みユーザーは `/home` へリダイレクト
- [x] `app/__tests__/routes/index.test.tsx` 作成（8テスト）
  - タイトル・サブタイトル表示、利用フロー3ステップ、Notion リンク、CTA リンク先、clientLoader 認証分岐

**受け入れ基準**

- [x] http://localhost:5173 にアクセス → ランディングページが表示される
- [x] 「さっそく始める」をクリック → `/signup` へ遷移
- [x] 「ログイン」をクリック → `/login` へ遷移
- [x] 「Roamble ってなに？」→ Notion LP へ外部リンク遷移
- [x] 認証済みユーザーがアクセス → `/home` へリダイレクト
- [x] `npx vitest run` 全66テスト成功

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

### Issue: 訪問履歴画面実装（React） — /history
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/28
**タスク概要**　これまでの訪問記録を一覧表示。日付でグループ化し、ジャンル別フィルター機能を実装。
**デザイン**: `docs/screen-design/履歴画面/code.html` に忠実に実装

### Issue: ユーザープロフィール画面実装（React） — /profile（簡易版 Phase 0） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/29
**優先度**: 🟡 Medium | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ユーザー情報を表示するマイページ。Phase 0では「訪問数」「総移動距離」等の統計情報を簡易表示。
XP / レベルは Phase 1 で拡張予定。
**デザイン**: `docs/screen-design/ユーザープロフィール/code.html` 参照

**実装内容**

**画面デザイン要件**（Phase 0 簡易版）
- ヘッダー
  - ユーザーアイコン
  - 表示名
  - ハンドル名（username）
  - 設定ボタン（モック）
  - 共有ボタン（モック）
- ユーザー統計（簡易）
  - 訪問スポット数
  - 訪問開始日
  - ボタン: ログアウト
- クイックメニュー
  - 探索履歴（/history リンク）
  - ランキング（モック）
- 探索を開始（/home リンク、固定ボトムボタン）

**コンポーネント構成**

**A. `app/routes/profile.tsx`（ページ本体）**
- [x] loader で User 情報 + 訪問統計情報取得
- [x] ユーザー情報表示
- [x] ログアウト機能実装

**ログアウト処理**
- [x] 「ログアウト」ボタン押下 → 確認モーダルを表示（「ログアウトしますか？」）
- [x] モーダルの「ログアウトする」ボタン → clearToken() 実行 → localStorage クリア → `/login` へリダイレクト
- [x] モーダルの「キャンセル」ボタン → モーダルを閉じるのみ（何もしない）

**TDD プロセス**

**🔴 RED PHASE**
- [x] `app/__tests__/routes/profile.test.tsx` 作成（11テスト）

**🟢 GREEN PHASE**
- [x] 上記実装完成

**🔵 REFACTOR PHASE**
- [x] スタイル調整（screen-design に寄せたデザイン）

**受け入れ基準**
- [x] loader で User 情報取得後、画面に表示される
- [x] ログアウトボタン → localStorage クリア → `/login` へリダイレクト
- [x] JWT なしでアクセス → `/login` へリダイレクト

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
**優先度**: 🟡 Medium | **工数**: 1.5h | **担当**: 個人

**タスク概要**
バックエンド API のエラー応答に対応する統一的なエラーハンドリング・ユーザー通知を実装。

**実装内容**

**A. `app/api/client.ts` 拡張**
- [x] HTTP Status Code 別の処理
  - 401 Unauthorized → トークンリフレッシュ試行 → 失敗時 `/login` へリダイレクト
  - 409 Conflict → ユーザーへのエラーメッセージ（メール重複など）
  - 500 Server Error → リトライ提案

**B. `app/utils/error.ts` 作成**
- [x] エラー型定義（`ApiError` クラス、`getErrorMessage`、`parseApiError`、`isNetworkError`、`toUserMessage`）
- [x] エラー変換関数

**C. `app/components/toast.tsx` 実装（軽量版）**
- [x] エラー / 成功 / 情報メッセージ表示（`ToastProvider` + `useToast` フック）
- [x] 自動クローズ（3秒）
- [x] 手動閉じるボタン
- [x] 複数トースト同時表示対応

**D. 各ページでのエラー処理**
- [x] signup / login — ネットワークエラー・サーバーエラー・409 等のステータス別メッセージ
- [x] home — 提案取得失敗・チェックイン失敗時にトースト通知
- [x] history — 訪問履歴取得失敗時にトースト通知
- [x] profile — 統計取得失敗時にトースト通知

**受け入れ基準**
- [x] API エラー時、ユーザーにわかりやすいメッセージが表示される
- [x] 認証エラー → トークンリフレッシュ → 失敗時 `/login` へ自動リダイレクト
- [x] ネットワークエラー → 接続確認メッセージ表示
- [x] `npx vitest run` 全テスト成功

---

### Issue: フロントエンド E2E テスト（Playwright） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/30
**優先度**: 🟢 Low | **工数**: 2h | **担当**: 個人 | **Phase 0 完了後の検証用**

**タスク概要**
signup → login → home → history の主要フローを E2E テストで検証。

**実装内容**

**A. Playwright 環境セットアップ**
- [x] `npm install @playwright/test`
- [x] `playwright.config.ts` 作成

**B. `e2e/main-flow.spec.ts` 作成**
- [x] ランディング → signup → ログイン → home → history → ログアウト
- [x] 主要ユーザーフロー

**受け入れ基準**
- [x] `npm run test:e2e` でテスト実行可能
- [x] すべてのテスト 成功

---

### Issue: ユーザー設定変更機能実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/63
**優先度**: 🟡 Medium | **工数**: 3h | **担当**: 個人 | **Phase**: Phase 0

**タスク概要**
マイページの設定ボタンから遷移するユーザー設定画面を実装。表示名変更・パスワード変更を提供する。

**実装内容**

**A. バックエンド（Go）**
- [x] `PATCH /api/users/me` — 表示名更新エンドポイント
- [x] `POST /api/auth/change-password` — パスワード変更エンドポイント

**B. フロントエンド（React）**
- [x] `/settings` ルート — ユーザー設定画面
- [x] 表示名変更フォーム
- [x] パスワード変更フォーム（現在のパスワード・新しいパスワード・確認入力）
- [x] マイページの設定ボタンから遷移

**受け入れ基準**
- [x] 表示名を変更できる
- [x] パスワードを変更できる（現在のパスワード確認付き）
- [x] テスト全パス

---

### Issue: Material Symbols アイコンのロード時ちらつき軽減 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/68
**優先度**: 🟡 Medium | **工数**: 1h | **担当**: 個人 | **Phase**: Phase 0

**タスク概要**
material-symbols-outlined を採用したことで、`<span>` タグ内のアイコン画像が読み込まれる前に多少のちらつきが発生していた。@fontsourceパッケージを使用してフォントをローカルホスティングに変更し、外部CDNへの依存を排除することでこのちらつきを軽減。

**実装内容**
- [x] @fontsourceパッケージをインストール（Plus Jakarta Sans, Space Grotesk, Noto Sans JP, Material Symbols Outlined）
- [x] `root.tsx` でGoogle Fonts CDNリンクを削除し、@fontsourceのインポートに置き換え
- [x] フォントファイルがビルド成果物に正しく含まれることを確認

**受け入れ基準**
- [x] ページ初回ロード時のアイコンちらつきが軽減される
- [x] 全ページでアイコンが正しく表示される
- [x] 既存のビルド・テストが全パス（109テスト全成功）

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
