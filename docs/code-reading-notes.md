# バックエンドコード読解メモ

## 読み終わったファイル

| ファイル | 状態 |
|---|---|
| `backend/main.go` | 完了 |
| `backend/routes/routes.go` | 完了 |
| `backend/models/user.go` | 完了 |
| `backend/models/gamification.go` | 完了 |
| `backend/handlers/visit.go` | 完了 |
| `backend/services/gamification.go` | 完了 |
| `backend/handlers/suggestion.go` | 完了 |
| `backend/handlers/health.go` | 完了 |
| `backend/handlers/beta.go` | 完了 |
| `backend/handlers/google_oauth.go` | 完了 |
| `backend/handlers/auth.go` | 完了 |
| `backend/utils/jwt.go` | 完了 |
| `backend/utils/blacklist.go` | 完了 |
| `backend/handlers/user.go` | 完了 |
| `backend/handlers/badge.go` | 完了 |
| `backend/handlers/genre.go` | 完了 |
| `backend/handlers/place_photo.go` | 完了 |
| `backend/handlers/dev_handler.go` | 完了 |
| `backend/handlers/notification.go` | 完了 |
| `backend/services/push.go` | 完了 |
| `backend/services/email.go` | 完了 |
| `backend/services/scheduler.go` | 完了 |
| `backend/database/db.go` | 完了 |
| `backend/database/redis.go` | 完了 |
| `backend/config/config.go` | 完了 |
| `backend/middleware/jwt.go` | 完了 |
| `backend/middleware/cors.go` | 完了 |
| `backend/middleware/rate_limit.go` | 完了 |
| `backend/middleware/error_handler.go` | 完了 |
| `backend/models/notification.go` | 完了 |
| `backend/cmd/send-push/main.go` | 完了 |
| `backend/cmd/preview-email/main.go` | 完了 |
| `backend/database/seed.go` | 完了 |
| `backend/database/migrate.go` | 完了 |
| `backend/templates/embed.go` | 完了 |
| `backend/testutil/db.go` | 完了 |

---

## まだ読んでいないファイル

**models/**
- （完了）

**database/**
- （完了）

**templates/**
- （完了）

**cmd/**
- （完了）

**testutil/**
- （完了）

**読まなくてよいファイル**
- `docs/docs.go` — Swagger自動生成ファイル

---

## 未解決の疑問（仕様・設計系）


---

## コード品質への指摘リスト

### DRY違反
- `haversineDistance` が `visit.go` と `gamification.go` の両方に定義 → 片方を修正したときにもう片方が古いままになるリスクがある。`utils/` に切り出せばいい
- `jst` が `visit.go`・`gamification.go`・`user.go`（2箇所）の計4箇所に定義 → 同上。タイムゾーン定義が複数あると「どっちが正しいのか」が曖昧になる

### 命名の問題
- `resolveGenreInfo` → 「GenreInfoを解決する」では何をする関数かわからない。実際には「PlaceTypesからジャンルタグIDと脱却フラグを導出する」関数
- `ProcessGamification` → `Process` が抽象的すぎ。XP・レベル・バッジ・ストリークをまとめて処理していることが名前から読み取れない
- `applyXPAndProgression` → `Progression` が何を指すか不明。読んで初めて「XP・レベル・熟練度・ストリークの反映」だとわかる
- `xpEarned`（基礎点）と `finalXP`（ストリークボーナス込みの合計）の区別が名前から読み取れない → 中身を読まないと違いがわからない
- `buildXPBreakdown` → 「合計XPを分解する」関数ではなく「フラグから各項目XPを組み立てる」関数なのに名前が誤解を招く。合計値が引数にないのもそのため
- `createVisitRequest.Category` → `visit.go` 内に `GenreTag.Category`（大分類）も存在するため混乱する。`DisplayCategory` や `PlaceCategory` の方が表示用文字列だとわかる
- `devHandler` → 開発環境専用であることが名前から伝わりにくい

### コメントの問題
- 定数のコメントが名前の説明になっている → `MaxListLimit = 100 // ListVisits APIのlimitパラメータ上限` は名前を日本語に言い直しているだけ。リーダブルコード的に「名前でわかることをコメントで繰り返すな」
- 関数の上の挙動説明コメントが冗長なものがある → 関数名と引数名で自明な処理をコメントで説明している箇所がある
- `Category`（表示用）と `GenreTagID`（ゲーミフィケーション用）を両方 `visits` テーブルに持つ理由がコメントで明記されていない → 毎回JOINするコストを避けるための意図的な非正規化だが、知らないと「なんで重複してるんだ」となる

### YAGNI違反
- `createVisitRequest` に `Rating`/`Memo` → 訪問時のUIでは入力できないのに受け付ける口が開いている。現状では不要
- `ListVisits` の `from`/`until` フィルタ → 現状フロントから使われていない。使われない口が開いていると「これ使えるの？」と混乱する
- メモボーナス（Issue #304） → 訪問時にメモを書けないUIなのにXPボーナスが設定されている

### 設計の一貫性
- `CheckAndAwardBadges` の `switch` 内でバッジ判定の粒度がバラバラ。`night_visit` は `isNightVisitJST` に委譲しているのに、`new_area`（ループ+距離計算10行）や `weekend_visits`（ループ）はインラインべた書き。複雑なものほど関数化すべきだが逆になっている
- `UpdateGenreProficiency` は内部で `calcGenreLevel` を呼び自己完結しているのに、`UpdateStreak` はボーナス計算（`CalcStreakBonus`）を呼び出し側に委ねている。呼び出し側が `CalcStreakBonus` を呼び忘れてもコンパイルエラーにならないため危険。どちらかに統一すべき

### user.go 固有の問題

- **`ChallengeVisits = breakoutVisits`**（`GetStats` 106行）— 同じ値を別フィールドに詰めている。フロントで使い分けているなら別フィールドの意義があるが、同じ値なら1フィールドで足りる
- **リロードロジックの重複**（`UpdateInterests`/`UpdateMe`）— 全く同じリロードカウント処理（GetDailyReloadCount → ClearCache → Increment → 残り計算）が2箇所にコピペされている。suggestions系をサービス層に切り出す際に解消すべき

### notification.go 固有の問題

- **Swaggerコメントの位置ずれ**: `GetNotificationSettings` のSwaggerアノテーション（`@Summary 通知設定取得`）が `upsertPushSubscription` 関数の上（213行目）に書かれている。swaggoはこの位置では正しく認識しない
- **`GetNotificationSettings` の責務混在**: `FirstOrCreate` を使って「レコードがなければ作成」しているが、`Get` という命名なのに作成の責務も持っている。ユーザー登録時に `NotificationSettings` レコードを初期作成するのが正しい設計で、`GetNotificationSettings` は純粋に取得だけにすべき
- **`SubscribePush` の命名**: 他のハンドラ名（`GetVAPIDPublicKey`、`UpdateNotificationSettings`）と比べてやや一貫性がない。`CreatePushSubscription` の方が「購読レコードを作成する」意図が明確

### dev_handler.go 固有の問題

- **`GetSuggestionStats` → `GetSuggestionCacheStats`** — 「提案の統計」に読めてしまう。Redisキャッシュの状態確認エンドポイントなので `Cache` を末尾に付けるべき

### place_photo.go 固有の問題

- **旧 Places API 互換コード不要** — `resolveLegacyPhotoURL` / `isNewAPIPhotoRef` による新旧分岐が残っているが、旧APIはどこでも使われていない。削除してよい
- **運用対策コメント不要** — `PlacePhotoHandler` の struct コメントに「Cloud Console でIP制限を推奨」などの運用手順が書かれているが、コードには無関係な情報。`CLAUDE.md` や `docs/` に書くべき
- **`getBaseURL` / `getNewAPIBaseURL` / `getHTTPClient` は不要** — `BaseURL` / `HTTPClient` のフォールバック分岐を持つが、これはテスト差し替え用。テスト用フィールドならそのまま使えばよく（nilチェックは不要）、本番用のフォールバック値も定数化すれば関数化は不要。フォールバックを消せば「変数定義と等価な関数」になるので関数宣言ごと削除すべき

### push.go 固有の問題

- **`sub := sub` が不要** — Go 1.22以降はループ変数がイテレーションごとにスコープされるため、goroutine内でのループ変数キャプチャ対策として書かれた `sub := sub` は不要。削除してよい
- **`newPushServiceWithClient` の命名** — テスト専用のファクトリ関数だが名前から判別できない。`newPushServiceForTest` 等にするかテストファイルに移すべき

### email.go 固有の問題

- **`MonthlySummaryData.Month` の命名** — `"2026年3月"` のような年月文字列が入るのに `Month` という名前。`YearMonth` や `Period` の方が実態に合う
- **`SendWeeklySummary` / `SendMonthlySummary` の重複** — テンプレート名・件名・データだけが違い、処理の流れは同一。共通の `sendSummary(tmplName, subject string, data any)` に切り出せる
- **`isEmptySummary` は不要な抽象化** — `visitCount == 0` を返すだけの関数。インラインで書けば済む規模で関数化するのは過剰（YAGNI）

### scheduler.go 固有の問題

**仕様齟齬・バグ**
- ストリークリマインダーのcron式が `0 7 * * *`（朝7時）— 仕様では朝10時のはず。要確認
- **ストリークリマインダーが1日早い（バグ）**: `fetchStreakReminderTargets` が `streak_last` の6日前を対象にしているが、正しくは7日前に送るべき。ストリーク判定は「7日後に訪問でstreak++、8日以上空けるとリセット」なので、前回訪問から7日後 = 「今日行かなきゃリセットされる日」。修正箇所: `sixDaysAgoJST` の `AddDate(0, 0, -6)` → `AddDate(0, 0, -7)`、変数名も `sevenDaysAgoJST` / `sevenDaysAgoEnd` に合わせて変更すること。実機でも1日早く届くことが確認済み
- **ストリーク加算ロジックが「毎週行ったか」の判定として機能していない（Issue #303 で対処予定）**: 現在は `days == 7` のときだけ streak++ するローリングウィンドウ方式だが、「毎週行ったか」を正しく判定するにはカレンダー週（月〜日）ベースの判定が必要。ローリングウィンドウだと毎日行くユーザーが「7回ごとにstreak++」になり意味が変わってしまう。`weekStart` 関数が既に存在するので、それを使ったカレンダー週ベースへの移行が正しい方向
- デイリーサジェスション通知とストリークリマインダーが同じ `0 7 * * *` で登録されている。実機で片方が届かない事象が発生しているが、根本原因は不明。後で調査する

**DRY違反**
- `RunWeeklySummaryNotification` と `RunMonthlySummaryNotification` の構造がほぼ同一（fetch→期間計算→push送信→メール送信）。`runSummaryNotification` のような共通関数に切り出せる
- `buildWeeklySummaryData` と `buildMonthlySummaryData` もほぼ同一（DB取得→XP集計→バッジ集計）

**命名の問題**
- `scheduler.go` の `buildWeeklySummaryData` / `buildMonthlySummaryData` と `email.go` の `BuildWeeklySummaryEmail` / `BuildMonthlySummaryEmail` が似た名前で役割が全然違う。`scheduler.go` 側はDBから集計するので `aggregate*` や `collect*` の方が実態に合う。`email.go` 側はHTMLを返すことが名前から読み取れないので `BuildWeeklySummaryHTML` のように `HTML` を末尾に付けるべき
- `Stop` / `EntryCount` は1行のエイリアスにすぎず、`cron.Stop()` / `len(cron.Entries())` を読めば同等の情報が得られる。`EntryCount` は本番コードで未使用（テストのみ）。テスト専用ヘルパーは `testutil` に切り出すか、このファイルに置くなら `entryCountForTest` のように名前で判別できるようにすべき

**設計**
- `RunStreakReminderNotification` の送信条件式 `if s.email != nil && target.EmailEnabled && target.StreakReminder && target.Email != ""` が長い。`notificationTarget` に「このチャンネルで送るべきか」を判断するメソッドを持たせれば呼び出し側がすっきりする
- `fetchSummaryTargets` の `fmt.Sprintf("ns.%s = ?", settingColumn)` はSQLインジェクションのリスクがある（呼び出し元がハードコードしているので現状は安全だが、引数が外部から来た場合に危険）

**並び順（プロジェクト全体の問題）**
- 「使う側より前に定義する」順番になっていない。`Run*` 関数の中で呼ぶ `fetch*` / `build*` がファイル下部に定義されており、読む際に上下に飛ぶ必要がある。プロジェクト全体で「呼び出される側が先」の順に統一したい

### database/redis.go 固有の問題

**命名の一貫性**
- キー生成関数が `DailySuggestionCacheKey` / `DailyLimitReachedKey` / `DailyReloadCountKey` とバラバラ。`Generate*Key` に統一するか、少なくとも接頭辞の動詞を揃えるべき
- 削除系も `ClearDailySuggestionsCache`（Clear）/ `DeleteKeysByPattern`（Delete）と混在。`Delete*` に統一すべき

**並び順**
- キー生成関数（`DailySuggestionCacheKey` 等）と、それを利用するGet/Set/Delete/Increment関数が交互に散在している。`InitRedis` / `CloseRedis` → キー生成関数をまとめて定義 → 各操作関数、の順に整理すると見通しが良くなる

**ドキュメント不足**
- このプロジェクトでRedisを何のために使っているかの全体像が一切書かれていない。→ `docs/redis-localstorage.md` を作成して整理済み。`redis.go` 先頭にもそこへの参照コメントを置くと親切

**Places APIキャッシュキーがここに定義されていない**
- `suggestion.go` 内で `"places:v2:%s"` というキーをハードコードしている。他のキーは `redis.go` に集約されているのに、このキーだけ漏れている

**提案キャッシュ・完了フラグの二重管理（Issue #314 で解消済み）**
- 提案データの localStorage キャッシュ（`SUGGESTIONS_CACHE_KEY`）を廃止し、Redis（`suggestion:daily:*`）に統一済み
- 「今日の提案を全件完了したか」の localStorage フラグ（`COMPLETED_KEY`）を廃止し、Redis（`suggestion:count:*`）に統一済み
- 複数端末で同一状態になるように改善済み。詳細は `docs/redis-localstorage.md` を参照

**コメント文が過剰**
- 『リーダブル・コード』的に「コードから読み取れることをコメントで繰り返すな」という観点から、単純なGet/Set/Delete関数のコメントは冗長。例えば `SetDailySuggestionCache` のコメントは「Redisに今日の提案データを保存する」と書いてあるが、関数名と引数名で自明なので削除しても問題ない。これを削除してわからなくなるようであれば、関数名や引数名が不適切な可能性がある


### middleware/rate_limit.go 固有の問題

- `routes.go` で登録済み。本番では機能している

### middleware/error_handler.go 固有の問題

- **未使用のため削除候補（YAGNI）**: `ErrorHandler` はどこからも呼ばれていない。各ハンドラが個別に `c.JSON` でエラーレスポンスを返しているため、集中エラーハンドラとして機能していない

### middleware/cors.go 固有の問題

- **`ALLOWED_ORIGIN` のフォールバックが不要**: 未設定時に `http://localhost:5173` へフォールバックしているが、設定漏れに気づけない。`config.go` 集約方針と合わせ、未設定なら起動エラーにすべき

### database/migrate.go 固有の問題

- **適用済み一時パッチの削除候補**: 以下の3ブロックは本番・ローカル両方に適用済みのため、条件が真になることがない dead code。削除してよい
  - `is_comfort_zone` → `is_breakout` カラム改名（27〜32行、Issue #269）
  - `latitude` / `longitude` / `password_hash` カラム削除（49〜65行）
  - `monthly_summary` デフォルト値更新（74〜77行、Issue #291）

### database/db.go 固有の問題

- **`GetDB()` がDI廃止方針と矛盾**: グローバル変数 `DB` のコメントに「段階的にDIのみに統一し最終的にこのグローバル変数を廃止する」と書かれているにもかかわらず、`GetDB()` というアクセサを用意している。廃止するなら `GetDB()` も含めてグローバル変数経由のアクセス口をすべて塞いでいく必要がある

### config/config.go 固有の問題

- **JWT設定だけ `config.go` に集約されており統一感がない**: `MYSQL_*` は `database/db.go`、`REDIS_*` は `database/redis.go`、`PORT` は `main.go` で直接 `os.Getenv` している。**方針: 今後すべての環境変数を `config.go` に集約し、アプリ起動時に一括バリデーションする形に統一する。ファイル名は `config.go` のまま維持。**

### testutil/ への集約（横断的指摘）

テスト専用のコードが本番コードファイルに混入しているケースが複数ある。これらは `testutil/` に移すか、対応する `_test.go` ファイルに移すべき：

- `push.go` の `newPushServiceWithClient` — テスト専用ファクトリ
- `place_photo.go` の `BaseURL` / `HTTPClient` フィールド・`getBaseURL` / `getHTTPClient` — テスト用差し替えのためだけに本番コードに存在
- `scheduler.go` の `EntryCount` — テストでしか使われていないヘルパー

### その他
- `RFC3339` と `RFC3339Nano` の混在（`visit.go`） → `CreateVisit` は `RFC3339`、`ListVisits` の `from`/`until` は `RFC3339Nano` でパース。意図が見えない混在。`RFC3339Nano` に統一する方が「どちらが来ても受け付ける」ので安全
- ポートのフォールバック（`PORT` 未設定でも `8000` で動く） → 設定漏れに気づきにくい。未設定ならエラーを出す方が意図が明確
- `applyXPAndProgression` がXP加算・熟練度更新・ストリーク処理を1関数に詰め込んでいる → 単一責任の原則に反する。ストリーク処理だけ後から差し替えたくなっても分離できない
- ストリークボーナス周りだけインライン処理で後付け感がある → 他の処理はちゃんと関数化されているのに、ストリークボーナスの加算だけ `applyXPAndProgression` の末尾にべた書きされている

### suggestion.go 固有の問題

**命名**
- `ForceReload` という命名 → 通常のリロードボタンに対応する機能なのに「強制」は大袈裟。単に `Reload` でいい
- `processForceReload` の `process` が抽象的 → 何をする関数かわからない
- `buildPersonalizedSelections` が内部で `selectPersonalizedPlaces` を呼んでいる → 名前が非常に似ており、どちらがコアか判別不能。しかもコアは `buildPersonalizedSelections` ではなく内部で呼ばれている `selectPersonalizedPlaces` の方
- `buildPersonalizedSelections` の `build` より `select` 系の動詞が先頭に来るべき（「選出する」関数なので）
- `checkDailyCacheResult` という命名なのに取得・整形・レスポンス構築まで行う → `fetchDailyCacheResult` や `getDailyCacheResult` の方が実態に近い

**設計・構造**
- `resolveRadius` の `radius == 0` 分岐 → フロントがユーザー設定値を持ってAPIを叩くようにすれば不要になる。バックエンドが「未指定ならDB参照」という責務を持つ設計が疑問
- `resolveRadius` の `maxSearchRadius` 上限チェックが本当に必要かどうか疑問
- `processForceReload` の戻り値がリロードカウント（増分後の値）→ フロントが最終的に使うのは残り回数なので、最初から残り回数で統一すれば変換が不要になる
- `processForceReload` の「2つの上限管理」（`IsDailyLimitReached` フラグ と `reloadCount >= MaxDailyReloads` のカウント）が別々に存在 → 一本化できないか検討の余地あり
- `IncrementDailyReloadCount` の引数が多い
- `IsDailyLimitReached` の戻り値を `reached` という変数で受けているが、bool変数なら `isReached` の方が読み手に型が伝わる
- `checkDailyCacheResult` のネストが深い
- キャッシュヒット時とキャッシュミス時で `IsInterestMatch` / `IsBreakout` の整形処理がほぼ同じなのに共通化されていない（`checkDailyCacheResult` 内と `buildPersonalizedSelections` 内で重複）
- `fetchPlacesFromCacheOrAPI` はつぎはぎでコード変更が行われた痕跡がある → Places APIキャッシュ取得・フィルタリング・再キャッシュが混在していて流れが追いにくい
- キャッシュの種類が2種類（「Places API結果の大量候補」と「選出済み3件」）あるのに命名・コメントで明示されていない → `checkDailyCacheResult` と `fetchPlacesFromCacheOrAPI` がどちらもキャッシュを扱うのに役割の違いがわかりにくい
- ハンドラ内にビジネスロジックが混在（`filterOutVisited`・`filterOpenNowPlaces`・`buildPersonalizedSelections`・`isBreakoutVisit`・`classifyByInterest`・`selectPersonalizedPlaces` 等）→ 本来はサービス層に移すべき。ハンドラは「リクエスト受け取り→サービス委譲→レスポンス返却」だけに徹するのが理想

**一貫性**
- `h.RedisClient.Del(ctx, placeCacheKey)` だけ `database.` でラップされずに直接呼ばれている → 他のRedis操作は `database.XXX` 経由なのに一貫性がない
- MySQLとRedisの操作がどちらも `database.` 以下にあり区別しにくい

**仕様**
- `filter_open_now` がデフォルトfalseのため、何も指定しないと時間帯を問わず提案される → フロントにopt-inするUIも存在しないため、デフォルトtrueに変更すべき（閉店中の施設は常に除外する）

**beta.go**
- ベータゲート有効判定を「`BETA_PASSPHRASE` 未設定なら無効（開発環境向け）」で行っているが、`APP_ENV=development` 等の環境変数で判定する方が意図が明示的

### google_oauth.go / auth.go 固有の問題

**YAGNI**
- `logoutRequest.RefreshToken` のコメントが「下位互換性のため」→ 新規プロジェクトで何の下位互換か不明。単に「オプション」とするか、リフレッシュトークンを必須にすべき

**設計**
- `GoogleTokenVerifier` インターフェースを切って `GoogleHTTPVerifier` に実装させているのはテスト差し替えのためで良い設計（テスト時にモックに差し替えられる）
- ユーザー登録・ログインの分岐を `google_oauth.go` 内でハンドラが直接DBを叩いて行っている → サービス層に切り出せばハンドラが薄くなる

### 仕様見直し候補
- ストリークボーナスXPをジャンル熟練度に加算しない方がよい（現状は `UpdateGenreProficiency` を2回呼んで加算している）。ストリークは継続習慣への報酬なのでジャンル熟練度とは無関係にすべき。加算すると「ストリーク経由で熟練度が上がり、同ジャンルが脱却対象から外れる」という意図しない副作用が生じる
- `createVisitRequest` の `Memo` フィールド廃止を検討。訪問記録時にメモを受け取る仕様自体をなくす（メモボーナス廃止 #304 と合わせて整理）

---

## 起票済みIssue

- #303 ストリークカウント加算ロジックのバグ
- #304 メモボーナス仕様の見直し
