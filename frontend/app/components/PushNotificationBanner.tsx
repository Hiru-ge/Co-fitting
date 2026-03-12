import { usePushBannerVisible } from "~/hooks/use-push-banner-visible";
import { subscribePush } from "~/lib/push";

export default function PushNotificationBanner({ token }: { token: string }) {
  const { visible, dismiss } = usePushBannerVisible();

  if (!visible) return null;

  async function handleAllow() {
    await subscribePush(token);
    dismiss();
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-30 rounded-2xl bg-gray-900 border border-white/10 shadow-lg p-4 flex items-start gap-3">
      <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">
        notifications
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-100 mb-0.5">通知を受け取る</p>
        <p className="text-xs text-gray-400">新しい場所の提案をお知らせします</p>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleAllow}
          className="px-3 py-1 rounded-full bg-primary text-black text-xs font-bold"
        >
          許可する
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="px-3 py-1 rounded-full text-gray-400 text-xs"
        >
          後で
        </button>
      </div>
    </div>
  );
}
