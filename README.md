# Roamble

新しいお店・場所になかなか踏み出せない人のためのWebアプリです

## セットアップ・実行

### 1. 環境変数の設定

`.env` ファイルは既にリポジトリに作成されています。初回起動時に必要な環境変数が設定されます。

```bash
# 確認用（必要に応じて編集）
cat .env
```

### 2. Docker コンテナの起動

#### 最初の起動（ビルド含む）
```bash
make build
```

または

```bash
docker-compose up -d --build
```

#### 通常の起動
```bash
make up
```

### 3. アクセス

起動後、以下の URL でアクセス可能です：

| サービス | URL | 説明 |
|---------|-----|------|
| **フロントエンド** | http://localhost:3000 | React SPA（主要アプリ） |
| **バックエンド ヘルスチェック** | http://localhost:8000/health | API 疎通確認 |
| **MySQL** | localhost:3306 | ローカル接続用 |
| **Redis** | localhost:6379 | キャッシュ用 |

---

## よく使うコマンド

```bash
# コンテナの起動（バックグラウンド）
make up

# コンテナの停止・削除
make down

# コンテナの再起動
make restart

# 全コンテナのログを表示
make logs

# バックエンドのログのみ表示
make logs-be

# フロントエンドのログのみ表示
make logs-fe

# MySQL にシェルでアクセス（テスト・検証用）
make db-shell
# パスワード入力: (env で設定したもの)
```

---

## アーキテクチャ

```
├── backend/                    # Go + Gin API
│   ├── main.go                 # エントリーポイント・サーバー起動
│   ├── config/                 # 環境変数・設定読み込み
│   ├── database/               # DB接続・マイグレーション・Redis
│   ├── handlers/               # HTTPハンドラー（auth, user, visit, suggestion, badge, genre...）
│   ├── middleware/             # JWT認証・CORS・レートリミット・エラーハンドリング
│   ├── models/                 # データモデル（user, gamification）
│   ├── routes/                 # ルーティング定義
│   ├── services/               # ビジネスロジック（ゲーミフィケーション計算など）
│   ├── utils/                  # ユーティリティ（JWTブラックリストなど）
│   ├── testutil/               # テスト用ヘルパー
│   ├── docs/                   # Swagger / OpenAPI 仕様
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   └── go.mod
├── frontend/                   # React + TypeScript + React Router v7 (SPA)
│   ├── app/
│   │   ├── root.tsx            # アプリルート・グローバルレイアウト
│   │   ├── routes.ts           # ルート定義
│   │   ├── routes/             # ページコンポーネント（home, login, history, profile, settings, lp...）
│   │   ├── layouts/            # 共通レイアウト（app-layout, auth-layout）
│   │   ├── components/         # 再利用UIコンポーネント（card, modal, toast, nav...）
│   │   ├── hooks/              # カスタムフック
│   │   ├── api/                # APIクライアント（client.ts + 各エンドポイント）
│   │   ├── lib/                # 認証・トークン管理・GA・PWA などのユーティリティ
│   │   ├── types/              # TypeScript型定義
│   │   ├── utils/              # 汎用ユーティリティ（level, badge-icon, geolocation...）
│   │   └── __tests__/          # Vitest ユニットテスト
│   ├── e2e/                    # Playwright E2Eテスト
│   ├── Dockerfile
│   └── package.json
├── mysql/                      # MySQL 初期化スクリプト
│   └── init/
│       └── 01_schema.sql
├── docs/                       # プロジェクトドキュメント
├── docker-compose.yml
├── Makefile
└── .env                        # 環境変数
```
