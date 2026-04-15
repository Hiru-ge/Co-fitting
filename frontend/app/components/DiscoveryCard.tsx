import { useRef, useState } from "react";
import { Icon } from "~/components/Icon";
import type { Place } from "~/types/suggestion";
import {
  getCategoryInfo,
  pickCategoryFromAPIPlaceTypes,
} from "~/lib/category-map";
import { calcHaversineDistance } from "~/lib/geolocation";
import { buildGoogleMapsPlaceUrl, formatDistance } from "~/utils/helpers";
import { useCardDrag } from "~/hooks/use-card-drag";

interface DiscoveryCardProps {
  place: Place;
  isVisited: boolean;
  userLat: number;
  userLng: number;
  photoUrl?: string;
  /** スタック内の位置 (0 = 最前面) */
  depthFromTop: number;
  onSwipe?: () => void;
}

const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DURATION_MS = 300;
const ROTATION_FACTOR = 0.08;
const STACK_SCALE_STEP = 0.05;

export default function DiscoveryCard({
  place,
  isVisited,
  userLat,
  userLng,
  photoUrl,
  depthFromTop,
  onSwipe,
}: DiscoveryCardProps) {
  const category = getCategoryInfo(pickCategoryFromAPIPlaceTypes(place.types));
  const distance = calcHaversineDistance(
    userLat,
    userLng,
    place.lat,
    place.lng,
  );
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | undefined>();
  const hasValidPhoto = !!photoUrl && failedPhotoUrl !== photoUrl;

  const cardRef = useRef<HTMLDivElement>(null);
  const [isSwipingOut, setIsSwipingOut] = useState(false);

  const isTopCard = depthFromTop === 0;
  const {
    offset,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useCardDrag({
    cardRef,
    enabled: isTopCard,
    swipeThreshold: SWIPE_THRESHOLD,
    onThresholdExceeded: () => {
      setIsSwipingOut(true);
      window.setTimeout(() => {
        onSwipe?.();
        setIsSwipingOut(false);
      }, SWIPE_OUT_DURATION_MS);
    },
  });

  const rotation = offset.x * ROTATION_FACTOR;

  // スタック位置による変形
  const stackScale = 1 - depthFromTop * STACK_SCALE_STEP;

  const cardTransform = isTopCard
    ? `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`
    : `scale(${stackScale})`;

  const cardTransition = isDragging
    ? "none"
    : "transform 0.3s ease-out, opacity 0.3s ease-out";

  const cardOpacity = isSwipingOut ? 0 : 1;
  const cardZIndex = 10 - depthFromTop;

  return (
    <div
      ref={cardRef}
      data-tour={isTopCard ? "discovery-card-top" : undefined}
      className={`absolute inset-0 rounded-3xl overflow-hidden ${hasValidPhoto ? "bg-gray-900" : `bg-linear-to-br ${category.gradientColor}`} shadow-xl select-none touch-none ${isTopCard ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{
        transform: cardTransform,
        opacity: cardOpacity,
        transition: cardTransition,
        zIndex: cardZIndex,
        transformOrigin: "center center",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {hasValidPhoto ? (
        <img
          src={photoUrl}
          alt={place.name}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailedPhotoUrl(photoUrl)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <Icon
            name={category.icon}
            className="text-white"
            style={{ fontSize: "12rem" }}
          />
        </div>
      )}

      {/* 上部の黒グラデーション(MEMO: この実装は上から被せているだけで不格好なので、何か代案があれば変える) */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-black/80 via-black/50 to-transparent pointer-events-none" />

      {/* バッジ */}
      <div className="absolute top-4 left-4 flex gap-2">
        <span className="bg-white/30 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full">
          NEW SPOT
        </span>
        <span
          data-testid="genre-badge"
          className={`${place.is_interest_match ? "bg-orange-500/90" : "bg-white/20"} backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full`}
        >
          {category.label}
        </span>
        {place.is_breakout === true && (
          <span className="bg-red-600 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full">
            チャレンジ
          </span>
        )}
      </div>

      {/* 施設情報 */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pt-32 pb-20 bg-linear-to-t from-black/80 via-black/50 to-transparent">
        <h2
          className="text-2xl font-extrabold text-white leading-tight mb-2"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
        >
          <a
            data-testid="google-maps-link"
            href={buildGoogleMapsPlaceUrl(place.place_id)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {place.name}
            <span className="flex items-center gap-1 text-white text-sm hover:text-white transition-colors">
              (Google Mapsで開く)
            </span>
          </a>
        </h2>
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 text-white text-sm"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
          >
            <span className="flex items-center gap-1">
              <Icon name={category.icon} className="text-base" />
              {category.label}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="distance" className="text-base" />
              {formatDistance(distance)}
            </span>
            {place.rating > 0 && (
              <span className="flex items-center gap-1">
                <Icon name="star" className="text-base text-yellow-400" />
                {place.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 訪問済みオーバーレイ */}
      {isVisited && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white/20 backdrop-blur-md rounded-full p-4">
            <Icon name="check_circle" className="text-white text-5xl" />
          </div>
        </div>
      )}
    </div>
  );
}
