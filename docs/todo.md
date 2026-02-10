# TODO — GitHub Issue 化ガイド

> 以下の各セクションをGitHub Issueとして作成してください。
> ラベル: `Phase-0`, `Phase-1`, `infra`, `backend`, `frontend`, `blocked`, `high-priority` を適宜付与

---

## 📋 インフラ整備（Phase 0・Phase 1 共通基盤）

### Issue: インフラ初期セットアップ
**優先度**: 🔴 High | **工数**: 3h | **担当**: 個人

**タスク概要**
Docker環境およびローカル開発環境を整備。以降のバックエンド・フロントエンド開発の基盤を構築する。

**実装内容**
- [x] GitHub内に新規リポジトリ作成 (`roamble`)
- [x] Docker Compose ファイル作成
  - [x] MySQL 8.x サービス（ボリュームマウント）
  - [x] Go バックエンド用コンテナ定義（Dockerfile）
  - [x] React フロントエンド用コンテナ定義（Dockerfile）
  - [x] Redis サービス（キャッシュ用、Phase 1で活用）
- [x] ローカル開発用 Makefile 作成（`make up`, `make down`, `make logs-backend` 等）
- [x] README に Docker 起動手順を記載

**受け入れ基準**
- [x] `docker-compose up` で 3 つサービス（MySQL / Go / Redis）が起動する
- [x] `http://localhost:3000` でフロントエンドにアクセス可能
- [x] `http://localhost:8000/health` でバックエンド ヘルスチェック OK
- [x] MySQL に接続でき、初期スキーマが自動作成される

---

### Issue: DBスキーマ設計・実装（Phase 0）
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: DB接続テスト

**タスク概要**
MySQL スキーマを設計・実装。Phase 0 に必要な最小限のテーブルを定義。

**実装内容**

**テーブル設計**

**1. `users` テーブル（Phase 0）**
- [x] スキーマを SQL で定義
  - id (BIGINT PRIMARY KEY AUTO_INCREMENT)
  - email (VARCHAR 255, UNIQUE)
  - password_hash (TEXT, bcrypt)
  - display_name (VARCHAR 100)
  - avatar_url (VARCHAR 500, NULL)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)
- [x] インデックス: email に UNIQUE インデックス
- [x] 初期データ: なし（手動登録テスト）

**2. `visit_history` テーブル（Phase 0）**
- [x] スキーマを SQL で定義
  - id (BIGINT PRIMARY KEY AUTO_INCREMENT)
  - user_id (BIGINT FOREIGN KEY → users.id)
  - place_id (VARCHAR 255, Google Places ID)
  - place_name (VARCHAR 255)
  - lat (DECIMAL 10,8)
  - lng (DECIMAL 11,8)
  - rating (DECIMAL 2,1, NULL)
  - memo (TEXT, NULL)
  - is_comfort_zone (BOOLEAN DEFAULT 0)
  - visited_at (TIMESTAMP)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- [x] インデックス: (user_id, visited_at)

**3. マイグレーションスクリプト**
- [x] `mysql/init/01_schema.sql` を作成
- [x] Docker Compose 起動時に自動実行する init.sql として MySQL コンテナに含める

**受け入れ基準**
- [x] `docker-compose up` 直後、MySQL に `users` と `visit_history` テーブルが存在
- [x] `mysql -u root -p` で接続し、`DESCRIBE users;` でスキーマ確認可能

---

### Issue: 環境変数管理・設定ファイル作成
**優先度**: 🟡 Medium | **工数**: 1h | **担当**: 個人

**タスク概要**
バックエンド・フロントエンドの環境変数テンプレートを作成。

**実装内容**
- [x] `.env` をリポジトリ直下に作成
- [x] docker-compose.yml から環境変数を参照する設定

**受け入れ基準**
- [x] `.env` ファイルが作成され、Docker 起動時に参照される
- [x] GitHub には `.env` が Push されていない

---

## 🔧 バックエンド（Go + Gin）— Phase 0

### Issue: Go プロジェクト初期セットアップ
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/4
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: go build成功確認

## タスク概要
Go プロジェクトの基本構造を整備。

## 実装内容
- [x] `backend/` ディレクトリを作成
- [x] `go.mod`, `go.sum` 初期化
- [x] 必要なライブラリをインストール
  - github.com/gin-gonic/gin
  - github.com/golang-jwt/jwt/v4
  - github.com/joho/godotenv
  - gorm.io/gorm + gorm.io/driver/mysql
  - golang.org/x/crypto (bcrypt)
  - googlemaps.github.io/maps
- [x] プロジェクト構造を定義 (config/, database/, models/, handlers/, middleware/, routes/, utils/ 作成完了)
  ```
  backend/
  ├── main.go
  ├── config/
  │   └── config.go (環境変数読み込み)
  ├── database/
  │   ├── db.go (MySQL接続)
  │   └── migrate.go (マイグレーション)
  ├── models/
  │   ├── user.go
  │   └── visit.go
  ├── handlers/
  │   ├── auth.go
  │   └── health.go
  ├── middleware/
  │   └── jwt.go
  ├── routes/
  │   └── routes.go
  ├── utils/
  │   └── error.go
  ├── Dockerfile
  └── Makefile
  ```
- [x] Makefile を作成
  - `make build`: Go バイナリビルド
  - `make run`: ローカル実行
  - `make test`: ユニットテスト実行
  - `make fmt`: コード自動整形
  - `make tidy`: 依存関係整理

## 受け入れ基準
- [x] `go mod tidy` が実行でき、依存関係エラーが出ない
- [x] ディレクトリ構造が上記に従っている
- [x] `make build` でバイナリが生成される

---

### Issue: ヘルスチェック API 実装（Go）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/5
**優先度**: 🟢 Low | **工数**: 0.5h | **担当**: 個人 | **テスト駆動**: TDD（テスト→実装）

**タスク概要**
バックエンド起動確認用ヘルスチェック API を実装。

**TDD プロセス（t-wadaの3段階）**

**🔴 RED PHASE**
- [x] `handlers/health_test.go` を作成し、以下のテストを書く

```go
func TestHealthCheck(t *testing.T) {
  // GET /health → 200 OK
  // レスポンス: { "status": "ok" }
}
```

- [x] テスト実行 → **失敗する**ことを確認

**🟢 GREEN PHASE**
- [x] `main.go` に Gin サーバー初期化コード
- [x] `GET /health` エンドポイント実装 (Docker環境構築時に追加、main.go で実装済み)
  - レスポンス: { "status": "ok" }
  - HTTP 200
- [x] テスト実行 → **通る**ことを確認

**🔵 REFACTOR PHASE**
- [x] コードの可読性向上
- [x] エラーハンドリング整理
- [x] テストは常に通っていることを確認

**受け入れ基準**
- [x] `go test ./handlers -v` で HealthCheck テスト成功 (✅ 実装完了・テスト成功)
- [x] `make run` で起動し、`curl http://localhost:8000/health` で `{"status":"ok"}` が返る (✅ ビルド・ローカル起動確認済み)
- [x] Docker 内から `curl http://localhost:8000/health` でアクセス可能 (✅ docker-compose up で動作確認済み)

---

### Issue: MySQL 接続・初期化処理実装（Go）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/6
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD（テスト→実装）

**タスク概要**
Go から MySQL へ接続し、GORM でモデルを自動マイグレーション。

**TDD プロセス**

**🔴 RED PHASE**
- [x] `database/db_test.go` を作成

```go
func TestDatabaseConnection(t *testing.T) {
  // MySQL に接続できるか
  // User・Visit テーブルが自動作成されるか
}
```

- [x] テスト実行 → **失敗**

**🟢 GREEN PHASE**
- [x] `database/db.go` に MySQL 接続コード
  - `fmt.Sprintf("...")` で DSN を構築
  - GORM で接続
  - 接続テスト（`Ping()`）
- [x] `database/migrate.go` にマイグレーション実装
  - `AutoMigrate(&User{}, &Visit{})` で テーブル自動作成
- [x] `models/user.go` で User 構造体定義

```go
type User struct {
  ID        uint64    `gorm:"primaryKey"`
  Email     string    `gorm:"uniqueIndex"`
  PasswordHash string
  DisplayName string
  AvatarURL *string
  CreatedAt time.Time
  UpdatedAt time.Time
}
```

- [x] `models/visit.go` で Visit 構造体定義
- [x] `main.go` で `db.Init()` → `db.Migrate()` を呼び出し
- [x] テスト実行 → **通る**

**🔵 REFACTOR PHASE**
- [x] エラーハンドリング改善
- [x] 接続プール設定最適化

**受け入れ基準**
- [x] `go test ./database -v` で全テスト成功
- [x] `docker-compose up` で MySQL コンテナが起動
- [x] `docker-compose logs backend` で接続成功ログが表示
- [x] MySQL クライアントで `SHOW TABLES;` でテーブルが存在

---

### Issue: JWT認証ミドルウェア実装（Go）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/7
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
JWT による認証ミドルウェアを実装。後続の認証が必要なエンドポイントで使用。

**TDD プロセス**

**🔴 RED PHASE**
- [x] `middleware/jwt_test.go` を作成

```go
func TestJWTMiddleware(t *testing.T) {
  // 有効なトークン → コンテキストに UserID が登録される
  // 無効なトークン → 401 Unauthorized
  // 期限切れトークン → 401 Unauthorized
}
```

**🟢 GREEN PHASE**
- [x] `middleware/jwt.go` で認証ミドルウェア実装
  - Authorization ヘッダーから Bearer トークン取得
  - JWT 署名検証
  - トークン期限チェック
  - ユーザー情報を ctx に格納
- [x] `utils/jwt_helper.go` でトークン生成・検証ユーティリティ
  - GenerateToken(userID uint64) (string, error)
  - VerifyToken(tokenString string) (*Claims, error)
- [x] JWT Claims 構造体定義

```go
type Claims struct {
  UserID uint64 `json:"user_id"`
  jwt.RegisteredClaims
}
```

**🔵 REFACTOR PHASE**
- [x] エラーメッセージの統一

**受け入れ基準**
- [x] `go test ./middleware -v` で全テスト成功
- [x] 無効なトークン → 401 Unauthorized
- [x] 有効なトークン → コンテキストに UserID が登録される
- [x] 期限切れトークン → 401 Unauthorized

---

### Issue: 認証API実装（Go） — signup / login
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/8
**優先度**: 🔴 High | **工数**: 3h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ユーザー登録・ログイン API を実装。

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `handlers/auth_test.go` を作成

```go
func TestSignUp(t *testing.T) {
  // 有効なデータ → 201 Created
  // メール重複 → 409 Conflict
  // バリデーションエラー → 400 Bad Request
  // パスワードが平文で保存されない
}

func TestLogin(t *testing.T) {
  // 有効な認証情報 → 200 OK + トークン
  // ユーザー不在 → 401 Unauthorized
  // パスワード不一致 → 401 Unauthorized
}
```

- [ ] テスト実行 → **失敗**

**🟢 GREEN PHASE**
- [ ] `handlers/auth.go` に SignUp ハンドラー実装

```
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "securepassword",
  "display_name": "John Doe"
}
```

  - バリデーション: email, password (8文字以上), display_name
  - 重複チェック
  - bcrypt でハッシュ化
  - 201 Created で返す

- [ ] `handlers/auth.go` に Login ハンドラー実装

```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

  - パスワード検証（bcrypt.CompareHashAndPassword）
  - JWT トークン生成（アクセス15分、リフレッシュ7日）
  - 200 OK で返す

- [ ] テスト実行 → **通る**

**🔵 REFACTOR PHASE**
- [ ] エラーハンドリング一元化
- [ ] バリデーションロジック分離

**受け入れ基準**
- [ ] `go test ./handlers -v -run Auth` で全テスト成功
- [ ] Postman で signup → login → トークン取得までシーケンステスト実行
- [ ] パスワードが平文で DB に保存されていない
- [ ] 同じメールでの重複登録が拒否される

---

### Issue: ユーザー情報取得API実装（Go） — GET /api/users/me
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/9
**優先度**: 🟡 Medium | **工数**: 1h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
JWT 認証後、現在のユーザー情報を取得する API を実装。

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `handlers/user_test.go` を作成

```go
func TestGetMe(t *testing.T) {
  // JWT つき → 自身の情報が返される
  // JWT なし → 401 Unauthorized
  // ユーザー不在 → 404 Not Found
}
```

**🟢 GREEN PHASE**
- [ ] `handlers/user.go` に GetMe ハンドラー実装
- [ ] JWT ミドルウェアで保護
- [ ] 200 OK で ユーザー情報を返す

**🔵 REFACTOR PHASE**
- [ ] 完了

**受け入れ基準**
- [ ] JWT つきのリクエストで自身の情報が返される
- [ ] JWT なし → 401

---

### Issue: 提案API実装（Go） — POST /api/suggestions（Phase 0ベース）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/10
**優先度**: 🔴 High | **工数**: 3h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
Google Places API を使用し、周辺施設を提案する API を実装。
Phase 0 では最小限のロジック（パーソナライズなし）で実装。

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `handlers/suggestion_test.go` を作成

```go
func TestGetSuggestion(t *testing.T) {
  // 有効な座標 → 施設が返される
  // 訪問済みの場所は除外される
  // API キー不正 → エラー
  // 周辺施設なし → 404
}
```

**🟢 GREEN PHASE**
- [ ] `handlers/suggestion.go` に Suggest ハンドラー実装
- [ ] Google Places API でリクエスト

```
POST /api/suggestions
{
  "lat": 35.6762,
  "lng": 139.6503,
  "radius": 3000
}
```

- [ ] 訪問済みの場所を除外（visit_history 照合）
- [ ] ランダムに1件を選出
- [ ] Redis キャッシュ（TTL 24h）
- [ ] 200 OK で提案を返す

**🔵 REFACTOR PHASE**
- [ ] キャッシュ戦略改善

**受け入れ基準**
- [ ] Google Places API キー設定後、実際の提案が返される
- [ ] 同じ訪問済み施設は提案されない
- [ ] Redis キャッシュが効いている

---

### Issue: 訪問記録API実装（Go） — POST /api/visits
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/11
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ユーザーが場所を訪問したことを記録する API を実装。

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `handlers/visit_test.go` を作成

```go
func TestCreateVisit(t *testing.T) {
  // 有効なデータ → 201 Created
  // バリデーションエラー → 400
  // JWT なし → 401
}
```

**🟢 GREEN PHASE**
- [ ] `handlers/visit.go` に CreateVisit ハンドラー実装

```
POST /api/visits
{
  "place_id": "ChIJl...",
  "place_name": "隠れ家カフェ MOON",
  "lat": 35.677,
  "lng": 139.650,
  "rating": 4.3,
  "visited_at": "2024-02-07T15:30:00Z"
}
```

- [ ] バリデーション: place_id, place_name, lat/lng, visited_at
- [ ] JWT から UserID を取得して DB に保存
- [ ] 201 Created で返す

**🔵 REFACTOR PHASE**
- [ ] 完了

**受け入れ基準**
- [ ] 訪問記録が DB に正しく保存される
- [ ] 同じユーザーが同じ place_id を複数回登録できる

---

### Issue: 訪問履歴取得API実装（Go） — GET /api/visits
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/12
**優先度**: 🟡 Medium | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ユーザーの訪問履歴を一覧取得する API を実装。

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `handlers/visit_test.go` に追加

```go
func TestListVisits(t *testing.T) {
  // 訪問履歴が降順で返される
  // ページネーション機能
  // 自分のレコードのみ
}
```

**🟢 GREEN PHASE**
- [ ] `handlers/visit.go` に ListVisits ハンドラー実装

```
GET /api/visits?limit=20&offset=0
```

- [ ] JWT から UserID を取得
- [ ] visited_at 降順でソート
- [ ] ページネーション適用

**🔵 REFACTOR PHASE**
- [ ] 完了

**受け入れ基準**
- [ ] 訪問履歴が降順の時系列で返される
- [ ] ページネーションが正常に機能
- [ ] 自分のレコードのみ返される

---

### Issue: ルーティング設定（Go）— Phase 0
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/13
**優先度**: 🟡 Medium | **工数**: 1h | **担当**: 個人

**タスク概要**
Gin ルーターにエンドポイントを集約・整理。

**実装内容**
- [ ] `routes/routes.go` にルーターセットアップコード
- [ ] ルート構成（Phase 0）

```
GET /health

POST /api/auth/signup
POST /api/auth/login
GET /api/users/me (JWT)

POST /api/suggestions (JWT)
POST /api/visits (JWT)
GET /api/visits (JWT)
```

- [ ] CORS ミドルウェアを有効化（開発時は`*`許可）
- [ ] エラーハンドリング用グローバルミドルウェア
- [ ] `main.go` で routes.Setup(router) を呼び出し

**受け入れ基準**
- [ ] Postman で全エンドポイント一覧が管理可能
- [ ] CORS エラーが出ずフロントから呼び出せる状態

---

## 🎨 フロントエンド（React + TypeScript + React Router v7）— Phase 0

> **フロント設計方針**: 
> - **React Router v7 ファイルベースルーティング**を完全採用（routes.ts で一元管理）
> - **screen-design に忠実なデザイン実装**
> - **t-wadaの TDD フロー**で開発（テスト→実装→リファクタ）

### Issue: React Router v7 プロジェクト初期セットアップ
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/14
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: ビルド成功確認

**タスク概要**
React Router v7 ベースの SPA 開発環境を整備。
ファイルベースルーティング (routes.ts) で全ルートを一元管理。

**実装内容**

**プロジェクト初期化**
- [x] `npm create vite@latest .` (npm install 済み、node_modules も生成)

**React Router v7 推奨ディレクトリ構造**

```
frontend/
├── app/
│   ├── root.tsx               ← グローバルレイアウト（全ページ共通）
│   ├── routes.ts              ← ルーティング定義（ファイルベース）
│   ├── routes/
│   │   ├── index.tsx          ← / ランディングページ
│   │   ├── signup.tsx         ← /signup 新規登録
│   │   ├── login.tsx          ← /login ログイン
│   │   ├── home.tsx           ← /home ホーム（保護）
│   │   └── history.tsx        ← /history 履歴（保護）
│   ├── layouts/
│   │   ├── auth-layout.tsx    ← 認証画面用レイアウト
│   │   └── app-layout.tsx     ← アプリ画面用レイアウト
│   ├── components/
│   │   ├── suggestion-card.tsx
│   │   ├── navbar.tsx
│   │   ├── bottom-nav.tsx
│   │   └── protected-route.tsx
│   ├── api/
│   │   ├── auth.ts
│   │   ├── suggestions.ts
│   │   └── visits.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── suggestion.ts
│   │   └── visit.ts
│   ├── store/
│   │   └── auth.ts (zustand)
│   └── utils/
│       ├── constants.ts
│       └── helpers.ts
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── Dockerfile
```

**必要なライブラリをインストール**
- [x] react-router-dom v7 (v7.0 記載)
- [x] @reduxjs/toolkit or zustand （状態管理） (zustand 未使用予定。loader/action で管理)
- [x] axios （HTTP クライアント） (axios 記載)
- [x] @tanstack/react-query （データフェッチ） (@tanstack/react-query 記載)
- [x] tailwindcss + postcss (tailwindcss, postcss 記載)
- [x] lucide-react （アイコン） (lucide-react 記載)
- [~] vitest + @testing-library/react （テスト） (vitest, @testing-library/react 記載。ただしテストコード未作成)

**Tailwind CSS 設定**
- [~] tailwind.config.js で色・タイポグラフィ定義 (基本設定のみ。色定義は未完了)
- [~] src/index.css に @tailwind ディレクティブ (基本設定のみ)

**環境変数**
- [x] `.env` に VITE_API_BASE_URL=http://localhost:8000

**Makefile**
- `make dev`: 開発サーバー起動
- `make build`: プロダクション ビルド
- `make test`: テスト実行

**受け入れ基準**
- [~] `npm run build` がエラーなく完了 (✅ ビルド成功、ただし production 環境での検証は未実施)
- [~] `npm run dev` で http://localhost:5173 にアクセス可能 (✅ docker-compose up で起動、ただしローカル npm run dev での実行は未確認)
- [~] TypeScript エラーなし（`npm run type-check`） (基本的な型定義のみ。ページコンポーネント未実装のため型チェック未実施)

---

### Issue: React Router v7 ルーティング設定
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/15
**優先度**: 🔴 High | **工数**: 1.5h | **担当**: 個人 | **テスト駆動**: render確認

**タスク概要**
React Router v7 のファイルベースルーティングを設定。

**実装内容**

**routes.ts 作成（ルーティング一元管理）**

**ReactRouter v7 推奨パターン:**

```typescript
// app/routes.ts
import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // レイアウトなし（ランディング）
  index("routes/index.tsx"),                    // "/" 
  
  // 認証レイアウト
  layout("layouts/auth-layout.tsx", [
    route("signup", "routes/signup.tsx"),       // "/signup"
    route("login", "routes/login.tsx"),         // "/login"
  ]),
  
  // アプリレイアウト（認証必須）
  layout("layouts/app-layout.tsx", [
    route("home", "routes/home.tsx"),           // "/home"
    route("history", "routes/history.tsx"),     // "/history"
  ]),
] satisfies RouteConfig;
```

**root.tsx 作成（グローバルレイアウト）**

```typescript
// app/root.tsx
import { Outlet } from "react-router";

export default function Root() {
  return (
    <html lang="ja">
      <body>
        <Outlet /> {/* 各ページコンポーネントがここに表示される */}
      </body>
    </html>
  );
}
```

**各ルートファイル作成**

- [ ] app/routes/index.tsx （ランディングページ）
- [ ] app/routes/signup.tsx （新規登録）
- [ ] app/routes/login.tsx （ログイン）
- [~] app/routes/home.tsx （ホーム） (✅ 簡易実装のみ、業務ロジック未実装)
- [ ] app/routes/history.tsx （履歴）

**レイアウトコンポーネント作成**

- [ ] app/layouts/auth-layout.tsx （認証画面用。シンプルな中央配置フォーム）
  
- [ ] app/layouts/app-layout.tsx （アプリ画面用。ナビゲーション + ボトムタブ）

- [ ] app/components/protected-route.tsx （認証保護。React Router v7 loader で代替予定）

**受け入れ基準**
- [ ] `npm run dev` でアプリが起動可能
- [ ] ページ遷移がクライアントサイドで完結（リロードなし）
- [ ] 保護されたルートに未認証でアクセス → ログインページへリダイレクト

---

### Issue: 認証状態管理実装（React + React Router v7 loader）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/16
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
React Router v7 の loader / action で JWT トークン管理・認証状態を実装。
Zustand不要。ルーティング層で認証を一元管理。

**実装内容**

**セッション管理（ローカルストレージ + loader）**

**A. `app/auth.server.ts` - サーバーモジュール（ローカルストレージアクセス）**

```typescript
// app/auth.server.ts
const TOKEN_KEY = 'roamble_token';

export async function getToken(): Promise<string | null> {
  // ブラウザ環境でのみ動作
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function getUser(token: string) {
  const res = await fetch('http://localhost:8000/api/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}
```

**B. `app/routes.ts` - ルート定義でloaderを適用**

```typescript
// app/routes.ts
import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";
import { getToken, getUser } from './auth.server';

// 認証が必要なページ用のloader
async function protectedLoader() {
  const token = await getToken();
  if (!token) {
    throw redirect('/login');
  }
  try {
    const user = await getUser(token);
    return { user, token };
  } catch {
    throw redirect('/login');
  }
}

export default [
  index("routes/index.tsx"),
  
  layout("layouts/auth-layout.tsx", [
    route("signup", "routes/signup.tsx"),
    route("login", "routes/login.tsx"),
  ]),
  
  layout("layouts/app-layout.tsx", [
    {
      path: "home",
      file: "routes/home.tsx",
      loader: protectedLoader,
    },
    {
      path: "history",
      file: "routes/history.tsx",
      loader: protectedLoader,
    },
  ]),
] satisfies RouteConfig;
```

**C. 各ページでloaderDataを使用**

```typescript
// app/routes/home.tsx
import type { Route } from "./+types/home";

export async function loader({ params }: Route.LoaderArgs) {
  const token = getToken();
  if (!token) throw redirect('/login');
  const user = await getUser(token);
  return { user, token };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  // loaderData から user, token を取得
  const { user, token } = loaderData;
  
  return (
    <div>
      <p>ようこそ、{user.display_name}さん</p>
      {/* ... */}
    </div>
  );
}
```

**API呼び出し用のヘルパー**

**`app/api/client.ts` - トークン付きfetch**

```typescript
// app/api/client.ts
export async function apiCall(
  endpoint: string,
  token: string,
  options: RequestInit = {}
) {
  const res = await fetch(`http://localhost:8000${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }

  return res.json();
}
```

**`app/api/suggestions.ts`**

```typescript
// app/api/suggestions.ts
import { apiCall } from './client';

export async function getSuggestion(
  token: string,
  lat: number,
  lng: number,
  radius: number = 3000
) {
  return apiCall('/api/suggestions', token, {
    method: 'POST',
    body: JSON.stringify({ lat, lng, radius }),
  });
}
```

**`app/api/visits.ts`**

```typescript
// app/api/visits.ts
import { apiCall } from './client';

export async function createVisit(token: string, visitData: any) {
  return apiCall('/api/visits', token, {
    method: 'POST',
    body: JSON.stringify(visitData),
  });
}

export async function listVisits(
  token: string,
  limit: number = 20,
  offset: number = 0
) {
  return apiCall(`/api/visits?limit=${limit}&offset=${offset}`, token);
}
```

**ログイン / ログアウト処理**

**`app/routes/login.tsx` - action で トークン保存**

```typescript
// app/routes/login.tsx
import { Form, redirect } from "react-router";
import { setToken } from "~/auth.server";
import type { Route } from "./+types/login";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') return null;

  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const res = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return { error: 'ログイン失敗' };
    }

    const { access_token } = await res.json();
    setToken(access_token); // ローカルストレージに保存

    return redirect('/home');
  } catch (error) {
    return { error: error.message };
  }
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <Form method="post">
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">ログイン</button>
      {actionData?.error && <p className="error">{actionData.error}</p>}
    </Form>
  );
}
```

**`app/routes/index.tsx` - ログアウト**

```typescript
// app/routes/index.tsx (部分)
import { clearToken } from "~/auth.server";

function handleLogout() {
  clearToken();
  window.location.href = '/login';
}
```

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `app/__tests__/auth.test.ts` を作成

```typescript
test("ログイン action 実行後、トークンがローカルストレージに保存される", () => {
  // action を呼び出して、updateTokenが実行されるか確認
});

test("loader で認証なし → /login へリダイレクト", () => {
  // protectedLoader を呼び出して、redirect が発火するか確認
});

test("loader で有効なトークン → user データが返される", () => {
  // protectedLoader でユーザー情報が正しく取得されるか確認
});
```

- [ ] テスト実行 → **失敗**

**🟢 GREEN PHASE**
- [ ] 上記の実装を完成させる
- [ ] テスト実行 → **通る**

**🔵 REFACTOR PHASE**
- [ ] エラーハンドリング改善
- [ ] token 有効期限チェック実装（リフレッシュトークン対応）

**受け入れ基準**
- [ ] `npm run test` で全テスト成功
- [ ] ログイン後、ローカルストレージにトークンが保存される
- [ ] ページリロード後、loader で自動的にトークンから user が復元される
- [ ] トークンなしで保護ページ → /login へリダイレクト
- [ ] Zustand / Context API は**使わない**（不要）

---

## 利点まとめ

| 観点 | 説明 |
|------|------|
| **シンプル** | loader/action ですべて完結。グローバル状態管理ライブラリ不要 |
| **型安全** | `loaderData` の型が自動推論される |
| **キャッシュ戦略** | React Router が自動管理。手動で revalidate 不要 |
| **ページリロード対応** | loader が自動実行されるため、トークン復元は任意（ユーザーが refresh したら自動） |
| **認証保護** | loader内で条件分岐 → 簡単に PrivateRoute を実装 |
| **依存関係削減** | Zustand, Jotai, Redux など の学習コスト ゼロ |
