interface ActionButtonsProps {
  onCheckIn: () => void;
  onReload: () => void;
  isVisited: boolean;
  isCheckingIn: boolean;
  reloadCountRemaining: number;
  isReloading: boolean;
}

export default function ActionButtons({
  onCheckIn,
  onReload,
  isVisited,
  isCheckingIn,
  reloadCountRemaining,
  isReloading,
}: ActionButtonsProps) {
  const isReloadDisabled = reloadCountRemaining <= 0 || isReloading;

  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onReload}
          disabled={isReloadDisabled}
          aria-label="リロード"
          className="size-14 flex items-center justify-center rounded-full bg-white dark:bg-white/10 shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <span className={`material-symbols-outlined text-2xl text-gray-500 ${isReloading ? "animate-spin" : ""}`}>
            {isReloading ? "progress_activity" : "refresh"}
          </span>
        </button>
        <span className="text-xs text-gray-400">
          あと{reloadCountRemaining}回
        </span>
      </div>

      <button
        onClick={onCheckIn}
        disabled={isVisited || isCheckingIn}
        className="flex-1 h-14 rounded-full bg-primary text-white font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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
