# TODO — ベータ版ロードマップ

> Phase 2 の実装は一通り完了。現段階は、自分含むユーザーのFBを元にしたブラッシュアップフェーズ。iOS移行前に対応するのは #321（スキップ機能）・#322（LP英語化のみ）・#344（開拓数露出強化）・#346（オンボーディングサンプル訪問導線）・#347（土日リフレッシュリマインダー文言最適化）の5件。#320（効果音）・#345（Receipt of Courage）はiOS版で実装するためPhase 3に移動済み。
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
