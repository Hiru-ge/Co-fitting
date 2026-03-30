# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**Roamble** — コンフォートゾーン脱却支援Webアプリケーション。「新しい場所に行きたいけど怖い」を解決する。場所提案で心理的ハードルを下げ、ゲーミフィケーション（XP・レベル・バッジ）で「怖かったけど行けた」成功体験を積み重ねる。

## 技術スタック

- **Frontend**: React (TypeScript) + Vite, Tailwind CSS, React Query
- **Backend**: Go (Gin), JWT認証
- **Database**: TiDB Cloud Starter（MySQL互換・本番）/ MySQL 8.x（ローカル Docker）, Upstash Redis TLS（本番）/ Redis（ローカル Docker）
- **Infrastructure（本番）**: Google Cloud Run (asia-northeast1) / TiDB Cloud Starter / Upstash Redis / Cloudflare Pages / Cloudflare DNS（`roamble.app`）
- **External APIs**: Google Maps Places API, Google OAuth, Google Analytics 4 (GA4), Gemini API (Phase 3～)
- **PWA**: vite-plugin-pwa（Web App Manifest + Service Worker、`autoUpdate` モード、`display: standalone`）
- **Testing**: Go: `testing` + testify / React: Vitest + React Testing Library
- **Linting**: Go: golangci-lint / React: ESLint + Prettier
- **API仕様**: OpenAPI (Swagger)
- **ローカル開発**: Docker + Docker Compose

> **インフラ選定メモ（判断根拠）**: 当初 AWS（ECS + RDS + ElastiCache + S3 + Route 53）を想定していたが、Phase 0〜1 では $0 運用とレイテンシ最小化（東京リージョン、API 50–100ms）を優先し Google Cloud Run + 無料 PaaS 構成へ移行（Issue #249、Render Singapore 300–550ms → Cloud Run Tokyo 50–100ms）。コアの技術スタック（Go + MySQL 互換 + Redis）は維持。Phase 2 以降の規模拡大時に費用対効果を見て AWS への移行を検討。

## 開発フェーズ

タスク追加時はdocs/todo.mdのTODOリストに、優先度・工数・担当者・フェーズを明記して追加する。コードに変更が発生する場合はGitHub Issuesにもタスクを追加する。
GitHub Issuesにタスクを追加する際はghコマンドを用い、タスクタイトルと簡単なタスク概要のみを記載する。タスクの詳細はdocs/todo.mdにのみ記載する。
開発は全てt-wadaのTDDに従って、「RED→GREEN→REFACTOR」のサイクルで進行。

### GitHub Issue命名規則

Issue名は「〇〇エンドポイント実装」「〇〇画面実装」「〇〇サービス実装」「〇〇DBモデル実装」のように、**実装対象を明確にした体言止め**で命名する。「Step X:」などのフェーズ番号表記は使わない。過去のIssue（#88「Google OAuth認証エンドポイント実装」、#107「訪問詳細画面実装」等）のスタイルに従うこと。

### docs/todo.md の記述粒度

TDDで実装するタスクは `docs/todo.md` に以下の形式で記載する。ファイル名・関数名・引数型レベルまで明記すること。

```
**🔴 RED**
- [ ] `xxx_test.go` に `TestFuncName_Case` テスト作成（期待するHTTPステータス・戻り値を明記）

**🟢 GREEN**
- [ ] `xxx.go` に `FuncName(args Type) ReturnType` 実装
- [ ] `routes.go` にルート追加

**🔵 REFACTOR**
- [ ] 重複コードの切り出し・型定義の整理
```
ブランチは `main` / `develop` / `feat/xxx` の3階層構成。featureブランチは必ず `develop` を親として作成する。

### Worktree管理

**`claude -w` は使用しないこと**。`claude -w` は常に `main` を親としてworktreeを作成するため、このプロジェクトのブランチ戦略と合わない。
代わりに `/create-worktree-env` スキルを使い、`develop` を親としてworktreeを作成する:

```bash
# feat/xxx を develop から作成（envファイルも自動同期）
bash ~/.claude/skills/create-worktree-env/scripts/create_feature_worktree.sh feat/xxx

# 作成されたworktreeでClaudeを起動
cd /Users/hiruge/Project/Roamble/.claude/worktrees/feat-xxx && claude .
```

Agentツールで `isolation: "worktree"` を使う場合も同様に、手動でworktreeを用意してから `EnterWorktree` で入ること。

**git操作について**: Issue作成（`gh issue create`）以外のgit操作（commit・push・PR作成など）は行わないこと。タスクが完了したら `docs/todo.md` の該当項目にチェックを入れること。Issue作成時は、`Phase0`, `Phase1`, `Phase2`, `Phase3`, `Phase4`, `frontend`, `backend` の中から適切なラベルを付与すること。
現在のフェーズ: **Phase 1（ドッグフーディング中）** — ゲーミフィケーション（XP・レベル・バッジ）・Google OAuth・興味タグ/パーソナライズ提案などを実装済み。現在はPhase 1最終段階としてベータ版公開中。ユーザーフィードバックをもとに品質改善とバグ修正を継続中。Phase 2以降の機能（Gemini API連携、リマインダー、ソーシャル機能など）は一切実装せず、Phase 1の完成度向上に集中すること。

Phase 1のスコープ（実装済み・ベータ版公開中）:
- ゲーミフィケーション（XP・レベル・バッジ）
- Google OAuth
- 興味タグ / パーソナライズ提案
- 脱却モード
- Phase 0機能（提案・訪問記録・JWT認証）はすべて完了済み

Phase 1で**やらないもの**: Gemini API連携、リマインダー、ソーシャル機能、フレンド機能などのPhase 3以降の機能は一切実装しないこと。Phase 1はあくまで「基本的なゲーミフィケーション要素とパーソナライズ提案の実装と品質向上」に集中すること。

## フロントエンド注意事項

- **SPAモード**（`react-router.config.ts` で `ssr: false`）で動作。サーバーサイド専用の `loader` / `action` は使用不可。必ず `clientLoader` / `clientAction` を使うこと
- 認証トークン管理は `app/lib/auth.ts` に集約。`getToken` / `setToken` / `clearToken` / `logout` / `getUser`
- 認証保護が必要なルートは各ルートファイルに `clientLoader` を定義し、`getToken()` → `redirect("/login")` パターンを使う
- API呼び出しは `app/api/client.ts` の `apiCall()` ヘルパー経由で行う
- **ベータ合言葉**管理は `app/lib/beta-access.ts` に集約。`isUnlocked` / `unlockBeta` / `lockBeta`。未解錠ユーザーは `root.tsx` の `clientLoader` で `/beta-gate` にリダイレクトされる。`VITE_BETA_PASSPHRASE` 環境変数で合言葉を設定（ローカルの `.env` では `EARLYROAMER`）。ベータ期間終了後は本変数を削除し beta-gate ルートを廃止する
- **GA4 イベント送信**は `app/lib/gtag.ts` に集約。`sendVisitRecorded` / `sendBadgeEarned` / `sendSuggestionGenerated` 等のラッパー関数を使い、直接 `window.gtag()` を呼び出さないこと。`VITE_GA4_ID` が未設定のときは noop になる（ローカル開発では送信されない）

## アーキテクチャ方針

- フロントエンドは表示に徹し、ビジネスロジックはバックエンドに集約
- APIはRESTful設計。MVPではバージョニングなし
- 位置情報はPlace IDのみサーバーに保存（精密位置データは端末のみ）
- Places APIレスポンスはRedisキャッシュ（TTL 24h）でコスト管理
- ステートレスなAPIサーバー設計でスケールアウト対応

## 主要APIパス（Phase 1）

- `POST /api/auth/oauth/google` — Google OAuth認証
- `POST /api/auth/refresh` — トークンリフレッシュ
- `POST /api/auth/logout` — ログアウト
- `GET /api/users/me` — ユーザー情報
- `GET /api/users/me/stats` — XP・レベル統計
- `GET /api/users/me/badges` — 取得バッジ一覧
- `GET /api/users/me/proficiency` — ジャンル習熟度
- `GET /api/users/me/interests` — 興味タグ取得
- `PUT /api/users/me/interests` — 興味タグ更新
- `PATCH /api/users/me` — プロフィール更新
- `DELETE /api/users/me` — アカウント削除
- `GET /api/badges` — バッジ一覧
- `GET /api/genres` — ジャンル一覧
- `POST /api/suggestions` — 提案生成（興味タグによるパーソナライズ対応）
- `POST /api/visits` — 訪問記録
- `GET /api/visits` — 訪問履歴
- `GET /api/visits/map` — 訪問マップデータ
- `PATCH /api/visits/:id` — 訪問記録更新
- `GET /api/visits/:id` — 訪問記録詳細

## データモデル（Phase 1）

主要テーブル: `users`, `visits`, `genre_tags`, `badges`, `user_interests`, `genre_proficiencies`, `user_badges`

## XP設計（Phase 1）

| アクション | XP |
|-----------|-----|
| 通常訪問（興味タグ内のジャンル） | 50 XP |
| 脱却訪問（興味タグ外 かつ 熟練度Lv.5以下のジャンル） | 100 XP |
| 初エリアボーナス（前回訪問地から10km以上） | +30 XP |
| ストリークボーナス（週次） | 連続週数 × 10 XP（上限100 XP） |
| 感想メモ記入 | +10 XP |

## プロジェクトドキュメント

- `docs/requirements.md` — 要件定義書（機能要件・非機能要件・技術スタック・データモデル・API設計）
- `docs/product-strategy.md` — プロダクト戦略書（ビジョン・ターゲット・競合分析・検証計画・KPI・リテンション）
- `docs/marketing/marketing-strategy.md` — マーケティング戦略（ブランド・コンセプト・コンテンツ戦略・ロードマップ・LPコピー語彙）
- `docs/todo.md` — TODO（ドッグフーディング・品質改善・ローンチ準備のタスク一覧）
- `docs/infra/deploy.md` — デプロイセットアップ手順（Cloud Run・Cloudflare Pages）
- `docs/infra/google-oauth.md` — Google OAuth設定ガイド
- `docs/infra/domain-email.md` — ドメイン取得・メール設定手順

## 関連ドキュメント（Obsidian Vault）

- `プログラミング日誌/_data/Roamble(コンフォートゾーン脱却サポーター)作成日誌.md` — 開発日誌
- `プログラミング日誌/_data/Roamble 要件定義書.md` — 要件定義書（Vault内コピー）

## テスト方針

コードに変更を加えたあとは必ず以下の順でテストを実行し、全て通過したことを確認してから完了とすること。

### 1. ユニット・統合テスト

```bash
# バックエンド（handlers パッケージなど）
# -p 1 でパッケージを直列実行（並列実行するとDB共有状態が競合してテストが不安定になるため）
cd backend && go test -p 1 ./...

# フロントエンド（Vitest）
cd frontend && npx vitest run
```

### 2. E2Eテスト（Playwright）

バックエンドが起動済みの状態で実行する（`docker-compose up` が前提）。

```bash
cd frontend && npx playwright test
```

E2E テストは `frontend/e2e/main-flow.spec.ts` に定義されている。バックエンドに変更（エンドポイント・認証・リダイレクト）を加えた場合は特に必ず確認すること。バックエンドのコードを変更した場合は `docker-compose restart backend` で再起動してから実行する。

### 3. Lint（lefthook）

ユニットテスト・E2E テストの後、必ず lefthook を通してから完了とすること。

```bash
# プロジェクトルートで実行
lefthook run pre-commit
```

golangci-lint のキャッシュが古くて誤検知することがある。その場合はキャッシュをクリアしてから再実行する：

```bash
cd backend && golangci-lint cache clean
cd .. && lefthook run pre-commit
```

`backend-lint` は `{staged_files}` を使わず全ファイルをチェックするため、`git add` なしでも動作確認できる。

### 注意事項

- バックエンドは Docker コンテナ内で動作するため、`c.ClientIP()` はホスト IP ではなく Docker のゲートウェイ IP を返す。ループバック IP フィルタは機能しないため使用しないこと。
- E2E の `devTestLogin` ヘルパーは `/api/dev/auth/test-login` を呼び出すため、バックエンドが `development` 環境で起動している必要がある。

## 言語・コミュニケーション

- コミット・PRは日本語で記述
- コード内のコメントは最小限に、必要な場合は日本語でも可
