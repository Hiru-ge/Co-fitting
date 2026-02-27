import { getLevelInfo } from "~/utils/level";
import { useModalClose } from "~/hooks/use-modal-close";
import ConfettiDecoration from "~/components/confetti-decoration";

interface XpModalProps {
  xpEarned: number;
  totalXp: number;
  currentLevel: number;
  levelUp: boolean;
  newLevel: number;
  onClose: () => void;
}

export default function XpModal({
  xpEarned,
  totalXp,
  currentLevel,
  levelUp,
  newLevel,
  onClose,
}: XpModalProps) {
  const { xpToNextLevel, progressPercent } = getLevelInfo(totalXp);
  useModalClose(onClose);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="XP獲得"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
    >
      {/* 背景オーバーレイ */}
      <div
        data-testid="modal-overlay"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <ConfettiDecoration colorScheme="primary" />

      {/* モーダル本体 */}
      <div className="relative z-10 w-full max-w-md animate-modal-in">
        <div
          className="w-full rounded-[2rem] p-8 flex flex-col items-center text-center mb-6 relative"
          style={{
            background: "rgba(16, 34, 34, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(19, 236, 236, 0.15)",
          }}
        >

          {/* バッジ / スター アイコン */}
          <div className="mt-4 relative">
            <div
              className="absolute inset-0 rounded-full blur-2xl animate-pulse"
              style={{ background: "rgba(19, 236, 236, 0.3)" }}
              aria-hidden="true"
            />
            <div
              className="relative size-32 rounded-full flex items-center justify-center border-4 border-white/20"
              style={{
                background: "linear-gradient(135deg, #13ecec, #0891b2)",
                boxShadow: "0 0 40px rgba(19, 236, 236, 0.4)",
              }}
            >
              <span
                className="material-symbols-outlined text-white"
                style={{ fontVariationSettings: "'FILL' 1", fontSize: "6.5rem" }}
                aria-hidden="true"
              >
                check
              </span>
            </div>

          </div>

          {/* XP・テキスト */}
          <div className="mt-10 space-y-2">
            {levelUp && (
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-yellow-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  military_tech
                </span>
                <span className="text-yellow-400 text-sm font-bold tracking-widest uppercase">
                  Level Up!
                </span>
              </div>
            )}
            <div className="text-primary text-4xl font-bold tracking-tight">
              +{xpEarned} XP
            </div>
            <h2 className="text-white text-3xl font-bold pt-2">クエスト完了！</h2>
            <p className="text-white/70 text-sm leading-relaxed max-w-[280px] mx-auto">
              {levelUp
                ? `レベル${newLevel}に上がりました！`
                : `着実に探索範囲が広がっています。`}
            </p>
          </div>

          {/* レベルプログレスバー */}
          <div className="w-full mt-8">
            <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(progressPercent, 100)}%`,
                  background: "linear-gradient(to right, #13ecec, #0891b2)",
                  boxShadow: "0 0 10px rgba(19, 236, 236, 0.4)",
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-white/50 font-medium uppercase tracking-widest">
              <span>LEVEL {currentLevel}</span>
              {xpToNextLevel > 0 ? (
                <span>LEVEL {currentLevel + 1} まであと {xpToNextLevel} XP</span>
              ) : (
                <span>MAX LEVEL</span>
              )}
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <button
          onClick={onClose}
          className="w-full py-5 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          style={{
            background: "#13ecec",
            color: "#102222",
            boxShadow: "0 8px 32px rgba(19, 236, 236, 0.35)",
          }}
        >
          <span>次の冒険へ</span>
          <span className="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
        </button>
      </div>
    </div>
  );
}
