import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createVisit } from "~/api/visits";
import {
  sendBadgeEarned,
  sendDailyCompleted,
  sendFirstValueMilestone,
  sendLevelUp,
  sendVisitRecorded,
  sendWeeklyReactivation,
} from "~/lib/gtag";
import { ApiError, toUserMessage } from "~/utils/error";
import type {
  BadgeInfo,
  CreateVisitResponse,
  XPBreakdown,
} from "~/types/visit";
import type { PlaceWithPhoto } from "~/hooks/use-suggestion-load";

export interface XpModalState {
  xpEarned: number;
  totalXp: number;
  currentLevel: number;
  isLevelUp: boolean;
  newLevel: number;
  newBadges: BadgeInfo[];
  xpBreakdown?: XPBreakdown;
}

interface UseCheckInOptions {
  authToken: string;
  userPos: { lat: number; lng: number };
  places: PlaceWithPhoto[];
  setPlaces: Dispatch<SetStateAction<PlaceWithPhoto[]>>;
  setIsCompleted: Dispatch<SetStateAction<boolean>>;
  onErrorToast: (message: string) => void;
}

export function useCheckIn({
  authToken,
  userPos,
  places,
  setPlaces,
  setIsCompleted,
  onErrorToast,
}: UseCheckInOptions) {
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [xpModalState, setXpModalState] = useState<XpModalState | null>(null);
  const [badgeModalQueue, setBadgeModalQueue] = useState<BadgeInfo[]>([]);

  const enqueueBadgeModalQueue = useCallback((badges: BadgeInfo[]) => {
    if (badges.length === 0) return;
    setBadgeModalQueue((prev) => [...prev, ...badges]);
  }, []);

  const handleCheckIn = useCallback(async () => {
    const place = places[0];
    if (!place || isCheckingIn) return;

    setIsCheckingIn(true);
    try {
      const category = place.display_type;

      const result: CreateVisitResponse = await createVisit(authToken, {
        place_id: place.place_id,
        place_name: place.name,
        vicinity: place.vicinity,
        category,
        lat: place.lat,
        lng: place.lng,
        photo_reference: place.photo_reference,
        visited_at: new Date().toISOString(),
        user_lat: userPos.lat,
        user_lng: userPos.lng,
      });

      setPlaces((prev) => prev.filter((p) => p.place_id !== place.place_id));
      setVisitedIds((prev) => new Set(prev).add(place.place_id));

      if (result.is_daily_completed) {
        setIsCompleted(true);
        sendDailyCompleted();

        if (localStorage.getItem("first_daily_completed_sent") !== "true") {
          sendFirstValueMilestone({ milestone: "first_daily_completed" });
          localStorage.setItem("first_daily_completed_sent", "true");
        }
      }

      sendVisitRecorded({
        placeName: place.name,
        category,
        isBreakout: !!place.is_breakout,
        xpEarned: result.xp_earned,
        xpBase: result.xp_breakdown?.base_xp,
        firstAreaBonus: result.xp_breakdown?.first_area_bonus,
        streakBonus: result.xp_breakdown?.streak_bonus,
      });

      if (localStorage.getItem("first_visit_recorded_sent") !== "true") {
        sendFirstValueMilestone({ milestone: "first_visit_recorded" });
        localStorage.setItem("first_visit_recorded_sent", "true");
      }

      const streakBonus = result.xp_breakdown?.streak_bonus ?? 0;
      if (streakBonus > 0) {
        sendWeeklyReactivation({
          streakWeeks: Math.max(1, Math.floor(streakBonus / 10)),
        });
      }

      if (result.xp_earned !== undefined) {
        setXpModalState({
          xpEarned: result.xp_earned,
          totalXp: result.total_xp,
          currentLevel: result.new_level,
          isLevelUp: result.is_level_up,
          newLevel: result.new_level,
          newBadges: result.new_badges ?? [],
          xpBreakdown: result.xp_breakdown,
        });

        if (result.is_level_up && result.new_level) {
          sendLevelUp(result.new_level);
        }

        (result.new_badges ?? []).forEach((badge) => {
          sendBadgeEarned(badge.name);
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setIsCompleted(true);
      } else {
        onErrorToast(toUserMessage(err));
      }
    } finally {
      setIsCheckingIn(false);
    }
  }, [
    authToken,
    isCheckingIn,
    onErrorToast,
    places,
    setIsCompleted,
    setPlaces,
    userPos.lat,
    userPos.lng,
  ]);

  const handleXpModalClose = useCallback(() => {
    if (!xpModalState) return;
    enqueueBadgeModalQueue(xpModalState.newBadges);
    setXpModalState(null);
  }, [enqueueBadgeModalQueue, xpModalState]);

  const handleBadgeModalClose = useCallback(() => {
    setBadgeModalQueue((prev) => prev.slice(1));
  }, []);

  return {
    visitedIds,
    isCheckingIn,
    xpModalState,
    badgeModalQueue,
    handleCheckIn,
    handleXpModalClose,
    handleBadgeModalClose,
  };
}
