# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**Roamble** — コンフォートゾーン脱却支援Webアプリケーション。「新しい場所に行きたいけど怖い」を解決する。場所提案で心理的ハードルを下げ、ゲーミフィケーション（XP・レベル・バッジ）で「怖かったけど行けた」成功体験を積み重ねる。

## 技術スタック

- **Frontend**: React (TypeScript) + Vite, Tailwind CSS, React Query
- **Backend**: Go (Gin), JWT認証
- **Database**: MySQL 8.x, Redis (セッション/キャッシュ)
- **Infrastructure**: AWS (ECS or EC2, RDS, ElastiCache, S3 + CloudFront, Route 53)
- **External APIs**: Google Maps Places API, Google OAuth, Gemini API (Phase 3～)
- **Testing**: Go: `testing` + testify / React: Vitest + React Testing Library
- **Linting**: Go: golangci-lint / React: ESLint + Prettier
- **API仕様**: OpenAPI (Swagger)
- **ローカル開発**: Docker + Docker Compose

## 開発フェーズ

タスク追加時はdocs/todo.mdのTODOリストに、優先度・工数・担当者・フェーズを明記して追加する。コードに変更が発生する場合はGitHub Issuesにもタスクを追加する。
GitHub Issuesにタスクを追加する際はghコマンドを用い、タスクタイトルと簡単なタスク概要のみを記載する。タスクの詳細はdocs/todo.mdにのみ記載する。
開発は全てt-wadaのTDDに従って、「RED→GREEN→REFACTOR」のサイクルで進行。
ブランチはmain/masterと、機能ごとのfeatureブランチ(feat/xxx)を使用。
**git操作について**: Issue作成（`gh issue create`）以外のgit操作（commit・push・PR作成など）は行わないこと。タスクが完了したら `docs/todo.md` の該当項目にチェックを入れること。Issue作成時は、`Phase0`, `Phase1`, `Phase2`, `Phase3`, `Phase4`, `frontend`, `backend` の中から適切なラベルを付与すること。
現在のフェーズ: **Phase 1（ドッグフーディング中）** — ゲーミフィケーション（XP・レベル・バッジ）・Google OAuth・興味タグ/パーソナライズ提案などを実装済み。現在はPhase 1最終段階として自己利用（ドッグフーディング）による動作確認・品質改善中。

Phase 1のスコープ（実装済み・ドッグフーディング中）:
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
| 通常訪問（興味ジャンル内） | 50 XP |
| 脱却訪問（興味ジャンル外） | 100 XP |
| 初めてのジャンル訪問 | +50 XP ボーナス |

## プロジェクトドキュメント

- `docs/requirements.md` — 要件定義書（機能要件・非機能要件・技術スタック・データモデル・API設計）
- `docs/product-strategy.md` — プロダクト戦略書（ビジョン・ターゲット・競合分析・検証計画・KPI・リテンション）
- `docs/marketing/marketing-strategy.md` — マーケティング戦略（ブランド・コンセプト・コンテンツ戦略・ロードマップ）
- `docs/validation-strategy.md` — ニーズ検証・プレローンチ戦略（Makers Guild折衷案）
- `docs/todo.md` — TODO（ドッグフーディング・品質改善・ローンチ準備のタスク一覧）

## 関連ドキュメント（Obsidian Vault）

- `プログラミング日誌/_data/Roamble(コンフォートゾーン脱却サポーター)作成日誌.md` — 開発日誌
- `プログラミング日誌/_data/Roamble 要件定義書.md` — 要件定義書（Vault内コピー）

## テスト方針

コードに変更を加えたあとは必ず以下の順でテストを実行し、全て通過したことを確認してから完了とすること。

### 1. ユニット・統合テスト

```bash
# バックエンド（handlers パッケージなど）
cd backend && go test ./...

# フロントエンド（Vitest）
cd frontend && npx vitest run
```

### 2. E2Eテスト（Playwright）

バックエンドが起動済みの状態で実行する（`docker-compose up` が前提）。

```bash
cd frontend && npx playwright test
```

E2E テストは `frontend/e2e/main-flow.spec.ts` に定義されている。バックエンドに変更（エンドポイント・認証・リダイレクト）を加えた場合は特に必ず確認すること。バックエンドのコードを変更した場合は `docker-compose restart backend` で再起動してから実行する。

### 注意事項

- バックエンドは Docker コンテナ内で動作するため、`c.ClientIP()` はホスト IP ではなく Docker のゲートウェイ IP を返す。ループバック IP フィルタは機能しないため使用しないこと。
- E2E の `devTestLogin` ヘルパーは `/api/dev/auth/test-login` を呼び出すため、バックエンドが `development` 環境で起動している必要がある。

## 言語・コミュニケーション

- コミット・PRは日本語で記述
- コード内のコメントは最小限に、必要な場合は日本語でも可
