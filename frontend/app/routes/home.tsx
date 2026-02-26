import { useState, useEffect, useCallback } from "react";
import type { Route } from "./+types/home";
import { redirect } from "react-router";
import { getToken, getUser } from "~/lib/auth";
import { getInterests } from "~/api/genres";
import { getSuggestions } from "~/api/suggestions";
import { getPlacePhoto } from "~/api/places";
import { createVisit } from "~/api/visits";
import { getPositionWithFallback } from "~/utils/geolocation";
import { DEFAULT_RADIUS, ONBOARDING_SKIPPED_KEY } from "~/utils/constants";
import { ApiError, API_ERROR_CODES, SUGGESTION_MESSAGES, toUserMessage } from "~/utils/error";
import { useToast } from "~/components/toast";
import type { Place } from "~/types/suggestion";
import type { BadgeInfo, CreateVisitResponse } from "~/types/visit";
import AppHeader from "~/components/app-header";
import DiscoveryCard from "~/components/discovery-card";
import CardIndicator from "~/components/card-indicator";
import ActionButtons from "~/components/action-buttons";
import XpModal from "~/components/xp-modal";
import BadgeModal from "~/components/badge-modal";
import CompleteCard from "~/components/complete-card";

type PlaceWithPhoto = Place & { photoUrl?: string };

interface XpModalState {
  xpEarned: number;
  totalXp: number;
  currentLevel: number;
  levelUp: boolean;
  newLevel: number;
  newBadges: BadgeInfo[];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const [user, interests] = await Promise.all([
    getUser(token),
    getInterests(token),
  ]);
  const onboardingSkipped = localStorage.getItem(ONBOARDING_SKIPPED_KEY) === "true";
  if (interests.length < 3 && !onboardingSkipped) throw redirect("/onboarding");
  return { user, token };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;
  const { showToast } = useToast();
  const [places, setPlaces] = useState<PlaceWithPhoto[]>([]);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [userPos, setUserPos] = useState({ lat: 0, lng: 0 });
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [xpModalState, setXpModalState] = useState<XpModalState | null>(null);
  const [badgeQueue, setBadgeQueue] = useState<BadgeInfo[]>([]);

  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsCompleted(false);
    try {
      const pos = await getPositionWithFallback();
      setUserPos(pos);

      // バックエンドの日次キャッシュにより、1回の呼び出しで最大3件取得
      const { places: collected, notice } = await getSuggestions(token, pos.lat, pos.lng, DEFAULT_RADIUS);

      // 興味タグに合致する施設が半径内になかった場合、infoトーストで通知
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
      if (err instanceof ApiError && err.code === API_ERROR_CODES.DAILY_LIMIT_REACHED) {
        setIsCompleted(true);
      } else if (err instanceof ApiError && err.code === API_ERROR_CODES.NO_NEARBY_PLACES) {
        setError(SUGGESTION_MESSAGES.NO_NEARBY_PLACES);
      } else {
        setError(SUGGESTION_MESSAGES.FETCH_ERROR);
        showToast(toUserMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  function handleSkip() {
    if (places.length <= 1) return;
    setPlaces((prev) => [...prev.slice(1), prev[0]]);
  }

  async function handleCheckIn() {
    const place = places[0];
    if (!place || checkingIn) return;

    setCheckingIn(true);
    try {
      // types 配列から最初のカテゴリを取得（例: "cafe", "park"等）
      const category = place.types && place.types.length > 0 ? place.types[0] : "other";

      const result: CreateVisitResponse = await createVisit(token, {
        place_id: place.place_id,
        place_name: place.name,
        vicinity: place.vicinity,
        category: category,
        lat: place.lat,
        lng: place.lng,
        visited_at: new Date().toISOString(),
      });

      // 訪問済みカードを即座にリストから削除
      const remainingPlaces = places.filter((p) => p.place_id !== place.place_id);
      setPlaces(remainingPlaces);
      setVisitedIds((prev) => new Set(prev).add(place.place_id));

      // 全件訪問完了したらコンプリート状態へ
      if (remainingPlaces.length === 0) {
        setIsCompleted(true);
      }

      // ゲーミフィケーションデータがある場合はXPモーダルを表示
      if (result.xp_earned !== undefined) {
        setXpModalState({
          xpEarned: result.xp_earned,
          totalXp: result.total_xp ?? 0,
          currentLevel: result.new_level ?? 1,
          levelUp: result.level_up ?? false,
          newLevel: result.new_level ?? 1,
          newBadges: result.new_badges ?? [],
        });
      }
    } catch (err) {
      showToast(toUserMessage(err));
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


  // 場所が長すぎる場合は省略して表示
  function getTruncatedLocationLabel(vicinity: string) {
    const MAX_LENGTH = 12;
    if (vicinity.length <= MAX_LENGTH) return vicinity;
    return vicinity.slice(0, MAX_LENGTH - 3) + "...";
  }

  const currentPlace = places[0];
  const isCurrentVisited = currentPlace ? visitedIds.has(currentPlace.place_id) : false;
  const currentIndex = currentPlace
    ? originalOrder.indexOf(currentPlace.place_id)
    : 0;

  return (
    <div className="bg-background flex flex-col">
      {isLoading ? (
        <>
          <AppHeader />
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full aspect-3/5 rounded-3xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          </div>
        </>
      ) : isCompleted ? (
        <>
          <AppHeader />
          <CompleteCard />
        </>
      ) : (error || places.length === 0) ? (
        <>
          <AppHeader />
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <span className="material-symbols-outlined text-6xl text-gray-400">explore_off</span>
            <p className="text-gray-500 text-center">{error || "近くのスポットが見つかりませんでした"}</p>
            <button
              onClick={loadSuggestions}
              className="px-6 py-2 bg-primary text-white rounded-full font-bold"
            >
              再試行
            </button>
          </div>
        </>
      ) : (
        <>
          <AppHeader locationLabel={getTruncatedLocationLabel(currentPlace.vicinity)} />

          <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 pb-6 pt-4 overflow-hidden">
            {places.length > 0 && (
              <div className="relative w-full aspect-3/5">
                {places.slice(0, 3).map((place, i) => (
                  <DiscoveryCard
                    key={place.place_id}
                    place={place}
                    isVisited={visitedIds.has(place.place_id)}
                    userLat={userPos.lat}
                    userLng={userPos.lng}
                    photoUrl={place.photoUrl}
                    stackIndex={i}
                    onSwipe={handleSkip}
                  />
                ))}
              </div>
            )}

            {places.length > 1 && (
              <CardIndicator total={places.length} currentIndex={currentIndex} />
            )}

            <ActionButtons
              onCheckIn={handleCheckIn}
              onSkip={handleSkip}
              isVisited={isCurrentVisited}
              isCheckingIn={checkingIn}
            />
          </main>
        </>
      )}

      {/* XP獲得モーダル: ローディング・エラー状態でも表示できるよう常にレンダリング対象 */}
      {xpModalState && (
        <XpModal
          xpEarned={xpModalState.xpEarned}
          totalXp={xpModalState.totalXp}
          currentLevel={xpModalState.currentLevel}
          levelUp={xpModalState.levelUp}
          newLevel={xpModalState.newLevel}
          onClose={handleXpModalClose}
        />
      )}

      {/* バッジ獲得モーダル: 同上 */}
      {badgeQueue.length > 0 && (
        <BadgeModal
          badge={badgeQueue[0]}
          onClose={handleBadgeModalClose}
        />
      )}
    </div>
  );
}
