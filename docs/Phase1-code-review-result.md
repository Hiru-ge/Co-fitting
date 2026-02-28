# Phase 1 コードレビュー結果

**レビュー実施日**: 2026年2月28日
**対象フェーズ**: Phase 1（ドッグフーディング中）
**レビュー範囲**: バックエンド（Go/Gin）、フロントエンド（React/TypeScript）、インフラ・設定ファイル

---

## サマリー

| 領域 | Critical | High | Medium | Low | 合計 |
|------|----------|------|--------|-----|------|
| バックエンド | 3 | 5 | 10 | 8 | 26 |
| フロントエンド | 0 | 5 | 7 | 5 | 17 |
| インフラ・設定 | 2 | 5 | 7 | 5 | 19 |
| **合計** | **5** | **15** | **24** | **18** | **62** |

### 良い点（全体）

- APIレイヤーの関心分離が明確（フロントエンド `api/*.ts`、バックエンド handler→service の層構造）
- テストカバレッジが充実（全ルート・全コンポーネント・主要ハンドラーにテストあり）
- E2Eテストが主要フローを網羅
- アクセシビリティ対応が全体的に良好（`role="dialog"`, `aria-label`, `aria-pressed` 等）
- エラーメッセージの日本語化とToast通知が統一されている
- ゲーミフィケーションロジックがサービス層に集約
- JWT認証・リフレッシュトークンの仕組みが堅実

---

## 1. バックエンド（Go/Gin）

### Critical（致命的）

#### BE-C1: `SeedMasterData` の二重呼び出し
- **ファイル**: `backend/main.go` / `backend/database/migrate.go`
- **カテゴリ**: 設計 / パフォーマンス
- **説明**: `main.go` で `database.Migrate(db)` を呼んだ後、さらに `database.SeedMasterData(db)` を明示的に呼んでいるが、`Migrate()` 内部でも既に `SeedMasterData()` を呼んでいる。起動毎にseedが2回実行される。`FirstOrCreate` なので動作上は壊れないが、無駄なDBクエリが33件余計に走る。
- **修正案**: `main.go` から `SeedMasterData(db)` の呼び出しを削除する。

#### BE-C2: `DeleteMe` がユーザー関連データを不完全に削除
- **ファイル**: `backend/handlers/user.go`
- **カテゴリ**: セキュリティ / エラーハンドリング
- **説明**: `h.DB.Delete(&models.User{}, userID)` のみでアカウント削除しているが、CASCADE制約にデータ削除を完全に依存している。Redis上のキャッシュ（提案キャッシュ、ブラックリストなど）は削除されない。また、削除後もJWTアクセストークンが有効期限まで使える（ブラックリストに追加していない）。
- **修正案**: (1) Redis上のユーザー関連キャッシュを削除する。(2) 現在のアクセストークンをブラックリストに追加する。(3) トランザクション内で関連テーブルを明示的に削除することも検討。

#### BE-C3: `jst` 変数のDRY違反
- **ファイル**: `backend/handlers/visit.go` / `backend/services/gamification.go`
- **カテゴリ**: 設計 / DRY
- **説明**: `var jst = time.FixedZone("Asia/Tokyo", 9*60*60)` が2箇所で独立に定義されている。変更時に片方の更新漏れリスクがある。
- **修正案**: 共通パッケージ（例: `utils`）に `var JST = time.FixedZone("Asia/Tokyo", 9*60*60)` を定義して共通利用する。

---

### High（高）

#### BE-H1: `ProcessGamification` 内でユーザーを3回読み取り & 2回更新
- **ファイル**: `backend/services/gamification.go`
- **カテゴリ**: パフォーマンス
- **説明**: 1トランザクション内で `tx.First(&user, userID)` を2回、`tx.Model(...).Updates(...)` を2回実行。`UpdateStreak` 内部でもさらに `db.First(&user, userID)` があり、ユーザーテーブルへのクエリが合計3回。
- **修正案**: ストリーク更新ロジックを `ProcessGamification` 内に統合するか、クエリをまとめて1回に削減する。

#### BE-H2: `CheckAndAwardBadges` が全訪問データを全件取得
- **ファイル**: `backend/services/gamification.go`
- **カテゴリ**: 設計 / パフォーマンス
- **説明**: 全訪問データを `SELECT lat, lng, visited_at` で全件取得し、Go側ループで走査している。`ProcessGamification` 内で既に同様のクエリ（`prevVisits`）を実行しており重複ロードでもある。`weekend_visits` 判定もGo側ループで全件走査。
- **修正案**: (1) `isFirstArea` の結果を引数で渡す。(2) `weekend_visits` はSQL `WHERE DAYOFWEEK(visited_at) IN (1, 7)` に置き換える。

#### BE-H3: レートリミッターのGCでデッドロックリスク
- **ファイル**: `backend/middleware/rate_limit.go`
- **カテゴリ**: パフォーマンス / 設計
- **説明**: `gcIfNeeded()` は `rl.mu` を保持した状態で呼ばれるが、GC対象の各エントリの `e.mu.Lock()` も取得する。高負荷時にロック保持時間が長くなり、他のリクエストがブロックされる。
- **修正案**: GCを別goroutineで定期実行するか、ロック粒度を見直す。

#### BE-H4: エラーメッセージの言語が混在
- **ファイル**: 複数ハンドラー全体
- **カテゴリ**: 可読性 / 設計
- **説明**: エラーレスポンスが英語（`"user not authenticated"`）と日本語（`"本日の訪問上限（3件）に達しました"`）で混在。フロントエンドでのエラー表示方針が不明瞭。
- **修正案**: エラーは英語 `code` フィールドで識別し、ユーザー向け日本語メッセージはフロントエンドで生成するか、言語を統一する。

#### BE-H5: `Logout` で `c.ShouldBindJSON` がボディ未送信時にエラーを無視
- **ファイル**: `backend/handlers/auth.go`
- **カテゴリ**: エラーハンドリング
- **説明**: ボディが空（`EOF`）のときとJSONが不正なときの区別ができない。結果的に動作するが意図が不明瞭。
- **修正案**: `io.EOF` エラーを明示的にチェックし、コメントで意図を説明する。

---

### Medium（中）

#### BE-M1: `suggestion.go` が762行で巨大すぎる
- **ファイル**: `backend/handlers/suggestion.go`
- **カテゴリ**: 可読性 / 設計（SRP違反）
- **説明**: Places APIクライアント実装、型定義、ジャンルマッピング、パーソナライズロジック、キャッシュ管理がすべて1ファイルに集約。
- **修正案**: `GooglePlacesClient` を `services/places.go` に分離、マッピングを `models/` に分離。

#### BE-M2: `visitableTypes` と `placeTypeToGenreName` のキーが不一致
- **ファイル**: `backend/handlers/suggestion.go`
- **カテゴリ**: 設計
- **説明**: `visitableTypes` には `"stadium"` があるが `placeTypeToGenreName` にマッピングがない。ジャンルタグが解決できず `genreName` が空文字になる。
- **修正案**: 両マッピングの整合性を確認・修正する。

#### BE-M3: `GetMapData` / `ListVisits` でDBエラーを無視
- **ファイル**: `backend/handlers/visit.go`
- **カテゴリ**: エラーハンドリング
- **説明**: `h.DB.Where(...).Find(&visits)` の戻り値を変数に受けておらず、エラーチェック未実施。DBエラー時にも空配列で正常レスポンスが返る。
- **修正案**: `result.Error` のチェックを追加する。

#### BE-M4: `UpdateVisit` がDB更新後に古いオブジェクトを返す
- **ファイル**: `backend/handlers/visit.go`
- **カテゴリ**: エラーハンドリング
- **説明**: `Updates` 後に `visit` をそのまま返しているが、`UpdatedAt` などが元の値のまま返る可能性がある。
- **修正案**: 更新後に `h.DB.First(&visit, visitID)` で再取得する。

#### BE-M5: `database.DB` グローバル変数のDI移行が不完全
- **ファイル**: `backend/database/db.go`
- **カテゴリ**: 設計
- **説明**: グローバル変数 `DB` が残っており、`Close()` もグローバル変数を使用中。
- **修正案**: Phase 1完了後にDI移行を完了する（TODOとして管理）。

#### BE-M6: `RedisClient` もグローバル変数パターン
- **ファイル**: `backend/database/redis.go`
- **カテゴリ**: 設計
- **説明**: `DB` と同じく `RedisClient` もグローバル変数パターン。
- **修正案**: DI移行と合わせて対応。

#### BE-M7: `IncrementDailyReloadCount` で `Expire` エラーを無視
- **ファイル**: `backend/database/redis.go`
- **カテゴリ**: エラーハンドリング
- **説明**: `client.Expire(ctx, key, ttl)` の戻り値を無視。失敗するとキーが永続化し、翌日以降もリロード回数が蓄積し続ける。
- **修正案**: エラーを伝播する。

#### BE-M8: `PlacePhotoHandler` のDRY違反
- **ファイル**: `backend/handlers/place_photo.go`
- **カテゴリ**: DRY
- **説明**: `resolveNewAPIPhotoURL` と `resolveLegacyPhotoURL` でHTTP呼び出し・リダイレクト解決のロジックが完全に重複。
- **修正案**: 共通の `followRedirect(url)` メソッドに統合する。

#### BE-M9: `testutil.LoadTestEnv` のパス解決がハードコード
- **ファイル**: `backend/testutil/db.go`
- **カテゴリ**: 設計
- **説明**: `runtime.Caller` でプロジェクトルートを解決しているが、ファイル構造変更で壊れる。`os.Setenv` でグローバル環境変数を書き換えるため並列テストに安全でない。
- **修正案**: `t.Setenv` を使ってテスト終了後に自動復元する。

#### BE-M10: `CreateVisit` で `XpEarned` を手動上書き
- **ファイル**: `backend/handlers/visit.go`
- **カテゴリ**: 設計
- **説明**: レスポンス用のモデルとDBモデルが同一オブジェクトで、`visit.XpEarned = gamifResult.XPEarned` と直接変更しており意図が不明瞭。
- **修正案**: レスポンス用の構造体を分離する。

---

### Low（低）

#### BE-L1: `config.go` が設定を集約していない
- **ファイル**: `backend/config/config.go`
- **カテゴリ**: 設計
- **説明**: JWT設定のみを管理。DB・Redis・Places APIの設定は環境変数から直接読み取り。
- **修正案**: 設定が増えたタイミングで統合する（YAGNI的に現時点では許容）。

#### BE-L2: `Migrate` 内のカラム削除が恒久コード化
- **ファイル**: `backend/database/migrate.go`
- **カテゴリ**: YAGNI / 可読性
- **説明**: `latitude`, `longitude`, `password_hash` カラム削除が毎起動時に実行される。
- **修正案**: 全環境で適用済みなら削除する。

#### BE-L3: `defaultSearchRadius` と `minSearchRadius` の値重複
- **ファイル**: `backend/handlers/suggestion.go` / `backend/handlers/user.go`
- **カテゴリ**: DRY
- **説明**: 同じ値 `3000` だが別定数。変更時に不整合のリスク。
- **修正案**: 依存関係をコメントで明示する。

#### BE-L4: `ErrorHandler` ミドルウェアが事実上デッドコード
- **ファイル**: `backend/middleware/error_handler.go`
- **カテゴリ**: YAGNI
- **説明**: ハンドラーが `c.JSON()` で直接レスポンスを返しており、`c.Error()` を使うハンドラーがない。
- **修正案**: 削除するか、活用パターンに移行する。

#### BE-L5: `GetPhoto` のキャッシュキーに `maxWidth` が含まれない
- **ファイル**: `backend/handlers/place_photo.go`
- **カテゴリ**: 設計
- **説明**: 異なる `maxWidth` でリクエストしても最初にキャッシュされたURLが返される。
- **修正案**: キャッシュキーに `maxWidth` を含める。

#### BE-L6: テストカバレッジの確認が必要
- **ファイル**: テスト全般
- **カテゴリ**: テスト
- **説明**: `ProcessGamification` の複雑なビジネスロジックに対するエッジケーステスト（ストリーク境界値、レベルアップ境界値、バッジ重複付与防止など）の充実度を確認すべき。
- **修正案**: テストカバレッジレポートを生成し、ゲーミフィケーション周りを重点的に補完する。

#### BE-L7: `main.go` のセットアップが長い
- **ファイル**: `backend/main.go`
- **カテゴリ**: 可読性
- **説明**: 全ハンドラーの初期化とDI配線が `main()` に集約（約159行）。
- **修正案**: ハンドラー初期化をファクトリ関数に切り出す。

#### BE-L8: `GoogleHTTPVerifier` が `tokeninfo` エンドポイントを使用
- **ファイル**: `backend/handlers/google_oauth.go`
- **カテゴリ**: セキュリティ / 設計
- **説明**: Googleの `tokeninfo` エンドポイントはデバッグ用途。本番では `google.golang.org/api/idtoken` を推奨。
- **修正案**: IDトークンのJWT署名をローカルで検証する方式に変更する。

---

## 2. フロントエンド（React/TypeScript）

### High（高）

#### FE-H1: トークンリフレッシュロジックの重複
- **ファイル**: `frontend/app/api/client.ts` / `frontend/app/lib/auth.ts`
- **カテゴリ**: DRY違反
- **説明**: `client.ts` の `tryRefreshToken()` と `auth.ts` の `refreshToken()` が同じ `/api/auth/refresh` エンドポイントに対してほぼ同一のロジックを実装。エラー時の挙動が微妙に異なる（`auth.ts` は `clearToken()` を呼ぶが `client.ts` は呼ばない）。
- **修正案**: `auth.ts` の `refreshToken()` を唯一の実装とし、`client.ts` から呼び出すようリファクタリングする。

#### FE-H2: `protectedLoader` が未使用（デッドコード）
- **ファイル**: `frontend/app/lib/protected-loader.ts`
- **カテゴリ**: YAGNI / DRY違反
- **説明**: `protectedLoader()` が定義されているが、どのルートファイルからもインポートされていない。全ルートが認証チェックパターンを個別に再実装。
- **修正案**: 全ルートで `protectedLoader()` を使うようリファクタリングするか、ファイルを削除する。

#### FE-H3: 写真取得ロジックの重複
- **ファイル**: `frontend/app/routes/history.tsx` / `frontend/app/routes/history-detail.tsx` / `frontend/app/api/places.ts`
- **カテゴリ**: DRY違反
- **説明**: `api/places.ts` に `getPlacePhoto()` ヘルパーが定義されているにもかかわらず、`history.tsx` と `history-detail.tsx` はそれぞれインラインで独自実装。
- **修正案**: `getPlacePhoto()` 経由に統一する。

#### FE-H4: `window.location.href` によるハードリダイレクト
- **ファイル**: `frontend/app/api/client.ts`
- **カテゴリ**: セキュリティ / エラーハンドリング
- **説明**: トークンリフレッシュ失敗時に `window.location.href = "/login"` でハードリダイレクト。React Routerのナビゲーションをバイパスし、全アプリ状態を破棄する。
- **修正案**: カスタムイベントを発行してルートレベルで処理するか、`ApiError` をthrowして呼び出し元でハンドリングする。

#### FE-H5: `use-suggestions.ts` のユニットテストがない
- **ファイル**: `frontend/app/hooks/use-suggestions.ts`
- **カテゴリ**: テスト品質
- **説明**: フロントエンド最大・最も複雑なカスタムフック（約249行）に直接のユニットテストがない。localStorage永続化、日付判定、バッジキュー管理、リロード残回数管理などのエッジケースが未カバー。
- **修正案**: `renderHook` を使った直接テストを作成する。

---

### Medium（中）

#### FE-M1: `use-suggestions.ts` が肥大化（SRP違反）
- **ファイル**: `frontend/app/hooks/use-suggestions.ts`
- **カテゴリ**: 可読性 / 設計
- **説明**: 1つのフックが提案取得・チェックイン処理・XPモーダル制御・バッジキュー管理・リロード機能・スワイプ処理・localStorage永続化と、7つ以上の責務を持つ。
- **修正案**: `useSuggestionsFetch`、`useCheckIn`、`useRewardModals` などに分割する。

#### FE-M2: ベータパスフレーズがクライアントバンドルに露出
- **ファイル**: `frontend/app/lib/beta-access.ts`
- **カテゴリ**: セキュリティ
- **説明**: `import.meta.env.VITE_BETA_PASSPHRASE` はビルド時にクライアントバンドルにインライン化され、DevToolsから容易に抽出可能。
- **修正案**: サーバーサイドでパスフレーズ検証APIを用意する。ドッグフーディング段階なら許容範囲だが、外部公開前に対処必須。

#### FE-M3: `auth.ts` の `refreshToken()` エクスポートが未使用
- **ファイル**: `frontend/app/lib/auth.ts`
- **カテゴリ**: YAGNI
- **説明**: `refreshToken()` がexportされているがどこからもインポートされていない。実際のリフレッシュは `client.ts` の `tryRefreshToken()` が担当。
- **修正案**: FE-H1のリファクタリングと合わせて整理する。

#### FE-M4: テストでの `as any` の多用
- **ファイル**: 全ルートテストファイル
- **カテゴリ**: 型安全性
- **説明**: `loaderData as any`、`params as any`、`matches as any` というキャストが多用され、テスト時の型チェックが無効化。
- **修正案**: テスト用のファクトリ関数 `createMockRouteProps<T>(overrides)` を作成する。

#### FE-M5: `history-detail.tsx` のインライン型定義
- **ファイル**: `frontend/app/routes/history-detail.tsx`
- **カテゴリ**: 型安全性 / DRY
- **説明**: 他のルートは `Route.ComponentProps` を使っているのに `history-detail.tsx` だけインラインで独自定義。
- **修正案**: `+types/` の自動生成型を使用する。

#### FE-M6: `clientLoader` の認証チェックパターンが全ルートで重複
- **ファイル**: 6つのルートファイル
- **カテゴリ**: DRY違反
- **説明**: `getToken() → redirect("/login") → getUser()` パターンが6ルートで手書きされている。
- **修正案**: 共通 `requireAuth()` ヘルパーを作成（FE-H2と統合可能）。

#### FE-M7: `history.tsx` の検索ボタンが未実装
- **ファイル**: `frontend/app/routes/history.tsx`
- **カテゴリ**: YAGNI / アクセシビリティ
- **説明**: ヘッダーの検索アイコンボタンに `onClick` が空。機能しないデッドUI要素。
- **修正案**: Phase 1で不要なら削除する。

---

### Low（低）

#### FE-L1: テストの `global.fetch` モックとAPIモジュールモックの混在
- **ファイル**: `frontend/app/__tests__/routes/history.test.tsx` 等
- **カテゴリ**: テスト品質
- **説明**: 写真取得で `global.fetch` を直接モックする一方、API関数は `vi.mock()` を使用。2つのモック戦略が混在。
- **修正案**: FE-H3の修正（`getPlacePhoto()` 統一）で解消される。

#### FE-L2: テストの言語が日本語と英語で混在
- **ファイル**: `frontend/app/__tests__/routes/history.test.tsx` 等
- **カテゴリ**: 可読性
- **説明**: `describe` ブロック名やテスト記述が英語と日本語で混在。
- **修正案**: 日本語に統一する（CLAUDE.mdの方針と整合）。

#### FE-L3: `discovery-card.tsx` のタッチハンドラーが毎レンダーで再生成
- **ファイル**: `frontend/app/components/discovery-card.tsx`
- **カテゴリ**: パフォーマンス
- **説明**: `handleTouchStart` 等がコンポーネント本体内で定義されており、毎レンダーで新しい関数オブジェクトが生成される。
- **修正案**: `useCallback` でメモ化する（現状のユーザー規模では影響軽微）。

#### FE-L4: `history.tsx` ヘッダーの戻るボタンに `aria-label` がない
- **ファイル**: `frontend/app/routes/history.tsx`
- **カテゴリ**: アクセシビリティ
- **説明**: 戻るボタン（`arrow_back` アイコンのみ）にテキストラベル未設定。
- **修正案**: `aria-label="戻る"` を追加する。

#### FE-L5: テストの `User` モックデータに `search_radius` が欠落
- **ファイル**: 複数テストファイル
- **カテゴリ**: 型安全性
- **説明**: モック `User` オブジェクトに `search_radius` が含まれていないケースあり。`as any` で隠蔽されている。
- **修正案**: 共通の `createMockUser(overrides?)` ファクトリ関数を定義する。

---

## 3. インフラ・設定

### Critical（致命的）

#### IF-C1: コンパイル済みバイナリがGit管理に含まれている
- **ファイル**: `backend/roamble`
- **カテゴリ**: セキュリティ
- **説明**: Goのコンパイル済みバイナリ（48MB）がGitリポジトリに追跡されている。リポジトリサイズの肥大化。
- **修正案**: `.gitignore` に `backend/roamble` を追加し、`git rm --cached backend/roamble` で追跡を解除する。

#### IF-C2: Redis がパスワードなしで公開ポートにバインド
- **ファイル**: `docker-compose.yml`
- **カテゴリ**: セキュリティ
- **説明**: Redisが認証なし・ポート公開で起動しており、ローカル環境でも他プロセスからアクセス可能。
- **修正案**: `127.0.0.1:6379:6379` にバインドを制限するか、認証を追加する。

---

### High（高）

#### IF-H1: MySQL ポートがホスト全インタフェースに公開
- **ファイル**: `docker-compose.yml`
- **カテゴリ**: セキュリティ
- **説明**: MySQLがすべてのネットワークインタフェースに公開されている。
- **修正案**: `127.0.0.1:3306:3306` にバインド制限する。

#### IF-H2: READMEの `.env` ファイルに関する記載が不正確
- **ファイル**: `README.md`
- **カテゴリ**: セキュリティ / ドキュメント
- **説明**: 「`.env` ファイルは既にリポジトリに作成されています」と記載。過去にコミットされていた可能性があり、秘密情報が履歴に残っていないか確認が必要。
- **修正案**: `.env.example` パターンに修正する。

#### IF-H3: root Makefile の `test-be` コマンドにシェル構文エラー
- **ファイル**: `Makefile`
- **カテゴリ**: インフラ
- **説明**: `cd backend go test ./...` — `&&` がなく、テストが実行されず無条件で成功する。
- **修正案**: `cd backend && go test ./...` に修正する。

#### IF-H4: backend Dockerfile の Go バージョンが不正確
- **ファイル**: `backend/Dockerfile`
- **カテゴリ**: インフラ
- **説明**: `golang:1.25.6-alpine` は存在しないバージョン。ビルドが実際にどのイメージで動いているか確認が必要。
- **修正案**: 実際に利用可能な Go バージョンに合わせる。

#### IF-H5: backend に `.dockerignore` がない
- **ファイル**: `backend/` ディレクトリ
- **カテゴリ**: インフラ
- **説明**: `.dockerignore` がないため、`COPY . .` 時にバイナリ（48MB）やテストファイルもイメージに含まれる。
- **修正案**: `backend/.dockerignore` を作成する。

---

### Medium（中）

#### IF-M1: Docker Compose に `restart` ポリシーがない
- **ファイル**: `docker-compose.yml`
- **カテゴリ**: インフラ
- **説明**: コンテナクラッシュ時に自動再起動しない。
- **修正案**: `restart: unless-stopped` を追加する。

#### IF-M2: Docker Compose で非推奨の `docker-compose` V1 コマンドを使用
- **ファイル**: `Makefile`
- **カテゴリ**: インフラ
- **説明**: V2 では `docker compose`（ハイフンなし）が標準。
- **修正案**: 全箇所を `docker compose` に置き換える。

#### IF-M3: DB の `env_file` と `environment` の重複定義
- **ファイル**: `docker-compose.yml`
- **カテゴリ**: セキュリティ
- **説明**: 同じ変数が両方で定義されている可能性。どちらが優先されるか混乱を招く。
- **修正案**: 片方に統一する。

#### IF-M4: frontend Dockerfile がマルチステージビルド未使用
- **ファイル**: `frontend/Dockerfile`
- **カテゴリ**: 設定
- **説明**: 開発専用だが、本番デプロイ時にはマルチステージビルドが必要。
- **修正案**: ローンチ前に `Dockerfile.prod` を作成する。

#### IF-M5: Playwright テストで Chromium のみ対象
- **ファイル**: `frontend/playwright.config.ts`
- **カテゴリ**: 設定
- **説明**: Firefox / WebKit でのクロスブラウザテスト未実施。
- **修正案**: ローンチ前に追加を検討。

#### IF-M6: SPA モードで `@react-router/node` と `@react-router/serve` が不要な可能性
- **ファイル**: `frontend/package.json`
- **カテゴリ**: 依存関係
- **説明**: `ssr: false` で動作しているため、SSR用パッケージは不要な可能性がある。
- **修正案**: 不要なら削除し、静的ファイル配信に置き換える。

#### IF-M7: Vitest `globals: true` なのに tsconfig に型定義が未追加
- **ファイル**: `frontend/vitest.config.ts` / `frontend/tsconfig.json`
- **カテゴリ**: 設定
- **説明**: `describe`/`it`/`expect` のTypeScript型認識のために `types` に `vitest/globals` が必要。
- **修正案**: `tsconfig.json` または `tsconfig.test.json` に追加する。

---

### Low（低）

#### IF-L1: Redis サービスにヘルスチェックがない
- **ファイル**: `docker-compose.yml`
- **カテゴリ**: インフラ
- **説明**: バックエンドが `service_started` で依存しており、Redis準備完了前に接続を試みる可能性。
- **修正案**: `redis-cli ping` のヘルスチェックを追加する。

#### IF-L2: Docker Compose の `container_name` が統一されていない
- **ファイル**: `docker-compose.yml`
- **カテゴリ**: インフラ
- **説明**: `db` のみ `container_name: roamble_db` が設定。
- **修正案**: 全サービスに統一するか、`docker compose exec` パターンに統一する。

#### IF-L3: `vite.config.ts` に `server.proxy` が未設定
- **ファイル**: `frontend/vite.config.ts`
- **カテゴリ**: 設定
- **説明**: 開発環境でのAPIプロキシ設定がない。CORS関連の複雑さが増す。
- **修正案**: `/api` をバックエンドにプロキシ設定する（現状のCORS設定で動作しているなら低優先度）。

#### IF-L4: README のディレクトリ構成が実態と乖離
- **ファイル**: `README.md`
- **カテゴリ**: ドキュメント
- **説明**: `mysql/init/01_schema.sql` が記載されているが実際には存在しない。
- **修正案**: READMEを実態に合わせて更新する。

#### IF-L5: `.gitignore` が最小限すぎる
- **ファイル**: `.gitignore`
- **カテゴリ**: 設定
- **説明**: `backend/roamble`（バイナリ）、`*.log`、`tmp/` 等が不足。
- **修正案**: 標準的なエントリを追加する。

---

## 対応優先度マトリクス

### 🔴 即座に対応（ドッグフーディング中に修正）

| ID | 内容 | 工数目安 |
|----|------|----------|
| IF-C1 | バイナリをGitから削除 | 5分 |
| BE-C1 | SeedMasterData二重呼び出し削除 | 5分 |
| IF-H3 | Makefile `test-be` 構文エラー修正 | 5分 |
| BE-M3 | `GetMapData`/`ListVisits` のDBエラーハンドリング追加 | 15分 |
| IF-C2 | Redis ポートバインド制限 | 5分 |
| IF-H1 | MySQL ポートバインド制限 | 5分 |

### 🟡 ローンチ前に対応

| ID | 内容 | 工数目安 |
|----|------|----------|
| BE-C2 | アカウント削除時のJWT無効化・キャッシュクリア | 30分 |
| FE-H1 | トークンリフレッシュロジック統一 | 30分 |
| FE-H2+FE-M6 | protectedLoader活用 or 削除 + clientLoader統一 | 30分 |
| FE-H3 | 写真取得ロジック統一 | 15分 |
| FE-M2 | ベータパスフレーズのサーバーサイド移動 | 1時間 |
| BE-H4 | エラーメッセージ言語統一 | 1時間 |
| BE-M2 | visitableTypes/placeTypeToGenreName 整合性修正 | 15分 |
| IF-H5 | `.dockerignore` 作成 | 10分 |
| IF-L5 | `.gitignore` 拡充 | 10分 |

### 🟢 Phase 2以降で対応

| ID | 内容 | 工数目安 |
|----|------|----------|
| BE-H1+BE-H2 | ゲーミフィケーション内クエリ最適化 | 2時間 |
| FE-M1 | `use-suggestions.ts` 分割 | 2時間 |
| FE-H5 | `use-suggestions.ts` テスト追加 | 2時間 |
| BE-M1 | `suggestion.go` 分割 | 2時間 |
| BE-M5+BE-M6 | グローバル変数のDI移行完了 | 3時間 |
| BE-H3 | レートリミッターGC改善 | 1時間 |
| BE-L8 | Google OAuth tokeninfo → idtoken 移行 | 1時間 |
| FE-H4 | ハードリダイレクト → React Router ナビゲーション | 1時間 |
| FE-M4 | テストの `as any` 排除 | 1時間 |

---

*このレビューは Clean Code 原則（リーダブルコード、DRY、YAGNI、SOLID）に基づいて実施されました。*
