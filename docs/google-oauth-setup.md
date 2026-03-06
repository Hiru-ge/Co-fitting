# Google OAuth 2.0 設定・実装ガイド

> Issue #88（バックエンド）・#104（フロントエンド）の実装記録。
> コードには残らないGCP設定手順と、フロント〜バックエンド間の全認証フローを記録する。

---

## 1. GCP（Google Cloud Platform）設定手順

### 1-1. プロジェクトの準備

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. プロジェクトを選択（または新規作成）
3. 左メニュー → **「APIとサービス」→「OAuth 同意画面」**

### 1-2. OAuth 同意画面の設定

| 項目 | 設定値 |
|------|--------|
| ユーザーの種類 | 外部 |
| アプリ名 | Roamble |
| ユーザーサポートメール | official@roamble.app |
| スコープ | `email`, `profile`, `openid`（デフォルトで含まれる） |

> **テスト段階**では「公開ステータス：テスト」のままでよい。
> 本番リリース前に「本番環境に公開」する必要がある。

### 1-3. OAuth クライアントID の作成

1. 左メニュー → **「APIとサービス」→「認証情報」**
2. 「＋認証情報を作成」→「OAuth クライアント ID」
3. アプリケーションの種類: **ウェブアプリケーション**
4. 以下を設定して保存:

**承認済みの JavaScript 生成元**（フロントエンドのオリジン）
```
# ローカル開発
http://localhost:3000

# 本番環境（デプロイ後に追加）
https://roamble.pages.dev

# 取得したドメイン
https://roamble.app
```

**承認済みのリダイレクト URI**（今回は不要）
> `@react-oauth/google` の One Tap / ポップアップフローでは
> リダイレクトURIは不要。IDトークンをJavaScript側で直接受け取る。

5. 発行された **クライアントID** をコピーして `.env` に設定:
```env
# バックエンド用（トークン検証で使用）
GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com

# フロントエンド用（Vite経由でブラウザに公開）
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
```

> **注意**: 2つの環境変数は**同じ値**を設定する。
> Viteは `VITE_` プレフィックスの変数のみブラウザに公開するため、別名が必要。

---

## 2. Google OAuth 2.0 認証フロー全体像

```
ブラウザ（React）              バックエンド（Go/Gin）        Google
     |                               |                        |
     | ①「Googleでログイン」クリック   |                        |
     |─────────────────────────────────────────────────────►|
     |                               |   ②Googleアカウント選択 |
     |◄─────────────────────────────────────────────────────|
     |    IDトークン（JWT文字列）      |                        |
     |                               |                        |
     | ③ POST /api/auth/oauth/google  |                        |
     |   { id_token: "eyJhbG..." }   |                        |
     |──────────────────────────────►|                        |
     |                               | ④ GET tokeninfo?id_token=...
     |                               |────────────────────────►|
     |                               |◄────────────────────────|
     |                               |   { sub, email, name,  |
     |                               |     email_verified, aud}|
     |                               |                        |
     |                               | ⑤ aud == GOOGLE_OAUTH_CLIENT_ID ?
     |                               |   email_verified == true ?
     |                               |                        |
     |                               | ⑥ DBでメール検索        |
     |                               |   → なければ新規ユーザー作成
     |                               |   → あれば既存ユーザー取得
     |                               |                        |
     |                               | ⑦ JWTトークンペア生成   |
     |◄──────────────────────────────|                        |
     |  { access_token,              |                        |
     |    refresh_token,             |                        |
     |    is_new_user }              |                        |
     |                               |                        |
     | ⑧ localStorage に保存         |                        |
     | ⑨ /home へ遷移                |                        |
```

---

## 3. フロントエンド実装詳細

### 3-1. パッケージ

```bash
npm install @react-oauth/google
```

`@react-oauth/google` は Google Identity Services (GIS) のReactラッパー。
`GoogleLogin` コンポーネントがGoogleのUIボタンを描画し、認証後に IDトークンをコールバックで返す。

### 3-2. GoogleOAuthProvider のセットアップ

`app/root.tsx` — アプリ全体をラップする:

```tsx
import { GoogleOAuthProvider } from "@react-oauth/google";

export default function Root() {
  return (
    <html lang="ja">
      <body>
        <GoogleOAuthProvider
          clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""}
        >
          <Outlet />
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
```

> `VITE_GOOGLE_CLIENT_ID` が空だとGoogleの画面で `Missing required parameter: client_id` エラーになる。

### 3-3. GoogleLogin コンポーネントの使用

`app/routes/login.tsx` / `signup.tsx`:

```tsx
import { GoogleLogin } from "@react-oauth/google";
import { setToken, googleOAuth } from "~/lib/auth";

async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
  // credential = Google発行のIDトークン（JWT）
  if (!credentialResponse.credential) {
    setGoogleError("Googleログインに失敗しました。もう一度お試しください");
    return;
  }

  try {
    const { access_token, refresh_token } = await googleOAuth(
      credentialResponse.credential
    );
    setToken(access_token, refresh_token);  // localStorageに保存
    navigate("/home");
  } catch (err) {
    // エラーハンドリング
  }
}

<GoogleLogin
  onSuccess={handleGoogleSuccess}
  onError={() => setGoogleError("Googleログインに失敗しました")}
  text="signin_with"
  locale="ja"
/>
```

### 3-4. バックエンドへのIDトークン送信

`app/lib/auth.ts` の `googleOAuth()`:

```typescript
export async function googleOAuth(idToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/oauth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  // ...
  return res.json(); // { access_token, refresh_token, is_new_user }
}
```

---

## 4. バックエンド実装詳細

### 4-1. 環境変数と初期化

`main.go`:

```go
googleClientID := os.Getenv("GOOGLE_OAUTH_CLIENT_ID")
if googleClientID != "" {
    oauthHandler = &handlers.OAuthHandler{
        DB:          db,
        JWTCfg:      jwtCfg,
        RedisClient: redisClient,
        GoogleVerifier: &handlers.GoogleHTTPVerifier{
            ClientID: googleClientID,
        },
    }
}
```

> `GOOGLE_OAUTH_CLIENT_ID` が未設定の場合、`/api/auth/oauth/google` エンドポイント自体が登録されない（`nil` チェックで無効化）。

### 4-2. IDトークン検証（GoogleHTTPVerifier）

`handlers/google_oauth.go`:

```go
func (v *GoogleHTTPVerifier) VerifyIDToken(ctx context.Context, idToken string) (*GoogleUserInfo, error) {
    // Google公式のtokeninfo APIでトークンの有効性を確認
    url := fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", idToken)
    // ...
    // aud（Audience）が自分のclient_idと一致するか確認（なりすまし防止）
    if tokenInfo.Aud != v.ClientID {
        return nil, errors.New("token audience mismatch")
    }
    // ...
}
```

> **なぜ `aud` チェックが必要か**:
> IDトークンはJWT形式で、`aud` フィールドに「このトークンが誰向けか（=client_id）」が入っている。
> チェックしないと、他のサービスに向けて発行されたトークンを使った不正ログインが可能になる。

### 4-3. ユーザー登録・取得ロジック

```go
func (h *OAuthHandler) GoogleOAuth(c *gin.Context) {
    // 1. IDトークンを検証 → GoogleUserInfo取得
    userInfo, err := h.GoogleVerifier.VerifyIDToken(ctx, req.IDToken)

    // 2. メールが確認済みか確認
    if !userInfo.EmailVerified { ... }

    // 3. DBでメールアドレスを検索
    err = h.DB.Where("email = ?", userInfo.Email).First(&user).Error
    if errors.Is(err, gorm.ErrRecordNotFound) {
        // 新規ユーザー作成（display_name はGoogle名 or メール名）
        user = models.User{
            Email:       userInfo.Email,
            DisplayName: userInfo.Name,
            AvatarURL:   &userInfo.Picture,  // GoogleのプロフィールURLをセット
        }
        h.DB.Create(&user)
        isNewUser = true
    }

    // 4. JWTトークンペア生成・返却（メール/パスワード認証と同じ形式）
    tokenPair, _ := utils.GenerateTokenPair(...)
    c.JSON(200, googleOAuthResponse{
        AccessToken:  tokenPair.AccessToken,
        RefreshToken: tokenPair.RefreshToken,
        IsNewUser:    isNewUser,
    })
}
```

> **パスワードなしで登録されるユーザーの扱い**:
> Googleで登録したユーザーは `password_hash` が空（NULL）のまま保存される。
> メール/パスワードログインは不可能だが、Googleログインは毎回IDトークン検証で認証するため問題ない。

### 4-4. エンドポイント登録

`routes/routes.go`:

```go
auth := router.Group("/api/auth")
// GOOGLE_OAUTH_CLIENT_ID が設定されている場合のみ登録
if deps.OAuthHandler != nil {
    auth.POST("/oauth/google", deps.OAuthHandler.GoogleOAuth)
}
```

---

## 5. 環境変数まとめ

| 変数名 | 使用箇所 | 説明 |
|--------|----------|------|
| `GOOGLE_OAUTH_CLIENT_ID` | バックエンド（`main.go`） | IDトークンの `aud` 検証に使用 |
| `VITE_GOOGLE_CLIENT_ID` | フロントエンド（`root.tsx`） | `GoogleOAuthProvider` に渡すclient_id |

> 2つは**同じ値**。Viteのセキュリティ仕様（`VITE_` プレフィックスのみブラウザ公開）のため別名になっている。

---

## 6. Google Maps / Places API キー管理

### 6-1. なぜAPIキーを2本に分けるのか

Google APIキーには「アプリケーションの制限」として **HTTPリファラー制限**（ウェブサイト制限）を設定できる。
しかしこの制限を有効にすると、**Goサーバーからのサーバー間リクエストがブロックされる**。

| 呼び出し元 | Refererヘッダー | HTTPリファラー制限の結果 |
|------------|----------------|------------------------|
| ブラウザ（React） | 自動付与される（`http://localhost:5173/`） | ✅ 通過 |
| Goサーバー（Places API呼び出し） | 付与されない | ❌ 403ブロック |

1本のキーで両方の制限を満たすことはできないため、**用途別に2本に分ける**。

### 6-2. キーの設計

| キー | 用途 | アプリケーションの制限 | APIの制限 | 設定先環境変数 |
|------|------|----------------------|-----------|---------------|
| **フロントエンド用** | ブラウザからのMaps表示 | HTTPリファラー（ウェブサイト）制限 | Maps JavaScript API のみ | `VITE_GOOGLE_MAPS_API_KEY` |
| **バックエンド用** | サーバーからのPlaces API呼び出し（施設提案・写真取得） | なし（本番ではIP制限推奨） | Places API / Places Aggregate API / Places API (New) | `GOOGLE_PLACES_API_KEY` |

> **ポイント**: フロントエンド用キーはブラウザのソースコードに公開される前提。
> HTTPリファラー制限で「自分のドメインからしか使えない」状態にすることでセキュリティを担保する。

### 6-3. フロントエンド用キーの設定手順

1. GCP コンソール → 「APIとサービス」→「認証情報」
2. 「＋認証情報を作成」→「APIキー」
3. 作成したキーの「編集」を開く
4. **アプリケーションの制限** → 「HTTPリファラー（ウェブサイト）」を選択
5. 以下のリファラーを追加:
   ```
   http://localhost:3000/*
   http://localhost:5173/*
   https://roamble.pages.dev/*   ← ベータ版ドメイン
   ```
6. **APIの制限** → 「キーを制限」→ **Maps JavaScript API** のみ選択
7. キーをコピーして `frontend/.env` に設定:
   ```dotenv
   VITE_GOOGLE_MAPS_API_KEY=AIzaSy...（フロントエンド用キー）
   ```

### 6-4. バックエンド用キーの設定手順

1. GCP コンソール → 「APIとサービス」→「認証情報」
2. 「＋認証情報を作成」→「APIキー」
3. 作成したキーの「編集」を開く
4. **アプリケーションの制限** → 開発中は「なし」、本番ではECS/EC2のIPアドレスを設定
5. **APIの制限** → 「キーを制限」→ 以下をすべて選択:
   - Places API
   - Places Aggregate API
   - Places API (New)
6. キーをコピーして `.env`（ルート）に設定:
   ```dotenv
   GOOGLE_PLACES_API_KEY=AIzaSy...（バックエンド用キー）
   ```

### 6-5. 有効にすべきAPI一覧

GCP コンソール → 「APIとサービス」→「ライブラリ」で以下をすべて有効化する:

| API名 | 使用箇所 |
|-------|---------|
| Maps JavaScript API | フロント: 地図表示（`@vis.gl/react-google-maps`） |
| Places API | バックエンド: 施設提案・写真取得 |
| Places Aggregate API | バックエンド: 施設提案 |
| Places API (New) | バックエンド: 施設提案（新版） |

### 6-6. 環境変数まとめ（APIキー分）

| 変数名 | ファイル | 説明 |
|--------|---------|------|
| `VITE_GOOGLE_MAPS_API_KEY` | `frontend/.env` | Maps JavaScript API用（ブラウザ公開前提） |
| `GOOGLE_PLACES_API_KEY` | `.env`（ルート） | Places API用（サーバーのみ使用・公開しない） |

> **注意**: `.env` ファイルはGitignoreされているため、新しい環境にcloneした際は
> 既存メンバーからコピーするか、GCPコンソールでキーを再確認すること。

---

## 7. 本番環境への展開時のチェックリスト

- [ ] Google Cloud Console の「承認済みの JavaScript 生成元」に本番ドメインを追加
- [ ] OAuth 同意画面のステータスを「本番環境に公開」に変更（テスト用アカウント制限の解除）
- [ ] 本番環境の `.env`（またはシークレットマネージャー）に `GOOGLE_OAUTH_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` を設定
- [ ] `VITE_GOOGLE_CLIENT_ID` はビルド時に静的に埋め込まれるため、本番ビルド前に設定が必要
- [ ] フロントエンド用APIキーのHTTPリファラー制限に本番ドメイン（`https://roamble.pages.dev/*`）を追加
- [ ] バックエンド用APIキーのIP制限に本番サーバー（ECS/EC2）のIPアドレスを追加
- [ ] `VITE_GOOGLE_MAPS_API_KEY`（フロントエンド用キー）を本番ビルド前に設定
- [ ] `GOOGLE_PLACES_API_KEY`（バックエンド用キー）を本番環境の `.env` に設定
