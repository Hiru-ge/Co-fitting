import { useEffect, useRef } from "react";
import type { Route } from "./+types/home";
import { redirect } from "react-router";
import { protectedLoader } from "~/lib/protected-loader";
import { getInterests } from "~/api/genres";
import { ONBOARDING_SKIPPED_KEY } from "~/utils/constants";
import { useSuggestions } from "~/hooks/use-suggestions";
import { sendSuggestionViewed } from "~/lib/gtag";
import { getBestCategoryKey } from "~/utils/category-map";
import AppHeader from "~/components/app-header";
import DiscoveryCard from "~/components/discovery-card";
import CardIndicator from "~/components/card-indicator";
import ActionButtons from "~/components/action-buttons";
import XpModal from "~/components/xp-modal";
import BadgeModal from "~/components/badge-modal";
import CompleteCard from "~/components/complete-card";

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const { user, token } = await protectedLoader();
  const interests = await getInterests(token);
  const onboardingSkipped = localStorage.getItem(ONBOARDING_SKIPPED_KEY) === "true";
  if (interests.length < 3 && !onboardingSkipped) throw redirect("/onboarding");
  return { user, token };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;
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
    currentPlace,
    isCurrentVisited,
    currentIndex,
    loadSuggestions,
    handleReload,
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
      isComfortZone: !!currentPlace.is_comfort_zone,
      cardIndex: 0,
    });
  }, [currentPlace]);

  function getTruncatedLocationLabel(vicinity: string) {
    const MAX_LENGTH = 12;
    if (vicinity.length <= MAX_LENGTH) return vicinity;
    return vicinity.slice(0, MAX_LENGTH - 3) + "...";
  }

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
              onClick={() => loadSuggestions()}
              className="px-6 py-2 bg-primary text-white rounded-full font-bold"
            >
              再試行
            </button>
          </div>
        </>
      ) : (
        <>
          <AppHeader locationLabel={getTruncatedLocationLabel(currentPlace!.vicinity)} />

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
                    onSwipe={i === 0 ? handleSwipe : undefined}
                  />
                ))}
              </div>
            )}

            {places.length > 1 && (
              <CardIndicator total={places.length} currentIndex={currentIndex} />
            )}

            <ActionButtons
              onCheckIn={handleCheckIn}
              onReload={handleReload}
              isVisited={isCurrentVisited}
              isCheckingIn={checkingIn}
              reloadCountRemaining={reloadCountRemaining}
              isReloading={isReloading}
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
          xpBreakdown={xpModalState.xpBreakdown}
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
