import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSuggestions } from "~/api/suggestions";
import { getPlacePhoto } from "~/api/places";
import { pickCategoryFromAPIPlaceTypes } from "~/lib/category-map";
import {
  ApiError,
  API_ERROR_CODES,
  SUGGESTION_MESSAGES,
  toUserMessage,
} from "~/utils/error";
import { sendSuggestionGenerated, sendSuggestionReloaded } from "~/lib/gtag";
import type { Place } from "~/types/suggestion";

export type PlaceWithPhoto = Place & { photoUrl?: string };

interface UseSuggestionLoadOptions {
  authToken: string;
  resolveCurrentPosition: () => Promise<{ lat: number; lng: number } | null>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export function useSuggestionLoad({
  authToken,
  resolveCurrentPosition,
  showToast,
}: UseSuggestionLoadOptions) {
  const [places, setPlaces] = useState<PlaceWithPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [reloadCountRemaining, setReloadCountRemaining] = useState(3);
  const [originalCardOrder, setOriginalCardOrder] = useState<string[]>([]);
  const [isReloading, setIsReloading] = useState(false);
  const loadModeRef = useRef<"initial" | "normal" | "reload">("initial");

  const loadSuggestions = useCallback(async () => {
    const isReload = loadModeRef.current === "reload";

    setError(null);
    setIsCompleted(false);

    const pos = await resolveCurrentPosition();
    if (!pos) return;

    try {
      const {
        places: collected,
        notice,
        is_completed,
        reload_count_remaining,
      } = await getSuggestions(authToken, pos.lat, pos.lng, isReload);

      if (reload_count_remaining !== undefined) {
        setReloadCountRemaining(reload_count_remaining);
      }

      if (is_completed) {
        if (notice === API_ERROR_CODES.ALL_VISITED_NEARBY) {
          setError(SUGGESTION_MESSAGES.ALL_VISITED_NEARBY);
        } else {
          setIsCompleted(true);
        }
        setPlaces([]);
        setOriginalCardOrder([]);
        return;
      }

      if (notice === API_ERROR_CODES.NO_INTEREST_PLACES) {
        showToast(SUGGESTION_MESSAGES.NO_INTEREST_PLACES, "info");
      }

      if (collected.length === 0) {
        setError("近くのスポットが見つかりませんでした");
        setPlaces([]);
        setOriginalCardOrder([]);
        return;
      }

      const placesWithPhotos: PlaceWithPhoto[] = await Promise.all(
        collected.map(async (place) => {
          if (!place.photo_reference) return place;
          try {
            const photoUrl = await getPlacePhoto(
              authToken,
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
      setOriginalCardOrder(placesWithPhotos.map((place) => place.place_id));

      sendSuggestionGenerated({
        placesCount: placesWithPhotos.length,
        interestMatchCount: placesWithPhotos.filter((p) => p.is_interest_match)
          .length,
        breakoutCount: placesWithPhotos.filter((p) => p.is_breakout).length,
        categories: placesWithPhotos.map((p) =>
          pickCategoryFromAPIPlaceTypes(p.types ?? []),
        ),
        isReload,
      });
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
    }
  }, [authToken, resolveCurrentPosition, showToast]);

  const query = useQuery({
    queryKey: ["suggestions", authToken],
    queryFn: async () => {
      await loadSuggestions();
      return true;
    },
    staleTime: 30000,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const handleReload = useCallback(async () => {
    sendSuggestionReloaded(reloadCountRemaining);
    loadModeRef.current = "reload";
    setIsReloading(true);
    try {
      await query.refetch();
    } finally {
      loadModeRef.current = "normal";
      setIsReloading(false);
    }
  }, [query, reloadCountRemaining]);

  const handleRetry = useCallback(async () => {
    loadModeRef.current = "normal";
    await query.refetch();
  }, [query]);

  return {
    places,
    setPlaces,
    error,
    isCompleted,
    setIsCompleted,
    reloadCountRemaining,
    isReloading,
    originalCardOrder,
    isLoading: query.isLoading || (query.isFetching && !isReloading),
    loadSuggestions: handleRetry,
    handleReload,
  };
}
