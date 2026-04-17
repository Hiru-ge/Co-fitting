import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  HOME_TOUR_SEEN_KEY,
  ONBOARDING_STAGE_KEY,
  ONBOARDING_STAGE,
} from "~/utils/constants";
import XpModal from "~/components/XpModal";
import { useSampleVisit } from "~/hooks/use-sample-visit";

interface HomeTourModalProps {
  onClose: () => void;
}

function isSameRect(prev: DOMRect | null, next: DOMRect | null) {
  if (!prev && !next) return true;
  if (!prev || !next) return false;

  return (
    prev.top === next.top &&
    prev.left === next.left &&
    prev.width === next.width &&
    prev.height === next.height
  );
}

// ホーム側のステップ（ステップ4はプロフィールページで表示）
const HOME_TOUR_STEPS = [
  {
    selector: '[data-tour="sample-visit-card"]',
    title: "近くの場所が提案されるよ！",
    description:
      "カードをスワイプで次の提案へ移動\nリロードで提案カードを引き直し！",
  },
  {
    selector: '[data-tour="sample-action-buttons"]',
    title: "到着したら訪問を記録しよう",
    description: "施設の半径200m以内で\n「行ってきた！」ボタンが押せるよ",
  },
  {
    selector: '[data-tour="sample-action-buttons"]',
    title: "訪問を体験してみよう",
    description:
      "体験用のお店を用意したよ！\n「行ってきた！」を押して\n訪問記録の流れを体験してみよう！",
  },
];

const SAMPLE_VISIT_STEP = 2;
const SAMPLE_VISIT_TRIGGER_EVENT = "sample-visit-triggered";
const TOTAL_STEPS = 4; // プロフィールのステップ4を含む合計
const SPOTLIGHT_PADDING = 10;
const PANEL_SIDE_MARGIN = 16;
const PANEL_EDGE_GAP = 16;
const PANEL_SPOTLIGHT_GAP = 12;
const ESTIMATED_PANEL_HEIGHT = 188;

export default function HomeTourModal({ onClose }: HomeTourModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentStep = HOME_TOUR_STEPS[step];
  const isSampleVisitStep = step === SAMPLE_VISIT_STEP;

  const { isShowingXpModal, pseudoXpData, completeSampleVisit, closeXpModal } =
    useSampleVisit();

  useEffect(() => {
    function handleSampleVisitTriggered() {
      if (step === SAMPLE_VISIT_STEP) {
        completeSampleVisit();
      }
    }

    window.addEventListener(
      SAMPLE_VISIT_TRIGGER_EVENT,
      handleSampleVisitTriggered,
    );

    return () => {
      window.removeEventListener(
        SAMPLE_VISIT_TRIGGER_EVENT,
        handleSampleVisitTriggered,
      );
    };
  }, [step, completeSampleVisit]);

  useEffect(() => {
    let animationFrameId = 0;
    let intervalId: number | null = null;

    function readTargetRect() {
      const el = document.querySelector(currentStep.selector);
      const rect = el ? el.getBoundingClientRect() : null;
      const normalizedRect =
        rect && rect.width > 0 && rect.height > 0 ? rect : null;

      setTargetRect((prev) =>
        isSameRect(prev, normalizedRect) ? prev : normalizedRect,
      );

      return normalizedRect;
    }

    function seekTargetUntilFound() {
      const rect = readTargetRect();
      if (!rect) {
        animationFrameId = requestAnimationFrame(seekTargetUntilFound);
      }
    }

    function handleLayoutChange() {
      readTargetRect();
    }

    seekTargetUntilFound();
    intervalId = window.setInterval(readTargetRect, 250);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [step, currentStep.selector]);

  useEffect(() => {
    function updatePanelHeight() {
      const nextHeight = panelRef.current?.getBoundingClientRect().height ?? 0;
      setPanelHeight(nextHeight);
    }

    updatePanelHeight();
    window.addEventListener("resize", updatePanelHeight);

    return () => {
      window.removeEventListener("resize", updatePanelHeight);
    };
  }, [step]);

  function handleSkip() {
    localStorage.setItem(HOME_TOUR_SEEN_KEY, "true");
    onClose();
  }

  function handleNext() {
    if (step < HOME_TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  }

  function handlePseudoXpClose() {
    closeXpModal();
    localStorage.setItem(ONBOARDING_STAGE_KEY, ONBOARDING_STAGE.PROFILE_TOUR);
    navigate("/profile", { state: { fromTour: true } });
  }

  const measuredPanelHeight = panelHeight || ESTIMATED_PANEL_HEIGHT;

  // ステップ2・3はアクションボタン付近をスポットライトするため、パネルをターゲットの上に配置
  const panelStyle: React.CSSProperties =
    (step === 1 || step === 2) && targetRect
      ? {
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          top: Math.max(
            PANEL_EDGE_GAP,
            Math.min(
              targetRect.top - measuredPanelHeight - PANEL_SPOTLIGHT_GAP,
              window.innerHeight - measuredPanelHeight - PANEL_EDGE_GAP,
            ),
          ),
        }
      : {
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: PANEL_EDGE_GAP,
        };

  const spotlightRect = targetRect
    ? {
        top: targetRect.top - SPOTLIGHT_PADDING,
        left: targetRect.left - SPOTLIGHT_PADDING,
        width: targetRect.width + SPOTLIGHT_PADDING * 2,
        height: targetRect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="使い方ツアー"
      className="fixed inset-0 z-60"
      style={{
        pointerEvents: isSampleVisitStep && !isShowingXpModal ? "none" : "auto",
      }}
    >
      {spotlightRect ? (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, spotlightRect.top),
              background: "rgba(0, 0, 0, 0.75)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              top: spotlightRect.top,
              left: 0,
              width: Math.max(0, spotlightRect.left),
              height: spotlightRect.height,
              background: "rgba(0, 0, 0, 0.75)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              top: spotlightRect.top,
              left: spotlightRect.left + spotlightRect.width,
              right: 0,
              height: spotlightRect.height,
              background: "rgba(0, 0, 0, 0.75)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              top: spotlightRect.top + spotlightRect.height,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.75)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              top: spotlightRect.top,
              left: spotlightRect.left,
              width: spotlightRect.width,
              height: spotlightRect.height,
              borderRadius: 16,
              boxShadow: "inset 0 0 0 1px rgba(82, 91, 187, 0.35)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/75" aria-hidden="true" />
      )}

      {!isShowingXpModal && (
        <div
          ref={panelRef}
          className="z-10"
          style={{
            ...panelStyle,
            width: `calc(100vw - ${PANEL_SIDE_MARGIN * 2}px)`,
            maxWidth: "20rem",
            pointerEvents: "auto",
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
              className={`py-2.5 rounded-full text-sm text-gray-400 border border-gray-600 bg-black hover:text-gray-300 transition-colors ${
                isSampleVisitStep ? "w-full" : "flex-1"
              }`}
            >
              スキップ
            </button>
            {!isSampleVisitStep && (
              <button
                onClick={handleNext}
                className="flex-1 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95"
                style={{ background: "#525BBB", color: "#fff" }}
              >
                次へ
              </button>
            )}
          </div>
        </div>
      )}

      {/* 疑似XP演出（実訪問APIは呼び出さない） */}
      {isShowingXpModal && (
        <XpModal
          xpEarned={pseudoXpData.xpEarned}
          totalXp={pseudoXpData.totalXp}
          currentLevel={pseudoXpData.currentLevel}
          isLevelUp={pseudoXpData.isLevelUp}
          newLevel={pseudoXpData.newLevel}
          xpBreakdown={pseudoXpData.xpBreakdown}
          onClose={handlePseudoXpClose}
        />
      )}
    </div>
  );
}
