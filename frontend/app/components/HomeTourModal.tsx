import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { HOME_TOUR_SEEN_KEY, PROFILE_TOUR_KEY } from "~/utils/constants";

interface HomeTourModalProps {
  onClose: () => void;
}

// ホーム側のステップ（ステップ3はプロフィールページで表示）
const HOME_TOUR_STEPS = [
  {
    selector: '[data-tour="discovery-cards"]',
    title: "近くの場所が提案されます",
    description:
      "カードをスワイプで次の提案へ移動\nリロードで提案カードを引き直せます",
  },
  {
    selector: '[data-tour="action-buttons"]',
    title: "到着したら訪問を記録しましょう",
    description: "施設の半径100m以内で\n「行ってきた！」ボタンが押せます",
  },
];

const TOTAL_STEPS = 3; // プロフィールのステップ3を含む合計
const SPOTLIGHT_PADDING = 10;

export default function HomeTourModal({ onClose }: HomeTourModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const currentStep = HOME_TOUR_STEPS[step];
  const isLastHomeStep = step === HOME_TOUR_STEPS.length - 1;

  useEffect(() => {
    const el = document.querySelector(currentStep.selector);
    const rect = el ? el.getBoundingClientRect() : null;
    requestAnimationFrame(() => setTargetRect(rect));
  }, [step, currentStep.selector]);

  function handleSkip() {
    localStorage.setItem(HOME_TOUR_SEEN_KEY, "true");
    onClose();
  }

  function handleNext() {
    if (isLastHomeStep) {
      // ステップ3はプロフィールページで表示
      sessionStorage.setItem(PROFILE_TOUR_KEY, "true");
      navigate("/profile");
    } else {
      setStep((s) => s + 1);
    }
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
      aria-label="使い方ツアー"
      className="fixed inset-0 z-[60]"
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
            {step + 1} / {TOTAL_STEPS}
          </p>
          <h2 className="text-white text-base font-bold leading-snug mb-2">
            {currentStep.title}
          </h2>
          <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">
            {currentStep.description}
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSkip}
            className="flex-1 py-2.5 rounded-full text-sm text-gray-400 border border-gray-600 bg-white/5 hover:text-gray-300 transition-colors"
          >
            スキップ
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95"
            style={{ background: "#525BBB", color: "#fff" }}
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
