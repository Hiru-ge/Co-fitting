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
