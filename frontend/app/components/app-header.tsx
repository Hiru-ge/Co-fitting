import { Link } from "react-router";

interface AppHeaderProps {
  locationLabel?: string;
}

export default function AppHeader({ locationLabel }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 pt-6 pb-2">
      {locationLabel ? (
        <div className="flex items-center gap-1 bg-white/80 dark:bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">
          <span className="material-symbols-outlined text-primary text-xl">
            location_on
          </span>
          <span className="text-sm font-bold">{locationLabel}</span>
        </div>
      ) : (
        <div />
      )}
      <h1 className="text-xl font-extrabold tracking-tighter">Roamble</h1>
      <Link
        to="/profile"
        className="size-10 flex items-center justify-center bg-white dark:bg-white/10 rounded-full shadow-sm"
      >
        <span className="material-symbols-outlined">person</span>
      </Link>
    </header>
  );
}
