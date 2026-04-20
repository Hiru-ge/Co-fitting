import { useState, useEffect } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { Icon } from "~/components/Icon";
import {
  getCategoryInfo,
  pickCategoryFromAPIPlaceTypes,
} from "~/lib/category-map";
import { getNearbyVisitablePlaces } from "~/api/places";
import type { Place } from "~/types/suggestion";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

interface Props {
  authToken: string;
  userLat: number;
  userLng: number;
  excludePlaceIds?: string[];
  onSelect: (place: Place) => void;
}

function PinMarker({ category }: { category: string }) {
  const categoryInfo = getCategoryInfo(category);

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.4))` }}
    >
      <div
        className="flex items-center justify-center size-9 rounded-full border-2 border-white"
        style={{ backgroundColor: categoryInfo.hexColor }}
      >
        <Icon name={categoryInfo.icon} fill className="text-white text-sm" />
      </div>
      <div
        className="w-0 h-0"
        style={{
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `7px solid ${categoryInfo.hexColor}`,
          marginTop: "-1px",
        }}
      />
    </div>
  );
}

function PlaceInfoContent({
  place,
  onSelect,
}: {
  place: Place;
  onSelect: (place: Place) => void;
}) {
  const category = pickCategoryFromAPIPlaceTypes(place.types ?? []);
  const categoryInfo = getCategoryInfo(category);

  return (
    <div className="min-w-45 max-w-55 p-1">
      <p className="font-bold text-gray-800 text-sm leading-tight mb-1">
        {place.name}
      </p>
      <div className="flex items-center gap-1 text-gray-500 text-xs mb-2">
        <Icon name={categoryInfo.icon} fill className="text-xs" />
        <span>{categoryInfo.label}</span>
        {place.rating > 0 && (
          <>
            <span className="mx-0.5">·</span>
            <span>★ {place.rating.toFixed(1)}</span>
          </>
        )}
      </div>
      <button
        onClick={() => onSelect(place)}
        className="block w-full text-center text-xs font-medium text-white bg-primary-purple rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity"
        aria-label="ここに行く！"
      >
        ここに行く！
      </button>
    </div>
  );
}

export default function PlacePickerMap({
  authToken,
  userLat,
  userLng,
  excludePlaceIds = [],
  onSelect,
}: Props) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const excluded = new Set(excludePlaceIds);
    getNearbyVisitablePlaces(authToken, userLat, userLng)
      .then((result) =>
        setPlaces(result.filter((p) => !excluded.has(p.place_id))),
      )
      .catch(() => setPlaces([]))
      .finally(() => setIsLoading(false));
  }, [authToken, userLat, userLng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-gray-400">
            周辺のお店を探しています...
          </span>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <APIProvider apiKey={API_KEY}>
            <Map
              style={{ width: "100%", height: "100%" }}
              defaultCenter={{ lat: userLat, lng: userLng }}
              defaultZoom={16}
              mapId="roamble-place-picker"
              gestureHandling="greedy"
              disableDefaultUI={false}
              colorScheme="FOLLOW_SYSTEM"
            >
              {places.map((place) => (
                <AdvancedMarker
                  key={place.place_id}
                  position={{ lat: place.lat, lng: place.lng }}
                  onClick={() =>
                    setSelectedPlace((prev) =>
                      prev?.place_id === place.place_id ? null : place,
                    )
                  }
                >
                  <PinMarker
                    category={pickCategoryFromAPIPlaceTypes(place.types ?? [])}
                  />
                </AdvancedMarker>
              ))}

              {selectedPlace && (
                <InfoWindow
                  position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                  onClose={() => setSelectedPlace(null)}
                  pixelOffset={[0, -40]}
                >
                  <PlaceInfoContent place={selectedPlace} onSelect={onSelect} />
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        </div>
      )}
    </div>
  );
}
