# フロントエンドコード読解メモ

## 全体像・読む順番の指針

React Router v7 の SPA。`root.tsx` でベータゲート判定 → 各ルートの `clientLoader` で認証チェック → ページ描画、という流れが基本骨格。

### 推奨読書順

1. **エントリーポイント** — `root.tsx` → `routes.ts` → `vite.config.ts` → `react-router.config.ts` → テスト・Lint設定（vitest, playwright, eslint, tsconfig）
2. **`lib/` 全ファイル** — `token-storage.ts` → `token-refresh.ts` → `auth.ts` → `beta-access.ts` → `gtag.ts` → `pwa.ts` → `push.ts` → `protected-loader.ts`
3. **`utils/` 全ファイル** — `constants.ts` → `error.ts` → `geolocation.ts` → `category-map.ts` → `level.ts` → `badge-icon.ts` → `helpers.ts`
4. **`api/` 全ファイル** — `client.ts` → `users.ts` → `genres.ts` → `visits.ts` → `places.ts` → `suggestions.ts` → `notifications.ts`
5. **`layouts/` 全ファイル** — `app-layout.tsx` → `auth-layout.tsx`
6. **`routes/` 全ファイル** — `home.tsx` → `index.tsx` → `login.tsx` → `beta-gate.tsx` → `pwa-prompt.tsx` → `onboarding.tsx` → `history.tsx` → `history-detail.tsx` → `profile.tsx` → `settings.tsx` → `summary.weekly.tsx` → `summary.monthly.tsx` → `lp.tsx` → `privacy.tsx`
7. **`hooks/` 全ファイル** — `use-suggestions.ts`（コアロジック）→ `use-modal-close.ts` → `use-push-banner-visible.ts` → `use-form-message.ts`
8. **`components/` 全ファイル** — `card-indicator.tsx` → `app-header.tsx` → `bottom-nav.tsx` → `location-permission-modal.tsx` → `badge-toast.tsx` → `action-buttons.tsx` → `PushNotificationBanner.tsx` → `NotificationToggle.tsx` → `badge-modal.tsx` → `HomeTourModal.tsx` → `toast.tsx` → `complete-card.tsx` → `confetti-decoration.tsx` → `visit-map.tsx` → `xp-modal.tsx` → `discovery-card.tsx` → `NotificationTab.tsx` → `SummaryLayout.tsx`
9. **仕上げ** — `types/`（全ファイル）→ `e2e/`

---

## 読み終わったファイル

| ファイル | 状態 |
|---|---|
| `frontend/app/routes.ts` | 完了 |
| `frontend/app/root.tsx` | 完了 |
| `frontend/vite.config.ts` | 完了 |
| `frontend/react-router.config.ts` | 完了 |
| `frontend/vitest.config.ts` | 完了 |
| `frontend/vitest.setup.ts` | 完了 |
| `frontend/tsconfig.json` | 完了 |
| `frontend/playwright.config.ts` | 完了 |
| `frontend/eslint.config.js` | 完了 |
| `frontend/app/lib/token-storage.ts` | 完了 |
| `frontend/app/lib/token-refresh.ts` | 完了 |
| `frontend/app/lib/auth.ts` | 完了 |
| `frontend/app/lib/beta-access.ts` | 完了 |
| `frontend/app/lib/gtag.ts` | 完了 |
| `frontend/app/lib/pwa.ts` | 完了 |
| `frontend/app/lib/push.ts` | 完了 |
| `frontend/app/lib/protected-loader.ts` | 完了 |
| `frontend/app/utils/constants.ts` | 完了 |
| `frontend/app/utils/error.ts` | 完了 |
| `frontend/app/utils/geolocation.ts` | 完了 |
| `frontend/app/utils/category-map.ts` | 完了 |
| `frontend/app/utils/badge-icon.ts` | 完了 |
| `frontend/app/utils/level.ts` | 完了 |
| `frontend/app/utils/helpers.ts` | 完了 |
| `frontend/app/api/client.ts` | 完了 |
| `frontend/app/api/users.ts` | 完了 |
| `frontend/app/api/genres.ts` | 完了 |
| `frontend/app/api/visits.ts` | 完了 |
| `frontend/app/api/places.ts` | 完了 |
| `frontend/app/api/suggestions.ts` | 完了 |
| `frontend/app/api/notifications.ts` | 完了 |
| `frontend/app/layouts/app-layout.tsx` | 完了 |
| `frontend/app/layouts/auth-layout.tsx` | 完了 |
| `frontend/app/routes/home.tsx` | 完了 |
| `frontend/app/routes/index.tsx` | 完了 |
| `frontend/app/routes/beta-gate.tsx` | 完了 |
| `frontend/app/routes/pwa-prompt.tsx` | 完了 |
| `frontend/app/routes/onboarding.tsx` | 完了 |
| `frontend/app/routes/history.tsx` | 完了 |
| `frontend/app/routes/history-detail.tsx` | 完了 |
| `frontend/app/routes/profile.tsx` | 完了 |
| `frontend/app/routes/settings.tsx` | 完了 |
| `frontend/app/routes/summary.weekly.tsx` | 完了 |
| `frontend/app/routes/summary.monthly.tsx` | 完了 |
| `frontend/app/routes/lp.tsx` | 完了 |
| `frontend/app/routes/privacy.tsx` | 完了 |
| `frontend/app/hooks/use-suggestions.ts` | 完了 |
| `frontend/app/components/card-indicator.tsx` | 完了 |
| `frontend/app/components/app-header.tsx` | 完了 |
| `frontend/app/components/bottom-nav.tsx` | 完了 |
| `frontend/app/components/location-permission-modal.tsx` | 完了 |
| `frontend/app/components/badge-toast.tsx` | 完了 |
| `frontend/app/components/action-buttons.tsx` | 完了 |
| `frontend/app/components/PushNotificationBanner.tsx` | 完了 |
| `frontend/app/components/SummaryLayout.tsx` | 完了 |
| `frontend/app/components/NotificationTab.tsx` | 完了 |
| `frontend/app/components/NotificationToggle.tsx` | 完了 |
| `frontend/app/components/discovery-card.tsx` | 完了 |
| `frontend/app/components/badge-modal.tsx` | 完了 |
| `frontend/app/components/HomeTourModal.tsx` | 完了 |
| `frontend/app/components/xp-modal.tsx` | 完了 |
| `frontend/app/components/visit-map.tsx` | 完了 |
| `frontend/app/components/confetti-decoration.tsx` | 完了 |
| `frontend/app/components/complete-card.tsx` | 完了 |
| `frontend/app/components/toast.tsx` | 完了 |
| `frontend/app/hooks/use-modal-close.ts` | 完了 |
| `frontend/app/hooks/use-push-banner-visible.ts` | 完了 |
| `frontend/app/hooks/use-form-message.ts` | 完了 |
| `frontend/app/types/auth.ts` | 完了 |
| `frontend/app/types/visit.ts` | 完了 |
| `frontend/app/types/suggestion.ts` | 完了 |
| `frontend/app/types/genre.ts` | 完了 |
| `frontend/app/types/notification.ts` | 完了 |
| `frontend/app/types/env.d.ts` | 完了 |
| `frontend/e2e/main-flow.spec.ts` | 完了 |

---

## まだ読んでいないファイル

なし。全ファイルの読解完了。

**読まなくてよいファイル**
- `frontend/app/__tests__/` 以下 — テストは読解対象外

---

## 未解決の疑問（仕様・設計系）

### `vite.config.ts`

- **`injectOgpPlugin` はなぜ必要か**: OGPタグは `index.html` に直接書けば済むはずだが、`closeBundle()`（ビルド後フック）でわざわざ文字列置換している。おそらく `reactRouter()` プラグインがビルド時に `index.html` を生成・上書きするため、手書きタグが消えてしまう事情があると思われる。要確認。


---

## コード品質への指摘リスト

## 全体的なこと

- **レイアウト規約がソースコードのコメントに書かれている**: `app-layout.tsx` 冒頭の「BottomNavの高さ分はこのレイアウトが管理する・各ページは `pb-24` を追加しないこと」はコード実装者への制約であり、`CLAUDE.md` のフロントエンド注意事項欄に移すべき。ファイル内コメントでは新規ファイルを書く人が気づかない。
- **Material Symbols & Icons を `<span>` で読み込むと FOUT が発生する**: `material-symbols-outlined` はWebフォントであるため、フォント読み込み完了前に文字（アイコン名のテキスト）が一瞬表示される。SVGやPNG画像をそのまま置く方式にすることで回避できる。`beta-gate.tsx:93`・`index.tsx:87` などアプリ全体に広がっている。
- **`token` 変数名が曖昧**: `index.tsx` の `clientLoader` をはじめ多くの箇所で認証トークンを `token` と命名しているが、Push通知用VAPIDトークンも `token` と呼ばれる文脈が存在する。認証トークンを受け取る変数・引数は `authToken` に統一すべき。影響範囲は `lib/auth.ts`・`api/*.ts` の引数名・各ルートの `clientLoader` 内変数名にわたる。
- **`utils/` vs `lib/` の区分が曖昧**: `app-layout.tsx` 冒頭の「BottomNavの高さ分はこのレイアウトが管理する・各ページは `pb-24` を追加しないこと」はコード実装者への制約であり、`CLAUDE.md` のフロントエンド注意事項欄に移すべき。ファイル内コメントでは新規ファイルを書く人が気づかない。 例えば `category-map.ts` はドメイン知識（Google Places type → 表示情報のマッピング）を持っており、性格的には `lib/` に近い。`geolocation.ts`（位置情報取得・距離計算）も同様にドメイン色が強い。`utils/` をピュアな変換関数・フォーマッタ置き場、`lib/` をドメインロジック置き場として厳密に分けるか、いっそ `utils/` に一本化するかを決める必要がある。
- **キャッチコピーが3パターンあり統一されていない**: `pwa-prompt.tsx:60` は「また同じ店」を、卒業しよう。`root.tsx:108` title は「知らない場所への一歩を、経験値に。」`lp.tsx:6` は「いつも同じ店」を抜け出す、新しいお店開拓アプリ の3パターンが混在。SEO観点でも title と OGP は一致させるべきで、`root.tsx` のデフォルト title を lp.tsx の表現（「いつも同じ店」を抜け出す、新しいお店開拓アプリ）に揃えるのが優先。`pwa-prompt.tsx` のサブコピーも「いつも同じ店」を抜け出す、新しいお店開拓アプリ に揃える。
- **ファイル名の命名規則が統一されていない**: `app-header.tsx` / `bottom-nav.tsx` のように kebab-case で命名されているファイルと、`PushNotificationBanner.tsx` / `NotificationToggle.tsx` のように PascalCase で命名されているファイルが混在している。どちらかに統一すべき。Reactコンポーネントは PascalCase で命名する慣習があるため、全て PascalCase に揃えるのが望ましい。

### `error.ts`

- **`API_ERROR_CODES` の定義順と `getErrorMessageByCode` の case 順が不一致**: `NO_NEARBY_PLACES` → `NO_INTEREST_PLACES` → `ALL_VISITED_NEARBY` → `INTERNAL_ERROR` → `DAILY_LIMIT_REACHED` → `RELOAD_LIMIT_REACHED` の順で定義されているが、switch 文では `DAILY_LIMIT_REACHED` → `RELOAD_LIMIT_REACHED` → `NO_NEARBY_PLACES` の順になっている。揃えるべき。
- **`getErrorMessageByCode` を `getErrorMessage` のすぐ上に移すべき**: 両者は `parseApiError` の中で組み合わせて使われており意味的に密接。現状は `ApiError` クラスを挟んで離れている。
- **`getErrorMessageByCode` の命名を `getErrorMessageByCustomCode` に変更すべき**: `getErrorMessage`（HTTPステータス → メッセージ）の詳細版という位置づけが名前から読み取れない。`ByCustomCode` にすることでバックエンド固有コードに対するものだと明確になる。
- **`toUserMessage` の分岐を簡略化できる**: `ApiError extends Error` なので `instanceof ApiError` と `instanceof Error` のメッセージ返却処理は `instanceof Error` に統合できる。`isNetworkError` を先にチェックすれば `TypeError` も除外できる。
- **`login.tsx` が `isNetworkError` を直接使っている**: `toUserMessage` を介さずに `isNetworkError` を直接参照しており、エラー処理の統一窓口になっていない。`toUserMessage` が `server_error` コードを知らないことが根本原因。`toUserMessage` 側に `server_error` の対応を加えて `login.tsx` 側は `toUserMessage` 経由に統一すべき。

### `protected-loader.ts`

- **`protectedLoader` の命名が不明瞭**: 「protected route」というRR界隈の慣習から来た名前だが、何をprotectしているか文脈なしには伝わらない。`authRequiredLoader` の方が意図が明確。
- **`auth.ts` への統合が妥当**: 現状は別ファイルだが、「未認証ならログインに飛ばす」は認証フローの一部であり意味的には `auth.ts` に属する。`lib/` はビジネスロジック置き場であり react-router を import しても問題ない。「認証まわりは auth.ts を見ればいい」と信頼できる方が価値が高い。

### `push.ts`

- **`getVapidKey` と `getVapidPublicKey` の命名が紛らわしい**: `getVapidKey`（キャッシュつきラッパー）と `getVapidPublicKey`（APIリクエスト）で役割が違うが、名前から区別がつかない。`getVapidPublicKey` 内にキャッシュロジックをインライン化しすべき。命名変更とも迷ったが、インライン化の方がシンプルで、呼び出し元が1箇所しかないため YAGNI 的にも妥当。

### `beta-access.ts`

- **`lockBeta` が未使用**: `beta-gate.tsx` は `isBetaUnlocked` / `unlockBeta` のみ import しており、`lockBeta` はテストコード以外で呼ばれていない。削除すべき。

### `auth.ts`

- **re-export のエイリアスが二重になっている**: `token-storage` の関数をいったんエイリアス（`getToken as getStoredToken`）で取り込んでから再度 `getStoredToken as getToken` で re-export している。`export { getToken, setToken, clearToken } from "~/lib/token-storage"` と直接 re-export すれば済む。
- **関数定義順がユーザージャーニーと逆**: `logout` → `getUser` → `googleOAuth` の順になっているが、`googleOAuth`（初回認証）→ `getUser`（ユーザー情報取得）→ `logout`（ログアウト）の順が読みやすい。
- **`getUser` は `api/users.ts` に移すべき**: `apiCall` への薄いラッパーで、性格的には `api/` 層。`auth.ts` に置く理由がない。

### `token-storage.ts`

- **`refreshToken` のオプショナルは不要**: プロダクションコードでの呼び出しは `login.tsx` と `token-refresh.ts` の2箇所のみで、いずれも両方渡している。`setToken(accessToken: string, refreshToken: string)` と必須にした方がシグネチャが実態を正直に表す。テストコード（`auth.test.ts`）でのみ単体呼び出しが存在するが、それに合わせてテスト側を修正すべき。

### `root.tsx`

- **`clientLoader` 内のパスの直書き**: `/beta-gate` / `/lp` / `/privacy` がべた書きされている。`BETA_EXCLUDED_PATHS` のような定数配列に切り出すか、`betaGateCheck()` 関数に抽出した方が意図が明確でリーダブル。
- **import 文がファイル途中に来ている**: フォント import（`@fontsource/...`）と `./app.css` が `HydrateFallback` の定義後に書かれている。JS としては hoisting されるので動作に問題はないが、慣例として import は全てファイル先頭にまとめるべき。
- **description メタタグに「コンフォートゾーン」が含まれている**: `docs/marketing/marketing-strategy.md` でこの言葉は使わない方針になっているが修正漏れ。`root.tsx:111` の `description` を方針に合わせた表現に修正する必要がある。

### `geolocation.ts`

- **`calcDistance` の命名が不十分**: Haversine 公式の実装だが `calcDistance` では何の計算か伝わらない。`backend/utils/geo.go` では `HaversineDistance` と明示されているので、フロントも `calcHaversineDistance` に揃えるべき。引数名 `lat1/lng1/lat2/lng2` も `fromLat/fromLng/toLat/toLng` の方が方向性が伝わる。
- **`calcDistance` のロジックが backend と重複**: `backend/utils/geo.go:HaversineDistance` と実装が同一。フロント/バックの分離として許容範囲ではあるが、関数名だけでも統一すべき。
- **`isWithinCheckInRange` の GPS 未取得判定が暗黙的**: `if (userLat === 0 && userLng === 0) return true` は「(0,0) = GPS未取得」という暗黙の仮定。`const isGpsUnavailable = userLat === 0 && userLng === 0` に切り出すとリーダブル・コード的に意図が明確になる。
- **`getPositionWithFallback` の命名が `getCurrentPosition` と統一感ない**: `getCurrentPositionWithFallback` の方が対関係がわかりやすい。
- **`calcMapCenter` が単独で存在している**: `geolocation.ts` は位置情報取得・距離計算のファイルだが、`calcMapCenter`（訪問履歴の地図中心算出）はマップ表示用のユーティリティであり性格が異なる。`helpers.ts` や `visit-map.tsx` に近い。
- **`startPositionPolling` の `onError` 引数を削除すべき**: 呼び出し元（`use-suggestions.ts`）は第二引数を一度も渡していない。YAGNI 的に削除が妥当。削除する場合、ポーリング中の位置取得エラーがサイレント無視になることを意識的に選択している旨をインラインコメントで明示すること。

### `level.ts`

- **`LEVEL_XP_THRESHOLDS` がバックエンドの `levelThresholds`（`gamification.go`）と別物**: フロントはLv.10まで・手動設定の閾値、バックエンドはLv.30まで・67XP増分の指数カーブ。同じ `totalXp` からフロントとバックが異なるレベル・進捗を計算してしまう。`/api/users/me/stats` でバックエンドがレベルを返している場合でも、プログレスバー・次のレベルまでのXP・称号はフロント独自計算のためズレが生じる。テーブルをどちらかに統一すべき（バックエンドを正として、フロントはAPIから受け取った値を表示するだけにするのが理想）。
- **`LEVEL_TITLES` もLv.10までしか定義されておらず、バックエンドのLv.30と不一致**: Lv.11以降は `Math.min` により `LEVEL_TITLES[9]`（"アルティメットエクスプローラー"）に固定される。
- **`nextLevelStartXp ?? currentLevelStartXp + 1000` のフォールバックが不妥当**: 最大レベル到達時に `LEVEL_XP_THRESHOLDS[level]` が undefined になるための分岐だが、`+ 1000` は設計根拠がない。`isMaxLevel` が true のとき `progressPercent` は 100 固定なので、`xpToNextLevel` の表示が不要なら `isMaxLevel` の条件分岐で早期 return すればよく、`??` 自体が不要になる。
- **`currentLevelStartXp ?? 0` と `getLevelTitle` の `?? LEVEL_TITLES[0]` は到達不能なフォールバック**: `level` は必ず 1〜10 の範囲に収まるため undefined にならない。削除してよい。

### `category-map.ts`

- **`getCategoryInfo` は `getBestCategoryKey` + `getCategoryInfoByKey` の合成で冗長**: `getCategoryInfo(types)` の中身は `getBestCategoryKey` と同一の for ループ。`discovery-card.tsx` での唯一の呼び出し箇所を `getCategoryInfo(getBestCategoryKey(place.types))` に置き換えれば削除できる。
- **3関数を2関数に整理 + リネーム**: `getCategoryInfo(types[])` を削除し、残り2つを以下にリネームする。「Google API生配列から確定済みキーを選ぶ」vs「確定済みキーから表示情報を引く」の区別が名前で伝わる。
  - `getBestCategoryKey` → `pickCategoryFromAPIPlaceTypes(placeTypes: string[]): string`
  - `getCategoryInfoByKey` → `getCategoryInfo(category: string): CategoryInfo`（`ByKey` サフィックス削除）
- **`amusement_center` / `video_arcade`、`gym` / `fitness_center` でラベル・icon・gradientが完全重複**: エイリアス的な重複は避けられないが、共通オブジェクトを変数に切り出して参照する形にすれば変更漏れを防げる。例: `const GYM_CATEGORY = { ... }; gym: GYM_CATEGORY, fitness_center: GYM_CATEGORY`。
- **`getBestCategoryKey` のコメントが過剰**: コメント8行に対し実装6行。コメントで補う必要がある時点で設計が複雑すぎる兆候。`getCategoryInfo` を削除して関数を2つに整理すれば説明量も減るはず。
- **`river` / `spa` の改行ミス**: `CATEGORY_MAP` 内で他エントリは複数行だが、`river` と `spa` だけ1行で書かれており一貫性がない（動作に影響はない）。
- **`CategoryInfo` に `color: string` を追加すべき**: `visit-map.tsx` がピン色として `CATEGORY_PIN_COLORS`（別途定義した hex マップ）を参照しており二重管理になっている。`CategoryInfo` に `color: string` フィールドを追加して各エントリに hex を持たせれば `CATEGORY_PIN_COLORS` を削除できる。（`components/visit-map.tsx` の指摘と対）

### `api/visits.ts` / `types/visit.ts`

- **`listVisits` の `from`/`until` パラメータを削除すべき**: Issue #309 でバックエンドの `ListVisits` から `from`/`until` クエリパラメータが削除されたが、`api/visits.ts` の `listVisits(token, limit, offset, from?, until?)` にはまだ残っている。フロントに日付フィルタ機能は存在しないため、引数ごと削除する。
- **`CreateVisitRequest.rating` / `.memo` を削除すべき**: Issue #304 でバックエンドの `createVisitRequest` から `Rating`・`Memo` フィールドが削除されたが、フロントの型定義にはまだ残っている。送っても無視されるだけだが、型が実態と乖離しているため削除する。
- **`XPBreakdown.memo_bonus` を削除すべき**: Issue #304 でメモボーナスXPが廃止されたが、`XPBreakdown` 型に `memo_bonus: number` が残っている。
- **`MapVisit` の型がバックエンドの `mapVisitItem` と不一致**: バックエンドは `genre_tag_id` を返すが `is_breakout` は返さない。フロントの `MapVisit` は逆（`is_breakout` あり・`genre_tag_id` なし）。`visit-map.tsx` での実際の利用箇所を確認した上で修正する。

### `api/places.ts`

- **`photoReference` をオプショナルにする必要がない**: `summary.monthly.tsx:46` と `summary.weekly.tsx:51` だけ `photoReference` なしで呼んでいる（キャッシュ頼み）。他3箇所（`use-suggestions.ts`, `history.tsx`, `history-detail.tsx`）は `photo_reference` を渡したうえで `photo_reference` がない場合は呼び出し自体をスキップしている。サマリー系2ファイルも同じパターン（`!v.photo_reference` のときはスキップ）に直せば `photoReference` を必須引数にできる。

### `api/suggestions.ts`

- **`forceReload` を `reload` にリネームすべき**: バックエンドでも同じ結論になったので、フロントも `reload` に統一する（`body.force_reload` のキー名も含めて確認）。
- **`radius` 引数を削除できる可能性がある**: バックエンドの `resolveRadius`（`suggestion.go`）は `radius == 0` のとき DB の `users.search_radius` を使うため、バックエンドはすでに正しい値を知っている。現状 UI に「一時的に別の半径で検索」機能はないので、フロントから送る必要がない可能性が高い。`use-suggestions.ts` で実際に何を渡しているかを確認して、渡しているなら引数ごと削除を検討する。
- **`SuggestionResult` を `~/types/suggestion.ts` に移すべき**: `Place` 型はすでに `~/types/suggestion.ts` にあり、`SuggestionResult` は `places: Place[]` を持つ。型は `~/types/` に集約する方針と一致させる。

### `api/notifications.ts`

- **ユーザー固有エンドポイントを `/api/users/me/` 下に移すべき**: `GET/PUT /api/notifications/settings` と `POST/DELETE /api/notifications/push/subscribe` はユーザー固有リソースなので `/api/users/me/notifications/settings`・`/api/users/me/notifications/push/subscribe` が適切。`GET /api/notifications/push/vapid-key` はサーバーグローバル（認証不要・全ユーザー共通）なので現状のパスのままでよい。**対応範囲が広く、バックエンドのルーティング（`routes/routes.go`）・ハンドラ・OpenAPI仕様書（`docs/swagger.yaml`）・フロントの `api/notifications.ts`・`docs/requirements.md` の API 設計欄をすべて変更する必要がある。さらに破壊的変更であり、運用中のユーザーへの影響がある。既存のPush購読済みユーザーへの配信自体は問題ないが、SW更新前のPWAユーザーやCloudflare Pagesのキャッシュが残っている間は通知設定・購読操作が404で失敗する。対応するなら旧エンドポイントを一定期間リダイレクトとして残す必要がある。現時点では優先度が低くリスクに見合わない可能性がある。**対s応するときに改めてやるかどうかを判断する。
- **`updateNotificationSettings` のレスポンスを捨てている**: バックエンドは PUT 後に更新済みの `NotificationSettingsResponse` を返すが、フロントは `Promise<void>` として返り値を無視している。呼び出し元が更新後の設定を再取得せず古い状態を使い回している場合は実害になりうる。`settings.tsx` の実装を確認した上で、戻り値を `Promise<NotificationSettings>` にして呼び出し元で受け取るか、現状のままでよいか判断する。

### `api/genres.ts`

- **`getInterests` / `updateInterests` を `users.ts` に移すべき**: 両関数のエンドポイントは `/api/users/me/interests` であり、ユーザー設定の一部。バックエンド側もすでに users ハンドラに実装されている。`genres.ts` には `getGenreTags`（`/api/genres`）のみ残し、interests 系は `users.ts` に統合する。

### `routes/history.tsx`

- **`ITEMS_PER_PAGE` / `total` / `isLoadingMore` / `handleLoadMore` / もっとみるボタンを削除すべき**: ページネーションは仕様から削除済み。`visits.length < total` の判定もすべてセットで消せる。
- **`loadVisits` を `useEffect` 内にインライン化すべき**: `handleLoadMore` がなくなれば `loadVisits` を複数箇所から呼ぶ必要がなくなり、`useCallback` も不要になる。`useEffect` 内でインライン定義し `[token]` を直接依存配列に入れる形に整理できる。
- **`if (visit.category)` ガードが不要**: `category` は `string` 確定のため、null チェックは過剰。
- **searchボタンが未実装**: `history.tsx:119` の検索ボタンはアイコンのみで `onClick` なし。未実装機能のUIが残っている。
- **`loadPhotos` の定義位置が呼び出し元より下**: `loadVisits`（46行目）から呼ばれる `loadPhotos`（317行目）が後に定義されている。依存するサブ関数を上に置く方針に反する。`loadPhotos` を `loadVisits` より上に移すべき。
- **コンポーネント本体が先に来ている**: `export default function History` がファイル先頭に近い位置にあり、サブ関数（`VisitHistoryItem`・`loadPhotos`）が後に続く。コンポーネント本体は一番下に来るべき。
- **`useToast` を `hooks/` に移すべき**: アプリ全体から使うフックが `components/toast.tsx` に置かれている。`hooks/use-toast.ts` に分離すべき。

### `routes/history-detail.tsx`

- **`LoaderData` / `ComponentProps` のインライン型定義は削除すべき**: ファイル冒頭に `interface LoaderData` / `interface ComponentProps` をインラインで定義しているが、React Router v7 が `+types/` 配下に自動生成する型（`Route.LoaderArgs` / `Route.ComponentProps` 等）からインポートし直すべき。コメントにも「worktreeではまだ生成されていないためinline定義」とある通り暫定対応のため、型生成が整い次第置き換える。
- **`loadVisit` を `useEffect` 内にインライン化すべき**: `useCallback` でラップした `loadVisit` が `useEffect` 内でしか呼ばれていない。`useCallback` の目的は「他の場所でも同じ関数参照を使いたい」ときに意味があるが、`loadVisit` の呼び出しは `useEffect` の1箇所のみ。処理を `useEffect` 内に直接書けば `useCallback` ごと不要になる。`history.tsx` でも同じ指摘を記録済み（`handleLoadMore` がなくなれば `loadVisits` のインライン化を推奨）。
- **アーリーリターンが他ファイルのスタイルと不統一**: ローディング中（`<SkeletonLoader />`）と訪問記録なし（エラー表示）をアーリーリターンで書いているが、他ファイルでは `return` 内で条件分岐させるパターンが多い。ヘッダーJSXがアーリーリターン側と本筋 `return` で重複・微妙に差分があり、統一感がない。`return` 内で `isLoading`・`!visit` の条件分岐にまとめればヘッダーを一か所に集約できる。
- **`SkeletonLoader` の定義位置**: `HistoryDetail` コンポーネントより下に定義されているが、依存するサブ関数は呼び出し元より上に置く方針（`CLAUDE.md` のバックエンド実装ルールと同様の思想）に従って上に移すべき。
- **`handleSave` を関数宣言に書き換えたい**: `const handleSave = async () => {}` より `async function handleSave() {}` の方が好みのため書き換える（動作は同じ）。

### `routes/summary.weekly.tsx`

- **`getWeekRange` を `utils/` に切り出すべき**: 副作用のない純粋な日付計算であり、`summary.monthly.tsx` でも同様のロジックが必要になるため重複が生じる。`utils/date.ts`（または `utils/helpers.ts`）に `getWeekRange` として切り出す。
- **データ取得ロジックが `clientLoader` でなく `useEffect` に入っている**: 現状は `protectedLoader` をそのまま `clientLoader` として再エクスポートし、`listVisits` / `getUserBadges` / `loadPhotos` の呼び出しをコンポーネント mount 後の `useEffect` で行っている。React Router の `clientLoader` はデータ取得まで担う設計なので、認証チェック後にこれらの呼び出しをローダー内に移せば `isLoading` ステートと `useEffect` が不要になる。`loadPhotos` は失敗時に `undefined` でフォールバックするため `Promise.allSettled` で対応できる。
- **週間フィルタが機能していない（バグ）**: `summary.weekly.tsx:73` は `listVisits(token, 100, 0, from, until)` で `from`/`until` を渡しているが、バックエンドの `ListVisits`（`handlers/visit.go:351`）は `limit`/`offset` しか受け付けておらず、日付クエリパラメータを無視している。結果として「先週の訪問だけを表示する」機能が動いておらず、直近100件が全部返ってくる。`api/visits.ts` の以前の指摘「フロントに日付フィルタ機能は存在しない」は誤りで、サマリーページが使う意図でフロント側には実装されているが、バックエンドが未対応という状態。Issue #309 で `from`/`until` を削除したのと逆の変更（`c.Query("from")` / `c.Query("until")` を読んで `WHERE visited_at BETWEEN ? AND ?` を追加）をバックエンドに加える。`countQuery` にも同じ条件を適用することを忘れずに。
- **バッジの期間フィルタがクライアント側で行われている**: `badgeRes.filter((b) => b.earned_at >= from && b.earned_at < until)` と全件取得後にクライアントでフィルタしている。バッジ取得件数が増えると無駄な転送になるが、Phase 1 の件数規模では許容範囲。

### `routes/privacy.tsx`

- **`Section` / `SubSection` の定義順が逆**: `Privacy`（default export）がファイル先頭にあり、`Section`・`SubSection` が後ろに続く。依存するサブコンポーネントは呼び出し元より上に置く方針に従い、`Section`・`SubSection` を `Privacy` より上に移す。

### `routes/lp.tsx`

- **`batch-modal.png` はファイル名の typo**: `lp.tsx:268` の `src="/images/lp/batch-modal.png"` は `badge-modal.png` の誤記。alt テキストは「バッジ獲得画面」と正しく書かれているが、ファイル名が `batch` になっている。画像が実際に存在するなら動作に影響はないが、修正しておくべき。

### `routes/summary.monthly.tsx`

`summary.weekly.tsx` と構造が同一のため、以下の指摘はすべて両ファイルに共通。

- **`getMonthRange` を `utils/` に切り出すべき**: `getWeekRange` と同様、純粋な日付計算であり `utils/date.ts` 等に切り出す。
- **データ取得が `clientLoader` でなく `useEffect` に入っている**: `summary.weekly.tsx` と同様。
- **`listVisits` の `from`/`until` がバックエンドに無視されている**: `summary.weekly.tsx` と同様のバグ。
- **バッジフィルタがクライアント全件取得後**: `summary.weekly.tsx` と同様。
- **`loadPhotos` 関数と `VisitWithPhoto` 型が `summary.weekly.tsx` と完全重複**: 両ファイルに同一実装がコピーされている。`utils/` か `api/places.ts` の近くに切り出して両ファイルから import する形に統一すべき。

### `routes/settings.tsx`

- **定義順が逆**: `Settings`（default export）がファイル冒頭にあり、`UserInfoTab` / `SuggestionTab` / `LocationPermissionSection` / `RefreshSuggestionsModal` / `DeleteAccountModal` が後ろに続く。CLAUDE.md の方針に従い、依存するサブコンポーネントを上・`Settings` 本体を下にすべき。
- **INPUT_CLASS / SUBMIT_CLASS はプロジェクト単位で共通化すべき**: 現状 `settings.tsx` ローカルで定義しているが、同じパターンが他ファイルにも現れる可能性がある。`utils/styles.ts` または `utils/classnames.ts` に定数として切り出してプロジェクト全体で import する。
- **FormMessage は settings.tsx に留める（components/ 不要）**: `FormMessage` はpropsを受け取ってメッセージ文字列を表示するだけでstateもロジックもない。「ロジックが壊れてもE2E・手動確認では気づきにくいか」という基準を満たさず、テスト対象外のため `components/` への切り出し根拠がない。ただし `FormMessage` と `useFormMessage` の命名が役割の区別をつけにくくしている点は妥当な指摘で、`FormMessageDisplay` へのリネームは改善に値する。
- **UserInfoTab / SuggestionTab / NotificationTab / LocationPermissionSection はすべて components/ に移すべき（判断変更）**: settings.tsx は748行あり実際に読みにくい。切り出し基準の条件3「親ファイルが読みにくくなるほど複雑」に明確に該当する。UserInfoTab（約160行）・SuggestionTab（約210行）・NotificationTab（300行・components/済み）・LocationPermissionSection（約115行）を移せば settings.tsx は200行台まで縮小できる。なお LocationPermissionSection は `navigator.permissions` API・UA判定・`useEffect` を持つため条件1（テストが必要なロジック）も同時に満たす。
- **DeleteAccountModal の定義位置が遠い**: `UserInfoTab` 内で `showDeleteModal` ステートを管理しているにもかかわらず、`DeleteAccountModal` の定義はファイル末尾にある。関連するものは近くに置く原則に反する。`UserInfoTab` の直下に定義すべき。
- **useFormMessage を2回呼んでいる件**: 興味タグフォーム用と提案半径フォーム用の2セットの独立したstateを取り出すための意図的な記法。React のカスタムフックは呼ぶたびに独立したstateインスタンスを生成するため技術的には正しい。ただしデストラクチャリングのリネームが長くなりコードが読みにくい。`const interestForm = useFormMessage(); const radiusForm = useFormMessage();` としてオブジェクトごとアクセスする方が意図が伝わる。
- **toggleGenre → updateSelectedGenre にリネームすべき**: 「ジャンルを選択済みリストに追加・除外して最新状態に更新する」関数だが、`toggle` は「状態を反転させる」ニュアンスが強く、実際の処理内容と乖離している。`updateSelectedGenre` の方が実態に即している。(toggleTagsの時と同様の指摘)
- **「Genre」/「Tag」の命名ブレをGenreに統一すべき**: `onboarding.tsx` は `tag` 系命名、`settings.tsx` は `genre` 系命名。コード内は `Genre` に、UIテキスト「興味タグ」は「興味ジャンル」に統一する。変更対象はコンポーネント・変数名・型名・UIコピー全域。
- **doSaveRadius / doSaveInterests の命名**: `handle*`（イベント受取→モーダル表示）と `do*`（モーダル確認後の実際のAPI呼び出し）を分離する意図的なパターン。ただし `do` プレフィックスは慣習として広まっておらず読み手が戸惑う。`saveRadius` の方が明快。
- **pendingSave ステート**: 両フォーム（興味タグ・半径）が同じ `RefreshSuggestionsModal` を共用するため、「どちらのフォームがモーダルを開いたか」を記憶するstate。モーダルのOKボタン押下時に `pendingSave` を見てどちらの保存処理を呼ぶか分岐する。モーダルを2種類に分ければ不要になるが、JSX の重複トレードオフがある。
- **LocationPermissionSection の permState → permissionState にリネームすべき**: この略語は元の語が把握しにくいので、この場合略語より完全な名前の方が読みやすい。
- **navigator.permissions の処理を async/await に書き直すべき**: 現状は `.then().catch()` チェーンだが、内部 async 関数 + 即時呼び出しのパターンに書き直す方が読みやすい。`useEffect` のコールバック自体は `async` にできない（Promise を返すと React が警告を出す）ため、内部関数として定義して呼び出す形にする。`Promise.resolve().then(() => setPermState("unsupported"))` の不要な非同期化も消せる。

### `routes/profile.tsx`

- **サブコンポーネントの定義順が逆**: `ProfileTourStep` と `LogoutModal` がメインの `Profile` コンポーネントより後に定義されている。依存するサブ関数は呼び出し元より上に置く方針（`CLAUDE.md` バックエンドルール・フロントにも同様の思想を適用すべき）に反する。ファイル上部から順に読んだとき、呼び出し先が未定義のまま進む。
- **`ProfileTourStep` は `components/` に切り出すべき。`LogoutModal` は profile.tsx に留める**: `ProfileTourStep` は `getBoundingClientRect()` でDOM要素の位置を計算してツールチップ座標を算出するロジックを持ち、レイアウト変更時に黙って壊れる可能性がある。「ロジックが壊れてもE2E・手動確認では気づきにくいか」という基準を満たすため、`components/profile-tour-step.tsx` に切り出してテストを書く価値がある。一方 `LogoutModal` は `onConfirm`/`onClose` をpropsで受けるだけでstateを持たない表示ラッパーのため、profile.tsx に留める。切り出し基準は `CLAUDE.md` フロントエンド注意事項に記載済み。
- **`loadData` の `useCallback` が不要**: `loadData` は `useEffect` 内でのみ呼ばれており再利用されない。`useCallback` でラップする意味がなく、`useEffect` 内にインライン化すべき（`history-detail.tsx` と同じ指摘）。
- **データ取得を `useEffect` でなく `clientLoader` に移すべき**: 現状は `protectedLoader` だけを `clientLoader` として export し、`getUserStats` / `getUserBadges` / `getProficiency` の3つのAPI呼び出しを mount 後の `useEffect` で行っている。他のルート（`history.tsx` など）は clientLoader がデータ取得まで担っているため、profile.tsx でも clientLoader に統合すべき。そうすれば `isLoading` ステートと loading skeleton が不要になる。`getLevelInfo` / `getLevelTitle` の計算も clientLoader 末尾に移せる。
- **ジャンル熟練度が上位3件に固定されている（仕様バグ）**: `proficiency.slice(0, 3)` で表示を3件に絞っているが、脱却モードの判定はジャンル熟練度に基づいており、低熟練度ジャンルが自動的に脱却モード対象になる。ユーザーが「なぜ脱却モードになっているか」「いつ脱却モードから外れるか」を確認する手段が上位3件のみでは不十分。訪問実績のある全ジャンルを表示すべき。
- **バッジ獲得数が総数に対する割合で表示されていない**: 現状は `{badges.length} 個` のみ。バッジが全部で何個存在するか（現在10個）が見えないため達成感が伝わりにくい。`3 / 10` 形式で表示するのが自然。総数はフロントにハードコードするよりバックエンドの `GET /api/badges` レスポンスに `total` を含める方が保守性が高い。
- **`ProfileTourStep` の変数名 `el` / `rect` が汎用的すぎる**: 何の要素・矩形かが名前から読めない。`xpSectionEl` / `xpSectionRect` に変更すべき。
- **`PROFILE_TOUR_KEY` が sessionStorage、`HOME_TOUR_SEEN_KEY` が localStorage でストレージが不統一**: `PROFILE_TOUR_KEY` が sessionStorage である理由は「ホーム→プロフィールのナビゲーション間の一時的な通信フラグ」として使われているため。しかしタブを閉じると中断され、home ツアーも profile ツアーも完了しない宙ぶらりん状態になりうる。一本化の方向性：ツアーキーを `ONBOARDING_STAGE` 1つの localStorage キーで `"home" | "profile" | "completed"` 管理し、home→profile 間の通信は React Router の `navigate("/profile", { state: { fromTour: true } })` で行う。sessionStorage を廃止できる。変更対象は `home.tsx` / `profile.tsx` / `constants.ts`。

### `components/bottom-nav.tsx`

- **`useLocation` の理由がコードから読み取れない**: `NavLink` の `className` に関数を渡せば `isActive` を受け取れるため、一見 `useLocation` は不要に見える。実際には30行目の `fontVariationSettings`（Material Symbols のfill切り替え）でも `isActive` が必要で、`className` の関数引数から `<span>` 側に渡す手段がないため `useLocation` で自前判定している。この経緯がコードから読み取れないので、`useLocation` の直上にコメントで理由を書くべき。

### `components/location-permission-modal.tsx`

- **`components/` への切り出し基準を満たしていない**: `onUseDefault` / `onGoToSettings` をpropsで受けて呼ぶだけの表示ラッパー。ロジックなし・使用箇所1箇所・親ファイルの認知負荷を下げるほどの大きさでもない（57行）。`home.tsx` 内にインラインで定義すれば十分だった。

### `components/badge-toast.tsx`

- **デッドコード**: テストファイル（`__tests__/components/badge-toast.test.tsx`）以外のどこにも import されていない。`badge-modal.tsx` は使われているが `badge-toast.tsx` は未使用。コンポーネント本体・テストともに削除すべき。

### `components/app-header.tsx`

- **`components/` への切り出し基準を満たしていない**: `locationLabel` の有無でバッジ表示を切り替える・`isDefaultLocation` でアイコン/色を切り替えるという2つの条件分岐のみ。どちらも「壊れたら目で見て即わかる」レベルであり、テスト対象外。使用箇所も `home.tsx` の1箇所のみで、DRYによる切り出し根拠もない。`home.tsx` 内にインラインで定義すれば十分だった。すでにテストも書かれているため今すぐ戻す実益はないが、設計判断としては切り出し過剰。

### `components/PushNotificationBanner.tsx`

- **`visible` → `isBannerVisible`、state の setter は `setIsBannerVisible` に統一すべき**: boolean 変数は `is` プレフィックスをつける慣例に反している。フックをインライン化した際は `const [isBannerVisible, setIsBannerVisible] = useState(...)` の形に揃える。
- **`use-push-banner-visible.ts` を `hooks/` から `PushNotificationBanner.tsx` 内に移すべき**: 使用箇所が `PushNotificationBanner.tsx` の1箇所のみで、ロジックもシンプル。`hooks/` に独立させる根拠がなく、同一ファイル内に定義すれば十分。
- **`if (!visible) return null` の位置が不適切**: `handleAllow` / `handleDismiss` の定義より前（18行目）に置かれており、「描画するかどうかの判断」と「描画内容」が離れている。`handleAllow` / `handleDismiss` の後・`return (...)` の直前に移すことで意味のまとまりが隣接する。関数宣言は hoisting されるため動作上は問題ないが、可読性の観点で改善すべき。

### `components/card-indicator.tsx`

- **`components/` への切り出し基準を満たしていない**: props を受け取って dots を並べるだけの純粋な表示ラッパー。state・DOM計算・外部コンテキストを持たず、壊れてもE2E・手動確認で即気づく。`discovery-card.tsx` 内にインラインで定義すれば十分。

### `hooks/use-suggestions.ts`

- **`useSuggestions` を複数フックに分割すべき**（`routes/home.tsx` の指摘と重複、方針を明確化）: グループ化（`locationState`・`uiState` などのネームスペース分け）は採用しない。責務ごとに `useLocation`（位置情報取得・ポーリング・デフォルト位置フォールバック）・`useSuggestionLoad`（提案フェッチ・写真並列取得・リロード）・`useCheckIn`（訪問記録・XP/バッジキュー管理）の3フックに分割し、`useSuggestions` はそれらを束ねるアグリゲーター層にする。
- **命名改善が複数ある**:
  - `originalOrder` → `originalCardOrder`（「何の順序か」が伝わる）
  - `badgeQueue` → `badgeModalQueue`（「何のキューか」が伝わる）
  - `checkingIn` → `isCheckingIn`（boolean は `is` プレフィックス規則に従う）
  - `skipped`（handleSwipe 内・225行目） → `skippedPlace`
  - `result.daily_completed` / `level_up` → `result.is_daily_completed` / `is_level_up`（boolean フィールドは `is_` プレフィックスに統一。バックエンドのレスポンスキーとフロントの型定義を両方修正）
- **`showLocationDeniedModal` / `isUsingDefaultLocation` / `useDefaultLocationRef` の整理**: 3変数で重複が発生している。`LocationStatus = "normal" | "denied" | "using_default"` の1変数に統合する。`"denied"` はモーダルを表示する状態、`"using_default"` はデフォルト位置で動作中の状態、`"normal"` は実際の GPS を使用中の状態。`useDefaultLocationRef` は `loadSuggestions` に `useDefaultLocation: boolean` を引数で渡す設計にすることで削除できる。
- **コメントがリーダブルコード的でない**:
  - 58行目「`userPos` はキャッシュせず毎回現在地を取得する」は設計判断のコメントだが埋もれる場所に書かれており、`loadSuggestions` の先頭などより適切な場所に移す。
  - 68行目は変数名の言い換えに過ぎず不要。
  - 71行目の Issue 番号コメントは削除。コードの意図はコードと commit message で伝える。
- **`useCallback` の依存配列に `navigate` が入っているが `loadSuggestions` 内で `navigate` は呼ばれていない**: 誤記入。削除すべき。`navigate` は `useNavigate` が stable な参照を返すため実害はないが、依存配列は実態を正確に反映すべき。
- **Strict Mode 対策の `initialLoadDoneRef` は React Query 導入で不要になる**: `useEffect` の二重発火を防ぐために ref ガードを入れているが、このパターン自体がエレガントではない。React Query の `useQuery` はこの問題を内部で解決しており、ref ガードごと削除できる。React Query 導入が解決策。
- **`result.total_xp ?? 0` 等のフォールバックは不要**: バックエンドの `createVisitResponse` struct を確認したところ、`xp_breakdown` 以外は全てポインタなし・`omitempty` なしで常に値が返る。フロントの `CreateVisitResponse` 型から `xp_earned` / `total_xp` / `level_up` / `new_level` / `new_badges` / `daily_completed` の `?` を外してよい。`xp_breakdown` だけは `omitempty` のため引き続きオプショナルのまま。バックエンドの変更は不要。
- **`!!place.is_interest_match` / `!!place.is_breakout` の二重否定は必要**: `types/suggestion.ts` で両フィールドは `boolean | undefined`（興味タグ未設定・判定不可の場合に `undefined` になる設計）。`undefined → false` への変換が必要なので残す。
- **`handleXpModalClose` がバッジキューへの転送も行っており名前と中身が不一致**: XP モーダルを閉じた後に `newBadges` を `badgeModalQueue` に積む副作用がある。バッジ転送処理を独立した関数に分けて `handleXpModalClose` はモーダルを閉じることだけに専念させる。
- **306行目の `result.new_level` チェックが冗長**: `result.is_level_up` が true なら `new_level` は必ず存在する。`result.new_level` の null チェックは不要。
- **`prev` はReactのstate更新関数のパターン**: `setState(prev => ...)` と書くと React が最新 state を `prev` に渡してくれる。イベントハンドラ内でクロージャが古い値を参照するのを防ぐために使う。

### バグ: Redis 日次提案キャッシュに緯度経度が含まれていることによるカード再取得

**現象**: リロードしていないのにある程度移動するとカードがリフレッシュされる。

**原因**: `backend/database/redis.go:86` のキー生成関数が緯度経度を `%.2f`（小数2桁）でキーに含めている。

```go
func GenerateDailySuggestionCacheKey(userID string, date string, lat, lng float64) string {
    return fmt.Sprintf("suggestion:daily:%s:%s:%.2f_%.2f", userID, date, lat, lng)
}
```

`%.2f` は約1km（0.01度≒1.1km）の精度に相当するため、この距離以上移動するとキーが変わりキャッシュミスが発生、バックエンドが新たに提案を生成して返す。

**修正方針**: 日次提案キャッシュはユーザー×日付で一意であれば十分。緯度経度は提案生成時に1回使えばよく、キーに含める必要がない。`GenerateDailySuggestionCacheKey`・`GetDailySuggestions`・`SetDailySuggestions` のシグネチャから `lat, lng float64` を削除し、呼び出し元（`handlers/suggestion.go`）も合わせて修正する。

なお `handlers/suggestion.go:420` の `suggestions:%.4f:%.4f:%d`（Places API レスポンスのキャッシュ）は位置込みで正しい。異なる位置では Google Places から返るスポット自体が異なるため。

---

### `routes/onboarding.tsx`

- **`toggleTag` の命名が実態と乖離している**: `toggleTag(id)` の実態は「IDが選択済みなら除外・未選択なら追加」という配列操作であり、boolean のオンオフではない。`toggle` はスクリーンリーダー界隈でも混乱を招く。`updateSelectedTags` に変更する。

### `routes/pwa-prompt.tsx`

- **`dismissPWAPrompt` をインストール完了後に呼ぶのは命名が紛らわしい**: `handleInstall` の accepted 分岐で `dismissPWAPrompt()` を呼んでいるが、この関数の実体は「このプロンプト画面を二度と出さないフラグを localStorage に書く」であり、「拒否した」という意味合いになってしまう。`reviewPWAPrompt`（一通り目を通した・処理済み）が実態に近い。

### `routes/home.tsx`

- **`clientLoader` が `user` を返しているが使われていない**: `Promise.all([getUser(token), getInterests(token)])` で取得した `user` を `return { user, token }` で返しているが、コンポーネント側は `const { token } = loaderData` しか受け取っていない。不要な API 呼び出しか、あるいは将来の利用を見越した死にコード。削除するかコンポーネントで使うかを決める。
- **`vicinity` フィールド名をリネームすべき**: Google Places API（旧版）のレスポンスフィールド名 `vicinity` がそのまま `types/suggestion.ts` と `types/visit.ts` を通じてフロント全体に広まっている。`address` または `areaName` の方が直感的。バックエンドのレスポンスキー名と合わせてマッピング層での変換が必要になる。使用箇所: `types/suggestion.ts:4`・`types/visit.ts:6,32`・`home.tsx:132`・`history.tsx:301`・`history-detail.tsx:177`・`use-suggestions.ts:261`。
- **`checkingIn` → `isCheckingIn` にリネームすべき**: boolean 値には `is` プレフィックスをつける命名規則に従う。`useSuggestions` の戻り値と `ActionButtons` の Props 両方で修正が必要。
- **`showTour` → `isShowTour` にリネームすべき**: 同上。
- **`isCurrentVisited` と `isVisited` の命名ブレ**: `useSuggestions` からは `isCurrentVisited` として受け取り、`ActionButtons` への Props では `isVisited` として渡している。`isVisited` に統一する。
- **`useSuggestions` を複数フックに分割すべき**: 19個の返り値・14個のstate・複数の非同期処理が1フックに集中しており、読む気が失せるレベルで巨大。方針は「責務ごとに複数フックに分割する」。グループ化（`locationState`・`uiState`・`handlers` のようなネームスペース分け）は表面的な整理にすぎず、フック内部の巨大さは変わらないため採用しない。分割案: `useLocation`（位置情報取得・ポーリング・デフォルト位置フォールバック）・`useSuggestionLoad`（提案フェッチ・写真並列取得・リロード）・`useCheckIn`（訪問記録・XP/バッジキュー管理）の3フックに分け、`useSuggestions` はそれらを束ねるだけのアグリゲーター層にする。

### `routes.ts`

- **`auth-layout` にルートが1つしかない**（YAGNI違反）: `login` 1つのためだけに `layout()` でラップしている。認証系ルートが複数になってから切り出すべき。現状は直接 `route("login", ...)` で十分。
- **`onboarding.tsx` の命名が曖昧**: 現状のオンボーディングは「興味タグ選択（`/onboarding`）→ ホーム画面上のチュートリアル（`HomeTourModal`）」の2段階。`onboarding.tsx` は前半のみを指す名前になっているが、その区別がルート定義からは読み取れない。`interest-setup.tsx` などより限定的な名前の方が意図が明確になる。
- **ルート定義順を「ユーザーフロー順」に整理すべき**: 現状は `index` → `login` → `onboarding` → `pwa-prompt` → `beta-gate` → `lp` → `privacy` → `home` → `history` → `history-detail` → `profile` → `settings` → `summary.weekly` → `summary.monthly` の順で定義されているが、ユーザーフロー的には「ランディング→ログイン→ベータゲート→PWAプロンプト→オンボーディング→ホーム→その他ルート」の順で定義されている方が理解しやすい。特に `beta-gate` と `pwa-prompt` はユーザーフロー上はログイン後すぐに来るものなので、`onboarding` より前に定義した方が意図が伝わりやすい。

### `components/NotificationToggle.tsx`

- **`checked` → `isChecked` にリネームすべき**: boolean prop に `is` プレフィックスがない。HTML の `input[checked]` 属性名を踏襲した形だが、Reactコンポーネントのpropsとして定義している以上、プロジェクト内の命名規則（`is` プレフィックス）に揃えるべき。`disabled` はHTMLネイティブ属性として `<button disabled>` に直接渡しているので変更不要。

### `components/NotificationTab.tsx`

- **`NotificationToggle` を `NotificationTab.tsx` 内に統合すべき**: `NotificationToggle` は `NotificationTab.tsx` 内で8回使われているが、他のファイルからは一切 import されていない。`components/` への切り出し基準（ファイルをまたいだ再利用・テストが必要なロジック）をどちらも満たさないため、`NotificationTab.tsx` の先頭に同居させるのが妥当。現状は不要なファイル分割。
- **`ariaLabel` prop の命名が抽象的すぎる**: `ariaLabel` という名前は「aria属性に使う何かの文字列」としか読めず、なぜ `label` と別に必要なのかが伝わらない。実態は「Push/メールで同じラベル名が重複するためスクリーンリーダー向けに区別用テキストを渡す」ものなので、`screenReaderLabel` 等の方が意図が明確。
- **`denied` ブランチのIIFEをコンポーネント外に出すべき**: 86行目の三項演算子は `isIOS && !isStandalone` → `pushPermission === "granted"` → `pushPermission === "default"` → `else(denied)` の4択分岐。最後の `denied` ブランチのみJSX内でIIFEを2重に使って `deniedSteps` を計算しており、ネスト構造が著しく読みにくい。`deniedSteps` の計算を `return` より前に切り出す（またはOS別手順を返す `getDeniedSteps()` 関数に抽出する）か、`denied` ブランチを `DeniedInstructions` コンポーネントとして切り出せばIIFEが不要になる。

### `components/discovery-card.tsx`

- **`stackIndex` → `depthFromTop` にリネームすべき**: 13行目のJSDocコメント `(0 = 最前面)` は変数名が不十分なために必要になっている。`depthFromTop` にすれば「0 = 浅い = 最前面」がコメントなしで伝わる。リーダブルコード的にコメントで補う前に名前を直す。
- **`showPhoto` → `hasValidPhoto` にリネームすべき**: boolean 変数に `show` プレフィックスはUIの動作を名前に混ぜている。実態は「URLがある かつ 画像エラーが起きていない」という状態なので `hasValidPhoto` が正確。

### `components/SummaryLayout.tsx`

- **コンポーネント名 `SummaryLayout` をリネームすべき**: `Layout` という接尾辞は `layouts/` 配下のルーターレベル共有レイアウト（`AppLayout`・`AuthLayout`）を連想させる。実態は週次・月次2ルートが共有する表示テンプレートなので `SummaryReport` が最も実態に即している。`SummaryView` / `SummaryShell` も候補。
- **Tailwindを使わずインラインスタイルで書かれており、プロジェクト全体の記法と不統一**: 他のコンポーネントはすべて Tailwind CSS を使っているが、このファイルだけ全要素に `style={{ ... }}` を使っている。Tailwind で書き直せば行数が半分以下になる。カスタムカラー（`#102222`・`#1a3333`・`#13ecec` 等）は `tailwind.config.ts` に追加して対応する。
- **`StatCard` が2箇所に重複している**: 訪問数カード（136〜176行）とXPカード（178〜219行）が `icon`・`iconColor`・`value`・`label` だけ異なる同一構造。`StatCard` コンポーネントに切り出せば80行が10行以下になる。
- **訪問行とバッジ行が同一構造で重複している**: 訪問リストの各行（255〜325行）とバッジリストの各行（350〜402行）が「44px左枠＋flex-1右枠」という同一レイアウト。`ListRow` として共通化するか、少なくとも `VisitRow`・`BadgeRow` として `map` 外に切り出すことで `map` の本体が短くなる。
- **`isLoading` / `errorMessage` の深いネストをアーリーリターンで解消すべき**: 現状は `isLoading ? ... : (<> errorMessage ? ... : (<> ... </>) </>)` という3段ネスト。コンポーネント先頭で `if (isLoading) return <LoadingSpinner />` / `if (errorMessage) return <ErrorState />` としてアーリーリターンすればネストがほぼ消える。

### `components/xp-modal.tsx`

- **`levelUp` → `isLevelUp` にリネームすべき**: boolean prop は `is` プレフィックスが慣習。変更箇所は `xp-modal.tsx`・`home.tsx`・`use-suggestions.ts`（型定義と代入）・テストファイルの計8箇所。
- **`highlight` → `isHighlight` にリネームすべき**: `XpBreakdownRow` の boolean prop。同上の理由。
- **`showPlus` → `isShowPlus` にリネームすべき**: 同上。なお `showPlus` は実際に使われている（base_xp 行のみ `false` を渡してプラス記号を非表示、ボーナス行はデフォルト `true`）。
- **`xpBreakdown.base_xp >= 100` を変数に切り出すべき**: `XpBreakdownRow` に渡す `label` と `highlight` の両方で同じ条件を参照している。`const isBreakout = xpBreakdown.base_xp >= 100` として先に定義すれば重複が消える。
- **`XpBreakdownRow` の定義順が逆**: `XpModal` が `XpBreakdownRow` に依存しているため、`XpBreakdownRow` を上に、`XpModal` を下に置くべき（CLAUDE.md の定義順ルールに準拠）。
- **`XpBreakdownRow` の props がインライン型定義**: `XpModalProps` は事前定義されているのに `XpBreakdownRow` の引数型はインライン。統一するならどちらかに揃える。
- **バッジアイコンが `check` 固定**: コメントに「バッジ / スター アイコン」とあるが実際は常に `check` を表示するだけで、獲得したバッジ固有のアイコンは出ない。獲得したバッジのアイコンを表示できるよう仕様変更したい。多分 `BadgeIcon` コンポーネントを流用すればいけるはず。

### `components/visit-map.tsx`

- **`positionReady` → `isPositionAvailable` にリネームすべき**: boolean 変数は `is` プレフィックスをつける慣例に反している。setter も `setIsPositionAvailable` に揃える。
- **サブコンポーネントの定義順が逆**: `PinMarker` / `VisitInfoContent` がメインの `VisitMap` より後に定義されている。依存するサブコンポーネントは呼び出し元より上に置く方針に反する。
- **`CATEGORY_PIN_COLORS` を `CategoryInfo` に統合すべき**: `CATEGORY_MAP`（`utils/category-map.ts`）のエントリには `gradient`（Tailwind クラス文字列）が入っているため直接ピン色として使えず、`CATEGORY_PIN_COLORS` として hex を別途管理している。`CategoryInfo` インターフェースに `color: string` を追加し、`CATEGORY_MAP` の各エントリに hex 値を持たせれば `CATEGORY_PIN_COLORS` / `DEFAULT_PIN_COLOR` / `getPinColor` を丸ごと削除できる。変更対象は `utils/category-map.ts` と `visit-map.tsx` の2ファイル。
- **脱却バッジ（ピン上の星アイコン）を削除すべき**: 訪問地点が多数になるとピンが密集し、小さな星バッジは見づらくなる一方でノイズになる。`PinMarker` の `isBreakout` prop と該当 JSX（`{isBreakout && (...)}` ブロック）を削除する。`VisitInfoContent` の「⭐ コンフォートゾーン脱却！」テキストは残す。

### `components/badge-modal.tsx` / `components/HomeTourModal.tsx` / `components/location-permission-modal.tsx`

- **`HomeTourModal` が `useModalClose` を使っておらず Escape キー非対応**: `BadgeModal` は `useModalClose(onClose)` で Escape キー対応済みだが、`HomeTourModal` は未使用。`handleSkip`（localStorage にフラグを書いてから `onClose`）を渡せばよいだけなので対応漏れ。`LocationPermissionModal` は「閉じる」に相当する単一アクションが存在しない設計（2択を必ず選ぶ）なので未使用は意図的。

### `components/confetti-decoration.tsx`

- **`POSITIONS` の `rotate` フィールドがデッドコード**: `@keyframes confetti-float-*` が `transform: translateY(...) rotate(...)` を直接指定するため、アニメーション実行中はTailwindの `rotate-*` クラスが上書きされて効かない。加えて要素が `w-2 h-2` の正方形なので、仮に効いても見た目は変わらない。`POSITIONS` 配列から `rotate` フィールドごと、JSXの `${pos.rotate}` 参照ごと削除できる。

### `components/complete-card.tsx`

- **`offsetRef` が不要**: `handlePointerUp` の deps に `offset` を含めれば（DiscoveryCard と同様）`offsetRef` は不要になる。2つのアプローチが混在していて統一されていない。
- **71〜79行にブランチ間の重複**: 両ブランチで `offsetRef.current = { x: 0, y: 0 }` と `setOffset({ x: 0, y: 0 })` を繰り返している。共通処理を分岐の外に出して `if (dist > SWIPE_THRESHOLD) setIsSpinning(true)` だけにできる。
- **ネビュラグローを別 `div` にする必要がない**: `cardStyle.background` に多重背景構文でグラデーションを重ねれば DOM 要素を減らせる。
- **過剰なコメント**: `// 🔵 REFACTOR: 星フィールドの座標を定数配列として定義` はすでに定数化済みなので削除すべき。props の JSDoc と実装の両方に同じ説明が重複している箇所も整理すべき。他にも『リーダブル・コード』に反するコメントは消したり書き直したりすべき
- **`DiscoveryCard` とポインタ処理が重複**: `cardRef` / `startPos` / `dragging` / `handlePointerDown` / `handlePointerMove` / `handlePointerUp` がほぼ丸ごと重複している。「閾値超過時の挙動」をコールバックで受け取る `useCardDrag` カスタムフックに切り出せる。

### `components/toast.tsx`

- **`ToastProvider` の定義順が逆**: `ToastProvider` が `ToastItem` より上に定義されているが、`ToastProvider` が `ToastItem` に依存しているため、`ToastItem` を上に・`ToastProvider` を下に置くべき（CLAUDE.md の定義順ルールに準拠）。
- **`showToast` のデフォルト型が `"error"`**: `type: ToastType = "error"` により、`showToast("保存しました")` と型を省略すると赤いエラースタイルで表示される。`"info"` あたりをデフォルトにする方が誤用しにくい。

### `hooks/` 全体

- **`use-push-banner-visible.ts` は `PushNotificationBanner.tsx` に同居すべき**: 利用元が `PushNotificationBanner.tsx` のみ。`hooks/` に置く理由（複数箇所から使用・独立テストの必要性）を満たしていない。ロジックの実体は `isStandalone()` と `Notification.permission` の参照なので、`lib/push.ts` への統合も選択肢に入る。
- **`use-form-message.ts` は `settings.tsx` に同居すべき**: コメントに「settings.tsx などで」とある通り、現状の利用元は settings.tsx のみ。上記と同じ理由で `hooks/` 配置は過剰。

### `hooks/use-modal-close.ts`

- **PCを使わないアプリなので削除すべき**: Roamble は PWA（スタンドアロン）前提のモバイルアプリであり、キーボードの Escape キーが押される状況が存在しない。`use-modal-close.ts` ごと削除し、`badge-modal.tsx`・`xp-modal.tsx`・`profile.tsx`・`settings.tsx`・`badge-modal.tsx`（計5ファイル）から import と呼び出しを除去する。合わせて `__tests__/hooks/use-modal-close.test.ts` も削除する。なお、前チャットで記録した「`HomeTourModal` が `useModalClose` を使っておらず Escape キー非対応」の指摘も同時に不要になる。

### `types/visit.ts`

- **`CreateVisitResponse` のゲーミフィケーションフィールドが全てオプショナルになっている**: `xp_earned` / `total_xp` / `level_up` / `new_level` / `new_badges` / `daily_completed` に `?` が付いているが、バックエンドの `createVisitResponse` struct（`handlers/visit.go:82`）を確認したところ、これら全てポインタなし・`omitempty` なしで常に値が返る。`?` を外してよい。`xp_breakdown` だけは `json:"xp_breakdown,omitempty"` のため引き続きオプショナルのまま。コメントに「Issue #128 実装後に返る」とある通り過渡期の後方互換対応で付けた `?` が、実装完了後も残り続けている。`hooks/use-suggestions.ts` の `result.total_xp ?? 0` 等のフォールバックも合わせて削除できる。

### `types/` ディレクトリ配置方針

- **現状の切り出し基準は妥当**: `SuggestionResult`（`api/suggestions.ts`）・`PlaceWithPhoto` / `XpModalState`（`hooks/use-suggestions.ts`）・`FormMessageState`（`hooks/use-form-message.ts`）はいずれも定義ファイル内でしか使われておらず、`types/` に置く根拠がない。`types/` に置くのは複数ファイルをまたいで参照される共有型（APIレスポンス型・ドメインモデル型）のみ、という暗黙ルールが実態として守られている。README.md のアーキテクチャ図にこの基準を追記済み。

### `types/env.d.ts`

- **`VITE_BETA_PASSPHRASE` の型宣言が欠落している**: `CLAUDE.md` に `VITE_BETA_PASSPHRASE` 環境変数の存在が明記されているが、`env.d.ts` の `ImportMetaEnv` に宣言がない。`readonly VITE_BETA_PASSPHRASE?: string` を追加すべき。

### `e2e/main-flow.spec.ts`

- **E2Eカバレッジがルーティング・認証ガードに偏っており、コア機能のテストがない**: 提案生成・チェックイン・XP/バッジ付与・履歴確認といったアプリ固有の機能が一切テストされていない。以下を追加すべき。

**提案生成**
- 位置情報許可 → 提案カード表示
- 位置情報拒否 → デフォルト位置でフォールバックして提案カード表示
- リロードボタンで別の提案が表示される
- リロード上限到達 → 上限エラーメッセージ表示
- 近くにスポットなし（`NO_NEARBY_PLACES`）→ エラーメッセージ表示
- 全スポット訪問済み（`ALL_VISITED_NEARBY`）→ エラーメッセージ表示

**訪問記録・ゲーミフィケーション**
- チェックイン → XPモーダル表示（獲得XP・内訳が出ている）
- チェックイン → レベルアップ時にレベルアップ表示がある
- チェックイン → バッジ獲得時にバッジモーダルが表示される
- 3件チェックイン → Complete Card表示（日次上限達成）
- 脱却モードのスポットでチェックイン → XPモーダルに脱却ボーナス表示

**履歴**
- チェックイン後に履歴画面を開くと該当レコードが表示される
- 履歴詳細画面でメモを入力して保存 → 保存内容が反映される
- 履歴詳細画面でレーティングを変更して保存 → 反映される

**プロフィール・統計**
- チェックイン後にプロフィール画面のXP・レベルが更新されている
- バッジ獲得後にプロフィール画面のバッジ欄に反映されている

**設定**
- 興味タグを変更して保存 → 変更が反映される
- 検索半径を変更して保存 → 変更が反映される
- アカウント削除 → ログイン画面へリダイレクト

**エラーケース**
- バックエンド到達不能（ネットワーク断）時の提案画面エラー表示
- 提案生成中にローディング表示が出る

**認証・セッション（自動化難易度が高いため現状は手動テストで補う。将来的には追加したい）**
- アクセストークン期限切れ → リフレッシュが走って操作継続できる（`localStorage` のトークンを期限切れ状態に書き換えてからページ遷移で検証）
- リフレッシュトークンも失効 → ログイン画面へリダイレクト（`/api/auth/refresh` を `route.fulfill` で 401 を返すようモックして検証）

---

## バックエンドへの指摘（フロント読解中に気づいたもの）

### `handlers/suggestion.go`

- **`defaultSearchRadius` フォールバックが到達不能**: `resolveRadius` は `radius == 0` のとき DB の `users.search_radius` を参照するが、`users.search_radius` は `gorm:"default:10000;not null"` で定義されているため必ず値が入る。`else { radius = defaultSearchRadius }` は到達不能なデッドコードであり、`defaultSearchRadius = 3000` 定数ごと削除できる。

---

## フロントエンド・バックエンド同時変更が必要な指摘

フロント側の型定義（`types/*.ts`）はバックエンドのレスポンス構造をそのまま反映しているため、以下はAPIの変更を伴う。フロント単独では直せない。

### APIレスポンスフィールドの命名不統一

- **`types/visit.ts`: `level_up` に `is_` プレフィックスがない**: `is_breakout` は `is_` 付きなのに `level_up`・`daily_completed` は付いていない。バックエンド側を `is_level_up`・`is_daily_completed` にリネームし、フロント型定義・参照箇所を追従させる必要がある。
- **`types/suggestion.ts`: `open_now` に `is_` プレフィックスがない**: `is_interest_match`・`is_breakout` は `is_` 付きなのに `open_now` だけ付いていない。バックエンド側を `is_open_now` に揃えるべき。
- **`types/notification.ts`: boolean フィールドが `_enabled` / 動詞なし名詞で統一されていない**: `push_enabled`・`email_enabled` は `_enabled` サフィックスで、`daily_suggestion`・`weekly_summary`・`monthly_summary`・`streak_reminder` は名詞のみで boolean であることが名前から読み取れない。`is_daily_suggestion_enabled` 等に揃えるかは議論の余地があるが、少なくともプロジェクト内でスタイルを統一すべき。

---

## 起票済みIssue


---

## 別チャットへの引き継ぎプロンプト

フロントエンド全ファイルの読解完了。次のチャットでは `docs/frontend-code-reading-notes.md` の指摘対応（実装作業）へ移行する。
