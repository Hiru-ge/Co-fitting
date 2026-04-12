# TODO — ベータ版ロードマップ

> Phase 1 の実装・インフラ準備はすべて完了。**3/7（土）のベータ版公開**に向けた最終確認フェーズ。
> 現在のドメイン: `roamble.app`（本番）/ `roamble.pages.dev`（Cloudflare Pages デフォルト）

---

## セキュリティ確認

### フロントエンド

- [ ] `localStorage` に保存しているトークンに対して XSS リスクがある場合、Content-Security-Policy ヘッダーが設定されているか（`public/_headers` に CSP 未設定。ベータ版では許容範囲だが、正式リリース前に追加推奨）
- [ ] リフレッシュトークンを httpOnly Cookie に移行する（現状は `localStorage` に保存しており、XSS が刺さると盗まれるリスクがある。対応にはバックエンドでの Cookie 発行・CSRF 対策とセットで実装が必要。ユーザー数が増えるフェーズで対応を検討）
s
---

## 3/8〜: Optional（ひと段落後）

- [ ] Product Hunt "Upcoming" ページの活用

---

## Phase 1 バグ修正・機能改善

### 提案除外ジャンル設定実装（Issue #298）

> **背景**: 公園など「苦手ではないが行きたくもない」ジャンルが頻繁に提案される問題への対応。
> 3ステートトグル（未設定→興味あり→除外）で興味タグ設定画面に統合。除外ジャンルは提案から完全除外するが、訪問自体は妨げないためXPは通常通り付与する。

**🔴 RED**

- [ ] `backend/handlers/user_test.go` に `TestUpdateInterests_ExcludedStatus` テスト追加
  - `status: "excluded"` を含むリクエスト → DBに保存されるか検証
  - `status: "interested"` が3件未満 → 400を返すか検証
- [ ] `backend/handlers/suggestion_test.go` に `TestGetSuggestions_ExcludesExcludedGenres` テスト追加
  - excludedジャンルの場所が候補に含まれないか検証

**🟢 GREEN**

- [ ] `backend/models/gamification.go` の `UserInterest` 構造体に `Status string \`gorm:"type:enum('interested','excluded');default:'interested';not null" json:"status"\`` フィールド追加
- [ ] `backend/database/migrate.go` の AutoMigrate でカラム追加反映
- [ ] `backend/handlers/user.go` の `UpdateInterests` ハンドラ:
  - リクエスト型を `[]struct{ GenreTagID uint64 \`json:"genre_tag_id"\`; Status string \`json:"status"\` }` に変更
  - `interested` が3件以上のバリデーション追加
  - レスポンスの `interestResponse` に `status` フィールド追加
- [ ] `backend/handlers/suggestion.go` の `getUserInterestGenreNames()`: `WHERE status = 'interested'` 条件を追加
- [ ] `backend/handlers/suggestion.go` の候補フィルタリング: `excluded` ジャンルに該当する場所を除外
- [ ] `frontend/app/types/genre.ts` の `Interest` 型に `status: 'interested' | 'excluded'` フィールド追加
- [ ] `frontend/app/api/genres.ts` の `updateInterests()` リクエストボディを `{ genre_tag_ids: number[] }` から `{ interests: { genre_tag_id: number; status: string }[] }` に変更
- [ ] `frontend/app/routes/settings.tsx`: ジャンルタグの3ステートトグルUI実装
  - 未設定（グレー）→ 1回タップ → 興味あり（現行の選択状態）→ 2回タップ → 除外（バツ表示）→ 3回タップ → 未設定
  - セクションに静的テキスト追加「本当に苦手なジャンル以外の除外は、成長の機会を逃すかも！」

**🔵 REFACTOR**

- [ ] 除外ジャンルのフィルタリングロジックを `getExcludedGenreNames()` 関数に切り出し
- [ ] トグル状態管理をカスタムフックに切り出し検討

---

## バックエンドコード読解から洗い出したバグ修正・リファクタリング

### 仕様変更・機能改善

#### 今すぐ行ける場所のみ表示トグルUI実装（Issue #318）

> **背景**: Issue #306（`filter_open_now` デフォルト値を `true` に変更する修正）を再設計。デフォルトを常時ONにすると「営業時間データが存在しない場所が一律除外される」「別に営業時間外でも表示して欲しいユーザーはいそう(すぐにいくわけじゃないユーザー等)」という問題が考えられた。真にやってほしいことは「ユーザーが任意に切り替えられるトグルUIを提供し、ONにしたときは営業時間内 OR 営業時間データなしのスポットを表示する」ことだと判断し、要件を整理して再起票。

**🔴 RED**
- [ ] `backend/handlers/suggestion_test.go` に `TestGetSuggestions_FilterOpenNow_IncludesNoHours` テスト追加（`filter_open_now=true` 時に営業時間データなしの場所が含まれることを検証）

**🟢 GREEN**
- [ ] `backend/handlers/suggestion.go` の `filter_open_now=true` 時のフィルタロジックを「営業時間内 OR 営業時間データなし」に修正
- [ ] `frontend/app/routes/suggestions.tsx`（または提案画面）に「今すぐ行ける場所のみ」トグル追加、ON時に `filter_open_now=true` を送信

**🔵 REFACTOR**
- [ ] なし

---

## デイリーノートから洗い出した改善・バグ修正

### XP獲得・バッジ取得時の効果音追加（Issue #320）

> **背景**：訪問記録・XP付与・バッジ取得時に効果音がなく達成感が弱い。

**🔴 RED**

- [ ] `frontend/app/lib/sound.ts` の `playSoundEffect()` 呼び出しに対するユニットテスト（Web Audio API をモック）

**🟢 GREEN**

- [ ] 効果音ファイルを `frontend/public/sounds/` に追加（XP獲得音・バッジ取得音）
- [ ] `frontend/app/lib/sound.ts` に `playSoundEffect(type: 'xp' | 'badge'): void` 実装
- [ ] 訪問記録完了・バッジ取得確認の各コンポーネントで `playSoundEffect()` を呼び出す

**🔵 REFACTOR**

- [ ] なし

### スポット一時スキップ機能（Issue #321）

> **背景**：気になっているが今日は行けない・行きたくない場合に「N日間この場所を表示しない」と設定できると、提案リストの体感精度が上がる。

**🔴 RED**

- [ ] `backend/handlers/suggestion_test.go` に `TestGetSuggestions_ExcludesSkippedSpots` テスト追加（スキップ登録済みの場所が提案に含まれないことを検証）

**🟢 GREEN**

- [ ] `backend/models/skip.go` に `SpotSkip` 構造体追加（`user_id uint64`, `place_id string`, `skip_until time.Time`）
- [ ] `backend/database/migrate.go` の AutoMigrate に `SpotSkip` 追加
- [ ] `POST /api/spots/:place_id/skip` エンドポイント実装（ボディ: `{ days: int }`）
- [ ] `backend/handlers/suggestion.go` のフィルタリングで有効期限内スキップ対象の場所を除外
- [ ] `frontend/app/api/spots.ts` に `skipSpot(placeId: string, days: number)` 追加
- [ ] 提案カードに「N日間スキップ」ボタン追加・`skipSpot()` 呼び出し実装

**🔵 REFACTOR**

- [ ] 期限切れ `SpotSkip` レコードの定期削除をスケジューラーに追加

---

### 多言語対応・英語UI（Issue #322）

> **背景**：ベータ版は日本語のみ。Product Hunt等での国際展開・海外ユーザー獲得に向けて、UIを英語に切り替えられるようにする。ブラウザの `Accept-Language` を優先し、設定画面から手動切り替えも可能にする。フォールバックは日本語。

**🔴 RED**

- [ ] `frontend/app/i18n/ja.json` と `en.json` のキー集合が一致することを検証するテスト追加（翻訳漏れをCIで検出）

**🟢 GREEN**

- [ ] `react-i18next` / `i18next` / `i18next-browser-languagedetector` を追加（`npm install react-i18next i18next i18next-browser-languagedetector`）
- [ ] `frontend/app/i18n/ja.json`（既存日本語テキストをキー化）と `frontend/app/i18n/en.json`（英語翻訳）を作成
- [ ] `frontend/app/i18n/index.ts` で i18next 初期化（ブラウザ言語検出・フォールバック `ja`）
- [ ] `frontend/app/root.tsx` に `I18nextProvider` を追加
- [ ] 各ルートファイルのハードコード文字列を `t('キー')` に置換
- [ ] `frontend/app/routes/settings.tsx` に言語切り替えセレクタ追加（`ja` / `en`）
- [ ] バックエンドの主要エラーレスポンス `message` フィールドを `Accept-Language` ヘッダーに応じて日英切り替え

**🔵 REFACTOR**

- [ ] 翻訳キーを `画面名.要素名` の階層構造に統一（例：`suggestions.emptyState`、`profile.levelBadge`）

---

## フロントエンドコード読解から洗い出したバグ修正・リファクタリング

### Redis 日次提案キャッシュキーバグ修正（Issue #323）

> **背景**：`backend/database/redis.go:86` の `GenerateDailySuggestionCacheKey` が緯度経度（`%.2f` 精度 ≒ 約 1km）をキーに含めているため、移動距離がこの精度を超えるたびにキャッシュミスが発生し、リロードなしでカードがリフレッシュされる。日次提案キャッシュはユーザー × 日付で一意であれば十分であり、緯度経度はキーに含める必要がない。

**🔴 RED**

- [x] `backend/database/redis_test.go` に `TestGenerateDailySuggestionCacheKey_NoLatLng` テスト追加（緯度経度が異なる2回の呼び出しで同一キーが返ることを検証）
- [x] その他テストコード内で `GenerateDailySuggestionCacheKey` / `GetDailySuggestions` / `SetDailySuggestions` を呼び出している箇所の引数から緯度経度を削除

**🟢 GREEN**

- [x] `backend/database/redis.go` の `GenerateDailySuggestionCacheKey(userID, date string, lat, lng float64) string` から `lat, lng float64` 引数を削除し、`fmt.Sprintf("suggestion:daily:%s:%s", userID, date)` 形式に変更
- [x] `GetDailySuggestions` / `SetDailySuggestions` のシグネチャからも `lat, lng float64` を削除
- [x] `backend/handlers/suggestion.go` の呼び出し箇所を合わせて修正

**🔵 REFACTOR**

- [ ] なし

---

### 消すべきではなかった訪問履歴のfrom,untilフィルタを復活（Issue #324）

> **背景**：`summary.weekly.tsx:73` / `summary.monthly.tsx` は `listVisits(token, 100, 0, from, until)` で `from`/`until` を渡しているが、バックエンドの `handlers/visit.go` の `ListVisits` は `limit`/`offset` しか受け付けておらず日付パラメータを無視している。「先週/先月の訪問だけを表示する」機能が動いておらず、直近100件が全件返ってくる。Issue #309 で削除した方向とは逆に、バックエンド側で `from`/`until` クエリパラメータを読んで `WHERE visited_at BETWEEN ? AND ?` を適用する変更が必要。

**🔴 RED**

- [x] `backend/handlers/visit_test.go` に `TestListVisits_DateFilter` テスト追加（`from`/`until` を渡したときに期間外のレコードが含まれないことを検証）

**🟢 GREEN**

- [x] `backend/handlers/visit.go` の `ListVisits` に `c.Query("from")` / `c.Query("until")` を読み取り `WHERE visited_at >= ?` / `WHERE visited_at <= ?` 条件を追加
- [x] クエリパラメータのバリデーション追加（RFC3339Nano形式であることを確認し、パースエラー時は400を返す）, `from` と `until` の矛盾チェック（`from > until` の場合も400を返す）
- [x] `api/visits.ts` の `listVisits` 関数の `from?`/`until?` 引数を正式対応として残す（削除不要）

**🔵 REFACTOR**

- [ ] なし

---

### 型定義・API定義の陳腐化修正（Issue #325）

> **背景**：バックエンドの仕様変更（Issue #304・#309）に伴い削除されたフィールドがフロント側の型定義・API関数に残存している。型が実態と乖離しているため、送っても無視されるが誤解を生む。

**🔴 RED**

- [ ] なし（型削除のみのため）

**🟢 GREEN**

- [x] `frontend/app/api/visits.ts` の `CreateVisitRequest` 型から `rating?: number` / `memo?: string` を削除（Issue #304 でバックエンド削除済み）
- [x] `frontend/app/types/visit.ts` の `XPBreakdown` 型から `memo_bonus: number` を削除（Issue #304 でメモボーナスXP廃止済み）
- [x] `frontend/app/types/visit.ts` の `CreateVisitResponse` フィールド（`xp_earned` / `total_xp` / `level_up` / `new_level` / `new_badges` / `daily_completed`）から不要な `?` を削除（バックエンドの `createVisitResponse` struct は全フィールド `omitempty` なし）
- [x] `frontend/app/types/visit.ts` の `MapVisit` 型をバックエンドの `mapVisitItem`（`genre_tag_id` あり・`is_breakout` なし）に合わせて修正
- [x] `frontend/app/api/suggestions.ts` の `forceReload` パラメータを `isReload` にリネーム（バックエンド JSON キーも `is_reload` に統一）
- [x] `frontend/app/types/env.d.ts` の `ImportMetaEnv` に `readonly VITE_BETA_PASSPHRASE?: string` を追加（`CLAUDE.md` に記載あるが宣言欠落）

**🔵 REFACTOR**

- [x] `frontend/app/hooks/use-suggestions.ts` の `result.total_xp ?? 0` 等のフォールバックを削除（`?` 削除に伴い不要になる）

---

### ゲーミフィケーション失敗時の XPBreakdown ゼロ値返却（Issue #340）

> **背景**：`CreateVisit` ハンドラのゲーミフィケーション失敗パスで、他フィールド（`TotalXP: 0`、`LevelUp: false` 等）はゼロ値を明示しているのに `XPBreakdown` だけ省略している。設計の一貫性がなく、フロントで `xp_breakdown?` を optional にせざるを得ない原因になっている。

**🔴 RED**

- [ ] なし（動作変更なし・型の整合が主目的）

**🟢 GREEN**

- [x] `backend/handlers/visit.go` のゲーミフィケーション失敗パスに `XPBreakdown: models.XPBreakdown{}` を追加
- [x] `frontend/app/types/visit.ts` の `CreateVisitResponse.xp_breakdown` から `?` を削除

**🔵 REFACTOR**

- [ ] なし

---

### SEO・コピーライティングの整合性修正（Issue #326）

> **背景**：キャッチコピーが3箇所で異なる表現になっており、SEO観点でも `<title>` と OGP が一致していない。また `root.tsx` の `description` メタタグに「コンフォートゾーン」が含まれているが、`docs/marketing/marketing-strategy.md` ではこの言葉を使わない方針。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [x] `frontend/app/root.tsx:108` の default title を `lp.tsx` の表現（「いつも同じ店」を抜け出す、新しいお店開拓アプリ）に変更
- [x] `frontend/app/root.tsx:111` の `description` メタタグからコンフォートゾーン表現を削除し、マーケティング方針に沿った表現に変更
- [x] `frontend/app/routes/pwa-prompt.tsx:60` のサブコピーを title と統一した表現に変更
- [x] `frontend/public/images/lp/batch-modal.png` を `badge-modal.png` にリネーム、`lp.tsx:268` の参照も修正（ファイル名 typo）

**🔵 REFACTOR**

- [ ] なし

---

### プロフィール画面の情報充実（Issue #327）

> **背景**：(1) ジャンル熟練度が上位3件に固定されており、ユーザーが脱却モード対象ジャンルや熟練度の全体像を把握できない。(2) バッジ獲得数が総数に対する割合で表示されておらず達成感が伝わりにくい。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [x] `frontend/app/routes/profile.tsx` の `proficiency.slice(0, 3)` を削除し、訪問実績のある全ジャンルを表示するよう変更
- [x] `frontend/app/routes/profile.tsx` のバッジ表示を `{badges.length} 個` から `{badges.length} / {totalBadgeCount} 個` 形式に変更。`GET /api/badges` レスポンスを利用して `totalBadgeCount` を取得する

**🔵 REFACTOR**

- [ ] なし

---

### `level.ts` のXP定義をバックエンドと統一（Issue #328）

> **背景**：`frontend/app/utils/level.ts` の `LEVEL_XP_THRESHOLDS` はLv.10まで・手動設定の閾値だが、バックエンドの `gamification.go` はLv.30まで・67XP増分の指数カーブで計算している。同じ `totalXp` からフロントとバックが異なるレベル・進捗を算出するため、プログレスバー・次のレベルまでのXP・称号がバックエンドの返す値とズレる。

**🔴 RED**

- [x] `frontend/app/__tests__/utils/level.test.ts` に `TestLevelConsistency_WithBackend` テスト追加（バックエンドと同じXP値を渡したときに同一レベルが返ることを検証。バックエンドの計算式を参照してテストケースを設計する）

**🟢 GREEN**

- [x] `frontend/app/utils/level.ts` の `LEVEL_XP_THRESHOLDS` をバックエンド（`gamification.go`）の計算式（67XP増分・Lv.30）に合わせて更新
- [x] `LEVEL_TITLES` を Lv.30 まで定義（Lv.11以降の称号を追加）
- [x] `nextLevelStartXp ?? currentLevelStartXp + 1000` のフォールバックを `isMaxLevel` の条件分岐で適切に処理

**🔵 REFACTOR**

- [x] `currentLevelStartXp ?? 0` と `getLevelTitle` の `?? LEVEL_TITLES[0]` など到達不能なフォールバックを削除

---

### `use-suggestions.ts` の責務分割（Issue #329）

> **背景**：`frontend/app/hooks/use-suggestions.ts` が19個の返り値・14個のstate・位置情報取得・提案フェッチ・訪問記録・XP/バッジキュー管理をすべて1フックに抱えており、保守・テストが困難。位置情報取得 / 提案フェッチ / 訪問記録チェックインの3責務に分割する。

**🔴 RED**

- [ ] `frontend/app/__tests__/hooks/use-location.test.ts` 追加（位置情報取得・ポーリング・デフォルト位置フォールバックの各状態遷移を検証）
- [ ] `frontend/app/__tests__/hooks/use-check-in.test.ts` 追加（訪問記録・XPキュー・バッジキューの状態遷移を検証）

**🟢 GREEN**

- [ ] `frontend/app/hooks/use-location.ts` を新規作成（位置情報取得・ポーリング・デフォルト位置フォールバック。`LocationStatus = "normal" | "denied" | "using_default"` の1変数で状態管理）
- [ ] `frontend/app/hooks/use-suggestion-load.ts` を新規作成（提案フェッチ・写真並列取得・リロード）
- [ ] `frontend/app/hooks/use-check-in.ts` を新規作成（訪問記録・XP/バッジキュー管理。`handleXpModalClose` からバッジ転送処理を独立させる）
- [ ] `frontend/app/hooks/use-suggestions.ts` を上記3フックを束ねるアグリゲーター層に変更
- [ ] `frontend/app/routes/home.tsx` の呼び出し側に変更がないことを確認（`useSuggestions` のインターフェース維持）

**🔵 REFACTOR**

- [ ] `badgeQueue` → `badgeModalQueue`、`checkingIn` → `isCheckingIn`、`originalOrder` → `originalCardOrder` にリネーム
- [ ] `useCallback` の依存配列から `navigate`（`loadSuggestions` 内で未使用）を削除
- [ ] `initialLoadDoneRef`（Strict Mode 対策の ref ガード）を削除し、React Query の `useQuery` 導入で代替

---

### `SummaryLayout.tsx` のリファクタリング（Issue #330）

> **背景**：`frontend/app/components/SummaryLayout.tsx` が (1) 全要素をインラインスタイルで書いておりプロジェクトの Tailwind 統一記法と乖離、(2) `StatCard` / リスト行が重複実装、(3) 深いネストをアーリーリターンで解消できる、(4) コンポーネント名が `layouts/` 配下のルーターレベルレイアウトと混同しやすい、という複数の問題を抱えている。

**🔴 RED**

- [x] なし（表示変化なしのリファクタのため）

**🟢 GREEN**

- [x] `SummaryLayout` → `SummaryReport` にリネーム（`weekly.tsx` / `monthly.tsx` の import も更新）
- [x] 全インラインスタイルを Tailwind CSS に書き直す（カスタムカラーは `app.css` の `@theme` に追加）
- [x] 訪問数カードとXPカードを `StatCard` コンポーネントとして切り出し、重複JSXを削除
- [x] `isLoading` / `errorMessage` の条件分岐をアーリーリターンに変換してネスト解消

**🔵 REFACTOR**

- [x] `VisitRow` / `BadgeRow` として `map` の本体を切り出し可読性向上

---

### E2Eテストのコア機能カバレッジ追加（Issue #331）

> **背景**：`frontend/e2e/main-flow.spec.ts` がルーティング・認証ガードに偏っており、提案生成・チェックイン・XP/バッジ付与・履歴確認といったアプリ固有のコアフローが一切テストされていない。

**🔴 RED**

- [ ] `frontend/e2e/suggestions.spec.ts` を新規作成し以下のシナリオを追加:
  - 位置情報許可 → 提案カード表示
  - 位置情報拒否 → デフォルト位置フォールバックで提案カード表示
  - リロードボタンで別提案が表示される
  - リロード上限到達 → 上限エラーメッセージ表示
  - 全スポット訪問済み（`ALL_VISITED_NEARBY`）→ エラーメッセージ表示
- [ ] `frontend/e2e/check-in.spec.ts` を新規作成し以下のシナリオを追加:
  - チェックイン → XPモーダル表示（獲得XP・内訳確認）
  - チェックイン → レベルアップ時のレベルアップ表示確認
  - チェックイン → バッジ獲得時のバッジモーダル表示確認
  - 3件チェックイン → Complete Card（日次上限達成）表示確認
- [ ] `frontend/e2e/history.spec.ts` を新規作成し以下のシナリオを追加:
  - チェックイン後に履歴画面を開くと該当レコードが表示される
  - 履歴詳細でメモ・レーティングを保存 → 反映確認

**🟢 GREEN**

- [ ] 各シナリオが通るようにテストヘルパー（バックエンドモックまたは `devTestLogin` 経由の実データ）を整備

**🔵 REFACTOR**

- [ ] なし

---

### フロントエンドのデッドコード・軽微な整理（Issue #332）

> **背景**：複数のファイルで未使用コード・命名規則違反・切り出し過剰なコンポーネントが混在している。機能に影響しないが、コードベースのノイズになっている。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [x] `frontend/app/components/badge-toast.tsx` とテスト `__tests__/components/badge-toast.test.tsx` を削除（どこにも import されていないデッドコード）
- [x] `frontend/app/lib/beta-access.ts` の `lockBeta` 関数を削除（ベータゲート以外で未使用）
- [x] `frontend/app/hooks/use-modal-close.ts` を削除し、`badge-modal.tsx` / `xp-modal.tsx` 等5ファイルから import と呼び出しを除去（Roamble は PWA モバイル前提のため Escape キー対応不要）。合わせて `__tests__/hooks/use-modal-close.test.ts` も削除
- [x] `frontend/app/hooks/use-push-banner-visible.ts` を `PushNotificationBanner.tsx` 内に同居させる（利用元が1箇所のみ）
- [x] `frontend/app/hooks/use-form-message.ts` を `settings.tsx` 内に同居させる（利用元が `settings.tsx` のみ）
- [x] `frontend/app/routes/home.tsx` の `clientLoader` で取得している `user` を実際に使うか削除する（現状 `loaderData.user` は未参照）
- [x] `frontend/app/routes/history.tsx` の未実装検索ボタン（`history.tsx:119`）を削除するか `onClick` を実装する
- [x] `frontend/app/components/confetti-decoration.tsx` の `POSITIONS` 配列から `rotate` フィールドを削除（アニメーションで上書きされるデッドコード）

**🔵 REFACTOR**

- [x] `frontend/app/components/` 内のファイル名を PascalCase に統一（`app-header.tsx` → `AppHeader.tsx`、`bottom-nav.tsx` → `BottomNav.tsx` 等）
- [x] `frontend/app/lib/auth.ts` の二重 re-export を `export { getToken, setToken, clearToken } from "~/lib/token-storage"` に整理
- [x] `frontend/app/lib/auth.ts` の関数定義順を `googleOAuth` → `getUser` → `logout` の認証フロー順に並べ替え
- [x] `frontend/app/lib/auth.ts` の `getUser` を `api/users.ts` に移動（`apiCall` への薄いラッパーであり `api/` 層が適切）
- [x] `frontend/app/lib/protected-loader.ts` を `auth.ts` に統合（認証フローの一部）
- [x] `frontend/app/lib/token-storage.ts` の `setToken(accessToken, refreshToken?)` の `refreshToken` を必須引数に変更（呼び出し元2箇所は常に両方渡している）。テストコード `auth.test.ts` 側も合わせて修正
- [x] `frontend/app/lib/push.ts` の `getVapidKey`（キャッシュつきラッパー）と `getVapidPublicKey`（API呼び出し）の2関数をインライン化して1関数に統合（呼び出し元は1箇所のみ）
- [x] `frontend/app/routes.ts` の `auth-layout` ラッパーを削除（`login` 1ルートのためだけに `layout()` でラップするのは YAGNI 違反。`route("login", ...)` で直接定義する）
- [x] `frontend/app/routes.ts` の `onboarding.tsx` → `interest-setup.tsx` にリネーム（実態は「興味タグ選択」のみでオンボーディング全体ではない）
- [x] `frontend/app/routes.ts` のルート定義順をユーザーフロー順（ランディング→ログイン→ベータゲート→PWAプロンプト→オンボーディング→ホーム→その他）に整理
- [x] `frontend/app/routes/root.tsx` の `/beta-gate` / `/lp` / `/privacy` 直書きを `BETA_EXCLUDED_PATHS` 定数配列に切り出す
- [x] `frontend/app/routes/root.tsx` の import 文（`@fontsource/...`・`./app.css`）をファイル先頭にまとめる
- [x] `frontend/app/routes/history-detail.tsx` の `LoaderData` / `ComponentProps` インライン型定義を RR v7 の自動生成型（`+types/` 配下）に置き換える（コメントに「worktree では生成されていないため暫定」とある）
- [x] `frontend/app/routes/privacy.tsx` の `Section` / `SubSection` を `Privacy` より上に定義順を修正（依存するサブコンポーネントは呼び出し元より上）
- [x] `frontend/app/routes/profile.tsx` の `ProfileTourStep` を `components/profile-tour-step.tsx` に切り出す（`getBoundingClientRect()` でDOM座標を計算するロジックを持ち、レイアウト変更で黙って壊れる可能性がある）
- [x] `frontend/app/routes/profile.tsx` のツアーキー管理を `ONBOARDING_STAGE` 1つの localStorage キーで統一し、sessionStorage を廃止（タブを閉じるとツアーが中断される問題の解消。home→profile 間の通信は `navigate("/profile", { state: { fromTour: true } })` に変更）
- [x] `frontend/app/api/genres.ts` の `getInterests` / `updateInterests` を `api/users.ts` に移動（エンドポイントは `/api/users/me/interests` でありユーザー設定の一部）
- [x] `frontend/app/api/suggestions.ts` の `SuggestionResult` 型を `~/types/suggestion.ts` に移動（`Place` 型と同じファイルに置くのが適切）
- [x] `frontend/app/api/suggestions.ts` の `radius` 引数を削除（バックエンドの `resolveRadius` が `radius == 0` のとき DB の `users.search_radius` を使うため送信不要。`use-suggestions.ts` の呼び出し箇所で実際に何を渡しているか確認してから削除）
- [x] `frontend/app/api/places.ts` の `photoReference` をオプショナルから必須引数に変更（呼び出し元でスキップ制御すれば渡せる）
- [x] `frontend/app/api/notifications.ts` の `updateNotificationSettings` 戻り値を `Promise<void>` から `Promise<NotificationSettings>` に変更し、呼び出し元 `settings.tsx` で最新の設定値を受け取れるようにする（バックエンドは PUT 後に更新済み設定を返している）
- [x] `frontend/app/components/complete-card.tsx` の `offsetRef` を削除し `handlePointerUp` の deps に `offset` を含める（DiscoveryCard と同様のアプローチに統一）
- [x] `frontend/app/components/complete-card.tsx` の 71〜79行のブランチ重複（`offsetRef.current = ...` / `setOffset(...)` の繰り返し）を分岐外に括り出す
- [x] `frontend/app/components/complete-card.tsx` と `discovery-card.tsx` の共通ポインタ処理（`cardRef` / `startPos` / `dragging` / `handlePointerDown/Move/Up`）を `useCardDrag` カスタムフックに切り出す
- [x] `frontend/app/components/toast.tsx` の `ToastItem` と `ToastProvider` の定義順を入れ替え（`ToastProvider` が `ToastItem` に依存しているため `ToastItem` を上に）
- [x] `frontend/app/components/toast.tsx` の `showToast` デフォルト型を `"error"` から `"info"` に変更（型省略時に赤いエラースタイルになってしまう）
- [x] `frontend/app/utils/` vs `lib/` の配置方針を決定し、ドメインロジックは `lib/` に移動（`category-map.ts`・`geolocation.ts` は `lib/` 相当）
- [x] `frontend/app/routes/settings.tsx` の `INPUT_CLASS` / `SUBMIT_CLASS` を `utils/styles.ts` に切り出しプロジェクト全体で共有
- [x] `frontend/app/components/NotificationTab.tsx` の `NotificationToggle` を `NotificationTab.tsx` 内に統合（他ファイルから import されておらず、独立ファイルにする理由がない）
- [x] `frontend/app/components/NotificationTab.tsx` の `denied` ブランチの二重 IIFE を `getDeniedSteps()` 関数または `DeniedInstructions` コンポーネントに切り出す
- [x] `frontend/app/components/xp-modal.tsx` の `XpBreakdownRow` を `XpModal` より上に定義順を修正
- [x] `frontend/app/components/xp-modal.tsx` の `XpBreakdownRow` の引数型をインラインから事前定義型（`XpBreakdownRowProps`）に統一
- [x] `frontend/app/components/visit-map.tsx` の `PinMarker` / `VisitInfoContent` を `VisitMap` より上に移動（定義順修正）
- [x] `frontend/app/components/PushNotificationBanner.tsx` の `if (!visible) return null` を `handleAllow` / `handleDismiss` の定義後・`return (...)` 直前に移動
- [x] `frontend/app/utils/geolocation.ts` の `calcMapCenter`（訪問履歴の地図中心算出）を `helpers.ts` または `visit-map.tsx` に移動（位置情報取得とは性格が異なる）
- [x] `frontend/app/utils/geolocation.ts` の `startPositionPolling` の `onError` 引数を削除（呼び出し元で一度も渡されていない。エラーをサイレント無視する選択であるとインラインコメントで明示）
- [x] `frontend/app/utils/geolocation.ts` の `isWithinCheckInRange` の `if (userLat === 0 && userLng === 0)` を `const isGpsUnavailable = ...` に切り出して意図を明示
- [x] `frontend/app/components/bottom-nav.tsx` の `useLocation` 使用箇所に、`NavLink className` 関数引数から `<span>` に `isActive` を渡せないためやむなく使っているという理由コメントを追加
- [x] `CLAUDE.md` のフロントエンド注意事項に `app-layout.tsx` のレイアウト規約（BottomNavの高さ分は app-layout が管理・各ページは `pb-24` を追加しないこと）を追記

---

### 命名規則統一（`is` プレフィックス・boolean変数名・各ファイルの変数名改善）（Issue #333）


> **背景**：フロント全体にわたって boolean 変数・props に `is` プレフィックスが欠落しているケース、関数・変数の命名が実態と乖離しているケースが多数ある。また `token` 変数名が認証トークンと Push通知 VAPID トークンの両方に使われており混乱を招く。`result.daily_completed` / `level_up` はバックエンドのレスポンスキーの boolean フィールドに `is_` が付いていない問題を含む（フロント型定義とバックエンドを両方変更）。

**🔴 RED**

- [ ] なし（命名変更のみのため）

**🟢 GREEN**

- [x] **全体**: 認証トークンを受け取る変数・引数を `authToken` に統一（`index.tsx` clientLoader 内・`api/*.ts` 引数名・各ルートの clientLoader 内変数名）
- [x] **`xp-modal.tsx`**: `levelUp` → `isLevelUp`、`highlight` → `isHighlight`、`showPlus` → `isShowPlus`（boolean prop は `is` プレフィックス規則）。変更箇所は `home.tsx`・`use-suggestions.ts`（型定義と代入）・テストファイルを含む
- [x] **`xp-modal.tsx`**: `xpBreakdown.base_xp >= 100` を `const isBreakout = xpBreakdown.base_xp >= 100` に切り出す（`label` と `highlight` の両方で同じ条件を参照）
- [x] **`visit-map.tsx`**: `positionReady` → `isPositionAvailable`（setter も `setIsPositionAvailable` に）
- [x] **`discovery-card.tsx`**: `stackIndex` → `depthFromTop`（JSDocコメントを削除できる）、`showPhoto` → `hasValidPhoto`
- [x] **`NotificationToggle.tsx`**: `checked` → `isChecked`（boolean prop）
- [x] **`NotificationTab.tsx`**: `ariaLabel` → `screenReaderLabel`（用途が伝わる命名に）
- [x] **`home.tsx`**: `showTour` → `isShowTour`、`isCurrentVisited` と `isVisited` のブレを `isVisited` に統一
- [x] **`onboarding.tsx`**: `toggleTag` → `updateSelectedTags`（実態は配列への追加・除外で boolean トグルではない）
- [x] **`settings.tsx`**: `toggleGenre` → `updateSelectedGenre`（同上）、`doSaveRadius` / `doSaveInterests` → `saveRadius` / `saveInterests`（`do` プレフィックスは慣習外）、`permState` → `permissionState`（略語を展開）
- [x] **`pwa-prompt.tsx`**: `dismissPWAPrompt` → `reviewPWAPrompt`（インストール完了後にも呼ぶため「拒否」の意味合いになっている）
- [x] **`protected-loader.ts`**: `protectedLoader` → `authRequiredLoader`（何を protect しているかが名前から伝わる）
- [x] **`profile.tsx`**: `el` / `rect` → `xpSectionEl` / `xpSectionRect`（何の要素・矩形か伝わる）
- [x] **`use-suggestions.ts`**: `skipped`（handleSwipe 内・225行目）→ `skippedPlace`
- [x] **`PushNotificationBanner.tsx`**: `visible` → `isBannerVisible`（boolean 変数に `is` プレフィックス）
- [x] **`geolocation.ts`**: `calcDistance` → `calcHaversineDistance`（バックエンドの `HaversineDistance` と統一）、引数名 `lat1/lng1/lat2/lng2` → `fromLat/fromLng/toLat/toLng`、`getPositionWithFallback` → `getCurrentPositionWithFallback`
- [x] **バックエンド + フロント**: `createVisitResponse` / 型定義の `daily_completed` / `level_up` を `is_daily_completed` / `is_level_up` に変更（boolean フィールドは `is_` プレフィックスに統一。Go側の struct タグ・JSON キー・フロントの型定義・使用箇所を両方修正）

**🔵 REFACTOR**

- [ ] `vicinity` フィールド名を `address` または `areaName` にリネーム（Google Places 旧 API フィールド名 `vicinity` が型定義を通じてフロント全体に伝播している。バックエンドのレスポンスキー名変更も必要なため、影響範囲を確認してから着手。使用箇所: `types/suggestion.ts`・`types/visit.ts`・`home.tsx:132`・`history.tsx:301`・`history-detail.tsx:177`・`use-suggestions.ts:261`）

---

### `error.ts` のリファクタリング（Issue #334）


> **背景**：`frontend/app/utils/error.ts` に複数の構造問題がある。`API_ERROR_CODES` の定義順と `getErrorMessageByCode` の `switch` case 順が不一致で追いにくい。`login.tsx` がエラー処理の統一窓口 `toUserMessage` を経由せず `isNetworkError` を直接参照しており、エラーハンドリングが分散している。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [x] `getErrorMessageByCode` の `switch` case 順を `API_ERROR_CODES` の定義順（`NO_NEARBY_PLACES` → `NO_INTEREST_PLACES` → `ALL_VISITED_NEARBY` → `INTERNAL_ERROR` → `DAILY_LIMIT_REACHED` → `RELOAD_LIMIT_REACHED`）と一致させる
- [x] `getErrorMessageByCode` を `ApiError` クラス定義の上（`getErrorMessage` のすぐ上）に移動
- [x] `getErrorMessageByCode` → `getErrorMessageByCustomCode` にリネーム（HTTP ステータスベースの `getErrorMessage` との区別を明確に）
- [x] `toUserMessage` に `server_error` コードの対応を追加し、`login.tsx` で `isNetworkError` を直接参照しているコードを `toUserMessage` 経由に統一

**🔵 REFACTOR**

- [x] `toUserMessage` の `instanceof ApiError` ブランチと `instanceof Error` ブランチのメッセージ返却処理を統合（`ApiError extends Error` のため統合可能）

---

### `settings.tsx` のサブコンポーネント切り出し（Issue #335）


> **背景**：`frontend/app/routes/settings.tsx` は748行あり、`UserInfoTab`（約160行）・`SuggestionTab`（約210行）・`LocationPermissionSection`（約115行）がすべて同一ファイルに定義されている。CLAUDE.md の切り出し基準の条件3（「親ファイルが読みにくくなるほど複雑」）に明確に該当する。特に `LocationPermissionSection` は `navigator.permissions` API・UA判定・`useEffect` を持ちテストが必要（条件1も満たす）。

**🔴 RED**

- [ ] `frontend/app/__tests__/components/LocationPermissionSection.test.tsx` を新規作成（`navigator.permissions` の各状態・UA判定ロジックを検証）

**🟢 GREEN**

- [ ] `frontend/app/components/UserInfoTab.tsx` を新規作成し `settings.tsx` から切り出す
- [ ] `frontend/app/components/SuggestionTab.tsx` を新規作成し `settings.tsx` から切り出す
- [ ] `frontend/app/components/LocationPermissionSection.tsx` を新規作成し `settings.tsx` から切り出す（`navigator.permissions` の `.then().catch()` チェーンを `async/await` 内部関数パターンに書き直す。`Promise.resolve().then(...)` の不要な非同期化も削除）
- [ ] `DeleteAccountModal` を `UserInfoTab` の直下に移動（`showDeleteModal` ステートを管理している `UserInfoTab` と近い位置に置く）
- [ ] `settings.tsx` 内の定義順をサブコンポーネントが上・`Settings` 本体が下になるよう整理
- [ ] `useFormMessage` の2回呼び出しを `const interestForm = useFormMessage(); const radiusForm = useFormMessage();` 形式に変更（デストラクチャリングのリネームが長くなりすぎる問題を解消）
- [ ] `FormMessage` → `FormMessageDisplay` にリネーム（`useFormMessage` フックとの役割区別を明確に）

**🔵 REFACTOR**

- [ ] なし

---

### 各ルートのデータ取得を `clientLoader` に移動（Issue #336）


> **背景**：`profile.tsx`・`summary.weekly.tsx`・`summary.monthly.tsx` の3ファイルが `protectedLoader` だけを `clientLoader` として再エクスポートし、実際のデータ取得を mount 後の `useEffect` で行っている。React Router の `clientLoader` はデータ取得まで担う設計で、`history.tsx` など他のルートはこのパターンを採用済み。`useEffect` とそれに伴う `isLoading` ステートが不要になる。また `getWeekRange` / `getMonthRange` が各ファイルに独立実装されており、`loadPhotos` / `VisitWithPhoto` が weekly/monthly で完全重複している。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [x] `frontend/app/utils/date.ts` を新規作成し `getWeekRange(date: Date)` / `getMonthRange(date: Date)` を実装（純粋な日付計算）
- [x] `summary.weekly.tsx` と `summary.monthly.tsx` から `loadPhotos` 関数と `VisitWithPhoto` 型の重複実装を削除し、共通化した関数/型を `api/places.ts` 付近に切り出す
- [x] `frontend/app/routes/summary.weekly.tsx` のデータ取得（`listVisits` / `getUserBadges` / `loadPhotos`）を `clientLoader` に移動し、`isLoading` ステートと対応する `useEffect` を削除
- [x] `frontend/app/routes/summary.monthly.tsx` に同様の変更を適用
- [x] `frontend/app/routes/profile.tsx` の `getUserStats` / `getUserBadges` / `getProficiency` の3 API 呼び出しを `clientLoader` に移動し、`isLoading` ステートと対応する `useEffect` を削除。`loadData` の `useCallback` も合わせて削除（`useEffect` 内でのみ使用のため）

**🔵 REFACTOR**

- [x] `getLevelInfo` / `getLevelTitle` の計算も `clientLoader` 末尾に移動

---

### `category-map.ts` / `visit-map.tsx` リファクタリング（Issue #337）


> **背景**：`category-map.ts` に `getCategoryInfo`（`getBestCategoryKey` のループと同一実装）という冗長な3番目の関数が存在する。ピン色の hex が `CATEGORY_MAP`（`category-map.ts`）と `CATEGORY_PIN_COLORS`（`visit-map.tsx`）に二重管理されている。また `visit-map.tsx` の脱却バッジ（ピン上の星アイコン）は訪問地点が増えると視認性が下がりノイズになる。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [x] `frontend/app/lib/category-map.ts` の `getCategoryInfo(types: string[])` を削除し、呼び出し元 `DiscoveryCard.tsx` を `getCategoryInfo(pickCategoryFromAPIPlaceTypes(place.types))` に置き換え
- [x] `getBestCategoryKey` → `pickCategoryFromAPIPlaceTypes(placeTypes: string[]): string` にリネーム
- [x] `getCategoryInfoByKey` → `getCategoryInfo(category: string): CategoryInfo` にリネーム（`ByKey` サフィックス削除）
- [x] `CategoryInfo` インターフェースに `color: string`（hex 値）フィールドを追加し、`CATEGORY_MAP` の全エントリに hex 値を持たせる
- [x] `frontend/app/components/VisitMap.tsx` の `CATEGORY_PIN_COLORS` / `DEFAULT_PIN_COLOR` / `getPinColor` を削除し、`getCategoryInfo(category).color` を直接参照する形に変更
- [x] `frontend/app/components/VisitMap.tsx` の `PinMarker` の `isBreakout` prop と `{isBreakout && (...)}` ブロック（ピン上の星バッジ）を削除（`VisitInfoContent` の脱却テキストは残す）

**🔵 REFACTOR**

- [ ] `amusement_center` / `video_arcade`、`gym` / `fitness_center` など完全重複エントリを共通オブジェクト変数に切り出して参照する形に変更

---

### `history.tsx` 仕様変更後残骸削除（Issue #338）


> **背景**：ページネーション機能が仕様から削除されたが、`frontend/app/routes/history.tsx` に `ITEMS_PER_PAGE` / `total` / `isLoadingMore` / `handleLoadMore` / もっとみるボタン が残存している。またファイル内の定義順が CLAUDE.md の方針（依存するサブ関数は呼び出し元より上）に反している。`useToast` フックがコンポーネントファイルに置かれておりフック配置方針と不一致。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [x] `history.tsx` の `ITEMS_PER_PAGE` / `total` / `isLoadingMore` / `handleLoadMore` / もっとみるボタンをすべて削除（`visits.length < total` の判定も合わせて削除）
- [x] `handleLoadMore` 削除に伴い `loadVisits` の `useCallback` ラップを外し、`useEffect` 内にインライン化（`[token]` を依存配列に直接追加）
- [x] `if (visit.category)` ガード（`category` は `string` 確定）を削除
- [x] `loadPhotos` を `loadVisits` より上に移動（依存するサブ関数は呼び出し元より上）
- [x] `export default function History` の位置をファイル末尾に移動（コンポーネント本体は下）

**🔵 REFACTOR**

- [ ] なし

---

### `Genre` / `Tag` 命名ブレの統一（Issue #339）


> **背景**：`onboarding.tsx` は `tag` 系命名（`toggleTag`・`selectedTags`・`getGenreTags`）、`settings.tsx` は `genre` 系命名（`toggleGenre`・`selectedGenres`）で、同じ概念を指す変数・関数名が統一されていない。UIコピーも「興味タグ」「興味ジャンル」が混在している。コード内は `Genre` に統一し、UIコピーは「興味ジャンル」に揃える。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [x] `frontend/app/routes/onboarding.tsx` の `tag` 系変数名・関数名を `genre` 系に統一（`selectedTags` → `selectedGenres`、`toggleTags` → `updateSelectedGenres` 等）
- [x] UIコピー「興味タグ」を「興味ジャンル」に変更（`onboarding.tsx`・`settings.tsx`・その他表示文字列）
- [x] `frontend/app/types/genre.ts` に `Tag` 系の残存エイリアスがあれば `Genre` に統一

**🔵 REFACTOR**

- [ ] なし

---

## Phase 2 計画 — 通知機能（実装済み）

> 詳細は `docs/notification-roadmap.md` を参照。
> Issue #270〜#282 の通知基盤（DBモデル・エンドポイント・Push/メールサービス・スケジューラー・フロントエンドUI）はすべて実装済み。

---

## Phase 3 計画（iOS）— ベータFBと通知実装後に着手

---

## マーケティング（継続）

> ブランド構築・SNSアカウント・初期コンテンツはすべて完了済み。

- [~] **開発ログの継続投稿**: X / Instagram / TikTok で開発内容や気づきを共有する
- [ ] **Product Hunt / 開発系コミュニティへの「予告」**（Optional）
  - [ ] "Upcoming" ページ等の活用検討
