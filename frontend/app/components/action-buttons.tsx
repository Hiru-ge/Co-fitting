interface ActionButtonsProps {
  onCheckIn: () => void;
  onReload: () => void;
  isVisited: boolean;
  isCheckingIn: boolean;
  reloadCountRemaining: number;
  isReloading: boolean;
  isNearPlace: boolean;
}

export default function ActionButtons({
  onCheckIn,
  onReload,
  isVisited,
  isCheckingIn,
  reloadCountRemaining,
  isReloading,
  isNearPlace,
}: ActionButtonsProps) {
  const isReloadDisabled = reloadCountRemaining <= 0 || isReloading;
  const isCheckInDisabled = isVisited || isCheckingIn || !isNearPlace;

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={onReload}
          disabled={isReloadDisabled}
          aria-label="リロード"
          className="size-12 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <span className={`material-symbols-outlined text-xl text-gray-300 ${isReloading ? "animate-spin" : ""}`}>
            {isReloading ? "progress_activity" : "refresh"}
          </span>
        </button>
        <span className="text-xs text-white/70">
          あと{reloadCountRemaining}回
        </span>
      </div>

      <button
        onClick={onCheckIn}
        disabled={isCheckInDisabled}
        className="flex-1 h-12 rounded-full bg-primary text-white font-bold text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isCheckingIn ? (
          <span className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            記録中...
          </span>
        ) : isVisited ? (
          <span className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-xl">check_circle</span>
            記録済み
          </span>
        ) : !isNearPlace ? (
          <span className="flex items-center justify-center gap-2 text-sm">
            <span className="material-symbols-outlined text-xl">location_off</span>
            到着してから記録できます
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-xl">explore</span>
            行ってきた！
          </span>
        )}
      </button>
    </div>
  );
}
