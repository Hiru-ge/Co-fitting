# TODO — ベータ版ロードマップ

> Phase 2 の実装は一通り完了。現段階は、自分含むユーザーのFBを元にしたブラッシュアップフェーズ。iOS移行前に対応するのは #321（スキップ機能）・#322（LP英語化のみ）・#344（開拓数露出強化）・#346（オンボーディングサンプル訪問導線）・#347（土日リフレッシュリマインダー文言最適化）・#349（マップ行き先指定）の6件。#320（効果音）・#345（Receipt of Courage）はiOS版で実装するためPhase 3に移動済み。#349 実装完了。
> 現在のドメイン: `roamble.app`（本番）/ `roamble.pages.dev`（Cloudflare Pages デフォルト）

---

## セキュリティ確認

### フロントエンド

- [ ] `localStorage` に保存しているトークンに対して XSS リスクがある場合、Content-Security-Policy ヘッダーが設定されているか（`public/_headers` に CSP 未設定。ベータ版では許容範囲だが、正式リリース前に追加推奨）
- [ ] リフレッシュトークンを httpOnly Cookie に移行する（現状は `localStorage` に保存しており、XSS が刺さると盗まれるリスクがある。対応にはバックエンドでの Cookie 発行・CSRF 対策とセットで実装が必要。ユーザー数が増えるフェーズで対応を検討）
---

## 3/8〜: Optional（ひと段落後）

- [ ] Product Hunt "Upcoming" ページの活用

---

## Phase 2：通知機能（実装済み） + ブラッシュアップ

> 詳細は `docs/notification-roadmap.md` を参照。
> Issue #270〜#282 の通知基盤（DBモデル・エンドポイント・Push/メールサービス・スケジューラー・フロントエンドUI）はすべて実装済み。

### お店一時スヌーズ機能（Issue #321）

> **背景**：気になっているが今日は行けない・行きたくない場合に「7日間このお店を表示しない」と設定できると、提案リストの体感精度が上がる。

**🔴 RED**

- [x] `backend/database/redis_test.go` に `TestGeneratePlaceSnoozeKey` / `TestSetPlaceSnooze` / `TestIsPlaceSnoozed` を追加（TTL検証・ユーザー間独立性・期限切れ後false）
- [x] `backend/handlers/skip_test.go` を新規作成し `TestSnoozePlace` を追加（200返却・Redisへの保存確認・`days`省略で400・`days=0`で400・`days=366`で400・認証なし401）
- [x] `backend/handlers/suggestion_test.go` に `TestSuggest_SnoozeFilter` を追加（スヌーズ期間中は提案から除外・スヌーズなし施設は通常通り提案）
- [x] `frontend/app/__tests__/components/discovery-card.test.tsx` にスヌーズボタンのテストを追加（最前面カードに表示・`onSnooze`コールバック呼び出し・`depthFromTop=1`では非表示）

**🟢 GREEN**

- [x] `backend/database/redis.go` に `GeneratePlaceSnoozeKey(userID, placeID string) string` / `SetPlaceSnooze(ctx, client, userID, placeID string, days int) error` / `IsPlaceSnoozed(ctx, client, userID, placeID string) (bool, error)` を追加（Redisキー: `place:snooze:{userID}:{placeID}`）
- [x] `backend/handlers/skip.go` に `SnoozeHandler` と `SnoozePlace` メソッドを実装（`POST /api/places/:place_id/snooze?days=N`、`days`はクエリパラメータ必須・1〜365の整数）
- [x] `backend/services/suggestion.go` に `FilterOutSnoozed(ctx, client, userIDStr string, places []PlaceResult) []PlaceResult` を追加し、`suggestion.go` のフィルタリングパス（キャッシュヒット時・通常時の両方）で呼び出す
- [x] `frontend/app/api/places.ts` に `snoozePlace(authToken, placeId string, days int)` を追加
- [x] `frontend/app/hooks/use-snooze.ts` を新規作成（`openSnoozeModal` / `confirmSnooze` / `cancelSnooze`・確認後に楽観的更新してバックグラウンドでAPI呼び出し）
- [x] `frontend/app/components/SnoozeConfirmModal.tsx` を新規作成（確認モーダルUI）
- [x] `frontend/app/hooks/use-suggestions.ts` に `useSnooze` を組み込み、returnオブジェクトにモーダル状態を追加
- [x] `frontend/app/routes/home.tsx` に `SnoozeConfirmModal` をレンダリング追加
- [x] `frontend/app/components/DiscoveryCard.tsx` にスヌーズボタン追加（`data-testid="skip-button"`・最前面カードのみ・`onSnooze` prop経由）

**🔵 REFACTOR**

- [x] なし

---

### LP英語化（Issue #322）

> **背景**：Product Hunt等での海外ユーザー獲得に向けて、LPを英語対応にする。アプリ内UIの多言語対応はiOS版実装時に行う。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [x] `frontend/app/routes/lp.tsx` のコピーを英語訳し、ブラウザの `Accept-Language` が `en` 系の場合に英語テキストを表示する（または `/en` ルートを用意する）
- [x] メタタグ（title・description・OGP）を英語に切り替える

**🔵 REFACTOR**

- [ ] なし

---

### プロフィール画面「お店開拓数」露出強化（Issue #344）

> **背景**: Duolingoの「Day 847」に相当する数字として「何軒開拓したか」をプロフィール最上部の最も目立つ位置に配置する。現状は `stats.total_visits` が「総訪問」として小さく表示されている（`frontend/app/routes/profile.tsx:206`）。

**🟢 GREEN**

- [ ] `frontend/app/routes/profile.tsx:208` の「総訪問」ラベルを「お店開拓数」に変更
- [ ] `stats.total_visits` の数字表示をプロフィールヘッダー部の最上位に昇格させ、レベルXPより目立つ位置に配置する

**🔵 REFACTOR**

- [ ] なし

---

### 土日リフレッシュリマインダー文言最適化（Issue #347）

> **背景**: 土日朝は平日より外出ハードルが低いため、通常文言よりも行動を後押しする特別文言に切り替えてリテンションを高める。

**🔴 RED**

- [x] `backend/services/scheduler_test.go` に土曜・日曜文言の送信内容テストを追加

**🟢 GREEN**

- [x] `backend/services/scheduler.go` の土曜朝リマインダー文言を「今日は土曜日！ちょっとお出かけしてみない？」に変更
- [x] `backend/services/scheduler.go` の日曜朝リマインダー文言を「今日は日曜日！絶好のお出かけ日和だね！」に変更

**🔵 REFACTOR**

- [x] 曜日別文言定義を定数化して可読性を維持

---

### ストリーク週次リセットcronジョブ実装（Issue #348）

> **背景**: 訪問しない限り streak_count が永久に保持され続けるため、当週未訪問ユーザーのストリークが正しくリセットされない。日曜0時 JST に未訪問ユーザーの streak_count を 0 にリセットするcronジョブを追加する。

**🔴 RED**

- [x] `backend/services/scheduler_test.go` に `TestSchedulerJobsRegistered` を5件に更新
- [x] `backend/services/scheduler_test.go` に `TestResetExpiredStreaks_ResetsUsersWhoMissedThisWeek` を追加（先週訪問・今週未訪問 → streak_count=0 / 今週訪問済み → 変化なし / streak_count=0 → 変化なし）

**🟢 GREEN**

- [x] `backend/services/scheduler.go` に `ResetExpiredStreaks()` メソッドを追加（`WHERE streak_count > 0 AND streak_last < thisWeekMonday` のユーザーを一括更新）
- [x] `backend/services/scheduler.go` の `Start()` に `"0 0 * * 0"` でcronジョブを登録

**🔵 REFACTOR**

- [x] なし（weekStart は既存のものを流用）

---

### オンボーディングサンプル訪問導線実装（Issue #346）

> **背景**: 新規ユーザーがオンボーディング中に提案→訪問の一連フローを疑似体験できる導線を追加する。訪問履歴には反映しない。Phase 3への先送りを撤回し、Web版でも実装する。

**🔴 RED**

- [x] サンプル訪問ステップの状態遷移テストを追加（履歴非反映を検証）

**🟢 GREEN**

- [x] 「Cafe Roamble」のダミーモーダルをDiscoveryCardを完全に踏襲したUIで作成（`frontend/app/components/SampleVisitModal.tsx`）
- [x] 「Cafe Roamble」のダミーモーダルは、z-indexでDiscoveryCard, LocationPermissionModalの上に必ず表示されるようにする
- [x] オンボーディングのステップ3に「Cafe Roamble」へのサンプル訪問ステップを追加(ステップ2と現行のステップ2の間に挿入するので、影響箇所の修正も必要)
  - [x] ダミーモーダル自体はステップ1から表示しておく
  - [x] ステップ3の文言モーダルの位置はステップ2と同じ位置にする
- [x] サンプル訪問完了で疑似XP演出を表示（実訪問APIは呼び出さない）

**🔵 REFACTOR**

- [x] サンプル訪問UIと状態管理を分離し、iOS移植時に流用しやすい構造にする

---

### マップで行き先指定・提案カード先頭追加機能（Issue #349）

> **背景** 以前から気になっていたお店に狙って訪問できないのは不便なので、お店を指定して提案カードの先頭に入れられる機能を追加する。場所ラベルのピルをタップするとマップが開き、周囲1km内の訪問可能施設からピンを選んで「ここに行く！」を押すとホーム画面に戻り、そのお店が先頭カードに入っている想定。近くに行ってから指定するケースを考えているので、キャッシュへの永続化は行わずセッション内のみ反映。

**🔴 RED**

- [x] `backend/handlers/place_picker_test.go` を新規作成し `TestGetVisitablePlaces` を追加（200で施設リスト返却・`lat`/`lng` 欠けで400・30日以内訪問済みは除外・`VisitableTypes` 外は除外・認証なし401）
- [x] `frontend/app/__tests__/hooks/use-suggestion-load.test.ts` に `prependPlace` のテストを追加（呼び出し後に指定施設が `places[0]` に来る・上限4枚で既存3枚に追加した場合も先頭に入る）
- [x] `frontend/app/__tests__/components/PlacePickerMap.test.tsx` を新規作成（マップが表示される・ピンクリックでポップアップが表示される・「ここに行く！」ボタンで `onSelect` コールバックが呼ばれる）

**🟢 GREEN**

- [x] `backend/handlers/place_picker.go` に `PlacePickerHandler` と `GetNearbyVisitablePlaces` メソッドを実装（`GET /api/places/nearby?lat=X&lng=Y`・半径1km固定・`services.IsVisitablePlace(primaryType)` でタイプフィルタ・`services.FilterOutVisited` で30日内訪問済み除外・`services.FilterOutSnoozed` でスヌーズ除外・`GetUserInterestGenreNames`+`GetGenreNameFromPrimaryType` で `is_interest_match`・`IsBreakoutVisit` で `is_breakout` を設定）
- [x] `backend/routes.go` に `GET /api/places/nearby` ルートを追加
- [x] `frontend/app/api/places.ts` に `getNearbyVisitablePlaces(authToken: string, lat: number, lng: number): Promise<Place[]>` を追加
- [x] `frontend/app/hooks/use-suggestion-load.ts` に `prependPlace(place: PlaceWithPhoto) => void` を追加し `use-suggestions.ts` 経由で公開（`places` の先頭に挿入・`originalCardOrder` も更新して CardIndicator のドット表示に対応・描画上限は home.tsx で `slice(0, 4)` で制御）
- [x] `frontend/app/components/iconPaths.ts` に `gps-fixed`（照準アイコン）を追加
- [x] `frontend/app/components/AppHeader.tsx` を改修（`onLocationClick` でピルをタップ可能ボタンに・照準アイコン追加・`onClose` prop 追加でピッカーオープン中は戻るボタン+「行き先を選ぶ」表示に切り替え・プロフィールリンク削除）
- [x] `frontend/app/components/PlacePickerMap.tsx` を新規作成（`@vis.gl/react-google-maps` でマップ表示・`getNearbyVisitablePlaces` でピン取得・`PinMarker` 再利用・ピンタップで施設ポップアップ表示・「ここに行く！」ボタンで `onSelect(place)` を呼ぶ・`fixed` オーバーレイではなくレイアウトフロー内に組み込み AppHeader と「Roamble」ロゴ位置を共有）
- [x] `frontend/app/routes/home.tsx` に `PlacePickerMap` の表示状態管理と `prependPlace` 呼び出しを追加・`places.slice(0, 3)` を `places.slice(0, 4)` に変更

**🔵 REFACTOR**

- [x] `VisitMap.tsx` と `PlacePickerMap.tsx` の `PinMarker` 共通化は差異が小さく切り出しのメリットが薄いため見送り

---

### 成人向け施設（居酒屋・バー・クラブ）提案設定（Issue #350）

> **背景**: `bar`（居酒屋・バー）・`night_club`（クラブ）は成人向け施設のため、成人していないユーザーが意図せず提案を受けることがある。設定画面から「提案に含める/含めない」をON/OFFできるようにする。デフォルトはオフ（含めない）とし、ユーザーが任意でオンにする。合わせて `User` モデルの未使用フィールド `settings_json` を削除する。

**🔴 RED**

- [x] `backend/services/suggestion_test.go` に `TestFilterAdultVenues` を追加（`bar` タイプは除外される・`night_club` タイプは除外される・それ以外のタイプは除外されない・空スライスは空を返す）
- [x] `backend/handlers/user_test.go` に `TestUpdateMe_EnableAdultVenues` を追加（`enable_adult_venues=true` で200・保存値が正しく反映される・`refresh_suggestions=true` で提案キャッシュがクリアされる）
- [x] `backend/handlers/suggestion_test.go` に `TestSuggest_AdultVenueFilter` を追加（`enable_adult_venues=false` のユーザーには `bar`/`night_club` が含まれない・`enable_adult_venues=true` のユーザーには含まれる）

**🟢 GREEN**

- [x] `backend/models/user.go` の `User` struct に `EnableAdultVenues bool` フィールド追加（`gorm:"default:false;not null" json:"enable_adult_venues"`）・`SettingsJSON *string` フィールドを削除（`AutoMigrate` が `enable_adult_venues` カラムを自動追加する）
- [x] `backend/database/migrate.go` に `dropLegacyColumns(db *gorm.DB) error` を `Migrate` より上に追加し `Migrate` の `AutoMigrate` 完了後に呼び出す。`db.Migrator().HasColumn(&models.User{}, "settings_json")` で存在確認してから `db.Migrator().DropColumn(&models.User{}, "settings_json")` を実行する（本番・ローカル・テストDBのいずれでも安全に動作するよう、カラムが存在しない場合はスキップ）
- [x] `backend/services/suggestion.go` に `AdultVenueTypes = map[string]bool{"bar": true, "night_club": true}` と `FilterAdultVenues(places []PlaceResult) []PlaceResult` を追加
- [x] `backend/handlers/suggestion.go` の `resolveRadius` を `resolveUserSettings(userID uint64) (radius uint, enableAdultVenues bool)` に拡張し、`Suggest` 内で `enable_adult_venues=false` の場合に `FilterAdultVenues` を適用（`fetchPlacesFromCacheOrAPI` の後・`FilterOpenNowPlaces` の前）。`findDailySuggestionCache` 内でも同様に適用
- [x] `backend/handlers/user.go` の `updateMeRequest` に `EnableAdultVenues *bool json:"enable_adult_venues"` を追加し `UpdateMe` で保存。設定変更時は `refresh_suggestions=true` 時にキャッシュクリア（既存の `search_radius` 変更と同じパターン）
- [x] `frontend/app/types/auth.ts` の `User` 型に `enable_adult_venues: boolean` を追加
- [x] `frontend/app/api/users.ts` に `updateAdultVenueSetting(authToken: string, enabled: boolean, refreshSuggestions?: boolean): Promise<{ reload_count_remaining: number }>` を追加
- [x] `frontend/app/routes/settings.tsx` の `clientLoader` で `user.enable_adult_venues` を `SuggestionTab` に渡す
- [x] `frontend/app/components/SuggestionTab.tsx` に「居酒屋・バー・クラブを提案に含める」トグルスイッチセクションを追加（初期値は `user.enable_adult_venues`・保存時は `RefreshSuggestionsModal` を経由してキャッシュクリア）

**🔵 REFACTOR**

- [x] なし

---

### ジャンル判定を primaryType 単体に統一（Issue #351）

> **背景**: Google Places APIのtypes[]配列に対して優先順位リストで判定するロジックが、バックエンド（`placeTypePriority` + `GetGenreNameFromTypes`）とフロントエンド（`PLACE_TYPE_PRIORITY` + `pickCategoryFromAPIPlaceTypes`）の両方に二重実装されている。New Places API（v1）が返す `primaryType`（単一フィールド）を使えば優先順位制御が不要になり、判定ロジックをバックエンドの単純なマップ参照1本に絞れる。フロントは受け取った `primary_type` をそのまま表示するだけにする。

**🔴 RED**

- [x] `backend/services/suggestion_test.go` の `TestGetGenreNameFromTypes` を `TestGetGenreNameFromPrimaryType` に書き換え（`"cafe"` → `"カフェ"`・未知タイプ → 空文字）
- [x] `backend/services/suggestion_test.go` の `TestIsVisitablePlace` / `TestIsVisitablePlace_ExcludedTypes` を文字列単体引数に書き換え（`IsVisitablePlace("cafe")` → true、`IsVisitablePlace("park")` → false）
- [x] `backend/services/suggestion_test.go` の `TestFilterAdultVenues` を `PrimaryType` フィールドベースに書き換え、`izakaya_restaurant` も除外されることを追加検証
- [x] `backend/services/suggestion_test.go` の `TestClassifyByInterest` を `PrimaryType: "cafe"` フィールドに書き換え（`Types` フィールド削除）
- [x] `backend/handlers/suggestion_test.go` の `PlaceResult` 生成箇所をすべて `Types: []string{...}` → `PrimaryType: "..."` に書き換え
- [x] `backend/handlers/visit_test.go` の `createVisitRequest` に含まれる `place_types` を `primary_type` に書き換え
- [x] `frontend/app/__tests__/components/discovery-card.test.tsx` のモックデータ `types: [...]` → `primary_type: "..."` に書き換え

**🟢 GREEN**

- [x] `backend/services/suggestion.go` の `PlaceResult` struct: `Types []string` を `PrimaryType string` に変更
- [x] `backend/services/suggestion.go` の `placeTypePriority` 変数を削除
- [x] `backend/services/suggestion.go` の `GetGenreNameFromTypes(types []string) string` → `GetGenreNameFromPrimaryType(primaryType string) string`（`placeTypeToGenreName[primaryType]` の単純マップ参照）
- [x] `backend/services/suggestion.go` の `IsVisitablePlace(types []string) bool` → `IsVisitablePlace(primaryType string) bool`（`VisitableTypes[primaryType]` の単純マップ参照）
- [x] `backend/services/suggestion.go` の `FilterAdultVenues`: `p.Types` ループ → `AdultVenueTypes[p.PrimaryType]` に変更、`AdultVenueTypes` に `izakaya_restaurant` / `yakitori_restaurant` / `wine_bar` を追加
- [x] `backend/services/suggestion.go` の `ClassifyByInterest`: `GetGenreNameFromTypes(p.Types)` → `GetGenreNameFromPrimaryType(p.PrimaryType)` に変更
- [x] `backend/services/suggestion.go` の `VisitableTypes` を拡張: `izakaya_restaurant` / `yakitori_restaurant` / `wine_bar` / `coffee_shop` / `tea_house` 等 `placeTypeToGenreName` に存在するタイプを追加
- [x] `backend/handlers/suggestion.go` の `nearbySearchFieldMask`: `places.types` を削除し `places.primaryType` を追加
- [x] `backend/handlers/suggestion.go` の `nearbySearchPlace` struct: `Types []string` を削除し `PrimaryType string` を追加
- [x] `backend/handlers/suggestion.go` の `NearbySearch`: `PlaceResult` 生成時に `PrimaryType: p.PrimaryType` をセット、`Types` 削除、`IsVisitablePlace` 呼び出しを `IsVisitablePlace(p.PrimaryType)` に変更
- [x] `backend/handlers/visit.go` の `createVisitRequest`: `PlaceTypes []string` → `PrimaryType string` に変更
- [x] `backend/handlers/visit.go` の `resolveGenreFromPlaceTypes(db, userID, []string)` → `resolveGenreFromPrimaryType(db, userID, primaryType string)` に変更（`GetGenreNameFromPrimaryType` 使用）
- [x] `backend/handlers/place_picker.go` の `GetGenreNameFromTypes` → `GetGenreNameFromPrimaryType` に変更、`IsVisitablePlace` 呼び出しも更新
- [x] `frontend/app/types/suggestion.ts` の `Place`: `types: string[]` を削除し `primary_type: string` を追加
- [x] `frontend/app/lib/category-map.ts` の `PLACE_TYPE_PRIORITY` と `pickCategoryFromAPIPlaceTypes()` を削除、`CATEGORY_MAP` に `izakaya_restaurant` / `yakitori_restaurant` / `wine_bar`（barと同デザイン）/ `coffee_shop` / `tea_house`（cafeと同デザイン）のエントリを追加
- [x] `frontend/app/components/DiscoveryCard.tsx:36`: `getCategoryInfo(pickCategoryFromAPIPlaceTypes(place.types))` → `getCategoryInfo(place.display_type)` に変更
- [x] `frontend/app/hooks/use-check-in.ts`: `pickCategoryFromAPIPlaceTypes(place.types ?? [])` → `place.primary_type ?? ""`、`place_types: place.types` → `primary_type: place.primary_type` に変更

**🔵 REFACTOR**

- [x] フロント側に `pickCategoryFromAPIPlaceTypes` の参照が残っていないことを確認（`grep` で検索）
- [x] バックエンド側に `placeTypePriority` / `GetGenreNameFromTypes` の参照が残っていないことを確認

---

## Phase 3 計画（iOS）— #321・#322・#344・#346 対応後に着手

### XP獲得・バッジ取得時の効果音追加（Issue #320）

> **背景**：訪問記録・XP付与・バッジ取得時に効果音がなく達成感が弱い。Webより iOS ネイティブで実装する方が体験が良いため Phase 3 に移動。

**🔴 RED**

- [ ] 効果音再生ロジックのユニットテスト

**🟢 GREEN**

- [ ] 効果音ファイルの追加（XP獲得音・バッジ取得音）
- [ ] 効果音再生処理の実装
- [ ] 訪問記録完了・バッジ取得確認の各箇所での呼び出し

**🔵 REFACTOR**

- [ ] なし

---

### Receipt of Courage（勇気の証明書）実装（Issue #345）

> **背景**: 訪問完了時にレシート形式の画像を生成・SNSシェアできる機能。「今日○○カフェに初めて入りました / 23軒目の開拓」という1枚がInstagram StoriesやTikTokで流れることが最大の獲得チャネルになりうる。Web Share API より iOS ネイティブシェアの方が体験が圧倒的に良いため Phase 3 に移動。

**🔴 RED**

- [ ] シェア画像生成ロジックのユニットテスト（お店名・XP・累計開拓数が正しく含まれるか）

**🟢 GREEN**

- [ ] バックエンド: 訪問記録APIレスポンスに `receipt_data`（お店名・獲得XP・累計開拓数・バッジ名）を追加
- [ ] レシートカードのデザイン: お店名・ジャンル・獲得XP・「○軒目の開拓」カウント・日付
- [ ] XP獲得後の画面にシェアボタン追加
- [ ] iOS ネイティブシェアシートへの連携

**🔵 REFACTOR**

- [ ] なし

---

## マーケティング（継続）

> ブランド構築・SNSアカウント・初期コンテンツはすべて完了済み。

- [~] **開発ログの継続投稿**: X / Instagram / TikTok で開発内容や気づきを共有する
- [ ] **Product Hunt / 開発系コミュニティへの「予告」**（Optional）
  - [ ] "Upcoming" ページ等の活用検討
