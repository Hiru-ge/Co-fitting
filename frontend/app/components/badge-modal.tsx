import type { BadgeInfo } from "~/types/visit";
import { getBadgeIcon } from "~/utils/badge-icon";

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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* コンフェッティ装飾 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[15%] left-[20%] w-2 h-2 rounded-sm bg-primary-purple/60 -rotate-45 animate-confetti-1" />
        <div className="absolute top-[70%] left-[5%] w-2 h-2 rounded-sm bg-pink-400/60 -rotate-12 animate-confetti-2" />
        <div className="absolute top-[16%] left-[80%] w-2 h-2 rounded-sm bg-pink-500/60 rotate-45 animate-confetti-3" />
        <div className="absolute top-[30%] left-[3%] w-2 h-2 rounded-sm bg-primary-purple/60 rotate-12 animate-confetti-1" />
        <div className="absolute top-[70%] left-[95%] w-2 h-2 rounded-sm bg-yellow-400/60 rotate-45 animate-confetti-2" />
        <div className="absolute top-[50%] left-[93%] w-2 h-2 rounded-sm bg-pink-400/60 rotate-30 animate-confetti-3" />
        <div className="absolute top-[15%] left-[45%] w-2 h-2 rounded-sm bg-primary-purple/60 rotate-20 animate-confetti-2" />
        <div className="absolute top-[40%] left-[3%] w-1.5 h-1.5 rounded-sm bg-yellow-400/70 -rotate-30 animate-confetti-1" />
        <div className="absolute top-[22%] left-[95%] w-2 h-2 rounded-sm bg-pink-500/60 rotate-15 animate-confetti-3" />
        <div className="absolute top-[60%] left-[3%] w-1.5 h-1.5 rounded-sm bg-primary-purple/60 rotate-60 animate-confetti-2" />
        <div className="absolute top-[7%] left-[40%] w-2 h-2 rounded-sm bg-yellow-400/60 -rotate-20 animate-confetti-1" />
        <div className="absolute top-[78%] left-[35%] w-2 h-2 rounded-sm bg-pink-400/60 rotate-45 animate-confetti-3" />
        <div className="absolute top-[72%] left-[60%] w-1.5 h-1.5 rounded-sm bg-primary-purple/70 -rotate-15 animate-confetti-2" />
        <div className="absolute top-[75%] left-[78%] w-2 h-2 rounded-sm bg-yellow-400/60 rotate-30 animate-confetti-1" />
        <div className="absolute top-[30%] left-[98%] w-1.5 h-1.5 rounded-sm bg-pink-500/60 -rotate-60 animate-confetti-3" />
        <div className="absolute top-[40%] left-[98%] w-2 h-2 rounded-sm bg-primary-purple/60 rotate-12 animate-confetti-2" />
      </div>

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
          <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: "#8c25f4" }}>
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
          <span className="material-symbols-outlined" aria-hidden="true">military_tech</span>
        </button>
      </div>
    </div>
  );
}
