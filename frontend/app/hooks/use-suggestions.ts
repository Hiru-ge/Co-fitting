import { useState, useEffect, useCallback, useRef } from "react";
import { getSuggestions } from "~/api/suggestions";
import { getPlacePhoto } from "~/api/places";
import { createVisit } from "~/api/visits";
import { getPositionWithFallback } from "~/utils/geolocation";
import { DEFAULT_RADIUS } from "~/utils/constants";
import { getBestCategoryKey } from "~/utils/category-map";
import { ApiError, API_ERROR_CODES, SUGGESTION_MESSAGES, toUserMessage } from "~/utils/error";
import { useToast } from "~/components/toast";
import type { Place } from "~/types/suggestion";
import type { BadgeInfo, CreateVisitResponse, XPBreakdown } from "~/types/visit";

export type PlaceWithPhoto = Place & { photoUrl?: string };

export interface XpModalState {
  xpEarned: number;
  totalXp: number;
  currentLevel: number;
  levelUp: boolean;
  newLevel: number;
  newBadges: BadgeInfo[];
  xpBreakdown?: XPBreakdown;
}

const COMPLETED_KEY = "roamble_completed";

/**
 * 今日の日付キー（JST）でコンプリートフラグをlocalStorageに保存する。
 * 日付キーが一致する間は有効で、日付が変わると無効になる。
 * localStorageを使用することでタブを閉じても当日中は状態が維持される。
 */
function getTodayKey(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jst = new Date(now.getTime() + (jstOffset + now.getTimezoneOffset()) * 60000);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, "0")}-${String(jst.getDate()).padStart(2, "0")}`;
}

function isCompletedToday(): boolean {
  try {
    const saved = localStorage.getItem(COMPLETED_KEY);
    return saved === getTodayKey();
  } catch {
    return false;
  }
}

function markCompletedToday(): void {
  try {
    localStorage.setItem(COMPLETED_KEY, getTodayKey());
  } catch {
    // localStorage使用不可の環境では無視
  }
}

export function useSuggestions(token: string) {
  const { showToast } = useToast();
  const [places, setPlaces] = useState<PlaceWithPhoto[]>([]);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const completedFromStorage = isCompletedToday();
  const [isLoading, setIsLoading] = useState(!completedFromStorage);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(completedFromStorage);
  const [checkingIn, setCheckingIn] = useState(false);
  const [userPos, setUserPos] = useState({ lat: 0, lng: 0 });
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [xpModalState, setXpModalState] = useState<XpModalState | null>(null);
  const [badgeQueue, setBadgeQueue] = useState<BadgeInfo[]>([]);
  const [reloadCountRemaining, setReloadCountRemaining] = useState(3);
  const [isReloading, setIsReloading] = useState(false);
  const initialLoadDoneRef = useRef(false);

  const loadSuggestions = useCallback(async (forceReload?: boolean) => {
    if (forceReload) {
      setIsReloading(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    setIsCompleted(false);
    try {
      const pos = await getPositionWithFallback();
      setUserPos(pos);

      const { places: collected, notice, completed, reload_count_remaining } = await getSuggestions(token, pos.lat, pos.lng, DEFAULT_RADIUS, forceReload);

      if (reload_count_remaining !== undefined) {
        setReloadCountRemaining(reload_count_remaining);
      }

      if (completed) {
        if (notice === API_ERROR_CODES.ALL_VISITED_NEARBY) {
          setError(SUGGESTION_MESSAGES.ALL_VISITED_NEARBY);
        } else {
          setIsCompleted(true);
          markCompletedToday();
        }
        return;
      }

      if (notice === API_ERROR_CODES.NO_INTEREST_PLACES) {
        showToast(SUGGESTION_MESSAGES.NO_INTEREST_PLACES, "info");
      }

      if (collected.length === 0) {
        setError("近くのスポットが見つかりませんでした");
      } else {
        const placesWithPhotos: PlaceWithPhoto[] = await Promise.all(
          collected.map(async (place) => {
            if (!place.photo_reference) return place;
            try {
              const photoUrl = await getPlacePhoto(token, place.place_id, place.photo_reference);
              return { ...place, photoUrl };
            } catch {
              return place;
            }
          })
        );
        setPlaces(placesWithPhotos);
        setOriginalOrder(placesWithPhotos.map((p) => p.place_id));
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === API_ERROR_CODES.NO_NEARBY_PLACES) {
        setError(SUGGESTION_MESSAGES.NO_NEARBY_PLACES);
      } else if (err instanceof ApiError && err.code === API_ERROR_CODES.RELOAD_LIMIT_REACHED) {
        setReloadCountRemaining(0);
        showToast(err.message, "info");
      } else {
        setError(SUGGESTION_MESSAGES.FETCH_ERROR);
        showToast(toUserMessage(err));
      }
    } finally {
      setIsLoading(false);
      setIsReloading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    // localStorageからコンプリート済みと判定された場合はAPIを呼ばない
    if (completedFromStorage) return;
    loadSuggestions();
  }, [loadSuggestions, completedFromStorage]);

  function handleReload() {
    loadSuggestions(true);
  }

  function handleSwipe() {
    if (places.length <= 1) return;
    setPlaces((prev) => [...prev.slice(1), prev[0]]);
  }

  async function handleCheckIn() {
    const place = places[0];
    if (!place || checkingIn) return;

    setCheckingIn(true);
    try {
      const category = getBestCategoryKey(place.types ?? []);

      const result: CreateVisitResponse = await createVisit(token, {
        place_id: place.place_id,
        place_name: place.name,
        vicinity: place.vicinity,
        category: category,
        lat: place.lat,
        lng: place.lng,
        place_types: place.types,
        visited_at: new Date().toISOString(),
      });

      const remainingPlaces = places.filter((p) => p.place_id !== place.place_id);
      setPlaces(remainingPlaces);
      setVisitedIds((prev) => new Set(prev).add(place.place_id));

      // バックエンドの訪問履歴件数に基づくコンプリート判定（フロントのカード枚数ではなくサーバー側の事実を信頼）
      // これによりリロードを挟んだ場合でも正確にコンプリートを検出できる
      if (result.daily_completed) {
        setIsCompleted(true);
        markCompletedToday();
      }

      if (result.xp_earned !== undefined) {
        setXpModalState({
          xpEarned: result.xp_earned,
          totalXp: result.total_xp ?? 0,
          currentLevel: result.new_level ?? 1,
          levelUp: result.level_up ?? false,
          newLevel: result.new_level ?? 1,
          newBadges: result.new_badges ?? [],
          xpBreakdown: result.xp_breakdown,
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // 429は「すでに本日の上限を訪問済み」を示す。UIのみコンプリート状態に復元する。
        // markCompletedTodayは3件目の訪問成功時（remainingPlaces.length === 0）に呼ぶため、ここでは呼ばない。
        setIsCompleted(true);
      } else {
        showToast(toUserMessage(err));
      }
    } finally {
      setCheckingIn(false);
    }
  }

  function handleXpModalClose() {
    if (!xpModalState) return;
    const allBadges = xpModalState.newBadges;
    setXpModalState(null);
    if (allBadges.length > 0) {
      setBadgeQueue((prev) => [...prev, ...allBadges]);
    }
  }

  function handleBadgeModalClose() {
    setBadgeQueue((prev) => prev.slice(1));
  }

  const currentPlace = places[0];
  const isCurrentVisited = currentPlace ? visitedIds.has(currentPlace.place_id) : false;
  const currentIndex = currentPlace ? originalOrder.indexOf(currentPlace.place_id) : 0;

  return {
    places,
    isLoading,
    error,
    isCompleted,
    checkingIn,
    userPos,
    visitedIds,
    xpModalState,
    badgeQueue,
    reloadCountRemaining,
    isReloading,
    currentPlace,
    isCurrentVisited,
    currentIndex,
    loadSuggestions,
    handleReload,
    handleSwipe,
    handleCheckIn,
    handleXpModalClose,
    handleBadgeModalClose,
  };
}
