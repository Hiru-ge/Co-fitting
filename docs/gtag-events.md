# GA4 計測設計

実装: `frontend/app/lib/gtag.ts`

`VITE_GA4_ID` が未設定のとき（ローカル開発）は `window.gtag` が存在しないため自動でnoop。

## 計測イベント一覧

### ページ・認証系

| 関数 | イベント名 | 説明 | 主なパラメータ |
|---|---|---|---|
| `sendPageView` | `page_view` | ページ遷移時 | `page_path` |
| `sendLogin` | `login` | ログイン成功時 | `method`, `is_new_user`（新規/既存） |

### オンボーディング・設定系

| 関数 | イベント名 | 説明 | 主なパラメータ |
|---|---|---|---|
| `sendOnboardingCompleted` | `onboarding_completed` | 興味タグ選択完了 | `tag_count`, `tag_names` |
| `sendOnboardingSkipped` | `onboarding_skipped` | オンボーディングをスキップ | なし |
| `sendInterestsUpdated` | `interests_updated` | 設定画面で興味タグ更新 | `tag_count` |
| `sendSearchRadiusUpdated` | `search_radius_updated` | 検索半径変更 | `radius_km` |

### 提案系

| 関数 | イベント名 | 説明 | 主なパラメータ |
|---|---|---|---|
| `sendSuggestionGenerated` | `suggestion_generated` | 提案リスト生成時 | `places_count`, `interest_match_count`, `breakout_count`, `categories`, `is_reload` |
| `sendSuggestionViewed` | `suggestion_viewed` | カードを閲覧（スタック表示） | `place_name`, `category`, `is_interest_match`, `is_breakout`, `card_index` |
| `sendSuggestionSkipped` | `suggestion_skipped` | カードをスキップ | `place_name`, `category`, `is_interest_match`, `is_breakout` |
| `sendSuggestionReloaded` | `suggestion_reloaded` | 提案リロード | `reload_count_remaining`（残りリロード回数） |
| `sendFirstSuggestionViewed` | `first_suggestion_viewed` | 初回提案カード表示 | `category`, `is_interest_match`, `is_breakout` |

### 訪問記録系

| 関数 | イベント名 | 説明 | 主なパラメータ |
|---|---|---|---|
| `sendVisitRecorded` | `visit_recorded` | 訪問記録完了 | `place_name`, `category`, `is_breakout`, `xp_earned`, `xp_base`, `first_area_bonus`, `streak_bonus` |
| `sendDailyCompleted` | `daily_completed` | 本日3件の訪問達成 | なし |
| `sendVisitMemoSaved` | `visit_memo_saved` | 訪問メモ・評価を保存 | `has_memo`, `rating` |
| `sendFirstValueMilestone` | `first_value_milestone` | 初回価値到達マイルストーン（訪問記録時） | `milestone`（`first_visit_recorded` / `first_daily_completed`） |

### ゲーミフィケーション系

| 関数 | イベント名 | 説明 | 主なパラメータ |
|---|---|---|---|
| `sendBadgeEarned` | `badge_earned` | バッジ獲得 | `badge_name` |
| `sendLevelUp` | `level_up` | レベルアップ | `new_level` |
| `sendWeeklyReactivation` | `weekly_reactivation` | 週次復帰（ストリークボーナス発生時） | `streak_weeks` |

### Push通知系

| 関数 | イベント名 | 説明 | 主なパラメータ |
|---|---|---|---|
| `sendPushBannerShown` | `push_banner_shown` | Push通知勧誘バナー表示 | なし |
| `sendPushBannerDismissed` | `push_banner_dismissed` | バナーを閉じた | なし |
| `sendPushPermissionGranted` | `push_permission_granted` | Push通知を許可 | `source`（`"banner"` or `"settings"`） |
| `sendPushPermissionDenied` | `push_permission_denied` | Push通知を拒否 | `source`（`"banner"` or `"settings"`） |
| `sendNotificationSettingChanged` | `notification_setting_changed` | 通知設定を変更 | `field`, `value` |
| `sendReminderOpened` | `reminder_opened` | 通知経由の再訪 | `reminder_type`（`daily_refresh` / `streak_reminder` / `weekly_summary` / `monthly_summary` / `weekend_refresh`） |

### LP・獲得導線系

| 関数 | イベント名 | 説明 | 主なパラメータ |
|---|---|---|---|
| `sendLpCtaClicked` | `lp_cta_clicked` | LP上のCTAクリック | `cta_type`（`start` / `ios_notify` / `tiktok`）, `section`（`header` / `hero` / `demo` / `final_cta`） |
| `sendLpSectionViewed` | `lp_section_viewed` | LP各セクション到達 | `section_name`（`hero` / `pain_points` / `features` / `demo` / `ios_notify`） |
| `sendIosNotifySubmitted` | `ios_notify_submitted` | iOS通知フォーム送信結果 | `source_section`, `success` |

## カスタムディメンション登録

GA4管理画面でカスタムパラメータをレポートに表示するには、カスタムディメンションとして登録が必要。
管理 → プロパティ → カスタム定義 → カスタムディメンション → 作成

登録が必要な主なパラメータ: `is_breakout`, `is_interest_match`, `is_new_user`, `xp_earned`, `new_level`, `badge_name` など
