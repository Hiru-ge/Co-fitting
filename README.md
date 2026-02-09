# Roamble

コンフォートゾーンからの脱却をサポートするWebアプリです

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
├── backend/          # Go + Gin API
│   ├── main.go
│   ├── Dockerfile
│   └── go.mod
├── frontend/         # React + TypeScript + React Router v7
│   ├── app/
│   ├── Dockerfile
│   └── package.json
├── mysql/            # MySQL 初期化スクリプト
│   └── init/
│       └── 01_schema.sql
├── docker-compose.yml
├── Makefile
└── .env              # 環境変数
```
