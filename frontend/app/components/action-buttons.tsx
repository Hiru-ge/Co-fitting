interface ActionButtonsProps {
  onCheckIn: () => void;
  onSkip: () => void;
  isVisited: boolean;
  isCheckingIn: boolean;
}

export default function ActionButtons({
  onCheckIn,
  onSkip,
  isVisited,
  isCheckingIn,
}: ActionButtonsProps) {
  return (
    <div className="flex items-center gap-4 w-full">
      <button
        onClick={onSkip}
        aria-label="スキップ"
        className="size-14 flex items-center justify-center rounded-full bg-white dark:bg-white/10 shadow-md"
      >
        <span className="material-symbols-outlined text-2xl text-gray-500">skip_next</span>
      </button>

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
