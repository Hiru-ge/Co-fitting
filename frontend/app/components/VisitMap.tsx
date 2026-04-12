import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { getCategoryInfo } from "~/lib/category-map";
import { formatShortDate } from "~/utils/helpers";
import {
  getCurrentPositionWithFallback,
  type Position,
} from "~/lib/geolocation";
import { DEFAULT_LOCATION } from "~/utils/constants";
import type { MapVisit } from "~/types/visit";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

interface Props {
  visits: MapVisit[];
}

export function calcMapCenter(
  visits: { lat: number; lng: number }[],
  userPosition: { lat: number; lng: number } | null,
  defaultPosition: { lat: number; lng: number },
): { lat: number; lng: number } {
  if (userPosition) return userPosition;
  if (visits.length > 0) {
    const lat = visits.reduce((sum, v) => sum + v.lat, 0) / visits.length;
    const lng = visits.reduce((sum, v) => sum + v.lng, 0) / visits.length;
    return { lat, lng };
  }
  return defaultPosition;
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
        <span
          className="material-symbols-outlined text-white text-sm"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {categoryInfo.icon}
        </span>
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

function VisitInfoContent({ visit }: { visit: MapVisit }) {
  const categoryInfo = getCategoryInfo(visit.category);

  return (
    <div className="min-w-[180px] max-w-[220px] p-1">
      <p className="font-bold text-gray-800 text-sm leading-tight mb-1">
        {visit.place_name}
      </p>
      <div className="flex items-center gap-1 text-gray-500 text-xs mb-2">
        <span
          className="material-symbols-outlined text-xs"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {categoryInfo.icon}
        </span>
        <span>{categoryInfo.label}</span>
        <span className="mx-0.5">·</span>
        <span>{formatShortDate(visit.visited_at)}</span>
      </div>
      <Link
        to={`/history/${visit.id}`}
        className="block text-center text-xs font-medium text-white bg-primary-purple rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity"
      >
        詳細を見る
      </Link>
    </div>
  );
}

export default function VisitMap({ visits }: Props) {
  const [selectedVisit, setSelectedVisit] = useState<MapVisit | null>(null);
  const [userPosition, setUserPosition] = useState<Position | null>(null);
  const [isPositionAvailable, setIsPositionAvailable] = useState(false);

  useEffect(() => {
    getCurrentPositionWithFallback().then((pos) => {
      setUserPosition(pos);
      setIsPositionAvailable(true);
    });
  }, []);

  if (!isPositionAvailable) {
    return (
      <div
        data-testid="map-loading"
        className="flex items-center justify-center"
        style={{ height: "calc(100dvh - 180px)" }}
      >
        <span className="text-sm text-gray-400">地図を読み込み中...</span>
      </div>
    );
  }

  const center = calcMapCenter(visits, userPosition, DEFAULT_LOCATION);

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        style={{ width: "100%", height: "calc(100dvh - 180px)" }}
        defaultCenter={center}
        defaultZoom={15}
        mapId={`roamble-visit-map`}
        gestureHandling="greedy"
        disableDefaultUI={false}
        colorScheme="FOLLOW_SYSTEM"
      >
        {visits.map((visit) => (
          <AdvancedMarker
            key={visit.id}
            position={{ lat: visit.lat, lng: visit.lng }}
            onClick={() =>
              setSelectedVisit((prev: MapVisit | null) =>
                prev?.id === visit.id ? null : visit,
              )
            }
          >
            <PinMarker category={visit.category} />
          </AdvancedMarker>
        ))}

        {selectedVisit && (
          <InfoWindow
            position={{ lat: selectedVisit.lat, lng: selectedVisit.lng }}
            onClose={() => setSelectedVisit(null)}
            pixelOffset={[0, -40]}
          >
            <VisitInfoContent visit={selectedVisit} />
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  );
}
