import { useEffect } from "react";
import type { BadgeInfo } from "~/types/visit";

const AUTO_CLOSE_MS = 5000;

interface BadgeToastProps {
  badge: BadgeInfo;
  onClose: () => void;
}

export default function BadgeToast({ badge, onClose }: BadgeToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg animate-slide-in"
      style={{
        background: "rgba(140, 37, 244, 0.15)",
        border: "1px solid rgba(140, 37, 244, 0.4)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* バッジアイコン */}
      <div
        className="shrink-0 size-10 rounded-full flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #8c25f4, #ec4899)" }}
        aria-hidden="true"
      >
        <span
          className="material-symbols-outlined text-white text-xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          military_tech
        </span>
      </div>

      {/* テキスト */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-primary uppercase tracking-widest">
          バッジ獲得
        </p>
        <p className="text-sm font-bold text-white truncate">{badge.name}</p>
        <p className="text-xs text-white/60 truncate">{badge.description}</p>
      </div>

      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="shrink-0 size-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
      >
        <span className="material-symbols-outlined text-base text-white/60">
          close
        </span>
      </button>
    </div>
  );
}
