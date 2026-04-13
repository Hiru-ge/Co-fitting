import { Icon } from "~/components/Icon";

interface LocationPermissionModalProps {
  onUseDefault: () => void;
  onGoToSettings: () => void;
}

export default function LocationPermissionModal({
  onUseDefault,
  onGoToSettings,
}: LocationPermissionModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="位置情報が利用できません"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* モーダル本体 */}
      <div className="relative z-10 w-full max-w-sm bg-gray-900 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <Icon
            name="location_off"
            className="text-3xl text-amber-500"
            aria-hidden="true"
          />
          <h2 className="text-base font-bold text-white">
            現在地を取得できません
          </h2>
        </div>

        <p className="text-sm text-gray-400 leading-relaxed">
          位置情報の利用が許可されていません。
          <br />
          ブラウザの設定から許可するか、渋谷駅周辺の提案で試すことができます。
        </p>

        <div className="flex flex-col gap-3 mt-1">
          <button
            onClick={onGoToSettings}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm"
          >
            設定で許可する
          </button>
          <button
            onClick={onUseDefault}
            className="w-full py-3 rounded-xl bg-gray-800 text-gray-300 font-semibold text-sm"
          >
            渋谷駅周辺で試す
          </button>
        </div>
      </div>
    </div>
  );
}
