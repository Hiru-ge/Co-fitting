import { useState } from "react";
import { Link } from "react-router";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { getCategoryInfoByKey } from "~/utils/category-map";
import { formatShortDate } from "~/utils/helpers";
import type { MapVisit } from "~/types/visit";

// カテゴリー別のピン色（Tailwind の bg 色に直接使えないので hex を定義）
const CATEGORY_PIN_COLORS: Record<string, string> = {
  cafe: "#d97706",
  restaurant: "#ef4444",
  bar: "#7c3aed",
  park: "#16a34a",
  museum: "#2563eb",
  art_gallery: "#ec4899",
  library: "#0891b2",
  book_store: "#ca8a04",
  clothing_store: "#f43f5e",
  shopping_mall: "#8b5cf6",
  movie_theater: "#475569",
  gym: "#ea580c",
  spa: "#0d9488",
  bakery: "#f97316",
  tourist_attraction: "#0ea5e9",
  temple: "#b91c1c",
  shrine: "#c2410c",
  church: "#6366f1",
  night_club: "#c026d3",
  amusement_park: "#eab308",
  aquarium: "#38bdf8",
  zoo: "#65a30d",
  stadium: "#10b981",
};

const DEFAULT_PIN_COLOR = "#6b7280";

function getPinColor(category: string): string {
  return CATEGORY_PIN_COLORS[category] ?? DEFAULT_PIN_COLOR;
}

// 東京（渋谷）をデフォルトの地図中心に設定
const DEFAULT_CENTER = { lat: 35.658, lng: 139.7016 };
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

interface Props {
  visits: MapVisit[];
}

export default function VisitMap({ visits }: Props) {
  const [selectedVisit, setSelectedVisit] = useState<MapVisit | null>(null);

  // 訪問記録がある場合は最初のピンを中心に
  const center =
    visits.length > 0
      ? { lat: visits[0].lat, lng: visits[0].lng }
      : DEFAULT_CENTER;

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
                prev?.id === visit.id ? null : visit
              )
            }
          >
            <PinMarker
              category={visit.category}
              isComfortZone={visit.is_comfort_zone}
            />
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

// カスタムピンマーカー
function PinMarker({
  category,
  isComfortZone,
}: {
  category: string;
  isComfortZone: boolean;
}) {
  const color = getPinColor(category);
  const categoryInfo = getCategoryInfoByKey(category);

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.4))` }}
    >
      {/* ピン本体 */}
      <div
        className="flex items-center justify-center size-9 rounded-full border-2 border-white"
        style={{ backgroundColor: color }}
      >
        <span
          className="material-symbols-outlined text-white text-sm"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {categoryInfo.icon}
        </span>
      </div>
      {/* 脱却バッジ */}
      {isComfortZone && (
        <div
          className="absolute -top-1 -right-1 size-3.5 rounded-full bg-yellow-400 border border-white flex items-center justify-center"
          title="コンフォートゾーン脱却！"
        >
          <span className="text-[7px] leading-none">⭐</span>
        </div>
      )}
      {/* 下向き三角 */}
      <div
        className="w-0 h-0"
        style={{
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `7px solid ${color}`,
          marginTop: "-1px",
        }}
      />
    </div>
  );
}

// InfoWindow のコンテンツ
function VisitInfoContent({ visit }: { visit: MapVisit }) {
  const categoryInfo = getCategoryInfoByKey(visit.category);

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
      {visit.is_comfort_zone && (
        <p className="text-[10px] text-yellow-600 font-medium mb-2">
          ⭐ コンフォートゾーン脱却！
        </p>
      )}
      <Link
        to={`/history/${visit.id}`}
        className="block text-center text-xs font-medium text-white bg-primary-purple rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity"
      >
        詳細を見る
      </Link>
    </div>
  );
}
