# 分析運用の簡略化方針

更新日: 2026-04-17

## 目的

TiDBへの手動クエリ投入を毎回15本実行する運用から、
GA4中心 + 最小SQLパックに移行して、作業負荷を下げる。

## 方針

1. 行動ファネルはGA4を一次ソースにする
2. DBはGA4で取れない指標だけを補完する
3. DBクエリは3本に集約した最小パックを使う

最小パック: [docs/marketing/analysis/sql/minimal-kpi-pack.sql](docs/marketing/analysis/sql/minimal-kpi-pack.sql)

## GA4へ寄せる指標

以下はDBではなくGA4で計測する。

- LP導線
  - lp_cta_clicked
  - lp_section_viewed
  - ios_notify_submitted
- 初回価値到達
  - first_suggestion_viewed（追加推奨）
  - first_value_milestone（追加推奨）
- 継続トリガー
  - reminder_opened（追加推奨）
  - weekly_reactivation（追加推奨）
- 課金意向
  - premium_interest_clicked

## DBに残す最小指標

以下は現状DBが一次ソース。

- 休眠率（visit_history未訪問ユーザー）
- Push購読有無での利用差
- 通知設定カスタマイズ率
- リリース前後の訪問頻度差

## 置き換えマッピング（Q1-Q15）

- GA4へ置換可能
  - Q2, Q3, Q13, Q15
- DB最小パックへ統合
  - Q1, Q4, Q5, Q6, Q7, Q9, Q12, Q14
- 必要時のみ追加実行
  - Q8, Q10, Q11

運用上は、通常分析では Q8/Q10/Q11 は毎回回さない。
仮説検証が必要な週のみ追加実行する。

## 毎週の運用手順（最小）

1. GA4 MCPでファネルとLP導線を取得
2. Search Console MCPで検索流入差分を取得
3. TiDBで [docs/marketing/analysis/sql/minimal-kpi-pack.sql](docs/marketing/analysis/sql/minimal-kpi-pack.sql) を実行
4. レポートに転記

## 追加の自動化候補

1. SQLの定期実行
- Cloud Run Jobs または GitHub Actions で日次実行
- 結果をCSV/Markdownとして `docs/marketing/analysis/snapshots/` に保存

2. バックエンド集計API
- `/api/admin/analytics/snapshot` を追加し、上記SQL結果をJSONで返す
- 分析時はMCP + API呼び出しだけで完結

3. Looker Studio連携
- GA4 + TiDB集計結果（BigQuery経由でも可）を1画面表示

## 直近実施推奨

1. まず最小SQLパックに切替
2. GA4の追加イベントを段階導入
3. 次の分析からQ15一括実行を廃止
