import { useRef, useState, useCallback } from "react";
import type { Place } from "~/types/suggestion";
import { getCategoryInfo } from "~/utils/category-map";
import { calcDistance } from "~/utils/geolocation";
import { formatDistance } from "~/utils/helpers";

interface DiscoveryCardProps {
  place: Place;
  isVisited: boolean;
  userLat: number;
  userLng: number;
  onSwipe?: () => void;
}

const SWIPE_THRESHOLD = 100;
const SWIPE_OUT_DISTANCE = 600;
const ROTATION_FACTOR = 0.1;

export default function DiscoveryCard({
  place,
  isVisited,
  userLat,
  userLng,
  onSwipe,
}: DiscoveryCardProps) {
  const category = getCategoryInfo(place.types);
  const distance = calcDistance(userLat, userLng, place.lat, place.lng);

  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const dragging = useRef(false);
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isSwiping) return;
    dragging.current = true;
    startX.current = e.clientX;
    setOffsetX(0);
    cardRef.current?.setPointerCapture(e.pointerId);
  }, [isSwiping]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setOffsetX(e.clientX - startX.current);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    if (Math.abs(offsetX) > SWIPE_THRESHOLD) {
      const dir = offsetX > 0 ? 1 : -1;
      setIsSwiping(true);
      setOffsetX(dir * SWIPE_OUT_DISTANCE);
      setTimeout(() => {
        onSwipe?.();
        resetCard();
      }, 250);
    } else {
      setOffsetX(0);
    }
  }, [offsetX, onSwipe]);

  function resetCard() {
    setOffsetX(0);
    setIsSwiping(false);
  }

  const rotation = offsetX * ROTATION_FACTOR;
  const opacity = isSwiping ? 0 : 1;

  const skipOpacity = Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1);

  return (
    <div className="relative w-full aspect-[3/4]">
      {/* 背景SKIPヒント — カードの後ろに常駐 */}
      <div
        className="absolute inset-0 rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-2"
        style={{ opacity: skipOpacity }}
      >
        <span className="material-symbols-outlined text-5xl text-gray-400">swipe</span>
        <span className="text-lg font-bold text-gray-400 tracking-widest">SKIP</span>
      </div>

      {/* カード本体 */}
      <div
        ref={cardRef}
        className={`absolute inset-0 rounded-3xl overflow-hidden bg-gradient-to-br ${category.gradient} shadow-xl select-none touch-none cursor-grab active:cursor-grabbing`}
        style={{
          transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
          opacity,
          transition: dragging.current ? "none" : "transform 0.25s ease-out, opacity 0.25s ease-out",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
      {/* カテゴリアイコン大表示 */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <span className="material-symbols-outlined text-white" style={{ fontSize: "12rem" }}>
          {category.icon}
        </span>
      </div>

      {/* バッジ */}
      <div className="absolute top-4 left-4 flex gap-2">
        <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full">
          NEW SPOT
        </span>
        <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full">
          {category.label}
        </span>
      </div>

      {/* 施設情報 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
        <h2 className="text-3xl font-extrabold text-white leading-tight mb-2">
          {place.name}
        </h2>
        <div className="flex items-center gap-3 text-white/80 text-sm">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-base">{category.icon}</span>
            {category.label}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-base">distance</span>
            {formatDistance(distance)}
          </span>
          {place.rating > 0 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-yellow-400">star</span>
              {place.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* 訪問済みオーバーレイ */}
      {isVisited && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white/20 backdrop-blur-md rounded-full p-4">
            <span className="material-symbols-outlined text-white text-5xl">check_circle</span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
