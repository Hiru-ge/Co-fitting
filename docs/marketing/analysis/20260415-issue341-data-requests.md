# Issue #341 現状把握フェーズ データ取得依頼（本番DB + MCP）

作成日: 2026-04-15
対象TODO:
- Lighthouse・Search Consoleで現状スコア/検索状況の基準値を記録
- /funnel-analysis で継続率・実質アクティブユーザー・検索流入影響・UI摩擦を分析

このドキュメントは、あなたに実行してもらう本番DB向けSQLをまとめたものです。
実行結果を返してもらえれば、私がMCPのGA4/Search Consoleデータと統合して分析レポートを完成させます。

---

## 1. 先に確定した分析対象

- GA4 Property: `properties/526309325`（Roamble）
- Search Console site: `sc-domain:roamble.app`
- Lighthouse添付結果（mobile）基準値:
  - Performance: 0.50
  - LCP: 22.0s
  - CLS: 0.331
  - TBT: 0ms

---

## 2. SQL実行ルール

- すべて `SELECT` のみ。更新系SQLは無し
- タイムゾーンはJST前提
- MySQL/TiDB互換構文
- まず共通パラメータを実行してから、各クエリを順に実行

```sql
SET @today := CURDATE();
SET @analysis_start := DATE_SUB(@today, INTERVAL 30 DAY);
SET @analysis_prev_start := DATE_SUB(@today, INTERVAL 60 DAY);
SET @analysis_prev_end := DATE_SUB(@today, INTERVAL 31 DAY);
SET @release_date := '2026-03-17';
```

---

## 3. 本番DBで実行してほしいSQL一覧

### Q1. 全体規模と実質アクティブユーザー

```sql
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM users WHERE created_at >= @analysis_start) AS new_users_30d,
  (SELECT COUNT(DISTINCT user_id) FROM visit_history WHERE visited_at >= @analysis_start) AS active_users_visit_30d,
  (SELECT COUNT(DISTINCT user_id) FROM visit_history WHERE visited_at >= DATE_SUB(@today, INTERVAL 7 DAY)) AS active_users_visit_7d,
  (SELECT COUNT(DISTINCT user_id) FROM visit_history WHERE visited_at >= DATE_SUB(@today, INTERVAL 1 DAY)) AS active_users_visit_1d;
```

### A1. 実行結果
| total_users | new_users_30d | active_users_visit_30d | active_users_visit_7d | active_users_visit_1d |
|-------------|----------------|-----------------------|----------------------|---------------------|
| 26          | 1              | 7                     | 3                    | 2                   |

### Q2. 日次の新規登録推移（直近60日）

```sql
SELECT
  DATE(created_at) AS dt,
  COUNT(*) AS new_users
FROM users
WHERE created_at >= DATE_SUB(@today, INTERVAL 60 DAY)
GROUP BY DATE(created_at)
ORDER BY dt;
```

### A2. 実行結果

| dt         | new_users |
|------------|-----------|
| 2026-03-07 | 6         |
| 2026-03-08 | 6         |
| 2026-03-09 | 1         |
| 2026-03-10 | 7         |
| 2026-03-11 | 1         |
| 2026-03-14 | 4         |
| 2026-04-15 | 1         |

### Q3. 日次の訪問アクティブ推移（直近60日）

```sql
SELECT
  DATE(visited_at) AS dt,
  COUNT(*) AS visits,
  COUNT(DISTINCT user_id) AS dau_visit
FROM visit_history
WHERE visited_at >= DATE_SUB(@today, INTERVAL 60 DAY)
GROUP BY DATE(visited_at)
ORDER BY dt;
```

### A3. 実行結果

| dt         | visits | dau_visit |
|------------|--------|-----------|
| 2026-03-07 | 1      | 1         |
| 2026-03-08 | 7      | 3         |
| 2026-03-10 | 2      | 2         |
| 2026-03-11 | 1      | 1         |
| 2026-03-12 | 1      | 1         |
| 2026-03-14 | 1      | 1         |
| 2026-03-17 | 5      | 3         |
| 2026-03-18 | 4      | 2         |
| 2026-03-19 | 2      | 2         |
| 2026-03-22 | 1      | 1         |
| 2026-03-28 | 1      | 1         |
| 2026-04-02 | 3      | 2         |
| 2026-04-11 | 1      | 1         |
| 2026-04-15 | 4      | 2         |

### Q4. 休眠ユーザーの規模（登録済みだが訪問ゼロ）

```sql
SELECT
  COUNT(*) AS dormant_users,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users), 1) AS dormant_rate_pct
FROM users u
LEFT JOIN visit_history v ON v.user_id = u.id
WHERE v.id IS NULL;
```

### Q5. 直近30日での休眠復帰/離脱状態

```sql
SELECT
  SUM(CASE WHEN last_visit_at IS NULL THEN 1 ELSE 0 END) AS never_visited,
  SUM(CASE WHEN last_visit_at < DATE_SUB(@today, INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS churned_30d,
  SUM(CASE WHEN last_visit_at >= DATE_SUB(@today, INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS active_30d
FROM (
  SELECT
    u.id,
    MAX(v.visited_at) AS last_visit_at
  FROM users u
  LEFT JOIN visit_history v ON v.user_id = u.id
  GROUP BY u.id
) t;
```

### A5. 実行結果

| dormant_users | dormant_rate_pct |
|----------------|------------------|
| 14             | 53.8             |

### Q6. ユーザー別訪問回数分布（活動の偏り把握）

```sql
SELECT
  CASE
    WHEN visit_count = 0 THEN '0'
    WHEN visit_count = 1 THEN '1'
    WHEN visit_count BETWEEN 2 AND 3 THEN '2-3'
    WHEN visit_count BETWEEN 4 AND 9 THEN '4-9'
    ELSE '10+'
  END AS bucket,
  COUNT(*) AS users
FROM (
  SELECT
    u.id,
    COUNT(v.id) AS visit_count
  FROM users u
  LEFT JOIN visit_history v ON v.user_id = u.id
  GROUP BY u.id
) x
GROUP BY bucket
ORDER BY FIELD(bucket, '0', '1', '2-3', '4-9', '10+');
```

### A6. 実行結果

| bucket  | users |
|---------|-------|
| 0       | 14    |
| 1       | 6     |
| 2-3     | 3     |
| 4-9     | 2     |
| 10+     | 1     |

### Q7. Push購読有無での利用差

```sql
SELECT
  segment,
  COUNT(*) AS users,
  SUM(visit_count) AS total_visits,
  ROUND(AVG(visit_count), 2) AS avg_visits_per_user
FROM (
  SELECT
    u.id,
    CASE WHEN ps.user_id IS NULL THEN 'no_push' ELSE 'push_subscribed' END AS segment,
    COUNT(v.id) AS visit_count
  FROM users u
  LEFT JOIN (
    SELECT DISTINCT user_id FROM push_subscriptions
  ) ps ON ps.user_id = u.id
  LEFT JOIN visit_history v ON v.user_id = u.id
  GROUP BY u.id, segment
) s
GROUP BY segment
ORDER BY segment;
```

### A7. 実行結果

| segment         | users | total_visits | avg_visits_per_user |
|-----------------|-------|--------------|---------------------|
| no_push         | 24    | 20           | 0.83                |
| push_subscribed | 2     | 14           | 7.00                |

### Q8. Push購読前後の訪問変化（購読ユーザーのみ）

```sql
SELECT
  p.user_id,
  p.first_subscribed_at,
  SUM(CASE WHEN v.visited_at < p.first_subscribed_at THEN 1 ELSE 0 END) AS visits_before_sub,
  SUM(CASE WHEN v.visited_at >= p.first_subscribed_at THEN 1 ELSE 0 END) AS visits_after_sub
FROM (
  SELECT user_id, MIN(created_at) AS first_subscribed_at
  FROM push_subscriptions
  GROUP BY user_id
) p
LEFT JOIN visit_history v ON v.user_id = p.user_id
GROUP BY p.user_id, p.first_subscribed_at
ORDER BY p.first_subscribed_at;
```

### A8. 実行結果

| user_id | first_subscribed_at     | visits_before_sub | visits_after_sub |
|---------|------------------------|-------------------|------------------|
| 4064967 | 2026-03-17 10:52:24.704 | 2                 | 8                |
| 6255206 | 2026-03-18 03:48:27.083 | 0                 | 4                |

### Q9. 初回訪問までの日数（オンボーディング後の摩擦の代理指標）

```sql
SELECT
  COUNT(*) AS users_with_visit,
  ROUND(AVG(days_to_first_visit), 2) AS avg_days_to_first_visit,
  SUM(CASE WHEN days_to_first_visit = 0 THEN 1 ELSE 0 END) AS first_visit_same_day,
  SUM(CASE WHEN days_to_first_visit BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS first_visit_1_to_3d,
  SUM(CASE WHEN days_to_first_visit >= 4 THEN 1 ELSE 0 END) AS first_visit_4d_plus
FROM (
  SELECT
    u.id,
    DATEDIFF(MIN(v.visited_at), DATE(u.created_at)) AS days_to_first_visit
  FROM users u
  JOIN visit_history v ON v.user_id = u.id
  GROUP BY u.id
) t;
```

### A9. 実行結果

| users_with_visit | avg_days_to_first_visit | first_visit_same_day | first_visit_1_to_3d | first_visit_4d_plus |
|------------------|-------------------------|----------------------|---------------------|---------------------|
| 12               | 1.92                    | 7                    | 3                   | 2                   |

### Q10. ジャンル別の訪問実績（提案品質/摩擦の手がかり）

```sql
SELECT
  COALESCE(g.name, 'unknown') AS genre_name,
  COUNT(*) AS visits,
  COUNT(DISTINCT v.user_id) AS users,
  ROUND(AVG(v.xp_earned), 2) AS avg_xp
FROM visit_history v
LEFT JOIN genre_tags g ON g.id = v.genre_tag_id
WHERE v.visited_at >= DATE_SUB(@today, INTERVAL 60 DAY)
GROUP BY genre_name
ORDER BY visits DESC;
```

### A10. 実行結果

| genre_name             | visits | users | avg_xp  |
|------------------------|--------|-------|---------|
| プレミア               | 10     | 3     | 78.00  |
| レストラン             | 8      | 5     | 91.25  |
| カフェ                 | 5      | 4     | 82.00  |
| ラーメン・麺類         | 5      | 4     | 70.00  |
| 雑貨・セレクトショップ | 3    | 3     | 120.00 |
| 書店                   | 2    | 2     | 95.00  |
| スイーツ・ベーカリー   | 1    | 1     | 110.00 |

### Q11. 興味タグ一致/不一致の行動差（チャレンジ訪問率）

```sql
SELECT
  CASE
    WHEN ui.user_id IS NULL THEN 'outside_interest'
    ELSE 'inside_interest'
  END AS segment,
  COUNT(*) AS visits,
  COUNT(DISTINCT v.user_id) AS users,
  ROUND(AVG(v.xp_earned), 2) AS avg_xp,
  ROUND(SUM(CASE WHEN v.is_breakout = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS breakout_rate_pct
FROM visit_history v
LEFT JOIN user_interests ui
  ON ui.user_id = v.user_id
 AND ui.genre_tag_id = v.genre_tag_id
WHERE v.visited_at >= DATE_SUB(@today, INTERVAL 60 DAY)
GROUP BY segment
ORDER BY segment;
```

### A11. 実行結果

| segment         | visits | users | avg_xp  | breakout_rate_pct |
|-----------------|--------|-------|---------|-------------------|
| inside_interest | 12     | 7     | 68.33   | 0.0               |
| outside_interest| 22     | 9     | 95.91   | 59.1              |

### Q12. 通知設定の変更率（通知機能利用の深さ）

```sql
SELECT
  COUNT(*) AS users_with_notification_settings,
  SUM(CASE WHEN push_enabled = 0 OR email_enabled = 0 OR daily_suggestion = 0 OR weekly_summary = 0 OR monthly_summary = 0 OR streak_reminder = 0 THEN 1 ELSE 0 END) AS users_customized,
  ROUND(SUM(CASE WHEN push_enabled = 0 OR email_enabled = 0 OR daily_suggestion = 0 OR weekly_summary = 0 OR monthly_summary = 0 OR streak_reminder = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS customized_rate_pct
FROM notification_settings;
```

### A12. 実行結果

| users_with_notification_settings | users_customized | customized_rate_pct |
|---------------------------------|------------------|---------------------|
| 2                               | 1                | 50.0                |

### Q13. コホート継続率（登録週ごと）

```sql
WITH user_cohort AS (
  SELECT
    id AS user_id,
    YEARWEEK(created_at, 3) AS cohort_week
  FROM users
),
user_activity AS (
  SELECT
    user_id,
    YEARWEEK(visited_at, 3) AS activity_week
  FROM visit_history
  GROUP BY user_id, YEARWEEK(visited_at, 3)
)
SELECT
  uc.cohort_week,
  (ua.activity_week - uc.cohort_week) AS week_offset,
  COUNT(DISTINCT uc.user_id) AS active_users
FROM user_cohort uc
LEFT JOIN user_activity ua ON ua.user_id = uc.user_id
GROUP BY uc.cohort_week, week_offset
ORDER BY uc.cohort_week, week_offset;
```

### A13. 実行結果

| cohort_week | week_offset | active_users |
|-------------|-------------|--------------|
| 202610      |            | 4            |
| 202610      | 0           | 1            |
| 202610      | 1           | 2            |
| 202610      | 2           | 1            |
| 202610      | 6           | 1            |
| 202611      |            | 8            |
| 202611      | 0           | 3            |
| 202611      | 1           | 3            |
| 202611      | 2           | 1            |
| 202611      | 3           | 2            |
| 202611      | 4           | 1            |
| 202616      | 0           | 1            |

### Q14. 3/17 リリース前後比較（訪問頻度）

```sql
SELECT
  period,
  COUNT(*) AS visits,
  COUNT(DISTINCT user_id) AS active_users,
  ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT user_id), 2) AS visits_per_active_user
FROM (
  SELECT
    user_id,
    visited_at,
    CASE
      WHEN visited_at < @release_date THEN 'before_release'
      ELSE 'after_release'
    END AS period
  FROM visit_history
  WHERE visited_at >= DATE_SUB(@release_date, INTERVAL 21 DAY)
    AND visited_at < DATE_ADD(@release_date, INTERVAL 21 DAY)
) t
GROUP BY period
ORDER BY period;
```

### A14. 実行結果

| period        | visits | active_users | visits_per_active_user |
|---------------|--------|--------------|------------------------|
| after_release | 16     | 5            | 3.20                   |
| before_release| 13     | 8            | 1.63                   |

### Q15. 検索流入影響の代理指標（初回訪問ユーザーの割合推移）

```sql
SELECT
  DATE(first_visit_at) AS dt,
  COUNT(*) AS users_first_visit
FROM (
  SELECT
    user_id,
    MIN(visited_at) AS first_visit_at
  FROM visit_history
  GROUP BY user_id
) fv
WHERE first_visit_at >= DATE_SUB(@today, INTERVAL 60 DAY)
GROUP BY DATE(first_visit_at)
ORDER BY dt;
```

### A15. 実行結果

| dt         | users_first_visit |
|------------|-------------------|
| 2026-03-07 | 1                 |
| 2026-03-08 | 3                 |
| 2026-03-10 | 2                 |
| 2026-03-11 | 1                 |
| 2026-03-12 | 1                 |
| 2026-03-17 | 1                 |
| 2026-03-18 | 2                 |
| 2026-04-15 | 1                 |

---

## 4. 結果の返し方

実行結果は、次の形で貼りました。

- `Q1` 〜 `Q15` の下に `A1` 〜 `A15` として、クエリごとに結果テーブルをマークダウン形式で記載

---

## 5. 受領後に私が行うこと（完了まで）

あなたがSQL結果を返したら、次を一気通貫で実施します。

1. GA4 MCPでファネルを取得
- `page_view` / `login` / `onboarding_completed` / `suggestion_generated` / `visit_recorded` などでステップ別CVを再計算
- 2026-03-26時点との比較を実施

2. Search Console MCPで検索影響を分析
- 直近期間と前期間のクリック/表示/CTR/順位の差分
- クエリ・ページ別の変化を抽出

3. Lighthouse添付JSONを深掘り
- LCP 22.0sとCLS 0.331の主要原因を監査項目から特定
- フロントエンドのみで改善可能な施策に絞って優先度付け

4. /funnel-analysis成果物を作成
- `docs/marketing/analysis/20260415.md` に分析結果を記録
- TODOの該当2項目を完了判断できる粒度で、基準値・課題・打ち手を明記
