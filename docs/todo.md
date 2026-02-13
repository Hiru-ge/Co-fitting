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

### Issue: ルーティング設定（Gin）✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/13
**タスク**: Gin ルーターにエンドポイントを集約

### Issue: Google Places Photo API 統合 — 施設画像取得エンドポイント実装
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **Phase**: Phase 0
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/52

**タスク概要**
Google Places Photo API を使用して、施設の写真URL を取得。バックエンド新規エンドポイントを実装し、メイン発見画面・履歴画面での画像表示に対応。

**参考資料**
- [Google Places Photo API ドキュメント](https://developers.google.com/maps/documentation/places/web-service/place-photos?hl=ja)
- [Google Places API 概要](https://developers.google.com/maps/documentation/places/web-service/overview?hl=ja)

**実装内容**

**A. バックエンド（Go）実装**
- [ ] `handlers/place_photo.go` 作成
  - GET `/api/places/:placeId/photo` エンドポイント実装
  - リクエスト: `placeId` をパラメータで受け取る、オプションで `maxWidth` / `maxHeight`
  - レスポンス: 画像URL を JSON で返却
    ```json
    {
      "photoUrl": "https://lh3.googleusercontent.com/..."
    }
    ```
  - Google Places API Photo エンドポイントを呼び出し（APIキー認証）
  - キャッシング機能（Redis）で同じ施設の重複取得を最適化（TTL: 24h）

- [ ] `utils/google_places.go` 拡張
  - 既存の `getSuggestions()` に並行して、`getPlacePhoto()` 関数を追加
  - Google Places Photo API 呼び出しロジック実装
  - エラーハンドリング（写真なし施設、API失敗時はデフォルト画像URL を返す）

- [ ] `routes.go` 更新
  - GET `/api/places/:placeId/photo` ルートを追加

- [ ] テスト実装
  - `handlers/place_photo_test.go` で単体テスト

**B. フロントエンド（React）対応**
- [ ] `app/api/places.ts` 作成
  ```typescript
  export async function getPlacePhoto(
    placeId: string,
    token: string,
    maxWidth?: number,
    maxHeight?: number
  ) {
    const query = new URLSearchParams();
    if (maxWidth) query.append('maxWidth', maxWidth.toString());
    if (maxHeight) query.append('maxHeight', maxHeight.toString());
    return apiCall(
      `/api/places/${placeId}/photo${query.toString() ? '?' + query.toString() : ''}`,
      token
    );
  }
  ```

- [ ] `app/components/discovery-card.tsx` 更新
  - 画像URL を取得 → `<img>` で表示
  - 読み込み中: スケルトンローダー表示
  - 取得失敗時: カテゴリ別グラデーション背景をフォールバック

- [ ] `app/routes/history.tsx` 更新
  - 訪問履歴アイテムに施設画像を表示
  - 投稿済みデータをDB から取得時に画像URL も一緒に取得

**受け入れ基準**
- [ ] バックエンドの GET `/api/places/:placeId/photo` が実装される
- [ ] Google Places Photo API から画像URL が取得される
- [ ] 画像なし / API エラー時はグレースフルフォールバック
- [ ] Redis キャッシュ機能で同一施設の重複呼び出しを削減
- [ ] フロント: discovery-card / history で画像が表示される
- [ ] テスト: バックエンド単体テスト 成功、フロントエンドスナップショット確認

---

### Issue: 開発用：提案キャッシュリセット・管理エンドポイント実装
**優先度**: 🟡 Medium | **工数**: 1h | **担当**: 個人 | **Phase**: Phase 0
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/53

**タスク概要**
開発時に施設の提案キャッシュをリセット・管理するための開発者向けエンドポイントを実装。
同じ提案が繰り返される状況を回避し、開発効率を向上させる。

**参考資料**
- Redis キャッシュキー設計
- Gin ルートハンドラー実装

**実装内容**

**A. バックエンド（Go）実装**
- [x] `handlers/dev_handler.go` 作成
  - DELETE `/api/dev/suggestions/cache` — 提案キャッシュ全削除
    ```json
    {
      "message": "提案キャッシュをリセットしました",
      "deletedCount": 5
    }
    ```
  - GET `/api/dev/suggestions/stats` — 提案統計情報取得
    ```json
    {
      "cachedCount": 3,
      "lastRefreshed": "2024-02-13T10:30:00Z",
      "cacheSize": "2.5KB"
    }
    ```

- [x] `routes.go` 更新
  - 開発環境フラグチェック（`os.Getenv("ENVIRONMENT") == "development"`）
  - デバッグルートを登録

- [x] Redis キャッシュキー設計の見直し
  - キャッシュキーのパターンを統一（例：`suggestion:user:{userID}:*`）
  - キャッシュリセット時に複数キーに対応

- [x] テスト実装
  - `handlers/dev_handler_test.go` で単体テスト
  - 本番環境でエンドポイントが無効化されることを確認

**B. フロントエンド（React）— 開発ユーティリティ（オプション）**
- [x] `app/utils/devTools.ts` 作成（開発環境のみ）
  ```typescript
  export async function resetSuggestionCache(token: string) {
    return apiCall('/api/dev/suggestions/cache', token, { method: 'DELETE' });
  }

  export async function getSuggestionStats(token: string) {
    return apiCall('/api/dev/suggestions/stats', token);
  }
  ```

**受け入れ基準**
- [x] DELETE `/api/dev/suggestions/cache` が提案キャッシュをリセットする
- [x] GET `/api/dev/suggestions/stats` が統計情報を返却する
- [x] 開発環境（`ENVIRONMENT=development`）でのみエンドポイントが有効
- [x] 本番環境では 404 を返す
- [x] テスト: `npm test` で handler テスト成功

---

### Issue: 提案キャッシュの日次持続化 — 1日間同じ3施設を表示
**優先度**: 🔴 High | **工数**: 2.5h | **担当**: 個人 | **Phase**: Phase 0

**タスク概要**
現在、ページをリロードすると異なる3施設が出てしまい、ユーザー体験が損なわれている。
1日の間は常に同じ3施設を提案するようにキャッシュ機構を改善。Redis を活用して、ユーザー・日付・位置情報をキーにした日次キャッシュを実装。

**参考資料**
- Redis キャッシュキーの設計
- TTL（Time To Live）の活用

**実装内容**

**A. バックエンド（Go）実装**

- [ ] `handlers/suggestion.go` 更新
  - GET `/api/suggestions` エンドポイントを改良
  - キャッシュの存在チェック → あれば返却、なければ取得
  - 3施設取得時にそれを日次キャッシュに保存

- [ ] `database/redis.go` 拡張
  - `GetDailySuggestions(userID, date string, latitude, longitude float64) ([]Place, error)` 関数作成
    - キャッシュキー: `suggestion:daily:{userID}:{date}:{lat}_{lng}` （例：`suggestion:daily:user123:2026-02-13:35.68_139.69`）
    - キャッシュに存在 → []Place を返す
    - キャッシュに未存在 → nil を返す
  
  - `SetDailySuggestions(userID, date string, latitude, longitude float64, places []Place, ttl time.Duration) error` 関数作成
    - 3施設の配列を JSON 化してキャッシュに保存
    - TTL: 24時間（次の日付に変わるまで）
    
  - `ClearDailySuggestionsCache(userID string) error` 関数作成（デバッグ用）
    - ユーザー単位で日次キャッシュをクリア

- [ ] キャッシュキーの論理
  ```go
  const DailySuggestionCacheKey = "suggestion:daily:%s:%s:%.2f_%.2f"
  // userID, 日付(YYYY-MM-DD), 緯度, 経度
  ```
  
- [ ] 日付取得の統一
  - Go 側で常に `time.Now().Format("2006-01-02")` で日付を取得（時刻は考慮しない）

- [ ] Google Places API 呼び出しロジックの最適化
  - キャッシュの3施設が存在 → API 呼び出し スキップ
  - キャッシュの3施設が未取得 → Google Places API から3施設を取得

- [ ] テスト実装
  - `database/redis_test.go` で キャッシュ READ / WRITE / CLEAR のテスト
  - キャッシュヒット / ミスのシナリオ確認

**B. フロントエンド（React）対応**

- [ ] `app/api/suggestions.ts` 更新
  - getSuggestion() の呼び出し元では、複数呼び出しからの重複排除ロジックを簡略化可能
  - バックエンドで日次キャッシュが担保されるため、フロント側での余分な重複チェックは削減

**C. 開発者向け デバッグ**

- [ ] DELETE `/api/dev/suggestions/cache` の拡張
  - 既存: 全キャッシュ削除
  - 改良: 日次キャッシュもクリア可能にする実装確認（既に対応していれば OK）

**受け入れ基準**

- [ ] バックエンドで `GetDailySuggestions()` 関数が実装される
- [ ] ページ初回訪問 → Google Places API から3施設取得 → Redis に日付キーで保存
- [ ] ページリロード → Redis キャッシュから同じ3施設を取得（API 呼び出し スキップ）
- [ ] 日付が変わった時点（00:00）→ キャッシュ有効期限切れ → 新しい3施設を取得
- [ ] 位置情報が大きく変わった場合 → 新しいキャッシュキーで新施設取得
- [ ] Redis キャッシュの TTL が正確に 24h で動作
- [ ] テスト: `go test ./database -v` でキャッシュテスト成功

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

### Issue: ランディングページ実装（React） — / (未認証)
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/24
**優先度**: 🟡 Medium | **工数**: 1.5h | **担当**: 個人 | **テスト駆動**: スナップショットテスト

**タスク概要**
未認証ユーザー向けのランディングページを実装。Roambleの価値提案を簡潔に表示し、サインアップ・ログインへの導線を確保。
文言などは、https://hiruge.notion.site/roamble-lp を踏襲する。

**実装内容**

**画面デザイン要件**
- ヒーロー画像 / ロゴ
- タイトル・サブタイトル（価値提案）
- CTA ボタン: 「さっそく始める」（/signup）、「ログイン」（/login）

**コンポーネント構成**
- [ ] `app/routes/index.tsx` 作成
  - ランディングページのメイン実装
  - クライアントのみ（loaderなし）
  - 認証ユーザーの場合は `/home` へリダイレクト（条件分岐を検討）

**TDD プロセス**
- [ ] `app/__tests__/routes/index.test.tsx` を作成
- 🔴 未認証ユーザーがランディングページの全要素を見る
- 🟢 コンポーネント実装完成
- 🔵 レスポンシブ確認

**受け入れ基準**
- [ ] http://localhost:5173 にアクセス → ランディングページが表示される
- [ ] 「さっそく始める」をクリック → `/signup` へ遷移
- [ ] 「ログイン」をクリック → `/login` へ遷移
- [ ] 認証済みユーザーがアクセス → `/home` へリダイレクト

---

### Issue: サインアップ画面実装（React） — /signup
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/25
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ユーザー登録画面を実装。メール・パスワード・表示名の入力フォームを設置。バックエンド auth.go の SignUp API と連携。

**実装内容**

**画面デザイン要件**（`docs/screen-design` 参照 — 認証レイアウトを踏襲）
- フォーム要素
  - メールアドレス入力
  - パスワード入力（強度表示）
  - 表示名入力
  - 利用規約への同意チェックボックス
- ボタン
  - 「サインアップ」ボタン（押下時にローディング表示）
  - 「ログインはこちら」リンク（/login）

**コンポーネント構成**
- [x] `app/routes/signup.tsx` 作成
  - フォーム構築（React Form Hook / useReducer）
  - バリデーション実装
    - メール形式チェック（簡易）
    - パスワード（8文字以上）
    - 表示名（1文字以上）
  - API 呼び出し
    - `app/api/auth.ts` の SignUp 関数を使用
    - エラーハンドリング（メール重複、ネットワークエラー）
  - 成功時は JWT を取得して localStorage 保存 → `/home` へリダイレクト

**TDD プロセス**
- [x] `app/__tests__/routes/signup.test.tsx` を作成
- 🔴
  ```typescript
  test("フォーム送信 → SignUp API call → /home へ遷移", () => {});
  test("メール重複 → エラーメッセージ表示", () => {});
  test("バリデーションエラー → 送信ボタン無効", () => {});
  ```
- 🟢 実装完成
- 🔵 エラーハンドリング改善

**受け入れ基準**
- [x] フォーム入力 → 「サインアップ」ボタン → バックエンド SignUp API が実行される
- [x] バックエンダから JWT 返却 → トークン保存 → `/home` へリダイレクト
- [x] メール重複時 → 409 エラーメッセージ表示
- [x] バリデーションエラー → UI で示唆

---

### Issue: ログイン画面実装（React） — /login
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/26
**優先度**: 🔴 High | **工数**: 1.5h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ログイン画面を実装。メール・パスワード入力でバックエンド Login API と連携。

**実装内容**

**画面デザイン要件**（認証レイアウトを踏襲）
- フォーム要素
  - メールアドレス入力
  - パスワード入力
  - 「パスワードを忘れた」リンク（Phase 1 で実装）
- ボタン
  - 「ログイン」ボタン
  - 「新規登録」リンク（/signup）

**コンポーネント構成**
- [x] `app/routes/login.tsx` 作成
  - フォーム構築
  - バリデーション（メール + パスワード必須）
  - API 呼び出し
    - `app/api/auth.ts` の Login 関数を使用
    - エラーハンドリング（ユーザー不存在、パスワード不一致）
  - 成功時は JWT 保存 → `/home` へリダイレクト

**TDD プロセス**
- [x] `app/__tests__/routes/login.test.tsx` を作成
- 🔴
  ```typescript
  test("正しい認証情報 → JWT 取得 → /home へ遷移", () => {});
  test("ユーザー不存在 → 401 エラーメッセージ", () => {});
  test("パスワードエラー → 401 エラーメッセージ", () => {});
  ```
- 🟢 実装完成
- 🔵 UX 改善

**受け入れ基準**
- [x] メール + パスワード入力 → ログイン成功 → JWT 保存 → `/home` へリダイレクト
- [x] 認証失敗 → エラーメッセージ表示
- [x] テスト成功

---

### Issue: メイン発見画面実装（React） — /home（提案表示） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/27
**優先度**: 🔴 High | **工数**: 4h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
Roamble のコア画面。Google Places API の提案施設をカード表示し、スキップで次のカード、「行ってきた！」で訪問記録を行う。

**コア仕様（提案カードシステム）**
- **3枚取得**: ページ訪問時に `getSuggestion()` を3回呼び出し、重複除外で3枚取得（MAX_ATTEMPTS=10）
- **カード循環**: 3枚目をスキップすると1枚目に戻る（1→2→3→1→...のループ）
- **訪問記録**: 各カードに「行ってきた！」ボタンを配置。どのカードからでも訪問記録可能
- **記録済み表示**: 訪問記録済みのカードには記録済みマーク（チェックアイコン オーバーレイ）を表示

**仕様からの変更点**
- カード背景: 施設画像ではなくカテゴリ別グラデーション + アイコン（写真なし）
- API: `getSuggestion()` は単一の `Place` を返す（`Place[]` ではない）。フロントから3回呼び出して3枚取得
- スワイプ: 左右どちらも同じ「スキップ」動作（`onSwipe` に統一）。ドラッグでカードが追従し、背景に「SKIP」テキストが表示される
- ボトムナビゲーション: 共通レイアウト（`app-layout.tsx`）に実装済みのため、home.tsx には含めない
- コンポーネント名: `suggestion-card.tsx` → `discovery-card.tsx` に変更

**実装ファイル**

| 操作 | ファイル |
|------|---------|
| 修正 | `app/api/suggestions.ts` — 戻り値型 `Place[]` → `Place` |
| 新規 | `app/utils/category-map.ts` — Google Places types → 日本語ラベル/アイコン/グラデーション（24カテゴリ） |
| 新規 | `app/utils/geolocation.ts` — GPS取得 + フォールバック + Haversine距離計算 |
| 新規 | `app/components/discovery-card.tsx` — グラデーション背景カード + ドラッグスワイプ |
| 新規 | `app/components/card-indicator.tsx` — ドットインジケーター |
| 新規 | `app/components/action-buttons.tsx` — 行ってきた！/ スキップボタン |
| 書換 | `app/routes/home.tsx` — コア画面全面実装 |
| 新規 | `app/__tests__/utils/category-map.test.ts` — 5テスト |
| 新規 | `app/__tests__/utils/geolocation.test.ts` — 6テスト |
| 新規 | `app/__tests__/routes/home.test.tsx` — 5テスト |

**TDD プロセス**

**🔴 RED PHASE** ✅
- [x] `app/__tests__/routes/home.test.tsx` 作成（5テスト RED確認済み）
- [x] `app/__tests__/utils/category-map.test.ts` 作成（5テスト）
- [x] `app/__tests__/utils/geolocation.test.ts` 作成（6テスト）

**🟢 GREEN PHASE** ✅
- [x] 上記実装完成（全48テスト通過）

**🔵 REFACTOR PHASE** ✅
- [x] ドラッグアニメーション実装（カードがポインターに追従 + 回転 + フェードアウト）
- [x] 背景SKIPヒント実装（ドラッグ量に応じてフェードイン）
- [x] ヘッダーレイアウト改善（vicinity長さに依存しない固定配置）

**受け入れ基準**
- [x] `npm run dev` でページ表示 → 提案カード3枚のうち1枚目が表示される
- [x] スキップ → 次のカードへ遷移（3枚目→1枚目のループ）
- [x] カードインジケーター（● ○ ○）で現在位置が分かる
- [x] 「行ってきた！」ボタン → 訪問記録API実行 → カードに記録済みマーク
- [x] 記録済みカードでは「行ってきた！」ボタンが無効化される
- [x] GPS 取得成功 → 現在地表示 / 失敗 → 渋谷にフォールバック
- [x] ドラッグスワイプ（左右どちらもスキップ）
- [x] `npm test` 全48テスト通過、`npm run typecheck` 型エラーなし

---

### Issue: 訪問履歴画面実装（React） — /history
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/28
**優先度**: 🟡 Medium | **工数**: 2.5h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
これまでの訪問記録を一覧表示。日付でグループ化し、ジャンル別フィルター機能を実装。
**デザイン**: `docs/screen-design/履歴画面/code.html` に忠実に実装

**実装内容**

**画面デザイン要件**
- ヘッダー
  - 戻るボタン
  - タイトル「これまでの旅路」
  - 検索ボタン
- フィルタータブ（横スクロール）
  - 「すべて」（デフォルト）
  - カテゴリ別: カフェ / 公園 / 観光 など
- 訪問履歴リスト
  - 日付でグループ化（「2024年2月」など）
  - 各アイテム:
    - 施設画像（サムネイル）
    - 施設名
    - 位置情報
    - 訪問日時
    - XP（Phase 1）表示

**コンポーネント構成**

**A. `app/routes/history.tsx`（ページ本体）**
- [ ] loader で訪問履歴取得（ページネーション対応）
- [ ] フィルター状態管理（選択カテゴリ）
- [ ] 日付グループ化ロジック
- [ ] 無限スクロール / ページネーション実装

**B. `app/components/visit-history-item.tsx`（履歴アイテム）**
```typescript
interface VisitHistoryItemProps {
  visit: {
    placeId: string;
    placeName: string;
    category: string;
    imageUrl: string;
    address: string;
    visitedAt: Date;
    xp?: number;
  };
}
```

**API連携**
- [ ] `app/api/visits.ts` に listVisits() 実装
  ```typescript
  export async function listVisits(
    token: string,
    limit: number = 20,
    offset: number = 0,
    category?: string // フィルター
  ) {
    const query = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (category) query.append('category', category);
    return apiCall(`/api/visits?${query}`, token);
  }
  ```

**フィルター・検索**
- [ ] カテゴリフィルター → API に category パラメータ送信
- [ ] 検索ボタン → 検索入力モーダル（Phase 1）

**日付グループ化**
- [ ] ローカルで訪問データをグループ化
  ```typescript
  const groupedByDate = groupBy(visits, (v) => format(v.visitedAt, 'yyyy年M月'));
  ```

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `app/__tests__/routes/history.test.tsx` 作成
  ```typescript
  test("ページ読み込み → 訪問履歴リスト表示", () => {});
  test("カテゴリフィルター → リスト更新", () => {});
  test("日付でグループ化", () => {});
  test("無限スクロール → 追加読み込み", () => {});
  ```

**🟢 GREEN PHASE**
- [ ] 上記実装完成

**🔵 REFACTOR PHASE**
- [ ] アニメーション追加
- [ ] パフォーマンス最適化（仮想スクロール検討）

**受け入れ基準**
- [ ] ページ読み込み → 訪問履歴が表示される
- [ ] フィルター選択 → リスト動的更新
- [ ] 日付でグループ化表示
- [ ] design に忠実なスタイル
- [ ] スクロール可能

---

### Issue: ユーザープロフィール画面実装（React） — /profile（簡易版 Phase 0）
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
- ユーザー統計（簡易）
  - 訪問スポット数
  - 訪問開始日
  - ボタン: ログアウト

**コンポーネント構成**

**A. `app/routes/profile.tsx`（ページ本体）**
- [ ] loader で User 情報 + 訪問統計情報取得
- [ ] ユーザー情報表示
- [ ] ログアウト機能実装

**API連携**
- [ ] `app/api/users.ts` を新規作成
  ```typescript
  export async function getUserStats(token: string) {
    return apiCall('/api/users/stats', token); // バックエンドから実装予定
  }
  ```

**ログアウト処理**
- [ ] 「ログアウト」ボタン押下 → 確認モーダルを表示（「ログアウトしますか？」）
- [ ] モーダルの「ログアウトする」ボタン → clearToken() 実行 → localStorage クリア → `/login` へリダイレクト
- [ ] モーダルの「キャンセル」ボタン → モーダルを閉じるのみ（何もしない）

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `app/__tests__/routes/profile.test.tsx` 作成
  ```typescript
  test("ユーザー情報表示", () => {});
  test("ログアウトボタン → 確認モーダル表示", () => {});
  test("モーダル「ログアウトする」→ 認証情報削除 → /login へ遷移", () => {});
  test("モーダル「キャンセル」→ モーダルが閉じる", () => {});
  ```

**🟢 GREEN PHASE**
- [ ] 上記実装完成

**🔵 REFACTOR PHASE**
- [ ] スタイル調整

**受け入れ基準**
- [ ] loader で User 情報取得後、画面に表示される
- [ ] ログアウトボタン → localStorage クリア → `/login` へリダイレクト
- [ ] JWT なしでアクセス → `/login` へリダイレクト

---

### Issue: 共通レイアウト・コンポーネント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/31
**優先度**: 🟡 Medium | **工数**: 1.5h | **担当**: 個人

**タスク概要**
フロントエンド全体で使用する共通レイアウト・コンポーネントを実装。

**実装内容**

**A. `app/layouts/app-layout.tsx`（アプリ画面用レイアウト）**
- [x] ボトムナビゲーション統合
- [x] ヘッダースロット（各ページが独自ヘッダーを配置する flex-col 構造）
  - `app/components/app-header.tsx` 作成済み（位置情報ピル + ロゴ + プロフィールリンク）
  - 画面ごとにヘッダーが異なるためレイアウトには固定配置しない
    - `/home`: `<AppHeader />` を使用（TopAppBar）
    - `/history`: 独自ヘッダー（戻るボタン + 「これまでの旅路」 + 検索）
    - `/profile`: 独自ヘッダー
- [x] Outlet で各ページを読み込み

**B. `app/layouts/auth-layout.tsx`（認証画面用レイアウト）**
- [x] 中央配置フォーム
- [x] ロゴ / タイトル配置
- [x] Outlet で各ページを読み込み

**C. `app/components/bottom-nav.tsx`（既記載）**
- [x] 3タブ実装
- [x] アクティブ状態表示

**D. `app/types/` 作成**
- [x] `auth.ts` - 認証関連の型定義
- [x] `suggestion.ts` - 施設提案の型定義
- [x] `visit.ts` - 訪問履歴の型定義

**E. `app/utils/` 作成**
- [x] `constants.ts` - API URL等の定数
- [x] `helpers.ts` - フォーマット・ユーティリティ関数

**受け入れ基準**
- [x] 各レイアウトが正常に機能
- [x] 型定義が全ページで利用可能

---

### Issue: Tailwind CSS カラーパレット・レスポンシブ設定　✅完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/32
**タスク**　Tailwind CSS を screen-design のデザインに合わせて設定。カラーパレット・タイポグラフィ・ブレークポイントを定義。

---

### Issue: API エラーハンドリング・バリデーション統一
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/33
**優先度**: 🟡 Medium | **工数**: 1.5h | **担当**: 個人

**タスク概要**
バックエンド API のエラー応答に対応する統一的なエラーハンドリング・ユーザー通知を実装。

**実装内容**

**A. `app/api/client.ts` 拡張**
- [ ] HTTP Status Code 別の処理
  - 401 Unauthorized → `/login` へリダイレクト
  - 409 Conflict → ユーザーへのエラーメッセージ（メール重複など）
  - 500 Server Error → リトライ提案

**B. `app/utils/error.ts` 作成**
- [ ] エラー型定義
  ```typescript
  interface ApiError {
    status: number;
    message: string;
    code?: string;
  }
  ```
- [ ] エラー変換関数

**C. `app/components/toast.tsx` 実装（軽量版）**
- [ ] エラー / 成功メッセージ表示
- [ ] 自動クローズ（3秒）

**D. 各ページでのエラー処理**
- [ ] signup / login / home / history / profile で try-catch 実装
- [ ] エラー時 UI フィードバック

**受け入れ基準**
- [ ] API エラー時、ユーザーにわかりやすいメッセージが表示される
- [ ] 認証エラー → `/login` へ自動リダイレクト
- [ ] ネットワークエラー → リトライオプション表示

---

### Issue: フロントエンド E2E テスト（Playwright）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/30
**優先度**: 🟢 Low | **工数**: 2h | **担当**: 個人 | **Phase 0 完了後の検証用**

**タスク概要**
signup → login → home → history の主要フローを E2E テストで検証。

**実装内容**

**A. Playwright 環境セットアップ**
- [ ] `npm install @playwright/test`
- [ ] `playwright.config.ts` 作成

**B. `e2e/main-flow.spec.ts` 作成**
- [ ] ランディング → signup → ログイン → home → history → ログアウト
- [ ] 主要ユーザーフロー

**受け入れ基準**
- [ ] `npm run test:e2e` でテスト実行可能
- [ ] すべてのテスト 成功

---

## フロントエンド実装チェックリスト（Phase 0 完了時）

| タスク | 状態 |
|--------|------|
| React Router v7 セットアップ | ✅ 実装予定 |
| ルーティング設定 | ✅ 実装予定 |
| 認証状態管理・clientLoader | ✅ 完了 |
| ランディングページ | ⬜ TODO |
| サインアップ画面 | ⬜ TODO |
| ログイン画面 | ⬜ TODO |
| メイン発見画面 | ✅ 完了 |
| 履歴画面 | ⬜ TODO |
| マイページ | ⬜ TODO |
| 共通コンポーネント・レイアウト | ✅ 完了 |
| Tailwind 設定 | ✅ 完了 |
| エラーハンドリング | ⬜ TODO |
| E2E テスト | ⬜ TODO |
