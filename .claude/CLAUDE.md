# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**Roamble** — コンフォートゾーン脱却支援Webアプリケーション。AIによるパーソナライズされた場所提案とゲーミフィケーション（XP・レベル・バッジ）を組み合わせ、ユーザーの日常行動圏での新しい発見を促す。

## 技術スタック

- **Frontend**: React (TypeScript) + Vite, Tailwind CSS, React Query
- **Backend**: Go (net/http or Echo/Chi), JWT認証
- **Database**: MySQL 8.x, Redis (セッション/キャッシュ)
- **Infrastructure**: AWS (ECS or EC2, RDS, ElastiCache, S3 + CloudFront, Route 53)
- **External APIs**: Google Maps Places API, Google OAuth, Gemini API (Phase 2〜)
- **Testing**: Go: `testing` + testify / React: Vitest + React Testing Library
- **Linting**: Go: golangci-lint / React: ESLint + Prettier
- **API仕様**: OpenAPI (Swagger)
- **ローカル開発**: Docker + Docker Compose

## 開発フェーズ

現在のフェーズ: **Phase 0（最小公開）** — コア機能のみ実装。

Phase 0のスコープ:
- 提案機能（位置情報 + Google Places API + 興味タグベース提案）
- ゲーミフィケーション最小構成（XP + レベル + プログレスバー）
- 訪問記録（「行った！」ボタン + 履歴リスト）
- Google OAuth認証のみ
- 5画面構成: `/`(LP), `/login`, `/onboarding`, `/home`(コア画面), `/history`

Phase 0で**やらないもの**: メール認証、マップ可視化、バッジ、ストリーク、気分選択、感想メモ、検索半径設定、脱却頻度設定

## アーキテクチャ方針

- フロントエンドは表示に徹し、ビジネスロジックはバックエンドに集約
- APIはRESTful設計。MVPではバージョニングなし
- 位置情報はPlace IDのみサーバーに保存（精密位置データは端末のみ）
- Places APIレスポンスはRedisキャッシュ（TTL 24h）でコスト管理
- ステートレスなAPIサーバー設計でスケールアウト対応

## 主要APIパス（Phase 0）

- `POST /api/auth/oauth/google` — Google OAuth
- `GET /api/users/me` — ユーザー情報
- `GET /api/users/me/stats` — ユーザー統計
- `GET /api/genres` — ジャンルタグ一覧
- `PUT /api/users/me/interests` — 興味タグ更新
- `POST /api/suggestions` — 提案生成
- `POST /api/visits` — 訪問記録
- `GET /api/visits` — 訪問履歴

## データモデル（Phase 0）

主要テーブル: `users`, `genre_tags`, `user_interests`, `visit_history`

## XP設計

| アクション | XP |
|-----------|-----|
| 通常訪問（興味ジャンル内） | 50 XP |
| 脱却訪問（興味ジャンル外） | 100 XP |
| 初めてのジャンル訪問 | +50 XP ボーナス |

## プロジェクトドキュメント

- `docs/requirements.md` — 要件定義書
- `docs/validation-strategy.md` — ニーズ検証・プレローンチ戦略（Makers Guild折衷案）
- `docs/todo.md` — TODO（プレローンチ・実装・ローンチのタスク一覧）

## 関連ドキュメント（Obsidian Vault）

- `プログラミング日誌/_data/Roamble(コンフォートゾーン脱却サポーター)作成日誌.md` — 開発日誌
- `プログラミング日誌/_data/Roamble 要件定義書.md` — 要件定義書（Vault内コピー）

## 言語・コミュニケーション

- コミット・PRは日本語で記述
- コード内のコメントは最小限に、必要な場合は日本語でも可
