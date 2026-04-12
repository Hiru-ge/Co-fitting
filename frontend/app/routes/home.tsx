import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/home";
import { redirect } from "react-router";
import { getToken } from "~/lib/auth";
import { getInterests } from "~/api/users";
import { ONBOARDING_SKIPPED_KEY, HOME_TOUR_SEEN_KEY } from "~/utils/constants";
import { useSuggestions } from "~/hooks/use-suggestions";
import { sendSuggestionViewed } from "~/lib/gtag";
import { getBestCategoryKey } from "~/lib/category-map";
import AppHeader from "~/components/AppHeader";
import DiscoveryCard from "~/components/DiscoveryCard";
import CardIndicator from "~/components/CardIndicator";
import ActionButtons from "~/components/ActionButtons";
import XpModal from "~/components/XpModal";
import BadgeModal from "~/components/BadgeModal";
import CompleteCard from "~/components/CompleteCard";
import HomeTourModal from "~/components/HomeTourModal";
import LocationPermissionModal from "~/components/LocationPermissionModal";
import PushNotificationBanner from "~/components/PushNotificationBanner";

export async function clientLoader() {
  const token = getToken();
  if (!token) throw redirect("/login");

  let interests: Awaited<ReturnType<typeof getInterests>>;
  try {
    interests = await getInterests(token);
  } catch {
    throw redirect("/login");
  }

  const onboardingSkipped =
    localStorage.getItem(ONBOARDING_SKIPPED_KEY) === "true";
  if (interests.length < 3 && !onboardingSkipped) throw redirect("/onboarding");
  return { token };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;
  const [showTour, setShowTour] = useState(
    () => localStorage.getItem(HOME_TOUR_SEEN_KEY) === null,
  );
  const {
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
  } = useSuggestions(token);

  const firstViewSentRef = useRef(false);
  useEffect(() => {
    if (firstViewSentRef.current || !currentPlace) return;
    firstViewSentRef.current = true;
    sendSuggestionViewed({
      placeName: currentPlace.name,
      category: getBestCategoryKey(currentPlace.types ?? []),
      isInterestMatch: !!currentPlace.is_interest_match,
      isBreakout: !!currentPlace.is_breakout,
      cardIndex: 0,
    });
  }, [currentPlace]);

  function getTruncatedLocationLabel(vicinity: string) {
    const MAX_LENGTH = 12;
    if (vicinity.length <= MAX_LENGTH) return vicinity;
    return vicinity.slice(0, MAX_LENGTH - 3) + "...";
  }

  return (
    <div className="h-dvh bg-background flex flex-col">
      {isLoading ? (
        <>
          <AppHeader />
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full aspect-3/5 rounded-3xl bg-gray-800 animate-pulse" />
          </div>
        </>
      ) : isCompleted ? (
        <>
          <AppHeader />
          <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 pb-20 pt-4 overflow-hidden">
            <div className="flex-1 min-h-0 relative w-full">
              <CompleteCard />
            </div>
          </main>
        </>
      ) : error || places.length === 0 ? (
        <>
          <AppHeader />
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <span className="material-symbols-outlined text-6xl text-gray-400">
              explore_off
            </span>
            <p className="text-gray-500 text-center">
              {error || "近くのスポットが見つかりませんでした"}
            </p>
            <button
              onClick={() => loadSuggestions()}
              className="px-6 py-2 bg-primary text-white rounded-3xl font-bold"
            >
              再試行
            </button>
          </div>
        </>
      ) : (
        <>
          <AppHeader
            locationLabel={getTruncatedLocationLabel(currentPlace!.vicinity)}
            isDefaultLocation={isUsingDefaultLocation}
          />

          <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 pb-20 pt-4 overflow-hidden">
            {places.length > 0 && (
              <div
                data-tour="discovery-cards"
                className="flex-1 min-h-0 relative w-full"
              >
                {places.slice(0, 3).map((place, i) => (
                  <DiscoveryCard
                    key={place.place_id}
                    place={place}
                    isVisited={visitedIds.has(place.place_id)}
                    userLat={userPos.lat}
                    userLng={userPos.lng}
                    photoUrl={place.photoUrl}
                    stackIndex={i}
                    onSwipe={i === 0 ? handleSwipe : undefined}
                  />
                ))}

                {/* アクションボタンをカード下部にオーバーレイ */}
                <div
                  data-tour="action-buttons"
                  className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4"
                >
                  <ActionButtons
                    onCheckIn={handleCheckIn}
                    onReload={handleReload}
                    isVisited={isCurrentVisited}
                    isCheckingIn={checkingIn}
                    reloadCountRemaining={reloadCountRemaining}
                    isReloading={isReloading}
                    isNearPlace={isNearCurrentPlace}
                  />
                </div>
              </div>
            )}

            {/* カードインジケーターはカードの外 */}
            {places.length > 1 && (
              <div className="mt-2">
                <CardIndicator
                  total={places.length}
                  currentIndex={currentIndex}
                />
              </div>
            )}
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
          xpBreakdown={xpModalState.xpBreakdown}
          onClose={handleXpModalClose}
        />
      )}

      {/* バッジ獲得モーダル: 同上 */}
      {badgeQueue.length > 0 && (
        <BadgeModal badge={badgeQueue[0]} onClose={handleBadgeModalClose} />
      )}

      {/* チュートリアルツアーモーダル: 初回のみ表示 */}
      {showTour && <HomeTourModal onClose={() => setShowTour(false)} />}

      {/* 位置情報拒否時モーダル */}
      {showLocationDeniedModal && (
        <LocationPermissionModal
          onUseDefault={handleUseDefaultLocation}
          onGoToSettings={handleGoToSettings}
        />
      )}

      {/* Push通知許可バナー */}
      <PushNotificationBanner token={token} />
    </div>
  );
}
