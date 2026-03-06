# ベータ版デプロイ セットアップ手順書

> **対象**: Issue #231 — 無料PaaSへのデプロイ
> **目標**: `roamble.pages.dev` でベータ版を公開する

---

## 全体の流れ

```
1. TiDB Cloud (DB) セットアップ
2. Upstash Redis セットアップ
3. Cloud Run (バックエンド) セットアップ  ← Issue #249 で Render (Singapore) から移行
4. Google OAuth リダイレクトURIを追加
5. Cloudflare Pages (フロントエンド) セットアップ
6. 動作確認
```

---

## 1. TiDB Cloud Starter — DB

### 1-1. アカウント作成・クラスター作成

1. https://tidbcloud.com にアクセスしてアカウント作成（GitHubログイン）
2. **Starter クラスター**を作成
   - Region: `ap-northeast-1`（Tokyo）を推奨
   - クラスター名: `roamble-prod` など

### 1-2. Spending Limit の設定（重要）

> **必ずやること**: 意図しない課金を防ぐため、Spending Limit を $0 に設定する

1. 左メニュー「Billing」→「Spending Limit」→ `$0` に設定

### 1-3. データベース・ユーザー作成

1. クラスター詳細画面 → 「Connect」ボタン
2. 「Create Password」でパスワードを生成・保存
3. TiDBの「SQL Editor」を開いて`CREATE DATABASE roamble;`を実行
4. 接続文字列（以下の形式）を控えておく:
   ```
   Host:     gateway01.ap-northeast-1.prod.aws.tidbcloud.com
   Port:     4000
   User:     xxxxxxxxxx.root
   Password: <生成したパスワード>
   Database: roamble
   ```

### 1-4. TLS接続の確認

TiDB Cloud は TLS 必須。接続文字列に `tls=true` を追加する必要がある（Render の環境変数設定時に対応）。

---

## 2. Upstash Redis

### 2-1. アカウント作成・DB作成

1. https://upstash.com にアクセスしてアカウント作成(GitHubログイン)
2. 「Create Database」
   - Name: `roamble-prod`
   - Type: **Regional**（Globalは有料）
   - Region: `ap-northeast-1`（Tokyo）
3. 作成後、「Details」タブを開いて以下を控える:
   ```
   Endpoint: xxxxx.upstash.io
   Port:     6379
   Token / Readonly Token: <自動生成>
   ```
   または `REDIS_URL` 形式（`redis://:password@endpoint:port`）も控える

---

## 3. Cloud Run (Tokyo) — バックエンド

> **Issue #249** で Render Free (Singapore) から移行。API レイテンシが 300-550ms → 50-100ms に改善。GCP 無料枠内で $0 運用。

### 3-1. 前提: gcloud CLI セットアップ

```bash
# 未インストールの場合
brew install --cask google-cloud-sdk

# 認証・プロジェクト設定
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 3-2. Artifact Registry リポジトリ作成（初回のみ）

GCP コンソールで Cloud Run API・Artifact Registry API を有効化した後:

```bash
gcloud artifacts repositories create roamble \
  --repository-format=docker \
  --location=asia-northeast1

gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```

### 3-3. イメージビルド・プッシュ・デプロイ

```bash
cd /path/to/Roamble

# イメージビルド＆プッシュ（backend/Dockerfile.prod を使用）
docker build -t asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/roamble/backend:latest \
  -f backend/Dockerfile.prod backend/
docker push asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/roamble/backend:latest

# Cloud Run にデプロイ
gcloud run deploy roamble-backend \
  --image asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/roamble/backend:latest \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "GIN_MODE=release,MYSQL_USER=...,MYSQL_PASSWORD=...,MYSQL_HOST=...,MYSQL_PORT=4000,MYSQL_DATABASE=roamble,MYSQL_TLS=true,REDIS_HOST=...,REDIS_PORT=6379,REDIS_PASSWORD=...,REDIS_TLS=true,JWT_SECRET=...,GOOGLE_OAUTH_CLIENT_ID=...,GOOGLE_PLACES_API_KEY=...,ALLOWED_ORIGIN=https://roamble.pages.dev,ENVIRONMENT=production"
```

### 3-4. 環境変数一覧

| 変数名 | 値 |
|--------|-----|
| `GIN_MODE` | `release` |
| `MYSQL_USER` | TiDB の User（例: `xxxxxxxxxx.root`） |
| `MYSQL_PASSWORD` | TiDB のパスワード |
| `MYSQL_HOST` | TiDB の Host（例: `gateway01.ap-northeast-1.prod.aws.tidbcloud.com`） |
| `MYSQL_PORT` | `4000` |
| `MYSQL_DATABASE` | `roamble` |
| `MYSQL_TLS` | `true`（TiDB Cloud 接続に必須） |
| `REDIS_HOST` | Upstash の Endpoint（例: `xxxxx.upstash.io`） |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | Upstash のパスワード |
| `REDIS_TLS` | `true`（Upstash は TLS 必須） |
| `JWT_SECRET` | ランダムな長い文字列（`openssl rand -base64 32` で生成） |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud の OAuth クライアントID |
| `GOOGLE_PLACES_API_KEY` | Google Cloud の Places API キー |
| `ALLOWED_ORIGIN` | `https://roamble.pages.dev` |
| `ENVIRONMENT` | `production` |

### 3-5. デプロイ後の確認

```bash
# TTFB が 50-100ms 台になっていることを確認
curl -w "\nTTFB: %{time_starttransfer}s\n" -o /dev/null -s \
  https://roamble-backend-XXXXXXXXXX.asia-northeast1.run.app/health
```

### 3-6. Dockerfile.prod について

`backend/Dockerfile` は開発用（hot reload）のため、本番用に `backend/Dockerfile.prod` を別途作成済み。

`Dockerfile.prod` の特徴:
- **マルチステージビルド**: `golang:alpine` でビルド → `alpine:latest` に実行バイナリのみコピー
- `ca-certificates` をインストール済み（TiDB / Upstash の TLS 接続に必要）

---

## ~~3-旧. Render (Singapore) — 初回デプロイ時の設定（現在は Cloud Run に移行済み）~~

> Render Free (Singapore) は固定レイテンシ 300-550ms のため Cloud Run (Tokyo) に移行。
> 以下はトラブルシューティング記録として残す。

**Render 環境変数の主な差異**: `GIN_MODE=release` 不要（Render はデフォルト設定あり）。
**UptimeRobot**: Render のスリープ防止用。Cloud Run はコールドスタート時のみ遅延（Go バイナリは 200-500ms で起動）するため不要。

---

## 4. Google Cloud Console — OAuth リダイレクトURI の追加

### 4-1. 設定変更

1. https://console.cloud.google.com にアクセス
2. 「APIs & Services」→「Credentials」
3. 対象の OAuth 2.0 クライアント ID をクリック
4. 「Authorized JavaScript origins」に追加:
   ```
   https://roamble.pages.dev
   ```
5. 「保存」

---

## 5. Cloudflare Pages — フロントエンド

### 5-1. アカウント作成

1. https://pages.cloudflare.com にアクセスしてアカウント作成（GitHubログイン）
2. GitHub リポジトリと連携

### 5-2. プロジェクト作成

> **注意**: Cloudflare **Pages** で作成すること。Cloudflare Workers として作成しないよう注意（Workers は `npx wrangler deploy` を使うサービスで別物）。

1. 左サイドバー「**Workers & Pages**」→「**Pages**」タブ
2. 「Create a project」→「Connect to Git」
3. リポジトリ選択: `roamble`
4. ビルド設定:
   - **Project name**: `roamble`（→ `roamble.pages.dev` になる）
   - **Production branch**: `main`
   - **Framework preset**: `None`（Viteは選択肢にないため。VitePressは別物なので選ばないこと）
   - **Build command**: `npm run build`
   - **Build output directory**: `build/client`（react-router v7 の SPAモードの出力先）
   - **Root directory**: `frontend`

### 5-3. 環境変数の設定

「Settings」→「Environment variables」→「Production」に以下を設定:

| 変数名 | 値 |
|--------|-----|
| `VITE_API_BASE_URL` | Cloud Run のサービス URL（例: `https://roamble-backend-XXXXXXXXXX.asia-northeast1.run.app`） |
| `VITE_GOOGLE_CLIENT_ID` | Google Cloud の OAuth クライアントID |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Cloud の Maps API キー |
| `VITE_BETA_PASSPHRASE` | ベータ版合言葉（ベータテスター通知時に決定） |

> `VITE_API_BASE_URL` の値は `gcloud run deploy` 完了時にターミナルに表示される Service URL

### 5-4. デプロイ

「Save and Deploy」→ 自動ビルドが走り、`roamble.pages.dev` で公開される

---

## 6. 動作確認チェックリスト

デプロイ完了後、以下を順番に確認する:

- [x] `https://roamble.pages.dev` にアクセスできる
- [x] 合言葉入力画面が表示される
- [x] Google ログインができる
- [x] 場所提案が生成される（Places API 経由）
- [x] 訪問記録ができ、XP・バッジが付与される
- [x] Render スリープからの復帰時間（UptimeRobot 設定後は不要のはず）
- [x] モバイルでの表示・操作感を確認(今感じた問題点はtodo.mdに記載済。あとでまとめてUX改善を行う)

---

---

## デプロイ時のコード変更点（初回デプロイで必要だった修正）

初回デプロイ時に発生した問題と、それに対応してコードに加えた変更の記録。

### 変更1: `backend/main.go` — PORT 環境変数対応

```go
// 変更前
router.Run(":8000")

// 変更後
port := os.Getenv("PORT")
if port == "" {
    port = "8000"
}
router.Run(":" + port)
```

**理由**: Render はデプロイ時に `PORT` 環境変数（デフォルト `10000`）を自動設定し、そのポートでアプリがリッスンしていることを確認してデプロイ完了とする。ポートをハードコードしていると Render がポートを検出できず `No open ports detected` エラーになる。

### 変更2: `backend/Dockerfile.prod` — 本番用 Dockerfile 新規作成

`backend/Dockerfile` は開発用（`go run` または `air`）のため、本番用を別途作成。マルチステージビルドで事前コンパイル済みバイナリを実行する構成。Render の「Dockerfile Path」に `./Dockerfile.prod` を指定する。

### 変更3: `backend/database/redis.go` — Upstash TLS 対応

```go
// 追加した処理
if os.Getenv("REDIS_TLS") == "true" {
    opts.TLSConfig = &tls.Config{}
}
```

**理由**: Upstash Redis はデフォルトで TLS 接続必須。コードがプレーンTCPで接続しようとすると `EOF` エラーになる。`REDIS_TLS=true` 環境変数でTLS接続を有効化できるようにした（ローカル開発の Docker Compose 環境には影響しない）。

---

## トラブルシューティング

### `No open ports detected` でデプロイが進まない

`main.go` でポートがハードコードされている。`PORT` 環境変数を読み取るように修正し、Render の「Dockerfile Path」を `./Dockerfile.prod` に変更する。

### `unknown config name: tidb` — DB 接続失敗

`MYSQL_TLS=tidb` は Go MySQL ドライバーが認識しない。**`MYSQL_TLS=true` に変更する**。

### `lookup redis: no such host` — Redis 接続失敗

`REDIS_HOST` 環境変数が未設定のため、Docker Compose のサービス名 `redis` がデフォルト値として使われている。Render の Environment に `REDIS_HOST`・`REDIS_PORT`・`REDIS_PASSWORD` を設定する。

### `EOF` — Redis 接続失敗

Upstash が TLS を要求しているのにプレーンTCPで接続している。Render の Environment に **`REDIS_TLS=true`** を追加する。

### UptimeRobot が `Monitor is Down`（404）になる — ブラウザでは正常応答

UptimeRobot はデフォルトで **HEAD リクエスト**を送信する。Gin の `router.GET()` は HEAD を自動処理しないため 404 になる。

`backend/routes/routes.go` に HEAD ハンドラーを追加して再デプロイする:

```go
router.GET("/health", deps.HealthHandler.HealthCheck)
router.HEAD("/health", deps.HealthHandler.HealthCheck) // UptimeRobot用
```

---

## 参考: 各サービスの無料枠制限

| サービス | 制限 |
|---------|------|
| Cloudflare Pages | 月500ビルド、帯域無制限 |
| Render Free | 512MB RAM、月750時間、15分スリープ |
| TiDB Cloud Starter | 5GB ストレージ、Spending Limit $0 設定必須 |
| Upstash Redis | 月500K コマンド、256MB |
| UptimeRobot | 50モニター、5分間隔 |
