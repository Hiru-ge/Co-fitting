-- Roamble analytics minimal SQL pack (TiDB/MySQL)
-- Purpose: reduce manual queries from 15 to 3
-- Rule: SELECT only

SET @today := CURDATE();
SET @start_30d := DATE_SUB(@today, INTERVAL 30 DAY);
SET @start_60d := DATE_SUB(@today, INTERVAL 60 DAY);
SET @release_date := '2026-03-17';

-- Q1: Core health snapshot (users/activity/dormancy/distribution)
WITH per_user AS (
  SELECT
    u.id AS user_id,
    u.created_at,
    COUNT(v.id) AS visit_count,
    MAX(v.visited_at) AS last_visit_at,
    MIN(v.visited_at) AS first_visit_at
  FROM users u
  LEFT JOIN visit_history v ON v.user_id = u.id
  GROUP BY u.id, u.created_at
)
SELECT
  COUNT(*) AS total_users,
  SUM(CASE WHEN created_at >= @start_30d THEN 1 ELSE 0 END) AS new_users_30d,
  SUM(CASE WHEN last_visit_at >= @start_30d THEN 1 ELSE 0 END) AS active_users_30d,
  SUM(CASE WHEN last_visit_at >= DATE_SUB(@today, INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS active_users_7d,
  SUM(CASE WHEN last_visit_at >= DATE_SUB(@today, INTERVAL 1 DAY) THEN 1 ELSE 0 END) AS active_users_1d,
  SUM(CASE WHEN visit_count = 0 THEN 1 ELSE 0 END) AS dormant_users,
  ROUND(SUM(CASE WHEN visit_count = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS dormant_rate_pct,
  SUM(CASE WHEN visit_count = 1 THEN 1 ELSE 0 END) AS users_visit_1,
  SUM(CASE WHEN visit_count BETWEEN 2 AND 3 THEN 1 ELSE 0 END) AS users_visit_2_3,
  SUM(CASE WHEN visit_count BETWEEN 4 AND 9 THEN 1 ELSE 0 END) AS users_visit_4_9,
  SUM(CASE WHEN visit_count >= 10 THEN 1 ELSE 0 END) AS users_visit_10_plus,
  ROUND(AVG(CASE WHEN first_visit_at IS NOT NULL THEN DATEDIFF(first_visit_at, DATE(created_at)) END), 2) AS avg_days_to_first_visit
FROM per_user;

-- Q2: Push impact snapshot (subscription/use/settings)
WITH push_users AS (
  SELECT DISTINCT user_id FROM push_subscriptions
),
per_user AS (
  SELECT
    u.id AS user_id,
    CASE WHEN pu.user_id IS NULL THEN 'no_push' ELSE 'push_subscribed' END AS segment,
    COUNT(v.id) AS visit_count
  FROM users u
  LEFT JOIN push_users pu ON pu.user_id = u.id
  LEFT JOIN visit_history v ON v.user_id = u.id
  GROUP BY u.id, segment
)
SELECT
  segment,
  COUNT(*) AS users,
  SUM(visit_count) AS total_visits,
  ROUND(AVG(visit_count), 2) AS avg_visits_per_user
FROM per_user
GROUP BY segment
ORDER BY segment;

-- Q2b: Notification settings customization rate
SELECT
  COUNT(*) AS users_with_notification_settings,
  SUM(
    CASE
      WHEN push_enabled = 0
        OR email_enabled = 0
        OR daily_suggestion = 0
        OR weekly_summary = 0
        OR monthly_summary = 0
        OR streak_reminder = 0
      THEN 1 ELSE 0
    END
  ) AS users_customized,
  ROUND(
    SUM(
      CASE
        WHEN push_enabled = 0
          OR email_enabled = 0
          OR daily_suggestion = 0
          OR weekly_summary = 0
          OR monthly_summary = 0
          OR streak_reminder = 0
        THEN 1 ELSE 0
      END
    ) * 100.0 / COUNT(*), 1
  ) AS customized_rate_pct
FROM notification_settings;

-- Q3: Weekly trend snapshot (registration/first-visit/release-impact)
WITH first_visits AS (
  SELECT user_id, MIN(visited_at) AS first_visit_at
  FROM visit_history
  GROUP BY user_id
),
weekly_users AS (
  SELECT YEARWEEK(created_at, 3) AS yw, COUNT(*) AS new_users
  FROM users
  WHERE created_at >= @start_60d
  GROUP BY YEARWEEK(created_at, 3)
),
weekly_first_visit AS (
  SELECT YEARWEEK(first_visit_at, 3) AS yw, COUNT(*) AS users_first_visit
  FROM first_visits
  WHERE first_visit_at >= @start_60d
  GROUP BY YEARWEEK(first_visit_at, 3)
),
release_compare AS (
  SELECT
    CASE WHEN visited_at < @release_date THEN 'before_release' ELSE 'after_release' END AS period,
    COUNT(*) AS visits,
    COUNT(DISTINCT user_id) AS active_users,
    ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT user_id), 2) AS visits_per_active_user
  FROM visit_history
  WHERE visited_at >= DATE_SUB(@release_date, INTERVAL 21 DAY)
    AND visited_at < DATE_ADD(@release_date, INTERVAL 21 DAY)
  GROUP BY period
)
SELECT
  wu.yw,
  wu.new_users,
  COALESCE(wf.users_first_visit, 0) AS users_first_visit
FROM weekly_users wu
LEFT JOIN weekly_first_visit wf ON wf.yw = wu.yw
ORDER BY wu.yw;

SELECT *
FROM release_compare
ORDER BY period;
