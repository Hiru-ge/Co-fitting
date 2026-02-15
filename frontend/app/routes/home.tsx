import { useState, useEffect, useCallback } from "react";
import type { Route } from "./+types/home";
import { redirect } from "react-router";
import { getToken, getUser } from "~/lib/auth";
import { getSuggestions } from "~/api/suggestions";
import { getPlacePhoto } from "~/api/places";
import { createVisit } from "~/api/visits";
import { getPositionWithFallback } from "~/utils/geolocation";
import { DEFAULT_RADIUS } from "~/utils/constants";
import { toUserMessage } from "~/utils/error";
import { useToast } from "~/components/toast";
import type { Place } from "~/types/suggestion";
import AppHeader from "~/components/app-header";
import DiscoveryCard from "~/components/discovery-card";
import CardIndicator from "~/components/card-indicator";
import ActionButtons from "~/components/action-buttons";

type PlaceWithPhoto = Place & { photoUrl?: string };

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const user = await getUser(token);
  return { user, token };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;
  const { showToast } = useToast();
  const [places, setPlaces] = useState<PlaceWithPhoto[]>([]);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [userPos, setUserPos] = useState({ lat: 0, lng: 0 });
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);

  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pos = await getPositionWithFallback();
      setUserPos(pos);

      // バックエンドの日次キャッシュにより、1回の呼び出しで最大3件取得
      const collected = await getSuggestions(token, pos.lat, pos.lng, DEFAULT_RADIUS);

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
      setError("スポットの取得に失敗しました");
      showToast(toUserMessage(err));
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
      
      await createVisit(token, {
        place_id: place.place_id,
        place_name: place.name,
        vicinity: place.vicinity,
        category: category,
        lat: place.lat,
        lng: place.lng,
        visited_at: new Date().toISOString(),
      });

      // 訪問済みカードを即座にリストから削除
      setPlaces((prev) => prev.filter((p) => p.place_id !== place.place_id));
      setVisitedIds((prev) => new Set(prev).add(place.place_id));
    } catch (err) {
      showToast(toUserMessage(err));
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

  const currentPlace = places[0];
  const isCurrentVisited = currentPlace ? visitedIds.has(currentPlace.place_id) : false;
  const currentIndex = currentPlace
    ? originalOrder.indexOf(currentPlace.place_id)
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-max bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full aspect-[3/5] rounded-3xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || places.length === 0) {
    return (
      <div className="min-h-max bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <span className="material-symbols-outlined text-6xl text-gray-400">explore_off</span>
          <p className="text-gray-500 text-center">{error || "近くのスポットが見つかりませんでした。または、今日の3件をコンプリートしています"}</p>
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

      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 pb-6 pt-4 overflow-hidden">
        {places.length > 0 && (
          <div className="relative w-full aspect-[3/5]">
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
    </div>
  );
}
