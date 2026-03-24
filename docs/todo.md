# TODO — ベータ版ロードマップ

> Phase 1 の実装・インフラ準備はすべて完了。**3/7（土）のベータ版公開**に向けた最終確認フェーズ。
> 現在のドメイン: `roamble.app`（本番）/ `roamble.pages.dev`（Cloudflare Pages デフォルト）

---

## セキュリティ確認

### フロントエンド

- [ ] `localStorage` に保存しているトークンに対して XSS リスクがある場合、Content-Security-Policy ヘッダーが設定されているか（`public/_headers` に CSP 未設定。ベータ版では許容範囲だが、正式リリース前に追加推奨）

---

## 3/7（土）: ベータ版公開

- [ ] **ベータ版フォーム締め切り**（公開1週間後 = 3/14頃）

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
