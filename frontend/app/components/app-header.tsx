import { Link } from "react-router";

interface AppHeaderProps {
  locationLabel?: string;
  isDefaultLocation?: boolean;
}

export default function AppHeader({ locationLabel, isDefaultLocation }: AppHeaderProps) {
  return (
    <header className="flex items-center px-6 pt-6 pb-2">
      <div className="min-w-0">
        {locationLabel ? (
          <div className="inline-flex items-center gap-1 bg-white/80 dark:bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm max-w-full">
            <span className={`material-symbols-outlined text-xl shrink-0 ${isDefaultLocation ? "text-amber-500" : "text-primary"}`}>
              {isDefaultLocation ? "location_off" : "location_on"}
            </span>
            <span className="text-sm font-bold truncate">{locationLabel}</span>
          </div>
        ) : (
          <div />
        )}
      </div>
      <div className="flex-1" />
      <h1 className="text-xl font-extrabold tracking-tighter mr-3">Roamble</h1>
      <Link
        to="/profile"
        className="size-10 flex items-center justify-center bg-white dark:bg-white/10 rounded-full shadow-sm"
      >
        <span className="material-symbols-outlined">person</span>
      </Link>
    </header>
  );
}
