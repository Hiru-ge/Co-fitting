# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**Roamble** — コンフォートゾーン脱却支援Webアプリケーション。「新しい場所に行きたいけど怖い」を解決する。場所提案で心理的ハードルを下げ、ゲーミフィケーション（XP・レベル・バッジ）で「怖かったけど行けた」成功体験を積み重ねる。

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

現在のフェーズ: **Phase 0（最小公開・簡易版）** — コアループ「提案→行動→記録」のみ実装。2月中完成目標。

Phase 0のスコープ:
- 提案機能（位置情報 + Google Places API。パーソナライズなし）
- 訪問記録（「行った！」ボタン + 履歴リスト）
- メール+パスワード認証（JWT）
- 3画面構成: `/`(LP+ログイン), `/home`(コア画面), `/history`

Phase 0で**やらないもの**: Google OAuth、XP/レベル/ゲーミフィケーション、興味タグ/パーソナライズ提案、オンボーディング、脱却モード、マップ可視化、バッジ、ストリーク、気分選択、感想メモ、検索半径設定

## アーキテクチャ方針

- フロントエンドは表示に徹し、ビジネスロジックはバックエンドに集約
- APIはRESTful設計。MVPではバージョニングなし
- 位置情報はPlace IDのみサーバーに保存（精密位置データは端末のみ）
- Places APIレスポンスはRedisキャッシュ（TTL 24h）でコスト管理
- ステートレスなAPIサーバー設計でスケールアウト対応

## 主要APIパス（Phase 0）

- `POST /api/auth/signup` — ユーザー登録
- `POST /api/auth/login` — ログイン
- `POST /api/auth/refresh` — トークンリフレッシュ
- `POST /api/auth/logout` — ログアウト
- `GET /api/users/me` — ユーザー情報
- `POST /api/suggestions` — 提案生成
- `POST /api/visits` — 訪問記録
- `GET /api/visits` — 訪問履歴

## データモデル（Phase 0）

主要テーブル: `users`, `visit_history`

## XP設計（Phase 1〜）

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
