# TODO — ベータ版ロードマップ

> Phase 2 の実装は一通り完了。現段階は、自分含むユーザーのFBを元にしたブラッシュアップフェーズ。iOS移行前に対応するのは #321（スキップ機能）・#322（LP英語化のみ）・#344（開拓数露出強化）・#347（土日リフレッシュリマインダー文言最適化）の4件。#320（効果音）・#345（Receipt of Courage）・#346（オンボーディングサンプル訪問導線）はiOS版で実装するためPhase 3に移動済み。
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

### お店一時スキップ機能（Issue #321）

> **背景**：気になっているが今日は行けない・行きたくない場合に「N日間このお店を表示しない」と設定できると、提案リストの体感精度が上がる。

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

### LP英語化（Issue #322）

> **背景**：Product Hunt等での海外ユーザー獲得に向けて、LPを英語対応にする。アプリ内UIの多言語対応はiOS版実装時に行う。

**🔴 RED**

- [ ] なし

**🟢 GREEN**

- [ ] `frontend/app/routes/lp.tsx` のコピーを英語訳し、ブラウザの `Accept-Language` が `en` 系の場合に英語テキストを表示する（または `/en` ルートを用意する）
- [ ] メタタグ（title・description・OGP）を英語に切り替える

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

- [ ] `backend/services/scheduler_test.go` に土曜・日曜文言の送信内容テストを追加

**🟢 GREEN**

- [ ] `backend/services/scheduler.go` の土曜朝リマインダー文言を「今日は土曜日！ちょっとお出かけしてみない？」に変更
- [ ] `backend/services/scheduler.go` の日曜朝リマインダー文言を「今日は日曜日！絶好のお出かけ日和だね！」に変更

**🔵 REFACTOR**

- [ ] 曜日別文言定義を定数化して可読性を維持

---

## Phase 3 計画（iOS）— #321・#322・#344 対応後に着手

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

### オンボーディングサンプル訪問導線実装（Issue #346）

> **背景**: Webベータ版での新規流入は限定的なため、オンボーディングの疑似訪問導線は iOS移行後（Phase 3）に実装する。訪問履歴には反映しない。

**🔴 RED**

- [ ] サンプル訪問ステップの状態遷移テストを追加（履歴非反映を検証）

**🟢 GREEN**

- [ ] オンボーディングに「Cafe Roamble」のサンプル訪問ステップを追加
- [ ] サンプル訪問完了で疑似XP演出を表示（実訪問APIは呼び出さない）
- [ ] 訪問履歴データへの保存を行わない分岐を実装

**🔵 REFACTOR**

- [ ] iOS移植時に流用しやすいよう、サンプル訪問UIと状態管理を分離

---

## マーケティング（継続）

> ブランド構築・SNSアカウント・初期コンテンツはすべて完了済み。

- [~] **開発ログの継続投稿**: X / Instagram / TikTok で開発内容や気づきを共有する
- [ ] **Product Hunt / 開発系コミュニティへの「予告」**（Optional）
  - [ ] "Upcoming" ページ等の活用検討
