import { useRef, useState, useCallback, useEffect } from "react";
import type { Place } from "~/types/suggestion";
import { getCategoryInfo } from "~/utils/category-map";
import { calcDistance } from "~/utils/geolocation";
import { buildGoogleMapsPlaceUrl, formatDistance } from "~/utils/helpers";

interface DiscoveryCardProps {
  place: Place;
  isVisited: boolean;
  userLat: number;
  userLng: number;
  photoUrl?: string;
  /** スタック内の位置 (0 = 最前面) */
  stackIndex: number;
  onSwipe?: () => void;
}

const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DISTANCE = 800;
const ROTATION_FACTOR = 0.08;
const STACK_SCALE_STEP = 0.05;

export default function DiscoveryCard({
  place,
  isVisited,
  userLat,
  userLng,
  photoUrl,
  stackIndex,
  onSwipe,
}: DiscoveryCardProps) {
  const category = getCategoryInfo(place.types);
  const distance = calcDistance(userLat, userLng, place.lat, place.lng);
  const [imgError, setImgError] = useState(false);
  const showPhoto = photoUrl && !imgError;

  useEffect(() => {
    setImgError(false);
  }, [photoUrl]);

  const cardRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = useState(false);

  const isTopCard = stackIndex === 0;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isTopCard || isSwiping) return;
      dragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      setOffset({ x: 0, y: 0 });
      cardRef.current?.setPointerCapture(e.pointerId);
    },
    [isTopCard, isSwiping]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y,
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    const dist = Math.sqrt(offset.x ** 2 + offset.y ** 2);

    if (dist > SWIPE_THRESHOLD) {
      const angle = Math.atan2(offset.y, offset.x);
      setIsSwiping(true);
      setOffset({
        x: Math.cos(angle) * SWIPE_OUT_DISTANCE,
        y: Math.sin(angle) * SWIPE_OUT_DISTANCE,
      });
      setTimeout(() => {
        onSwipe?.();
        setOffset({ x: 0, y: 0 });
        setIsSwiping(false);
      }, 300);
    } else {
      setOffset({ x: 0, y: 0 });
    }
  }, [offset, onSwipe]);

  const rotation = offset.x * ROTATION_FACTOR;

  // スタック位置による変形
  const stackScale = 1 - stackIndex * STACK_SCALE_STEP;

  const cardTransform = isTopCard
    ? `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`
    : `scale(${stackScale})`;

  const cardTransition = dragging.current
    ? "none"
    : "transform 0.3s ease-out, opacity 0.3s ease-out";

  const cardOpacity = isSwiping ? 0 : 1;
  const cardZIndex = 10 - stackIndex;

  return (
    <div
      ref={cardRef}
      className={`absolute inset-0 rounded-3xl overflow-hidden ${showPhoto ? "bg-gray-900" : `bg-gradient-to-br ${category.gradient}`} shadow-xl select-none touch-none ${isTopCard ? "cursor-grab active:cursor-grabbing" : ""}`}
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
      {showPhoto ? (
        <img
          src={photoUrl}
          alt={place.name}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <span
            className="material-symbols-outlined text-white"
            style={{ fontSize: "12rem" }}
          >
            {category.icon}
          </span>
        </div>
      )}

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
        {place.is_comfort_zone === true && (
          <span className="bg-red-600 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full">
            脱却モード
          </span>
        )}
      </div>

      {/* 施設情報 */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pt-20 pb-20 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
        <h2
          className="text-2xl font-extrabold text-white leading-tight mb-2"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
        >
          {place.name}
        </h2>
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 text-white text-sm"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
          >
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">
                {category.icon}
              </span>
              {category.label}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">
                distance
              </span>
              {formatDistance(distance)}
            </span>
            {place.rating > 0 && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-yellow-400">
                  star
                </span>
                {place.rating.toFixed(1)}
              </span>
            )}
          </div>
          <a
            data-testid="google-maps-link"
            href={buildGoogleMapsPlaceUrl(place.place_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-white text-sm hover:text-white transition-colors"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-outlined text-base">
              location_on
            </span>
            地図で開く
          </a>
        </div>
      </div>

      {/* 訪問済みオーバーレイ */}
      {isVisited && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white/20 backdrop-blur-md rounded-full p-4">
            <span className="material-symbols-outlined text-white text-5xl">
              check_circle
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
