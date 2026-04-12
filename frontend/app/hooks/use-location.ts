import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCurrentPosition,
  startPositionPolling,
  type Position,
} from "~/lib/geolocation";
import { DEFAULT_LOCATION } from "~/utils/constants";

export type LocationStatus = "normal" | "denied" | "using_default";

interface UseLocationOptions {
  enablePolling: boolean;
}

export function useLocation({ enablePolling }: UseLocationOptions) {
  const [userPos, setUserPos] = useState<Position>({ lat: 0, lng: 0 });
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("normal");
  const [showLocationDeniedModal, setShowLocationDeniedModal] = useState(false);
  const useDefaultLocationRef = useRef(false);

  useEffect(() => {
    if (!enablePolling || locationStatus !== "normal") return;

    const intervalId = startPositionPolling(setUserPos);
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [enablePolling, locationStatus]);

  const resolveCurrentPosition = useCallback(async () => {
    if (useDefaultLocationRef.current || locationStatus === "using_default") {
      const fallback = { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };
      setUserPos(fallback);
      return fallback;
    }

    try {
      const pos = await getCurrentPosition();
      setUserPos(pos);
      setLocationStatus("normal");
      useDefaultLocationRef.current = false;
      return pos;
    } catch (locErr) {
      const isDenied = (locErr as { code?: number } | null)?.code === 1;
      if (isDenied) {
        setLocationStatus("denied");
        setShowLocationDeniedModal(true);
        return null;
      }

      const fallback = { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };
      setUserPos(fallback);
      setLocationStatus("using_default");
      useDefaultLocationRef.current = true;
      return fallback;
    }
  }, [locationStatus]);

  const handleUseDefaultLocation = useCallback(() => {
    setShowLocationDeniedModal(false);
    setLocationStatus("using_default");
    useDefaultLocationRef.current = true;
    setUserPos({ lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng });
  }, []);

  const closeLocationDeniedModal = useCallback(() => {
    setShowLocationDeniedModal(false);
  }, []);

  return {
    userPos,
    locationStatus,
    showLocationDeniedModal,
    isUsingDefaultLocation: locationStatus === "using_default",
    resolveCurrentPosition,
    handleUseDefaultLocation,
    closeLocationDeniedModal,
  };
}
