import { Icon } from "~/components/Icon";

interface AppHeaderProps {
  locationLabel?: string;
  isDefaultLocation?: boolean;
  onLocationClick?: () => void;
  onClose?: () => void;
}

export default function AppHeader({
  locationLabel,
  isDefaultLocation,
  onLocationClick,
  onClose,
}: AppHeaderProps) {
  return (
    <header className="flex items-center pl-6 pr-8 pt-6 pb-2">
      {onClose ? (
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="size-10 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-full shadow-sm shrink-0"
            aria-label="閉じる"
          >
            <Icon name="arrow-back" className="text-xl" />
          </button>
          <span className="text-base font-bold">行き先を選ぶ</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          {locationLabel && (
            <>
              <button
                onClick={onLocationClick}
                className="size-10 flex items-center justify-center mr-0.5 bg-white/10 backdrop-blur-md rounded-full shadow-sm shrink-0"
                aria-label="マップで行き先を選ぶ"
              >
                <Icon name="gps-fixed" className="text-xl text-gray-300" />
              </button>
              <button
                onClick={onLocationClick}
                className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm min-w-0"
                aria-label="マップで行き先を選ぶ"
              >
                <Icon
                  name={isDefaultLocation ? "location_off" : "location_on"}
                  className={`text-xl shrink-0 ${isDefaultLocation ? "text-amber-500" : "text-primary"}`}
                />
                <span className="text-sm font-bold truncate">
                  {locationLabel}
                </span>
              </button>
            </>
          )}
        </div>
      )}
      <div className="flex-1" />
      <h1 className="text-xl font-extrabold tracking-tighter">Roamble</h1>
    </header>
  );
}
