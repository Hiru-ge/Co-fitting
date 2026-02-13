import { useState, useEffect, useCallback } from "react";
import type { Route } from "./+types/home";
import { redirect } from "react-router";
import { getToken, getUser } from "~/lib/auth";
import { getSuggestion } from "~/api/suggestions";
import { createVisit } from "~/api/visits";
import { getPositionWithFallback } from "~/utils/geolocation";
import { DEFAULT_RADIUS } from "~/utils/constants";
import type { Place } from "~/types/suggestion";
import AppHeader from "~/components/app-header";
import DiscoveryCard from "~/components/discovery-card";
import CardIndicator from "~/components/card-indicator";
import ActionButtons from "~/components/action-buttons";

const CARD_COUNT = 3;
const MAX_ATTEMPTS = 10;

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const user = await getUser(token);
  return { user, token };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;
  const [places, setPlaces] = useState<Place[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [userPos, setUserPos] = useState({ lat: 0, lng: 0 });

  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pos = await getPositionWithFallback();
      setUserPos(pos);

      const collected: Place[] = [];
      const seenIds = new Set<string>();
      let attempts = 0;

      while (collected.length < CARD_COUNT && attempts < MAX_ATTEMPTS) {
        attempts++;
        try {
          const place = await getSuggestion(token, pos.lat, pos.lng, DEFAULT_RADIUS);
          if (!seenIds.has(place.place_id)) {
            seenIds.add(place.place_id);
            collected.push(place);
          }
        } catch {
          // 個別の取得失敗はスキップ
        }
      }

      if (collected.length === 0) {
        setError("近くのスポットが見つかりませんでした");
      } else {
        setPlaces(collected);
        setCurrentIndex(0);
      }
    } catch {
      setError("スポットの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  function handleSkip() {
    if (places.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % places.length);
  }

  async function handleCheckIn() {
    const place = places[currentIndex];
    if (!place || visitedIds.has(place.place_id) || checkingIn) return;

    setCheckingIn(true);
    try {
      await createVisit(token, {
        place_id: place.place_id,
        place_name: place.name,
        lat: place.lat,
        lng: place.lng,
        visited_at: new Date().toISOString(),
      });
      setVisitedIds((prev) => new Set(prev).add(place.place_id));
    } catch {
      // エラー時は何もしない（UIは変化しない）
    } finally {
      setCheckingIn(false);
    }
  }


  // 場所が長すぎる場合は省略して表示
  function getTruncatedLocationLabel(vicinity: string) {
    const MAX_LENGTH = 20;
    if (vicinity.length <= MAX_LENGTH) return vicinity;
    return vicinity.slice(0, MAX_LENGTH - 3) + "...";
  }

  const currentPlace = places[currentIndex];
  const isCurrentVisited = currentPlace ? visitedIds.has(currentPlace.place_id) : false;

  if (isLoading) {
    return (
      <div className="min-h-max bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full aspect-[3/4] rounded-3xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-max bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <span className="material-symbols-outlined text-6xl text-gray-400">explore_off</span>
          <p className="text-gray-500 text-center">{error}</p>
          <button
            onClick={loadSuggestions}
            className="px-6 py-2 bg-primary text-white rounded-full font-bold"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-max bg-background flex flex-col">
      <AppHeader locationLabel={getTruncatedLocationLabel(currentPlace.vicinity)} />

      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 pb-6 pt-4">
        {currentPlace && (
          <DiscoveryCard
            place={currentPlace}
            isVisited={isCurrentVisited}
            userLat={userPos.lat}
            userLng={userPos.lng}
            onSwipe={handleSkip}
          />
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
    </div>
  );
}
