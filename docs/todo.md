# TODO — ベータ版ロードマップ

> Phase 2 の実装は一通り完了。現段階は、自分含むユーザーのFBを元にしたブラッシュアップフェーズ。最低限の部分を終わらせ次第、iOS版の開発に着手する予定。
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

## Phase 2：通知機能（実装済み）＋ Receipt of Courage

> 詳細は `docs/notification-roadmap.md` を参照。
> Issue #270〜#282 の通知基盤（DBモデル・エンドポイント・Push/メールサービス・スケジューラー・フロントエンドUI）はすべて実装済み。

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

### Receipt of Courage（勇気の証明書）実装（Issue #345・Phase 2最優先）

> **背景**: お店特化への方針転換に伴い、最優先バイラル施策として格上げ（`docs/product-strategy.md §7.2` 参照）。訪問完了時にレシート形式の画像を生成・SNSシェアできる機能。「今日○○カフェに初めて入りました / 23軒目の開拓」という1枚がInstagram StoriesやTikTokで流れることが最大の獲得チャネルになりうる。

**🔴 RED**

- [ ] シェア画像生成ロジックのユニットテスト（お店名・XP・累計開拓数が正しく含まれるか）

**🟢 GREEN**

- [ ] バックエンド: 訪問記録APIレスポンスに `receipt_data`（お店名・獲得XP・累計開拓数・バッジ名）を追加
- [ ] フロントエンド: XP獲得モーダルにシェアボタン追加
- [ ] フロントエンド: `html-to-image` 等でレシート形式カードを画像化し Web Share API でシェア
- [ ] レシートカードのデザイン: お店名・ジャンル・獲得XP・「○軒目の開拓」カウント・日付

**🔵 REFACTOR**

---

### LP:SEO向上（Issue #341）

> **背景**: 現在SPAモード（`ssr: false`）のためクローラーがJavaScriptを実行せずLPのコンテンツを拾えない状態。また、キーワード選定も感覚ベースのため、検索流入を狙った最適化が必要。

**🔴 RED**

- なし（UI変更のみのため）

**🟢 GREEN**

- [x] Lighthouse・Google Search Consoleで現状のスコア・インデックス状況・検索パフォーマンスを確認し、改善の基準値を記録する
- [x] `/funnel-analysis` SKILLを使って現状のユーザー行動を分析し、継続率や実質アクティブユーザー数、検索流入の影響、UIのどこに摩擦があるかを把握する。前回実行が2026-03-26のため、そこからの変化も分析する。結果は `docs/marketing/analysis/` 下にまとめる。
- [x] ラッコキーワード（https://rakkokeyword.com/）でキーワード選定を実施し、`frontend/app/routes/lp.tsx` のmeta情報（title・description・OGP）と本文コピーを更新する。（正規コピーは `docs/marketing/marketing-strategy.md` に固定し、本文コピーと見出しで非ブランド検索語を反映）
- [x] `frontend/react-router.config.ts` の `prerender` オプションに `/lp` を追加し、ビルド時に静的HTMLを生成する（React Router v7 の prerender 機能を使用）
- [x] `frontend/public/sitemap.xml` を作成し `/lp` を含める
- [x] `frontend/public/robots.txt` を作成し `Sitemap:` ディレクティブを追記
- [x] `frontend/app/routes/lp.tsx` のスクリーンショット・機能紹介画像（`<img>` タグ）に `width` / `height` 属性を追加してCLSを防ぐ
- [x] TikTok埋め込みスクリプトの読み込みをIntersection Observer等で遅延させ、LCPへの影響を最小化する
- [x] Lighthouseでパフォーマンス測定し、フロントエンド起因の指摘事項（CLS・LCP・未使用CSS等）のみ対応する。TTFBやサーバー応答速度の改善はiOS版リリース後にインフラ増強とセットで対応する
- [ ] ベータゲートを撤廃するべきか(あるいは期間限定でベータ版リクエストを再受付するか)を検討する。ファネル分析の結果、コア層は使ってくれているが母数が少ない(大多数がベータゲートに阻まれて離脱している)ので、期間限定で再受付してデータを増やすのも手。ただし、「ベータ版はベータ版リクエストしてくれた方限定」というふうに訴求してきたので、そこで登録してくれたユーザーへの裏切りにならないかは考慮する必要がある。
- [ ] 以上の改善・検討が全て完了したら、調査結果と改善内容を `docs/marketing/seo-improvement.md` にまとめる

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

## Phase 3 計画（iOS）— ベータFBと通知実装後に着手

---

## マーケティング（継続）

> ブランド構築・SNSアカウント・初期コンテンツはすべて完了済み。

- [~] **開発ログの継続投稿**: X / Instagram / TikTok で開発内容や気づきを共有する
- [ ] **Product Hunt / 開発系コミュニティへの「予告」**（Optional）
  - [ ] "Upcoming" ページ等の活用検討
