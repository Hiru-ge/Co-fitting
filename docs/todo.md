# TODO — GitHub Issue 化ガイド

> 以下の各セクションをGitHub Issueとして作成してください。
> ラベル: `Phase0`, `Phase1`, `backend`, `frontend` を適宜付与

---

## 📋 インフラ整備（Phase 0・Phase 1 共通基盤）

### Issue: インフラ初期セットアップ ✅ 完了
**タスク概要**
Docker環境およびローカル開発環境を整備。以降のバックエンド・フロントエンド開発の基盤を構築する。

### Issue: DBスキーマ設計・実装（Phase 0） ✅ 完了
**タスク概要**
MySQL スキーマを設計・実装。Phase 0 に必要な最小限のテーブル(`users`, `visit_history`)を定義。

### Issue: 環境変数管理・設定ファイル作成 ✅ 完了
**タスク概要**
バックエンド・フロントエンドの環境変数ファイルを作成。

## 🔧 バックエンド（Go + Gin）— Phase 0

### Issue: Go プロジェクト初期セットアップ ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/4
**タスク**: Go プロジェクト基本構造の整備

### Issue: ヘルスチェック API 実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/5
**タスク**: `GET /health` エンドポイント実装

### Issue: MySQL 接続・初期化処理実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/6
**タスク**: GORM 経由での MySQL 接続・テーブル自動マイグレーション

### Issue: JWT認証ミドルウェア実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/7
**タスク**: JWT ベースの認証ミドルウェア・ユーティリティ実装

### Issue: 認証API実装（signup/login） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/8
**タスク**: ユーザー登録・ログイン API 実装

### Issue: トークンリフレッシュAPI実装（Go） — POST /api/auth/refresh ✅ 完了
**GitHub Issue**:　https://github.com/Hiru-ge/Roamble/issues/38
**タスク**: リフレッシュトークンを使用して新しいアクセストークンを取得する API を実装。

### Issue: ログアウトAPI実装（Go） — POST /api/auth/logout ✅ 完了
**GitHub Issue**:　https://github.com/Hiru-ge/Roamble/issues/39
**タスク**: ユーザーのログアウト処理を実装。トークンを無効化する。

### Issue: ユーザー情報取得API実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/9
**タスク**: GET /api/users/me エンドポイント実装

### Issue: 提案API実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/10
**タスク**: Google Places API 連携・周辺施設提案エンドポイント実装

### Issue: 訪問記録API実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/11
**タスク**: POST /api/visits エンドポイント実装

### Issue: 訪問履歴取得API実装 ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/12
**タスク**: GET /api/visits エンドポイント実装

### Issue: ルーティング設定（Gin）✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/13
**タスク**: Gin ルーターにエンドポイントを集約

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
- [x] vitest + @testing-library/react （テスト） (vitest, @testing-library/react 記載)

**環境変数**
- [x] `.env` に VITE_API_BASE_URL=http://localhost:8000

**Makefile**
- `make dev`: 開発サーバー起動
- `make build`: プロダクション ビルド
- `make test`: テスト実行

**受け入れ基準**
- [x] `npm run build` がエラーなく完了
- [x] `npm run dev` で http://localhost:5173 にアクセス可能
- [x] TypeScript エラーなし（`npm run type-check`）

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

※　各ルートファイル(`index.tsx`, `signup.tsx`, `login.tsx`, `home.tsx`, `history.tsx`)や各レイアウトコンポーネントは一旦は空でOK（後続Issueで実装）

---

### Issue: 認証状態管理実装（React + React Router v7 clientLoader） ✅ 完了
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/16
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
React Router v7 の clientLoader / clientAction で JWT トークン管理・認証状態を実装。
Zustand不要。ルーティング層で認証を一元管理。

> **注意**: SPAモード（`react-router.config.ts` で `ssr: false`）のため、サーバーサイド専用の `loader` / `action` は使用不可。必ず `clientLoader` / `clientAction` を使う。

**実装内容**

**A. `app/lib/auth.ts` - 認証トークン管理**

```typescript
// app/lib/auth.ts
import { apiCall } from "~/api/client";

const TOKEN_KEY = "roamble_token";
const REFRESH_TOKEN_KEY = "roamble_refresh_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch("http://localhost:8000/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // API失敗してもローカルトークンは必ず削除する
    }
  }
  clearToken();
}

export async function refreshToken(): Promise<void> {
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  const res = await fetch("http://localhost:8000/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }
  const { access_token, refresh_token } = await res.json();
  setToken(access_token, refresh_token);
}

export async function getUser(
  token: string
): Promise<{ id: number; email: string; display_name: string }> {
  return apiCall("/api/users/me", token);
}
```

**B. `app/lib/protected-loader.ts` - 認証ガード**

```typescript
// app/lib/protected-loader.ts
import { redirect } from "react-router";
import { getToken, getUser } from "./auth";

export async function protectedLoader() {
  const token = getToken();
  if (!token) {
    throw redirect("/login");
  }
  try {
    const user = await getUser(token);
    return { user, token };
  } catch {
    throw redirect("/login");
  }
}
```

**C. 各保護ページで clientLoader を使用**

```typescript
// app/routes/home.tsx
import type { Route } from "./+types/home";
import { redirect, Link } from "react-router";
import { getToken, getUser } from "~/lib/auth";

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const user = await getUser(token);
  return { user, token };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  return (
    <div>
      <p>ようこそ、{user.display_name}さん</p>
      <p>ここはホーム画面です</p>
      <Link to="/history">履歴</Link>
    </div>
  );
}
```

**D. `app/api/client.ts` - トークン付きfetch**

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

**E. `app/api/suggestions.ts`**

```typescript
// app/api/suggestions.ts
import { apiCall } from "./client";

export async function getSuggestion(
  token: string,
  lat: number,
  lng: number,
  radius?: number
) {
  const body: Record<string, number> = { lat, lng };
  if (radius !== undefined) {
    body.radius = radius;
  }
  return apiCall("/api/suggestions", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
```

**F. `app/api/visits.ts`**

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

**G. `app/routes/login.tsx` - clientAction でトークン保存**

```typescript
// app/routes/login.tsx
import { Form, redirect } from "react-router";
import { setToken } from "~/lib/auth";
import type { Route } from "./+types/login";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const res = await fetch("http://localhost:8000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return { error: "メールアドレスまたはパスワードが正しくありません" };
    }

    const { access_token, refresh_token } = await res.json();
    setToken(access_token, refresh_token);

    return redirect("/home");
  } catch {
    return { error: "ネットワークエラーが発生しました" };
  }
}
```

**H. `app/routes/signup.tsx` - clientAction でサインアップ**

```typescript
// app/routes/signup.tsx
import { Form, redirect } from "react-router";
import { setToken } from "~/lib/auth";
import type { Route } from "./+types/signup";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const display_name = formData.get("display_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const res = await fetch("http://localhost:8000/api/auth/signup", { ... });
    if (!res.ok) {
      return { error: "サインアップに失敗しました。メールアドレスが既に使用されている可能性があります。" };
    }
    const { access_token, refresh_token } = await res.json();
    setToken(access_token, refresh_token);
    return redirect("/home");
  } catch {
    return { error: "ネットワークエラーが発生しました" };
  }
}
```

**I. `app/routes/index.tsx` - ログアウト**
最終的にはモーダル等でログアウトできる様にしたいが、一旦indexにログアウトボタンを置く

```typescript
// app/routes/index.tsx
import { Link, Form, redirect } from "react-router";
import { logout } from "~/lib/auth";

export async function clientAction() {
  await logout(); // バックエンド POST /api/auth/logout → トークン削除
  return redirect("/login");
}
```

**テスト（全23テスト PASS）**

- `app/__tests__/auth.test.ts`（10テスト）
  - [x] setToken でアクセストークンが localStorage に保存される
  - [x] setToken でリフレッシュトークンも保存できる
  - [x] getToken で保存済みトークンを取得できる
  - [x] getToken でトークン未保存時は null を返す
  - [x] clearToken で全トークンが削除される
  - [x] 有効なトークンで user データが返される
  - [x] 無効なトークンでエラーが throw される
  - [x] トークンなしで Response (redirect) が throw される
  - [x] 有効なトークンで user と token が返される
  - [x] トークンはあるが getUser 失敗で redirect が throw される
- `app/__tests__/login-action.test.ts`（6テスト）
  - [x] ログイン成功 → トークン保存 → /home へリダイレクト
  - [x] ログイン失敗 → エラーメッセージ返却
  - [x] ログアウト → バックエンドAPI呼び出し → トークン削除
  - [x] ログアウト → API失敗でもトークンは削除される
  - [x] リフレッシュ成功 → 新トークンが保存される
  - [x] リフレッシュ失敗 → エラーが throw される
- `app/__tests__/api.test.ts`（7テスト）
  - [x] apiCall: Authorization ヘッダー付きでリクエスト送信
  - [x] apiCall: APIエラー時に例外を throw
  - [x] getSuggestion: 位置情報を送信
  - [x] getSuggestion: radius指定なしでも動作
  - [x] createVisit: 訪問データを送信
  - [x] listVisits: パラメータ付きでリクエスト
  - [x] listVisits: デフォルトパラメータで動作

**受け入れ基準**
- [x] `npm run test` で全テスト成功（23/23）
- [x] `npm run typecheck` でエラーなし
- [x] ログイン後、localStorage にアクセストークン・リフレッシュトークンが保存される
- [x] ページリロード後、clientLoader で自動的にトークンから user が復元される
- [x] トークンなしで保護ページ → /login へリダイレクト
- [x] ログアウト時にバックエンド API を呼び出してトークンを無効化

---

### Issue: ランディングページ実装（React） — / (未認証)
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/24
**優先度**: 🟡 Medium | **工数**: 1.5h | **担当**: 個人 | **テスト駆動**: スナップショットテスト

**タスク概要**
未認証ユーザー向けのランディングページを実装。Roambleの価値提案を簡潔に表示し、サインアップ・ログインへの導線を確保。

**実装内容**

**画面デザイン要件**
- ヒーロー画像 / ロゴ
- タイトル・サブタイトル（価値提案）
- CTA ボタン: 「さっそく始める」（/signup）、「ログイン」（/login）

**コンポーネント構成**
- [ ] `app/routes/index.tsx` 作成
  - ランディングページのメイン実装
  - クライアントのみ（loaderなし）
  - 認証ユーザーの場合は `/home` へリダイレクト（条件分岐を検討）

**TDD プロセス**
- [ ] `app/__tests__/routes/index.test.tsx` を作成
- 🔴 未認証ユーザーがランディングページの全要素を見る
- 🟢 コンポーネント実装完成
- 🔵 レスポンシブ確認

**受け入れ基準**
- [ ] http://localhost:5173 にアクセス → ランディングページが表示される
- [ ] 「さっそく始める」をクリック → `/signup` へ遷移
- [ ] 「ログイン」をクリック → `/login` へ遷移
- [ ] 認証済みユーザーがアクセス → `/home` へリダイレクト

---

### Issue: サインアップ画面実装（React） — /signup
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/25
**優先度**: 🔴 High | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ユーザー登録画面を実装。メール・パスワード・表示名の入力フォームを設置。バックエンド auth.go の SignUp API と連携。

**実装内容**

**画面デザイン要件**（`docs/screen-design` 参照 — 認証レイアウトを踏襲）
- フォーム要素
  - メールアドレス入力
  - パスワード入力（強度表示）
  - 表示名入力
  - 利用規約への同意チェックボックス
- ボタン
  - 「サインアップ」ボタン（押下時にローディング表示）
  - 「ログインはこちら」リンク（/login）

**コンポーネント構成**
- [ ] `app/routes/signup.tsx` 作成
  - フォーム構築（React Form Hook / useReducer）
  - バリデーション実装
    - メール形式チェック（簡易）
    - パスワード（8文字以上）
    - 表示名（1文字以上）
  - API 呼び出し
    - `app/api/auth.ts` の SignUp 関数を使用
    - エラーハンドリング（メール重複、ネットワークエラー）
  - 成功時は JWT を取得して localStorage 保存 → `/home` へリダイレクト

**TDD プロセス**
- [ ] `app/__tests__/routes/signup.test.tsx` を作成
- 🔴
  ```typescript
  test("フォーム送信 → SignUp API call → /home へ遷移", () => {});
  test("メール重複 → エラーメッセージ表示", () => {});
  test("バリデーションエラー → 送信ボタン無効", () => {});
  ```
- 🟢 実装完成
- 🔵 エラーハンドリング改善

**受け入れ基準**
- [ ] フォーム入力 → 「サインアップ」ボタン → バックエンド SignUp API が実行される
- [ ] バックエンダから JWT 返却 → トークン保存 → `/home` へリダイレクト
- [ ] メール重複時 → 409 エラーメッセージ表示
- [ ] バリデーションエラー → UI で示唆

---

### Issue: ログイン画面実装（React） — /login
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/26
**優先度**: 🔴 High | **工数**: 1.5h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ログイン画面を実装。メール・パスワード入力でバックエンド Login API と連携。

**実装内容**

**画面デザイン要件**（認証レイアウトを踏襲）
- フォーム要素
  - メールアドレス入力
  - パスワード入力
  - 「パスワードを忘れた」リンク（Phase 1 で実装）
- ボタン
  - 「ログイン」ボタン
  - 「新規登録」リンク（/signup）

**コンポーネント構成**
- [ ] `app/routes/login.tsx` 作成
  - フォーム構築
  - バリデーション（メール + パスワード必須）
  - API 呼び出し
    - `app/api/auth.ts` の Login 関数を使用
    - エラーハンドリング（ユーザー不存在、パスワード不一致）
  - 成功時は JWT 保存 → `/home` へリダイレクト

**TDD プロセス**
- [ ] `app/__tests__/routes/login.test.tsx` を作成
- 🔴
  ```typescript
  test("正しい認証情報 → JWT 取得 → /home へ遷移", () => {});
  test("ユーザー不存在 → 401 エラーメッセージ", () => {});
  test("パスワードエラー → 401 エラーメッセージ", () => {});
  ```
- 🟢 実装完成
- 🔵 UX 改善

**受け入れ基準**
- [ ] メール + パスワード入力 → ログイン成功 → JWT 保存 → `/home` へリダイレクト
- [ ] 認証失敗 → エラーメッセージ表示
- [ ] テスト成功

---

### Issue: メイン発見画面実装（React） — /home（提案表示）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/27
**優先度**: 🔴 High | **工数**: 4h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
Roamble のコア画面。Google Places API の提案施設をカード表示し、スワイプまたはボタンで「行った」「スキップ」のアクションを取得。
**デザイン**: `docs/screen-design/メイン発見画面/code.html` に忠実に実装

**実装内容**

**画面デザイン要件**
- TopAppBar
  - 現在地表示（GPS取得）
  - ロゴ「Roamble」
  - ユーザーアイコン → /profile へリンク
- 提案カード（メイン）
  - 施設画像（背景）
  - グラデーション オーバーレイ
  - 施設情報オーバーレイ
    - ラベル: 「NEW SPOT」 + ジャンル
    - 施設名（大きく表示）
    - ジャンル / 距離 / 評価
- アクションボタン
  - ✕ ボタン（スキップ）左側
  - ❤ / チェック ボタン（行った）右側
- スワイプ / ドラッグ対応（left = skip, right = go）
- ボトムナビゲーション
  - 発見（現在ページ）/ 履歴 / マイページ

**コンポーネント構成**

**A. `app/routes/home.tsx`（ページ本体）**
- [ ] Geolocation API で現在地取得
- [ ] loader で User 情報 + 初期提案データ取得
- [ ] 提案データ状態管理
- [ ] スワイプ/クリック時のアクション処理

**B. `app/components/suggestion-card.tsx`（カード表示）**
```typescript
interface SuggestionCardProps {
  place: {
    placeId: string;
    name: string;
    category: string;
    imageUrl: string;
    distance: number; // km
    rating: number;
  };
  onAccept: () => void; // 「行った」処理
  onSkip: () => void;   // スキップ処理
}
```

**C. `app/components/bottom-nav.tsx`（ボトムナビゲーション）**
- [ ] 3つのタブ: 発見 / 履歴 / マイページ
- [ ] React Router Link で遷移
- [ ] アクティブタブをハイライト

**API連携**
- [ ] `app/api/suggestions.ts` を実装
  ```typescript
  export async function getSuggestion(token: string, lat: number, lng: number) {
    return apiCall('/api/suggestions', token, {
      method: 'POST',
      body: JSON.stringify({ lat, lng })
    });
  }
  ```
- [ ] 「行った」時 → `createVisit()` API 呼び出し
- [ ] 次のカード自動取得（useEffect）

**ジェスチャー対応**
- [ ] Pointer イベントまたは react-gesture ライブラリで実装
  - 左スワイプ / 右クリック → スキップ
  - 右スワイプ / 左クリック → 「行った」
- [ ] フォールバック: ボタンクリック対応

**エラーハンドリング**
- [ ] GPS 取得失敗 → 東京都渋谷区をデフォルト（開発用）
- [ ] 提案データ取得失敗 → リトライボタン表示
- [ ] ネットワークエラー → トースト通知

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `app/__tests__/routes/home.test.tsx` 作成
  ```typescript
  test("ページ読み込み → 提案カード表示", () => {});
  test("「行った」クリック → createVisit() 実行", () => {});
  test("スキップ → 次のカード表示", () => {});
  test("スワイプジェスチャー → アクション実行", () => {});
  ```

**🟢 GREEN PHASE**
- [ ] 上記実装完成

**🔵 REFACTOR PHASE**
- [ ] アニメーション追加（カード切り替え時）
- [ ] ジェスチャー精度向上

**受け入れ基準**
- [ ] `npm run dev` でページ表示 → 提案カード が表示される
- [ ] 「行った」ボタン → API 実行 → 次のカード表示
- [ ] スキップ → 次のカード表示
- [ ] GPS 取得成功 → 現在地表示
- [ ] ボトムナビゲーション → 各ページへ遷移可能
- [ ] design に忠実なスタイル（Tailwind）

---

### Issue: 訪問履歴画面実装（React） — /history
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/28
**優先度**: 🟡 Medium | **工数**: 2.5h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
これまでの訪問記録を一覧表示。日付でグループ化し、ジャンル別フィルター機能を実装。
**デザイン**: `docs/screen-design/履歴画面/code.html` に忠実に実装

**実装内容**

**画面デザイン要件**
- ヘッダー
  - 戻るボタン
  - タイトル「これまでの旅路」
  - 検索ボタン
- フィルタータブ（横スクロール）
  - 「すべて」（デフォルト）
  - カテゴリ別: カフェ / 公園 / 観光 など
- 訪問履歴リスト
  - 日付でグループ化（「2024年2月」など）
  - 各アイテム:
    - 施設画像（サムネイル）
    - 施設名
    - 位置情報
    - 訪問日時
    - XP（Phase 1）表示

**コンポーネント構成**

**A. `app/routes/history.tsx`（ページ本体）**
- [ ] loader で訪問履歴取得（ページネーション対応）
- [ ] フィルター状態管理（選択カテゴリ）
- [ ] 日付グループ化ロジック
- [ ] 無限スクロール / ページネーション実装

**B. `app/components/visit-history-item.tsx`（履歴アイテム）**
```typescript
interface VisitHistoryItemProps {
  visit: {
    placeId: string;
    placeName: string;
    category: string;
    imageUrl: string;
    address: string;
    visitedAt: Date;
    xp?: number;
  };
}
```

**API連携**
- [ ] `app/api/visits.ts` に listVisits() 実装
  ```typescript
  export async function listVisits(
    token: string,
    limit: number = 20,
    offset: number = 0,
    category?: string // フィルター
  ) {
    const query = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (category) query.append('category', category);
    return apiCall(`/api/visits?${query}`, token);
  }
  ```

**フィルター・検索**
- [ ] カテゴリフィルター → API に category パラメータ送信
- [ ] 検索ボタン → 検索入力モーダル（Phase 1）

**日付グループ化**
- [ ] ローカルで訪問データをグループ化
  ```typescript
  const groupedByDate = groupBy(visits, (v) => format(v.visitedAt, 'yyyy年M月'));
  ```

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `app/__tests__/routes/history.test.tsx` 作成
  ```typescript
  test("ページ読み込み → 訪問履歴リスト表示", () => {});
  test("カテゴリフィルター → リスト更新", () => {});
  test("日付でグループ化", () => {});
  test("無限スクロール → 追加読み込み", () => {});
  ```

**🟢 GREEN PHASE**
- [ ] 上記実装完成

**🔵 REFACTOR PHASE**
- [ ] アニメーション追加
- [ ] パフォーマンス最適化（仮想スクロール検討）

**受け入れ基準**
- [ ] ページ読み込み → 訪問履歴が表示される
- [ ] フィルター選択 → リスト動的更新
- [ ] 日付でグループ化表示
- [ ] design に忠実なスタイル
- [ ] スクロール可能

---

### Issue: ユーザープロフィール画面実装（React） — /profile（簡易版 Phase 0）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/29
**優先度**: 🟡 Medium | **工数**: 2h | **担当**: 個人 | **テスト駆動**: TDD

**タスク概要**
ユーザー情報を表示するマイページ。Phase 0では「訪問数」「総移動距離」等の統計情報を簡易表示。
XP / レベルは Phase 1 で拡張予定。
**デザイン**: `docs/screen-design/ユーザープロフィール/code.html` 参照

**実装内容**

**画面デザイン要件**（Phase 0 簡易版）
- ヘッダー
  - ユーザーアイコン
  - 表示名
  - ハンドル名（username）
- ユーザー統計（簡易）
  - 訪問スポット数
  - 訪問開始日
  - ボタン: ログアウト

**コンポーネント構成**

**A. `app/routes/profile.tsx`（ページ本体）**
- [ ] loader で User 情報 + 訪問統計情報取得
- [ ] ユーザー情報表示
- [ ] ログアウト機能実装

**API連携**
- [ ] `app/api/users.ts` を新規作成
  ```typescript
  export async function getUserStats(token: string) {
    return apiCall('/api/users/stats', token); // バックエンドから実装予定
  }
  ```

**ログアウト処理**
- [ ] clearToken() 実行
- [ ] localStorage クリア
- [ ] `/login` へリダイレクト

**TDD プロセス**

**🔴 RED PHASE**
- [ ] `app/__tests__/routes/profile.test.tsx` 作成
  ```typescript
  test("ユーザー情報表示", () => {});
  test("ログアウトボタン → 認証情報削除 → /login へ遷移", () => {});
  ```

**🟢 GREEN PHASE**
- [ ] 上記実装完成

**🔵 REFACTOR PHASE**
- [ ] スタイル調整

**受け入れ基準**
- [ ] loader で User 情報取得後、画面に表示される
- [ ] ログアウトボタン → localStorage クリア → `/login` へリダイレクト
- [ ] JWT なしでアクセス → `/login` へリダイレクト

---

### Issue: 共通レイアウト・コンポーネント実装
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/31
**優先度**: 🟡 Medium | **工数**: 1.5h | **担当**: 個人

**タスク概要**
フロントエンド全体で使用する共通レイアウト・コンポーネントを実装。

**実装内容**

**A. `app/layouts/app-layout.tsx`（アプリ画面用レイアウト）**
- [ ] ボトムナビゲーション統合
- [ ] ヘッダー / フッター スロット
- [ ] Outlet で各ページを読み込み

**B. `app/layouts/auth-layout.tsx`（認証画面用レイアウト）**
- [ ] 中央配置フォーム
- [ ] ロゴ / タイトル配置
- [ ] Outlet で各ページを読み込み

**C. `app/components/bottom-nav.tsx`（既記載）**
- [ ] 3タブ実装
- [ ] アクティブ状態表示

**D. `app/types/` 作成**
- [ ] `auth.ts` - 認証関連の型定義
- [ ] `suggestion.ts` - 施設提案の型定義
- [ ] `visit.ts` - 訪問履歴の型定義

**E. `app/utils/` 作成**
- [ ] `constants.ts` - API URL等の定数
- [ ] `helpers.ts` - フォーマット・ユーティリティ関数

**受け入れ基準**
- [ ] 各レイアウトが正常に機能
- [ ] 型定義が全ページで利用可能

---

### Issue: Tailwind CSS カラーパレット・レスポンシブ設定
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/32
**優先度**: 🟡 Medium | **工数**: 1h | **担当**: 個人

**タスク概要**
Tailwind CSS を screen-design のデザインに合わせて設定。カラーパレット・タイポグラフィ・ブレークポイントを定義。

**実装内容**

**tailwind.config.js 設定**
- [ ] **Primary Color**: #13ecec （シアン）- メイン発見画面の primary
- [ ] **Primary Color**: #8c25f4 （紫）- 履歴画面の primary（統一検討）
- [ ] **Background**: Light #f6f8f8 / Dark #102222
- [ ] フォントファミリー
  - メイン発見画面: Plus Jakarta Sans
  - 履歴画面: Space Grotesk
  - フォールバック: Noto Sans JP
- [ ] Border Radius: デフォルト 1rem, lg 2rem
- [ ] Breakpoints: md / lg / xl

**CSS 設定**
- [ ] `src/index.css` に @tailwind ディレクティブ
- [ ] グローバルスタイル定義（フォント・背景色）
- [ ] ダークモード対応（class 切り替え）

**受け入れ基準**
- [ ] `npm run build` でエラーなし
- [ ] screen-design のカラースキームが正確に適用されている
- [ ] レスポンシブ表示確認（モバイル / タブレット / デスクトップ）

---

### Issue: API エラーハンドリング・バリデーション統一
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/33
**優先度**: 🟡 Medium | **工数**: 1.5h | **担当**: 個人

**タスク概要**
バックエンド API のエラー応答に対応する統一的なエラーハンドリング・ユーザー通知を実装。

**実装内容**

**A. `app/api/client.ts` 拡張**
- [ ] HTTP Status Code 別の処理
  - 401 Unauthorized → `/login` へリダイレクト
  - 409 Conflict → ユーザーへのエラーメッセージ（メール重複など）
  - 500 Server Error → リトライ提案

**B. `app/utils/error.ts` 作成**
- [ ] エラー型定義
  ```typescript
  interface ApiError {
    status: number;
    message: string;
    code?: string;
  }
  ```
- [ ] エラー変換関数

**C. `app/components/toast.tsx` 実装（軽量版）**
- [ ] エラー / 成功メッセージ表示
- [ ] 自動クローズ（3秒）

**D. 各ページでのエラー処理**
- [ ] signup / login / home / history / profile で try-catch 実装
- [ ] エラー時 UI フィードバック

**受け入れ基準**
- [ ] API エラー時、ユーザーにわかりやすいメッセージが表示される
- [ ] 認証エラー → `/login` へ自動リダイレクト
- [ ] ネットワークエラー → リトライオプション表示

---

### Issue: フロントエンド E2E テスト（Playwright）
**GitHub Issue**: https://github.com/Hiru-ge/Roamble/issues/30
**優先度**: 🟢 Low | **工数**: 2h | **担当**: 個人 | **Phase 0 完了後の検証用**

**タスク概要**
signup → login → home → history の主要フローを E2E テストで検証。

**実装内容**

**A. Playwright 環境セットアップ**
- [ ] `npm install @playwright/test`
- [ ] `playwright.config.ts` 作成

**B. `e2e/main-flow.spec.ts` 作成**
- [ ] ランディング → signup → ログイン → home → history → ログアウト
- [ ] 主要ユーザーフロー

**受け入れ基準**
- [ ] `npm run test:e2e` でテスト実行可能
- [ ] すべてのテスト 成功

---

## フロントエンド実装チェックリスト（Phase 0 完了時）

| タスク | 状態 |
|--------|------|
| React Router v7 セットアップ | ✅ 実装予定 |
| ルーティング設定 | ✅ 実装予定 |
| 認証状態管理・clientLoader | ✅ 完了 |
| ランディングページ | ⬜ TODO |
| サインアップ画面 | ⬜ TODO |
| ログイン画面 | ⬜ TODO |
| メイン発見画面 | ⬜ TODO |
| 履歴画面 | ⬜ TODO |
| マイページ | ⬜ TODO |
| 共通コンポーネント・レイアウト | ⬜ TODO |
| Tailwind 設定 | ⬜ TODO |
| エラーハンドリング | ⬜ TODO |
| E2E テスト | ⬜ TODO |
