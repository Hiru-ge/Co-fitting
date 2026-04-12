import { useState, useEffect } from "react";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "~/api/notifications";
import { getPushPermissionState, subscribePush } from "~/lib/push";
import type { NotificationSettings } from "~/types/notification";
import {
  sendPushPermissionGranted,
  sendPushPermissionDenied,
  sendNotificationSettingChanged,
} from "~/lib/gtag";

interface NotificationToggleProps {
  id: string;
  label: string;
  ariaLabel?: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function NotificationToggle({
  id,
  label,
  ariaLabel,
  description,
  checked,
  disabled = false,
  onChange,
}: NotificationToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className={`text-sm font-medium cursor-pointer ${disabled ? "text-gray-500" : "text-gray-200"}`}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        } ${checked ? "bg-primary" : "bg-gray-600"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
          aria-hidden="true"
        />
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </button>
    </div>
  );
}

function getAcceptSteps(
  isIOS: boolean,
  isStandalone: boolean,
  isIOSChrome: boolean,
  isAndroid: boolean,
): string[] {
  if (isIOS && isStandalone) {
    return [
      "iPhoneの「設定」を開く",
      "「アプリ」→「Roamble」をタップ",
      "「通知」→「通知を許可」をオン",
      "Roambleに戻る",
    ];
  }
  if (isIOS && isIOSChrome) {
    return [
      "iPhoneの「設定」を開く",
      "「アプリ」→「Chrome」をタップ",
      "「通知」をオン",
      "Chromeに戻り「通知を許可する」を押す",
    ];
  }
  if (isIOS) {
    return [
      "iPhoneの「設定」を開く",
      "「Safari」→「詳細」→「ウェブサイトの設定」",
      "「roamble.app」→「通知」→「許可」",
      "Safariに戻り「通知を許可する」を押す",
    ];
  }
  if (isAndroid) {
    return [
      "アドレスバー左の🔒をタップ",
      "「サイトの設定」→「通知」を選択",
      "「許可」に変更",
      "ページを再読み込み",
    ];
  }
  return [
    "アドレスバー左の🔒をクリック",
    "「通知」→「許可」に変更",
    "ページを再読み込み",
  ];
}

export default function NotificationTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission>("default");

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const isIOSChrome = /CriOS/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMac = /Macintosh/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  const acceptSteps = getAcceptSteps(
    isIOS,
    isStandalone,
    isIOSChrome,
    isAndroid,
  );

  useEffect(() => {
    getNotificationSettings(token).then(setSettings);
    getPushPermissionState().then(async (permission) => {
      setPushPermission(permission);
      if (permission === "granted") {
        // 許可済みだがSWが未登録などで購読が存在しない場合は自動再購読
        const reg = await navigator.serviceWorker.ready.catch(() => null);
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (!sub) {
            await subscribePush(token);
          }
        }
      }
    });
  }, [token]);

  async function handleToggle(
    field: keyof NotificationSettings,
    value: boolean,
  ) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    const updated = await updateNotificationSettings(token, { [field]: value });
    setSettings(updated);
    sendNotificationSettingChanged(field, value);
  }

  async function handleSubscribePush() {
    const success = await subscribePush(token);
    if (success) {
      setPushPermission("granted");
      sendPushPermissionGranted("settings");
    } else {
      sendPushPermissionDenied("settings");
    }
  }

  if (!settings) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        読み込み中...
      </div>
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
              <span className="material-symbols-outlined text-base">
                check_circle
              </span>
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
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                <span className="material-symbols-outlined text-base">
                  notifications_off
                </span>
                通知が拒否されています
              </div>
              <p className="text-xs text-gray-400">
                {isIOS
                  ? "アプリ・ブラウザからは再許可できません。iPhoneの設定から変更してください。"
                  : "ブラウザからは再許可できません。以下の手順で変更してください。"}
              </p>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  変更手順
                </p>
                <ol className="space-y-2">
                  {acceptSteps.map((step, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-300"
                    >
                      <span className="shrink-0 w-5 h-5 rounded-full bg-red-900/30 text-red-500 text-xs flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              {isMac && (
                <p className="text-xs text-gray-500 px-1">
                  ※ macOSをお使いの場合は「システム設定」→「通知」→「Google
                  Chrome」もオンになっているか確認してください。
                </p>
              )}
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
