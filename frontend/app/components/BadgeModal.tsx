import type { BadgeInfo } from "~/types/visit";
import { getBadgeIcon } from "~/utils/badge-icon";
import ConfettiDecoration from "~/components/ConfettiDecoration";

interface BadgeModalProps {
  badge: BadgeInfo;
  onClose: () => void;
}

export default function BadgeModal({ badge, onClose }: BadgeModalProps) {
  const { icon } = getBadgeIcon(badge.name);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="バッジ獲得"
      className="fixed inset-0 z-60 flex flex-col items-center justify-center p-6"
    >
      {/* 背景オーバーレイ */}
      <div
        data-testid="modal-overlay"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <ConfettiDecoration colorScheme="purple" />

      {/* モーダル本体 */}
      <div className="relative z-10 w-full max-w-md animate-modal-in">
        <div
          className="w-full rounded-[2rem] p-8 flex flex-col items-center text-center mb-6"
          style={{
            background: "rgba(16, 34, 34, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(140, 37, 244, 0.3)",
          }}
        >
          {/* バッジ獲得ラベル */}
          <p
            className="text-xs font-bold uppercase tracking-widest mb-6"
            style={{ color: "#8c25f4" }}
          >
            バッジ獲得
          </p>

          {/* バッジアイコン */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-2xl animate-pulse"
              style={{ background: "rgba(140, 37, 244, 0.3)" }}
              aria-hidden="true"
            />
            <div
              className="relative size-32 rounded-full flex items-center justify-center border-4 border-white/20"
              style={{
                background: "linear-gradient(135deg, #8c25f4, #ec4899)",
                boxShadow: "0 0 40px rgba(140, 37, 244, 0.4)",
              }}
            >
              <span
                className="material-symbols-outlined text-white"
                style={{ fontVariationSettings: "'FILL' 1", fontSize: "5rem" }}
                aria-hidden="true"
              >
                {icon}
              </span>
            </div>
          </div>

          {/* バッジ名・説明 */}
          <h2 className="text-white text-2xl font-bold mt-8">{badge.name}</h2>
          <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-[280px]">
            {badge.description}
          </p>
        </div>

        {/* アクションボタン */}
        <button
          onClick={onClose}
          className="w-full py-5 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #8c25f4, #ec4899)",
            color: "#fff",
            boxShadow: "0 8px 32px rgba(140, 37, 244, 0.35)",
          }}
        >
          <span>バッジを獲得</span>
          <span className="material-symbols-outlined" aria-hidden="true">
            military_tech
          </span>
        </button>
      </div>
    </div>
  );
}
