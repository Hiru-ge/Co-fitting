import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { getSuggestions } from "~/api/suggestions";
import { getPlacePhoto } from "~/api/places";
import { createVisit } from "~/api/visits";
import {
  getCurrentPosition,
  startPositionPolling,
  isWithinCheckInRange,
} from "~/utils/geolocation";
import { DEFAULT_LOCATION, DEFAULT_RADIUS } from "~/utils/constants";
import { getBestCategoryKey } from "~/utils/category-map";
import {
  ApiError,
  API_ERROR_CODES,
  SUGGESTION_MESSAGES,
  toUserMessage,
} from "~/utils/error";
import { useToast } from "~/components/toast";
import {
  sendSuggestionGenerated,
  sendSuggestionViewed,
  sendSuggestionSkipped,
  sendSuggestionReloaded,
  sendVisitRecorded,
  sendDailyCompleted,
  sendBadgeEarned,
  sendLevelUp,
} from "~/lib/gtag";
import type { Place } from "~/types/suggestion";
import type {
  BadgeInfo,
  CreateVisitResponse,
  XPBreakdown,
} from "~/types/visit";

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

export function useSuggestions(token: string) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [places, setPlaces] = useState<PlaceWithPhoto[]>([]);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  // userPos はキャッシュせず毎回現在地を取得する（距離表示を正確に保つため）
  const [userPos, setUserPos] = useState({ lat: 0, lng: 0 });
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [xpModalState, setXpModalState] = useState<XpModalState | null>(null);
  const [badgeQueue, setBadgeQueue] = useState<BadgeInfo[]>([]);
  const [reloadCountRemaining, setReloadCountRemaining] = useState(3);
  const [isReloading, setIsReloading] = useState(false);
  const [showLocationDeniedModal, setShowLocationDeniedModal] = useState(false);
  const [isUsingDefaultLocation, setIsUsingDefaultLocation] = useState(false);
  const initialLoadDoneRef = useRef(false);
  // 位置情報拒否・タイムアウト時にデフォルト位置を使うかどうかのフラグ（Refで保持し再レンダーの影響を受けない）
  const useDefaultLocationRef = useRef(false);

  // === Issue #262: 施設カード表示中のみ位置を継続監視し、訪問ボタンの距離判定をリアルタイム更新する ===
  const hasCards = places.length > 0;
  useEffect(() => {
    if (!hasCards) return;

    const intervalId = startPositionPolling(setUserPos);
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [hasCards]);

  const loadSuggestions = useCallback(
    async (isReload?: boolean) => {
      if (isReload) {
        setIsReloading(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      setIsCompleted(false);
      try {
        let pos = { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };
        if (!useDefaultLocationRef.current) {
          try {
            pos = await getCurrentPosition();
          } catch (locErr) {
            // GeolocationPositionError.PERMISSION_DENIED = 1
            const isDenied = (locErr as { code?: number } | null)?.code === 1;
            if (isDenied) {
              setShowLocationDeniedModal(true);
              setIsLoading(false);
              setIsReloading(false);
              return;
            }
            // タイムアウト等の非拒否エラー: デフォルト位置を使用
            useDefaultLocationRef.current = true;
            setIsUsingDefaultLocation(true);
          }
        }
        setUserPos(pos);

        const {
          places: collected,
          notice,
          completed,
          reload_count_remaining,
        } = await getSuggestions(
          token,
          pos.lat,
          pos.lng,
          DEFAULT_RADIUS,
          isReload,
        );

        if (reload_count_remaining !== undefined) {
          setReloadCountRemaining(reload_count_remaining);
        }

        if (completed) {
          if (notice === API_ERROR_CODES.ALL_VISITED_NEARBY) {
            setError(SUGGESTION_MESSAGES.ALL_VISITED_NEARBY);
          } else {
            setIsCompleted(true);
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
                const photoUrl = await getPlacePhoto(
                  token,
                  place.place_id,
                  place.photo_reference,
                );
                return { ...place, photoUrl };
              } catch {
                return place;
              }
            }),
          );
          setPlaces(placesWithPhotos);
          setOriginalOrder(placesWithPhotos.map((p) => p.place_id));
          sendSuggestionGenerated({
            placesCount: placesWithPhotos.length,
            interestMatchCount: placesWithPhotos.filter(
              (p) => p.is_interest_match,
            ).length,
            breakoutCount: placesWithPhotos.filter((p) => p.is_breakout).length,
            categories: placesWithPhotos.map((p) =>
              getBestCategoryKey(p.types ?? []),
            ),
            isReload: !!isReload,
          });
        }
      } catch (err) {
        if (
          err instanceof ApiError &&
          err.code === API_ERROR_CODES.NO_NEARBY_PLACES
        ) {
          setError(SUGGESTION_MESSAGES.NO_NEARBY_PLACES);
        } else if (
          err instanceof ApiError &&
          err.code === API_ERROR_CODES.RELOAD_LIMIT_REACHED
        ) {
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
    },
    [token, showToast, navigate],
  );

  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    loadSuggestions();
  }, [loadSuggestions]);

  function handleReload() {
    sendSuggestionReloaded(reloadCountRemaining);
    loadSuggestions(true);
  }

  function handleUseDefaultLocation() {
    useDefaultLocationRef.current = true;
    setShowLocationDeniedModal(false);
    setIsUsingDefaultLocation(true);
    loadSuggestions();
  }

  function handleGoToSettings() {
    setShowLocationDeniedModal(false);
    navigate("/settings");
  }

  function handleSwipe() {
    if (places.length <= 1) return;
    const skipped = places[0];
    if (skipped) {
      sendSuggestionSkipped({
        placeName: skipped.name,
        category: getBestCategoryKey(skipped.types ?? []),
        isInterestMatch: !!skipped.is_interest_match,
        isBreakout: !!skipped.is_breakout,
      });
    }
    setPlaces((prev) => {
      const next = [...prev.slice(1), prev[0]];
      const nextPlace = next[0];
      if (nextPlace) {
        sendSuggestionViewed({
          placeName: nextPlace.name,
          category: getBestCategoryKey(nextPlace.types ?? []),
          isInterestMatch: !!nextPlace.is_interest_match,
          isBreakout: !!nextPlace.is_breakout,
          cardIndex: originalOrder.indexOf(nextPlace.place_id),
        });
      }
      return next;
    });
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
        photo_reference: place.photo_reference,
        place_types: place.types,
        visited_at: new Date().toISOString(),
        user_lat: userPos.lat,
        user_lng: userPos.lng,
      });

      const remainingPlaces = places.filter(
        (p) => p.place_id !== place.place_id,
      );
      setPlaces(remainingPlaces);
      setVisitedIds((prev) => new Set(prev).add(place.place_id));

      // バックエンドの訪問履歴件数に基づくコンプリート判定（フロントのカード枚数ではなくサーバー側の事実を信頼）
      // これによりリロードを挟んだ場合でも正確にコンプリートを検出できる
      if (result.daily_completed) {
        setIsCompleted(true);
        sendDailyCompleted();
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

      if (result.xp_earned !== undefined) {
        setXpModalState({
          xpEarned: result.xp_earned,
          totalXp: result.total_xp,
          currentLevel: result.new_level,
          levelUp: result.level_up,
          newLevel: result.new_level,
          newBadges: result.new_badges,
          xpBreakdown: result.xp_breakdown,
        });

        if (result.level_up && result.new_level) {
          sendLevelUp(result.new_level);
        }

        for (const badge of result.new_badges ?? []) {
          sendBadgeEarned(badge.name);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // 429は「すでに本日の上限を訪問済み」を示す。UIのみコンプリート状態に復元する。
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
  const isCurrentVisited = currentPlace
    ? visitedIds.has(currentPlace.place_id)
    : false;
  const currentIndex = currentPlace
    ? originalOrder.indexOf(currentPlace.place_id)
    : 0;
  // development環境では常に有効化（開発・テストの利便性のため）
  const isNearCurrentPlace =
    import.meta.env.DEV ||
    (currentPlace !== undefined &&
      isWithinCheckInRange(
        userPos.lat,
        userPos.lng,
        currentPlace.lat,
        currentPlace.lng,
      ));

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
    showLocationDeniedModal,
    isUsingDefaultLocation,
    currentPlace,
    isCurrentVisited,
    currentIndex,
    isNearCurrentPlace,
    loadSuggestions,
    handleReload,
    handleUseDefaultLocation,
    handleGoToSettings,
    handleSwipe,
    handleCheckIn,
    handleXpModalClose,
    handleBadgeModalClose,
  };
}
