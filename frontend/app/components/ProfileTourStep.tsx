import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

interface ProfileTourStepProps {
  onClose: () => void;
  onFinish: () => void;
}

const SPOTLIGHT_PADDING = 10;

export default function ProfileTourStep({
  onClose,
  onFinish,
}: ProfileTourStepProps) {
  const navigate = useNavigate();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const xpSectionEl = document.querySelector('[data-tour="xp-section"]');
    const xpSectionRect = xpSectionEl
      ? xpSectionEl.getBoundingClientRect()
      : null;
    requestAnimationFrame(() => setTargetRect(xpSectionRect));
  }, []);

  function handleFinish() {
    onFinish();
    onClose();
    navigate("/home");
  }

  const panelAtTop = targetRect
    ? targetRect.top + targetRect.height / 2 > window.innerHeight * 0.55
    : false;

  const panelStyle: React.CSSProperties = panelAtTop
    ? {
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
      }
    : {
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
      };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="使い方ツアー ステップ4"
      className="fixed inset-0 z-60"
    >
      {targetRect ? (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: targetRect.top - SPOTLIGHT_PADDING,
            left: targetRect.left - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
            borderRadius: 16,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/75" aria-hidden="true" />
      )}

      <div
        className="z-10"
        style={{
          ...panelStyle,
          width: "calc(100vw - 32px)",
          maxWidth: "20rem",
        }}
      >
        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: "rgba(16, 34, 34, 0.97)",
            border: "1px solid rgba(82, 91, 187, 0.4)",
            backdropFilter: "blur(12px)",
          }}
        >
          <p className="text-xs font-bold tracking-widest text-primary/70 mb-3">
            4 / 4
          </p>
          <h2 className="text-white text-base font-bold leading-snug mb-2">
            XPとバッジを集めよう
          </h2>
          <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">
            {
              "訪問するたびにXPとバッジが貯まります\n興味外ジャンルへのチャレンジ訪問はボーナスXP！"
            }
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleFinish}
            className="flex-1 py-2.5 rounded-full text-sm text-gray-400 border border-gray-600 bg-white/5 hover:text-gray-300 transition-colors"
          >
            スキップ
          </button>
          <button
            onClick={handleFinish}
            className="flex-1 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95"
            style={{ background: "#525BBB", color: "#fff" }}
          >
            はじめる
          </button>
        </div>
      </div>
    </div>
  );
}
