import { Icon } from "~/components/Icon";
import { getLevelInfo } from "~/utils/level";
import ConfettiDecoration from "~/components/ConfettiDecoration";
import type { XPBreakdown } from "~/types/visit";

interface XpModalProps {
  xpEarned: number;
  totalXp: number;
  currentLevel: number;
  isLevelUp: boolean;
  newLevel: number;
  xpBreakdown?: XPBreakdown;
  onClose: () => void;
}

interface XpBreakdownRowProps {
  label: string;
  xp: number;
  isHighlight?: boolean;
  isShowPlus?: boolean;
}

function XpBreakdownRow({
  label,
  xp,
  isHighlight = false,
  isShowPlus = true,
}: XpBreakdownRowProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span
        className={isHighlight ? "text-red-400 font-semibold" : "text-white/60"}
      >
        {label}
      </span>
      <span
        className={`font-bold tabular-nums ${isHighlight ? "text-red-400" : "text-white/80"}`}
      >
        {isShowPlus ? "+" : ""}
        {xp}
      </span>
    </div>
  );
}

export default function XpModal({
  xpEarned,
  totalXp,
  currentLevel,
  isLevelUp,
  newLevel,
  xpBreakdown,
  onClose,
}: XpModalProps) {
  const { xpToNextLevel, progressPercent } = getLevelInfo(totalXp);
  const isBreakout = (xpBreakdown?.base_xp ?? 0) >= 100;
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
              <Icon
                name="check"
                fill
                className="text-white"
                style={{ fontSize: "6.5rem" }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* XP・テキスト */}
          <div className="mt-10 space-y-2">
            {isLevelUp && (
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Icon
                  name="military_tech"
                  fill
                  className="text-yellow-400 text-base"
                  aria-hidden="true"
                />
                <span className="text-yellow-400 text-sm font-bold tracking-widest uppercase">
                  Level Up!
                </span>
              </div>
            )}
            <div className="text-primary text-4xl font-bold tracking-tight">
              +{xpEarned} XP
            </div>
            <h2 className="text-white text-3xl font-bold pt-2">
              クエスト完了！
            </h2>
            <p className="text-white/70 text-sm leading-relaxed max-w-70 mx-auto">
              {isLevelUp
                ? `レベル${newLevel}に上がりました！`
                : `着実に探索範囲が広がっています。`}
            </p>
          </div>

          {/* XP計算内訳 */}
          {xpBreakdown && (
            <div
              data-testid="xp-breakdown"
              className="w-full mt-6 rounded-xl px-4 py-3 text-left space-y-1.5"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <XpBreakdownRow
                label={isBreakout ? "チャレンジ訪問" : "通常訪問"}
                xp={xpBreakdown.base_xp}
                isHighlight={isBreakout}
                isShowPlus={false}
              />
              {xpBreakdown.first_area_bonus > 0 && (
                <XpBreakdownRow
                  label="初エリアボーナス"
                  xp={xpBreakdown.first_area_bonus}
                />
              )}
              {xpBreakdown.streak_bonus > 0 && (
                <XpBreakdownRow
                  label="ストリークボーナス"
                  xp={xpBreakdown.streak_bonus}
                />
              )}
            </div>
          )}

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
                <span>
                  LEVEL {currentLevel + 1} まであと {xpToNextLevel} XP
                </span>
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
          <Icon name="rocket_launch" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
