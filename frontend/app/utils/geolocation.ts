import { DEFAULT_LOCATION, CHECKIN_DISTANCE_THRESHOLD } from "./constants";

export interface Position {
  lat: number;
  lng: number;
}

export function calcMapCenter(
  visits: { lat: number; lng: number }[],
  userPosition: Position | null
): Position {
  if (userPosition) return userPosition;
  if (visits.length > 0) {
    const lat = visits.reduce((sum, v) => sum + v.lat, 0) / visits.length;
    const lng = visits.reduce((sum, v) => sum + v.lng, 0) / visits.length;
    return { lat, lng };
  }
  return { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };
}

export function getCurrentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

export async function getPositionWithFallback(): Promise<Position> {
  try {
    return await getCurrentPosition();
  } catch {
    return { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };
  }
}

/**
 * 30秒ごとに getCurrentPosition を呼び出し、onPosition に結果を渡す。
 * 起動直後に1回即時取得し、以降30秒間隔でポーリングする。
 * 返り値の interval ID を clearInterval() に渡すと停止できる。
 * Geolocation非対応の環境では null を返す。
 */
export function startPositionPolling(
  onPosition: (pos: Position) => void,
  onError?: (err: GeolocationPositionError) => void
): ReturnType<typeof setInterval> | null {
  if (!navigator.geolocation) return null;

  const fetch = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => onPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      onError,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    );
  };

  fetch();
  return setInterval(fetch, 30000);
}

/**
 * ユーザーが対象施設の訪問記録可能圏内（デフォルト200m以内）にいるか判定する。
 * userPos が (0,0) の場合は GPS 未取得とみなし true を返す。
 */
export function isWithinCheckInRange(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  thresholdMeters: number = CHECKIN_DISTANCE_THRESHOLD
): boolean {
  if (userLat === 0 && userLng === 0) return true;
  return calcDistance(userLat, userLng, targetLat, targetLng) <= thresholdMeters;
}

export function calcDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
