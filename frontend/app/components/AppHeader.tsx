import { Link } from "react-router";
import { Icon } from "~/components/Icon";

interface AppHeaderProps {
  locationLabel?: string;
  isDefaultLocation?: boolean;
}

export default function AppHeader({
  locationLabel,
  isDefaultLocation,
}: AppHeaderProps) {
  return (
    <header className="flex items-center px-6 pt-6 pb-2">
      <div className="min-w-0">
        {locationLabel ? (
          <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm max-w-full">
            <Icon
              name={isDefaultLocation ? "location_off" : "location_on"}
              className={`text-xl shrink-0 ${isDefaultLocation ? "text-amber-500" : "text-primary"}`}
            />
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
        className="size-10 flex items-center justify-center bg-white/10 rounded-full shadow-sm"
      >
        <Icon name="person" />
      </Link>
    </header>
  );
}
