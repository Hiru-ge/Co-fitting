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

### バグ修正

#### ストリークカウント加算ロジックのバグ修正（Issue #303）

**背景**: 現在は rolling window 方式（`days == 7` のときのみ streak++）のため、毎日訪問するユーザーが「7回ごとに streak++」になる。正しくはカレンダー週（月〜日）ベースで「先週訪問・今週訪問 → streak++」と判定すべき。

**🔴 RED**
- [x] `backend/services/gamification_test.go` の `TestUpdateStreak` を週ベースの期待値に書き換え
  - `"前回から6日後に訪問→streak_count変化なし"` → `"同じ週内の再訪問→streak_count変化なし"` に変更
  - `"前回から7日後に訪問→streak_count増加"` → `"先週訪問・今週初めて訪問→streak_count増加"` に変更
  - `"前回から8日後に訪問→streak_countリセット"` → `"2週以上前の訪問→streak_countリセット"` に変更
  - `"暦週をまたぐ訪問（日曜→翌月曜=1日後）でリセットされない"` → `"暦週をまたぐ訪問（日曜→翌月曜）でstreak++"` に変更（期待値 2→3）

**🟢 GREEN**
- [x] `backend/services/gamification.go` の `UpdateStreak`: rolling window → カレンダー週ベースに変更
  - `weekStart()` を使い `visitedWeekStart` / `lastWeekStart` を算出
  - `weekDiff == 0` → 変化なし、`weekDiff == 1` → streak++、`weekDiff >= 2` → リセット

**🔵 REFACTOR**
- [ ] なし

---

#### ストリークリマインダー送信タイミング修正（Issue #305）

**背景**: ストリーク判定がカレンダー週（月〜日）ベースになったため、リマインダーの条件も「今週まだ訪問していないユーザー」に変更する。日曜日に「今日行かないとストリークが切れる」通知を送る。

**🔴 RED**
- [x] `backend/services/scheduler_test.go` に `TestFetchStreakReminderTargets_NotVisitedThisWeek` テスト追加
  - 今週訪問済みユーザー → 対象外
  - 先週訪問・今週未訪問のユーザー → 対象
  - streak_count=0 のユーザー → 対象外

**🟢 GREEN**
- [x] `backend/services/scheduler.go` のcron登録: `"0 7 * * *"` → `"0 7 * * 0"`（毎週日曜7時）に変更、コメントも更新
- [x] `backend/services/scheduler.go` の `fetchStreakReminderTargets`: 「`streak_last` が今週月曜より前」条件に変更
  - `weekStart(nowJST)` で今週月曜を算出
  - `WHERE u.streak_last < thisMonday` に変更
  - 変数名 `sixDaysAgoJST` / `sixDaysAgoEnd` を削除し `thisWeekMonday` に変更

**🔵 REFACTOR**
- [ ] なし

---

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

#### メモボーナスXP廃止・createVisitRequest からメモ/レーティング削除（Issue #304）

**背景**: メモボーナス (+10 XP) が実装済みだが、訪問新規登録UIにメモ入力欄がないためYAGNI違反。訪問後編集 (PATCH) にはメモUIがあるためそちらは残す。DBカラムも保留。

**🔴 RED**
- [x] `backend/services/gamification_test.go` の `TestCalcXP`: `hasMemo` 引数削除・メモボーナスケース削除（脱却+初エリア=130XP に変更）
- [x] `backend/services/gamification_test.go` の XPBreakdown合計検証から `MemoBonus` 参照を削除
- [x] `backend/handlers/visit_test.go` の `感想メモ入力で+10XPボーナス` テストケース削除

**🟢 GREEN**
- [x] `backend/services/gamification.go`: `XPMemoBonus` 定数削除
- [x] `backend/services/gamification.go`: `CalcXP` から `hasMemo bool` 引数削除・メモボーナス計算削除
- [x] `backend/services/gamification.go`: `XPBreakdown` から `MemoBonus` フィールド削除
- [x] `backend/services/gamification.go`: `buildXPBreakdown` から `hasMemo` 引数・計算削除
- [x] `backend/services/gamification.go`: `ProcessGamification` から `hasMemo` 算出・渡しを削除
- [x] `backend/handlers/visit.go`: `createVisitRequest` から `Rating`・`Memo` フィールド削除
- [x] `backend/handlers/visit.go`: `CreateVisit` ハンドラでの `Rating`/`Memo` セットを削除

**🔵 REFACTOR**
- [ ] なし

---

#### ストリークボーナスXPをジャンル熟練度に加算しない仕様変更（Issue #307）

> ストリークボーナスXPは「継続行動への報酬」であり、特定ジャンルへの習熟度とは無関係。ユーザーの総XP・レベルには加算するが、ジャンル熟練度には反映しない。

**🔴 RED**
- [x] `backend/services/gamification_test.go` にストリークボーナスXPが熟練度に加算されないことを検証するテスト追加

**🟢 GREEN**
- [x] `backend/services/gamification.go` の `applyXPAndProgression`: ストリークボーナス分のXPを `UpdateGenreProficiency` に渡さないよう修正

**🔵 REFACTOR**
- [ ] なし

---

#### ユーザー登録時の NotificationSettings 初期レコード作成（Issue #308）

**🔴 RED**
- [x] `backend/handlers/google_oauth_test.go` にOAuth完了時に `NotificationSettings` レコードが作成されるか検証するテスト追加

**🟢 GREEN**
- [x] `backend/handlers/google_oauth.go` のユーザー登録処理に `NotificationSettings` の初期レコード作成を追加
- [x] `backend/handlers/notification.go` の `GetNotificationSettings` から `FirstOrCreate` を `First` に変更

**🔵 REFACTOR**
- [ ] なし

---

#### 週間・月間サマリーページの参照期間バグ修正（Issue #316、#317）

**背景**: プッシュ通知からリンクされる週間・月間サマリーページで、「先週・先月」ではなく「今週・今月」（未来を含む期間）の訪問履歴を参照してしまっている。

**週間サマリー（Issue #316）**

**🔴 RED**
- [x] `frontend/app/routes/summary.weekly.test.tsx` の期間ラベルテスト: 期待値を `"3/16（月）〜 3/22（日）"` → `"3/9（月）〜 3/15（日）"` に変更（固定日時2026-03-16月曜基準で先週を参照）
- [x] バッジフィルタリングテストの `WEEK_FROM` / `WEEK_UNTIL` と各 `earned_at` を先週範囲（`2026-03-08T15:00:00.000Z` 〜 `2026-03-15T15:00:00.000Z`）に合わせて更新

**🟢 GREEN**
- [x] `frontend/app/routes/summary.weekly.tsx` の `getWeekRange()`: `from` を `mondayMidnightUTC - 7日`、`until` を `mondayMidnightUTC`（今週月曜）に変更
- [x] 表示テキストを「今週」→「先週」に変更（title・greeting）

**🔵 REFACTOR**
- [ ] なし

---

**月間サマリー（Issue #317）**

**🔴 RED**
- [x] `frontend/app/routes/summary.monthly.test.tsx` の期間ラベルテスト: 期待値を先月の月ラベルに変更

**🟢 GREEN**
- [x] `frontend/app/routes/summary.monthly.tsx` の `getMonthRange()`: `from` を先月1日、`until` を今月1日に変更
- [x] `label` を `${year}年${month}月`（先月）に変更
- [x] 表示テキストを「今月」→「先月」に変更（greeting）

**🔵 REFACTOR**
- [ ] なし

---

### 削除

#### 未使用コード・dead code の削除（Issue #309）

- [x] `backend/middleware/error_handler.go` を削除
- [x] `backend/database/migrate.go` の適用済み一時パッチ3ブロック削除（`is_comfort_zone` 改名・`latitude`/`longitude`/`password_hash` 削除・`monthly_summary` デフォルト更新）
- [x] `backend/handlers/place_photo.go` の旧Places API互換コード削除（`resolveLegacyPhotoURL` / `isNewAPIPhotoRef` / `getBaseURL` / `getNewAPIBaseURL` / `getHTTPClient`）
- [x] `backend/handlers/visit.go` の `createVisitRequest.Rating` / `createVisitRequest.Memo` フィールド削除（Issue #304 と合わせて整理）
- [x] `backend/handlers/visit.go` の `ListVisits` から `from` / `until` パラメータ削除

---

### リファクタリング

#### haversineDistance・jst の utils への切り出し（Issue #310）

- [x] `backend/utils/geo.go` を新規作成し `haversineDistance` を定義
- [x] `backend/utils/time.go` を新規作成し `JST` タイムゾーン定数を定義
- [x] `visit.go` / `gamification.go` / `user.go` の重複定義を削除して `utils` からインポートするよう変更

---

#### suggestion.go ビジネスロジックのサービス層への移動（Issue #311）

- [x] `backend/services/suggestion.go` を新規作成
- [x] `filterOutVisited` / `filterOpenNowPlaces` / `buildPersonalizedSelections` / `isBreakoutVisit` / `classifyByInterest` / `selectPersonalizedPlaces` をサービス層へ移動
- [x] `UpdateInterests` / `UpdateMe` のリロードカウント重複処理を共通関数に切り出し
- [x] `RunWeeklySummaryNotification` / `RunMonthlySummaryNotification` を `sendToTargets` に共通化

---

#### テスト専用コードの testutil への分離（Issue #312）

- [x] `backend/services/push.go` の `newPushServiceWithClient` を `backend/services/push_test.go` に移動
- [x] `backend/handlers/place_photo.go` の `BaseURL` / `HTTPClient` フィールドと `getBaseURL` / `getNewAPIBaseURL` / `getHTTPClient` を削除し、テスト側でモックを差し替える設計に変更
- [x] `backend/services/scheduler.go` の `EntryCount` を削除（テストで必要なら `testutil/` に別途定義）

---

#### 環境変数の config.go への集約（Issue #313）

- [x] `backend/config/config.go` にすべての環境変数の読み込みと起動時バリデーションを集約
  - 対象: `MYSQL_*`（db.go）/ `REDIS_*`（redis.go）/ `PORT`（main.go）/ `ALLOWED_ORIGIN`（cors.go）/ `GOOGLE_*`（google_oauth.go）等
- [x] `ALLOWED_ORIGIN` 未設定時のフォールバック削除（未設定ならエラー）
- [x] 各ファイルの `os.Getenv` 直接呼び出しを `config` パッケージ経由に変更

---

#### 提案データの Redis/localStorage 二重管理の解消（Issue #314）

> 詳細は `docs/redis-localstorage.md` を参照。

- [x] フロントエンドの提案キャッシュ（`SUGGESTIONS_CACHE_KEY`）を localStorage から削除し Redis 経由に統一
- [x] 「今日の提案を全件完了したか」フラグ（`COMPLETED_KEY`）を localStorage から削除し Redis の `suggestion:count:*` に統一
- [x] 複数端末でのキャッシュ整合性を確認

---

#### バックエンド全体の命名改善（Issue #315）

- [x] `resolveGenreInfo` → `resolveGenreFromPlaceTypes` 等、実態に合う名前へ
- [x] `ProcessGamification` → `AwardXPAndBadges` 等へ
- [x] `applyXPAndProgression` → `persistXPAndProgression` 等へ
- [x] `buildXPBreakdown` → `buildXPComponents` 等へ
- [x] `ForceReload` / `processForceReload` → `Reload` / `processReload` へ
- [x] Redis キー生成関数の命名統一（`Generate*Key` 等）/ 削除系を `Delete*` に統一
- [x] `scheduler.go` の `build*` → `aggregate*` / `collect*` 等へ
- [x] `email.go` の `Build*` → `Build*HTML` 等へ

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
