import { useState } from "react";
import type { XPBreakdown } from "~/types/visit";

interface PseudoXpData {
  xpEarned: number;
  totalXp: number;
  currentLevel: number;
  isLevelUp: boolean;
  newLevel: number;
  xpBreakdown: XPBreakdown;
}

const PSEUDO_XP_DATA: PseudoXpData = {
  xpEarned: 50,
  totalXp: 50,
  currentLevel: 1,
  isLevelUp: false,
  newLevel: 1,
  xpBreakdown: { base_xp: 50, first_area_bonus: 0, streak_bonus: 0 },
};

export function useSampleVisit() {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isShowingXpModal, setIsShowingXpModal] = useState(false);

  function completeSampleVisit() {
    setIsCompleted(true);
    setIsShowingXpModal(true);
  }

  function closeXpModal() {
    setIsShowingXpModal(false);
  }

  return {
    isCompleted,
    isShowingXpModal,
    pseudoXpData: PSEUDO_XP_DATA,
    completeSampleVisit,
    closeXpModal,
  };
}
