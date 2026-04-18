import { useNavigate } from "react-router";
import { isWithinCheckInRange } from "~/lib/geolocation";
import { pickCategoryFromAPIPlaceTypes } from "~/lib/category-map";
import { useLocation } from "~/hooks/use-location";
import {
  useSuggestionLoad,
  type PlaceWithPhoto,
} from "~/hooks/use-suggestion-load";
import { useCheckIn } from "~/hooks/use-check-in";
import { useSnooze } from "~/hooks/use-snooze";
import { useToast } from "~/components/Toast";
import {
  sendSuggestionViewed,
  sendSuggestionSkipped,
  sendSuggestionSnoozed,
} from "~/lib/gtag";

export function useSuggestions(authToken: string) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation({ enablePolling: true });
  const suggestionLoad = useSuggestionLoad({
    authToken,
    resolveCurrentPosition: location.resolveCurrentPosition,
    showToast,
  });
  const checkIn = useCheckIn({
    authToken,
    userPos: location.userPos,
    places: suggestionLoad.places,
    setPlaces: suggestionLoad.setPlaces,
    setIsCompleted: suggestionLoad.setIsCompleted,
    onErrorToast: (message) => showToast(message),
  });

  async function handleUseDefaultLocation() {
    location.handleUseDefaultLocation();
    await suggestionLoad.loadSuggestions();
  }

  function handleGoToSettings() {
    location.closeLocationDeniedModal();
    navigate("/settings");
  }

  function handleSwipe() {
    if (suggestionLoad.places.length <= 1) return;
    const skippedPlace = suggestionLoad.places[0];
    if (skippedPlace) {
      sendSuggestionSkipped({
        placeName: skippedPlace.name,
        category: pickCategoryFromAPIPlaceTypes(skippedPlace.types ?? []),
        isInterestMatch: !!skippedPlace.is_interest_match,
        isBreakout: !!skippedPlace.is_breakout,
      });
    }
    suggestionLoad.setPlaces((prev) => {
      const next = [...prev.slice(1), prev[0]];
      const nextPlace = next[0];
      if (nextPlace) {
        sendSuggestionViewed({
          placeName: nextPlace.name,
          category: pickCategoryFromAPIPlaceTypes(nextPlace.types ?? []),
          isInterestMatch: !!nextPlace.is_interest_match,
          isBreakout: !!nextPlace.is_breakout,
          cardIndex: suggestionLoad.originalCardOrder.indexOf(
            nextPlace.place_id,
          ),
        });
      }
      return next;
    });
  }

  const snooze = useSnooze({
    authToken,
    onConfirmed: () => {
      const snoozedPlace = suggestionLoad.places[0];
      if (!snoozedPlace) return;
      sendSuggestionSnoozed({
        placeName: snoozedPlace.name,
        category: pickCategoryFromAPIPlaceTypes(snoozedPlace.types ?? []),
        isInterestMatch: !!snoozedPlace.is_interest_match,
        isBreakout: !!snoozedPlace.is_breakout,
        snoozeDays: 7,
      });
      suggestionLoad.setPlaces((prev) => prev.slice(1));
    },
  });

  function handleSnooze() {
    const place = suggestionLoad.places[0];
    if (!place) return;
    snooze.openSnoozeModal(place.place_id, place.name);
  }

  const currentPlace: PlaceWithPhoto | undefined = suggestionLoad.places[0];
  const isVisited = currentPlace
    ? checkIn.visitedIds.has(currentPlace.place_id)
    : false;
  const currentIndex = currentPlace
    ? suggestionLoad.originalCardOrder.indexOf(currentPlace.place_id)
    : 0;
  // development環境では常に有効化（開発・テストの利便性のため）
  const isNearCurrentPlace =
    import.meta.env.DEV ||
    (currentPlace !== undefined &&
      isWithinCheckInRange(
        location.userPos.lat,
        location.userPos.lng,
        currentPlace.lat,
        currentPlace.lng,
      ));

  return {
    places: suggestionLoad.places,
    isLoading: suggestionLoad.isLoading,
    error: suggestionLoad.error,
    isCompleted: suggestionLoad.isCompleted,
    checkingIn: checkIn.isCheckingIn,
    userPos: location.userPos,
    visitedIds: checkIn.visitedIds,
    xpModalState: checkIn.xpModalState,
    badgeQueue: checkIn.badgeModalQueue,
    reloadCountRemaining: suggestionLoad.reloadCountRemaining,
    isReloading: suggestionLoad.isReloading,
    showLocationDeniedModal: location.showLocationDeniedModal,
    isUsingDefaultLocation: location.isUsingDefaultLocation,
    currentPlace,
    isVisited,
    currentIndex,
    isNearCurrentPlace,
    isSnoozeModalOpen: snooze.isModalOpen,
    loadSuggestions: suggestionLoad.loadSuggestions,
    handleReload: suggestionLoad.handleReload,
    handleUseDefaultLocation,
    handleGoToSettings,
    handleSwipe,
    handleSnooze,
    confirmSnooze: snooze.confirmSnooze,
    cancelSnooze: snooze.cancelSnooze,
    handleCheckIn: checkIn.handleCheckIn,
    handleXpModalClose: checkIn.handleXpModalClose,
    handleBadgeModalClose: checkIn.handleBadgeModalClose,
  };
}
