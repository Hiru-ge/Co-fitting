# SEO改善まとめ（Issue #341）

更新日: 2026-04-15

## 1. 今回の実施内容

- `frontend/react-router.config.ts` に `/lp` の prerender を追加
- `frontend/public/sitemap.xml` と `frontend/public/robots.txt` を整備
- `frontend/app/routes/lp.tsx` の画像に `width` / `height` / `loading` / `decoding` を付与
- TikTok埋め込みの遅延読込を導入（Intersection Observer + idle callback）
- LP画像アセットを `webp` に統一
- LP本文コピーをラッコキーワードの検索意図に合わせて改稿
- LPで不要な初期JSを削減するため、PWA登録とOAuth Providerの責務を分離

## 2. キーワード選定と意図

キーワードは、ブランド名より先に検索される「悩み語」を優先した。検索時の心理に一致する語を見出しと本文へ自然に配置し、違和感のある詰め込みは避けた。

| キーワード | 想定ユーザー意図 | 反映方針 |
|---|---|---|
| 店が決められない | 候補が多く決めきれない | Feature見出しで課題を明示 |
| 入るのに勇気がいる | 初見店舗の心理的ハードルを下げたい | Pain PointsとFeature見出しで共感訴求 |
| 初めて入る店 緊張 | 自分の不安を言語化した情報を探している | 課題箇条書きに直接反映 |
| お店開拓 / カフェ開拓 | 新しい店へ行く行動を習慣化したい | Hero本文と価値説明に反映 |
| いつもの店に落ち着く | マンネリ状態を抜けたい | 問題提起セクションに反映 |

## 3. メタ情報運用ルール

- title / description / OGP は `docs/marketing/marketing-strategy.md` の正規文言を維持
- 非ブランド語は本文・見出し中心に反映し、ブランド一貫性と検索獲得を両立

## 4. 計測結果の要点

- ローカル本番相当計測では LCP・転送量を中心に改善
- 一方で本番URLは計測値にばらつきがあり、配信差分またはキャッシュ影響が疑われる
- 次回は本番再反映後、同条件で複数回測定して中央値で評価する

## 5. 次アクション

1. 本番反映後の Lighthouse 再計測（mobile、3〜5回）
2. Search Console で非ブランドクエリの表示回数・クリックを4週間単位で追跡
3. beta-gate 維持/再開放の意思決定を実施し、最終方針を記録
