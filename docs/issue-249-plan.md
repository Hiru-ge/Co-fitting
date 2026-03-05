# Issue #249: ローディングパフォーマンス改善 — 計画書

> 作成日: 2026-03-05
> ステータス: 計画確定待ち

---

## 1. 定量計測結果

### 1-1. フロントエンド（Cloudflare Pages）

| リソース | サイズ | TTFB | Total | 備考 |
|---------|--------|------|-------|------|
| HTML (index.html) | 2.2KB | 100ms | 102ms | 良好（CDNエッジ配信） |
| entry.client JS | 187KB | 79ms | 152ms | 良好 |
| chunk (largest) | 123KB | 381ms | 492ms | やや遅い（初回ロード時） |
| CSS | 181KB | 88ms | 218ms | 良好 |
| Material Symbols woff2 (400) | 314KB | 84ms | 255ms | 良好 |

**Cloudflare Pages の配信自体は高速**。Brotli 圧縮有効済み。

### 1-2. バックエンド（Render Free — Singapore リージョン）

| 状態 | /health TTFB | 備考 |
|------|-------------|------|
| ウォーム（連続リクエスト） | **300〜550ms** | 毎回この遅延が発生 |
| コールドスタート（15分放置後） | **1,000〜1,100ms** | UptimeRobot(5分間隔)で緩和済み |

**ウォーム時でも 300〜550ms の固定遅延** — Render Free (Singapore) の制約。

### 1-3. ビルド出力サイズ

| カテゴリ | サイズ | 備考 |
|---------|--------|------|
| **ビルド総計** | **11MB** | |
| フォント合計 | 9.7MB (88%) | 268ファイル |
| 　- Noto Sans JP | 6.7MB | 248ファイル（unicode-range分割） |
| 　- Material Symbols | 2.9MB | 8ファイル（4ウェイト × woff/woff2） |
| 　- Plus Jakarta Sans | 68KB | 問題なし |
| 　- Space Grotesk | 84KB | 問題なし |
| JS 合計 | 520KB (gzip ~100KB) | 適正 |
| CSS 合計 | 181KB (gzip ~49KB) | 適正 |
| **PWA precache** | **10MB / 310エントリ** | **過剰** |

### 1-4. キャッシュヘッダー

| リソース | Cache-Control | 問題 |
|---------|---------------|------|
| HTML | `max-age=0, must-revalidate` | 正常（HTMLは毎回検証すべき） |
| **JS/CSS/Font (ハッシュ付き)** | **`max-age=0, must-revalidate`** | **問題: immutable であるべき** |

ハッシュ付きアセット（`entry.client-vOnM5Srm.js` 等）は内容が変わればファイル名も変わるため、
`max-age=31536000, immutable` でブラウザキャッシュを最大限活用すべき。
現状は**毎回 ETag 検証リクエストが発生** → リピーターでも不要な遅延。

---

## 2. 問題の分類と原因

### A. コード側の問題（根本修正可能）

| # | 問題 | 影響 | 修正方法 |
|---|------|------|---------|
| A-1 | PWA Service Worker が全アセット（10MB/310件）をプリキャッシュ | 初回訪問時にバックグラウンドで10MB DL → メインスレッドの帯域と競合 | `globPatterns` からフォントを除外、ランタイムキャッシュ（CacheFirst）に変更 |
| A-2 | Material Symbols が全4ウェイト（100-400）バンドル | 2.9MB のうち 2.2MB が不要 | weight 400 のみインポートに変更 |
| A-3 | `_headers` ファイル未設定 | ハッシュ付きアセットに immutable キャッシュが効かない | Cloudflare Pages 用 `_headers` ファイル追加 |

### B. デプロイ環境の問題 → Cloud Run (Tokyo) 移行で根本解決

| # | 問題 | 影響 | 解決策 |
|---|------|------|--------|
| B-1 | Render Free (Singapore) のベースライン遅延 300-550ms | 全API呼び出しに 300-550ms の固定遅延 | **Cloud Run (asia-northeast1) に移行** → 50-100ms に改善 |
| B-2 | Render Free のコールドスタート ~1.1s | 15分放置後の初回リクエストが遅い | Cloud Run の Go バイナリは起動が速い（200-500ms）。min-instances=0 でも十分 |

Render 有料プラン（$7/月）は Singapore リージョンのままであり、レイテンシの根本改善にならない。
**Cloud Run (Tokyo) なら GCP 無料枠内（ベータ版規模）で $0 運用が可能**であり、レイテンシを 1/5 以下に削減できる。

---

## 3. 現在のローディングUI の状態

### 3-1. clientLoader 完了待ち（ページ遷移時）

React Router の SPA モードでは、`clientLoader` の実行中は**前のページがそのまま表示され続ける**（`HydrateFallback` 未定義のため）。
つまり、BottomNav タップ後に 300-550ms のバックエンド遅延分だけ**何も反応がない**状態になる。
ユーザーには「タップしたのに動かない」と感じられ、UX 上の問題がある。

対象ルートと clientLoader 内の API 呼び出し:

| ルート | clientLoader 内の処理 | API 呼び出し回数 | 推定待機時間 |
|-------|----------------------|----------------|------------|
| `/home` | `protectedLoader()` + `getInterests()` | 2 (直列) | 600-1100ms |
| `/history` | `protectedLoader()` | 1 | 300-550ms |
| `/profile` | `protectedLoader()` | 1 | 300-550ms |
| `/settings` | `protectedLoader()` + `getGenreTags()` + `getInterests()` | 3 (1+2並列) | 600-1100ms |
| `/onboarding` | `getGenreTags()` + `getInterests()` (並列) | 2 (並列) | 300-550ms |

### 3-2. コンポーネント内ローディング（clientLoader 完了後）

各ルートは clientLoader 完了後、コンポーネント内で追加の API を呼ぶ。
この間のローディングUI は**適切に実装済み**:

| ルート | コンポーネント内ローディング | UI |
|-------|--------------------------|-----|
| `/home` | `useSuggestions()` → 提案生成 + 位置情報取得 | カード型スケルトン（`animate-pulse`） |
| `/history` | `loadVisits()` → 訪問履歴取得 | リスト型スケルトン 3件（`animate-pulse`） |
| `/profile` | `loadData()` → stats/badges/proficiency 並列取得 | 各セクションに個別スケルトン |
| `/history/:id` | `loadVisitDetail()` | `SkeletonLoader` コンポーネント |

**結論**: コンポーネント内のローディングUIは既に十分。
問題は **clientLoader 実行中の「無反応時間」** のみ。

---

## 4. スコープ判断

### やること（4タスク）

| # | タスク | カテゴリ | 期待効果 | 工数 |
|---|--------|---------|---------|------|
| 1 | `_headers` ファイル追加 | A-3 | リピーターのアセット再検証遅延を解消 | 小 |
| 2 | PWA precache からフォントを除外 | A-1 | precache: 10MB→~1MB、初回訪問の帯域競合解消 | 小 |
| 3 | Material Symbols を weight 400 のみに | A-2 | フォント: 2.9MB→~700KB | 小 |
| 4 | バックエンドを Cloud Run (Tokyo) に移行 | B-1, B-2 | API レイテンシ 300-550ms → 50-100ms（根本解決） | 中 |

### やらないこと

| 項目 | 理由 |
|------|------|
| Render 有料プラン（$7/月） | Singapore リージョンのままなのでレイテンシは根本改善しない |
| BottomNav のローディングインジケータ | Cloud Run 移行によりレイテンシが 50-100ms になるため、体感上の無反応は解消される |
| バンドル分析・コード分割の追加最適化 | JS 520KB (gzip ~100KB) は適正範囲 |
| Noto Sans JP の最適化 | unicode-range 分割済み。ブラウザが必要分のみDLする設計で問題なし |
| 全画面共通のスプラッシュスクリーン | clientLoader 後のスケルトンUIが既に実装済みのため不要 |

---

## 5. 実装詳細

### タスク 1: `_headers` ファイル追加

`frontend/public/_headers` を作成:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

Cloudflare Pages は `public/_headers` を自動認識し、マッチするパスに指定ヘッダーを付与する。
ハッシュ付きアセット（JS/CSS/Font）がブラウザにキャッシュされ、2回目以降の訪問でネットワークリクエスト不要に。

### タスク 2: PWA precache からフォントを除外

`vite.config.ts` の `workbox.globPatterns` を変更:

```diff
- globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
+ globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
```

フォント（woff/woff2）は `_headers` による immutable キャッシュで十分。
SW のプリキャッシュは JS/CSS/HTML のみに絞る。

オプション: フォントをランタイムキャッシュで SW からも配信したい場合は `runtimeCaching` を追加:
```ts
runtimeCaching: [{
  urlPattern: /\.(?:woff2?|ttf|otf)$/,
  handler: 'CacheFirst',
  options: {
    cacheName: 'fonts',
    expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
  },
}],
```

### タスク 3: Material Symbols を weight 400 のみに

`root.tsx` のインポートを変更:

```diff
- import "@fontsource/material-symbols-outlined";
+ import "@fontsource/material-symbols-outlined/400.css";
```

`@fontsource` パッケージはウェイト単位のインポートをサポートしている。
これにより weight 100/200/300 の woff/woff2（計6ファイル、約 2.2MB）がバンドルから除外される。

### タスク 4: バックエンドを Cloud Run (Tokyo) に移行

Render Free (Singapore) → GCP Cloud Run (asia-northeast1) にバックエンドを移行し、
API レイテンシを根本的に改善する（300-550ms → 50-100ms）。

#### 移行先の構成

| 項目 | 詳細 |
|------|------|
| サービス | Cloud Run |
| リージョン | `asia-northeast1`（東京） |
| ソースイメージ | `backend/Dockerfile.prod`（既存のマルチステージビルド） |
| 無料枠 | 月200万リクエスト、36万vCPU秒、18万GiB秒 |
| ベータ版の推定使用量 | テスター10-30人 × 1日10-30リクエスト × 30日 = 9,000-27,000リクエスト/月 |
| **想定コスト** | **$0（無料枠内）** |

#### 既存サービスとの関係（バックエンドのみ移行）

| サービス | 移行前 | 移行後 |
|---------|--------|--------|
| DB (TiDB Cloud) | そのまま | そのまま |
| Redis (Upstash) | そのまま | そのまま |
| Frontend (Cloudflare Pages) | そのまま | そのまま |
| **Backend** | **Render Free (Singapore)** | **Cloud Run (Tokyo)** |

#### 移行手順

**前提: gcloud CLI のインストール＆認証**

```bash
# 未インストールの場合
brew install --cask google-cloud-sdk

# 認証
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

**1. GCP プロジェクト作成、Cloud Run API・Artifact Registry API 有効化**

GCP コンソール上で実施。

**2. Artifact Registry にリポジトリ作成、イメージをビルド＆プッシュしてデプロイ**

```bash
# Artifact Registry にリポジトリ作成（初回のみ）
gcloud artifacts repositories create roamble \
  --repository-format=docker \
  --location=asia-northeast1

# Docker 認証設定
gcloud auth configure-docker asia-northeast1-docker.pkg.dev

# イメージビルド＆プッシュ
cd /path/to/Roamble
docker build -t asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/roamble/backend:latest \
  -f backend/Dockerfile.prod backend/
docker push asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/roamble/backend:latest

# Cloud Run にデプロイ（Render の環境変数をすべて --set-env-vars に設定）
gcloud run deploy roamble-backend \
  --image asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/roamble/backend:latest \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "GIN_MODE=release,DB_HOST=...,REDIS_URL=...,JWT_SECRET=..."
```

**3. Cloud Run のサービス URL を取得・疎通確認**

デプロイ完了時にターミナルに `Service URL` が表示される。以下で疎通＆レイテンシを確認：

```bash
curl -w "\nTTFB: %{time_starttransfer}s\n" -o /dev/null -s https://roamble-backend-579127299450.asia-northeast1.run.app/health
```

[結果] TTFB: 0.226823s(226ms)
[参考(Render)] TTFB: 0.363363s(363ms)

**4. Cloudflare Pages の環境変数 `VITE_API_BASE_URL` を Cloud Run の URL に変更**

**5. フロントエンド再デプロイ**

**6. 動作確認（OAuth、提案生成、訪問記録、XP付与、バッジ）**

**7. Render のサービスを停止**

#### Render 有料プラン ($7/月) との比較

| | Render Starter ($7/月) | Cloud Run ($0) |
|---|---|---|
| リージョン | Singapore | **Tokyo** |
| レイテンシ | 200-400ms | **50-100ms** |
| コールドスタート | なし | 200-500ms（Go は高速） |
| コスト | $7/月 | **$0** |

$7/月払っても Singapore からの物理的距離は変わらないため、**Cloud Run 一択**。

---

## 6. 期待される改善効果

### Before → After

| 指標 | Before | After | 改善幅 |
|------|--------|-------|--------|
| PWA precache サイズ | 10MB / 310件 | ~1MB / ~30件 | **-90%** |
| Material Symbols フォント | 2.9MB (8ファイル) | ~700KB (2ファイル) | **-76%** |
| リピーターのアセット再検証 | 毎回 ETag 検証 | キャッシュヒット（0ms） | **ネットワーク不要** |
| API レイテンシ（ウォーム） | 300-550ms | **50-100ms** | **-80%以上** |
| API レイテンシ（コールドスタート） | 1,000-1,100ms | 200-500ms | **-50%以上** |
| ページ遷移の無反応時間 | 300-1100ms | 50-200ms（体感即時） | **根本解消** |

### 完了条件（Issue #249 記載）との対応

- [x] 各画面の初期表示速度確認 → 計測済み（上記データ）
- [x] 必要に応じてローディング表示の調整 → Cloud Run 移行でレイテンシ根本改善のため不要に
- [x] 画像最適化（既存の lazy loading 確認） → place photo は遅延取得済みで問題なし
- [x] API キャッシュ設定の見直し → `_headers` + PWA precache 最適化

---

## 7. 検証計画

1. タスク 1-3 実施後にリビルドし、ビルド出力サイズを再計測
2. フロントエンドテスト実行（`npx vitest run`）
3. 本番デプロイ後に Lighthouse で Core Web Vitals を計測（LCP, FID, CLS）
4. Cloud Run デプロイ後に `/health` エンドポイントの TTFB を計測し、50-100ms に改善されたことを確認
5. 全機能の動作確認（OAuth、提案生成、訪問記録、XP付与、バッジ）
