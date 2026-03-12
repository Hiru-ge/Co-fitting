import { useState, useEffect } from "react";
import { getNotificationSettings, updateNotificationSettings } from "~/api/notifications";
import { getPushPermissionState, subscribePush } from "~/lib/push";
import type { NotificationSettings } from "~/types/notification";
import NotificationToggle from "~/components/NotificationToggle";

export default function NotificationTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  useEffect(() => {
    getNotificationSettings(token).then(setSettings);
    getPushPermissionState().then(setPushPermission);
  }, [token]);

  async function handleToggle(
    field: keyof NotificationSettings,
    value: boolean
  ) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    await updateNotificationSettings(token, { [field]: value });
  }

  async function handleSubscribePush() {
    const success = await subscribePush(token);
    if (success) setPushPermission("granted");
  }

  if (!settings) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">読み込み中...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Push通知セクション */}
      <section className="bg-white/5 rounded-2xl border border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            notifications
          </span>
          Push通知
        </h2>

        {/* 許可ステータス */}
        <div className="mb-4">
          {isIOS && !isStandalone ? (
            <div className="flex items-start gap-2 bg-blue-900/20 rounded-xl p-3">
              <span className="material-symbols-outlined text-blue-500 text-base shrink-0 mt-0.5">
                info
              </span>
              <p className="text-xs text-blue-300">
                Push通知はホーム画面に追加後に利用できます。Safari共有メニューから「ホーム画面に追加」してください。
              </p>
            </div>
          ) : pushPermission === "granted" ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
              <span className="material-symbols-outlined text-base">check_circle</span>
              通知が許可されています
            </div>
          ) : pushPermission === "default" ? (
            <button
              type="button"
              onClick={handleSubscribePush}
              className="w-full py-2.5 rounded-full bg-primary text-black font-bold text-sm transition-colors active:scale-95"
            >
              通知を許可する
            </button>
          ) : (
            <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
              <span className="material-symbols-outlined text-base">notifications_off</span>
              通知が拒否されています
            </div>
          )}
        </div>

        {/* Push全体トグル */}
        <NotificationToggle
          id="push-enabled"
          label="Push通知"
          description="すべてのPush通知の有効/無効を切り替えます"
          checked={settings.push_enabled}
          onChange={(val) => handleToggle("push_enabled", val)}
        />

        {/* Push個別トグル */}
        <div className="border-t border-white/10 mt-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider pt-3 pb-1">
            通知の種類
          </p>
          <NotificationToggle
            id="daily-suggestion"
            label="デイリーリフレッシュ"
            description="毎朝7時に提案カードリフレッシュを通知"
            checked={settings.daily_suggestion}
            disabled={!settings.push_enabled}
            onChange={(val) => handleToggle("daily_suggestion", val)}
          />
          <NotificationToggle
            id="push-streak-reminder"
            label="ストリークリマインダー"
            description="ストリークが切れそうなとき（週1回）にお知らせ"
            checked={settings.streak_reminder}
            disabled={!settings.push_enabled}
            onChange={(val) => handleToggle("streak_reminder", val)}
          />
          <NotificationToggle
            id="push-weekly-summary"
            label="週次サマリー"
            description="毎週月曜に先週の訪問まとめをお届け"
            checked={settings.weekly_summary}
            disabled={!settings.push_enabled}
            onChange={(val) => handleToggle("weekly_summary", val)}
          />
          <NotificationToggle
            id="push-monthly-summary"
            label="月次サマリー"
            description="毎月1日に先月の活動まとめをお届け"
            checked={settings.monthly_summary}
            disabled={!settings.push_enabled}
            onChange={(val) => handleToggle("monthly_summary", val)}
          />
        </div>
      </section>

      {/* メール通知セクション */}
      <section className="bg-white/5 rounded-2xl border border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            mail
          </span>
          メール通知
        </h2>

        {/* メール全体トグル */}
        <NotificationToggle
          id="email-enabled"
          label="メール通知"
          description="すべてのメール通知の有効/無効を切り替えます"
          checked={settings.email_enabled}
          onChange={(val) => handleToggle("email_enabled", val)}
        />

        {/* メール個別トグル */}
        <div className="border-t border-white/10 mt-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider pt-3 pb-1">
            通知の種類
          </p>
          <NotificationToggle
            id="email-streak-reminder"
            label="ストリークリマインダー"
            ariaLabel="ストリークリマインダー（メール）"
            description="ストリークが切れそうなとき（週1回）にお知らせ"
            checked={settings.streak_reminder}
            disabled={!settings.email_enabled}
            onChange={(val) => handleToggle("streak_reminder", val)}
          />
          <NotificationToggle
            id="email-weekly-summary"
            label="週次サマリー"
            ariaLabel="週次サマリー（メール）"
            description="毎週月曜に先週の訪問まとめをお届け"
            checked={settings.weekly_summary}
            disabled={!settings.email_enabled}
            onChange={(val) => handleToggle("weekly_summary", val)}
          />
          <NotificationToggle
            id="email-monthly-summary"
            label="月次サマリー"
            ariaLabel="月次サマリー（メール）"
            description="毎月1日に先月の活動まとめをお届け"
            checked={settings.monthly_summary}
            disabled={!settings.email_enabled}
            onChange={(val) => handleToggle("monthly_summary", val)}
          />
        </div>
      </section>
    </div>
  );
}
